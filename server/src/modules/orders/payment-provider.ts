import { config } from '../../config.js'
import type { PaymentMethod, PaymentStatus } from '../../domain.js'
import { randomToken } from '../../lib/ids.js'
import { feeFor } from '../../lib/money.js'

/**
 * The seam for a real gateway. `charge` is called inside the order
 * transaction; a Stripe/Razorpay implementation would create a PaymentIntent
 * here and the order would stay `awaiting_payment` until the webhook lands.
 */
export type ChargeInput = {
  amountMinor: number
  currency: string
  method: PaymentMethod
  customerId: string
  description: string
}

export type ChargeResult = {
  status: PaymentStatus
  reference: string
  feeMinor: number
  cardLast4?: string
  cardBrand?: string
}

export interface PaymentProvider {
  readonly name: string
  charge(input: ChargeInput): Promise<ChargeResult>
}

/** Records the payment as taken — for studios settling by card terminal, cash or bank transfer. */
const manualProvider: PaymentProvider = {
  name: 'manual',
  async charge(input) {
    return {
      status: 'succeeded',
      reference: `man_${randomToken(9)}`,
      feeMinor: input.method === 'bank_transfer' ? 0 : feeFor(input.amountMinor),
    }
  },
}

const providers: Record<typeof config.paymentProvider, PaymentProvider> = { manual: manualProvider }

export const paymentProvider = (): PaymentProvider => providers[config.paymentProvider]
