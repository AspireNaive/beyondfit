import { useMemo } from 'react'
import { format } from 'date-fns'
import {
  BarChart,
  ChartFrame,
  ChartLegend,
  LineChart,
  type ChartSeries,
} from '@/shared/charts/primitives'
import { CHART } from './chart-theme'

/**
 * The member-facing charts.
 *
 * Each is a thin binding of domain data onto the shared SVG primitives — the
 * only things that vary are which series, which colour slot and how values are
 * formatted. Slots are assigned in fixed order and never cycled.
 */

const theme = {
  grid: CHART.grid,
  axis: CHART.axis,
  surface: CHART.surface,
  reference: CHART.reference,
}

const shortDate = (iso: string) => format(new Date(`${iso}T00:00:00`), 'd MMM')

// ---------------------------------------------------------------------------
// Weight — single series, so no legend: the title names it.
// ---------------------------------------------------------------------------

export function WeightChart({
  data,
  unit,
  targetWeight,
}: {
  data: readonly { date: string; weight: number }[]
  unit: string
  targetWeight?: number
}) {
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'weight',
        label: 'Weight',
        color: CHART.series.primary,
        points: data.map((d) => ({ x: d.date, y: d.weight })),
      },
    ],
    [data],
  )

  return (
    <ChartFrame
      title={`Weight (${unit})`}
      subtitle={
        targetWeight ? `Dashed line is your target — ${Math.round(targetWeight)} ${unit}` : undefined
      }
    >
      <LineChart
        series={series}
        theme={theme}
        fill
        formatX={shortDate}
        formatY={(v) => v.toFixed(0)}
        formatTooltip={(v) => `${v.toFixed(1)} ${unit}`}
        referenceLine={targetWeight !== undefined ? { value: targetWeight } : undefined}
        ariaLabel={`Weight over time in ${unit}`}
      />
    </ChartFrame>
  )
}

// ---------------------------------------------------------------------------
// Body composition — single series.
// ---------------------------------------------------------------------------

export function BodyFatChart({ data }: { data: readonly { date: string; bodyFat: number }[] }) {
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'bodyFat',
        label: 'Body fat',
        color: CHART.series.tertiary,
        points: data.map((d) => ({ x: d.date, y: d.bodyFat })),
      },
    ],
    [data],
  )

  return (
    <ChartFrame title="Body fat (%)" subtitle="Measured at each check-in">
      <LineChart
        series={series}
        theme={theme}
        formatX={shortDate}
        formatY={(v) => `${v.toFixed(0)}%`}
        formatTooltip={(v) => `${v.toFixed(1)}%`}
        ariaLabel="Body fat percentage over time"
      />
    </ChartFrame>
  )
}

// ---------------------------------------------------------------------------
// Energy — two series, so a legend is mandatory. One y-axis: both series are
// kcal, which is exactly when two lines on one scale is legitimate.
// ---------------------------------------------------------------------------

export function CaloriesChart({
  data,
  target,
}: {
  data: readonly { date: string; consumed: number; burned: number }[]
  target?: number
}) {
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'consumed',
        label: 'Consumed',
        color: CHART.series.primary,
        points: data.map((d) => ({ x: d.date, y: d.consumed })),
      },
      {
        key: 'burned',
        label: 'Burned',
        color: CHART.series.secondary,
        points: data.map((d) => ({ x: d.date, y: d.burned })),
      },
    ],
    [data],
  )

  return (
    <ChartFrame
      title="Energy balance (kcal)"
      subtitle={target ? `Dashed line is your daily intake target — ${target} kcal` : undefined}
      legend={<ChartLegend series={series} />}
    >
      <LineChart
        series={series}
        theme={theme}
        formatX={shortDate}
        formatY={(v) => `${Math.round(v / 100) / 10}k`}
        formatTooltip={(v) => `${Math.round(v)} kcal`}
        referenceLine={target !== undefined ? { value: target } : undefined}
        ariaLabel="Calories consumed and burned over time"
      />
    </ChartFrame>
  )
}

// ---------------------------------------------------------------------------
// Steps — single series bars.
// ---------------------------------------------------------------------------

export function StepsChart({
  data,
  target,
}: {
  data: readonly { date: string; steps: number }[]
  target?: number
}) {
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'steps',
        label: 'Steps',
        color: CHART.series.primary,
        points: data.map((d) => ({ x: d.date, y: d.steps })),
      },
    ],
    [data],
  )

  return (
    <ChartFrame
      title="Daily steps"
      subtitle={target ? `Dashed line is your target — ${target.toLocaleString()} steps` : undefined}
    >
      <BarChart
        series={series}
        theme={theme}
        formatX={shortDate}
        formatY={(v) => `${Math.round(v / 1000)}k`}
        formatTooltip={(v) => v.toLocaleString()}
        referenceLine={target !== undefined ? { value: target } : undefined}
        ariaLabel="Daily step count"
      />
    </ChartFrame>
  )
}

// ---------------------------------------------------------------------------
// Sleep — single series bars.
// ---------------------------------------------------------------------------

export function SleepChart({ data }: { data: readonly { date: string; sleep: number }[] }) {
  const series = useMemo<ChartSeries[]>(
    () => [
      {
        key: 'sleep',
        label: 'Sleep',
        color: CHART.series.tertiary,
        points: data.map((d) => ({ x: d.date, y: d.sleep })),
      },
    ],
    [data],
  )

  return (
    <ChartFrame title="Sleep (hours)" subtitle="Seven to nine is the range worth defending">
      <BarChart
        series={series}
        theme={theme}
        formatX={shortDate}
        formatY={(v) => `${v}h`}
        formatTooltip={(v) => `${v.toFixed(1)} hours`}
        referenceLine={{ value: 7 }}
        ariaLabel="Sleep hours per night"
      />
    </ChartFrame>
  )
}
