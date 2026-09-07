import { Router } from 'express'
import { z } from 'zod'
import { currentUser, requireAuth } from '../../auth/middleware.js'
import { CHANNELS } from '../../domain.js'
import { route } from '../../lib/handler.js'
import * as appointments from './service.js'

export const appointmentsRouter = Router()
appointmentsRouter.use(requireAuth)

const bookSchema = z.object({
  providerId: z.string().min(1),
  startsAt: z.string().datetime({ offset: true }),
  durationMinutes: z.number().int(),
  channel: z.enum(CHANNELS),
  goal: z.string().trim().max(255).optional(),
  notes: z.string().trim().max(2000).optional(),
})

const idParams = z.object({ appointmentId: z.string().min(1) })

appointmentsRouter.get(
  '/',
  route({}, ({ req }) => appointments.listAppointments(currentUser(req))),
)

appointmentsRouter.post(
  '/',
  route({ body: bookSchema }, async ({ body, req, res }) => {
    res.status(201)
    return appointments.book(currentUser(req), body)
  }),
)

appointmentsRouter.post(
  '/:appointmentId/cancel',
  route({ params: idParams }, ({ params, req }) => appointments.cancel(currentUser(req), params.appointmentId)),
)

appointmentsRouter.patch(
  '/:appointmentId',
  route(
    { params: idParams, body: z.object({ status: z.enum(['confirmed', 'completed', 'no_show']) }) },
    ({ params, body, req }) => appointments.updateStatus(currentUser(req), params.appointmentId, body.status),
  ),
)
