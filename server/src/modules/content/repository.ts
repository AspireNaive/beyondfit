import type { Timestamp } from 'firebase-admin/firestore'
import { col, db, docOf, runTransaction, Timestamp as Ts, toIso } from '../../db/firestore.js'
import type { Page, Post, PostBlock, PostStatus, Role } from '../../domain.js'
import { conflict } from '../../lib/errors.js'

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

export type PublicFilter = {
  tenantSlug?: string | undefined
  tag?: string | undefined
  query?: string | undefined
  page: number
  pageSize: number
}

const matchesQuery = (row: PostRow, needle: string) =>
  row.title.toLowerCase().includes(needle) ||
  row.excerpt.toLowerCase().includes(needle) ||
  row.tagsLower.some((t) => t.includes(needle))

/** Published posts, newest first. Text search is in-memory over the filtered set. */
export async function listPublished(filter: PublicFilter): Promise<Page<Post>> {
  let q: FirebaseFirestore.Query = posts().where('status', '==', 'published')
  if (filter.tenantSlug) q = q.where('tenantSlug', '==', filter.tenantSlug.trim().toLowerCase())
  if (filter.tag) q = q.where('tagsLower', 'array-contains', filter.tag.trim().toLowerCase())
  q = q.orderBy('publishedAt', 'desc')

  const offset = (filter.page - 1) * filter.pageSize

  if (filter.query) {
    const needle = filter.query.trim().toLowerCase()
    const rows = (await q.get()).docs.map((d) => docOf<PostDoc>(d)!).filter((r) => matchesQuery(r, needle))
    return {
      items: rows.slice(offset, offset + filter.pageSize).map(toPost),
      total: rows.length,
      page: filter.page,
      pageSize: filter.pageSize,
    }
  }

  const [total, snap] = await Promise.all([q.count().get(), q.offset(offset).limit(filter.pageSize).get()])
  return {
    items: snap.docs.map((d) => toPost(docOf<PostDoc>(d)!)),
    total: total.data().count,
    page: filter.page,
    pageSize: filter.pageSize,
  }
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
  q = q.orderBy('updatedAt', 'desc')
  return (await q.get()).docs.map((d) => toPost(docOf<PostDoc>(d)!))
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
