import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import { config } from '../config.js'
import { ROLES } from '../domain.js'
import { route } from '../lib/handler.js'
import { currentUser, requireAuth } from './middleware.js'
import { PASSWORD_MIN_LENGTH } from './password.js'
import * as auth from './service.js'

/** Credential endpoints get a tight per-IP budget; everything else is unlimited here. */
const credentialLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: config.isTest ? 10_000 : 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { title: 'Too Many Requests', status: 429, detail: 'Too many attempts. Try again in a few minutes.' },
})

const password = z.string().min(PASSWORD_MIN_LENGTH, 'Use at least 8 characters.').max(200)
const email = z.string().trim().toLowerCase().email('Enter a valid email address.')

const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password.'),
  portal: z.enum(ROLES).default('member'),
  tenantSlug: z.string().trim().max(80).optional(),
  rememberMe: z.boolean().optional(),
})

const registerSchema = z.object({
  firstName: z.string().trim().min(1, 'Enter your first name.').max(80),
  lastName: z.string().trim().min(1, 'Enter your last name.').max(80),
  email,
  password,
  phone: z.string().trim().max(40).optional(),
  goal: z.string().trim().max(160).optional(),
  tenantSlug: z.string().trim().max(80).optional(),
})

const profilePatchSchema = z
  .object({
    firstName: z.string().trim().min(1).max(80),
    lastName: z.string().trim().min(1).max(80),
    phone: z.string().trim().max(40).nullable(),
    avatarUrl: z.string().trim().url().max(512).nullable(),
    title: z.string().trim().max(160).nullable(),
    bio: z.string().trim().max(2000).nullable(),
    location: z.string().trim().max(120).nullable(),
  })
  .partial()

export const authRouter = Router()

authRouter.post(
  '/login',
  credentialLimiter,
  route({ body: loginSchema }, ({ body, req }) => auth.login(body, req.get('user-agent'))),
)

authRouter.post(
  '/register',
  credentialLimiter,
  route({ body: registerSchema }, async ({ body, req, res }) => {
    res.status(201)
    return auth.register(body, req.get('user-agent'))
  }),
)

authRouter.post(
  '/logout',
  requireAuth,
  route({}, async ({ req }) => {
    await auth.logout(currentUser(req).sessionId)
  }),
)

authRouter.get(
  '/me',
  requireAuth,
  route({}, ({ req }) => auth.me(currentUser(req))),
)

authRouter.patch(
  '/me',
  requireAuth,
  route({ body: profilePatchSchema }, ({ body, req }) => auth.updateProfile(currentUser(req).id, body)),
)

authRouter.post(
  '/refresh',
  route({ body: z.object({ refreshToken: z.string().min(1) }) }, ({ body, req }) =>
    auth.refresh(body.refreshToken, req.get('user-agent')),
  ),
)

authRouter.post(
  '/password-reset',
  credentialLimiter,
  route({ body: z.object({ email }) }, async ({ body }) => {
    await auth.requestPasswordReset(body.email)
  }),
)

authRouter.post(
  '/password-reset/confirm',
  credentialLimiter,
  route({ body: z.object({ token: z.string().min(1), password }) }, async ({ body }) => {
    await auth.confirmPasswordReset(body.token, body.password)
  }),
)

authRouter.post(
  '/change-password',
  requireAuth,
  route(
    { body: z.object({ currentPassword: z.string().min(1), newPassword: password }) },
    async ({ body, req }) => {
      await auth.changePassword(currentUser(req).id, body.currentPassword, body.newPassword)
    },
  ),
)
