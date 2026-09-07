import { Role, type UserProfile } from '../../domain.js'
import { forbidden } from '../../lib/errors.js'
import { findUserById, listUsers } from '../users/repository.js'

const withSelf = (viewer: UserProfile, list: UserProfile[]) =>
  list.some((u) => u.id === viewer.id) ? list : [viewer, ...list]

/** People the viewer may see, always including themselves. */
export async function listMapped(viewer: UserProfile): Promise<UserProfile[]> {
  switch (viewer.role) {
    case Role.Member:
      return withSelf(viewer, await listUsers({ tenantId: viewer.tenantId, role: Role.Coach }))
    case Role.Coach: {
      const [assigned, peers] = await Promise.all([
        listUsers({ tenantId: viewer.tenantId, assignedCoachId: viewer.id }),
        listUsers({ tenantId: viewer.tenantId, role: Role.Coach }),
      ])
      return withSelf(viewer, [...assigned, ...peers.filter((p) => p.id !== viewer.id)])
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
