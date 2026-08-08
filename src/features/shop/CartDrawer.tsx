import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Minus, Plus, ShoppingBag, Trash2, X } from 'lucide-react'
import {
  FREE_SHIPPING_THRESHOLD_MINOR,
  lineTotal,
} from '@/domain/commerce/model'
import { formatMoney, money } from '@/domain/shared/types'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { useCurrentUser } from '@/features/auth/store'
import { ProductArtwork } from './ProductArtwork'
import { useCartStore, useCartTotals } from './cart-store'

/**
 * Slide-over cart.
 *
 * Rendered by the layouts rather than at the app root, because it needs router
 * context for its links — the store keeps the contents alive across layout
 * switches, so mounting it twice costs nothing.
 */
export function CartDrawer() {
  const open = useCartStore((s) => s.open)
  const setOpen = useCartStore((s) => s.setOpen)
  const lines = useCartStore((s) => s.lines)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)
  const totals = useCartTotals()
  const user = useCurrentUser()
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, setOpen])

  if (!open) return null

  const remaining = FREE_SHIPPING_THRESHOLD_MINOR - totals.subtotal.amountMinor
  const allDigital = lines.length > 0 && lines.every((l) => l.product.digital)

  const onCheckout = () => {
    setOpen(false)
    // Checkout lives behind auth; send guests to sign in and come back.
    navigate(user ? '/app/checkout' : '/login', {
      state: user ? undefined : { from: '/app/checkout' },
    })
  }

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Shopping cart">
      <button
        type="button"
        aria-label="Close cart"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm"
      />

      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col border-l border-ink-700 bg-ink-900 shadow-2xl">
        <header className="flex items-center justify-between border-b border-ink-700 p-5">
          <h2 className="text-xl">
            Your cart
            {lines.length > 0 && (
              <span className="ml-2 text-sm font-normal text-chalk-faint">
                ({lines.reduce((n, l) => n + l.quantity, 0)})
              </span>
            )}
          </h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close cart"
            className="rounded-md p-1.5 text-chalk-faint transition-colors hover:bg-ink-800 hover:text-chalk"
          >
            <X className="size-5" />
          </button>
        </header>

        {lines.length === 0 ? (
          <div className="grid flex-1 place-items-center p-8 text-center">
            <div>
              <ShoppingBag className="mx-auto size-10 text-chalk-faint" />
              <p className="mt-4 text-lg text-chalk">Your cart is empty</p>
              <p className="mt-2 text-sm text-chalk-dim">
                Programmes, testing and kit are all in the shop.
              </p>
              <ButtonLink to="/shop" className="mt-6" onClick={() => setOpen(false)}>
                Browse the shop
              </ButtonLink>
            </div>
          </div>
        ) : (
          <>
            <ul className="flex-1 divide-y divide-ink-700 overflow-y-auto p-5">
              {lines.map((line) => (
                <li key={line.product.id} className="flex gap-4 py-4 first:pt-0">
                  <Link
                    to={`/shop/${line.product.slug}`}
                    onClick={() => setOpen(false)}
                    className="size-20 shrink-0 overflow-hidden rounded-lg border border-ink-700"
                  >
                    <ProductArtwork product={line.product} size="sm" />
                  </Link>

                  <div className="min-w-0 flex-1">
                    <Link
                      to={`/shop/${line.product.slug}`}
                      onClick={() => setOpen(false)}
                      className="line-clamp-2 text-sm font-medium text-chalk hover:text-volt-400"
                    >
                      {line.product.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-chalk-faint">
                      {formatMoney(line.product.price)} each
                    </p>

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-md border border-ink-600">
                        <button
                          type="button"
                          onClick={() => setQuantity(line.product.id, line.quantity - 1)}
                          aria-label={`Decrease quantity of ${line.product.name}`}
                          className="grid size-8 place-items-center text-chalk-dim hover:text-chalk"
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="w-7 text-center text-xs font-semibold tabular-nums">
                          {line.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => setQuantity(line.product.id, line.quantity + 1)}
                          aria-label={`Increase quantity of ${line.product.name}`}
                          className="grid size-8 place-items-center text-chalk-dim hover:text-chalk"
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>

                      <span className="text-sm font-semibold tabular-nums text-chalk">
                        {formatMoney(lineTotal(line))}
                      </span>

                      <button
                        type="button"
                        onClick={() => remove(line.product.id)}
                        aria-label={`Remove ${line.product.name}`}
                        className="rounded p-1 text-chalk-faint transition-colors hover:text-danger-500"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <footer className="border-t border-ink-700 p-5">
              {!allDigital && remaining > 0 && (
                <p className="mb-4 rounded-lg border border-ink-700 bg-ink-850 px-3 py-2 text-xs text-chalk-dim">
                  Spend {formatMoney(money(remaining))} more for free shipping.
                </p>
              )}

              <dl className="space-y-2 text-sm">
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
                  <dt className="text-chalk-dim">Estimated tax</dt>
                  <dd className="tabular-nums text-chalk">{formatMoney(totals.tax)}</dd>
                </div>
                <div className="flex justify-between border-t border-ink-700 pt-3 text-base">
                  <dt className="font-semibold text-chalk">Total</dt>
                  <dd className="font-display text-2xl leading-none text-chalk">
                    {formatMoney(totals.total)}
                  </dd>
                </div>
              </dl>

              <Button size="lg" className="mt-5 w-full" onClick={onCheckout}>
                {user ? 'Checkout' : 'Sign in to checkout'}
              </Button>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="mt-3 w-full text-center text-xs font-semibold uppercase tracking-wider text-chalk-faint hover:text-chalk"
              >
                Keep shopping
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  )
}
