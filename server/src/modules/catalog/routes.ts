import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requirePermission } from '../../auth/middleware.js'
import { PRODUCT_CATEGORIES, Permission } from '../../domain.js'
import { conflict, notFound } from '../../lib/errors.js'
import { route } from '../../lib/handler.js'
import { newId } from '../../lib/ids.js'
import * as catalog from './repository.js'

/** Public storefront reads; admin-only writes. */
export const productsRouter = Router()

const productBody = z.object({
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/),
  name: z.string().trim().min(2).max(160),
  tagline: z.string().trim().max(200).default(''),
  description: z.string().trim().min(1).max(5000),
  category: z.enum(PRODUCT_CATEGORIES),
  priceMinor: z.number().int().min(0),
  currency: z.enum(['USD', 'EUR', 'GBP', 'INR']).default('USD'),
  compareAtMinor: z.number().int().min(0).nullable().optional(),
  imageUrl: z.string().url().max(512).nullable().optional(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#b6ef21'),
  inStock: z.boolean().default(true),
  badge: z.string().trim().max(60).nullable().optional(),
  digital: z.boolean().default(false),
  instructorId: z.string().min(1).nullable().optional(),
})

productsRouter.get(
  '/',
  route(
    { query: z.object({ category: z.enum(PRODUCT_CATEGORIES).optional(), query: z.string().trim().max(80).optional() }) },
    ({ query }) => catalog.listProducts(query),
  ),
)

productsRouter.get(
  '/:slug',
  route({ params: z.object({ slug: z.string().min(1) }) }, ({ params }) => catalog.findProductBySlug(params.slug)),
)

productsRouter.post(
  '/',
  requireAuth,
  requirePermission(Permission.ManageCatalog),
  route({ body: productBody }, async ({ body, res }) => {
    if (await catalog.findProductBySlug(body.slug)) throw conflict('A product with that slug already exists.')
    const id = newId()
    await catalog.insertProduct({ id, ...body })
    res.status(201)
    return catalog.findProductById(id)
  }),
)

productsRouter.patch(
  '/:productId',
  requireAuth,
  requirePermission(Permission.ManageCatalog),
  route(
    { params: z.object({ productId: z.string().min(1) }), body: productBody.partial().extend({ active: z.boolean().optional() }) },
    async ({ params, body }) => {
      if (!(await catalog.findProductById(params.productId))) throw notFound('Product not found.')
      await catalog.updateProduct(params.productId, body)
      return catalog.findProductById(params.productId)
    },
  ),
)
