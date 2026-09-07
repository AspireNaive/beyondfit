import { Router } from 'express'
import { z } from 'zod'
import { currentUser, requireAuth } from '../../auth/middleware.js'
import { route } from '../../lib/handler.js'
import * as repo from './repository.js'
import { assertProgressAccess } from './service.js'

export const membersRouter = Router()
membersRouter.use(requireAuth)

const memberParams = z.object({ memberId: z.string().min(1) })
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.')

const bodyMetricSchema = z.object({
  memberId: z.string().min(1).optional(),
  recordedOn: isoDate,
  weightKg: z.number().positive().max(500),
  heightCm: z.number().positive().max(300),
  bodyFatPercent: z.number().min(1).max(80).optional(),
  restingHeartRate: z.number().int().min(25).max(250).optional(),
  waistCm: z.number().positive().max(300).optional(),
  note: z.string().trim().max(500).optional(),
})

const activitySchema = z.object({
  steps: z.number().int().min(0).max(200_000).default(0),
  activeMinutes: z.number().int().min(0).max(1440).default(0),
  caloriesBurned: z.number().int().min(0).max(20_000).default(0),
  caloriesConsumed: z.number().int().min(0).max(20_000).default(0),
  proteinGrams: z.number().int().min(0).max(1000).default(0),
  waterMl: z.number().int().min(0).max(20_000).default(0),
  sleepHours: z.number().min(0).max(24).default(0),
  workouts: z.number().int().min(0).max(10).default(0),
})

const goalSchema = z.object({
  targetWeightKg: z.number().positive().max(500).optional(),
  dailyCalorieTarget: z.number().int().min(800).max(10_000),
  dailyProteinTarget: z.number().int().min(20).max(500),
  dailyStepTarget: z.number().int().min(1000).max(100_000),
  weeklyWorkoutTarget: z.number().int().min(0).max(14),
  focus: z.string().trim().min(1).max(160),
})

membersRouter.get(
  '/:memberId/body-metrics',
  route({ params: memberParams }, async ({ params, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    return repo.listBodyMetrics(params.memberId)
  }),
)

membersRouter.post(
  '/:memberId/body-metrics',
  route({ params: memberParams, body: bodyMetricSchema }, async ({ params, body, req, res }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    res.status(201)
    return repo.upsertBodyMetric({ ...body, memberId: params.memberId })
  }),
)

membersRouter.get(
  '/:memberId/activity',
  route(
    { params: memberParams, query: z.object({ days: z.coerce.number().int().min(1).max(366).default(30) }) },
    async ({ params, query, req }) => {
      await assertProgressAccess(currentUser(req), params.memberId)
      return repo.listActivity(params.memberId, query.days)
    },
  ),
)

membersRouter.put(
  '/:memberId/activity/:date',
  route({ params: memberParams.extend({ date: isoDate }), body: activitySchema }, async ({ params, body, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    return repo.upsertActivity({ ...body, memberId: params.memberId, date: params.date })
  }),
)

membersRouter.get(
  '/:memberId/goal',
  route({ params: memberParams }, async ({ params, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    return repo.getGoal(params.memberId)
  }),
)

membersRouter.put(
  '/:memberId/goal',
  route({ params: memberParams, body: goalSchema }, async ({ params, body, req }) => {
    await assertProgressAccess(currentUser(req), params.memberId)
    return repo.upsertGoal({ ...body, memberId: params.memberId })
  }),
)
