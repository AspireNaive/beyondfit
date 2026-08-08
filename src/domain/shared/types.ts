/**
 * Shared building blocks for every bounded context.
 *
 * Note: the project builds with `erasableSyntaxOnly`, so there are no TS
 * `enum`s anywhere in the domain — closed sets are a frozen const object plus
 * a derived union type. That erases to a plain object at runtime and keeps the
 * values usable as data (dropdown options, API payloads) instead of a type-only
 * construct the .NET client would have to mirror by hand.
 */

/** Branded id: stops a CoachId being passed where a MemberId is required. */
export type Id<Brand extends string> = string & { readonly __brand: Brand }

export const id = <B extends string>(value: string) => value as Id<B>

export type TenantId = Id<'Tenant'>
export type UserId = Id<'User'>
export type AppointmentId = Id<'Appointment'>
export type OrderId = Id<'Order'>
export type PaymentId = Id<'Payment'>
export type ProductId = Id<'Product'>
export type MetricEntryId = Id<'MetricEntry'>

/** ISO-8601 instant, always UTC. Formatting to local time is a UI concern. */
export type IsoDateTime = string
/** Calendar date, `YYYY-MM-DD`, with no timezone attached. */
export type IsoDate = string

/** Minor units + currency. Never store money as a float. */
export type Money = {
  readonly amountMinor: number
  readonly currency: 'USD' | 'EUR' | 'GBP' | 'INR'
}

export const money = (amountMinor: number, currency: Money['currency'] = 'USD'): Money => ({
  amountMinor,
  currency,
})

const currencyLocale: Record<Money['currency'], string> = {
  USD: 'en-US',
  EUR: 'de-DE',
  GBP: 'en-GB',
  INR: 'en-IN',
}

/** Cache formatters: constructing Intl.NumberFormat per row is a real cost on
 *  tables of a few hundred orders. */
const formatterCache = new Map<string, Intl.NumberFormat>()

export function formatMoney(value: Money, opts?: { compact?: boolean }): string {
  const key = `${value.currency}:${opts?.compact ? 'c' : 'f'}`
  let formatter = formatterCache.get(key)
  if (!formatter) {
    formatter = new Intl.NumberFormat(currencyLocale[value.currency], {
      style: 'currency',
      currency: value.currency,
      notation: opts?.compact ? 'compact' : 'standard',
      maximumFractionDigits: opts?.compact ? 1 : 2,
    })
    formatterCache.set(key, formatter)
  }
  return formatter.format(value.amountMinor / 100)
}

export const addMoney = (a: Money, b: Money): Money => {
  if (a.currency !== b.currency) {
    throw new Error(`Cannot add ${a.currency} to ${b.currency}`)
  }
  return money(a.amountMinor + b.amountMinor, a.currency)
}

export const multiplyMoney = (value: Money, factor: number): Money =>
  money(Math.round(value.amountMinor * factor), value.currency)

export const zeroMoney = (currency: Money['currency'] = 'USD'): Money => money(0, currency)

/** Paged envelope mirroring what the .NET API returns for list endpoints. */
export type Page<T> = {
  readonly items: readonly T[]
  readonly total: number
  readonly page: number
  readonly pageSize: number
}

export type SortDirection = 'asc' | 'desc'
