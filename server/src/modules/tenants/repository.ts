import type { RowDataPacket } from 'mysql2/promise'
import type { Db } from '../../db/pool.js'
import { execute, pool, query, queryOne } from '../../db/pool.js'
import type { Tenant, TenantPlan } from '../../domain.js'

interface TenantRow extends RowDataPacket {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  seats: number
  primary_color: string | null
  created_at: Date
  seats_used: number
}

/** seats_used is live: active members in the tenant. */
const SELECT = `
  SELECT t.id, t.name, t.slug, t.plan, t.seats, t.primary_color, t.created_at,
         (SELECT COUNT(*) FROM users u WHERE u.tenant_id = t.id AND u.role = 'member' AND u.status = 'active') AS seats_used
  FROM tenants t`

const toTenant = (row: TenantRow): Tenant => ({
  id: row.id,
  name: row.name,
  slug: row.slug,
  plan: row.plan,
  seats: row.seats,
  seatsUsed: Number(row.seats_used),
  createdAt: row.created_at.toISOString().slice(0, 10),
  ...(row.primary_color ? { primaryColor: row.primary_color } : {}),
})

export async function findTenantById(id: string, db: Db = pool): Promise<Tenant | null> {
  const row = await queryOne<TenantRow>(`${SELECT} WHERE t.id = ?`, [id], db)
  return row ? toTenant(row) : null
}

export async function findTenantBySlug(slug: string, db: Db = pool): Promise<Tenant | null> {
  const row = await queryOne<TenantRow>(`${SELECT} WHERE t.slug = ?`, [slug.trim().toLowerCase()], db)
  return row ? toTenant(row) : null
}

/** The flagged default studio (falling back to the oldest) for sign-ups that name none. */
export async function findDefaultTenant(db: Db = pool): Promise<Tenant | null> {
  const row = await queryOne<TenantRow>(`${SELECT} ORDER BY t.is_default DESC, t.created_at, t.id LIMIT 1`, [], db)
  return row ? toTenant(row) : null
}

export async function listTenants(db: Db = pool): Promise<Tenant[]> {
  const rows = await query<TenantRow>(`${SELECT} ORDER BY t.created_at, t.name`, [], db)
  return rows.map(toTenant)
}

export async function insertTenant(
  t: { id: string; name: string; slug: string; plan: TenantPlan; seats: number; primaryColor?: string | null; isDefault?: boolean; createdAt?: string },
  db: Db = pool,
) {
  await execute(
    `INSERT INTO tenants (id, name, slug, plan, seats, primary_color, is_default${t.createdAt ? ', created_at' : ''})
     VALUES (?, ?, ?, ?, ?, ?, ?${t.createdAt ? ', ?' : ''})`,
    [t.id, t.name, t.slug.toLowerCase(), t.plan, t.seats, t.primaryColor ?? null, t.isDefault ? 1 : 0, ...(t.createdAt ? [t.createdAt] : [])],
    db,
  )
}

export async function updateTenant(
  id: string,
  patch: Partial<{ name: string; plan: TenantPlan; seats: number; primaryColor: string | null }>,
  db: Db = pool,
) {
  const map = { name: 'name', plan: 'plan', seats: 'seats', primaryColor: 'primary_color' } as const
  const sets: string[] = []
  const params: unknown[] = []
  for (const [key, value] of Object.entries(patch) as [keyof typeof map, unknown][]) {
    if (value === undefined) continue
    sets.push(`${map[key]} = ?`)
    params.push(value)
  }
  if (!sets.length) return
  params.push(id)
  await execute(`UPDATE tenants SET ${sets.join(', ')} WHERE id = ?`, params, db)
}
