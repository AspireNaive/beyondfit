import { col, db } from '../../db/firestore.js'
import { Role, type UserProfile } from '../../domain.js'
import { forbidden, notFound } from '../../lib/errors.js'
import { findUserById } from '../users/repository.js'

/**
 * Who may read (and log) a member's progress: the member, their assigned
 * coach, any provider who has a live or completed session with them, the
 * tenant's admin, and platform staff.
 */
export async function assertProgressAccess(viewer: UserProfile, memberId: string): Promise<UserProfile> {
  const member = await findUserById(memberId)
  if (!member) throw notFound('Member not found.')
  if (viewer.id === member.id || viewer.role === Role.AppManager) return member
  if (viewer.tenantId !== member.tenantId) throw forbidden()
  if (viewer.role === Role.Admin) return member
  if (viewer.role === Role.Coach) {
    if (member.assignedCoachId === viewer.id) return member
    const session = await db
      .collection(col.appointments)
      .where('providerId', '==', viewer.id)
      .where('memberId', '==', member.id)
      .where('status', 'in', ['pending', 'confirmed', 'completed', 'no_show'])
      .limit(1)
      .get()
    if (!session.empty) return member
  }
  throw forbidden()
}
