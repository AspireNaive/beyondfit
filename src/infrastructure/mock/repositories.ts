import {
  AuthError,
  Role,
  type AuthSession,
  type LoginRequest,
  type RegisterRequest,
  type Tenant,
  type UserProfile,
} from '@/domain/identity/model'
import {
  AppointmentStatus,
  MeetingChannel,
  type Appointment,
  type AvailabilitySlot,
  type BookAppointmentRequest,
  type Provider,
} from '@/domain/scheduling/model'
import type {
  ActivityEntry,
  BodyMetricEntry,
  MemberGoal,
} from '@/domain/progress/model'
import {
  OrderStatus,
  cartShipping,
  cartSubtotal,
  cartTax,
  cartTotal,
  type CartLine,
  type Order,
  type Payment,
  type Product,
  type Subscription,
} from '@/domain/commerce/model'
import type {
  AuthPort,
  CatalogPort,
  Container,
  DirectoryPort,
  MarketingPort,
  OrdersPort,
  PaymentsPort,
  ProgressPort,
  SchedulingPort,
  TenantPort,
} from '@/domain/ports'
import { id, type IsoDate, type OrderId, type UserId } from '@/domain/shared/types'
import { today } from '@/shared/lib/dates'
import {
  ACTIVITY,
  APPOINTMENTS,
  BODY_METRICS,
  DEFAULT_TENANT,
  DEMO_PASSWORD,
  GOALS,
  ORDERS,
  PAYMENTS,
  PRODUCTS,
  PROVIDERS,
  SUBSCRIPTIONS,
  TENANTS,
  USERS,
  findUserByEmail,
} from './seed'

/** Simulated network latency so loading states are exercised in development. */
const LATENCY_MS = Number(import.meta.env.VITE_MOCK_LATENCY ?? 260)

const delay = <T>(value: T, ms = LATENCY_MS): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(value), ms))

const SESSION_KEY = 'beyondfit.session'

// Mutable copies: the mock layer is a stand-in write model, so bookings and
// orders made in the UI persist for the lifetime of the tab.
const appointments: Appointment[] = [...APPOINTMENTS]
const orders: Order[] = [...ORDERS]
const bodyMetrics: BodyMetricEntry[] = [...BODY_METRICS]
const users: UserProfile[] = [...USERS]

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

/**
 * Which roles a given sign-in portal accepts. Staff portals are deliberately
 * narrow: presenting member credentials at /admin/login fails even though the
 * credentials themselves are valid, which is what the API does.
 */
const PORTAL_ACCEPTS: Record<Role, readonly Role[]> = {
  [Role.Member]: [Role.Member],
  [Role.Coach]: [Role.Coach],
  [Role.Admin]: [Role.Admin, Role.AppManager],
  [Role.AppManager]: [Role.AppManager],
}

const tenantOf = (user: UserProfile): Tenant =>
  TENANTS.find((t) => t.id === user.tenantId) ?? DEFAULT_TENANT

function issueSession(user: UserProfile): AuthSession {
  const expiresAt = new Date(Date.now() + 8 * 3_600_000).toISOString()
  return {
    user,
    tenant: tenantOf(user),
    // Shaped like a JWT so swapping in the real token changes nothing here.
    accessToken: `mock.${btoa(JSON.stringify({ sub: user.id, role: user.role }))}.sig`,
    refreshToken: `mock-refresh-${user.id}`,
    expiresAt,
  }
}

const persist = (session: AuthSession | null) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    else localStorage.removeItem(SESSION_KEY)
  } catch {
    // Private mode / storage disabled — the session simply won't survive reload.
  }
}

class MockAuth implements AuthPort {
  async login(request: LoginRequest): Promise<AuthSession> {
    await delay(null, 420)

    const user = findUserByEmail(request.email)
    if (!user || request.password !== DEMO_PASSWORD) {
      throw new AuthError('That email and password combination is not recognised.', 'invalid_credentials')
    }
    if (user.status === 'suspended') {
      throw new AuthError('This account has been suspended. Contact your studio admin.', 'suspended')
    }
    if (!PORTAL_ACCEPTS[request.portal].includes(user.role)) {
      throw new AuthError(
        `These credentials belong to a ${user.role.replace('_', ' ')} account. Use the matching sign-in page.`,
        'wrong_portal',
      )
    }

    const session = issueSession(user)
    persist(session)
    return session
  }

  async register(request: RegisterRequest): Promise<AuthSession> {
    await delay(null, 520)

    if (findUserByEmail(request.email)) {
      throw new AuthError('An account already exists for that email.', 'email_taken')
    }
    if (request.password.length < 8) {
      throw new AuthError('Use at least 8 characters.', 'weak_password')
    }

    const created: UserProfile = {
      id: id<'User'>(`u-member-${users.length + 1}`),
      tenantId: DEFAULT_TENANT.id,
      role: Role.Member,
      firstName: request.firstName,
      lastName: request.lastName,
      email: request.email,
      phone: request.phone,
      title: request.goal,
      joinedAt: today(),
      // New members land with the head coach until an admin reassigns them.
      assignedCoachId: id<'User'>('u-coach-mara'),
      avatarUrl: null,
      status: 'active',
    }
    users.push(created)

    const session = issueSession(created)
    persist(session)
    return session
  }

  async logout(): Promise<void> {
    persist(null)
    await delay(null, 120)
  }

  async restore(): Promise<AuthSession | null> {
    try {
      const raw = localStorage.getItem(SESSION_KEY)
      if (!raw) return null
      const session = JSON.parse(raw) as AuthSession
      if (new Date(session.expiresAt) < new Date()) {
        persist(null)
        return null
      }
      // Re-read the user so profile edits made this session are reflected.
      const fresh = users.find((u) => u.id === session.user.id)
      return fresh ? { ...session, user: fresh } : session
    } catch {
      return null
    }
  }

  async requestPasswordReset(_email: string): Promise<void> {
    await delay(null, 400)
  }

  async resetPassword(_token: string, _password: string): Promise<void> {
    await delay(null, 400)
  }
}

// ---------------------------------------------------------------------------
// Directory
// ---------------------------------------------------------------------------

class MockDirectory implements DirectoryPort {
  async listMappedProfiles(viewer: UserProfile): Promise<readonly UserProfile[]> {
    const sameTenant = users.filter((u) => u.tenantId === viewer.tenantId)

    // Always include the viewer themselves, per the "and self" requirement.
    const withSelf = (list: readonly UserProfile[]) =>
      list.some((u) => u.id === viewer.id) ? list : [viewer, ...list]

    switch (viewer.role) {
      case Role.Member: {
        // Their coach, plus every other bookable specialist they may consult.
        const coaches = sameTenant.filter((u) => u.role === Role.Coach)
        return delay(withSelf(coaches))
      }
      case Role.Coach: {
        const assigned = sameTenant.filter((u) => u.assignedCoachId === viewer.id)
        const peers = sameTenant.filter((u) => u.role === Role.Coach && u.id !== viewer.id)
        return delay(withSelf([...assigned, ...peers]))
      }
      case Role.Admin:
        return delay(withSelf(sameTenant))
      case Role.AppManager:
        return delay(withSelf(users))
    }
  }

  async getProfile(userId: UserId): Promise<UserProfile | null> {
    return delay(users.find((u) => u.id === userId) ?? null, 180)
  }

  async listByRole(role: Role): Promise<readonly UserProfile[]> {
    return delay(users.filter((u) => u.role === role))
  }
}

// ---------------------------------------------------------------------------
// Scheduling
// ---------------------------------------------------------------------------

/** Working hours a provider offers, before existing bookings are removed. */
const WORKING_HOURS = [7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]

class MockScheduling implements SchedulingPort {
  async listProviders(filter?: { discipline?: string; query?: string }) {
    let result: readonly Provider[] = PROVIDERS
    if (filter?.discipline) result = result.filter((p) => p.discipline === filter.discipline)
    if (filter?.query) {
      const q = filter.query.toLowerCase()
      result = result.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.title.toLowerCase().includes(q) ||
          p.credentials.some((c) => c.toLowerCase().includes(q)),
      )
    }
    return delay(result)
  }

  async getProvider(providerId: UserId) {
    return delay(PROVIDERS.find((p) => p.id === providerId) ?? null, 180)
  }

  async getAvailability(providerId: UserId, date: IsoDate): Promise<readonly AvailabilitySlot[]> {
    const taken = new Set(
      appointments
        .filter(
          (a) =>
            a.providerId === providerId &&
            a.startsAt.slice(0, 10) === date &&
            a.status !== AppointmentStatus.Cancelled,
        )
        .map((a) => new Date(a.startsAt).getHours()),
    )

    const day = new Date(`${date}T00:00:00`)
    const isWeekend = day.getDay() === 0 || day.getDay() === 6
    // Compare against the viewer's local calendar day, not UTC — west of
    // Greenwich in the evening, UTC has already rolled over and today's
    // remaining slots would be wrongly greyed out as past.
    const isPast = date < today()

    // Deterministic per provider+date, so the grid doesn't reshuffle on rerender.
    const seed = [...`${providerId}${date}`].reduce((acc, ch) => acc + ch.charCodeAt(0), 0)

    const slots = WORKING_HOURS.filter((hour) => !(isWeekend && hour > 13)).flatMap<AvailabilitySlot>(
      (hour, index) => {
        const startsAt = new Date(day)
        startsAt.setHours(hour, 0, 0, 0)
        const blockedByPattern = (seed + index * 7) % 5 === 0
        return [
          {
            startsAt: startsAt.toISOString(),
            durationMinutes: 60,
            available: !isPast && !taken.has(hour) && !blockedByPattern && startsAt > new Date(),
          },
        ]
      },
    )

    return delay(slots, 220)
  }

  async listAppointments(viewer: UserProfile): Promise<readonly Appointment[]> {
    let result = appointments
    if (viewer.role === Role.Member) result = result.filter((a) => a.memberId === viewer.id)
    else if (viewer.role === Role.Coach) result = result.filter((a) => a.providerId === viewer.id)
    return delay([...result].sort((a, b) => a.startsAt.localeCompare(b.startsAt)))
  }

  async book(request: BookAppointmentRequest, member: UserProfile): Promise<Appointment> {
    await delay(null, 520)

    const provider = PROVIDERS.find((p) => p.id === request.providerId)
    if (!provider) throw new Error('That provider is no longer taking bookings.')

    const clash = appointments.find(
      (a) =>
        a.providerId === request.providerId &&
        a.startsAt === request.startsAt &&
        a.status !== AppointmentStatus.Cancelled,
    )
    if (clash) throw new Error('That slot was just taken. Pick another time.')

    const created: Appointment = {
      id: id<'Appointment'>(`a-${appointments.length + 1}-${Date.now()}`),
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`,
      providerId: provider.id,
      providerName: provider.name,
      discipline: provider.discipline,
      channel: request.channel,
      startsAt: request.startsAt,
      durationMinutes: request.durationMinutes,
      status: AppointmentStatus.Confirmed,
      price: provider.sessionRate,
      joinUrl:
        request.channel === MeetingChannel.Zoom
          ? `https://zoom.us/j/9${Date.now().toString().slice(-8)}`
          : request.channel === MeetingChannel.GoogleMeet
            ? `https://meet.google.com/bf${Date.now().toString().slice(-3)}-beyond-fit`
            : request.channel === MeetingChannel.Phone
              ? 'tel:+18455550142'
              : undefined,
      memberGoal: request.goal,
      notes: request.notes,
      createdAt: new Date().toISOString(),
    }

    appointments.push(created)
    return created
  }

  async cancel(appointmentId: Appointment['id']): Promise<Appointment> {
    await delay(null, 380)
    const index = appointments.findIndex((a) => a.id === appointmentId)
    if (index === -1) throw new Error('Appointment not found.')
    const updated = { ...appointments[index]!, status: AppointmentStatus.Cancelled }
    appointments[index] = updated
    return updated
  }
}

// ---------------------------------------------------------------------------
// Progress
// ---------------------------------------------------------------------------

class MockProgress implements ProgressPort {
  async listBodyMetrics(memberId: UserId): Promise<readonly BodyMetricEntry[]> {
    return delay(
      bodyMetrics
        .filter((m) => m.memberId === memberId)
        .sort((a, b) => a.recordedOn.localeCompare(b.recordedOn)),
    )
  }

  async listActivity(memberId: UserId, days: number): Promise<readonly ActivityEntry[]> {
    const rows = ACTIVITY.filter((a) => a.memberId === memberId).sort((a, b) =>
      a.date.localeCompare(b.date),
    )
    return delay(rows.slice(-days))
  }

  async getGoal(memberId: UserId): Promise<MemberGoal> {
    const goal = GOALS.find((g) => g.memberId === memberId)
    return delay(
      goal ?? {
        memberId,
        dailyCalorieTarget: 2200,
        dailyProteinTarget: 150,
        dailyStepTarget: 10_000,
        weeklyWorkoutTarget: 4,
        focus: 'General health',
      },
      160,
    )
  }

  async logBodyMetric(entry: Omit<BodyMetricEntry, 'id'>): Promise<BodyMetricEntry> {
    await delay(null, 420)
    const created: BodyMetricEntry = { ...entry, id: id<'MetricEntry'>(`m-${Date.now()}`) }
    // Same-day re-logging overwrites rather than creating a duplicate point.
    const existing = bodyMetrics.findIndex(
      (m) => m.memberId === entry.memberId && m.recordedOn === entry.recordedOn,
    )
    if (existing >= 0) bodyMetrics[existing] = created
    else bodyMetrics.push(created)
    return created
  }
}

// ---------------------------------------------------------------------------
// Catalogue, orders, payments, tenants
// ---------------------------------------------------------------------------

class MockCatalog implements CatalogPort {
  async listProducts(filter?: { category?: string; query?: string }) {
    let result: readonly Product[] = PRODUCTS
    if (filter?.category) result = result.filter((p) => p.category === filter.category)
    if (filter?.query) {
      const q = filter.query.toLowerCase()
      result = result.filter(
        (p) => p.name.toLowerCase().includes(q) || p.tagline.toLowerCase().includes(q),
      )
    }
    return delay(result)
  }

  async getProduct(slug: string) {
    return delay(PRODUCTS.find((p) => p.slug === slug) ?? null, 180)
  }
}

class MockOrders implements OrdersPort {
  async listOrders(viewer: UserProfile): Promise<readonly Order[]> {
    let result = orders
    if (viewer.role === Role.Member) {
      result = result.filter((o) => o.customerId === viewer.id)
    } else if (viewer.role === Role.Coach) {
      // A coach sees orders that contain something they authored.
      result = result.filter((o) => o.lines.some((l) => l.instructorId === viewer.id))
    }
    return delay(result)
  }

  async getOrder(orderId: OrderId) {
    return delay(orders.find((o) => o.id === orderId) ?? null, 180)
  }

  async placeOrder(lines: readonly CartLine[], customer: UserProfile): Promise<Order> {
    // The mock ignores the payment method; the HTTP adapter forwards it.
    await delay(null, 800)
    if (lines.length === 0) throw new Error('Your cart is empty.')

    const created: Order = {
      id: id<'Order'>(`o-${Date.now()}`),
      reference: `BF-${10_500 + orders.length}`,
      customerId: customer.id,
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerEmail: customer.email,
      lines: lines.map((line) => ({
        productId: line.product.id,
        name: line.product.name,
        quantity: line.quantity,
        unitPrice: line.product.price,
        instructorId: line.product.instructorId,
      })),
      subtotal: cartSubtotal(lines),
      shipping: cartShipping(lines),
      tax: cartTax(lines),
      total: cartTotal(lines),
      status: OrderStatus.Paid,
      placedAt: new Date().toISOString(),
    }
    orders.unshift(created)
    return created
  }

  async updateStatus(orderId: OrderId, status: Order['status']): Promise<Order> {
    await delay(null, 320)
    const index = orders.findIndex((o) => o.id === orderId)
    if (index === -1) throw new Error('Order not found.')
    const updated: Order = {
      ...orders[index]!,
      status,
      fulfilledAt:
        status === OrderStatus.Shipped || status === OrderStatus.Delivered
          ? new Date().toISOString()
          : orders[index]!.fulfilledAt,
    }
    orders[index] = updated
    return updated
  }
}

class MockPayments implements PaymentsPort {
  async listPayments(): Promise<readonly Payment[]> {
    return delay(PAYMENTS)
  }
  async listSubscriptions(): Promise<readonly Subscription[]> {
    return delay(SUBSCRIPTIONS)
  }
}

class MockMarketing implements MarketingPort {
  async sendContactMessage(): Promise<void> {
    await delay(null, 700)
  }
  async subscribeNewsletter(): Promise<void> {
    await delay(null, 300)
  }
}

class MockTenants implements TenantPort {
  async getTenant(): Promise<Tenant> {
    return delay(DEFAULT_TENANT, 120)
  }
  async listTenants(): Promise<readonly Tenant[]> {
    return delay(TENANTS)
  }
}

export const mockContainer: Container = {
  auth: new MockAuth(),
  directory: new MockDirectory(),
  scheduling: new MockScheduling(),
  progress: new MockProgress(),
  catalog: new MockCatalog(),
  orders: new MockOrders(),
  payments: new MockPayments(),
  tenants: new MockTenants(),
  marketing: new MockMarketing(),
}
