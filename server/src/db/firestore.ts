import { applicationDefault, cert, getApps, initializeApp, type App } from 'firebase-admin/app'
import {
  FieldValue,
  Timestamp,
  getFirestore,
  type DocumentSnapshot,
  type Firestore,
  type Transaction,
} from 'firebase-admin/firestore'
import { config } from '../config.js'

/**
 * One Firestore client per process. Credentials, in order of preference:
 * the emulator (development and tests, no credentials at all), a service
 * account passed through the environment (GoDaddy), or Application Default
 * Credentials (Google-hosted runtimes).
 */
function app(): App {
  const existing = getApps()[0]
  if (existing) return existing
  if (config.firebase.emulatorHost) {
    process.env.FIRESTORE_EMULATOR_HOST = config.firebase.emulatorHost
    return initializeApp({ projectId: config.firebase.projectId })
  }
  if (config.firebase.serviceAccount) {
    return initializeApp({
      credential: cert(config.firebase.serviceAccount),
      projectId: config.firebase.serviceAccount.projectId ?? config.firebase.projectId,
    })
  }
  return initializeApp({ credential: applicationDefault(), projectId: config.firebase.projectId })
}

export const db: Firestore = (() => {
  const firestore = getFirestore(app(), config.firebase.databaseId)
  firestore.settings({ ignoreUndefinedProperties: true, preferRest: config.firebase.preferRest })
  return firestore
})()

/** Collection names in one place, so a rename is a one-line change. */
export const col = {
  tenants: 'tenants',
  users: 'users',
  /** email → { userId }; gives Firestore the unique constraint it lacks. */
  userEmails: 'userEmails',
  providers: 'providers',
  appointments: 'appointments',
  /** `${providerId}_${startsAtMs}` → { appointmentId }; one live booking per slot. */
  slotLocks: 'slotLocks',
  bodyMetrics: 'bodyMetrics',
  activity: 'activity',
  goals: 'goals',
  products: 'products',
  productSlugs: 'productSlugs',
  orders: 'orders',
  payments: 'payments',
  subscriptions: 'subscriptions',
  counters: 'counters',
  refreshTokens: 'refreshTokens',
  passwordResetTokens: 'passwordResetTokens',
  contactMessages: 'contactMessages',
  newsletterSubscribers: 'newsletterSubscribers',
  foodEntries: 'foodEntries',
  /** entryId → { dataUrl }; kept apart so diary lists stay light. */
  foodPhotos: 'foodPhotos',
  dietPlans: 'dietPlans',
  posts: 'posts',
  /** slug → { postId }; one public link per article. */
  postSlugs: 'postSlugs',
} as const

export const ALL_COLLECTIONS = Object.values(col)

export type Tx = Transaction
export { FieldValue, Timestamp }

export const toTimestamp = (d: Date) => Timestamp.fromDate(d)
export const toIso = (t: Timestamp | null | undefined): string | undefined => (t ? t.toDate().toISOString() : undefined)
export const toDate = (t: Timestamp) => t.toDate()

/** Snapshot → `{ id, ...data }` or null. */
export function docOf<T>(snap: DocumentSnapshot): (T & { id: string }) | null {
  if (!snap.exists) return null
  return { id: snap.id, ...(snap.data() as T) }
}

export const runTransaction = <T>(fn: (tx: Transaction) => Promise<T>) => db.runTransaction(fn)

export function chunk<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}

/** Every document in every collection — for `seed --reset` and test setup only. */
export async function deleteEverything(): Promise<void> {
  if (config.firebase.emulatorHost) {
    const url = `http://${config.firebase.emulatorHost}/emulator/v1/projects/${config.firebase.projectId}/databases/${encodeURIComponent(config.firebase.databaseId)}/documents`
    const res = await fetch(url, { method: 'DELETE' })
    if (!res.ok) throw new Error(`emulator clear failed: ${res.status}`)
    return
  }
  for (const name of ALL_COLLECTIONS) await db.recursiveDelete(db.collection(name))
}

/**
 * Firestore refuses a filtered+ordered query until its composite index exists.
 * gRPC reports FAILED_PRECONDITION (9); the REST transport GoDaddy uses reports
 * INVALID_ARGUMENT (3) with the same message — so match on the message too.
 */
export const isMissingIndexError = (err: unknown) => {
  if (typeof err !== 'object' || err === null) return false
  const { code, message } = err as { code?: number; message?: string }
  return code === 9 || /requires an index/i.test(message ?? '')
}

/** Boot-time reachability check; cheap and works against the emulator too. */
export async function ping(): Promise<void> {
  await db.collection(col.counters).doc('orders').get()
}
