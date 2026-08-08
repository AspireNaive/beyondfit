import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { cn } from '@/shared/lib/cn'

/**
 * Chart primitives.
 *
 * Hand-rolled SVG rather than a charting library. Recharts pulls in d3 and cost
 * 91 kB brotli — and because it lands in a shared chunk it was being
 * modulepreloaded on the marketing homepage, which never draws a chart. These
 * four forms (line, area, bar, plus the shared frame) are the entire surface
 * the product needs, and they render from plain path strings.
 *
 * Mark specs follow the house data-viz rules: 2px strokes, 8px active markers,
 * bar data-ends rounded 4px and anchored to the baseline, a 2px gap between
 * adjacent bars, and recessive grid/axis chrome.
 */

export type ChartPoint = { x: string; y: number }

export type ChartSeries = {
  key: string
  label: string
  color: string
  points: readonly ChartPoint[]
}

type Margin = { top: number; right: number; bottom: number; left: number }

const DEFAULT_MARGIN: Margin = { top: 8, right: 8, bottom: 24, left: 44 }

/** Stable empty array — a fresh `[]` fallback would break memo dependencies. */
const NO_POINTS: readonly ChartPoint[] = []

// ---------------------------------------------------------------------------
// Sizing
// ---------------------------------------------------------------------------

/** Width from a ResizeObserver; height is fixed by the caller. */
function useMeasuredWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return

    // Seed synchronously so the first paint is not an empty box.
    setWidth(element.clientWidth)

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) setWidth(entry.contentRect.width)
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  return [ref, width] as const
}

// ---------------------------------------------------------------------------
// Scales & ticks
// ---------------------------------------------------------------------------

/** "Nice" round step so axis labels read 0 / 500 / 1,000 rather than 0 / 437. */
function niceStep(rough: number) {
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalised = rough / magnitude
  const step = normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 2.5 ? 2.5 : normalised <= 5 ? 5 : 10
  return step * magnitude
}

function computeTicks(min: number, max: number, target = 4) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return { ticks: [min], lo: min - 1, hi: max + 1 }
  }
  const step = niceStep((max - min) / target)
  const lo = Math.floor(min / step) * step
  const hi = Math.ceil(max / step) * step

  const ticks: number[] = []
  // Guard against a pathological step producing an unbounded loop.
  for (let value = lo, i = 0; value <= hi + step / 2 && i < 40; value += step, i++) {
    ticks.push(Math.round(value * 1e6) / 1e6)
  }
  return { ticks, lo, hi }
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

export function ChartFrame({
  title,
  subtitle,
  legend,
  children,
  className,
}: {
  title: string
  subtitle?: string
  legend?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <figure className={cn('rounded-xl border border-ink-700 bg-ink-850/80 p-5', className)}>
      <figcaption className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-lg leading-tight">{title}</h3>
          {subtitle && <p className="mt-1 text-xs text-chalk-faint">{subtitle}</p>}
        </div>
        {legend}
      </figcaption>
      {children}
    </figure>
  )
}

/** Swatch row. Required whenever a chart carries two or more series. */
export function ChartLegend({ series }: { series: readonly Pick<ChartSeries, 'key' | 'label' | 'color'>[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1">
      {series.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5 text-xs text-chalk-dim">
          <span aria-hidden className="size-2.5 rounded-full" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  )
}

// ---------------------------------------------------------------------------
// Shared plot shell: axes, grid, hover tracking
// ---------------------------------------------------------------------------

type PlotProps = {
  series: readonly ChartSeries[]
  height?: number
  /** Chrome colours, supplied by the app's chart theme. */
  theme: { grid: string; axis: string; surface: string; reference: string }
  formatX: (x: string) => string
  formatY: (y: number) => string
  formatTooltip?: (y: number, seriesKey: string) => string
  referenceLine?: { value: number; label?: string }
  /** Pad the y-domain rather than starting at zero (weight, body fat). */
  zeroBased?: boolean
  ariaLabel: string
}

type HoverState = { index: number; x: number } | null

function useHover(
  count: number,
  plotLeft: number,
  plotWidth: number,
  bandwidth: number,
) {
  const [hover, setHover] = useState<HoverState>(null)

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const bounds = event.currentTarget.getBoundingClientRect()
      const offset = event.clientX - bounds.left - plotLeft
      if (offset < 0 || offset > plotWidth || count === 0) {
        setHover(null)
        return
      }
      const index = Math.min(count - 1, Math.max(0, Math.round((offset - bandwidth / 2) / bandwidth)))
      setHover({ index, x: plotLeft + bandwidth * index + bandwidth / 2 })
    },
    [count, plotLeft, plotWidth, bandwidth],
  )

  const onPointerLeave = useCallback(() => setHover(null), [])

  return { hover, onPointerMove, onPointerLeave }
}

function Tooltip({
  x,
  containerWidth,
  label,
  entries,
}: {
  x: number
  containerWidth: number
  label: string
  entries: readonly { key: string; label: string; color: string; value: string }[]
}) {
  // Flip the card to the other side of the cursor near the right edge so it
  // never gets clipped by the card it lives in.
  const flip = x > containerWidth - 140

  return (
    <div
      className="pointer-events-none absolute top-2 z-10 min-w-32 rounded-lg border border-ink-600 bg-ink-900/95 px-3 py-2 shadow-xl backdrop-blur-sm"
      style={{
        left: flip ? undefined : Math.max(0, x + 12),
        right: flip ? Math.max(0, containerWidth - x + 12) : undefined,
      }}
    >
      <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">{label}</p>
      <ul className="mt-1.5 space-y-1">
        {entries.map((entry) => (
          <li key={entry.key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden
              className="size-2 shrink-0 rounded-full"
              style={{ background: entry.color }}
            />
            <span className="text-chalk-dim">{entry.label}</span>
            <span className="ml-auto font-semibold tabular-nums text-chalk">{entry.value}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Line / area
// ---------------------------------------------------------------------------

export function LineChart({
  series,
  height = 260,
  theme,
  formatX,
  formatY,
  formatTooltip,
  referenceLine,
  zeroBased = false,
  fill = false,
  ariaLabel,
}: PlotProps & { fill?: boolean }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>()
  const gradientId = useId()
  const margin = DEFAULT_MARGIN

  const count = series[0]?.points.length ?? 0
  const plotWidth = Math.max(0, width - margin.left - margin.right)
  const plotHeight = Math.max(0, height - margin.top - margin.bottom)
  const bandwidth = count > 1 ? plotWidth / (count - 1) : plotWidth

  const { lo, hi, ticks } = useMemo(() => {
    const values = series.flatMap((s) => s.points.map((p) => p.y))
    if (values.length === 0) return { lo: 0, hi: 1, ticks: [0, 1] }
    const min = zeroBased ? 0 : Math.min(...values)
    const max = Math.max(...values)
    const padded = referenceLine ? { min: Math.min(min, referenceLine.value), max: Math.max(max, referenceLine.value) } : { min, max }
    return computeTicks(padded.min, padded.max)
  }, [series, zeroBased, referenceLine])

  const yOf = useCallback(
    (value: number) => margin.top + plotHeight - ((value - lo) / (hi - lo || 1)) * plotHeight,
    [margin.top, plotHeight, lo, hi],
  )
  const xOf = useCallback(
    (index: number) => margin.left + (count > 1 ? bandwidth * index : plotWidth / 2),
    [margin.left, bandwidth, count, plotWidth],
  )

  const { hover, onPointerMove, onPointerLeave } = useHover(
    count,
    margin.left,
    plotWidth,
    count > 1 ? bandwidth : plotWidth,
  )

  const paths = useMemo(
    () =>
      series.map((s) => {
        const line = s.points
          .map((point, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(2)},${yOf(point.y).toFixed(2)}`)
          .join(' ')
        const area = `${line} L${xOf(s.points.length - 1).toFixed(2)},${(margin.top + plotHeight).toFixed(2)} L${xOf(0).toFixed(2)},${(margin.top + plotHeight).toFixed(2)} Z`
        return { key: s.key, line, area, color: s.color }
      }),
    [series, xOf, yOf, margin.top, plotHeight],
  )

  // X labels: show at most 5, evenly spaced, so they never collide.
  const xLabelEvery = Math.max(1, Math.ceil(count / 5))

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="touch-pan-y"
        >
          {fill && (
            <defs>
              {paths.map((path) => (
                <linearGradient key={path.key} id={`${gradientId}-${path.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={path.color} stopOpacity={0.28} />
                  <stop offset="100%" stopColor={path.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
          )}

          {/* Grid + y labels */}
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke={theme.grid}
                strokeWidth={1}
              />
              <text
                x={margin.left - 8}
                y={yOf(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill={theme.axis}
                fontSize={11}
                className="tabular-nums"
              >
                {formatY(tick)}
              </text>
            </g>
          ))}

          {/* X labels */}
          {series[0]?.points.map((point, i) =>
            i % xLabelEvery === 0 ? (
              <text
                key={point.x}
                x={xOf(i)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : 'middle'}
                fill={theme.axis}
                fontSize={11}
              >
                {formatX(point.x)}
              </text>
            ) : null,
          )}

          {referenceLine && (
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={yOf(referenceLine.value)}
              y2={yOf(referenceLine.value)}
              stroke={theme.reference}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )}

          {/* Marks */}
          {paths.map((path) => (
            <g key={path.key}>
              {fill && <path d={path.area} fill={`url(#${gradientId}-${path.key})`} />}
              <path
                d={path.line}
                fill="none"
                stroke={path.color}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </g>
          ))}

          {/* Hover crosshair + 8px markers ringed against the surface */}
          {hover && (
            <g>
              <line
                x1={xOf(hover.index)}
                x2={xOf(hover.index)}
                y1={margin.top}
                y2={margin.top + plotHeight}
                stroke={theme.axis}
                strokeWidth={1}
              />
              {series.map((s) => {
                const point = s.points[hover.index]
                if (!point) return null
                return (
                  <circle
                    key={s.key}
                    cx={xOf(hover.index)}
                    cy={yOf(point.y)}
                    r={4}
                    fill={s.color}
                    stroke={theme.surface}
                    strokeWidth={2}
                  />
                )
              })}
            </g>
          )}
        </svg>
      )}

      {hover && series[0]?.points[hover.index] && (
        <Tooltip
          x={hover.x}
          containerWidth={width}
          label={formatX(series[0].points[hover.index]!.x)}
          entries={series.map((s) => ({
            key: s.key,
            label: s.label,
            color: s.color,
            value: formatTooltip
              ? formatTooltip(s.points[hover.index]?.y ?? 0, s.key)
              : formatY(s.points[hover.index]?.y ?? 0),
          }))}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Bars
// ---------------------------------------------------------------------------

export function BarChart({
  series,
  height = 260,
  theme,
  formatX,
  formatY,
  formatTooltip,
  referenceLine,
  maxBarWidth = 14,
  ariaLabel,
}: PlotProps & { maxBarWidth?: number }) {
  const [ref, width] = useMeasuredWidth<HTMLDivElement>()
  const margin = DEFAULT_MARGIN

  const points = series[0]?.points ?? NO_POINTS
  const color = series[0]?.color ?? theme.axis
  const count = points.length

  const plotWidth = Math.max(0, width - margin.left - margin.right)
  const plotHeight = Math.max(0, height - margin.top - margin.bottom)
  const bandwidth = count > 0 ? plotWidth / count : plotWidth

  // 2px surface gap between adjacent bars, capped so sparse data isn't chunky.
  const barWidth = Math.max(2, Math.min(maxBarWidth, bandwidth - 2))

  const { lo, hi, ticks } = useMemo(() => {
    const values = points.map((p) => p.y)
    if (values.length === 0) return { lo: 0, hi: 1, ticks: [0, 1] }
    const max = Math.max(...values, referenceLine?.value ?? 0)
    return computeTicks(0, max)
  }, [points, referenceLine])

  const yOf = useCallback(
    (value: number) => margin.top + plotHeight - ((value - lo) / (hi - lo || 1)) * plotHeight,
    [margin.top, plotHeight, lo, hi],
  )
  const xOf = useCallback(
    (index: number) => margin.left + bandwidth * index + bandwidth / 2,
    [margin.left, bandwidth],
  )

  const { hover, onPointerMove, onPointerLeave } = useHover(count, margin.left, plotWidth, bandwidth)

  const xLabelEvery = Math.max(1, Math.ceil(count / 5))
  const baseline = margin.top + plotHeight

  return (
    <div ref={ref} className="relative" style={{ height }}>
      {width > 0 && (
        <svg
          width={width}
          height={height}
          role="img"
          aria-label={ariaLabel}
          onPointerMove={onPointerMove}
          onPointerLeave={onPointerLeave}
          className="touch-pan-y"
        >
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={width - margin.right}
                y1={yOf(tick)}
                y2={yOf(tick)}
                stroke={theme.grid}
                strokeWidth={1}
              />
              <text
                x={margin.left - 8}
                y={yOf(tick)}
                textAnchor="end"
                dominantBaseline="middle"
                fill={theme.axis}
                fontSize={11}
                className="tabular-nums"
              >
                {formatY(tick)}
              </text>
            </g>
          ))}

          {points.map((point, i) =>
            i % xLabelEvery === 0 ? (
              <text
                key={point.x}
                x={xOf(i)}
                y={height - 6}
                textAnchor={i === 0 ? 'start' : 'middle'}
                fill={theme.axis}
                fontSize={11}
              >
                {formatX(point.x)}
              </text>
            ) : null,
          )}

          {points.map((point, i) => {
            const top = yOf(point.y)
            const barHeight = Math.max(0, baseline - top)
            return (
              <rect
                key={point.x}
                x={xOf(i) - barWidth / 2}
                y={top}
                width={barWidth}
                height={barHeight}
                // Rounded data-end only; the baseline end stays square.
                rx={Math.min(4, barWidth / 2)}
                fill={color}
                opacity={hover && hover.index !== i ? 0.55 : 1}
              />
            )
          })}

          {referenceLine && (
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={yOf(referenceLine.value)}
              y2={yOf(referenceLine.value)}
              stroke={theme.reference}
              strokeWidth={1.5}
              strokeDasharray="5 4"
            />
          )}
        </svg>
      )}

      {hover && points[hover.index] && (
        <Tooltip
          x={hover.x}
          containerWidth={width}
          label={formatX(points[hover.index]!.x)}
          entries={[
            {
              key: series[0]!.key,
              label: series[0]!.label,
              color,
              value: formatTooltip
                ? formatTooltip(points[hover.index]!.y, series[0]!.key)
                : formatY(points[hover.index]!.y),
            },
          ]}
        />
      )}
    </div>
  )
}
