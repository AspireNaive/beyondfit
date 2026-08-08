import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Minus, Plus, Star, Truck } from 'lucide-react'
import { CATEGORY_LABELS } from '@/domain/commerce/model'
import { formatMoney } from '@/domain/shared/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { ErrorState, Skeleton } from '@/shared/ui/Feedback'
import { Stars } from '@/features/marketing/components'
import { ProductArtwork } from './ProductArtwork'
import { useCartStore } from './cart-store'
import { useProduct, useProducts } from './hooks'

export default function ProductPage() {
  const { slug } = useParams()
  const [quantity, setQuantity] = useState(1)
  const add = useCartStore((s) => s.add)

  const { data: product, isPending, isError } = useProduct(slug)
  const { data: related } = useProducts({})

  if (isPending) {
    return (
      <div className="shell py-32">
        <div className="grid gap-10 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-4">
            <Skeleton className="h-10 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-40" />
          </div>
        </div>
      </div>
    )
  }

  if (isError || !product) {
    return (
      <div className="shell py-32">
        <ErrorState
          title="Product not found"
          description="It may have been discontinued. Everything still available is in the shop."
        />
        <div className="mt-6 text-center">
          <Link to="/shop" className="text-sm text-volt-400 underline underline-offset-4">
            Back to the shop
          </Link>
        </div>
      </div>
    )
  }

  const discounted =
    product.compareAtPrice && product.compareAtPrice.amountMinor > product.price.amountMinor
  const savings = discounted
    ? Math.round(
        ((product.compareAtPrice!.amountMinor - product.price.amountMinor) /
          product.compareAtPrice!.amountMinor) *
          100,
      )
    : 0

  const suggestions = (related ?? [])
    .filter((p) => p.id !== product.id && p.category === product.category)
    .slice(0, 4)

  return (
    <div className="shell pb-20 pt-28 lg:pt-32">
      <Link
        to="/shop"
        className="mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-chalk-faint transition-colors hover:text-chalk"
      >
        <ArrowLeft className="size-4" />
        All products
      </Link>

      <div className="grid gap-10 lg:grid-cols-2 lg:gap-14">
        <div className="overflow-hidden rounded-2xl border border-ink-700">
          <div className="aspect-square">
            <ProductArtwork product={product} size="lg" />
          </div>
        </div>

        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge>{CATEGORY_LABELS[product.category]}</Badge>
            {product.badge && <Badge tone="volt">{product.badge}</Badge>}
            {discounted && <Badge tone="ember">Save {savings}%</Badge>}
          </div>

          <h1 className="mt-4 text-4xl sm:text-5xl text-balance">{product.name}</h1>
          <p className="mt-3 text-lg text-chalk-dim text-pretty">{product.tagline}</p>

          <div className="mt-5 flex items-center gap-3">
            <Stars rating={product.rating} />
            <span className="text-sm text-chalk-dim">
              <span className="font-semibold tabular-nums text-chalk">{product.rating}</span> ·{' '}
              {product.reviewCount} reviews
            </span>
          </div>

          <div className="mt-7 flex items-baseline gap-3">
            <span className="font-display text-5xl leading-none text-chalk">
              {formatMoney(product.price)}
            </span>
            {discounted && (
              <span className="text-lg text-chalk-faint line-through">
                {formatMoney(product.compareAtPrice!)}
              </span>
            )}
          </div>

          <p className="mt-6 text-sm leading-relaxed text-chalk-dim text-pretty">
            {product.description}
          </p>

          {/* Quantity + add */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-lg border border-ink-600">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                aria-label="Decrease quantity"
                className="grid size-11 place-items-center text-chalk-dim transition-colors hover:text-chalk disabled:opacity-30"
              >
                <Minus className="size-4" />
              </button>
              <span
                aria-live="polite"
                className="w-10 text-center text-sm font-semibold tabular-nums"
              >
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(10, q + 1))}
                disabled={quantity >= 10}
                aria-label="Increase quantity"
                className="grid size-11 place-items-center text-chalk-dim transition-colors hover:text-chalk disabled:opacity-30"
              >
                <Plus className="size-4" />
              </button>
            </div>

            <Button
              size="lg"
              disabled={!product.inStock}
              onClick={() => add(product, quantity)}
              className="flex-1 sm:flex-none"
            >
              {product.inStock ? 'Add to cart' : 'Out of stock'}
            </Button>
          </div>

          <ul className="mt-8 space-y-2.5 border-t border-ink-700 pt-6">
            {[
              product.digital
                ? 'Instant access — no shipping'
                : 'Free shipping over $125, flat $7.95 below',
              '30-day returns, no questions',
              product.instructorId ? 'Written by a BeyondFit coach' : 'Third-party tested',
            ].map((item) => (
              <li key={item} className="flex items-center gap-2.5 text-sm text-chalk-dim">
                {product.digital ? (
                  <Check className="size-4 shrink-0 text-volt-400" />
                ) : (
                  <Truck className="size-4 shrink-0 text-volt-400" />
                )}
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {suggestions.length > 0 && (
        <section className="mt-20 border-t border-ink-700 pt-12">
          <h2 className="text-3xl">Goes well with</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {suggestions.map((item) => (
              <Link
                key={item.id}
                to={`/shop/${item.slug}`}
                className="group overflow-hidden rounded-xl border border-ink-700 bg-ink-850/70 transition-colors hover:border-ink-500"
              >
                <div className="aspect-[4/3]">
                  <ProductArtwork product={item} size="sm" />
                </div>
                <div className="p-4">
                  <h3 className="truncate text-base leading-tight group-hover:text-volt-400">
                    {item.name}
                  </h3>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="font-display text-lg text-chalk">
                      {formatMoney(item.price)}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-chalk-faint">
                      <Star className="size-3 fill-volt-400 text-volt-400" />
                      {item.rating}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
