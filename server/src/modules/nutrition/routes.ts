import { Router } from 'express'
import { z } from 'zod'
import { currentUser, requireAuth } from '../../auth/middleware.js'
import { config } from '../../config.js'
import { MEAL_TYPES, Role } from '../../domain.js'
import { forbidden, notFound } from '../../lib/errors.js'
import { route } from '../../lib/handler.js'
import { newId } from '../../lib/ids.js'
import { fullName } from '../users/repository.js'
import { assertProgressAccess } from '../progress/service.js'
import { analyseFoodPhoto } from './ai.js'
import * as repo from './repository.js'

/**
 * Food diary and diet plans, mounted under /members/:memberId. Who may read
 * follows the progress rules (the member, coaches in their studio, the studio
 * admin, platform staff). Members log their own food; diet plans are written
 * by coaches and staff, never by the member.
 */
export const nutritionRouter = Router()
nutritionRouter.use(requireAuth)

/** GET /nutrition/capabilities — whether photo analysis is switched on. */
nutritionRouter.get(
  '/capabilities',
  route({}, () => ({ photoAnalysis: config.ai.enabled, model: config.ai.enabled ? config.ai.model : null })),
)

export const memberNutritionRouter = Router()
memberNutritionRouter.use(requireAuth)

const memberParams = z.object({ memberId: z.string().min(1) })
const entryParams = memberParams.extend({ entryId: z.string().min(1) })
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')

const item = z.object({
  name: z.string().trim().min(1).max(80),
  portion: z.string().trim().max(40).default(''),
  calories: z.number().min(0).max(10_000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatG: z.number().min(0).max(1000),
})

/** A data URL or bare base64; the client downsizes before sending. */
const photo = z.string().min(20).max(7_500_000)
const thumb = z.string().min(20).max(120_000)

const entryBody = z.object({
  date: isoDate,
  mealType: z.enum(MEAL_TYPES),
  title: z.string().trim().min(1).max(120),
  items: z.array(item).min(1).max(40),
  notes: z.string().trim().max(1000).nullable().optional(),
  source: z.enum(['manual', 'photo']).default('manual'),
  photoDataUrl: photo.nullable().optional(),
  thumbDataUrl: thumb.nullable().optional(),
})

const range = z.object({ from: isoDate.optional(), to: isoDate.optional() })

const today = () => new Date().toISOString().slice(0, 10)
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10)

/** POST /members/:memberId/food/analyze — estimate a meal from a photo; nothing is saved. */
memberNutritionRouter.post(
  '/:memberId/food/analyze',
  route({ params: memberParams, body: z.object({ photo, hint: z.string().trim().max(300).optional() }) }, async ({ params, body, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    return analyseFoodPhoto(body.photo, body.hint)
  }),
)

/** GET /members/:memberId/food?from&to — default the last 14 days. */
memberNutritionRouter.get(
  '/:memberId/food',
  route({ params: memberParams, query: range }, async ({ params, query, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    return repo.listFoodEntries(params.memberId, query.from ?? daysAgo(13), query.to ?? today())
  }),
)

/** GET /members/:memberId/food/summary?from&to — calories per day, for coaches. */
memberNutritionRouter.get(
  '/:memberId/food/summary',
  route({ params: memberParams, query: range }, async ({ params, query, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    return repo.dailyTotals(params.memberId, query.from ?? daysAgo(29), query.to ?? today())
  }),
)

memberNutritionRouter.post(
  '/:memberId/food',
  route({ params: memberParams, body: entryBody }, async ({ params, body, req, res }) => {
    const member = await assertProgressAccess(currentUser(req), params.memberId)
    const id = newId()
    await repo.insertFoodEntry({
      id,
      tenantId: member.tenantId,
      memberId: member.id,
      date: body.date,
      mealType: body.mealType,
      title: body.title,
      items: body.items,
      notes: body.notes ?? null,
      source: body.photoDataUrl ? 'photo' : body.source,
      thumbDataUrl: body.thumbDataUrl ?? null,
      photoDataUrl: body.photoDataUrl ?? null,
    })
    res.status(201)
    return repo.findFoodEntry(member.id, id)
  }),
)

memberNutritionRouter.get(
  '/:memberId/food/:entryId/photo',
  route({ params: entryParams }, async ({ params, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    const dataUrl = await repo.findFoodPhoto(params.memberId, params.entryId)
    if (!dataUrl) throw notFound('No photo for that meal.')
    return { dataUrl }
  }),
)

memberNutritionRouter.patch(
  '/:memberId/food/:entryId',
  route(
    { params: entryParams, body: entryBody.pick({ date: true, mealType: true, title: true, items: true, notes: true }).partial() },
    async ({ params, body, req }) => {
      await assertProgressAccess(currentUser(req), params.memberId)
      if (!(await repo.findFoodEntry(params.memberId, params.entryId))) throw notFound('Meal not found.')
      await repo.updateFoodEntry(params.entryId, body)
      return repo.findFoodEntry(params.memberId, params.entryId)
    },
  ),
)

memberNutritionRouter.delete(
  '/:memberId/food/:entryId',
  route({ params: entryParams }, async ({ params, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    if (!(await repo.findFoodEntry(params.memberId, params.entryId))) throw notFound('Meal not found.')
    await repo.deleteFoodEntry(params.entryId)
  }),
)

// ---- Diet plans ------------------------------------------------------------------

const planBody = z.object({
  title: z.string().trim().min(2).max(120),
  summary: z.string().trim().max(1000).default(''),
  targets: z.object({
    calories: z.number().int().min(800).max(10_000),
    proteinG: z.number().int().min(0).max(500),
    carbsG: z.number().int().min(0).max(1000),
    fatG: z.number().int().min(0).max(500),
  }),
  meals: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(60),
        time: z.string().trim().max(20).nullable().optional(),
        description: z.string().trim().min(1).max(1000),
        calories: z.number().int().min(0).max(5000).nullable().optional(),
      }),
    )
    .min(1)
    .max(12),
  guidelines: z.array(z.string().trim().min(1).max(200)).max(15).default([]),
})

/** GET /members/:memberId/diet-plan — the active plan, or null. */
memberNutritionRouter.get(
  '/:memberId/diet-plan',
  route({ params: memberParams }, async ({ params, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    return repo.findActiveDietPlan(params.memberId)
  }),
)

/** GET /members/:memberId/diet-plan/history — every plan, newest first. */
memberNutritionRouter.get(
  '/:memberId/diet-plan/history',
  route({ params: memberParams }, async ({ params, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    return repo.listDietPlans(params.memberId)
  }),
)

/** PUT /members/:memberId/diet-plan — coach or staff writes a new plan; the old one is archived. */
memberNutritionRouter.put(
  '/:memberId/diet-plan',
  route({ params: memberParams, body: planBody }, async ({ params, body, req }) => {
    const user = currentUser(req)
    if (user.role === Role.Member) throw forbidden('Diet plans are written by your coach.')
    const member = await assertProgressAccess(user, params.memberId)
    const id = newId()
    await repo.replaceDietPlan({
      id,
      tenantId: member.tenantId,
      memberId: member.id,
      authorId: user.id,
      authorName: fullName(user),
      authorRole: user.role,
      title: body.title,
      summary: body.summary,
      targets: body.targets,
      meals: body.meals.map((m) => ({ name: m.name, time: m.time ?? null, description: m.description, calories: m.calories ?? null })),
      guidelines: body.guidelines,
    })
    return repo.findActiveDietPlan(member.id)
  }),
)
