import { cn } from '@/shared/lib/cn'

export type TabItem<T extends string> = { id: T; label: string; count?: number }

/**
 * Controlled tab strip with roving arrow-key navigation, per the WAI-ARIA
 * tabs pattern. Scrolls horizontally rather than wrapping on narrow screens.
 */
export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: readonly TabItem<T>[]
  value: T
  onChange: (id: T) => void
  className?: string
}) {
  function onKeyDown(e: React.KeyboardEvent) {
    const delta = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    e.preventDefault()
    const index = items.findIndex((i) => i.id === value)
    const next = items[(index + delta + items.length) % items.length]
    if (next) onChange(next.id)
  }

  return (
    <div
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn(
        'flex gap-1 overflow-x-auto rounded-lg border border-ink-700 bg-ink-900/60 p-1',
        '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
        className,
      )}
    >
      {items.map((item) => {
        const active = item.id === value
        return (
          <button
            key={item.id}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors',
              active ? 'bg-volt-400 text-ink-950' : 'text-chalk-dim hover:bg-ink-800 hover:text-chalk',
            )}
          >
            {item.label}
            {item.count !== undefined && (
              <span
                className={cn(
                  'rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                  active ? 'bg-ink-950/20 text-ink-950' : 'bg-ink-700 text-chalk-dim',
                )}
              >
                {item.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
