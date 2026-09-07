import { useEffect, useRef, useState } from 'react'
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

/** The slice of the lottie-web global (CDN script in index.html) we touch. */
type LottieAnimation = {
  addEventListener(name: 'DOMLoaded' | 'data_failed', cb: () => void): void
  destroy(): void
}
type LottiePlayer = {
  loadAnimation(options: {
    container: Element
    renderer: 'svg'
    loop: boolean
    autoplay: boolean
    path: string
  }): LottieAnimation
}
declare global {
  interface Window {
    lottie?: LottiePlayer
  }
}

/** Drop a different Lottie export here to change what every loading state plays. */
const LOADER_ANIMATION = '/media/loading.json'

/** Run `cb` once the CDN player is on `window`; returns a canceller. */
function whenLottieReady(cb: (lottie: LottiePlayer) => void): () => void {
  if (window.lottie) {
    cb(window.lottie)
    return () => {}
  }
  const script = document.querySelector<HTMLScriptElement>('script[src*="lottie"]')
  if (!script) return () => {}
  const onLoad = () => window.lottie && cb(window.lottie)
  script.addEventListener('load', onLoad)
  return () => script.removeEventListener('load', onLoad)
}

/**
 * Full-viewport route fallback shown while a lazy chunk streams in or the
 * session restores. Plays the Kedem loader through lottie-web. Until the
 * animation has painted — or if the CDN is blocked — the plain ring stands
 * in, so the page never shows an empty gap.
 */
export function RouteFallback() {
  const host = useRef<HTMLDivElement>(null)
  const [painted, setPainted] = useState(false)

  useEffect(() => {
    const el = host.current
    if (!el) return
    let animation: LottieAnimation | undefined
    const cancel = whenLottieReady((lottie) => {
      animation = lottie.loadAnimation({
        container: el,
        renderer: 'svg',
        loop: true,
        autoplay: !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
        path: LOADER_ANIMATION,
      })
      animation.addEventListener('DOMLoaded', () => setPainted(true))
    })
    return () => {
      cancel()
      animation?.destroy()
    }
  }, [])

  return (
    <div className="grid min-h-[60vh] place-items-center" role="status" aria-label="Loading page">
      <div className="relative grid size-44 place-items-center">
        <div ref={host} className="absolute inset-0" aria-hidden />
        {!painted && (
          <span className="size-8 animate-spin rounded-full border-2 border-ink-600 border-t-volt-400" />
        )}
      </div>
    </div>
  )
}
