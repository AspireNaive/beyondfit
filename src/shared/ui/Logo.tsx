import { cn } from '@/shared/lib/cn'

/**
 * Wordmark. The chevron is drawn rather than imported so it inherits
 * currentColor and never ships a second network request.
 */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 32 32"
        className="size-8 shrink-0"
        aria-hidden
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="1" y="1" width="30" height="30" rx="9" className="fill-volt-400" />
        <path
          d="M10 21.5 15.5 10l3.2 6.6 2.6-3.4L24 21.5"
          className="stroke-ink-950"
          strokeWidth="2.6"
        />
      </svg>
      {!compact && (
        <span className="font-display text-xl leading-none tracking-wide text-chalk">
          BEYOND<span className="text-volt-400">FIT</span>
        </span>
      )}
    </span>
  )
}
