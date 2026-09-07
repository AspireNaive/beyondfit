import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { can, type Permission, type Role, type UserProfile } from '../domain.js'
import { forbidden, unauthorized } from '../lib/errors.js'
import { findUserById } from '../modules/users/repository.js'
import { verifyAccessToken } from './tokens.js'

export type AuthUser = UserProfile & { sessionId: string }

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser
    }
  }
}

/**
 * Reads the bearer token if present and attaches the *current* user row, so a
 * suspension or role change takes effect on the next request, not at token
 * expiry. Anonymous requests pass through; `requireAuth` decides per route.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return next()

  const claims = verifyAccessToken(header.slice(7).trim())
  if (!claims) return next(unauthorized('Your session has expired. Sign in again.'))

  const user = await findUserById(claims.sub)
  if (!user) return next(unauthorized('Your session has expired. Sign in again.'))
  if (user.status === 'suspended') {
    return next(forbidden('This account has been suspended. Contact your studio admin.', 'suspended'))
  }
  req.user = { ...user, sessionId: claims.sid }
  next()
}

export const requireAuth: RequestHandler = (req, _res, next) => {
  if (!req.user) return next(unauthorized())
  next()
}

export const requireRole =
  (...roles: readonly Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (!roles.includes(req.user.role)) return next(forbidden())
    next()
  }

export const requirePermission =
  (permission: Permission): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(unauthorized())
    if (!can(req.user.role, permission)) return next(forbidden())
    next()
  }

/** Narrowing helper for handlers mounted behind requireAuth. */
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw unauthorized()
  return req.user
}
