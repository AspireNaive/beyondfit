import type { AppointmentId, IsoDate, IsoDateTime, Money, UserId } from '@/domain/shared/types'

/**
 * Scheduling context.
 *
 * Coaching sessions and clinical consultations are the same aggregate on
 * purpose: both are "a member books a slot with a provider, on a channel, for
 * a duration". Splitting them would duplicate availability, conflict checks,
 * cancellation windows and reminders for no modelling gain — the difference is
 * a `discipline` on the provider and the copy around it.
 */

export const Discipline = {
  Coaching: 'coaching',
  Nutrition: 'nutrition',
  Physiotherapy: 'physiotherapy',
  Medical: 'medical',
  MentalPerformance: 'mental_performance',
} as const

export type Discipline = (typeof Discipline)[keyof typeof Discipline]

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  [Discipline.Coaching]: 'Strength & Conditioning',
  [Discipline.Nutrition]: 'Nutrition',
  [Discipline.Physiotherapy]: 'Physiotherapy',
  [Discipline.Medical]: 'Medical',
  [Discipline.MentalPerformance]: 'Mental Performance',
}

export const DISCIPLINE_BLURB: Record<Discipline, string> = {
  [Discipline.Coaching]: 'Programming, technique and progressive overload.',
  [Discipline.Nutrition]: 'Fuelling, body composition and sustainable habits.',
  [Discipline.Physiotherapy]: 'Pain, movement screening and return to sport.',
  [Discipline.Medical]: 'Bloodwork, hormones and clinical clearance.',
  [Discipline.MentalPerformance]: 'Focus, motivation and competition mindset.',
}

/** How the session actually happens. */
export const MeetingChannel = {
  Zoom: 'zoom',
  GoogleMeet: 'google_meet',
  Phone: 'phone',
  InPerson: 'in_person',
} as const

export type MeetingChannel = (typeof MeetingChannel)[keyof typeof MeetingChannel]

export const CHANNEL_LABELS: Record<MeetingChannel, string> = {
  [MeetingChannel.Zoom]: 'Zoom',
  [MeetingChannel.GoogleMeet]: 'Google Meet',
  [MeetingChannel.Phone]: 'Phone call',
  [MeetingChannel.InPerson]: 'In person',
}

export const AppointmentStatus = {
  Pending: 'pending',
  Confirmed: 'confirmed',
  Completed: 'completed',
  Cancelled: 'cancelled',
  NoShow: 'no_show',
} as const

export type AppointmentStatus = (typeof AppointmentStatus)[keyof typeof AppointmentStatus]

export type Provider = {
  readonly id: UserId
  readonly name: string
  readonly avatarUrl?: string | null
  readonly discipline: Discipline
  readonly title: string
  readonly bio: string
  readonly credentials: readonly string[]
  readonly rating: number
  readonly reviewCount: number
  readonly sessionRate: Money
  readonly channels: readonly MeetingChannel[]
  readonly nextAvailable?: IsoDate
  readonly timezone: string
}

/** A bookable 30/45/60-minute window on a provider's calendar. */
export type AvailabilitySlot = {
  readonly startsAt: IsoDateTime
  readonly durationMinutes: number
  readonly available: boolean
}

export type Appointment = {
  readonly id: AppointmentId
  readonly memberId: UserId
  readonly memberName: string
  readonly providerId: UserId
  readonly providerName: string
  readonly discipline: Discipline
  readonly channel: MeetingChannel
  readonly startsAt: IsoDateTime
  readonly durationMinutes: number
  readonly status: AppointmentStatus
  readonly price: Money
  /** Zoom/Meet URL, or the number to dial for a phone consult. */
  readonly joinUrl?: string
  readonly notes?: string
  readonly memberGoal?: string
  readonly createdAt: IsoDateTime
}

export const APPOINTMENT_STATUS_TONE = {
  [AppointmentStatus.Pending]: 'warn',
  [AppointmentStatus.Confirmed]: 'ok',
  [AppointmentStatus.Completed]: 'info',
  [AppointmentStatus.Cancelled]: 'neutral',
  [AppointmentStatus.NoShow]: 'danger',
} as const

export const endsAt = (appointment: Appointment): Date =>
  new Date(new Date(appointment.startsAt).getTime() + appointment.durationMinutes * 60_000)

export const isUpcoming = (appointment: Appointment, now = new Date()): boolean =>
  endsAt(appointment) > now &&
  appointment.status !== AppointmentStatus.Cancelled &&
  appointment.status !== AppointmentStatus.NoShow

/**
 * Members may cancel free of charge up to this point; inside the window the
 * session is billed. Encoded here so the booking screen, the detail drawer and
 * (later) the .NET service all agree on one rule.
 */
export const CANCELLATION_WINDOW_HOURS = 24

export const canCancelFreeOfCharge = (appointment: Appointment, now = new Date()): boolean =>
  new Date(appointment.startsAt).getTime() - now.getTime() >
  CANCELLATION_WINDOW_HOURS * 3_600_000

export type BookAppointmentRequest = {
  readonly providerId: UserId
  readonly startsAt: IsoDateTime
  readonly durationMinutes: number
  readonly channel: MeetingChannel
  readonly goal?: string
  readonly notes?: string
}
