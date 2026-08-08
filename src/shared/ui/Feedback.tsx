import { cn } from '@/shared/lib/cn'

/** Shimmerless skeleton — a plain pulse is cheaper to composite and does not
 *  jank on low-end Android, which is most of the member traffic. */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-ink-700/70', className)} aria-hidden />
}

export function SkeletonList({ rows = 4, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="h-16 w-full" />
      ))}
    </div>
  )
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid place-items-center rounded-xl border border-dashed border-ink-600 bg-ink-900/40 px-6 py-14 text-center',
        className,
      )}
    >
      {Icon && (
        <span className="mb-4 grid size-12 place-items-center rounded-full bg-ink-800 text-chalk-faint">
          <Icon className="size-6" />
        </span>
      )}
      <h3 className="text-lg text-chalk">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-sm text-chalk-dim">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

export function ErrorState({
  title = 'Something went wrong',
  description,
  onRetry,
}: {
  title?: string
  description?: string
  onRetry?: () => void
}) {
  return (
    <div
      role="alert"
      className="rounded-xl border border-danger-500/35 bg-danger-500/10 px-5 py-6 text-center"
    >
      <h3 className="text-lg text-danger-500">{title}</h3>
      {description && <p className="mt-2 text-sm text-chalk-dim">{description}</p>}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 text-xs font-semibold uppercase tracking-wider text-volt-400 underline underline-offset-4"
        >
          Try again
        </button>
      )}
    </div>
  )
}

/** Full-viewport route fallback shown while a lazy chunk streams in. */
export function RouteFallback() {
  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-label="Loading page">
      <span className="size-8 animate-spin rounded-full border-2 border-ink-600 border-t-volt-400" />
    </div>
  )
}
