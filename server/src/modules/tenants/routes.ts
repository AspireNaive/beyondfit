import { Router } from 'express'
import { z } from 'zod'
import { currentUser, requireAuth, requirePermission } from '../../auth/middleware.js'
import { Permission, TENANT_PLANS, can } from '../../domain.js'
import { conflict, forbidden, notFound } from '../../lib/errors.js'
import { route } from '../../lib/handler.js'
import { newId } from '../../lib/ids.js'
import { findTenantById, findTenantBySlug, insertTenant, listTenants, updateTenant } from './repository.js'

export const tenantRouter = Router()
tenantRouter.use(requireAuth)

/** GET /tenant — the signed-in user's studio. */
tenantRouter.get(
  '/',
  route({}, async ({ req }) => {
    const tenant = await findTenantById(currentUser(req).tenantId)
    if (!tenant) throw notFound('Studio not found.')
    return tenant
  }),
)

export const tenantsRouter = Router()
tenantsRouter.use(requireAuth)

const tenantBody = z.object({
  name: z.string().trim().min(2).max(160),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9](?:[a-z0-9-]{0,78}[a-z0-9])?$/, 'Lower-case letters, digits and hyphens only.'),
  plan: z.enum(TENANT_PLANS).default('starter'),
  seats: z.number().int().positive().max(1_000_000).default(100),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/).nullable().optional(),
})

tenantsRouter.get(
  '/',
  requirePermission(Permission.ManagePlatform),
  route({}, () => listTenants()),
)

tenantsRouter.post(
  '/',
  requirePermission(Permission.ManagePlatform),
  route({ body: tenantBody }, async ({ body, res }) => {
    if (await findTenantBySlug(body.slug)) throw conflict('A studio with that slug already exists.')
    const id = newId()
    await insertTenant({ id, ...body, primaryColor: body.primaryColor ?? null })
    res.status(201)
    return findTenantById(id)
  }),
)

tenantsRouter.patch(
  '/:tenantId',
  route(
    { params: z.object({ tenantId: z.string().min(1) }), body: tenantBody.omit({ slug: true }).partial() },
    async ({ params, body, req }) => {
      const user = currentUser(req)
      const ownTenant = params.tenantId === user.tenantId
      if (!can(user.role, Permission.ManagePlatform) && !(ownTenant && can(user.role, Permission.ManageTenant))) {
        throw forbidden()
      }
      // Plan and seat changes are commercial decisions: platform staff only.
      const patch = can(user.role, Permission.ManagePlatform) ? body : { name: body.name, primaryColor: body.primaryColor }
      if (!(await findTenantById(params.tenantId))) throw notFound('Studio not found.')
      await updateTenant(params.tenantId, patch)
      return findTenantById(params.tenantId)
    },
  ),
)
