import type { Timestamp } from 'firebase-admin/firestore'
import { col, db, docOf, Timestamp as Ts } from '../../db/firestore.js'
import type { Tenant, TenantNutritionSettings, TenantPlan } from '../../domain.js'
import { countActiveMembers } from '../users/repository.js'

type TenantDoc = {
  name: string
  slug: string
  plan: TenantPlan
  seats: number
  primaryColor: string | null
  /** Sign-ups that name no studio land on the flagged tenant. */
  isDefault: boolean
  /** Absent on studios created before nutrition existed — read as platform defaults. */
  nutrition?: TenantNutritionSettings
  createdAt: Timestamp
  updatedAt: Timestamp
}
type TenantRow = TenantDoc & { id: string }

const tenants = () => db.collection(col.tenants)

async function toTenant(row: TenantRow): Promise<Tenant> {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    plan: row.plan,
    seats: row.seats,
    seatsUsed: await countActiveMembers(row.id),
    createdAt: row.createdAt.toDate().toISOString().slice(0, 10),
    ...(row.primaryColor ? { primaryColor: row.primaryColor } : {}),
    nutrition: { model: row.nutrition?.model ?? null, dailyPhotoLimit: row.nutrition?.dailyPhotoLimit ?? null },
  }
}

export async function findTenantById(id: string): Promise<Tenant | null> {
  const row = docOf<TenantDoc>(await tenants().doc(id).get())
  return row ? toTenant(row) : null
}

export async function findTenantBySlug(slug: string): Promise<Tenant | null> {
  const snap = await tenants().where('slug', '==', slug.trim().toLowerCase()).limit(1).get()
  const doc = snap.docs[0]
  return doc ? toTenant(docOf<TenantDoc>(doc)!) : null
}

/** The flagged default studio, falling back to the oldest one. */
export async function findDefaultTenant(): Promise<Tenant | null> {
  const flagged = await tenants().where('isDefault', '==', true).limit(1).get()
  const first = flagged.docs[0]
  if (first) return toTenant(docOf<TenantDoc>(first)!)
  const oldest = await tenants().orderBy('createdAt').limit(1).get()
  const doc = oldest.docs[0]
  return doc ? toTenant(docOf<TenantDoc>(doc)!) : null
}

export async function listTenants(): Promise<Tenant[]> {
  const snap = await tenants().orderBy('createdAt').get()
  return Promise.all(snap.docs.map((d) => toTenant(docOf<TenantDoc>(d)!)))
}

export async function insertTenant(t: {
  id: string
  name: string
  slug: string
  plan: TenantPlan
  seats: number
  primaryColor?: string | null
  isDefault?: boolean
  createdAt?: string
}): Promise<void> {
  const created = t.createdAt ? Ts.fromDate(new Date(`${t.createdAt}T00:00:00Z`)) : Ts.now()
  const doc: TenantDoc = {
    name: t.name,
    slug: t.slug.toLowerCase(),
    plan: t.plan,
    seats: t.seats,
    primaryColor: t.primaryColor ?? null,
    isDefault: t.isDefault ?? false,
    createdAt: created,
    updatedAt: Ts.now(),
  }
  await tenants().doc(t.id).create(doc)
}

export type TenantPatch = Partial<{
  name: string
  plan: TenantPlan
  seats: number
  primaryColor: string | null
  nutrition: Partial<TenantNutritionSettings>
}>

export async function updateTenant(id: string, patch: TenantPatch): Promise<void> {
  const { nutrition, ...rest } = patch
  const clean: Record<string, unknown> = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined))
  // Nutrition settings merge field by field so a studio can set the cap without touching the model.
  if (nutrition) {
    if (nutrition.model !== undefined) clean['nutrition.model'] = nutrition.model
    if (nutrition.dailyPhotoLimit !== undefined) clean['nutrition.dailyPhotoLimit'] = nutrition.dailyPhotoLimit
  }
  if (Object.keys(clean).length === 0) return
  await tenants().doc(id).update({ ...clean, updatedAt: Ts.now() })
}
