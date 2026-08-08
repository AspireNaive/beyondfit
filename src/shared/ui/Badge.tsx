import { cn } from '@/shared/lib/cn'

export type BadgeTone = 'neutral' | 'volt' | 'ok' | 'warn' | 'danger' | 'info' | 'ember'

const tones: Record<BadgeTone, string> = {
  neutral: 'bg-ink-700 text-chalk-dim border-ink-600',
  volt: 'bg-volt-500/15 text-volt-300 border-volt-500/35',
  ok: 'bg-ok-500/15 text-ok-500 border-ok-500/35',
  warn: 'bg-warn-500/15 text-warn-500 border-warn-500/35',
  danger: 'bg-danger-500/15 text-danger-500 border-danger-500/35',
  info: 'bg-info-500/15 text-info-500 border-info-500/35',
  ember: 'bg-ember-500/15 text-ember-400 border-ember-500/35',
}

export function Badge({
  tone = 'neutral',
  className,
  dot,
  children,
  ...rest
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: BadgeTone; dot?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
        tones[tone],
        className,
      )}
      {...rest}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {children}
    </span>
  )
}
