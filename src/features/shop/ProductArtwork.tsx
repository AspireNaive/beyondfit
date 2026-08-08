import { Dumbbell, FlaskConical, IdCard, Package, Pill, Shirt } from 'lucide-react'
import { ProductCategory, type Product } from '@/domain/commerce/model'
import { cn } from '@/shared/lib/cn'

type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties }>

const CATEGORY_ICONS: Record<ProductCategory, IconComponent> = {
  [ProductCategory.Program]: Dumbbell,
  [ProductCategory.Supplement]: Pill,
  [ProductCategory.Equipment]: Package,
  [ProductCategory.Apparel]: Shirt,
  [ProductCategory.Testing]: FlaskConical,
  [ProductCategory.Membership]: IdCard,
}

/**
 * Product visual.
 *
 * Renders the photo when there is one and a generated panel when there is not,
 * keyed off the product's own accent colour. That keeps the grid looking
 * deliberate before any photography exists — and costs zero network requests,
 * which matters on a catalogue page that may show fifty tiles.
 */
export function ProductArtwork({
  product,
  className,
  size = 'md',
}: {
  product: Product
  className?: string
  size?: 'sm' | 'md' | 'lg'
}) {
  const Icon = CATEGORY_ICONS[product.category]

  if (product.imageUrl) {
    return (
      <img
        src={product.imageUrl}
        alt=""
        loading="lazy"
        decoding="async"
        className={cn('size-full object-cover', className)}
      />
    )
  }

  const iconSize = size === 'lg' ? 'size-20' : size === 'sm' ? 'size-8' : 'size-12'

  return (
    <div
      aria-hidden
      className={cn('relative grid size-full place-items-center overflow-hidden', className)}
      style={{
        background: `radial-gradient(120% 100% at 25% 15%, ${product.accent}2e, transparent 60%), linear-gradient(150deg, #131c26, #0a1017)`,
      }}
    >
      {/* Faint diagonal rule pattern — texture without an image asset. */}
      <div
        className="absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `repeating-linear-gradient(135deg, ${product.accent} 0 1px, transparent 1px 14px)`,
        }}
      />
      <Icon className={cn(iconSize, 'relative')} style={{ color: product.accent, opacity: 0.85 }} />
    </div>
  )
}
