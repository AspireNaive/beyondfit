/**
 * Loads the demo blog posts into an existing database without touching
 * anything else — for a real Firestore project that already has studios and
 * people. Skips posts whose id or slug is already present, so it is safe to
 * re-run. Authors are matched by email to the demo accounts; when a demo
 * author does not exist, the post is attributed to the first coach (then the
 * first admin) of the default studio.
 *
 *   npm run db:seed:posts
 */
import { fileURLToPath } from 'node:url'
import { POSTS, USERS } from '@/infrastructure/mock/seed'
import type { PostBlock } from '../src/domain.js'
import { insertPost, findPostRowById, findPostRowBySlug } from '../src/modules/content/repository.js'
import { findDefaultTenant } from '../src/modules/tenants/repository.js'
import { findUserRowByEmail, listUsers } from '../src/modules/users/repository.js'

export async function seedPosts(): Promise<void> {
  const tenant = await findDefaultTenant()
  if (!tenant) throw new Error('No studio found. Run db:bootstrap or db:seed first.')

  const [coaches, admins] = await Promise.all([
    listUsers({ tenantId: tenant.id, role: 'coach' }),
    listUsers({ tenantId: tenant.id, role: 'admin' }),
  ])
  const fallback = coaches[0] ?? admins[0]
  if (!fallback) throw new Error(`No coach or admin in ${tenant.name} to attribute posts to.`)

  let created = 0
  let skipped = 0
  for (const p of POSTS) {
    if ((await findPostRowById(p.id)) || (await findPostRowBySlug(p.slug))) {
      skipped++
      continue
    }
    const demoAuthor = USERS.find((u) => u.id === p.authorId)
    const author = (demoAuthor && (await findUserRowByEmail(demoAuthor.email))) ?? null
    const a = author ?? fallback
    await insertPost({
      id: p.id, tenantId: tenant.id, tenantName: tenant.name, tenantSlug: tenant.slug, slug: p.slug, title: p.title,
      excerpt: p.excerpt, coverImageUrl: p.coverImageUrl ?? null, tags: [...p.tags], blocks: structuredClone(p.blocks) as PostBlock[],
      authorId: author ? author.id : fallback.id, authorName: `${a.firstName} ${a.lastName}`.trim(), authorRole: a.role,
      authorTitle: a.title ?? null, authorAvatarUrl: a.avatarUrl ?? null, status: p.status,
      publishedAt: p.publishedAt ? new Date(p.publishedAt) : null, createdAt: new Date(p.createdAt),
    })
    created++
  }
  console.log(`posts: ${created} created, ${skipped} already present (studio: ${tenant.name})`)
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isDirectRun) {
  seedPosts()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
