import { ShoppingCart } from 'lucide-react'
import { useCartCount, useCartStore } from './cart-store'

export function CartButton() {
  const count = useCartCount()
  const setOpen = useCartStore((s) => s.setOpen)

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={count > 0 ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart, empty'}
      className="relative rounded-md p-2 text-chalk-dim transition-colors hover:bg-ink-800 hover:text-chalk"
    >
      <ShoppingCart className="size-5" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid min-w-4.5 place-items-center rounded-full bg-volt-400 px-1 text-[10px] font-bold tabular-nums text-ink-950">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}
