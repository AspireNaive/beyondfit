import { runTransaction } from '../../db/firestore.js'
import { Role, type Appointment, type AppointmentStatus, type MeetingChannel, type UserProfile } from '../../domain.js'
import { badRequest, conflict, forbidden, notFound, unprocessable } from '../../lib/errors.js'
import { newId } from '../../lib/ids.js'
import { dateIn } from '../providers/availability.js'
import { findProviderRow } from '../providers/repository.js'
import { availabilityFor } from '../providers/service.js'
import { fullName } from '../users/repository.js'
import {
  findAppointmentRow,
  insertAppointment,
  listAppointmentRows,
  listBookedRanges,
  setAppointmentStatus,
  slotIsTaken,
  toAppointment,
  type AppointmentRow,
} from './repository.js'

export const DURATIONS = [30, 45, 60] as const

export type BookInput = {
  providerId: string
  startsAt: string
  durationMinutes: number
  channel: MeetingChannel
  goal?: string | undefined
  notes?: string | undefined
}

export async function listAppointments(viewer: UserProfile): Promise<Appointment[]> {
  const rows = await listAppointmentRows({ role: viewer.role, userId: viewer.id, tenantId: viewer.tenantId })
  return rows.map(toAppointment)
}

/**
 * Zoom/Meet links come from a calendar integration, which is not wired yet, so
 * only phone consults get a join target today: the provider's own number.
 */
function joinUrlFor(channel: MeetingChannel, providerPhone: string | null): string | null {
  if (channel === 'phone' && providerPhone) return `tel:${providerPhone.replace(/[^\d+]/g, '')}`
  return null
}

export async function book(member: UserProfile, input: BookInput, now = new Date()): Promise<Appointment> {
  const provider = await findProviderRow(input.providerId)
  if (!provider || !provider.acceptingBookings) throw badRequest('That provider is no longer taking bookings.')
  if (provider.tenantId !== member.tenantId && member.role !== Role.AppManager) {
    throw forbidden('That provider belongs to a different studio.')
  }
  if (!provider.channels.includes(input.channel)) {
    throw unprocessable('That provider does not offer sessions on that channel.', { channel: ['Not offered by this provider.'] })
  }
  if (!DURATIONS.includes(input.durationMinutes as (typeof DURATIONS)[number])) {
    throw unprocessable('Sessions are 30, 45 or 60 minutes.', { durationMinutes: ['Must be 30, 45 or 60.'] })
  }

  const startsAt = new Date(input.startsAt)
  if (Number.isNaN(startsAt.getTime())) throw unprocessable('startsAt must be an ISO-8601 instant.')
  if (startsAt.getTime() <= now.getTime()) throw conflict('That time has already passed. Pick another slot.')

  // The requested start must be one of the provider's published slots for that day.
  const slots = await availabilityFor(provider, dateIn(startsAt, provider.timezone), now)
  const slot = slots.find((s) => new Date(s.startsAt).getTime() === startsAt.getTime())
  if (!slot) throw unprocessable("That time is outside the provider's working hours.")
  if (!slot.available) throw conflict('That slot was just taken. Pick another time.')
  if (input.durationMinutes > slot.durationMinutes) {
    throw unprocessable(`Slots with this provider are ${slot.durationMinutes} minutes.`)
  }

  const id = newId()
  const end = new Date(startsAt.getTime() + input.durationMinutes * 60_000)
  await runTransaction(async (tx) => {
    // Reads first: the slot lock and any live booking that overlaps.
    if (await slotIsTaken(provider.id, startsAt, tx)) throw conflict('That slot was just taken. Pick another time.', 'slot_taken')
    const overlapping = await listBookedRanges(provider.id, startsAt, end, tx)
    if (overlapping.length > 0) throw conflict('That slot was just taken. Pick another time.', 'slot_taken')

    await insertAppointment(
      {
        id,
        tenantId: provider.tenantId,
        memberId: member.id,
        memberName: fullName(member),
        providerId: provider.id,
        providerName: `${provider.firstName} ${provider.lastName}`.trim(),
        discipline: provider.discipline,
        channel: input.channel,
        startsAt,
        durationMinutes: input.durationMinutes,
        status: 'confirmed',
        priceMinor: provider.sessionRateMinor,
        currency: provider.currency,
        joinUrl: joinUrlFor(input.channel, provider.phone),
        notes: input.notes?.trim() || null,
        memberGoal: input.goal?.trim() || null,
      },
      tx,
    )
  }).catch((error: { code?: number }) => {
    // ALREADY_EXISTS on the lock: someone committed the same slot first.
    if (error.code === 6) throw conflict('That slot was just taken. Pick another time.', 'slot_taken')
    throw error
  })

  const row = await findAppointmentRow(id)
  if (!row) throw notFound()
  return toAppointment(row)
}

function assertCanManage(viewer: UserProfile, row: AppointmentRow, allowMember: boolean) {
  const isMember = allowMember && row.memberId === viewer.id
  const isProvider = row.providerId === viewer.id
  const isAdmin = viewer.role === Role.Admin && row.tenantId === viewer.tenantId
  const isPlatform = viewer.role === Role.AppManager
  if (!isMember && !isProvider && !isAdmin && !isPlatform) throw forbidden()
}

export async function cancel(viewer: UserProfile, appointmentId: string): Promise<Appointment> {
  const row = await findAppointmentRow(appointmentId)
  if (!row) throw notFound('Appointment not found.')
  assertCanManage(viewer, row, true)
  if (row.status === 'cancelled') return toAppointment(row)
  if (row.status === 'completed' || row.status === 'no_show') throw conflict('That session has already taken place.')
  await setAppointmentStatus(row.id, 'cancelled')
  return toAppointment((await findAppointmentRow(row.id))!)
}

/** Providers and admins move a session through confirmed → completed / no_show. */
export async function updateStatus(
  viewer: UserProfile,
  appointmentId: string,
  status: Extract<AppointmentStatus, 'confirmed' | 'completed' | 'no_show'>,
): Promise<Appointment> {
  const row = await findAppointmentRow(appointmentId)
  if (!row) throw notFound('Appointment not found.')
  assertCanManage(viewer, row, false)
  if (row.status === 'cancelled') throw conflict('That session was cancelled.')
  await setAppointmentStatus(row.id, status)
  return toAppointment((await findAppointmentRow(row.id))!)
}
