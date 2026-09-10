import type { Timestamp } from 'firebase-admin/firestore'
import { col, db, docOf, runTransaction, Timestamp as Ts, toIso } from '../../db/firestore.js'
import type { Page, Post, PostBlock, PostStatus, Role } from '../../domain.js'
import { conflict } from '../../lib/errors.js'
import { logger } from '../../lib/logger.js'

/**
 * posts/{id}. The author and studio are denormalised onto the row so the
 * public feed is one query with no joins; a renamed studio is rare enough that
 * the stale name is acceptable until the post is next saved.
 */
export type PostDoc = {
  tenantId: string
  tenantName: string
  tenantSlug: string
  slug: string
  title: string
  excerpt: string
  coverImageUrl: string | null
  tags: string[]
  /** Lower-cased copy of `tags` for the array-contains filter. */
  tagsLower: string[]
  blocks: PostBlock[]
  authorId: string
  authorName: string
  authorRole: Role
  authorTitle: string | null
  authorAvatarUrl: string | null
  status: PostStatus
  publishedAt: Timestamp | null
  createdAt: Timestamp
  updatedAt: Timestamp
  readingMinutes: number
}
export type PostRow = PostDoc & { id: string }

const posts = () => db.collection(col.posts)
const slugs = () => db.collection(col.postSlugs)

export const toPost = (r: PostRow): Post => ({
  id: r.id,
  tenantId: r.tenantId,
  tenantName: r.tenantName,
  tenantSlug: r.tenantSlug,
  slug: r.slug,
  title: r.title,
  excerpt: r.excerpt,
  coverImageUrl: r.coverImageUrl,
  tags: r.tags,
  blocks: r.blocks,
  authorId: r.authorId,
  authorName: r.authorName,
  authorRole: r.authorRole,
  ...(r.authorTitle ? { authorTitle: r.authorTitle } : {}),
  authorAvatarUrl: r.authorAvatarUrl,
  status: r.status,
  publishedAt: toIso(r.publishedAt) ?? null,
  createdAt: r.createdAt.toDate().toISOString(),
  updatedAt: r.updatedAt.toDate().toISOString(),
  readingMinutes: r.readingMinutes,
})

// ---- Reading time (mirrors src/domain/content/model.ts) ----------------------

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

export function readingMinutes(blocks: readonly PostBlock[]): number {
  let words = 0
  let media = 0
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        words += countWords(block.text)
        break
      case 'list':
        for (const item of block.items) words += countWords(item)
        break
      case 'image':
      case 'video':
        words += countWords(block.caption ?? '')
        media++
        break
    }
  }
  return Math.max(1, Math.round((words + media * 30) / 200))
}

// ---- Reads -------------------------------------------------------------------

/**
 * Firestore refuses an ordered, filtered query until its composite index
 * exists. GoDaddy and Vercel deploy the code but not `firestore.indexes.json`,
 * so rather than 500 the feed until someone runs
 * `firebase deploy --only firestore:indexes`, fetch the filtered set unordered
 * and sort here. Slower on a big blog, correct on every host.
 *
 * The error's numeric code depends on the transport: gRPC reports
 * FAILED_PRECONDITION (9), the REST transport GoDaddy uses maps the HTTP 400
 * to INVALID_ARGUMENT (3). The message is the same on both, so match on it.
 */
const isMissingIndex = (err: unknown) => {
  if (typeof err !== 'object' || err === null) return false
  const { code, message } = err as { code?: number; message?: string }
  return code === 9 || /requires an index/i.test(message ?? '')
}

let warnedMissingIndex = false

export async function rowsOrdered(
  filtered: FirebaseFirestore.Query,
  orderField: 'publishedAt' | 'updatedAt',
  page?: { offset: number; limit: number },
): Promise<{ rows: PostRow[]; total: number | null }> {
  const ordered = filtered.orderBy(orderField, 'desc')
  try {
    if (page) {
      const [total, snap] = await Promise.all([ordered.count().get(), ordered.offset(page.offset).limit(page.limit).get()])
      return { rows: snap.docs.map((d) => docOf<PostDoc>(d)!), total: total.data().count }
    }
    const snap = await ordered.get()
    return { rows: snap.docs.map((d) => docOf<PostDoc>(d)!), total: snap.size }
  } catch (err) {
    if (!isMissingIndex(err)) throw err
    if (!warnedMissingIndex) {
      warnedMissingIndex = true
      logger.warn('posts: composite index missing — sorting in memory. Run `firebase deploy --only firestore:indexes`.')
    }
    const rows = (await filtered.get()).docs
      .map((d) => docOf<PostDoc>(d)!)
      .sort((a, b) => (b[orderField]?.toMillis() ?? 0) - (a[orderField]?.toMillis() ?? 0) || a.id.localeCompare(b.id))
    return page
      ? { rows: rows.slice(page.offset, page.offset + page.limit), total: rows.length }
      : { rows, total: rows.length }
  }
}

export type PublicFilter = {
  tenantSlug?: string | undefined
  authorId?: string | undefined
  tag?: string | undefined
  query?: string | undefined
  page: number
  pageSize: number
}

/** Every human-readable string in the body, for search. */
function blockText(blocks: readonly PostBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
        parts.push(block.text)
        break
      case 'quote':
        parts.push(block.text, block.attribution ?? '')
        break
      case 'list':
        parts.push(...block.items)
        break
      case 'image':
        parts.push(block.alt, block.caption ?? '')
        break
      case 'video':
        parts.push(block.caption ?? '')
        break
    }
  }
  return parts.join(' ')
}

/** Title, summary, tags and the article body itself. */
const matchesQuery = (row: PostRow, needle: string) =>
  row.title.toLowerCase().includes(needle) ||
  row.excerpt.toLowerCase().includes(needle) ||
  row.tagsLower.some((t) => t.includes(needle)) ||
  blockText(row.blocks).toLowerCase().includes(needle)

/** Published posts, newest first. Text search is in-memory over the filtered set. */
export async function listPublished(filter: PublicFilter): Promise<Page<Post>> {
  let q: FirebaseFirestore.Query = posts().where('status', '==', 'published')
  if (filter.tenantSlug) q = q.where('tenantSlug', '==', filter.tenantSlug.trim().toLowerCase())
  if (filter.authorId) q = q.where('authorId', '==', filter.authorId)
  if (filter.tag) q = q.where('tagsLower', 'array-contains', filter.tag.trim().toLowerCase())

  const offset = (filter.page - 1) * filter.pageSize

  if (filter.query) {
    const needle = filter.query.trim().toLowerCase()
    const rows = (await rowsOrdered(q, 'publishedAt')).rows.filter((r) => matchesQuery(r, needle))
    return {
      items: rows.slice(offset, offset + filter.pageSize).map(toPost),
      total: rows.length,
      page: filter.page,
      pageSize: filter.pageSize,
    }
  }

  const { rows, total } = await rowsOrdered(q, 'publishedAt', { offset, limit: filter.pageSize })
  return { items: rows.map(toPost), total: total ?? rows.length, page: filter.page, pageSize: filter.pageSize }
}

export async function findPostRowBySlug(slug: string): Promise<PostRow | null> {
  const snap = await posts().where('slug', '==', slug.trim().toLowerCase()).limit(1).get()
  const doc = snap.docs[0]
  return doc ? docOf<PostDoc>(doc) : null
}

export async function findPostRowById(id: string): Promise<PostRow | null> {
  return docOf<PostDoc>(await posts().doc(id).get())
}

export async function findPostById(id: string): Promise<Post | null> {
  const row = await findPostRowById(id)
  return row ? toPost(row) : null
}

/** Everything a caller may manage, drafts included, most recently edited first. */
export async function listManaged(scope: { authorId?: string; tenantId?: string }): Promise<Post[]> {
  let q: FirebaseFirestore.Query = posts()
  if (scope.authorId) q = q.where('authorId', '==', scope.authorId)
  else if (scope.tenantId) q = q.where('tenantId', '==', scope.tenantId)
  return (await rowsOrdered(q, 'updatedAt')).rows.map(toPost)
}

// ---- Writes ------------------------------------------------------------------

export type NewPost = {
  id: string
  tenantId: string
  tenantName: string
  tenantSlug: string
  slug: string
  title: string
  excerpt: string
  coverImageUrl?: string | null
  tags?: string[]
  blocks: PostBlock[]
  authorId: string
  authorName: string
  authorRole: Role
  authorTitle?: string | null
  authorAvatarUrl?: string | null
  status?: PostStatus
  /** Seed only: back-date the post. */
  publishedAt?: Date | null
  createdAt?: Date
}

/** Creates the post and reserves its slug atomically. */
export async function insertPost(p: NewPost): Promise<void> {
  const now = Ts.now()
  const status = p.status ?? 'draft'
  const tags = p.tags ?? []
  const created = p.createdAt ? Ts.fromDate(p.createdAt) : now
  const published = p.publishedAt ? Ts.fromDate(p.publishedAt) : status === 'published' ? now : null
  const doc: PostDoc = {
    tenantId: p.tenantId,
    tenantName: p.tenantName,
    tenantSlug: p.tenantSlug,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt,
    coverImageUrl: p.coverImageUrl ?? null,
    tags,
    tagsLower: tags.map((t) => t.toLowerCase()),
    blocks: p.blocks,
    authorId: p.authorId,
    authorName: p.authorName,
    authorRole: p.authorRole,
    authorTitle: p.authorTitle ?? null,
    authorAvatarUrl: p.authorAvatarUrl ?? null,
    status,
    publishedAt: published,
    createdAt: created,
    updatedAt: published ?? created,
    readingMinutes: readingMinutes(p.blocks),
  }
  await runTransaction(async (tx) => {
    if ((await tx.get(slugs().doc(p.slug))).exists) throw conflict('A post with that link already exists.', 'slug_taken')
    tx.create(slugs().doc(p.slug), { postId: p.id })
    tx.create(posts().doc(p.id), doc)
  })
}

export type PostPatch = Partial<{
  slug: string
  title: string
  excerpt: string
  coverImageUrl: string | null
  tags: string[]
  blocks: PostBlock[]
  status: PostStatus
}>

export async function updatePost(id: string, patch: PostPatch): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined)) as PostPatch
  if (Object.keys(clean).length === 0) return
  await runTransaction(async (tx) => {
    const ref = posts().doc(id)
    const current = docOf<PostDoc>(await tx.get(ref))
    if (!current) return
    if (clean.slug && clean.slug !== current.slug) {
      if ((await tx.get(slugs().doc(clean.slug))).exists) throw conflict('A post with that link already exists.', 'slug_taken')
      tx.delete(slugs().doc(current.slug))
      tx.create(slugs().doc(clean.slug), { postId: id })
    }
    const update: Partial<PostDoc> = { ...clean, updatedAt: Ts.now() }
    if (clean.tags) update.tagsLower = clean.tags.map((t) => t.toLowerCase())
    if (clean.blocks) update.readingMinutes = readingMinutes(clean.blocks)
    // First publish stamps the date; later unpublish/republish cycles keep it,
    // so the feed order does not jump every time a typo is fixed.
    if (clean.status === 'published' && !current.publishedAt) update.publishedAt = Ts.now()
    tx.update(ref, update)
  })
}

export async function deletePost(id: string): Promise<void> {
  await runTransaction(async (tx) => {
    const ref = posts().doc(id)
    const current = docOf<PostDoc>(await tx.get(ref))
    if (!current) return
    tx.delete(slugs().doc(current.slug))
    tx.delete(ref)
  })
}
