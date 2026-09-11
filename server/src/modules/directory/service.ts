import { Role, type UserProfile, type UserStatus } from '../../domain.js'
import { hashPassword } from '../../auth/password.js'
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js'
import { newId, randomToken } from '../../lib/ids.js'
import { findDefaultCoach, findUserById, insertUser, listUsers, updateUser } from '../users/repository.js'
import { findTenantById } from '../tenants/repository.js'

const withSelf = (viewer: UserProfile, list: UserProfile[]) =>
  list.some((u) => u.id === viewer.id) ? list : [viewer, ...list]

/** People the viewer may see, always including themselves. */
export async function listMapped(viewer: UserProfile): Promise<UserProfile[]> {
  switch (viewer.role) {
    case Role.Member:
      return withSelf(viewer, await listUsers({ tenantId: viewer.tenantId, role: Role.Coach }))
    case Role.Coach:
      // Every member in the studio plus fellow coaches: a coach may need to
      // cover a colleague's client, and the UI flags who is assigned to whom.
      return withSelf(viewer, await listUsers({ tenantId: viewer.tenantId }))
    case Role.Admin:
      return withSelf(viewer, await listUsers({ tenantId: viewer.tenantId }))
    case Role.AppManager:
      return withSelf(viewer, await listUsers({}))
  }
}

/** Visibility of one profile: staff see their tenant, members see staff; nothing leaks across tenants. */
export function canView(viewer: UserProfile, target: UserProfile): boolean {
  if (viewer.id === target.id) return true
  if (viewer.role === Role.AppManager) return true
  if (viewer.tenantId !== target.tenantId) return false
  if (viewer.role === Role.Admin || viewer.role === Role.Coach) return true
  return target.role !== Role.Member
}

export async function getProfile(viewer: UserProfile, userId: string): Promise<UserProfile | null> {
  const target = await findUserById(userId)
  if (!target || !canView(viewer, target)) return null
  return target
}

export async function listByRole(viewer: UserProfile, role: Role): Promise<UserProfile[]> {
  if (viewer.role === Role.Member && role === Role.Member) throw forbidden()
  return listUsers(viewer.role === Role.AppManager ? { role } : { tenantId: viewer.tenantId, role })
}

// ---- Studio management (admin, app_manager) ----------------------------------------

export type NewPerson = {
  role: 'member' | 'coach'
  firstName: string
  lastName: string
  email: string
  phone?: string | null
  title?: string | null
  bio?: string | null
  password?: string | null
  assignedCoachId?: string | null
  specialties?: string[] | null
  credentials?: string[] | null
  /** app_manager only: which studio. Admins always create in their own. */
  tenantId?: string | null
}

const canManagePeople = (viewer: UserProfile, tenantId: string) =>
  viewer.role === Role.AppManager || (viewer.role === Role.Admin && viewer.tenantId === tenantId)

/**
 * A studio adds a member or a coach. When no password is given, one is
 * generated and returned once so the manager can hand it over; the person
 * can change it from their profile or use "forgot password".
 */
export async function createPerson(viewer: UserProfile, input: NewPerson): Promise<{ user: UserProfile; temporaryPassword: string | null }> {
  const tenantId = viewer.role === Role.AppManager && input.tenantId ? input.tenantId : viewer.tenantId
  if (!canManagePeople(viewer, tenantId)) throw forbidden()
  const tenant = await findTenantById(tenantId)
  if (!tenant) throw notFound('Studio not found.')

  if (input.role === 'member' && tenant.seatsUsed >= tenant.seats) {
    throw conflict('This studio has no free member seats. Add capacity first.', 'seats_full')
  }

  let assignedCoachId: string | null = null
  if (input.role === 'member') {
    if (input.assignedCoachId) {
      const coach = await findUserById(input.assignedCoachId)
      if (!coach || coach.role !== Role.Coach || coach.tenantId !== tenantId) throw badRequest('That coach is not in this studio.', 'coach_not_found')
      assignedCoachId = coach.id
    } else {
      assignedCoachId = await findDefaultCoach(tenantId)
    }
  }

  const temporaryPassword = input.password ? null : randomToken(9)
  const id = newId()
  await insertUser({
    id,
    tenantId,
    role: input.role,
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: input.email.trim().toLowerCase(),
    passwordHash: await hashPassword(input.password ?? temporaryPassword!),
    phone: input.phone?.trim() || null,
    title: input.title?.trim() || null,
    bio: input.bio?.trim() || null,
    joinedAt: new Date().toISOString().slice(0, 10),
    specialties: input.role === 'coach' ? input.specialties ?? null : null,
    credentials: input.role === 'coach' ? input.credentials ?? null : null,
    assignedCoachId,
    status: 'active',
  })
  const user = await findUserById(id)
  if (!user) throw new Error('Account could not be created.')
  return { user, temporaryPassword }
}

export type PersonPatch = {
  assignedCoachId?: string | null
  status?: UserStatus
  title?: string | null
}

/** Map a member to a coach, or change someone's status. Never crosses a studio. */
export async function updatePerson(viewer: UserProfile, userId: string, patch: PersonPatch): Promise<UserProfile> {
  const target = await findUserById(userId)
  if (!target) throw notFound('Person not found.')
  if (!canManagePeople(viewer, target.tenantId)) throw forbidden()
  if (target.id === viewer.id && patch.status && patch.status !== 'active') throw badRequest('You cannot suspend yourself.')

  if (patch.assignedCoachId !== undefined) {
    if (target.role !== Role.Member) throw badRequest('Only members are assigned to a coach.')
    if (patch.assignedCoachId) {
      const coach = await findUserById(patch.assignedCoachId)
      if (!coach || coach.role !== Role.Coach || coach.tenantId !== target.tenantId) throw badRequest('That coach is not in this studio.', 'coach_not_found')
    }
  }
  await updateUser(userId, { assignedCoachId: patch.assignedCoachId, status: patch.status, title: patch.title })
  return (await findUserById(userId))!
}
