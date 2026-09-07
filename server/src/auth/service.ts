import type { Timestamp } from 'firebase-admin/firestore'
import { config } from '../config.js'
import { col, db, docOf, Timestamp as Ts } from '../db/firestore.js'
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

/** refreshTokens/{sha256(token)} — the raw token never touches the database. */
type RefreshDoc = {
  userId: string
  sessionId: string
  expiresAt: Timestamp
  revokedAt: Timestamp | null
  userAgent: string | null
  createdAt: Timestamp
}
/** passwordResetTokens/{sha256(token)} */
type ResetDoc = { userId: string; expiresAt: Timestamp; usedAt: Timestamp | null; createdAt: Timestamp }

const refreshTokens = () => db.collection(col.refreshTokens)
const resetTokens = () => db.collection(col.passwordResetTokens)

/** Marks every live refresh token matching the query revoked. */
async function revoke(query: FirebaseFirestore.Query): Promise<void> {
  const snap = await query.where('revokedAt', '==', null).get()
  if (snap.empty) return
  const batch = db.batch()
  for (const d of snap.docs) batch.update(d.ref, { revokedAt: Ts.now() })
  await batch.commit()
}

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
  const doc: RefreshDoc = {
    userId: user.id,
    sessionId,
    expiresAt: Ts.fromDate(new Date(Date.now() + config.auth.refreshTtlSeconds * 1000)),
    revokedAt: null,
    userAgent: options.userAgent?.slice(0, 255) ?? null,
    createdAt: Ts.now(),
  }
  await refreshTokens().doc(hashToken(refreshToken)).create(doc)

  return { user, tenant, accessToken, refreshToken, expiresAt }
}

export async function login(input: LoginInput, userAgent?: string): Promise<AuthSession> {
  const row = await findUserRowByEmail(input.email)
  if (!row || !(await verifyPassword(input.password, row.passwordHash))) throw INVALID()

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

/** Rotates the refresh token: the presented one is revoked, a new pair is issued. */
export async function refresh(rawToken: string, userAgent?: string): Promise<AuthSession> {
  const ref = refreshTokens().doc(hashToken(rawToken))
  const row = docOf<RefreshDoc>(await ref.get())
  if (!row || row.revokedAt || row.expiresAt.toMillis() < Date.now()) {
    throw unauthorized('Your session has expired. Sign in again.')
  }
  const user = await findUserById(row.userId)
  if (!user || user.status === 'suspended') throw unauthorized('Your session has expired. Sign in again.')

  await ref.update({ revokedAt: Ts.now() })
  return issueSession(user, { userAgent, sessionId: row.sessionId })
}

export async function logout(sessionId: string): Promise<void> {
  await revoke(refreshTokens().where('sessionId', '==', sessionId))
}

const RESET_TTL_MS = 30 * 60_000

/** Always resolves: whether the address exists must not be observable. */
export async function requestPasswordReset(email: string): Promise<void> {
  const row = await findUserRowByEmail(email)
  if (!row) return
  const token = randomToken(32)
  const doc: ResetDoc = {
    userId: row.id,
    expiresAt: Ts.fromDate(new Date(Date.now() + RESET_TTL_MS)),
    usedAt: null,
    createdAt: Ts.now(),
  }
  await resetTokens().doc(hashToken(token)).create(doc)
  await sendPasswordResetEmail(row.email, `${config.appUrl}/reset-password?token=${token}`)
}

export async function confirmPasswordReset(token: string, password: string): Promise<void> {
  const ref = resetTokens().doc(hashToken(token))
  const row = docOf<ResetDoc>(await ref.get())
  if (!row || row.usedAt || row.expiresAt.toMillis() < Date.now()) {
    throw badRequest('That reset link is invalid or has expired. Request a new one.', 'reset_invalid')
  }
  const passwordHash = await hashPassword(password)
  await updateUser(row.userId, { passwordHash })
  await ref.update({ usedAt: Ts.now() })
  // Every existing session is signed out: the old password may have leaked.
  await revoke(refreshTokens().where('userId', '==', row.userId))
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
  if (!row || !(await verifyPassword(current, row.passwordHash))) {
    throw badRequest('Your current password is not correct.', 'invalid_credentials')
  }
  await updateUser(userId, { passwordHash: await hashPassword(next) })
}

