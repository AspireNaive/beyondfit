import {
  addMoney,
  multiplyMoney,
  zeroMoney,
  type IsoDateTime,
  type Money,
  type OrderId,
  type PaymentId,
  type ProductId,
  type UserId,
} from '@/domain/shared/types'

/**
 * Commerce context — the storefront members buy from, the orders coaches
 * fulfil, and the payments admins reconcile. One catalogue, three lenses.
 */

export const ProductCategory = {
  Program: 'program',
  Supplement: 'supplement',
  Equipment: 'equipment',
  Apparel: 'apparel',
  Testing: 'testing',
  Membership: 'membership',
} as const

export type ProductCategory = (typeof ProductCategory)[keyof typeof ProductCategory]

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  [ProductCategory.Program]: 'Programs',
  [ProductCategory.Supplement]: 'Supplements',
  [ProductCategory.Equipment]: 'Equipment',
  [ProductCategory.Apparel]: 'Apparel',
  [ProductCategory.Testing]: 'Lab Testing',
  [ProductCategory.Membership]: 'Memberships',
}

export type Product = {
  readonly id: ProductId
  readonly slug: string
  readonly name: string
  readonly tagline: string
  readonly description: string
  readonly category: ProductCategory
  readonly price: Money
  readonly compareAtPrice?: Money
  readonly imageUrl?: string
  /** Accent used for the generated artwork when there is no photo yet. */
  readonly accent: string
  readonly rating: number
  readonly reviewCount: number
  readonly inStock: boolean
  readonly badge?: string
  /** Digital goods (programs, memberships) skip fulfilment entirely. */
  readonly digital: boolean
  /** Coach who authored the program — drives the instructor orders view. */
  readonly instructorId?: UserId
}

export type CartLine = {
  readonly product: Product
  readonly quantity: number
}

export const lineTotal = (line: CartLine): Money => multiplyMoney(line.product.price, line.quantity)

export const cartSubtotal = (lines: readonly CartLine[]): Money =>
  lines.reduce(
    (total, line) => addMoney(total, lineTotal(line)),
    zeroMoney(lines[0]?.product.price.currency ?? 'USD'),
  )

/** Flat rate, waived for digital-only carts and above the free-shipping bar. */
export const SHIPPING_FLAT_MINOR = 795
export const FREE_SHIPPING_THRESHOLD_MINOR = 12_500
export const TAX_RATE = 0.0825

export const cartShipping = (lines: readonly CartLine[]): Money => {
  const currency = lines[0]?.product.price.currency ?? 'USD'
  if (lines.length === 0) return zeroMoney(currency)
  if (lines.every((line) => line.product.digital)) return zeroMoney(currency)
  if (cartSubtotal(lines).amountMinor >= FREE_SHIPPING_THRESHOLD_MINOR) return zeroMoney(currency)
  return { amountMinor: SHIPPING_FLAT_MINOR, currency }
}

export const cartTax = (lines: readonly CartLine[]): Money =>
  multiplyMoney(cartSubtotal(lines), TAX_RATE)

export const cartTotal = (lines: readonly CartLine[]): Money =>
  addMoney(addMoney(cartSubtotal(lines), cartShipping(lines)), cartTax(lines))

export const OrderStatus = {
  AwaitingPayment: 'awaiting_payment',
  Paid: 'paid',
  Processing: 'processing',
  Shipped: 'shipped',
  Delivered: 'delivered',
  Refunded: 'refunded',
  Cancelled: 'cancelled',
} as const

export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus]

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.AwaitingPayment]: 'Awaiting payment',
  [OrderStatus.Paid]: 'Paid',
  [OrderStatus.Processing]: 'Processing',
  [OrderStatus.Shipped]: 'Shipped',
  [OrderStatus.Delivered]: 'Delivered',
  [OrderStatus.Refunded]: 'Refunded',
  [OrderStatus.Cancelled]: 'Cancelled',
}

export const ORDER_STATUS_TONE = {
  [OrderStatus.AwaitingPayment]: 'warn',
  [OrderStatus.Paid]: 'ok',
  [OrderStatus.Processing]: 'info',
  [OrderStatus.Shipped]: 'info',
  [OrderStatus.Delivered]: 'ok',
  [OrderStatus.Refunded]: 'neutral',
  [OrderStatus.Cancelled]: 'danger',
} as const

export type OrderLine = {
  readonly productId: ProductId
  readonly name: string
  readonly quantity: number
  readonly unitPrice: Money
  readonly instructorId?: UserId
}

export type Order = {
  readonly id: OrderId
  readonly reference: string
  readonly customerId: UserId
  readonly customerName: string
  readonly customerEmail: string
  readonly lines: readonly OrderLine[]
  readonly subtotal: Money
  readonly shipping: Money
  readonly tax: Money
  readonly total: Money
  readonly status: OrderStatus
  readonly placedAt: IsoDateTime
  readonly fulfilledAt?: IsoDateTime
  readonly trackingNumber?: string
}

export const PaymentMethod = {
  Card: 'card',
  ApplePay: 'apple_pay',
  GooglePay: 'google_pay',
  BankTransfer: 'bank_transfer',
} as const

export type PaymentMethod = (typeof PaymentMethod)[keyof typeof PaymentMethod]

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PaymentMethod.Card]: 'Card',
  [PaymentMethod.ApplePay]: 'Apple Pay',
  [PaymentMethod.GooglePay]: 'Google Pay',
  [PaymentMethod.BankTransfer]: 'Bank transfer',
}

export const PaymentStatus = {
  Succeeded: 'succeeded',
  Pending: 'pending',
  Failed: 'failed',
  Refunded: 'refunded',
  Disputed: 'disputed',
} as const

export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus]

export const PAYMENT_STATUS_TONE = {
  [PaymentStatus.Succeeded]: 'ok',
  [PaymentStatus.Pending]: 'warn',
  [PaymentStatus.Failed]: 'danger',
  [PaymentStatus.Refunded]: 'neutral',
  [PaymentStatus.Disputed]: 'ember',
} as const

export type Payment = {
  readonly id: PaymentId
  readonly reference: string
  readonly orderId?: OrderId
  readonly customerId: UserId
  readonly customerName: string
  readonly description: string
  readonly gross: Money
  readonly fee: Money
  readonly net: Money
  readonly method: PaymentMethod
  readonly cardLast4?: string
  readonly cardBrand?: string
  readonly status: PaymentStatus
  readonly processedAt: IsoDateTime
  readonly payoutId?: string
}

/** Recurring membership a member is subscribed to. */
export type Subscription = {
  readonly memberId: UserId
  readonly memberName: string
  readonly planName: string
  readonly price: Money
  readonly interval: 'month' | 'year'
  readonly status: 'active' | 'past_due' | 'cancelled' | 'trialing'
  readonly startedAt: IsoDateTime
  readonly renewsAt: IsoDateTime
}
