import type { RowDataPacket } from 'mysql2/promise'
import { config } from '../config.js'
import { execute, pool, queryOne, withTransaction } from '../db/pool.js'
import { Role, type AuthSession, type Tenant, type UserProfile } from '../domain.js'
import { HttpError, badRequest, conflict, forbidden, notFound, unauthorized } from '../lib/errors.js'
import { newId, randomToken } from '../lib/ids.js'
import { sendPasswordResetEmail } from '../lib/mailer.js'
import { findDefaultTenant, findTenantById, findTenantBySlug } from '../modules/tenants/repository.js'
import {
  findDefaultCoach,
  findUserById,
  findUserRowByEmail,
  findUserRowById,
  insertUser,
  toUserProfile,
  updateUser,
} from '../modules/users/repository.js'
import { hashPassword, verifyPassword } from './password.js'
import { hashToken, newRefreshToken, signAccessToken } from './tokens.js'

/**
 * Which roles a sign-in portal accepts. Staff portals are deliberately narrow:
 * member credentials at /login/admin fail even though they are valid.
 */
const PORTAL_ACCEPTS: Record<Role, readonly Role[]> = {
  [Role.Member]: [Role.Member],
  [Role.Coach]: [Role.Coach],
  [Role.Admin]: [Role.Admin, Role.AppManager],
  [Role.AppManager]: [Role.AppManager],
}

const INVALID = () =>
  new HttpError(400, 'That email and password combination is not recognised.', { code: 'invalid_credentials' })

export type LoginInput = {
  email: string
  password: string
  portal: Role
  tenantSlug?: string | undefined
  rememberMe?: boolean | undefined
}

export type RegisterInput = {
  firstName: string
  lastName: string
  email: string
  password: string
  phone?: string | undefined
  goal?: string | undefined
  tenantSlug?: string | undefined
}

type SessionOptions = { rememberMe?: boolean | undefined; userAgent?: string | undefined; sessionId?: string }

async function issueSession(user: UserProfile, options: SessionOptions = {}): Promise<AuthSession> {
  const tenant = await findTenantById(user.tenantId)
  if (!tenant) throw new HttpError(500, 'Account is not attached to a studio.')

  const sessionId = options.sessionId ?? newId()
  const ttl = options.rememberMe ? config.auth.rememberMeTtlSeconds : config.auth.accessTtlSeconds
  const { token: accessToken, expiresAt } = signAccessToken(
    { sub: user.id, role: user.role, tid: user.tenantId, sid: sessionId },
    ttl,
  )

  const refreshToken = newRefreshToken()
  await execute(
    `INSERT INTO refresh_tokens (id, user_id, session_id, token_hash, expires_at, user_agent)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      newId(),
      user.id,
      sessionId,
      hashToken(refreshToken),
      new Date(Date.now() + config.auth.refreshTtlSeconds * 1000),
      options.userAgent?.slice(0, 255) ?? null,
    ],
  )

  return { user, tenant, accessToken, refreshToken, expiresAt }
}

export async function login(input: LoginInput, userAgent?: string): Promise<AuthSession> {
  const row = await findUserRowByEmail(input.email)
  if (!row || !(await verifyPassword(input.password, row.password_hash))) throw INVALID()

  const user = toUserProfile(row)
  if (user.status === 'suspended') {
    throw forbidden('This account has been suspended. Contact your studio admin.', 'suspended')
  }
  if (!PORTAL_ACCEPTS[input.portal].includes(user.role)) {
    throw forbidden(
      `These credentials belong to a ${user.role.replace('_', ' ')} account. Use the matching sign-in page.`,
      'wrong_portal',
    )
  }
  if (input.tenantSlug) {
    const tenant = await findTenantBySlug(input.tenantSlug)
    if (!tenant || tenant.id !== user.tenantId) throw INVALID()
  }
  return issueSession(user, { rememberMe: input.rememberMe, userAgent })
}

export async function register(input: RegisterInput, userAgent?: string): Promise<AuthSession> {
  const email = input.email.trim().toLowerCase()
  if (await findUserRowByEmail(email)) {
    throw conflict('An account already exists for that email.', 'email_taken')
  }

  const tenant = input.tenantSlug ? await findTenantBySlug(input.tenantSlug) : await findDefaultTenant()
  if (!tenant) throw badRequest(input.tenantSlug ? 'That studio does not exist.' : 'No studio is set up yet.')
  if (tenant.seatsUsed >= tenant.seats) {
    throw conflict('This studio has no free member seats. Ask the studio to add capacity.', 'seats_full')
  }

  const id = newId()
  await insertUser({
    id,
    tenantId: tenant.id,
    role: Role.Member,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email,
    passwordHash: await hashPassword(input.password),
    phone: input.phone?.trim() || null,
    title: input.goal?.trim() || null,
    joinedAt: new Date().toISOString().slice(0, 10),
    // New members land with the tenant's head coach until an admin reassigns them.
    assignedCoachId: await findDefaultCoach(tenant.id),
  })

  const user = await findUserById(id)
  if (!user) throw new HttpError(500, 'Account could not be created.')
  return issueSession(user, { userAgent })
}

/** Fresh user + tenant for the stored session; the client keeps its tokens. */
export async function me(user: UserProfile): Promise<{ user: UserProfile; tenant: Tenant }> {
  const tenant = await findTenantById(user.tenantId)
  if (!tenant) throw notFound('Studio not found.')
  return { user, tenant }
}

interface RefreshRow extends RowDataPacket {
  id: string
  user_id: string
  session_id: string
  expires_at: Date
  revoked_at: Date | null
}

/** Rotates the refresh token: the presented one is revoked, a new pair is issued. */
export async function refresh(rawToken: string, userAgent?: string): Promise<AuthSession> {
  const row = await queryOne<RefreshRow>(
    'SELECT id, user_id, session_id, expires_at, revoked_at FROM refresh_tokens WHERE token_hash = ?',
    [hashToken(rawToken)],
  )
  if (!row || row.revoked_at || row.expires_at.getTime() < Date.now()) {
    throw unauthorized('Your session has expired. Sign in again.')
  }
  const user = await findUserById(row.user_id)
  if (!user || user.status === 'suspended') throw unauthorized('Your session has expired. Sign in again.')

  await execute('UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE id = ?', [row.id])
  return issueSession(user, { userAgent, sessionId: row.session_id })
}

export async function logout(sessionId: string): Promise<void> {
  await execute('UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE session_id = ? AND revoked_at IS NULL', [
    sessionId,
  ])
}

const RESET_TTL_MS = 30 * 60_000

/** Always resolves: whether the address exists must not be observable. */
export async function requestPasswordReset(email: string): Promise<void> {
  const row = await findUserRowByEmail(email)
  if (!row) return
  const token = randomToken(32)
  await execute(
    'INSERT INTO password_reset_tokens (id, user_id, token_hash, expires_at) VALUES (?, ?, ?, ?)',
    [newId(), row.id, hashToken(token), new Date(Date.now() + RESET_TTL_MS)],
  )
  await sendPasswordResetEmail(row.email, `${config.appUrl}/reset-password?token=${token}`)
}

interface ResetRow extends RowDataPacket {
  id: string
  user_id: string
  expires_at: Date
  used_at: Date | null
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  const row = await queryOne<ResetRow>(
    'SELECT id, user_id, expires_at, used_at FROM password_reset_tokens WHERE token_hash = ?',
    [hashToken(token)],
  )
  if (!row || row.used_at || row.expires_at.getTime() < Date.now()) {
    throw badRequest('That reset link is invalid or has expired. Request a new one.', 'reset_invalid')
  }
  const passwordHash = await hashPassword(password)
  await withTransaction(async (conn) => {
    await updateUser(row.user_id, { passwordHash }, conn)
    await execute('UPDATE password_reset_tokens SET used_at = NOW(3) WHERE id = ?', [row.id], conn)
    // Every existing session is signed out: the old password may have leaked.
    await execute('UPDATE refresh_tokens SET revoked_at = NOW(3) WHERE user_id = ? AND revoked_at IS NULL', [row.user_id], conn)
  })
}

export type ProfilePatch = Partial<{
  firstName: string
  lastName: string
  phone: string | null
  avatarUrl: string | null
  title: string | null
  bio: string | null
  location: string | null
}>

export async function updateProfile(userId: string, patch: ProfilePatch): Promise<UserProfile> {
  await updateUser(userId, patch)
  const user = await findUserById(userId)
  if (!user) throw notFound()
  return user
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const row = await findUserRowById(userId)
  if (!row || !(await verifyPassword(current, row.password_hash))) {
    throw badRequest('Your current password is not correct.', 'invalid_credentials')
  }
  await updateUser(userId, { passwordHash: await hashPassword(next) })
}

export { pool }
