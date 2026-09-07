export type Currency = 'USD' | 'EUR' | 'GBP' | 'INR'
export type Money = { amountMinor: number; currency: Currency }

export const money = (amountMinor: number, currency: Currency = 'USD'): Money => ({
  amountMinor,
  currency,
})

/** Storefront rules — must stay identical to src/domain/commerce/model.ts. */
export const SHIPPING_FLAT_MINOR = 795
export const FREE_SHIPPING_THRESHOLD_MINOR = 12_500
export const TAX_RATE = 0.0825

/** Card-style processing fee used by the manual payment provider. */
export const feeFor = (grossMinor: number) => Math.round(grossMinor * 0.029) + 30
