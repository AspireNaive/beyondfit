import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  cartShipping,
  cartSubtotal,
  cartTax,
  cartTotal,
  type CartLine,
  type Product,
} from '@/domain/commerce/model'

type CartState = {
  lines: CartLine[]
  /** Slide-over visibility, kept here so any screen can open the cart. */
  open: boolean

  add: (product: Product, quantity?: number) => void
  remove: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
  setOpen: (open: boolean) => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      lines: [],
      open: false,

      add: (product, quantity = 1) =>
        set((state) => {
          const existing = state.lines.find((l) => l.product.id === product.id)
          const lines = existing
            ? state.lines.map((l) =>
                l.product.id === product.id ? { ...l, quantity: l.quantity + quantity } : l,
              )
            : [...state.lines, { product, quantity }]
          return { lines, open: true }
        }),

      remove: (productId) =>
        set((state) => ({ lines: state.lines.filter((l) => l.product.id !== productId) })),

      setQuantity: (productId, quantity) =>
        set((state) => ({
          lines:
            quantity <= 0
              ? state.lines.filter((l) => l.product.id !== productId)
              : state.lines.map((l) => (l.product.id === productId ? { ...l, quantity } : l)),
        })),

      clear: () => set({ lines: [], open: false }),
      setOpen: (open) => set({ open }),
    }),
    {
      name: 'beyondfit.cart',
      // Never persist UI state — a reload should not reopen the drawer.
      partialize: (state) => ({ lines: state.lines }) as CartState,
    },
  ),
)

export const useCartCount = () =>
  useCartStore((s) => s.lines.reduce((total, line) => total + line.quantity, 0))

export const useCartTotals = () => {
  const lines = useCartStore((s) => s.lines)
  return {
    subtotal: cartSubtotal(lines),
    shipping: cartShipping(lines),
    tax: cartTax(lines),
    total: cartTotal(lines),
  }
}
