import { Router } from 'express'
import { z } from 'zod'
import { currentUser, requireAuth, requirePermission, type AuthUser } from '../../auth/middleware.js'
import { POST_STATUSES, Permission, Role, can, type Post } from '../../domain.js'
import { forbidden, notFound } from '../../lib/errors.js'
import { route } from '../../lib/handler.js'
import { newId } from '../../lib/ids.js'
import { findTenantById } from '../tenants/repository.js'
import { fullName } from '../users/repository.js'
import * as content from './repository.js'

/**
 * Blog posts. Reads are public — the feed is meant to be seen signed out —
 * and writes need content:write (coach, admin, app_manager). A coach manages
 * only their own posts, an admin their studio's, an app manager everything.
 */
export const postsRouter = Router()

const httpUrl = z
  .string()
  .trim()
  .max(2048)
  .url()
  .refine((u) => /^https?:\/\//i.test(u), 'Must be an http(s) link.')

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/, 'Lower-case letters, digits and hyphens only.')

const block = z.discriminatedUnion('type', [
  z.object({ type: z.literal('heading'), text: z.string().trim().min(1).max(160) }),
  z.object({ type: z.literal('paragraph'), text: z.string().trim().min(1).max(5000) }),
  z.object({
    type: z.literal('image'),
    url: httpUrl,
    alt: z.string().trim().max(200).default(''),
    caption: z.string().trim().max(200).optional(),
  }),
  z.object({ type: z.literal('video'), url: httpUrl, caption: z.string().trim().max(200).optional() }),
  z.object({
    type: z.literal('quote'),
    text: z.string().trim().min(1).max(600),
    attribution: z.string().trim().max(120).optional(),
  }),
  z.object({ type: z.literal('list'), items: z.array(z.string().trim().min(1).max(400)).min(1).max(30) }),
])

const postBody = z.object({
  title: z.string().trim().min(3).max(160),
  slug,
  excerpt: z.string().trim().min(10).max(300),
  coverImageUrl: httpUrl.nullable().optional(),
  tags: z.array(z.string().trim().min(1).max(30)).max(8).default([]),
  blocks: z.array(block).min(1).max(200),
  status: z.enum(POST_STATUSES).default('draft'),
})

const canManage = (user: AuthUser, post: Pick<Post, 'authorId' | 'tenantId'>) =>
  can(user.role, Permission.PublishContent) &&
  (user.role === Role.AppManager ||
    (user.role === Role.Admin && user.tenantId === post.tenantId) ||
    post.authorId === user.id)

/** GET /posts — public feed, newest first, paged. */
postsRouter.get(
  '/',
  route(
    {
      query: z.object({
        tenant: z.string().trim().max(80).optional(),
        tag: z.string().trim().max(30).optional(),
        query: z.string().trim().max(80).optional(),
        page: z.coerce.number().int().min(1).default(1),
        pageSize: z.coerce.number().int().min(1).max(50).default(9),
      }),
    },
    ({ query }) =>
      content.listPublished({
        tenantSlug: query.tenant,
        tag: query.tag,
        query: query.query,
        page: query.page,
        pageSize: query.pageSize,
      }),
  ),
)

/** GET /posts/mine — drafts and published posts the caller may manage. Before /:slug. */
postsRouter.get(
  '/mine',
  requireAuth,
  requirePermission(Permission.PublishContent),
  route({}, ({ req }) => {
    const user = currentUser(req)
    if (user.role === Role.AppManager) return content.listManaged({})
    if (user.role === Role.Admin) return content.listManaged({ tenantId: user.tenantId })
    return content.listManaged({ authorId: user.id })
  }),
)

/** GET /posts/:slug — public for published posts; drafts only for those who manage them. */
postsRouter.get(
  '/:slug',
  route({ params: z.object({ slug: z.string().min(1).max(120) }) }, async ({ params, user }) => {
    const row = await content.findPostRowBySlug(params.slug)
    if (!row) return null
    if (row.status !== 'published' && !(user && canManage(user, row))) return null
    return content.toPost(row)
  }),
)

postsRouter.post(
  '/',
  requireAuth,
  requirePermission(Permission.PublishContent),
  route({ body: postBody }, async ({ body, req, res }) => {
    const user = currentUser(req)
    const tenant = await findTenantById(user.tenantId)
    if (!tenant) throw notFound('Studio not found.')
    const id = newId()
    await content.insertPost({
      id,
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      slug: body.slug,
      title: body.title,
      excerpt: body.excerpt,
      coverImageUrl: body.coverImageUrl ?? null,
      tags: body.tags,
      blocks: body.blocks,
      authorId: user.id,
      authorName: fullName(user),
      authorRole: user.role,
      authorTitle: user.title ?? null,
      authorAvatarUrl: user.avatarUrl ?? null,
      status: body.status,
    })
    res.status(201)
    return content.findPostById(id)
  }),
)

postsRouter.patch(
  '/:postId',
  requireAuth,
  requirePermission(Permission.PublishContent),
  route({ params: z.object({ postId: z.string().min(1) }), body: postBody.partial() }, async ({ params, body, req }) => {
    const user = currentUser(req)
    const current = await content.findPostRowById(params.postId)
    if (!current) throw notFound('Post not found.')
    if (!canManage(user, current)) throw forbidden()
    await content.updatePost(params.postId, body)
    return content.findPostById(params.postId)
  }),
)

postsRouter.delete(
  '/:postId',
  requireAuth,
  requirePermission(Permission.PublishContent),
  route({ params: z.object({ postId: z.string().min(1) }) }, async ({ params, req }) => {
    const user = currentUser(req)
    const current = await content.findPostRowById(params.postId)
    if (!current) throw notFound('Post not found.')
    if (!canManage(user, current)) throw forbidden()
    await content.deletePost(params.postId)
  }),
)
