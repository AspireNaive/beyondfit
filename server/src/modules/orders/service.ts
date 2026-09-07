import { addMonths, addYears } from 'date-fns'
import { runTransaction } from '../../db/firestore.js'
import { Permission, Role, can, type Order, type OrderStatus, type PaymentMethod, type Subscription, type UserProfile } from '../../domain.js'
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../../lib/errors.js'
import { newId } from '../../lib/ids.js'
import { FREE_SHIPPING_THRESHOLD_MINOR, SHIPPING_FLAT_MINOR, TAX_RATE } from '../../lib/money.js'
import { findProductRowsByIds, toProduct } from '../catalog/repository.js'
import { fullName } from '../users/repository.js'
import { paymentProvider } from './payment-provider.js'
import {
  cancelSubscriptionRow,
  findActiveSubscription,
  findOrder,
  findOrderRow,
  findSubscriptionRow,
  insertOrder,
  insertPayment,
  insertSubscription,
  listOrders as listOrderRows,
  paymentRefsForOrder,
  setOrderStatus,
  toSubscription,
} from './repository.js'

export type LineInput = { productId: string; quantity: number }

const scopeOf = (u: UserProfile) => ({ role: u.role, userId: u.id, tenantId: u.tenantId })

export const listOrders = (viewer: UserProfile) => listOrderRows(scopeOf(viewer))

export async function getOrder(viewer: UserProfile, orderId: string): Promise<Order | null> {
  const row = await findOrderRow(orderId)
  if (!row) return null
  const visible =
    viewer.role === Role.AppManager ||
    (viewer.role === Role.Admin && row.tenantId === viewer.tenantId) ||
    row.customerId === viewer.id ||
    (viewer.role === Role.Coach && row.instructorIds.includes(viewer.id))
  return visible ? (await findOrder(orderId)) : null
}

/** Storefront totals — the same rules the cart shows, recomputed server-side. */
export function totalsFor(lines: readonly { unitPriceMinor: number; quantity: number; digital: boolean }[]) {
  const subtotalMinor = lines.reduce((sum, l) => sum + l.unitPriceMinor * l.quantity, 0)
  const allDigital = lines.every((l) => l.digital)
  const shippingMinor = allDigital || subtotalMinor >= FREE_SHIPPING_THRESHOLD_MINOR ? 0 : SHIPPING_FLAT_MINOR
  const taxMinor = Math.round(subtotalMinor * TAX_RATE)
  return { subtotalMinor, shippingMinor, taxMinor, totalMinor: subtotalMinor + shippingMinor + taxMinor }
}

/**
 * Places and pays for an order in one transaction. Membership products also
 * start a subscription, so "member subscription" is just checkout.
 */
export async function placeOrder(
  customer: UserProfile,
  lines: readonly LineInput[],
  method: PaymentMethod = 'card',
  now = new Date(),
): Promise<Order> {
  if (lines.length === 0) throw badRequest('Your cart is empty.')

  const merged = new Map<string, number>()
  for (const l of lines) merged.set(l.productId, (merged.get(l.productId) ?? 0) + l.quantity)
  const orderId = newId()

  await runTransaction(async (tx) => {
    // ---- reads ------------------------------------------------------------
    const products = (await findProductRowsByIds([...merged.keys()], tx)).map(toProduct)
    const missing = [...merged.keys()].filter((id) => !products.some((p) => p.id === id))
    if (missing.length) throw unprocessable('One of the items is no longer available.', { lines: ['Unknown product.'] })
    const outOfStock = products.filter((p) => !p.inStock)
    if (outOfStock.length) throw conflict(`${outOfStock[0]!.name} is out of stock.`, 'out_of_stock')
    const currency = products[0]!.price.currency
    if (products.some((p) => p.price.currency !== currency)) throw unprocessable('Items must share one currency.')

    const orderLines = products.map((p) => ({
      productId: p.id,
      name: p.name,
      quantity: merged.get(p.id)!,
      unitPriceMinor: p.price.amountMinor,
      currency,
      instructorId: p.instructorId ?? null,
      digital: p.digital,
      category: p.category,
    }))
    const memberships = orderLines.filter((l) => l.category === 'membership')
    const alreadySubscribed = new Set<string>()
    for (const line of memberships) {
      if (await findActiveSubscription(customer.id, line.productId, tx)) alreadySubscribed.add(line.productId)
    }
    const totals = totalsFor(orderLines)

    // ---- writes -----------------------------------------------------------
    await insertOrder(
      {
        id: orderId,
        tenantId: customer.tenantId,
        customerId: customer.id,
        customerName: fullName(customer),
        customerEmail: customer.email,
        ...totals,
        currency,
        status: 'awaiting_payment',
        lines: orderLines,
      },
      tx,
    )

    const charge = await paymentProvider().charge({
      amountMinor: totals.totalMinor,
      currency,
      method,
      customerId: customer.id,
      description: orderLines[0]!.name,
    })
    await insertPayment(
      {
        id: newId(),
        tenantId: customer.tenantId,
        reference: charge.reference,
        orderId,
        customerId: customer.id,
        customerName: fullName(customer),
        description: orderLines.length > 1 ? `${orderLines[0]!.name} +${orderLines.length - 1}` : orderLines[0]!.name,
        grossMinor: totals.totalMinor,
        feeMinor: charge.feeMinor,
        currency,
        method,
        cardLast4: charge.cardLast4 ?? null,
        cardBrand: charge.cardBrand ?? null,
        status: charge.status,
        provider: paymentProvider().name,
      },
      tx,
    )
    if (charge.status === 'failed') throw conflict('Payment was declined.', 'payment_failed')
    if (charge.status !== 'succeeded') return

    const { db, col, Timestamp } = await import('../../db/firestore.js')
    tx.update(db.collection(col.orders).doc(orderId), { status: 'paid', updatedAt: Timestamp.now() })

    for (const line of memberships) {
      if (alreadySubscribed.has(line.productId)) continue
      await insertSubscription(
        {
          id: newId(),
          tenantId: customer.tenantId,
          memberId: customer.id,
          memberName: fullName(customer),
          productId: line.productId,
          planName: line.name,
          priceMinor: line.unitPriceMinor,
          currency,
          interval: 'month',
          status: 'active',
          startedAt: now,
          renewsAt: addMonths(now, 1),
        },
        tx,
      )
    }
  })

  const order = await findOrder(orderId)
  if (!order) throw notFound()
  return order
}

/** Staff move an order along; a coach only for orders carrying their own products. */
export async function updateStatus(viewer: UserProfile, orderId: string, status: OrderStatus): Promise<Order> {
  if (!can(viewer.role, Permission.ViewOrders)) throw forbidden()
  const row = await findOrderRow(orderId)
  if (!row) throw notFound('Order not found.')
  const allowed =
    viewer.role === Role.AppManager ||
    (viewer.role === Role.Admin && row.tenantId === viewer.tenantId) ||
    (viewer.role === Role.Coach && row.instructorIds.includes(viewer.id))
  if (!allowed) throw forbidden()
  if (row.status === status) return (await findOrder(orderId))!

  await runTransaction(async (tx) => {
    const current = await findOrderRow(orderId, tx)
    if (!current) throw notFound('Order not found.')
    const paymentRefs = status === 'refunded' ? await paymentRefsForOrder(orderId, tx) : []
    setOrderStatus(orderId, status, current, tx)
    for (const ref of paymentRefs) tx.update(ref, { status: 'refunded' })
  })
  return (await findOrder(orderId))!
}

// ---- Subscriptions ----------------------------------------------------------

export async function subscribe(member: UserProfile, productId: string, method: PaymentMethod): Promise<Subscription> {
  const [product] = (await findProductRowsByIds([productId])).map(toProduct)
  if (!product || product.category !== 'membership') throw unprocessable('That product is not a membership.')
  if (await findActiveSubscription(member.id, productId)) throw conflict('You already have this membership.', 'already_subscribed')
  await placeOrder(member, [{ productId, quantity: 1 }], method)
  const row = await findActiveSubscription(member.id, productId)
  if (!row) throw notFound()
  return toSubscription(row)
}

export async function cancelSubscription(viewer: UserProfile, subscriptionId: string): Promise<Subscription> {
  const row = await findSubscriptionRow(subscriptionId)
  if (!row) throw notFound('Subscription not found.')
  const allowed =
    row.memberId === viewer.id ||
    viewer.role === Role.AppManager ||
    (viewer.role === Role.Admin && row.tenantId === viewer.tenantId)
  if (!allowed) throw forbidden()
  if (row.status !== 'cancelled') await cancelSubscriptionRow(row.id)
  return toSubscription((await findSubscriptionRow(row.id))!)
}

export const renewalFor = (from: Date, interval: 'month' | 'year') =>
  interval === 'year' ? addYears(from, 1) : addMonths(from, 1)
