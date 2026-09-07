import { TZDate } from '@date-fns/tz'
import type { AvailabilitySlot } from '../../domain.js'

export type Range = { start: number; end: number }
export type Hours = { weekday: number; startMinute: number; endMinute: number }

const overlaps = (start: number, end: number, ranges: readonly Range[]) =>
  ranges.some((r) => start < r.end && end > r.start)

/** The UTC instant of `date` at `minute` past midnight in the provider's timezone. */
export function instantAt(date: string, minute: number, timezone: string): Date {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new Date(new TZDate(y, m - 1, d, Math.floor(minute / 60), minute % 60, 0, 0, timezone).getTime())
}

export const weekdayOf = (date: string, timezone: string) => {
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return new TZDate(y, m - 1, d, 12, 0, 0, 0, timezone).getDay()
}

/** Calendar date (YYYY-MM-DD) of an instant in the provider's timezone. */
export function dateIn(instant: Date, timezone: string): string {
  const z = new TZDate(instant.getTime(), timezone)
  return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, '0')}-${String(z.getDate()).padStart(2, '0')}`
}

/**
 * Pure slot generation for one calendar day. Working hours are walked in
 * `slotMinutes` steps; a slot is available when it starts in the future and
 * overlaps neither a live booking nor time off.
 */
export function slotsForDay(input: {
  date: string
  timezone: string
  slotMinutes: number
  hours: readonly Hours[]
  booked: readonly Range[]
  timeOff: readonly Range[]
  now: Date
}): AvailabilitySlot[] {
  const weekday = weekdayOf(input.date, input.timezone)
  const slots: AvailabilitySlot[] = []
  for (const h of input.hours.filter((h) => h.weekday === weekday)) {
    for (let minute = h.startMinute; minute + input.slotMinutes <= h.endMinute; minute += input.slotMinutes) {
      const start = instantAt(input.date, minute, input.timezone)
      const end = new Date(start.getTime() + input.slotMinutes * 60_000)
      const blocked =
        overlaps(start.getTime(), end.getTime(), input.booked) ||
        overlaps(start.getTime(), end.getTime(), input.timeOff)
      slots.push({
        startsAt: start.toISOString(),
        durationMinutes: input.slotMinutes,
        available: start.getTime() > input.now.getTime() && !blocked,
      })
    }
  }
  return slots
}
