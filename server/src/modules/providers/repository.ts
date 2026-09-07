import type { Timestamp } from 'firebase-admin/firestore'
import { col, db, docOf, Timestamp as Ts } from '../../db/firestore.js'
import type { Discipline, MeetingChannel, Provider } from '../../domain.js'
import type { UserDoc } from '../users/repository.js'

export type Hours = { weekday: number; startMinute: number; endMinute: number }
export type TimeOff = { startsAt: Timestamp; endsAt: Timestamp; reason: string | null }

/** providers/{userId}: the bookable half of a coach/clinician; the person is users/{userId}. */
export type ProviderDoc = {
  discipline: Discipline
  reviewCount: number
  sessionRateMinor: number
  currency: Provider['sessionRate']['currency']
  channels: MeetingChannel[]
  timezone: string
  slotMinutes: number
  acceptingBookings: boolean
  hours: Hours[]
  timeOff: TimeOff[]
}

/** Provider + the user fields the API exposes, joined in code. */
export type ProviderRow = ProviderDoc & {
  id: string
  tenantId: string
  firstName: string
  lastName: string
  avatarUrl: string | null
  phone: string | null
  title: string | null
  bio: string | null
  credentials: string[]
  rating: number | null
  status: UserDoc['status']
}

const providers = () => db.collection(col.providers)
const users = () => db.collection(col.users)

function join(providerId: string, p: ProviderDoc, u: UserDoc | null): ProviderRow | null {
  if (!u || u.status !== 'active') return null
  return {
    id: providerId,
    ...p,
    tenantId: u.tenantId,
    firstName: u.firstName,
    lastName: u.lastName,
    avatarUrl: u.avatarUrl,
    phone: u.phone,
    title: u.title,
    bio: u.bio,
    credentials: u.credentials ?? [],
    rating: u.rating,
    status: u.status,
  }
}

export function toProvider(row: ProviderRow): Provider {
  return {
    id: row.id,
    name: `${row.firstName} ${row.lastName}`.trim(),
    avatarUrl: row.avatarUrl,
    discipline: row.discipline,
    title: row.title ?? 'Coach',
    bio: row.bio ?? '',
    credentials: row.credentials,
    rating: row.rating ?? 0,
    reviewCount: row.reviewCount,
    sessionRate: { amountMinor: row.sessionRateMinor, currency: row.currency },
    channels: row.channels,
    timezone: row.timezone,
  }
}

export async function listProviderRows(filter: { discipline?: Discipline | undefined }): Promise<ProviderRow[]> {
  let q: FirebaseFirestore.Query = providers().where('acceptingBookings', '==', true)
  if (filter.discipline) q = q.where('discipline', '==', filter.discipline)
  const snap = await q.get()
  if (snap.empty) return []
  const people = await db.getAll(...snap.docs.map((d) => users().doc(d.id)))
  const rows: ProviderRow[] = []
  snap.docs.forEach((d, i) => {
    const row = join(d.id, d.data() as ProviderDoc, docOf<UserDoc>(people[i]!))
    if (row) rows.push(row)
  })
  return rows.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0) || a.lastName.localeCompare(b.lastName))
}

export async function findProviderRow(id: string): Promise<ProviderRow | null> {
  const [p, u] = await db.getAll(providers().doc(id), users().doc(id))
  if (!p?.exists) return null
  return join(id, p.data() as ProviderDoc, docOf<UserDoc>(u!))
}

export type NewProvider = {
  userId: string
  discipline: Discipline
  reviewCount?: number
  sessionRateMinor: number
  currency?: string
  channels: readonly MeetingChannel[]
  timezone?: string
  slotMinutes?: number
}

export async function insertProvider(p: NewProvider): Promise<void> {
  const doc: ProviderDoc = {
    discipline: p.discipline,
    reviewCount: p.reviewCount ?? 0,
    sessionRateMinor: p.sessionRateMinor,
    currency: (p.currency ?? 'USD') as ProviderDoc['currency'],
    channels: [...p.channels],
    timezone: p.timezone ?? 'America/New_York',
    slotMinutes: p.slotMinutes ?? 60,
    acceptingBookings: true,
    hours: [],
    timeOff: [],
  }
  await providers().doc(p.userId).create(doc)
}

/** Replaces the provider's weekly working hours. */
export async function setHours(providerId: string, hours: readonly Hours[]): Promise<void> {
  await providers().doc(providerId).update({ hours: [...hours] })
}

export async function addTimeOff(providerId: string, off: { startsAt: Date; endsAt: Date; reason?: string | null }): Promise<void> {
  const ref = providers().doc(providerId)
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref)
    const current = (snap.data() as ProviderDoc | undefined)?.timeOff ?? []
    tx.update(ref, { timeOff: [...current, { startsAt: Ts.fromDate(off.startsAt), endsAt: Ts.fromDate(off.endsAt), reason: off.reason ?? null }] })
  })
}
