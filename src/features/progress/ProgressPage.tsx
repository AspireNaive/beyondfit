import { useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Activity, Flame, Footprints, Plus, Scale, TrendingDown } from 'lucide-react'
import { Role, fullName } from '@/domain/identity/model'
import {
  BMI_BANDS,
  bmiBand,
  bmiBandWidth,
  bmiMarkerPosition,
  calculateBmi,
  currentStreak,
  energyBalance,
  formatHeight,
  formatWeight,
  kgToLb,
  lbToKg,
  seriesDelta,
  type UnitSystem,
} from '@/domain/progress/model'
import { PageHeading } from '@/shared/ui/Card'
import { Badge, type BadgeTone } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Stat } from '@/shared/ui/Stat'
import { Tabs } from '@/shared/ui/Tabs'
import { ErrorState, Skeleton } from '@/shared/ui/Feedback'
import { useCurrentUser } from '@/features/auth/store'
import { useProfile } from '@/features/profiles/hooks'
import { BodyFatChart, CaloriesChart, SleepChart, StepsChart, WeightChart } from './charts'
import { useActivity, useBodyMetrics, useGoal, useLogBodyMetric } from './hooks'
import { cn } from '@/shared/lib/cn'
import { today } from '@/shared/lib/dates'
import type { UserId } from '@/domain/shared/types'

const RANGES = [
  { id: '30', label: '30 days', days: 30 },
  { id: '90', label: '90 days', days: 90 },
] as const

type RangeId = (typeof RANGES)[number]['id']

/** BMI is a single ratio against banded limits — a meter, not a chart. */
function BmiMeter({ bmi }: { bmi: number }) {
  const band = bmiBand(bmi)
  const position = bmiMarkerPosition(bmi)

  const toneClass: Record<string, string> = {
    info: 'bg-info-500',
    ok: 'bg-ok-500',
    warn: 'bg-warn-500',
    danger: 'bg-danger-500',
  }

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
            Body mass index
          </p>
          <p className="mt-2 font-display text-4xl leading-none tabular-nums text-chalk">
            {bmi.toFixed(1)}
          </p>
        </div>
        <Badge tone={band.tone as BadgeTone} dot>
          {band.label}
        </Badge>
      </div>

      <div className="relative mt-6">
        <div className="flex h-2 gap-0.5 overflow-hidden rounded-full">
          {BMI_BANDS.map((b) => (
            <span
              key={b.label}
              className={cn('h-full', toneClass[b.tone])}
              style={{
                // Each band takes its true share of the 15–40 track, so the
                // segment edges line up with the 18.5 / 25 / 30 tick labels.
                width: `${bmiBandWidth(b)}%`,
                opacity: b.label === band.label ? 1 : 0.28,
              }}
            />
          ))}
        </div>

        <span
          aria-hidden
          className="absolute -top-1 size-4 -translate-x-1/2 rounded-full border-2 border-ink-950 bg-chalk"
          style={{ left: `${position}%` }}
        />
      </div>

      <div className="mt-3 flex justify-between text-[10px] tabular-nums text-chalk-faint">
        <span>15</span>
        <span>18.5</span>
        <span>25</span>
        <span>30</span>
        <span>40</span>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-chalk-faint text-pretty">
        BMI ignores muscle mass, so it is a screening number rather than a verdict. Your coach reads
        it alongside body fat and waist measurement.
      </p>
    </div>
  )
}

export default function ProgressPage() {
  const viewer = useCurrentUser()
  const { memberId: routeMemberId } = useParams()

  // A coach or admin can open /app/progress/:memberId for one of their clients.
  const memberId = routeMemberId ?? viewer?.id
  const viewingOther = Boolean(routeMemberId && routeMemberId !== viewer?.id)

  const [units, setUnits] = useState<UnitSystem>('metric')
  const [range, setRange] = useState<RangeId>('30')
  const [logOpen, setLogOpen] = useState(false)
  const [showTable, setShowTable] = useState(false)

  const days = RANGES.find((r) => r.id === range)!.days

  const { data: subject } = useProfile(viewingOther ? (routeMemberId as UserId) : undefined)
  const metrics = useBodyMetrics(memberId)
  const activity = useActivity(memberId, days)
  const goal = useGoal(memberId)
  const logMetric = useLogBodyMetric(memberId)

  const latest = metrics.data?.[metrics.data.length - 1]
  const bmi = latest ? calculateBmi(latest.weightKg, latest.heightCm) : 0

  const weightSeries = useMemo(
    () =>
      (metrics.data ?? []).map((entry) => ({
        date: entry.recordedOn,
        weight: units === 'metric' ? entry.weightKg : kgToLb(entry.weightKg),
      })),
    [metrics.data, units],
  )

  const bodyFatSeries = useMemo(
    () =>
      (metrics.data ?? [])
        .filter((entry) => entry.bodyFatPercent !== undefined)
        .map((entry) => ({ date: entry.recordedOn, bodyFat: entry.bodyFatPercent! })),
    [metrics.data],
  )

  const activitySeries = useMemo(
    () =>
      (activity.data ?? []).map((entry) => ({
        date: entry.date,
        consumed: entry.caloriesConsumed,
        burned: entry.caloriesBurned,
        steps: entry.steps,
        sleep: entry.sleepHours,
      })),
    [activity.data],
  )

  const weightDelta = seriesDelta(weightSeries.map((d) => d.weight))
  const bodyFatDelta = seriesDelta(bodyFatSeries.map((d) => d.bodyFat))

  const streak = useMemo(
    () => currentStreak(activity.data ?? [], goal.data?.dailyStepTarget ?? 10_000),
    [activity.data, goal.data],
  )

  const avgBalance = useMemo(() => {
    const rows = activity.data ?? []
    if (rows.length === 0) return 0
    return Math.round(rows.reduce((sum, row) => sum + energyBalance(row), 0) / rows.length)
  }, [activity.data])

  const avgSteps = useMemo(() => {
    const rows = activity.data ?? []
    if (rows.length === 0) return 0
    return Math.round(rows.reduce((sum, row) => sum + row.steps, 0) / rows.length)
  }, [activity.data])

  const loading = metrics.isPending || activity.isPending

  if (metrics.isError || activity.isError) {
    return (
      <ErrorState
        description="Couldn't load progress data."
        onRetry={() => {
          void metrics.refetch()
          void activity.refetch()
        }}
      />
    )
  }

  const unitLabel = units === 'metric' ? 'kg' : 'lb'

  return (
    <>
      <PageHeading
        title={viewingOther && subject ? `${fullName(subject)}'s progress` : 'My progress'}
        subtitle={
          viewingOther
            ? 'Read-only view of your client’s tracked metrics.'
            : 'Weight, body composition, energy and activity — everything your coach sees.'
        }
        actions={
          <>
            <div className="flex rounded-lg border border-ink-600 p-0.5">
              {(['metric', 'imperial'] as const).map((system) => (
                <button
                  key={system}
                  type="button"
                  onClick={() => setUnits(system)}
                  aria-pressed={units === system}
                  className={cn(
                    'rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
                    units === system ? 'bg-volt-400 text-ink-950' : 'text-chalk-dim hover:text-chalk',
                  )}
                >
                  {system === 'metric' ? 'kg / cm' : 'lb / ft'}
                </button>
              ))}
            </div>

            {viewer?.role === Role.Member && !viewingOther && (
              <Button size="md" onClick={() => setLogOpen(true)}>
                <Plus className="size-4" />
                Log today
              </Button>
            )}
          </>
        }
      />

      {loading ? (
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Skeleton className="h-80" />
            <Skeleton className="h-80" />
          </div>
        </div>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Current weight"
              value={latest ? formatWeight(latest.weightKg, units).split(' ')[0]! : '—'}
              unit={unitLabel}
              delta={weightDelta}
              deltaGoodWhen="down"
              hint="over 26 weeks"
              icon={Scale}
            />
            <Stat
              label="Body fat"
              value={latest?.bodyFatPercent?.toFixed(1) ?? '—'}
              unit="%"
              delta={bodyFatDelta}
              deltaGoodWhen="down"
              hint="over 26 weeks"
              icon={TrendingDown}
            />
            <Stat
              label="Avg daily steps"
              value={avgSteps.toLocaleString()}
              hint={`${streak} day streak at target`}
              icon={Footprints}
            />
            <Stat
              label="Avg energy balance"
              value={avgBalance > 0 ? `+${avgBalance}` : String(avgBalance)}
              unit="kcal"
              hint={avgBalance > 0 ? 'in a surplus' : 'in a deficit'}
              icon={Flame}
            />
          </div>

          {/* Height + BMI */}
          <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.6fr]">
            <div className="space-y-5">
              <BmiMeter bmi={bmi} />

              <div className="rounded-xl border border-ink-700 bg-ink-850/80 p-5">
                <h3 className="text-lg">Baseline</h3>
                <dl className="mt-4 space-y-3 text-sm">
                  {[
                    ['Height', latest ? formatHeight(latest.heightCm, units) : '—'],
                    ['Waist', latest?.waistCm ? `${latest.waistCm} cm` : '—'],
                    ['Resting HR', latest?.restingHeartRate ? `${latest.restingHeartRate} bpm` : '—'],
                    [
                      'Target weight',
                      goal.data?.targetWeightKg
                        ? formatWeight(goal.data.targetWeightKg, units)
                        : '—',
                    ],
                    ['Focus', goal.data?.focus ?? '—'],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-chalk-faint">{label}</dt>
                      <dd className="text-right font-medium text-chalk">{value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            <WeightChart
              data={weightSeries}
              unit={unitLabel}
              targetWeight={
                goal.data?.targetWeightKg
                  ? units === 'metric'
                    ? goal.data.targetWeightKg
                    : kgToLb(goal.data.targetWeightKg)
                  : undefined
              }
            />
          </div>

          {/* Activity */}
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-2xl">Activity</h2>
            <div className="flex items-center gap-3">
              <Tabs
                value={range}
                onChange={setRange}
                items={RANGES.map((r) => ({ id: r.id, label: r.label }))}
              />
              <Button variant="ghost" size="sm" onClick={() => setShowTable((v) => !v)}>
                {showTable ? 'Show charts' : 'Show table'}
              </Button>
            </div>
          </div>

          {showTable ? (
            /* The chart data as a table — the non-visual route to the same
               numbers, and the relief channel the colour rules require. */
            <div className="mt-5 overflow-x-auto rounded-xl border border-ink-700">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Daily activity for the last {days} days</caption>
                <thead>
                  <tr className="bg-ink-900/80">
                    {['Date', 'Steps', 'Consumed', 'Burned', 'Balance', 'Sleep'].map((header) => (
                      <th
                        key={header}
                        scope="col"
                        className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-chalk-faint"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...activitySeries].reverse().map((row) => (
                    <tr key={row.date} className="border-t border-ink-700/70">
                      <td className="px-4 py-2.5 text-chalk">
                        {format(new Date(`${row.date}T00:00:00`), 'd MMM yyyy')}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-chalk-dim">
                        {row.steps.toLocaleString()}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-chalk-dim">{row.consumed}</td>
                      <td className="px-4 py-2.5 tabular-nums text-chalk-dim">{row.burned}</td>
                      <td
                        className={cn(
                          'px-4 py-2.5 tabular-nums',
                          row.consumed - row.burned > 0 ? 'text-warn-500' : 'text-ok-500',
                        )}
                      >
                        {row.consumed - row.burned > 0 ? '+' : ''}
                        {row.consumed - row.burned}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-chalk-dim">
                        {row.sleep.toFixed(1)} h
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <CaloriesChart data={activitySeries} target={goal.data?.dailyCalorieTarget} />
              <StepsChart data={activitySeries} target={goal.data?.dailyStepTarget} />
              <SleepChart data={activitySeries} />
              {bodyFatSeries.length > 0 && <BodyFatChart data={bodyFatSeries} />}
            </div>
          )}
        </>
      )}

      <LogMetricModal
        open={logOpen}
        onClose={() => setLogOpen(false)}
        units={units}
        defaults={latest}
        pending={logMetric.isPending}
        onSubmit={(entry) => {
          if (!memberId) return
          logMetric.mutate(
            {
              memberId: memberId as UserId,
              recordedOn: today(),
              weightKg: entry.weightKg,
              heightCm: entry.heightCm,
              bodyFatPercent: entry.bodyFatPercent,
              restingHeartRate: entry.restingHeartRate,
            },
            { onSuccess: () => setLogOpen(false) },
          )
        }}
      />
    </>
  )
}

function LogMetricModal({
  open,
  onClose,
  units,
  defaults,
  pending,
  onSubmit,
}: {
  open: boolean
  onClose: () => void
  units: UnitSystem
  defaults?: { weightKg: number; heightCm: number; bodyFatPercent?: number; restingHeartRate?: number }
  pending: boolean
  onSubmit: (entry: {
    weightKg: number
    heightCm: number
    bodyFatPercent?: number
    restingHeartRate?: number
  }) => void
}) {
  const [weight, setWeight] = useState('')
  const [bodyFat, setBodyFat] = useState('')
  const [restingHr, setRestingHr] = useState('')

  const unitLabel = units === 'metric' ? 'kg' : 'lb'

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const parsed = Number(weight)
    if (!parsed) return
    onSubmit({
      // Always persist metric; the unit toggle is presentation only.
      weightKg: units === 'metric' ? parsed : lbToKg(parsed),
      heightCm: defaults?.heightCm ?? 175,
      bodyFatPercent: bodyFat ? Number(bodyFat) : undefined,
      restingHeartRate: restingHr ? Number(restingHr) : undefined,
    })
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log today's numbers"
      description="Weigh in at the same time of day for a trend you can actually read."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button form="log-metric-form" type="submit" loading={pending}>
            Save entry
          </Button>
        </>
      }
    >
      <form id="log-metric-form" onSubmit={submit} className="space-y-4">
        <Input
          label={`Weight (${unitLabel})`}
          type="number"
          step="0.1"
          inputMode="decimal"
          required
          autoFocus
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          placeholder={
            defaults
              ? String(
                  units === 'metric'
                    ? defaults.weightKg
                    : Math.round(kgToLb(defaults.weightKg) * 10) / 10,
                )
              : ''
          }
        />
        <Input
          label="Body fat (%)"
          type="number"
          step="0.1"
          inputMode="decimal"
          hint="Optional — from a scale, calipers or a DEXA scan"
          value={bodyFat}
          onChange={(e) => setBodyFat(e.target.value)}
        />
        <Input
          label="Resting heart rate (bpm)"
          type="number"
          inputMode="numeric"
          hint="Optional — measured before getting out of bed"
          value={restingHr}
          onChange={(e) => setRestingHr(e.target.value)}
        />

        <p className="flex items-start gap-2 text-xs text-chalk-faint">
          <Activity className="mt-0.5 size-3.5 shrink-0 text-volt-400" />
          Logging on the same day twice overwrites the earlier entry rather than adding a second
          point.
        </p>
      </form>
    </Modal>
  )
}
