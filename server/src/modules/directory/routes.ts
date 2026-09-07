import { Router } from 'express'
import { z } from 'zod'
import { currentUser, requireAuth } from '../../auth/middleware.js'
import { ROLES } from '../../domain.js'
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
