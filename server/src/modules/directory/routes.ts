import { Router } from 'express'
import { z } from 'zod'
import { currentUser, requireAuth, requireRole } from '../../auth/middleware.js'
import { ROLES, Role, USER_STATUSES } from '../../domain.js'
import { route } from '../../lib/handler.js'
import * as directory from './service.js'

export const directoryRouter = Router()
directoryRouter.use(requireAuth)

directoryRouter.get(
  '/mapped',
  route({}, ({ req }) => directory.listMapped(currentUser(req))),
)

directoryRouter.get(
  '/',
  route({ query: z.object({ role: z.enum(ROLES) }) }, ({ query, req }) =>
    directory.listByRole(currentUser(req), query.role),
  ),
)

directoryRouter.get(
  '/:userId',
  route({ params: z.object({ userId: z.string().min(1) }) }, async ({ params, req }) => {
    // null (not 404) mirrors the port: the screen renders its own empty state.
    return directory.getProfile(currentUser(req), params.userId)
  }),
)

const personBody = z.object({
  role: z.enum(['member', 'coach']),
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().max(40).nullable().optional(),
  title: z.string().trim().max(120).nullable().optional(),
  bio: z.string().trim().max(1000).nullable().optional(),
  password: z.string().min(8).max(200).nullable().optional(),
  assignedCoachId: z.string().min(1).nullable().optional(),
  specialties: z.array(z.string().trim().min(1).max(60)).max(10).nullable().optional(),
  credentials: z.array(z.string().trim().min(1).max(60)).max(10).nullable().optional(),
  tenantId: z.string().min(1).nullable().optional(),
})

/** POST /directory — a studio admin (or platform staff) adds a member or coach. */
directoryRouter.post(
  '/',
  requireRole(Role.Admin, Role.AppManager),
  route({ body: personBody }, async ({ body, req, res }) => {
    const result = await directory.createPerson(currentUser(req), body)
    res.status(201)
    return result
  }),
)

/** PATCH /directory/:userId — map a member to a coach, or change status / title. */
directoryRouter.patch(
  '/:userId',
  requireRole(Role.Admin, Role.AppManager),
  route(
    {
      params: z.object({ userId: z.string().min(1) }),
      body: z.object({
        assignedCoachId: z.string().min(1).nullable().optional(),
        status: z.enum(USER_STATUSES).optional(),
        title: z.string().trim().max(120).nullable().optional(),
      }),
    },
    ({ params, body, req }) => directory.updatePerson(currentUser(req), params.userId, body),
  ),
)
