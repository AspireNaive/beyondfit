import type { RowDataPacket } from 'mysql2/promise'
import { queryOne } from '../../db/pool.js'
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
    const session = await queryOne<RowDataPacket & { id: string }>(
      `SELECT id FROM appointments WHERE provider_id = ? AND member_id = ? AND status <> 'cancelled' LIMIT 1`,
      [viewer.id, member.id],
    )
    if (session) return member
  }
  throw forbidden()
}
