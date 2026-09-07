import type { Timestamp } from 'firebase-admin/firestore'
import { col, db, docOf, runTransaction, Timestamp as Ts, type Tx } from '../../db/firestore.js'
import type { Appointment, AppointmentStatus, Discipline, MeetingChannel, Role } from '../../domain.js'
import { conflict } from '../../lib/errors.js'
import type { Range } from '../providers/availability.js'

export type AppointmentDoc = {
  tenantId: string
  memberId: string
  memberName: string
  providerId: string
  providerName: string
  discipline: Discipline
  channel: MeetingChannel
  startsAt: Timestamp
  endsAt: Timestamp
  durationMinutes: number
  status: AppointmentStatus
  priceMinor: number
  currency: Appointment['price']['currency']
  joinUrl: string | null
  notes: string | null
  memberGoal: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
  cancelledAt: Timestamp | null
}
export type AppointmentRow = AppointmentDoc & { id: string }

const appointments = () => db.collection(col.appointments)
const slotLocks = () => db.collection(col.slotLocks)

/** Cancelled and no-show sessions free their slot; everything else holds it. */
export const isLive = (status: AppointmentStatus) => status !== 'cancelled' && status !== 'no_show'
export const slotLockId = (providerId: string, startsAt: Date) => `${providerId}_${startsAt.getTime()}`
/** Sessions are at most 60 minutes, so anything overlapping [from, to) starts after from − 2h. */
const OVERLAP_LOOKBACK_MS = 2 * 3_600_000

export const toAppointment = (r: AppointmentRow): Appointment => ({
  id: r.id,
  memberId: r.memberId,
  memberName: r.memberName,
  providerId: r.providerId,
  providerName: r.providerName,
  discipline: r.discipline,
  channel: r.channel,
  startsAt: r.startsAt.toDate().toISOString(),
  durationMinutes: r.durationMinutes,
  status: r.status,
  price: { amountMinor: r.priceMinor, currency: r.currency },
  ...(r.joinUrl ? { joinUrl: r.joinUrl } : {}),
  ...(r.notes ? { notes: r.notes } : {}),
  ...(r.memberGoal ? { memberGoal: r.memberGoal } : {}),
  createdAt: r.createdAt.toDate().toISOString(),
})

export async function findAppointmentRow(id: string, tx?: Tx): Promise<AppointmentRow | null> {
  const ref = appointments().doc(id)
  return docOf<AppointmentDoc>(tx ? await tx.get(ref) : await ref.get())
}

export async function listAppointmentRows(scope: { role: Role; userId: string; tenantId: string }): Promise<AppointmentRow[]> {
  const base = appointments()
  const q: Record<Role, FirebaseFirestore.Query> = {
    member: base.where('memberId', '==', scope.userId),
    coach: base.where('providerId', '==', scope.userId),
    admin: base.where('tenantId', '==', scope.tenantId),
    app_manager: base,
  }
  const snap = await q[scope.role].orderBy('startsAt').get()
  return snap.docs.map((d) => docOf<AppointmentDoc>(d)!)
}

/** Live bookings overlapping [from, to) as millisecond ranges. */
export async function listBookedRanges(providerId: string, from: Date, to: Date, tx?: Tx): Promise<Range[]> {
  const q = appointments()
    .where('providerId', '==', providerId)
    .where('startsAt', '>=', Ts.fromDate(new Date(from.getTime() - OVERLAP_LOOKBACK_MS)))
    .where('startsAt', '<', Ts.fromDate(to))
  const snap = tx ? await tx.get(q) : await q.get()
  return snap.docs
    .map((d) => d.data() as AppointmentDoc)
    .filter((a) => isLive(a.status) && a.endsAt.toMillis() > from.getTime())
    .map((a) => ({ start: a.startsAt.toMillis(), end: a.endsAt.toMillis() }))
}

export type NewAppointment = {
  id: string
  tenantId: string
  memberId: string
  memberName: string
  providerId: string
  providerName: string
  discipline: Discipline
  channel: MeetingChannel
  startsAt: Date
  durationMinutes: number
  status: AppointmentStatus
  priceMinor: number
  currency: string
  joinUrl?: string | null
  notes?: string | null
  memberGoal?: string | null
  createdAt?: Date
}

function toDoc(a: NewAppointment): AppointmentDoc {
  const created = a.createdAt ? Ts.fromDate(a.createdAt) : Ts.now()
  return {
    tenantId: a.tenantId,
    memberId: a.memberId,
    memberName: a.memberName,
    providerId: a.providerId,
    providerName: a.providerName,
    discipline: a.discipline,
    channel: a.channel,
    startsAt: Ts.fromDate(a.startsAt),
    endsAt: Ts.fromDate(new Date(a.startsAt.getTime() + a.durationMinutes * 60_000)),
    durationMinutes: a.durationMinutes,
    status: a.status,
    priceMinor: a.priceMinor,
    currency: a.currency as AppointmentDoc['currency'],
    joinUrl: a.joinUrl ?? null,
    notes: a.notes ?? null,
    memberGoal: a.memberGoal ?? null,
    createdAt: created,
    updatedAt: created,
    cancelledAt: null,
  }
}

/**
 * Writes the appointment and, when it is live, claims the slot lock. Inside a
 * caller's transaction the reads must already have happened; standalone, it
 * runs its own transaction. A taken slot surfaces as a 409 `slot_taken`.
 */
export async function insertAppointment(a: NewAppointment, tx?: Tx): Promise<void> {
  const doc = toDoc(a)
  const write = (t: Tx) => {
    if (isLive(a.status)) t.create(slotLocks().doc(slotLockId(a.providerId, a.startsAt)), { appointmentId: a.id })
    t.create(appointments().doc(a.id), doc)
  }
  if (tx) {
    write(tx)
    return
  }
  try {
    await runTransaction(async (t) => {
      if (isLive(a.status) && (await t.get(slotLocks().doc(slotLockId(a.providerId, a.startsAt)))).exists) {
        throw conflict('That slot was just taken. Pick another time.', 'slot_taken')
      }
      write(t)
    })
  } catch (error) {
    if ((error as { code?: number }).code === 6) throw conflict('That slot was just taken. Pick another time.', 'slot_taken')
    throw error
  }
}

export async function setAppointmentStatus(id: string, status: AppointmentStatus): Promise<void> {
  await runTransaction(async (tx) => {
    const ref = appointments().doc(id)
    const row = docOf<AppointmentDoc>(await tx.get(ref))
    if (!row) return
    const lock = slotLocks().doc(slotLockId(row.providerId, row.startsAt.toDate()))
    const lockSnap = await tx.get(lock)
    tx.update(ref, {
      status,
      updatedAt: Ts.now(),
      ...(status === 'cancelled' ? { cancelledAt: Ts.now() } : {}),
    })
    if (isLive(status) && !lockSnap.exists) tx.create(lock, { appointmentId: id })
    if (!isLive(status) && lockSnap.exists) tx.delete(lock)
  })
}

/** Reads the slot lock inside the caller's transaction; true when the slot is held. */
export async function slotIsTaken(providerId: string, startsAt: Date, tx: Tx): Promise<boolean> {
  return (await tx.get(slotLocks().doc(slotLockId(providerId, startsAt)))).exists
}
