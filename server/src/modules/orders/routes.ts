import { Router } from 'express'
import { z } from 'zod'
import { currentUser, requireAuth, requirePermission, type AuthUser } from '../../auth/middleware.js'
import { ORDER_STATUSES, PAYMENT_METHODS, Permission } from '../../domain.js'
import { route } from '../../lib/handler.js'
import { listPayments, listSubscriptions } from './repository.js'
import * as orders from './service.js'

const scope = (u: AuthUser) => ({ role: u.role, userId: u.id, tenantId: u.tenantId })

export const ordersRouter = Router()
ordersRouter.use(requireAuth)

const placeOrderSchema = z.object({
  lines: z.array(z.object({ productId: z.string().min(1), quantity: z.number().int().min(1).max(20) })).min(1).max(50),
  method: z.enum(PAYMENT_METHODS).default('card'),
})

ordersRouter.get('/', route({}, ({ req }) => orders.listOrders(currentUser(req))))

ordersRouter.post(
  '/',
  route({ body: placeOrderSchema }, async ({ body, req, res }) => {
    res.status(201)
    return orders.placeOrder(currentUser(req), body.lines, body.method)
  }),
)

ordersRouter.get(
  '/:orderId',
  route({ params: z.object({ orderId: z.string().min(1) }) }, ({ params, req }) => orders.getOrder(currentUser(req), params.orderId)),
)

ordersRouter.patch(
  '/:orderId',
  route(
    { params: z.object({ orderId: z.string().min(1) }), body: z.object({ status: z.enum(ORDER_STATUSES) }) },
    ({ params, body, req }) => orders.updateStatus(currentUser(req), params.orderId, body.status),
  ),
)

export const paymentsRouter = Router()
paymentsRouter.use(requireAuth)
paymentsRouter.get(
  '/',
  requirePermission(Permission.ViewPayments),
  route({}, ({ req }) => listPayments(scope(currentUser(req)))),
)

export const subscriptionsRouter = Router()
subscriptionsRouter.use(requireAuth)

/** Admins see the studio's book; members see their own memberships. */
subscriptionsRouter.get('/', route({}, ({ req }) => listSubscriptions(scope(currentUser(req)))))

subscriptionsRouter.post(
  '/',
  route(
    { body: z.object({ productId: z.string().min(1), method: z.enum(PAYMENT_METHODS).default('card') }) },
    async ({ body, req, res }) => {
      res.status(201)
      return orders.subscribe(currentUser(req), body.productId, body.method)
    },
  ),
)

subscriptionsRouter.post(
  '/:subscriptionId/cancel',
  route({ params: z.object({ subscriptionId: z.string().min(1) }) }, ({ params, req }) =>
    orders.cancelSubscription(currentUser(req), params.subscriptionId),
  ),
)
