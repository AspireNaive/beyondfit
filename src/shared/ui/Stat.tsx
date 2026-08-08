import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

/**
 * KPI tile. `deltaGoodWhen` exists because "down" is good for weight and body
 * fat but bad for streaks — the tile must not colour a drop red by default.
 */
export function Stat({
  label,
  value,
  unit,
  delta,
  deltaGoodWhen = 'up',
  icon: Icon,
  hint,
  className,
}: {
  label: string
  value: string | number
  unit?: string
  delta?: number
  deltaGoodWhen?: 'up' | 'down' | 'neutral'
  icon?: React.ComponentType<{ className?: string }>
  hint?: string
  className?: string
}) {
  const direction = delta === undefined || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down'
  const good =
    deltaGoodWhen === 'neutral' || direction === 'flat' ? null : direction === deltaGoodWhen

  const DeltaIcon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus

  return (
    <div className={cn('rounded-xl border border-ink-700 bg-ink-850/80 p-4', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">{label}</p>
        {Icon && <Icon className="size-4 shrink-0 text-chalk-faint" />}
      </div>

      <div className="mt-2 flex items-baseline gap-1.5">
        <span className="font-display text-3xl leading-none tabular-nums text-chalk">{value}</span>
        {unit && <span className="text-sm text-chalk-dim">{unit}</span>}
      </div>

      {delta !== undefined && (
        <div
          className={cn(
            'mt-2 inline-flex items-center gap-1 text-xs font-semibold tabular-nums',
            good === null ? 'text-chalk-faint' : good ? 'text-ok-500' : 'text-danger-500',
          )}
        >
          <DeltaIcon className="size-3.5" aria-hidden />
          {delta > 0 ? '+' : ''}
          {delta}
          {unit ? ` ${unit}` : ''}
          {hint && <span className="ml-1 font-normal text-chalk-faint">{hint}</span>}
        </div>
      )}

      {delta === undefined && hint && <p className="mt-2 text-xs text-chalk-faint">{hint}</p>}
    </div>
  )
}
