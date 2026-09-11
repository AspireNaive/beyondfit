import type { Timestamp } from 'firebase-admin/firestore'
import { col, db, docOf, isMissingIndexError, runTransaction, Timestamp as Ts } from '../../db/firestore.js'
import type { DietPlan, DietPlanMeal, DietPlanStatus, FoodEntry, FoodItem, FoodSource, Macros, MealType, Role } from '../../domain.js'
import { logger } from '../../lib/logger.js'

// ---- Food diary ----------------------------------------------------------------

export type FoodEntryDoc = {
  tenantId: string
  memberId: string
  date: string
  mealType: MealType
  loggedAt: Timestamp
  title: string
  items: FoodItem[]
  totals: Macros
  notes: string | null
  source: FoodSource
  thumbDataUrl: string | null
  hasPhoto: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
type FoodEntryRow = FoodEntryDoc & { id: string }

const entries = () => db.collection(col.foodEntries)
const photos = () => db.collection(col.foodPhotos)
const plans = () => db.collection(col.dietPlans)

export const sumMacros = (items: readonly Macros[]): Macros =>
  items.reduce(
    (t, i) => ({
      calories: t.calories + i.calories,
      proteinG: t.proteinG + i.proteinG,
      carbsG: t.carbsG + i.carbsG,
      fatG: t.fatG + i.fatG,
    }),
    { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 },
  )

const toEntry = (r: FoodEntryRow): FoodEntry => ({
  id: r.id,
  tenantId: r.tenantId,
  memberId: r.memberId,
  date: r.date,
  mealType: r.mealType,
  loggedAt: r.loggedAt.toDate().toISOString(),
  title: r.title,
  items: r.items,
  totals: r.totals,
  notes: r.notes,
  source: r.source,
  thumbDataUrl: r.thumbDataUrl,
  hasPhoto: r.hasPhoto,
  createdAt: r.createdAt.toDate().toISOString(),
  updatedAt: r.updatedAt.toDate().toISOString(),
})

let warnedIndex = false
const warnIndex = () => {
  if (warnedIndex) return
  warnedIndex = true
  logger.warn('nutrition: composite index missing — filtering in memory. Run `firebase deploy --only firestore:indexes`.')
}

/** A member's meals between two dates inclusive, newest first. */
export async function listFoodEntries(memberId: string, from: string, to: string): Promise<FoodEntry[]> {
  const base = entries().where('memberId', '==', memberId)
  let rows: FoodEntryRow[]
  try {
    const snap = await base.where('date', '>=', from).where('date', '<=', to).orderBy('date', 'desc').orderBy('loggedAt', 'desc').get()
    rows = snap.docs.map((d) => docOf<FoodEntryDoc>(d)!)
  } catch (err) {
    if (!isMissingIndexError(err)) throw err
    warnIndex()
    rows = (await base.get()).docs.map((d) => docOf<FoodEntryDoc>(d)!).filter((r) => r.date >= from && r.date <= to)
  }
  return rows
    .sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.toMillis() - a.loggedAt.toMillis())
    .map(toEntry)
}

export async function findFoodEntry(memberId: string, entryId: string): Promise<FoodEntry | null> {
  const row = docOf<FoodEntryDoc>(await entries().doc(entryId).get())
  return row && row.memberId === memberId ? toEntry(row) : null
}

export type NewFoodEntry = {
  id: string
  tenantId: string
  memberId: string
  date: string
  mealType: MealType
  loggedAt?: Date
  title: string
  items: FoodItem[]
  notes?: string | null
  source: FoodSource
  thumbDataUrl?: string | null
  /** Full-size photo (data URL), stored in its own document. */
  photoDataUrl?: string | null
}

export async function insertFoodEntry(e: NewFoodEntry): Promise<void> {
  const now = Ts.now()
  const doc: FoodEntryDoc = {
    tenantId: e.tenantId,
    memberId: e.memberId,
    date: e.date,
    mealType: e.mealType,
    loggedAt: e.loggedAt ? Ts.fromDate(e.loggedAt) : now,
    title: e.title,
    items: e.items,
    totals: sumMacros(e.items),
    notes: e.notes ?? null,
    source: e.source,
    thumbDataUrl: e.thumbDataUrl ?? null,
    hasPhoto: Boolean(e.photoDataUrl),
    createdAt: now,
    updatedAt: now,
  }
  const batch = db.batch()
  batch.create(entries().doc(e.id), doc)
  if (e.photoDataUrl) batch.create(photos().doc(e.id), { memberId: e.memberId, dataUrl: e.photoDataUrl, createdAt: now })
  await batch.commit()
}

export type FoodEntryPatch = Partial<Pick<NewFoodEntry, 'date' | 'mealType' | 'title' | 'items' | 'notes'>>

export async function updateFoodEntry(entryId: string, patch: FoodEntryPatch): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as FoodEntryPatch
  if (Object.keys(clean).length === 0) return
  const update: Partial<FoodEntryDoc> = { ...clean, updatedAt: Ts.now() }
  if (clean.items) update.totals = sumMacros(clean.items)
  await entries().doc(entryId).update(update)
}

export async function deleteFoodEntry(entryId: string): Promise<void> {
  const batch = db.batch()
  batch.delete(entries().doc(entryId))
  batch.delete(photos().doc(entryId))
  await batch.commit()
}

export async function findFoodPhoto(memberId: string, entryId: string): Promise<string | null> {
  const row = docOf<{ memberId: string; dataUrl: string }>(await photos().doc(entryId).get())
  return row && row.memberId === memberId ? row.dataUrl : null
}

/**
 * Calories and macros per day over a range — for the coach's overview. Reads
 * only `date` and `totals`, never the inline thumbnails, so a month of photo
 * meals costs kilobytes rather than megabytes.
 */
export async function dailyTotals(memberId: string, from: string, to: string): Promise<{ date: string; totals: Macros; meals: number }[]> {
  const base = entries().where('memberId', '==', memberId).select('date', 'totals')
  let rows: Pick<FoodEntryDoc, 'date' | 'totals'>[]
  try {
    rows = (await base.where('date', '>=', from).where('date', '<=', to).get()).docs.map((d) => d.data() as Pick<FoodEntryDoc, 'date' | 'totals'>)
  } catch (err) {
    if (!isMissingIndexError(err)) throw err
    warnIndex()
    rows = (await base.get()).docs.map((d) => d.data() as Pick<FoodEntryDoc, 'date' | 'totals'>).filter((r) => r.date >= from && r.date <= to)
  }
  const byDay = new Map<string, { totals: Macros; meals: number }>()
  for (const e of rows) {
    const day = byDay.get(e.date) ?? { totals: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }, meals: 0 }
    day.totals = sumMacros([day.totals, e.totals])
    day.meals++
    byDay.set(e.date, day)
  }
  return [...byDay.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => b.date.localeCompare(a.date))
}

// ---- Diet plans ------------------------------------------------------------------

export type DietPlanDoc = {
  tenantId: string
  memberId: string
  authorId: string
  authorName: string
  authorRole: Role
  title: string
  summary: string
  targets: Macros
  meals: DietPlanMeal[]
  guidelines: string[]
  status: DietPlanStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}
type DietPlanRow = DietPlanDoc & { id: string }

const toPlan = (r: DietPlanRow): DietPlan => ({
  id: r.id,
  tenantId: r.tenantId,
  memberId: r.memberId,
  authorId: r.authorId,
  authorName: r.authorName,
  authorRole: r.authorRole,
  title: r.title,
  summary: r.summary,
  targets: r.targets,
  meals: r.meals,
  guidelines: r.guidelines,
  status: r.status,
  createdAt: r.createdAt.toDate().toISOString(),
  updatedAt: r.updatedAt.toDate().toISOString(),
})

/** Active plan first, then newest first by creation (archiving stamps updatedAt, so it cannot order history). */
async function planRows(memberId: string): Promise<DietPlanRow[]> {
  const snap = await plans().where('memberId', '==', memberId).get()
  return snap.docs
    .map((d) => docOf<DietPlanDoc>(d)!)
    .sort((a, b) => Number(b.status === 'active') - Number(a.status === 'active') || b.createdAt.toMillis() - a.createdAt.toMillis() || a.id.localeCompare(b.id))
}

/** The member's current plan, or null. */
export async function findActiveDietPlan(memberId: string): Promise<DietPlan | null> {
  const row = (await planRows(memberId)).find((r) => r.status === 'active')
  return row ? toPlan(row) : null
}

/** Every plan the member has had, newest first — the active one first. */
export async function listDietPlans(memberId: string): Promise<DietPlan[]> {
  return (await planRows(memberId)).map(toPlan)
}

export type NewDietPlan = {
  id: string
  tenantId: string
  memberId: string
  authorId: string
  authorName: string
  authorRole: Role
  title: string
  summary: string
  targets: Macros
  meals: DietPlanMeal[]
  guidelines: string[]
  createdAt?: Date
}

/** Saves a plan and archives whatever was active before it, atomically. */
export async function replaceDietPlan(p: NewDietPlan): Promise<void> {
  const now = Ts.now()
  const doc: DietPlanDoc = {
    tenantId: p.tenantId,
    memberId: p.memberId,
    authorId: p.authorId,
    authorName: p.authorName,
    authorRole: p.authorRole,
    title: p.title,
    summary: p.summary,
    targets: p.targets,
    meals: p.meals,
    guidelines: p.guidelines,
    status: 'active',
    createdAt: p.createdAt ? Ts.fromDate(p.createdAt) : now,
    updatedAt: now,
  }
  await runTransaction(async (tx) => {
    const active = await tx.get(plans().where('memberId', '==', p.memberId).where('status', '==', 'active'))
    for (const d of active.docs) tx.update(d.ref, { status: 'archived', updatedAt: now })
    tx.create(plans().doc(p.id), doc)
  })
}
