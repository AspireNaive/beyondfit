import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2, CreditCard, Lock, ShoppingBag } from 'lucide-react'
import { PAYMENT_METHOD_LABELS, PaymentMethod, lineTotal } from '@/domain/commerce/model'
import { formatMoney } from '@/domain/shared/types'
import { fullName } from '@/domain/identity/model'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { PageHeading } from '@/shared/ui/Card'
import { EmptyState, ErrorState } from '@/shared/ui/Feedback'
import { useCurrentUser } from '@/features/auth/store'
import { usePlaceOrder } from '@/features/orders/hooks'
import { ProductArtwork } from './ProductArtwork'
import { useCartStore, useCartTotals } from './cart-store'
import { cn } from '@/shared/lib/cn'

export default function CheckoutPage() {
  const user = useCurrentUser()
  const navigate = useNavigate()
  const lines = useCartStore((s) => s.lines)
  const clear = useCartStore((s) => s.clear)
  const totals = useCartTotals()
  const placeOrder = usePlaceOrder(user)

  const [method, setMethod] = useState<PaymentMethod>(PaymentMethod.Card)
  const needsShipping = lines.some((line) => !line.product.digital)

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    placeOrder.mutate(
      { lines, method },
      {
        onSuccess: () => clear(),
      },
    )
  }

  // --- Success -------------------------------------------------------------
  if (placeOrder.isSuccess) {
    const order = placeOrder.data
    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-volt-400/15 text-volt-400">
          <CheckCircle2 className="size-7" />
        </span>
        <h1 className="mt-6 text-4xl">Order confirmed</h1>
        <p className="mt-3 text-sm text-chalk-dim">
          Reference <span className="font-semibold text-chalk">{order.reference}</span>. A receipt is
          on its way to {order.customerEmail}.
        </p>

        <dl className="mt-8 space-y-3 rounded-xl border border-ink-700 bg-ink-850/70 p-6 text-left text-sm">
          {order.lines.map((line) => (
            <div key={line.productId} className="flex justify-between gap-4">
              <dt className="text-chalk-dim">
                {line.name} × {line.quantity}
              </dt>
              <dd className="shrink-0 tabular-nums text-chalk">{formatMoney(line.unitPrice)}</dd>
            </div>
          ))}
          <div className="flex justify-between gap-4 border-t border-ink-700 pt-3">
            <dt className="font-semibold text-chalk">Total paid</dt>
            <dd className="font-display text-2xl leading-none text-chalk">
              {formatMoney(order.total)}
            </dd>
          </div>
        </dl>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/app/my-orders" size="lg">
            View my orders
          </ButtonLink>
          <ButtonLink to="/shop" size="lg" variant="outline">
            Keep shopping
          </ButtonLink>
        </div>
      </div>
    )
  }

  if (lines.length === 0) {
    return (
      <>
        <PageHeading title="Checkout" />
        <EmptyState
          icon={ShoppingBag}
          title="Your cart is empty"
          description="Add something from the shop and it will show up here."
          action={<ButtonLink to="/shop">Browse the shop</ButtonLink>}
        />
      </>
    )
  }

  return (
    <>
      <PageHeading
        title="Checkout"
        subtitle="Review your order and pay. Everything is billed in USD."
      />

      {placeOrder.isError && (
        <div className="mb-6">
          <ErrorState
            title="Payment could not be processed"
            description={(placeOrder.error as Error).message}
            onRetry={() => placeOrder.reset()}
          />
        </div>
      )}

      <form onSubmit={onSubmit} className="grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div className="space-y-6">
          <section className="rounded-xl border border-ink-700 bg-ink-850/70 p-6">
            <h2 className="text-xl">Contact</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input
                label="Full name"
                defaultValue={user ? fullName(user) : ''}
                autoComplete="name"
                required
              />
              <Input
                label="Email"
                type="email"
                defaultValue={user?.email ?? ''}
                autoComplete="email"
                required
              />
            </div>
          </section>

          {needsShipping && (
            <section className="rounded-xl border border-ink-700 bg-ink-850/70 p-6">
              <h2 className="text-xl">Shipping address</h2>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Input
                  label="Address"
                  autoComplete="address-line1"
                  required
                  className="sm:col-span-2"
                />
                <Input label="City" autoComplete="address-level2" required />
                <Input label="State" autoComplete="address-level1" required />
                <Input label="ZIP" autoComplete="postal-code" required />
                <Select label="Country" defaultValue="US" autoComplete="country" required>
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="GB">United Kingdom</option>
                  <option value="IE">Ireland</option>
                </Select>
              </div>
            </section>
          )}

          <section className="rounded-xl border border-ink-700 bg-ink-850/70 p-6">
            <h2 className="text-xl">Payment</h2>

            <div
              role="radiogroup"
              aria-label="Payment method"
              className="mt-5 grid gap-3 sm:grid-cols-2"
            >
              {Object.values(PaymentMethod).map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={method === option}
                  onClick={() => setMethod(option)}
                  className={cn(
                    'rounded-lg border p-4 text-left text-sm font-semibold transition-colors',
                    method === option
                      ? 'border-volt-400 bg-volt-400/10 text-chalk'
                      : 'border-ink-600 text-chalk-dim hover:border-ink-500',
                  )}
                >
                  {PAYMENT_METHOD_LABELS[option]}
                </button>
              ))}
            </div>

            {method === PaymentMethod.Card && (
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <Input
                  label="Card number"
                  inputMode="numeric"
                  autoComplete="cc-number"
                  placeholder="4242 4242 4242 4242"
                  required
                  className="sm:col-span-2"
                />
                <Input label="Expiry" placeholder="MM / YY" autoComplete="cc-exp" required />
                <Input label="CVC" inputMode="numeric" autoComplete="cc-csc" required />
              </div>
            )}

            {method === PaymentMethod.BankTransfer && (
              <p className="mt-5 rounded-lg border border-ink-700 bg-ink-900/60 p-4 text-sm text-chalk-dim">
                Transfer details are emailed once the order is placed. Digital products unlock when
                the transfer clears, usually within one working day.
              </p>
            )}

            <p className="mt-5 flex items-center gap-2 text-xs text-chalk-faint">
              <Lock className="size-3.5" />
              Card details are never stored on our servers. Processing is handled by our PCI-DSS
              compliant provider.
            </p>
          </section>
        </div>

        {/* Summary */}
        <aside className="rounded-xl border border-ink-700 bg-ink-850/80 p-6 lg:sticky lg:top-24">
          <h2 className="text-xl">Order summary</h2>

          <ul className="mt-5 divide-y divide-ink-700">
            {lines.map((line) => (
              <li key={line.product.id} className="flex gap-3 py-3 first:pt-0">
                <Link
                  to={`/shop/${line.product.slug}`}
                  className="size-14 shrink-0 overflow-hidden rounded-lg border border-ink-700"
                >
                  <ProductArtwork product={line.product} size="sm" />
                </Link>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-2 text-sm text-chalk">{line.product.name}</p>
                  <p className="text-xs text-chalk-faint">Qty {line.quantity}</p>
                </div>
                <span className="shrink-0 text-sm tabular-nums text-chalk">
                  {formatMoney(lineTotal(line))}
                </span>
              </li>
            ))}
          </ul>

          <dl className="mt-5 space-y-2 border-t border-ink-700 pt-5 text-sm">
            <div className="flex justify-between">
              <dt className="text-chalk-dim">Subtotal</dt>
              <dd className="tabular-nums text-chalk">{formatMoney(totals.subtotal)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-chalk-dim">Shipping</dt>
              <dd className="tabular-nums text-chalk">
                {totals.shipping.amountMinor === 0 ? 'Free' : formatMoney(totals.shipping)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-chalk-dim">Tax</dt>
              <dd className="tabular-nums text-chalk">{formatMoney(totals.tax)}</dd>
            </div>
            <div className="flex justify-between border-t border-ink-700 pt-3">
              <dt className="text-base font-semibold text-chalk">Total</dt>
              <dd className="font-display text-3xl leading-none text-chalk">
                {formatMoney(totals.total)}
              </dd>
            </div>
          </dl>

          <Button type="submit" size="lg" loading={placeOrder.isPending} className="mt-6 w-full">
            <CreditCard className="size-4" />
            Pay {formatMoney(totals.total)}
          </Button>

          <button
            type="button"
            onClick={() => navigate('/shop')}
            className="mt-3 w-full text-center text-xs font-semibold uppercase tracking-wider text-chalk-faint hover:text-chalk"
          >
            Keep shopping
          </button>
        </aside>
      </form>
    </>
  )
}
