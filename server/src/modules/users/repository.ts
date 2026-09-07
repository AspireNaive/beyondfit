import type { Timestamp } from 'firebase-admin/firestore'
import { col, db, docOf, runTransaction, chunk, type Tx, Timestamp as Ts } from '../../db/firestore.js'
import type { Role, UserProfile, UserStatus } from '../../domain.js'
import { conflict } from '../../lib/errors.js'

/** Stored shape of users/{id}. Nullables are explicit so queries on them work. */
export type UserDoc = {
  tenantId: string
  role: Role
  firstName: string
  lastName: string
  email: string
  passwordHash: string
  phone: string | null
  avatarUrl: string | null
  title: string | null
  bio: string | null
  location: string | null
  joinedAt: string
  specialties: string[] | null
  credentials: string[] | null
  rating: number | null
  sessionsDelivered: number | null
  assignedCoachId: string | null
  status: UserStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

export type UserRow = UserDoc & { id: string }

const users = () => db.collection(col.users)
const emails = () => db.collection(col.userEmails)

/** Strips the password hash and drops nulls the API contract leaves out. */
export function toUserProfile(row: UserRow): UserProfile {
  return {
    id: row.id,
    tenantId: row.tenantId,
    role: row.role,
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    ...(row.phone ? { phone: row.phone } : {}),
    avatarUrl: row.avatarUrl,
    ...(row.title ? { title: row.title } : {}),
    ...(row.bio ? { bio: row.bio } : {}),
    ...(row.location ? { location: row.location } : {}),
    joinedAt: row.joinedAt,
    ...(row.specialties ? { specialties: row.specialties } : {}),
    ...(row.credentials ? { credentials: row.credentials } : {}),
    ...(row.rating != null ? { rating: row.rating } : {}),
    ...(row.sessionsDelivered != null ? { sessionsDelivered: row.sessionsDelivered } : {}),
    assignedCoachId: row.assignedCoachId,
    status: row.status,
  }
}

export const fullName = (u: { firstName: string; lastName: string }) => `${u.firstName} ${u.lastName}`.trim()

const byName = (a: UserRow, b: UserRow) =>
  a.role.localeCompare(b.role) || a.lastName.localeCompare(b.lastName) || a.firstName.localeCompare(b.firstName)

export async function findUserRowById(id: string, tx?: Tx): Promise<UserRow | null> {
  const ref = users().doc(id)
  return docOf<UserDoc>(tx ? await tx.get(ref) : await ref.get())
}

export async function findUserById(id: string, tx?: Tx): Promise<UserProfile | null> {
  const row = await findUserRowById(id, tx)
  return row ? toUserProfile(row) : null
}

export async function findUserRowByEmail(email: string): Promise<UserRow | null> {
  const snap = await users().where('email', '==', email.trim().toLowerCase()).limit(1).get()
  const doc = snap.docs[0]
  return doc ? docOf<UserDoc>(doc) : null
}

export async function listUsers(where: {
  tenantId?: string
  role?: Role
  assignedCoachId?: string
  ids?: readonly string[]
}): Promise<UserProfile[]> {
  if (where.ids) {
    if (where.ids.length === 0) return []
    const rows: UserRow[] = []
    for (const ids of chunk(where.ids, 100)) {
      const snaps = await db.getAll(...ids.map((id) => users().doc(id)))
      for (const s of snaps) {
        const row = docOf<UserDoc>(s)
        if (row) rows.push(row)
      }
    }
    return rows.sort(byName).map(toUserProfile)
  }
  let q: FirebaseFirestore.Query = users()
  if (where.tenantId) q = q.where('tenantId', '==', where.tenantId)
  if (where.role) q = q.where('role', '==', where.role)
  if (where.assignedCoachId) q = q.where('assignedCoachId', '==', where.assignedCoachId)
  const snap = await q.get()
  return snap.docs
    .map((d) => docOf<UserDoc>(d)!)
    .sort(byName)
    .map(toUserProfile)
}

export type NewUser = {
  id: string
  tenantId: string
  role: Role
  firstName: string
  lastName: string
  email: string
  passwordHash: string
  phone?: string | null
  title?: string | null
  bio?: string | null
  location?: string | null
  joinedAt: string
  specialties?: readonly string[] | null
  credentials?: readonly string[] | null
  rating?: number | null
  sessionsDelivered?: number | null
  assignedCoachId?: string | null
  status?: UserStatus
}

function toDoc(u: NewUser): UserDoc {
  const now = Ts.now()
  return {
    tenantId: u.tenantId,
    role: u.role,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email.trim().toLowerCase(),
    passwordHash: u.passwordHash,
    phone: u.phone ?? null,
    avatarUrl: null,
    title: u.title ?? null,
    bio: u.bio ?? null,
    location: u.location ?? null,
    joinedAt: u.joinedAt,
    specialties: u.specialties ? [...u.specialties] : null,
    credentials: u.credentials ? [...u.credentials] : null,
    rating: u.rating ?? null,
    sessionsDelivered: u.sessionsDelivered ?? null,
    assignedCoachId: u.assignedCoachId ?? null,
    status: u.status ?? 'active',
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Creates the user and reserves the email in one transaction, so two
 * concurrent sign-ups with the same address cannot both succeed.
 */
export async function insertUser(u: NewUser): Promise<void> {
  const doc = toDoc(u)
  await runTransaction(async (tx) => {
    const emailRef = emails().doc(doc.email)
    if ((await tx.get(emailRef)).exists) throw conflict('An account already exists for that email.', 'email_taken')
    tx.create(emailRef, { userId: u.id })
    tx.create(users().doc(u.id), doc)
  })
}

export type UserPatch = Partial<{
  firstName: string
  lastName: string
  phone: string | null
  avatarUrl: string | null
  title: string | null
  bio: string | null
  location: string | null
  assignedCoachId: string | null
  status: UserStatus
  passwordHash: string
}>

export async function updateUser(id: string, patch: UserPatch, tx?: Tx): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  if (Object.keys(clean).length === 0) return
  const data = { ...clean, updatedAt: Ts.now() }
  if (tx) tx.update(users().doc(id), data)
  else await users().doc(id).update(data)
}

/** The coach new members are assigned to: the tenant's longest-serving active coach. */
export async function findDefaultCoach(tenantId: string): Promise<string | null> {
  const snap = await users().where('tenantId', '==', tenantId).where('role', '==', 'coach').where('status', '==', 'active').get()
  const rows = snap.docs.map((d) => docOf<UserDoc>(d)!).sort((a, b) => a.joinedAt.localeCompare(b.joinedAt) || a.id.localeCompare(b.id))
  return rows[0]?.id ?? null
}

/** Live seat count: active members in the tenant (server-side aggregation). */
export async function countActiveMembers(tenantId: string): Promise<number> {
  const agg = await users().where('tenantId', '==', tenantId).where('role', '==', 'member').where('status', '==', 'active').count().get()
  return agg.data().count
}
