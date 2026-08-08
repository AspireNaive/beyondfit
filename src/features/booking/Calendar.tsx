import { useMemo, useState } from 'react'
import {
  addMonths,
  endOfMonth,
  format,
  isBefore,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  addDays,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/cn'
import { toIsoDate } from '@/shared/lib/dates'
import type { IsoDate } from '@/domain/shared/types'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']

/**
 * Month-grid date picker.
 *
 * Hand-rolled rather than pulled from a library: the app needs exactly one
 * calendar, with our own disabled/selected states, and a datepicker dependency
 * is usually 40–60 kB gzipped for behaviour that is a `date-fns` loop.
 *
 * Keyboard: arrows move by day/week, PageUp/PageDown by month, Enter selects.
 */
export function Calendar({
  value,
  onChange,
  minDate = startOfDay(new Date()),
  maxMonthsAhead = 3,
  className,
  /** Days with no free slots, so the grid can grey them out. */
  unavailableDates,
}: {
  value: IsoDate
  onChange: (date: IsoDate) => void
  minDate?: Date
  maxMonthsAhead?: number
  className?: string
  unavailableDates?: ReadonlySet<IsoDate>
}) {
  const selected = useMemo(() => new Date(`${value}T00:00:00`), [value])
  const [cursor, setCursor] = useState(() => startOfMonth(selected))

  const maxDate = useMemo(
    () => endOfMonth(addMonths(startOfDay(new Date()), maxMonthsAhead)),
    [maxMonthsAhead],
  )

  // Six fixed weeks so the grid never changes height between months.
  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 })
    return Array.from({ length: 42 }, (_, i) => addDays(gridStart, i))
  }, [cursor])

  const canGoBack = isBefore(startOfMonth(minDate), cursor)
  const canGoForward = isBefore(addMonths(cursor, 1), maxDate)

  const isDisabled = (day: Date) =>
    isBefore(day, startOfDay(minDate)) ||
    isBefore(maxDate, day) ||
    Boolean(unavailableDates?.has(toIsoDate(day)))

  const onKeyDown = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    }
    if (event.key in moves) {
      event.preventDefault()
      const next = addDays(selected, moves[event.key]!)
      if (!isDisabled(next)) {
        onChange(toIsoDate(next))
        setCursor(startOfMonth(next))
      }
      return
    }
    if (event.key === 'PageUp' || event.key === 'PageDown') {
      event.preventDefault()
      setCursor((c) => addMonths(c, event.key === 'PageUp' ? -1 : 1))
    }
  }

  return (
    <div className={cn('rounded-xl border border-ink-700 bg-ink-850/60 p-4', className)}>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          disabled={!canGoBack}
          onClick={() => setCursor((c) => addMonths(c, -1))}
          aria-label="Previous month"
          className="grid size-9 place-items-center rounded-lg text-chalk-dim transition-colors hover:bg-ink-700 hover:text-chalk disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="size-4.5" />
        </button>

        <p aria-live="polite" className="font-display text-lg tracking-wide">
          {format(cursor, 'MMMM yyyy')}
        </p>

        <button
          type="button"
          disabled={!canGoForward}
          onClick={() => setCursor((c) => addMonths(c, 1))}
          aria-label="Next month"
          className="grid size-9 place-items-center rounded-lg text-chalk-dim transition-colors hover:bg-ink-700 hover:text-chalk disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="size-4.5" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1" role="grid" aria-label="Choose a date">
        {WEEKDAYS.map((day) => (
          <div
            key={day}
            role="columnheader"
            className="pb-1 text-center text-[10px] font-semibold uppercase tracking-wider text-chalk-faint"
          >
            {day}
          </div>
        ))}

        {days.map((day) => {
          const iso = toIsoDate(day)
          const disabled = isDisabled(day)
          const isSelected = isSameDay(day, selected)
          const inMonth = isSameMonth(day, cursor)
          const isToday = isSameDay(day, new Date())

          return (
            <button
              key={iso}
              type="button"
              role="gridcell"
              disabled={disabled}
              tabIndex={isSelected ? 0 : -1}
              aria-selected={isSelected}
              aria-label={format(day, 'EEEE d MMMM yyyy')}
              onKeyDown={onKeyDown}
              onClick={() => onChange(iso)}
              className={cn(
                'relative aspect-square rounded-lg text-sm tabular-nums transition-colors',
                !inMonth && 'text-chalk-faint/40',
                inMonth && !disabled && 'text-chalk hover:bg-ink-700',
                disabled && 'cursor-not-allowed text-chalk-faint/30',
                isSelected && 'bg-volt-400 font-bold text-ink-950 hover:bg-volt-400',
              )}
            >
              {day.getDate()}
              {isToday && !isSelected && (
                <span
                  aria-hidden
                  className="absolute bottom-1.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-volt-400"
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
