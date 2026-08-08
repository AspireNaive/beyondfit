import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Search, ShoppingBag, Star } from 'lucide-react'
import {
  CATEGORY_LABELS,
  ProductCategory,
  type Product,
} from '@/domain/commerce/model'
import { formatMoney } from '@/domain/shared/types'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { PageHeading } from '@/shared/ui/Card'
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { PageHero } from '@/features/marketing/PageHero'
import { CtaBand } from '@/features/marketing/components'
import { ProductArtwork } from './ProductArtwork'
import { useCartStore } from './cart-store'
import { useProducts } from './hooks'
import { cn } from '@/shared/lib/cn'

const CATEGORIES = [
  { id: 'all', label: 'Everything' },
  ...Object.values(ProductCategory).map((c) => ({ id: c, label: CATEGORY_LABELS[c] })),
] as const

function ProductCard({ product }: { product: Product }) {
  const add = useCartStore((s) => s.add)
  const discounted =
    product.compareAtPrice && product.compareAtPrice.amountMinor > product.price.amountMinor

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-850/70 transition-colors hover:border-ink-500">
      <Link to={`/shop/${product.slug}`} className="relative block aspect-[4/3] overflow-hidden">
        <ProductArtwork product={product} />

        <div className="absolute left-3 top-3 flex flex-wrap gap-2">
          {product.badge && <Badge tone="volt">{product.badge}</Badge>}
          {discounted && <Badge tone="ember">Sale</Badge>}
        </div>

        {!product.inStock && (
          <div className="absolute inset-0 grid place-items-center bg-ink-950/70 backdrop-blur-[2px]">
            <span className="rounded-full border border-ink-600 bg-ink-900 px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-dim">
              Out of stock
            </span>
          </div>
        )}
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
          {CATEGORY_LABELS[product.category]}
        </p>

        <h3 className="mt-1.5 text-lg leading-tight">
          <Link to={`/shop/${product.slug}`} className="hover:text-volt-400">
            {product.name}
          </Link>
        </h3>

        <p className="mt-1.5 flex-1 text-sm text-chalk-dim text-pretty">{product.tagline}</p>

        <div className="mt-3 flex items-center gap-1.5">
          <Star className="size-3.5 fill-volt-400 text-volt-400" />
          <span className="text-xs font-semibold tabular-nums text-chalk">{product.rating}</span>
          <span className="text-xs text-chalk-faint">({product.reviewCount})</span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 border-t border-ink-700 pt-4">
          <div>
            <p className="font-display text-2xl leading-none text-chalk">
              {formatMoney(product.price)}
            </p>
            {discounted && (
              <p className="mt-1 text-xs text-chalk-faint line-through">
                {formatMoney(product.compareAtPrice!)}
              </p>
            )}
          </div>

          <Button
            size="sm"
            disabled={!product.inStock}
            onClick={() => add(product)}
            aria-label={`Add ${product.name} to cart`}
          >
            Add
          </Button>
        </div>
      </div>
    </article>
  )
}

export default function ShopPage() {
  const location = useLocation()
  const inApp = location.pathname.startsWith('/app')

  const [category, setCategory] = useState<string>('all')
  const [query, setQuery] = useState('')

  const { data, isPending, isError, refetch } = useProducts(
    category === 'all' ? {} : { category: category as ProductCategory },
  )

  const products = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (p) => p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q),
    )
  }, [data, query])

  const controls = (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-chalk-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the shop"
          aria-label="Search products"
          className="h-11 w-full rounded-lg border border-ink-600 bg-ink-900/80 pl-10 pr-3.5 text-sm outline-none transition-colors placeholder:text-chalk-faint focus:border-volt-400 sm:w-80"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            aria-pressed={category === item.id}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
              category === item.id
                ? 'border-volt-400 bg-volt-400 text-ink-950'
                : 'border-ink-600 text-chalk-dim hover:border-ink-500 hover:text-chalk',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )

  const grid = isPending ? (
    <SkeletonList rows={3} />
  ) : isError ? (
    <ErrorState description="Couldn't load the catalogue." onRetry={() => void refetch()} />
  ) : products.length === 0 ? (
    <EmptyState
      icon={ShoppingBag}
      title="Nothing matches that"
      description="Try another category or clear the search."
    />
  ) : (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.id} product={product} />
      ))}
    </div>
  )

  if (inApp) {
    return (
      <>
        <PageHeading title="Shop" subtitle="Programmes, testing, supplements and kit." />
        <div className="mb-8">{controls}</div>
        {grid}
      </>
    )
  }

  return (
    <>
      <PageHero
        eyebrow="Shop"
        title="Everything we actually use"
        lead="Programmes written by our coaches, panels read by our physician, and the short list of supplements and kit that survive contact with real training."
      />

      <section className="section">
        <div className="shell">
          <div className="mb-8">{controls}</div>
          {grid}
        </div>
      </section>

      <CtaBand
        title="Not sure what you need?"
        lead="Fifteen minutes on the phone beats an hour of reading product pages. We will tell you what is worth buying and what is not."
        primary={{ label: 'Book my 15 min call', to: '/book' }}
        secondary={{ label: 'See the programmes', to: '/coaching' }}
      />
    </>
  )
}
