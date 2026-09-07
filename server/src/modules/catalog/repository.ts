import type { RowDataPacket } from 'mysql2/promise'
import type { Db } from '../../db/pool.js'
import { execute, pool, query, queryOne } from '../../db/pool.js'
import type { Product, ProductCategory } from '../../domain.js'

export interface ProductRow extends RowDataPacket {
  id: string
  tenant_id: string | null
  slug: string
  name: string
  tagline: string
  description: string
  category: ProductCategory
  price_minor: number
  currency: Product['price']['currency']
  compare_at_minor: number | null
  image_url: string | null
  accent: string
  rating: number
  review_count: number
  in_stock: number
  badge: string | null
  digital: number
  instructor_id: string | null
  active: number
}

const COLS = 'id, tenant_id, slug, name, tagline, description, category, price_minor, currency, compare_at_minor, image_url, accent, rating, review_count, in_stock, badge, digital, instructor_id, active'

export const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  slug: r.slug,
  name: r.name,
  tagline: r.tagline,
  description: r.description,
  category: r.category,
  price: { amountMinor: r.price_minor, currency: r.currency },
  ...(r.compare_at_minor != null ? { compareAtPrice: { amountMinor: r.compare_at_minor, currency: r.currency } } : {}),
  ...(r.image_url ? { imageUrl: r.image_url } : {}),
  accent: r.accent,
  rating: Number(r.rating),
  reviewCount: r.review_count,
  inStock: r.in_stock === 1,
  ...(r.badge ? { badge: r.badge } : {}),
  digital: r.digital === 1,
  ...(r.instructor_id ? { instructorId: r.instructor_id } : {}),
})

export async function listProducts(
  filter: { category?: ProductCategory | undefined; query?: string | undefined; includeInactive?: boolean },
  db: Db = pool,
): Promise<Product[]> {
  const clauses: string[] = filter.includeInactive ? [] : ['active = 1']
  const params: unknown[] = []
  if (filter.category) {
    clauses.push('category = ?')
    params.push(filter.category)
  }
  if (filter.query) {
    clauses.push('(name LIKE ? OR tagline LIKE ?)')
    const like = `%${filter.query.replace(/[%_]/g, '\\$&')}%`
    params.push(like, like)
  }
  const rows = await query<ProductRow>(
    `SELECT ${COLS} FROM products${clauses.length ? ` WHERE ${clauses.join(' AND ')}` : ''} ORDER BY created_at, id`,
    params,
    db,
  )
  return rows.map(toProduct)
}

export async function findProductBySlug(slug: string, db: Db = pool): Promise<Product | null> {
  const row = await queryOne<ProductRow>(`SELECT ${COLS} FROM products WHERE slug = ? AND active = 1`, [slug], db)
  return row ? toProduct(row) : null
}

export async function findProductRowsByIds(ids: readonly string[], db: Db = pool): Promise<ProductRow[]> {
  if (ids.length === 0) return []
  return query<ProductRow>(`SELECT ${COLS} FROM products WHERE id IN (${ids.map(() => '?').join(',')}) AND active = 1`, ids, db)
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

export async function insertProduct(p: NewProduct, db: Db = pool) {
  await execute(
    `INSERT INTO products (id, tenant_id, slug, name, tagline, description, category, price_minor, currency, compare_at_minor, image_url, accent, rating, review_count, in_stock, badge, digital, instructor_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      p.id, p.tenantId ?? null, p.slug, p.name, p.tagline ?? '', p.description, p.category, p.priceMinor, p.currency ?? 'USD',
      p.compareAtMinor ?? null, p.imageUrl ?? null, p.accent ?? '#b6ef21', p.rating ?? 0, p.reviewCount ?? 0,
      p.inStock === false ? 0 : 1, p.badge ?? null, p.digital ? 1 : 0, p.instructorId ?? null,
    ],
    db,
  )
}

export type ProductPatch = Partial<Omit<NewProduct, 'id'>> & { active?: boolean }

const PATCH_COLUMNS: Record<string, string> = {
  tenantId: 'tenant_id', slug: 'slug', name: 'name', tagline: 'tagline', description: 'description', category: 'category',
  priceMinor: 'price_minor', currency: 'currency', compareAtMinor: 'compare_at_minor', imageUrl: 'image_url', accent: 'accent',
  rating: 'rating', reviewCount: 'review_count', inStock: 'in_stock', badge: 'badge', digital: 'digital', instructorId: 'instructor_id', active: 'active',
}

export async function updateProduct(id: string, patch: ProductPatch, db: Db = pool) {
  const sets: string[] = []
  const params: unknown[] = []
  for (const [key, value] of Object.entries(patch)) {
    const column = PATCH_COLUMNS[key]
    if (!column || value === undefined) continue
    sets.push(`${column} = ?`)
    params.push(typeof value === 'boolean' ? (value ? 1 : 0) : value)
  }
  if (!sets.length) return
  params.push(id)
  await execute(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`, params, db)
}

export async function findProductById(id: string, db: Db = pool): Promise<Product | null> {
  const row = await queryOne<ProductRow>(`SELECT ${COLS} FROM products WHERE id = ?`, [id], db)
  return row ? toProduct(row) : null
}
