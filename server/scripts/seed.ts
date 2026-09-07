/**
 * Demo seed — loads the same deterministic fixtures the front end's mock
 * adapter used (src/infrastructure/mock/seed.ts) into Firestore, so the app
 * looks identical after the switch to real data. Every demo account's
 * password is DEMO_PASSWORD ("kedemlife").
 *
 *   npm run db:seed            # adds documents (fails on duplicates)
 *   npm run db:seed -- --reset # empties every collection first
 *
 * Point it at the emulator (FIRESTORE_EMULATOR_HOST) or at the real project
 * (FIREBASE_SERVICE_ACCOUNT). For a production studio use `db:bootstrap`.
 */
import { fileURLToPath } from 'node:url'
import {
  ACTIVITY,
  APPOINTMENTS,
  BODY_METRICS,
  DEMO_PASSWORD,
  GOALS,
  ORDERS,
  PAYMENTS,
  PRODUCTS,
  PROVIDERS,
  SUBSCRIPTIONS,
  TENANTS,
  USERS,
} from '@/infrastructure/mock/seed'
import { hashPassword } from '../src/auth/password.js'
import { col, db, deleteEverything, Timestamp } from '../src/db/firestore.js'
import { HttpError } from '../src/lib/errors.js'
import { newId } from '../src/lib/ids.js'
import { insertAppointment } from '../src/modules/appointments/repository.js'
import { insertProduct } from '../src/modules/catalog/repository.js'
import { insertOrder, insertSubscription, paymentDoc } from '../src/modules/orders/repository.js'
import { activityId, metricDoc } from '../src/modules/progress/repository.js'
import { insertProvider, setHours } from '../src/modules/providers/repository.js'
import { insertTenant } from '../src/modules/tenants/repository.js'
import { insertUser } from '../src/modules/users/repository.js'

/** Mon–Fri 07:00–19:00, Sat–Sun 07:00–14:00 — the hours the mock implied. */
const DEFAULT_HOURS = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  startMinute: 7 * 60,
  endMinute: weekday === 0 || weekday === 6 ? 14 * 60 : 19 * 60,
}))

const log = (line: string) => console.log(line)

export async function seed(options: { reset?: boolean } = {}): Promise<void> {
  if (options.reset) {
    await deleteEverything()
    log('collections emptied')
  }

  for (const t of TENANTS) {
    await insertTenant({
      id: t.id, name: t.name, slug: t.slug, plan: t.plan, seats: t.seats, primaryColor: t.primaryColor ?? null,
      // TENANTS[0] is the studio every demo person belongs to.
      isDefault: t === TENANTS[0], createdAt: t.createdAt,
    })
  }
  log(`tenants: ${TENANTS.length}`)

  const passwordHash = await hashPassword(DEMO_PASSWORD)
  for (const u of USERS) {
    await insertUser({
      id: u.id, tenantId: u.tenantId, role: u.role, firstName: u.firstName, lastName: u.lastName, email: u.email,
      passwordHash, phone: u.phone ?? null, title: u.title ?? null, bio: u.bio ?? null, location: u.location ?? null,
      joinedAt: u.joinedAt, specialties: u.specialties ?? null, credentials: u.credentials ?? null,
      rating: u.rating ?? null, sessionsDelivered: u.sessionsDelivered ?? null, assignedCoachId: u.assignedCoachId ?? null, status: u.status,
    })
  }
  log(`users: ${USERS.length}`)

  for (const p of PROVIDERS) {
    await insertProvider({
      userId: p.id, discipline: p.discipline, reviewCount: p.reviewCount, sessionRateMinor: p.sessionRate.amountMinor,
      currency: p.sessionRate.currency, channels: p.channels, timezone: p.timezone, slotMinutes: 60,
    })
    await setHours(p.id, DEFAULT_HOURS)
  }
  log(`providers: ${PROVIDERS.length}`)

  let appointments = 0
  let skipped = 0
  for (const a of APPOINTMENTS) {
    const member = USERS.find((u) => u.id === a.memberId)!
    try {
      await insertAppointment({
        id: a.id, tenantId: member.tenantId, memberId: a.memberId, memberName: a.memberName, providerId: a.providerId,
        providerName: a.providerName, discipline: a.discipline, channel: a.channel, startsAt: new Date(a.startsAt),
        durationMinutes: a.durationMinutes, status: a.status, priceMinor: a.price.amountMinor, currency: a.price.currency,
        joinUrl: a.joinUrl ?? null, notes: a.notes || null, memberGoal: a.memberGoal ?? null, createdAt: new Date(a.createdAt),
      })
      appointments++
    } catch (error) {
      // The random fixtures can double-book a slot; the slot lock (rightly) refuses.
      if (error instanceof HttpError && error.code === 'slot_taken') skipped++
      else throw error
    }
  }
  log(`appointments: ${appointments} (${skipped} clashing fixtures skipped)`)

  const writer = db.bulkWriter()
  for (const m of BODY_METRICS) {
    const { id, data } = metricDoc(m)
    writer.set(db.collection(col.bodyMetrics).doc(id), { ...data, updatedAt: Timestamp.now() })
  }
  for (const a of ACTIVITY) writer.set(db.collection(col.activity).doc(activityId(a)), { ...a, updatedAt: Timestamp.now() })
  for (const g of GOALS) {
    writer.set(db.collection(col.goals).doc(g.memberId), { ...g, targetWeightKg: g.targetWeightKg ?? null, updatedAt: Timestamp.now() })
  }
  await writer.close()
  log(`body metrics: ${BODY_METRICS.length}, activity days: ${ACTIVITY.length}, goals: ${GOALS.length}`)

  for (const p of PRODUCTS) {
    await insertProduct({
      id: p.id, slug: p.slug, name: p.name, tagline: p.tagline, description: p.description, category: p.category,
      priceMinor: p.price.amountMinor, currency: p.price.currency, compareAtMinor: p.compareAtPrice?.amountMinor ?? null,
      imageUrl: p.imageUrl ?? null, accent: p.accent, rating: p.rating, reviewCount: p.reviewCount, inStock: p.inStock,
      badge: p.badge ?? null, digital: p.digital, instructorId: p.instructorId ?? null,
    })
  }
  log(`products: ${PRODUCTS.length}`)

  // Oldest first so order numbers ascend with time.
  for (const o of [...ORDERS].reverse()) {
    const customer = USERS.find((u) => u.id === o.customerId)!
    await insertOrder({
      id: o.id, tenantId: customer.tenantId, customerId: o.customerId, customerName: o.customerName, customerEmail: o.customerEmail,
      subtotalMinor: o.subtotal.amountMinor, shippingMinor: o.shipping.amountMinor, taxMinor: o.tax.amountMinor,
      totalMinor: o.total.amountMinor, currency: o.total.currency, status: o.status, placedAt: new Date(o.placedAt),
      trackingNumber: o.trackingNumber ?? null,
      lines: o.lines.map((l) => ({ productId: l.productId, name: l.name, quantity: l.quantity, unitPriceMinor: l.unitPrice.amountMinor, currency: l.unitPrice.currency, instructorId: l.instructorId ?? null })),
    })
  }
  log(`orders: ${ORDERS.length}`)

  const payWriter = db.bulkWriter()
  for (const p of PAYMENTS) {
    const customer = USERS.find((u) => u.id === p.customerId)!
    payWriter.create(
      db.collection(col.payments).doc(p.id),
      paymentDoc({
        id: p.id, tenantId: customer.tenantId, reference: p.reference, orderId: p.orderId ?? null, customerId: p.customerId,
        customerName: p.customerName, description: p.description, grossMinor: p.gross.amountMinor, feeMinor: p.fee.amountMinor,
        currency: p.gross.currency, method: p.method, cardLast4: p.cardLast4 ?? null, cardBrand: p.cardBrand ?? null,
        status: p.status, provider: 'seed', processedAt: new Date(p.processedAt), payoutId: p.payoutId ?? null,
      }),
    )
  }
  await payWriter.close()
  log(`payments: ${PAYMENTS.length}`)

  for (const s of SUBSCRIPTIONS) {
    const member = USERS.find((u) => u.id === s.memberId)!
    await insertSubscription({
      id: newId(), tenantId: member.tenantId, memberId: s.memberId, memberName: s.memberName, productId: 'p-9',
      planName: s.planName, priceMinor: s.price.amountMinor, currency: s.price.currency, interval: s.interval,
      status: s.status, startedAt: new Date(s.startedAt), renewsAt: new Date(s.renewsAt),
    })
  }
  log(`subscriptions: ${SUBSCRIPTIONS.length}`)
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isDirectRun) {
  seed({ reset: process.argv.includes('--reset') })
    .then(() => {
      console.log('seed complete')
      process.exit(0)
    })
    .catch((error) => {
      console.error(error)
      process.exit(1)
    })
}
