import type { RowDataPacket } from 'mysql2/promise'
import type { Db } from '../../db/pool.js'
import { execute, pool, query, queryOne } from '../../db/pool.js'
import type { Discipline, MeetingChannel, Provider } from '../../domain.js'
import { parseJsonColumn } from '../../lib/json.js'

export interface ProviderRow extends RowDataPacket {
  id: string
  tenant_id: string
  first_name: string
  last_name: string
  avatar_url: string | null
  phone: string | null
  title: string | null
  bio: string | null
  credentials: unknown
  rating: number | null
  discipline: Discipline
  review_count: number
  session_rate_minor: number
  currency: Provider['sessionRate']['currency']
  channels: unknown
  timezone: string
  slot_minutes: number
  accepting_bookings: number
}

const SELECT = `
  SELECT u.id, u.tenant_id, u.first_name, u.last_name, u.avatar_url, u.phone, u.title, u.bio, u.credentials, u.rating,
         p.discipline, p.review_count, p.session_rate_minor, p.currency, p.channels, p.timezone, p.slot_minutes, p.accepting_bookings
  FROM providers p
  JOIN users u ON u.id = p.user_id`

export function toProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: `${row.first_name} ${row.last_name}`.trim(),
    avatarUrl: row.avatar_url,
    discipline: row.discipline,
    title: row.title ?? 'Coach',
    bio: row.bio ?? '',
    credentials: parseJsonColumn<string[]>(row.credentials, []),
    rating: Number(row.rating ?? 0),
    reviewCount: row.review_count,
    sessionRate: { amountMinor: row.session_rate_minor, currency: row.currency },
    channels: parseJsonColumn<MeetingChannel[]>(row.channels, []),
    timezone: row.timezone,
  }
}

export async function listProviderRows(filter: { discipline?: Discipline | undefined }, db: Db = pool) {
  const clauses = ["u.status = 'active'", 'p.accepting_bookings = 1']
  const params: unknown[] = []
  if (filter.discipline) {
    clauses.push('p.discipline = ?')
    params.push(filter.discipline)
  }
  return query<ProviderRow>(`${SELECT} WHERE ${clauses.join(' AND ')} ORDER BY u.rating DESC, u.last_name`, params, db)
}

export async function findProviderRow(id: string, db: Db = pool) {
  return queryOne<ProviderRow>(`${SELECT} WHERE u.id = ? AND u.status = 'active'`, [id], db)
}

export interface HoursRow extends RowDataPacket {
  weekday: number
  start_minute: number
  end_minute: number
}

export async function listHours(providerId: string, db: Db = pool) {
  return query<HoursRow>(
    'SELECT weekday, start_minute, end_minute FROM provider_hours WHERE provider_id = ? ORDER BY weekday, start_minute',
    [providerId],
    db,
  )
}

export interface RangeRow extends RowDataPacket {
  starts_at: Date
  ends_at: Date
}

/** Live bookings overlapping [from, to) — cancelled and no-show rows free the slot. */
export async function listBookedRanges(providerId: string, from: Date, to: Date, db: Db = pool) {
  return query<RangeRow>(
    `SELECT starts_at, DATE_ADD(starts_at, INTERVAL duration_minutes MINUTE) AS ends_at
     FROM appointments
     WHERE provider_id = ? AND status IN ('pending','confirmed','completed') AND starts_at < ? AND DATE_ADD(starts_at, INTERVAL duration_minutes MINUTE) > ?`,
    [providerId, to, from],
    db,
  )
}

export async function listTimeOff(providerId: string, from: Date, to: Date, db: Db = pool) {
  return query<RangeRow>(
    'SELECT starts_at, ends_at FROM provider_time_off WHERE provider_id = ? AND starts_at < ? AND ends_at > ?',
    [providerId, to, from],
    db,
  )
}

export type NewProvider = {
  userId: string
  discipline: Discipline
  reviewCount?: number
  sessionRateMinor: number
  currency?: string
  channels: readonly MeetingChannel[]
  timezone?: string
  slotMinutes?: number
}

export async function insertProvider(p: NewProvider, db: Db = pool) {
  await execute(
    `INSERT INTO providers (user_id, discipline, review_count, session_rate_minor, currency, channels, timezone, slot_minutes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.userId,
      p.discipline,
      p.reviewCount ?? 0,
      p.sessionRateMinor,
      p.currency ?? 'USD',
      JSON.stringify(p.channels),
      p.timezone ?? 'America/New_York',
      p.slotMinutes ?? 60,
    ],
    db,
  )
}

export async function insertHours(
  providerId: string,
  rows: readonly { weekday: number; startMinute: number; endMinute: number }[],
  db: Db = pool,
) {
  for (const r of rows) {
    await execute(
      'INSERT INTO provider_hours (provider_id, weekday, start_minute, end_minute) VALUES (?, ?, ?, ?)',
      [providerId, r.weekday, r.startMinute, r.endMinute],
      db,
    )
  }
}
