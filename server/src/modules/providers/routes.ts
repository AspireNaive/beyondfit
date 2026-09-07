import { Router } from 'express'
import { z } from 'zod'
import { DISCIPLINES } from '../../domain.js'
import { route } from '../../lib/handler.js'
import * as providers from './service.js'

/** Public: the specialist finder is part of the marketing site. */
export const providersRouter = Router()

providersRouter.get(
  '/',
  route(
    { query: z.object({ discipline: z.enum(DISCIPLINES).optional(), query: z.string().trim().max(80).optional() }) },
    ({ query }) => providers.listProviders(query),
  ),
)

providersRouter.get(
  '/:providerId',
  route({ params: z.object({ providerId: z.string().min(1) }) }, ({ params }) => providers.getProvider(params.providerId)),
)

providersRouter.get(
  '/:providerId/availability',
  route(
    { params: z.object({ providerId: z.string().min(1) }), query: z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/) }) },
    ({ params, query }) => providers.getAvailability(params.providerId, query.date),
  ),
)
