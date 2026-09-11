import { CHANNELS, Role, type Discipline, type UserProfile, type UserStatus } from '../../domain.js'
import { hashPassword } from '../../auth/password.js'
import { badRequest, conflict, forbidden, notFound } from '../../lib/errors.js'
import { newId, randomToken } from '../../lib/ids.js'
import { insertProvider, setHours } from '../providers/repository.js'
import { findDefaultCoach, findUserById, insertUser, listUsers, updateUser } from '../users/repository.js'
import { findTenantById } from '../tenants/repository.js'

const withSelf = (viewer: UserProfile, list: UserProfile[]) =>
  list.some((u) => u.id === viewer.id) ? list : [viewer, ...list]

/** People the viewer may see, always including themselves. */
export async function listMapped(viewer: UserProfile): Promise<UserProfile[]> {
  switch (viewer.role) {
    case Role.Member:
      return withSelf(viewer, await listUsers({ tenantId: viewer.tenantId, role: Role.Coach }))
    case Role.Coach: {
      // Every member in the studio plus fellow coaches: a coach may need to
      // cover a colleague's client, and the UI flags who is assigned to whom.
      // Studio and platform staff are not part of a coach's directory.
      const [members, coaches] = await Promise.all([
        listUsers({ tenantId: viewer.tenantId, role: Role.Member }),
        listUsers({ tenantId: viewer.tenantId, role: Role.Coach }),
      ])
      return withSelf(viewer, [...members, ...coaches.filter((c) => c.id !== viewer.id)])
    }
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
  /** Coaches only: what they can be booked for, and the hourly session rate. */
  discipline?: Discipline | null
  sessionRateMinor?: number | null
  /** app_manager only: which studio. Admins always create in their own. */
  tenantId?: string | null
}

/** Typical hourly rates by discipline, in minor units — the seed's numbers. */
const DEFAULT_RATE_MINOR: Record<Discipline, number> = {
  coaching: 9500,
  nutrition: 11000,
  physiotherapy: 13500,
  medical: 19500,
  mental_performance: 12000,
}

/** Mon–Fri 07:00–19:00, Sat–Sun 07:00–14:00 until the coach edits their hours. */
const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 7 * 60,
  endMinute: weekday === 0 || weekday === 6 ? 14 * 60 : 19 * 60,
}))

/** Which roles a viewer may create or change: staff manage the people below them, never their peers or superiors. */
const MANAGEABLE_ROLES: Record<Role, readonly Role[]> = {
  [Role.Member]: [],
  [Role.Coach]: [],
  [Role.Admin]: [Role.Member, Role.Coach],
  [Role.AppManager]: [Role.Member, Role.Coach, Role.Admin],
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
  // A coach is also a bookable provider: give them a discipline, a rate and
  // default hours so they appear in the specialist finder straight away.
  if (input.role === 'coach') {
    const discipline: Discipline = input.discipline ?? 'coaching'
    await insertProvider({
      userId: id,
      discipline,
      sessionRateMinor: input.sessionRateMinor ?? DEFAULT_RATE_MINOR[discipline],
      channels: CHANNELS,
    })
    await setHours(id, DEFAULT_HOURS)
  }

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
  // An admin manages members and coaches; platform staff also manage admins.
  // Nobody manages a peer or a superior, so an admin cannot lock out the platform manager.
  if (target.id === viewer.id && patch.status && patch.status !== 'active') throw badRequest('You cannot suspend yourself.')
  if (!MANAGEABLE_ROLES[viewer.role].includes(target.role)) throw forbidden('You can only manage members and coaches.')

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
