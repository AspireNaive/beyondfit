import { addDays } from 'date-fns'
import type { AvailabilitySlot, Discipline, Provider } from '../../domain.js'
import { badRequest } from '../../lib/errors.js'
import { dateIn, slotsForDay, type Range } from './availability.js'
import {
  findProviderRow,
  listBookedRanges,
  listHours,
  listProviderRows,
  listTimeOff,
  toProvider,
  type ProviderRow,
} from './repository.js'

const toRanges = (rows: readonly { starts_at: Date; ends_at: Date }[]): Range[] =>
  rows.map((r) => ({ start: r.starts_at.getTime(), end: r.ends_at.getTime() }))

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/

/** Slots for one provider on one calendar day (the provider's own timezone). */
export async function availabilityFor(row: ProviderRow, date: string, now = new Date()): Promise<AvailabilitySlot[]> {
  if (!DATE_RE.test(date) || Number.isNaN(Date.parse(date))) throw badRequest('date must be YYYY-MM-DD.')
  const dayStart = new Date(Date.parse(`${date}T00:00:00Z`) - 24 * 3_600_000)
  const dayEnd = new Date(Date.parse(`${date}T00:00:00Z`) + 48 * 3_600_000)
  const [hours, booked, timeOff] = await Promise.all([
    listHours(row.id),
    listBookedRanges(row.id, dayStart, dayEnd),
    listTimeOff(row.id, dayStart, dayEnd),
  ])
  return slotsForDay({
    date,
    timezone: row.timezone,
    slotMinutes: row.slot_minutes,
    hours: hours.map((h) => ({ weekday: h.weekday, startMinute: h.start_minute, endMinute: h.end_minute })),
    booked: toRanges(booked),
    timeOff: toRanges(timeOff),
    now,
  })
}

const LOOKAHEAD_DAYS = 14

/** First day within two weeks that still has a free slot. */
async function nextAvailable(row: ProviderRow, now: Date): Promise<string | undefined> {
  const hours = await listHours(row.id)
  if (hours.length === 0) return undefined
  const from = new Date(now.getTime() - 24 * 3_600_000)
  const to = addDays(now, LOOKAHEAD_DAYS + 1)
  const [booked, timeOff] = await Promise.all([listBookedRanges(row.id, from, to), listTimeOff(row.id, from, to)])
  const mapped = hours.map((h) => ({ weekday: h.weekday, startMinute: h.start_minute, endMinute: h.end_minute }))
  for (let offset = 0; offset <= LOOKAHEAD_DAYS; offset++) {
    const date = dateIn(addDays(now, offset), row.timezone)
    const slots = slotsForDay({
      date,
      timezone: row.timezone,
      slotMinutes: row.slot_minutes,
      hours: mapped,
      booked: toRanges(booked),
      timeOff: toRanges(timeOff),
      now,
    })
    if (slots.some((s) => s.available)) return date
  }
  return undefined
}

async function decorate(row: ProviderRow, now: Date): Promise<Provider> {
  const next = await nextAvailable(row, now)
  return { ...toProvider(row), ...(next ? { nextAvailable: next } : {}) }
}

export async function listProviders(
  filter: { discipline?: Discipline | undefined; query?: string | undefined },
  now = new Date(),
): Promise<Provider[]> {
  let rows = await listProviderRows({ discipline: filter.discipline })
  if (filter.query) {
    const q = filter.query.toLowerCase()
    rows = rows.filter((r) => {
      const p = toProvider(r)
      return (
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.credentials.some((c) => c.toLowerCase().includes(q))
      )
    })
  }
  return Promise.all(rows.map((r) => decorate(r, now)))
}

export async function getProvider(id: string, now = new Date()): Promise<Provider | null> {
  const row = await findProviderRow(id)
  return row ? decorate(row, now) : null
}

export async function getAvailability(id: string, date: string, now = new Date()): Promise<AvailabilitySlot[]> {
  const row = await findProviderRow(id)
  if (!row) return []
  return availabilityFor(row, date, now)
}
