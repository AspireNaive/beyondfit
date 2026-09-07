import { cn } from '@/shared/lib/cn'

/**
 * Brand logo. The artwork carries its own wordmark, so `compact` only changes
 * the rendered size. `kedem_logo.png` is the supplied JPEG with its black
 * backdrop turned into alpha (see public/media/README.md), so it sits on any
 * dark surface without a visible square edge.
 */
export function Logo({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <img
      src="/media/kedem_logo.png"
      alt="Kedem Life"
      width={512}
      height={512}
      decoding="async"
      className={cn('block shrink-0 object-contain', compact ? 'size-10' : 'size-14', className)}
    />
  )
}
