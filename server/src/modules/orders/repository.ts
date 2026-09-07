import type { Timestamp } from 'firebase-admin/firestore'
import { col, db, docOf, runTransaction, Timestamp as Ts, type Tx } from '../../db/firestore.js'
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

type Currency = Order['total']['currency']

export type LineDoc = {
  productId: string
  name: string
  quantity: number
  unitPriceMinor: number
  currency: Currency
  instructorId: string | null
}

export type OrderDoc = {
  orderNo: number
  reference: string
  tenantId: string
  customerId: string
  customerName: string
  customerEmail: string
  lines: LineDoc[]
  /** Coaches whose products are in the order — array-contains query for their view. */
  instructorIds: string[]
  subtotalMinor: number
  shippingMinor: number
  taxMinor: number
  totalMinor: number
  currency: Currency
  status: OrderStatus
  placedAt: Timestamp
  fulfilledAt: Timestamp | null
  trackingNumber: string | null
  updatedAt: Timestamp
}
export type OrderRow = OrderDoc & { id: string }

const orders = () => db.collection(col.orders)
const payments = () => db.collection(col.payments)
const subscriptions = () => db.collection(col.subscriptions)
const counterRef = () => db.collection(col.counters).doc('orders')

const toLine = (l: LineDoc): OrderLine => ({
  productId: l.productId,
  name: l.name,
  quantity: l.quantity,
  unitPrice: { amountMinor: l.unitPriceMinor, currency: l.currency },
  ...(l.instructorId ? { instructorId: l.instructorId } : {}),
})

export const toOrder = (r: OrderRow): Order => ({
  id: r.id,
  reference: r.reference,
  customerId: r.customerId,
  customerName: r.customerName,
  customerEmail: r.customerEmail,
  lines: r.lines.map(toLine),
  subtotal: { amountMinor: r.subtotalMinor, currency: r.currency },
  shipping: { amountMinor: r.shippingMinor, currency: r.currency },
  tax: { amountMinor: r.taxMinor, currency: r.currency },
  total: { amountMinor: r.totalMinor, currency: r.currency },
  status: r.status,
  placedAt: r.placedAt.toDate().toISOString(),
  ...(r.fulfilledAt ? { fulfilledAt: r.fulfilledAt.toDate().toISOString() } : {}),
  ...(r.trackingNumber ? { trackingNumber: r.trackingNumber } : {}),
})

export type Scope = { role: Role; userId: string; tenantId: string }

export async function listOrders(scope: Scope): Promise<Order[]> {
  const base = orders()
  const q: Record<Role, FirebaseFirestore.Query> = {
    member: base.where('customerId', '==', scope.userId),
    coach: base.where('instructorIds', 'array-contains', scope.userId),
    admin: base.where('tenantId', '==', scope.tenantId),
    app_manager: base,
  }
  const snap = await q[scope.role].orderBy('placedAt', 'desc').get()
  return snap.docs.map((d) => toOrder(docOf<OrderDoc>(d)!))
}

export async function findOrderRow(id: string, tx?: Tx): Promise<OrderRow | null> {
  const ref = orders().doc(id)
  return docOf<OrderDoc>(tx ? await tx.get(ref) : await ref.get())
}

export async function findOrder(id: string): Promise<Order | null> {
  const row = await findOrderRow(id)
  return row ? toOrder(row) : null
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

/**
 * Allocates the next order number from a counter document and writes the
 * order. Inside a caller's transaction the counter read is the last read
 * before the caller's writes; standalone, it runs its own transaction.
 */
export async function insertOrder(o: NewOrder, tx?: Tx): Promise<string> {
  const run = async (t: Tx): Promise<string> => {
    const counter = await t.get(counterRef())
    const orderNo = ((counter.data() as { next?: number } | undefined)?.next ?? 1)
    const reference = referenceFor(orderNo)
    const placed = o.placedAt ? Ts.fromDate(o.placedAt) : Ts.now()
    const doc: OrderDoc = {
      orderNo,
      reference,
      tenantId: o.tenantId,
      customerId: o.customerId,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      lines: o.lines.map((l) => ({ ...l, currency: l.currency as Currency, instructorId: l.instructorId ?? null })),
      instructorIds: [...new Set(o.lines.map((l) => l.instructorId).filter((x): x is string => Boolean(x)))],
      subtotalMinor: o.subtotalMinor,
      shippingMinor: o.shippingMinor,
      taxMinor: o.taxMinor,
      totalMinor: o.totalMinor,
      currency: o.currency as Currency,
      status: o.status,
      placedAt: placed,
      fulfilledAt: null,
      trackingNumber: o.trackingNumber ?? null,
      updatedAt: Ts.now(),
    }
    t.set(counterRef(), { next: orderNo + 1 }, { merge: true })
    t.create(orders().doc(o.id), doc)
    return reference
  }
  return tx ? run(tx) : runTransaction(run)
}

export function setOrderStatus(id: string, status: OrderStatus, current: OrderRow, tx: Tx): void {
  const fulfilled = status === 'shipped' || status === 'delivered'
  tx.update(orders().doc(id), {
    status,
    updatedAt: Ts.now(),
    ...(fulfilled && !current.fulfilledAt ? { fulfilledAt: Ts.now() } : {}),
  })
}

// ---- Payments ---------------------------------------------------------------

export type PaymentDoc = {
  tenantId: string
  reference: string
  orderId: string | null
  customerId: string
  customerName: string
  description: string
  grossMinor: number
  feeMinor: number
  netMinor: number
  currency: Currency
  method: PaymentMethod
  cardLast4: string | null
  cardBrand: string | null
  status: PaymentStatus
  provider: string
  processedAt: Timestamp
  payoutId: string | null
}
type PaymentRow = PaymentDoc & { id: string }

const toPayment = (r: PaymentRow): Payment => ({
  id: r.id,
  reference: r.reference,
  ...(r.orderId ? { orderId: r.orderId } : {}),
  customerId: r.customerId,
  customerName: r.customerName,
  description: r.description,
  gross: { amountMinor: r.grossMinor, currency: r.currency },
  fee: { amountMinor: r.feeMinor, currency: r.currency },
  net: { amountMinor: r.netMinor, currency: r.currency },
  method: r.method,
  ...(r.cardLast4 ? { cardLast4: r.cardLast4 } : {}),
  ...(r.cardBrand ? { cardBrand: r.cardBrand } : {}),
  status: r.status,
  processedAt: r.processedAt.toDate().toISOString(),
  ...(r.payoutId ? { payoutId: r.payoutId } : {}),
})

export async function listPayments(scope: Scope): Promise<Payment[]> {
  const base = payments()
  const q: Record<Role, FirebaseFirestore.Query> = {
    member: base.where('customerId', '==', scope.userId),
    coach: base.where('customerId', '==', scope.userId),
    admin: base.where('tenantId', '==', scope.tenantId),
    app_manager: base,
  }
  const snap = await q[scope.role].orderBy('processedAt', 'desc').get()
  return snap.docs.map((d) => toPayment(docOf<PaymentDoc>(d)!))
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

export function paymentDoc(p: NewPayment): PaymentDoc {
  return {
    tenantId: p.tenantId,
    reference: p.reference,
    orderId: p.orderId ?? null,
    customerId: p.customerId,
    customerName: p.customerName,
    description: p.description,
    grossMinor: p.grossMinor,
    feeMinor: p.feeMinor,
    netMinor: p.grossMinor - p.feeMinor,
    currency: p.currency as Currency,
    method: p.method,
    cardLast4: p.cardLast4 ?? null,
    cardBrand: p.cardBrand ?? null,
    status: p.status,
    provider: p.provider,
    processedAt: p.processedAt ? Ts.fromDate(p.processedAt) : Ts.now(),
    payoutId: p.payoutId ?? null,
  }
}

export async function insertPayment(p: NewPayment, tx?: Tx): Promise<void> {
  const ref = payments().doc(p.id)
  if (tx) tx.create(ref, paymentDoc(p))
  else await ref.create(paymentDoc(p))
}

/** Reads the order's payments (a transaction read) so the caller can update them after its writes begin. */
export async function paymentRefsForOrder(orderId: string, tx: Tx): Promise<FirebaseFirestore.DocumentReference[]> {
  const snap = await tx.get(payments().where('orderId', '==', orderId))
  return snap.docs.map((d) => d.ref)
}

// ---- Subscriptions ----------------------------------------------------------

export type SubscriptionDoc = {
  tenantId: string
  memberId: string
  memberName: string
  productId: string | null
  planName: string
  priceMinor: number
  currency: Currency
  interval: 'month' | 'year'
  status: SubscriptionStatus
  startedAt: Timestamp
  renewsAt: Timestamp
  cancelledAt: Timestamp | null
  updatedAt: Timestamp
}
export type SubscriptionRow = SubscriptionDoc & { id: string }

export const toSubscription = (r: SubscriptionRow): Subscription => ({
  id: r.id,
  memberId: r.memberId,
  memberName: r.memberName,
  planName: r.planName,
  price: { amountMinor: r.priceMinor, currency: r.currency },
  interval: r.interval,
  status: r.status,
  startedAt: r.startedAt.toDate().toISOString(),
  renewsAt: r.renewsAt.toDate().toISOString(),
})

export async function listSubscriptions(scope: Scope): Promise<Subscription[]> {
  const base = subscriptions()
  const q: Record<Role, FirebaseFirestore.Query> = {
    member: base.where('memberId', '==', scope.userId),
    coach: base.where('memberId', '==', scope.userId),
    admin: base.where('tenantId', '==', scope.tenantId),
    app_manager: base,
  }
  const snap = await q[scope.role].get()
  return snap.docs
    .map((d) => docOf<SubscriptionDoc>(d)!)
    .sort((a, b) => b.startedAt.toMillis() - a.startedAt.toMillis())
    .map(toSubscription)
}

export async function findSubscriptionRow(id: string): Promise<SubscriptionRow | null> {
  return docOf<SubscriptionDoc>(await subscriptions().doc(id).get())
}

export async function findActiveSubscription(memberId: string, productId: string, tx?: Tx): Promise<SubscriptionRow | null> {
  const q = subscriptions()
    .where('memberId', '==', memberId)
    .where('productId', '==', productId)
    .where('status', 'in', ['active', 'trialing', 'past_due'])
    .limit(1)
  const snap = tx ? await tx.get(q) : await q.get()
  const doc = snap.docs[0]
  return doc ? docOf<SubscriptionDoc>(doc) : null
}

export type NewSubscription = {
  id: string
  tenantId: string
  memberId: string
  memberName: string
  productId?: string | null
  planName: string
  priceMinor: number
  currency: string
  interval: 'month' | 'year'
  status: SubscriptionStatus
  startedAt: Date
  renewsAt: Date
}

export async function insertSubscription(s: NewSubscription, tx?: Tx): Promise<void> {
  const doc: SubscriptionDoc = {
    tenantId: s.tenantId,
    memberId: s.memberId,
    memberName: s.memberName,
    productId: s.productId ?? null,
    planName: s.planName,
    priceMinor: s.priceMinor,
    currency: s.currency as Currency,
    interval: s.interval,
    status: s.status,
    startedAt: Ts.fromDate(s.startedAt),
    renewsAt: Ts.fromDate(s.renewsAt),
    cancelledAt: null,
    updatedAt: Ts.now(),
  }
  const ref = subscriptions().doc(s.id)
  if (tx) tx.create(ref, doc)
  else await ref.create(doc)
}

export async function cancelSubscriptionRow(id: string): Promise<void> {
  await subscriptions().doc(id).update({ status: 'cancelled', cancelledAt: Ts.now(), updatedAt: Ts.now() })
}
