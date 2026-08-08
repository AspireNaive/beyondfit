import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

/**
 * Dialog built on <dialog> so focus trapping, Esc and inertness come from the
 * platform instead of a bespoke (and usually leaky) JS implementation.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  // Lock background scroll only while the dialog is up.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  const widths = { sm: 'max-w-md', md: 'max-w-xl', lg: 'max-w-3xl' }

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      // Clicking the backdrop closes; clicks inside the panel stop here.
      onClick={(e) => {
        if (e.target === ref.current) onClose()
      }}
      aria-labelledby="bf-modal-title"
      className={cn(
        'w-[calc(100%-2rem)] rounded-xl border border-ink-700 bg-ink-850 p-0 text-chalk shadow-2xl',
        'backdrop:bg-ink-950/80 backdrop:backdrop-blur-sm',
        'open:animate-[bf-rise_.22s_var(--ease-out-expo)]',
        widths[size],
      )}
    >
      <div className="flex items-start justify-between gap-4 border-b border-ink-700 p-5">
        <div className="min-w-0">
          <h2 id="bf-modal-title" className="text-xl">
            {title}
          </h2>
          {description && <p className="mt-1 text-sm text-chalk-dim">{description}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="-m-1 rounded-md p-1 text-chalk-faint transition-colors hover:bg-ink-700 hover:text-chalk"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="max-h-[70vh] overflow-y-auto p-5">{children}</div>

      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-3 border-t border-ink-700 p-5">
          {footer}
        </div>
      )}
    </dialog>
  )
}
