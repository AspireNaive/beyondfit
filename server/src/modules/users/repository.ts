import type { RowDataPacket } from 'mysql2/promise'
import type { Db } from '../../db/pool.js'
import { execute, pool, query, queryOne } from '../../db/pool.js'
import type { Role, UserProfile, UserStatus } from '../../domain.js'
import { parseJsonColumn } from '../../lib/json.js'

export interface UserRow extends RowDataPacket {
  id: string
  tenant_id: string
  role: Role
  first_name: string
  last_name: string
  email: string
  password_hash: string
  phone: string | null
  avatar_url: string | null
  title: string | null
  bio: string | null
  location: string | null
  joined_at: string
  specialties: unknown
  credentials: unknown
  rating: number | null
  sessions_delivered: number | null
  assigned_coach_id: string | null
  status: UserStatus
}

const COLUMNS =
  'id, tenant_id, role, first_name, last_name, email, password_hash, phone, avatar_url, title, bio, location, joined_at, specialties, credentials, rating, sessions_delivered, assigned_coach_id, status'

/** Strips the password hash and renames columns to the API shape. */
export function toUserProfile(row: UserRow): UserProfile {
  const specialties = parseJsonColumn<string[] | null>(row.specialties, null)
  const credentials = parseJsonColumn<string[] | null>(row.credentials, null)
  return {
    id: row.id,
    tenantId: row.tenant_id,
    role: row.role,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    ...(row.phone ? { phone: row.phone } : {}),
    avatarUrl: row.avatar_url,
    ...(row.title ? { title: row.title } : {}),
    ...(row.bio ? { bio: row.bio } : {}),
    ...(row.location ? { location: row.location } : {}),
    joinedAt: row.joined_at,
    ...(specialties ? { specialties } : {}),
    ...(credentials ? { credentials } : {}),
    ...(row.rating != null ? { rating: Number(row.rating) } : {}),
    ...(row.sessions_delivered != null ? { sessionsDelivered: row.sessions_delivered } : {}),
    assignedCoachId: row.assigned_coach_id,
    status: row.status,
  }
}

export const fullName = (u: { firstName: string; lastName: string }) =>
  `${u.firstName} ${u.lastName}`.trim()

export async function findUserById(id: string, db: Db = pool): Promise<UserProfile | null> {
  const row = await queryOne<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = ?`, [id], db)
  return row ? toUserProfile(row) : null
}

export async function findUserRowByEmail(email: string, db: Db = pool): Promise<UserRow | null> {
  return queryOne<UserRow>(`SELECT ${COLUMNS} FROM users WHERE email = ?`, [email.trim().toLowerCase()], db)
}

export async function findUserRowById(id: string, db: Db = pool): Promise<UserRow | null> {
  return queryOne<UserRow>(`SELECT ${COLUMNS} FROM users WHERE id = ?`, [id], db)
}

export async function listUsers(
  where: { tenantId?: string; role?: Role; assignedCoachId?: string; ids?: readonly string[] },
  db: Db = pool,
): Promise<UserProfile[]> {
  const clauses: string[] = []
  const params: unknown[] = []
  if (where.tenantId) {
    clauses.push('tenant_id = ?')
    params.push(where.tenantId)
  }
  if (where.role) {
    clauses.push('role = ?')
    params.push(where.role)
  }
  if (where.assignedCoachId) {
    clauses.push('assigned_coach_id = ?')
    params.push(where.assignedCoachId)
  }
  if (where.ids) {
    if (where.ids.length === 0) return []
    clauses.push(`id IN (${where.ids.map(() => '?').join(',')})`)
    params.push(...where.ids)
  }
  const sql = `SELECT ${COLUMNS} FROM users${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY role, last_name, first_name`
  const rows = await query<UserRow>(sql, params, db)
  return rows.map(toUserProfile)
}

export type NewUser = {
  id: string
  tenantId: string
  role: Role
  firstName: string
  lastName: string
  email: string
  passwordHash: string
  phone?: string | null
  title?: string | null
  bio?: string | null
  location?: string | null
  joinedAt: string
  specialties?: readonly string[] | null
  credentials?: readonly string[] | null
  rating?: number | null
  sessionsDelivered?: number | null
  assignedCoachId?: string | null
  status?: UserStatus
}

export async function insertUser(u: NewUser, db: Db = pool): Promise<void> {
  await execute(
    `INSERT INTO users (id, tenant_id, role, first_name, last_name, email, password_hash, phone, title, bio, location,
       joined_at, specialties, credentials, rating, sessions_delivered, assigned_coach_id, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      u.id,
      u.tenantId,
      u.role,
      u.firstName,
      u.lastName,
      u.email.trim().toLowerCase(),
      u.passwordHash,
      u.phone ?? null,
      u.title ?? null,
      u.bio ?? null,
      u.location ?? null,
      u.joinedAt,
      u.specialties ? JSON.stringify(u.specialties) : null,
      u.credentials ? JSON.stringify(u.credentials) : null,
      u.rating ?? null,
      u.sessionsDelivered ?? null,
      u.assignedCoachId ?? null,
      u.status ?? 'active',
    ],
    db,
  )
}

export type UserPatch = Partial<{
  firstName: string
  lastName: string
  phone: string | null
  avatarUrl: string | null
  title: string | null
  bio: string | null
  location: string | null
  assignedCoachId: string | null
  status: UserStatus
  passwordHash: string
}>

const PATCH_COLUMNS: Record<keyof UserPatch, string> = {
  firstName: 'first_name',
  lastName: 'last_name',
  phone: 'phone',
  avatarUrl: 'avatar_url',
  title: 'title',
  bio: 'bio',
  location: 'location',
  assignedCoachId: 'assigned_coach_id',
  status: 'status',
  passwordHash: 'password_hash',
}

export async function updateUser(id: string, patch: UserPatch, db: Db = pool): Promise<void> {
  const sets: string[] = []
  const params: unknown[] = []
  for (const [key, value] of Object.entries(patch) as [keyof UserPatch, unknown][]) {
    if (value === undefined) continue
    sets.push(`${PATCH_COLUMNS[key]} = ?`)
    params.push(value)
  }
  if (sets.length === 0) return
  params.push(id)
  await execute(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, params, db)
}

/** The coach new members are assigned to: the tenant's longest-serving active coach. */
export async function findDefaultCoach(tenantId: string, db: Db = pool): Promise<string | null> {
  const row = await queryOne<RowDataPacket & { id: string }>(
    `SELECT id FROM users WHERE tenant_id = ? AND role = 'coach' AND status = 'active' ORDER BY joined_at, id LIMIT 1`,
    [tenantId],
    db,
  )
  return row?.id ?? null
}
