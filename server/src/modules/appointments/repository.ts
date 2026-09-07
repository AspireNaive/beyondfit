import type { RowDataPacket } from 'mysql2/promise'
import type { Db } from '../../db/pool.js'
import { execute, pool, query, queryOne } from '../../db/pool.js'
import type { Appointment, AppointmentStatus, Discipline, MeetingChannel, Role } from '../../domain.js'

export interface AppointmentRow extends RowDataPacket {
  id: string
  tenant_id: string
  member_id: string
  member_name: string
  provider_id: string
  provider_name: string
  discipline: Discipline
  channel: MeetingChannel
  starts_at: Date
  duration_minutes: number
  status: AppointmentStatus
  price_minor: number
  currency: Appointment['price']['currency']
  join_url: string | null
  notes: string | null
  member_goal: string | null
  created_at: Date
}

const SELECT = `
  SELECT a.id, a.tenant_id, a.member_id, CONCAT(m.first_name, ' ', m.last_name) AS member_name,
         a.provider_id, CONCAT(p.first_name, ' ', p.last_name) AS provider_name,
         a.discipline, a.channel, a.starts_at, a.duration_minutes, a.status, a.price_minor, a.currency,
         a.join_url, a.notes, a.member_goal, a.created_at
  FROM appointments a
  JOIN users m ON m.id = a.member_id
  JOIN users p ON p.id = a.provider_id`

export const toAppointment = (r: AppointmentRow): Appointment => ({
  id: r.id,
  memberId: r.member_id,
  memberName: r.member_name,
  providerId: r.provider_id,
  providerName: r.provider_name,
  discipline: r.discipline,
  channel: r.channel,
  startsAt: r.starts_at.toISOString(),
  durationMinutes: r.duration_minutes,
  status: r.status,
  price: { amountMinor: r.price_minor, currency: r.currency },
  ...(r.join_url ? { joinUrl: r.join_url } : {}),
  ...(r.notes ? { notes: r.notes } : {}),
  ...(r.member_goal ? { memberGoal: r.member_goal } : {}),
  createdAt: r.created_at.toISOString(),
})

export async function findAppointmentRow(id: string, db: Db = pool) {
  return queryOne<AppointmentRow>(`${SELECT} WHERE a.id = ?`, [id], db)
}

export async function listAppointmentRows(
  scope: { role: Role; userId: string; tenantId: string },
  db: Db = pool,
): Promise<AppointmentRow[]> {
  const where: Record<Role, [string, unknown[]]> = {
    member: ['a.member_id = ?', [scope.userId]],
    coach: ['a.provider_id = ?', [scope.userId]],
    admin: ['a.tenant_id = ?', [scope.tenantId]],
    app_manager: ['1 = 1', []],
  }
  const [clause, params] = where[scope.role]
  return query<AppointmentRow>(`${SELECT} WHERE ${clause} ORDER BY a.starts_at`, params, db)
}

export type NewAppointment = {
  id: string
  tenantId: string
  memberId: string
  providerId: string
  discipline: Discipline
  channel: MeetingChannel
  startsAt: Date
  durationMinutes: number
  status: AppointmentStatus
  priceMinor: number
  currency: string
  joinUrl?: string | null
  notes?: string | null
  memberGoal?: string | null
  createdAt?: Date
}

export async function insertAppointment(a: NewAppointment, db: Db = pool) {
  const live = a.status !== 'cancelled' && a.status !== 'no_show'
  await execute(
    `INSERT INTO appointments (id, tenant_id, member_id, provider_id, discipline, channel, starts_at, duration_minutes, status,
       price_minor, currency, join_url, notes, member_goal, slot_key${a.createdAt ? ', created_at' : ''})
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?${a.createdAt ? ', ?' : ''})`,
    [
      a.id, a.tenantId, a.memberId, a.providerId, a.discipline, a.channel, a.startsAt, a.durationMinutes, a.status,
      a.priceMinor, a.currency, a.joinUrl ?? null, a.notes ?? null, a.memberGoal ?? null, live ? a.startsAt : null,
      ...(a.createdAt ? [a.createdAt] : []),
    ],
    db,
  )
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus, db: Db = pool) {
  const live = status !== 'cancelled' && status !== 'no_show'
  await execute(
    `UPDATE appointments
     SET status = ?, slot_key = ${live ? 'starts_at' : 'NULL'}, cancelled_at = ${status === 'cancelled' ? 'NOW(3)' : 'cancelled_at'}
     WHERE id = ?`,
    [status, id],
    db,
  )
}

/** Any live booking overlapping [start, end) for the provider — run inside the booking transaction. */
export async function findOverlap(providerId: string, start: Date, end: Date, db: Db) {
  return queryOne<RowDataPacket & { id: string }>(
    `SELECT id FROM appointments
     WHERE provider_id = ? AND status IN ('pending','confirmed','completed')
       AND starts_at < ? AND DATE_ADD(starts_at, INTERVAL duration_minutes MINUTE) > ?
     LIMIT 1 FOR UPDATE`,
    [providerId, end, start],
    db,
  )
}
