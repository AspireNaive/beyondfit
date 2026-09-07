import type { RowDataPacket } from 'mysql2/promise'
import type { Db } from '../../db/pool.js'
import { execute, pool, query, queryOne } from '../../db/pool.js'
import type {
  Order,
  OrderLine,
  OrderStatus,
  Payment,
  PaymentMethod,
  PaymentStatus,
  Role,
  Subscription,
  SubscriptionStatus,
} from '../../domain.js'
import { toIsoDateTime } from '../../lib/json.js'

type Currency = Order['total']['currency']

interface OrderRow extends RowDataPacket {
  id: string
  order_no: number
  reference: string
  tenant_id: string
  customer_id: string
  customer_name: string
  customer_email: string
  subtotal_minor: number
  shipping_minor: number
  tax_minor: number
  total_minor: number
  currency: Currency
  status: OrderStatus
  placed_at: Date
  fulfilled_at: Date | null
  tracking_number: string | null
}

interface LineRow extends RowDataPacket {
  order_id: string
  product_id: string
  name: string
  quantity: number
  unit_price_minor: number
  currency: Currency
  instructor_id: string | null
}

const ORDER_COLS = 'id, order_no, reference, tenant_id, customer_id, customer_name, customer_email, subtotal_minor, shipping_minor, tax_minor, total_minor, currency, status, placed_at, fulfilled_at, tracking_number'

const toLine = (l: LineRow): OrderLine => ({
  productId: l.product_id,
  name: l.name,
  quantity: l.quantity,
  unitPrice: { amountMinor: l.unit_price_minor, currency: l.currency },
  ...(l.instructor_id ? { instructorId: l.instructor_id } : {}),
})

const toOrder = (r: OrderRow, lines: LineRow[]): Order => ({
  id: r.id,
  reference: r.reference,
  customerId: r.customer_id,
  customerName: r.customer_name,
  customerEmail: r.customer_email,
  lines: lines.map(toLine),
  subtotal: { amountMinor: r.subtotal_minor, currency: r.currency },
  shipping: { amountMinor: r.shipping_minor, currency: r.currency },
  tax: { amountMinor: r.tax_minor, currency: r.currency },
  total: { amountMinor: r.total_minor, currency: r.currency },
  status: r.status,
  placedAt: r.placed_at.toISOString(),
  ...(r.fulfilled_at ? { fulfilledAt: r.fulfilled_at.toISOString() } : {}),
  ...(r.tracking_number ? { trackingNumber: r.tracking_number } : {}),
})

async function attachLines(rows: OrderRow[], db: Db): Promise<Order[]> {
  if (rows.length === 0) return []
  const lines = await query<LineRow>(
    `SELECT order_id, product_id, name, quantity, unit_price_minor, currency, instructor_id FROM order_lines
     WHERE order_id IN (${rows.map(() => '?').join(',')}) ORDER BY id`,
    rows.map((r) => r.id),
    db,
  )
  const byOrder = new Map<string, LineRow[]>()
  for (const l of lines) (byOrder.get(l.order_id) ?? byOrder.set(l.order_id, []).get(l.order_id)!).push(l)
  return rows.map((r) => toOrder(r, byOrder.get(r.id) ?? []))
}

export type Scope = { role: Role; userId: string; tenantId: string }

export async function listOrders(scope: Scope, db: Db = pool): Promise<Order[]> {
  const where: Record<Role, [string, unknown[]]> = {
    member: ['customer_id = ?', [scope.userId]],
    // A coach sees orders that contain something they authored.
    coach: ['id IN (SELECT order_id FROM order_lines WHERE instructor_id = ?)', [scope.userId]],
    admin: ['tenant_id = ?', [scope.tenantId]],
    app_manager: ['1 = 1', []],
  }
  const [clause, params] = where[scope.role]
  const rows = await query<OrderRow>(`SELECT ${ORDER_COLS} FROM orders WHERE ${clause} ORDER BY placed_at DESC`, params, db)
  return attachLines(rows, db)
}

export async function findOrderRow(id: string, db: Db = pool) {
  return queryOne<OrderRow>(`SELECT ${ORDER_COLS} FROM orders WHERE id = ?`, [id], db)
}

export async function findOrder(id: string, db: Db = pool): Promise<Order | null> {
  const row = await findOrderRow(id, db)
  if (!row) return null
  return (await attachLines([row], db))[0] ?? null
}

/** True when the order contains a line authored by `instructorId`. */
export async function orderHasInstructor(orderId: string, instructorId: string, db: Db = pool) {
  const row = await queryOne(`SELECT 1 AS hit FROM order_lines WHERE order_id = ? AND instructor_id = ? LIMIT 1`, [orderId, instructorId], db)
  return row !== null
}

export type NewOrder = {
  id: string
  tenantId: string
  customerId: string
  customerName: string
  customerEmail: string
  subtotalMinor: number
  shippingMinor: number
  taxMinor: number
  totalMinor: number
  currency: string
  status: OrderStatus
  placedAt?: Date
  trackingNumber?: string | null
  lines: readonly { productId: string; name: string; quantity: number; unitPriceMinor: number; currency: string; instructorId?: string | null }[]
}

/** References are sequential and human-readable: KL-10001, KL-10002, … */
export const referenceFor = (orderNo: number) => `KL-${10_000 + orderNo}`

export async function insertOrder(o: NewOrder, db: Db): Promise<string> {
  const result = await execute(
    `INSERT INTO orders (id, reference, tenant_id, customer_id, customer_name, customer_email, subtotal_minor, shipping_minor, tax_minor, total_minor, currency, status, tracking_number${o.placedAt ? ', placed_at' : ''})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${o.placedAt ? ', ?' : ''})`,
    [
      o.id, `pending-${o.id}`, o.tenantId, o.customerId, o.customerName, o.customerEmail,
      o.subtotalMinor, o.shippingMinor, o.taxMinor, o.totalMinor, o.currency, o.status, o.trackingNumber ?? null,
      ...(o.placedAt ? [o.placedAt] : []),
    ],
    db,
  )
  const reference = referenceFor(result.insertId)
  await execute('UPDATE orders SET reference = ? WHERE id = ?', [reference, o.id], db)
  for (const l of o.lines) {
    await execute(
      'INSERT INTO order_lines (order_id, product_id, name, quantity, unit_price_minor, currency, instructor_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [o.id, l.productId, l.name, l.quantity, l.unitPriceMinor, l.currency, l.instructorId ?? null],
      db,
    )
  }
  return reference
}

export async function setOrderStatus(id: string, status: OrderStatus, db: Db = pool) {
  const fulfilled = status === 'shipped' || status === 'delivered'
  await execute(
    `UPDATE orders SET status = ?, fulfilled_at = ${fulfilled ? 'COALESCE(fulfilled_at, NOW(3))' : 'fulfilled_at'} WHERE id = ?`,
    [status, id],
    db,
  )
}

// ---- Payments ---------------------------------------------------------------

interface PaymentRow extends RowDataPacket {
  id: string
  reference: string
  order_id: string | null
  customer_id: string
  customer_name: string
  description: string
  gross_minor: number
  fee_minor: number
  net_minor: number
  currency: Currency
  method: PaymentMethod
  card_last4: string | null
  card_brand: string | null
  status: PaymentStatus
  processed_at: Date
  payout_id: string | null
}

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  reference: r.reference,
  ...(r.order_id ? { orderId: r.order_id } : {}),
  customerId: r.customer_id,
  customerName: r.customer_name,
  description: r.description,
  gross: { amountMinor: r.gross_minor, currency: r.currency },
  fee: { amountMinor: r.fee_minor, currency: r.currency },
  net: { amountMinor: r.net_minor, currency: r.currency },
  method: r.method,
  ...(r.card_last4 ? { cardLast4: r.card_last4 } : {}),
  ...(r.card_brand ? { cardBrand: r.card_brand } : {}),
  status: r.status,
  processedAt: r.processed_at.toISOString(),
  ...(r.payout_id ? { payoutId: r.payout_id } : {}),
})

export async function listPayments(scope: Scope, db: Db = pool): Promise<Payment[]> {
  const where: Record<Role, [string, unknown[]]> = {
    member: ['customer_id = ?', [scope.userId]],
    coach: ['customer_id = ?', [scope.userId]],
    admin: ['tenant_id = ?', [scope.tenantId]],
    app_manager: ['1 = 1', []],
  }
  const [clause, params] = where[scope.role]
  const rows = await query<PaymentRow>(`SELECT * FROM payments WHERE ${clause} ORDER BY processed_at DESC`, params, db)
  return rows.map(toPayment)
}

export type NewPayment = {
  id: string
  tenantId: string
  reference: string
  orderId?: string | null
  customerId: string
  customerName: string
  description: string
  grossMinor: number
  feeMinor: number
  currency: string
  method: PaymentMethod
  cardLast4?: string | null
  cardBrand?: string | null
  status: PaymentStatus
  provider: string
  processedAt?: Date
  payoutId?: string | null
}

export async function insertPayment(p: NewPayment, db: Db = pool) {
  await execute(
    `INSERT INTO payments (id, tenant_id, reference, order_id, customer_id, customer_name, description, gross_minor, fee_minor, net_minor, currency, method, card_last4, card_brand, status, provider, payout_id${p.processedAt ? ', processed_at' : ''})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${p.processedAt ? ', ?' : ''})`,
    [
      p.id, p.tenantId, p.reference, p.orderId ?? null, p.customerId, p.customerName, p.description, p.grossMinor, p.feeMinor,
      p.grossMinor - p.feeMinor, p.currency, p.method, p.cardLast4 ?? null, p.cardBrand ?? null, p.status, p.provider, p.payoutId ?? null,
      ...(p.processedAt ? [p.processedAt] : []),
    ],
    db,
  )
}

export async function setPaymentStatusForOrder(orderId: string, status: PaymentStatus, db: Db = pool) {
  await execute('UPDATE payments SET status = ? WHERE order_id = ?', [status, orderId], db)
}

// ---- Subscriptions ----------------------------------------------------------

interface SubscriptionRow extends RowDataPacket {
  id: string
  tenant_id: string
  member_id: string
  member_name: string
  plan_name: string
  price_minor: number
  currency: Currency
  interval: 'month' | 'year'
  status: SubscriptionStatus
  started_at: Date
  renews_at: Date
}

const SUB_SELECT = `
  SELECT s.id, s.tenant_id, s.member_id, CONCAT(u.first_name, ' ', u.last_name) AS member_name, s.plan_name, s.price_minor, s.currency,
         s.\`interval\`, s.status, s.started_at, s.renews_at
  FROM subscriptions s JOIN users u ON u.id = s.member_id`

const toSubscription = (r: SubscriptionRow): Subscription => ({
  id: r.id,
  memberId: r.member_id,
  memberName: r.member_name,
  planName: r.plan_name,
  price: { amountMinor: r.price_minor, currency: r.currency },
  interval: r.interval,
  status: r.status,
  startedAt: r.started_at.toISOString(),
  renewsAt: toIsoDateTime(r.renews_at)!,
})

export async function listSubscriptions(scope: Scope, db: Db = pool): Promise<Subscription[]> {
  const where: Record<Role, [string, unknown[]]> = {
    member: ['s.member_id = ?', [scope.userId]],
    coach: ['s.member_id = ?', [scope.userId]],
    admin: ['s.tenant_id = ?', [scope.tenantId]],
    app_manager: ['1 = 1', []],
  }
  const [clause, params] = where[scope.role]
  const rows = await query<SubscriptionRow>(`${SUB_SELECT} WHERE ${clause} ORDER BY s.started_at DESC`, params, db)
  return rows.map(toSubscription)
}

export async function findSubscriptionRow(id: string, db: Db = pool) {
  return queryOne<SubscriptionRow>(`${SUB_SELECT} WHERE s.id = ?`, [id], db)
}

export async function findActiveSubscription(memberId: string, productId: string, db: Db = pool) {
  return queryOne<SubscriptionRow>(
    `${SUB_SELECT} WHERE s.member_id = ? AND s.product_id = ? AND s.status IN ('active','trialing','past_due') LIMIT 1`,
    [memberId, productId],
    db,
  )
}

export type NewSubscription = {
  id: string
  tenantId: string
  memberId: string
  productId?: string | null
  planName: string
  priceMinor: number
  currency: string
  interval: 'month' | 'year'
  status: SubscriptionStatus
  startedAt: Date
  renewsAt: Date
}

export async function insertSubscription(s: NewSubscription, db: Db = pool) {
  await execute(
    `INSERT INTO subscriptions (id, tenant_id, member_id, product_id, plan_name, price_minor, currency, \`interval\`, status, started_at, renews_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [s.id, s.tenantId, s.memberId, s.productId ?? null, s.planName, s.priceMinor, s.currency, s.interval, s.status, s.startedAt, s.renewsAt],
    db,
  )
}

export async function cancelSubscriptionRow(id: string, db: Db = pool) {
  await execute(`UPDATE subscriptions SET status = 'cancelled', cancelled_at = NOW(3) WHERE id = ?`, [id], db)
}

export { toSubscription }
