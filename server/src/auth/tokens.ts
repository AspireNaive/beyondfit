import { createHash } from 'node:crypto'
import jwt from 'jsonwebtoken'
import { config } from '../config.js'
import type { Role } from '../domain.js'
import { randomToken } from '../lib/ids.js'

export type AccessClaims = {
  sub: string
  role: Role
  tid: string
  /** Session id: ties the access token to the refresh token issued with it. */
  sid: string
}

export function signAccessToken(claims: AccessClaims, ttlSeconds: number) {
  const token = jwt.sign(claims, config.auth.jwtSecret, {
    algorithm: 'HS256',
    expiresIn: ttlSeconds,
    issuer: 'kedem-life',
  })
  return { token, expiresAt: new Date(Date.now() + ttlSeconds * 1000).toISOString() }
}

export function verifyAccessToken(token: string): (AccessClaims & { exp: number }) | null {
  try {
    return jwt.verify(token, config.auth.jwtSecret, {
      algorithms: ['HS256'],
      issuer: 'kedem-life',
    }) as AccessClaims & { exp: number }
  } catch {
    return null
  }
}

/** Opaque refresh tokens: the raw value goes to the client, only its hash is stored. */
export const newRefreshToken = () => randomToken(32)
export const hashToken = (raw: string) => createHash('sha256').update(raw).digest('hex')
