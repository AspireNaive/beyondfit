import { Camera } from 'lucide-react'
import {
  CONFIDENCE_LABELS,
  targetShare,
  type AnalysisConfidence,
  type FoodEntry,
  type Macros,
} from '@/domain/nutrition/model'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/cn'

export function MacroBar({
  label,
  value,
  target,
  unit,
  tone = 'volt',
}: {
  label: string
  value: number
  target?: number
  unit: string
  tone?: 'volt' | 'info' | 'ember' | 'ok'
}) {
  const share = target ? targetShare(value, target) : 0
  const over = Boolean(target && value > target)
  const fill = { volt: 'bg-volt-400', info: 'bg-info-500', ember: 'bg-ember-500', ok: 'bg-ok-500' }[tone]
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">{label}</p>
        <p className="text-sm tabular-nums text-chalk">
          <span className="font-display text-xl leading-none">{Math.round(value)}</span>
          <span className="text-chalk-dim"> {unit}</span>
          {target ? <span className="text-chalk-faint"> / {target}</span> : null}
        </p>
      </div>
      {target ? (
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700" aria-hidden>
          <div className={cn('h-full rounded-full transition-[width]', over ? 'bg-warn-500' : fill)} style={{ width: `${share * 100}%` }} />
        </div>
      ) : null}
    </div>
  )
}

export function MacroSummary({ totals, targets, className }: { totals: Macros; targets?: Macros | null; className?: string }) {
  return (
    <div className={cn('grid gap-4 sm:grid-cols-2 lg:grid-cols-4', className)}>
      <MacroBar label="Calories" value={totals.calories} target={targets?.calories} unit="kcal" />
      <MacroBar label="Protein" value={totals.proteinG} target={targets?.proteinG} unit="g" tone="info" />
      <MacroBar label="Carbs" value={totals.carbsG} target={targets?.carbsG} unit="g" tone="ok" />
      <MacroBar label="Fat" value={totals.fatG} target={targets?.fatG} unit="g" tone="ember" />
    </div>
  )
}

export function ConfidenceBadge({ confidence }: { confidence: AnalysisConfidence }) {
  const tone = confidence === 'high' ? 'ok' : confidence === 'medium' ? 'info' : 'warn'
  return (
    <Badge tone={tone} dot>
      {CONFIDENCE_LABELS[confidence]}
    </Badge>
  )
}

export function MealThumb({ entry, className, onClick }: { entry: FoodEntry; className?: string; onClick?: () => void }) {
  const inner = entry.thumbDataUrl ? (
    <img src={entry.thumbDataUrl} alt="" className="size-full object-cover" />
  ) : (
    <span className="grid size-full place-items-center text-chalk-faint">
      <Camera className="size-5" />
    </span>
  )
  const classes = cn('shrink-0 overflow-hidden rounded-lg border border-ink-700 bg-ink-900', className)
  if (onClick && entry.hasPhoto) {
    return (
      <button type="button" onClick={onClick} className={cn(classes, 'transition-colors hover:border-volt-400')} aria-label="View photo">
        {inner}
      </button>
    )
  }
  return <div className={classes}>{inner}</div>
}

