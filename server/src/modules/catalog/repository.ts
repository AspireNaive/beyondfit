import type { Timestamp } from 'firebase-admin/firestore'
import { chunk, col, db, docOf, runTransaction, Timestamp as Ts, type Tx } from '../../db/firestore.js'
import type { Product, ProductCategory } from '../../domain.js'
import { conflict } from '../../lib/errors.js'

export type ProductDoc = {
  tenantId: string | null
  slug: string
  name: string
  tagline: string
  description: string
  category: ProductCategory
  priceMinor: number
  currency: Product['price']['currency']
  compareAtMinor: number | null
  imageUrl: string | null
  accent: string
  rating: number
  reviewCount: number
  inStock: boolean
  badge: string | null
  digital: boolean
  instructorId: string | null
  active: boolean
  createdAt: Timestamp
  updatedAt: Timestamp
}
export type ProductRow = ProductDoc & { id: string }

const products = () => db.collection(col.products)
const slugs = () => db.collection(col.productSlugs)

export const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  description: r.description,
  category: r.category,
  price: { amountMinor: r.priceMinor, currency: r.currency },
  ...(r.compareAtMinor != null ? { compareAtPrice: { amountMinor: r.compareAtMinor, currency: r.currency } } : {}),
  ...(r.imageUrl ? { imageUrl: r.imageUrl } : {}),
  accent: r.accent,
  rating: r.rating,
  reviewCount: r.reviewCount,
  inStock: r.inStock,
  ...(r.badge ? { badge: r.badge } : {}),
  digital: r.digital,
  ...(r.instructorId ? { instructorId: r.instructorId } : {}),
})

const byCreated = (a: ProductRow, b: ProductRow) => a.createdAt.toMillis() - b.createdAt.toMillis() || a.id.localeCompare(b.id)

export async function listProducts(filter: {
  category?: ProductCategory | undefined
  query?: string | undefined
  includeInactive?: boolean
}): Promise<Product[]> {
  let q: FirebaseFirestore.Query = products()
  if (!filter.includeInactive) q = q.where('active', '==', true)
  if (filter.category) q = q.where('category', '==', filter.category)
  let rows = (await q.get()).docs.map((d) => docOf<ProductDoc>(d)!)
  if (filter.query) {
    const needle = filter.query.toLowerCase()
    rows = rows.filter((p) => p.name.toLowerCase().includes(needle) || p.tagline.toLowerCase().includes(needle))
  }
  return rows.sort(byCreated).map(toProduct)
}

export async function findProductBySlug(slug: string): Promise<Product | null> {
  const snap = await products().where('slug', '==', slug).where('active', '==', true).limit(1).get()
  const doc = snap.docs[0]
  return doc ? toProduct(docOf<ProductDoc>(doc)!) : null
}

export async function findProductById(id: string): Promise<Product | null> {
  const row = docOf<ProductDoc>(await products().doc(id).get())
  return row ? toProduct(row) : null
}

/** Active products for the given ids, in one round trip per 100 ids. */
export async function findProductRowsByIds(ids: readonly string[], tx?: Tx): Promise<ProductRow[]> {
  if (ids.length === 0) return []
  const rows: ProductRow[] = []
  for (const part of chunk(ids, 100)) {
    const refs = part.map((id) => products().doc(id))
    const snaps = tx ? await tx.getAll(...refs) : await db.getAll(...refs)
    for (const s of snaps) {
      const row = docOf<ProductDoc>(s)
      if (row?.active) rows.push(row)
    }
  }
  return rows
}

export type NewProduct = {
  id: string
  tenantId?: string | null
  slug: string
  name: string
  tagline?: string
  description: string
  category: ProductCategory
  priceMinor: number
  currency?: string
  compareAtMinor?: number | null
  imageUrl?: string | null
  accent?: string
  rating?: number
  reviewCount?: number
  inStock?: boolean
  badge?: string | null
  digital?: boolean
  instructorId?: string | null
}

/** Creates the product and reserves its slug atomically. */
export async function insertProduct(p: NewProduct): Promise<void> {
  const now = Ts.now()
  const doc: ProductDoc = {
    tenantId: p.tenantId ?? null,
    slug: p.slug,
    name: p.name,
    tagline: p.tagline ?? '',
    description: p.description,
    category: p.category,
    priceMinor: p.priceMinor,
    currency: (p.currency ?? 'USD') as ProductDoc['currency'],
    compareAtMinor: p.compareAtMinor ?? null,
    imageUrl: p.imageUrl ?? null,
    accent: p.accent ?? '#b6ef21',
    rating: p.rating ?? 0,
    reviewCount: p.reviewCount ?? 0,
    inStock: p.inStock !== false,
    badge: p.badge ?? null,
    digital: p.digital ?? false,
    instructorId: p.instructorId ?? null,
    active: true,
    createdAt: now,
    updatedAt: now,
  }
  await runTransaction(async (tx) => {
    if ((await tx.get(slugs().doc(p.slug))).exists) throw conflict('A product with that slug already exists.')
    tx.create(slugs().doc(p.slug), { productId: p.id })
    tx.create(products().doc(p.id), doc)
  })
}

export type ProductPatch = Partial<Omit<NewProduct, 'id'>> & { active?: boolean }

export async function updateProduct(id: string, patch: ProductPatch): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  if (Object.keys(clean).length === 0) return
  await runTransaction(async (tx) => {
    const ref = products().doc(id)
    const current = docOf<ProductDoc>(await tx.get(ref))
    if (!current) return
    const nextSlug = typeof clean.slug === 'string' ? clean.slug : null
    if (nextSlug && nextSlug !== current.slug) {
      if ((await tx.get(slugs().doc(nextSlug))).exists) throw conflict('A product with that slug already exists.')
      tx.delete(slugs().doc(current.slug))
      tx.create(slugs().doc(nextSlug), { productId: id })
    }
    tx.update(ref, { ...clean, updatedAt: Ts.now() })
  })
}
