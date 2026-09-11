import { Role, type UserProfile } from '../../domain.js'
import { forbidden, notFound } from '../../lib/errors.js'
import { findUserById } from '../users/repository.js'

/**
 * Who may read (and log) a member's progress, food diary and diet plan: the
 * member, every coach in their studio (coaches cover for each other and the
 * studio decides who is assigned to whom), the tenant's admin, and platform
 * staff. Nothing crosses a studio boundary.
 */
export async function assertProgressAccess(viewer: UserProfile, memberId: string): Promise<UserProfile> {
  const member = await findUserById(memberId)
  if (!member) throw notFound('Member not found.')
  if (viewer.id === member.id || viewer.role === Role.AppManager) return member
  if (viewer.tenantId !== member.tenantId) throw forbidden()
  if (viewer.role === Role.Admin || viewer.role === Role.Coach) return member
  throw forbidden()
}
