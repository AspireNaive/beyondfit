import {
  AuthError,
  Role,
  type AuthSession,
  type LoginRequest,
  type NewPersonInput,
  type PersonPatch,
  type RegisterRequest,
  type Tenant,
  type TenantPatch,
  type UserProfile,
} from '@/domain/identity/model'
import {
  sumMacros,
  type DailyTotals,
  type DietPlan,
  type DietPlanInput,
  type FoodAnalysis,
  type FoodEntry,
  type FoodEntryInput,
  type FoodEntryPatch,
  type NutritionCapabilities,
} from '@/domain/nutrition/model'
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
import {
  PostStatus,
  postMatches,
  readingMinutes,
  type Post,
  type PostFilter,
  type PostInput,
} from '@/domain/content/model'
import type {
  AuthPort,
  CatalogPort,
  ContentPort,
  Container,
  DirectoryPort,
  MarketingPort,
  NutritionPort,
  OrdersPort,
  PaymentsPort,
  ProgressPort,
  SchedulingPort,
  TenantPort,
} from '@/domain/ports'
import { id, type FoodEntryId, type IsoDate, type OrderId, type Page, type PostId, type UserId } from '@/domain/shared/types'
import { today } from '@/shared/lib/dates'
import {
  ACTIVITY,
  APPOINTMENTS,
  BODY_METRICS,
  DEFAULT_TENANT,
  DEMO_PASSWORD,
  DIET_PLANS,
  FOOD_ENTRIES,
  GOALS,
  ORDERS,
  PAYMENTS,
  POSTS,
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
const tenants: Tenant[] = [...TENANTS]
const posts: Post[] = [...POSTS]
const foodEntries: FoodEntry[] = [...FOOD_ENTRIES]
const foodPhotos = new Map<string, string>()
const dietPlans: DietPlan[] = [...DIET_PLANS]

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
  tenants.find((t) => t.id === user.tenantId) ?? DEFAULT_TENANT

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
      case Role.Coach:
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

  async createPerson(input: NewPersonInput): Promise<{ user: UserProfile; temporaryPassword: string | null }> {
    await delay(null, 500)
    if (findUserByEmail(input.email) || users.some((u) => u.email.toLowerCase() === input.email.toLowerCase())) {
      throw new Error('An account already exists for that email.')
    }
    const tenantId = input.tenantId ?? DEFAULT_TENANT.id
    const user: UserProfile = {
      id: id<'User'>(`u-${input.role}-${Date.now()}`),
      tenantId,
      role: input.role,
      firstName: input.firstName.trim(),
      lastName: input.lastName.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone ?? undefined,
      title: input.title ?? undefined,
      bio: input.bio ?? undefined,
      joinedAt: today(),
      specialties: input.role === Role.Coach ? (input.specialties ?? undefined) : undefined,
      credentials: input.role === Role.Coach ? (input.credentials ?? undefined) : undefined,
      assignedCoachId:
        input.role === Role.Member ? (input.assignedCoachId ?? id<'User'>('u-coach-mara')) : null,
      avatarUrl: null,
      status: 'active',
    }
    users.push(user)
    return { user, temporaryPassword: input.password ? null : `welcome-${Math.random().toString(36).slice(2, 8)}` }
  }

  async updatePerson(userId: UserId, patch: PersonPatch): Promise<UserProfile> {
    await delay(null, 320)
    const index = users.findIndex((u) => u.id === userId)
    if (index === -1) throw new Error('Person not found.')
    const current = users[index]!
    if (patch.assignedCoachId !== undefined) {
      if (current.role !== Role.Member) throw new Error('Only members are assigned to a coach.')
      if (patch.assignedCoachId && !users.some((u) => u.id === patch.assignedCoachId && u.role === Role.Coach && u.tenantId === current.tenantId)) {
        throw new Error('That coach is not in this studio.')
      }
    }
    const updated: UserProfile = {
      ...current,
      ...(patch.assignedCoachId !== undefined ? { assignedCoachId: patch.assignedCoachId } : {}),
      ...(patch.status ? { status: patch.status } : {}),
      ...(patch.title !== undefined ? { title: patch.title ?? undefined } : {}),
    }
    users[index] = updated
    return updated
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
    return delay(tenants[0] ?? DEFAULT_TENANT, 120)
  }
  async listTenants(): Promise<readonly Tenant[]> {
    return delay(tenants)
  }
  async updateTenant(tenantId: Tenant['id'], patch: TenantPatch): Promise<Tenant> {
    await delay(null, 320)
    const index = tenants.findIndex((t) => t.id === tenantId)
    if (index === -1) throw new Error('Studio not found.')
    const current = tenants[index]!
    const updated: Tenant = {
      ...current,
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.primaryColor !== undefined ? { primaryColor: patch.primaryColor ?? undefined } : {}),
      nutrition: {
        model: patch.nutrition?.model !== undefined ? patch.nutrition.model : (current.nutrition?.model ?? null),
        dailyPhotoLimit:
          patch.nutrition?.dailyPhotoLimit !== undefined ? patch.nutrition.dailyPhotoLimit : (current.nutrition?.dailyPhotoLimit ?? null),
      },
    }
    tenants[index] = updated
    return updated
  }
}

// ---------------------------------------------------------------------------
// Content (blog)
// ---------------------------------------------------------------------------

const POSTS_DEFAULT_PAGE_SIZE = 9

const newestFirst = (a: Post, b: Post) =>
  (b.publishedAt ?? b.createdAt).localeCompare(a.publishedAt ?? a.createdAt)

class MockContent implements ContentPort {
  async listPosts(filter: PostFilter = {}): Promise<Page<Post>> {
    let result = posts.filter((p) => p.status === PostStatus.Published)
    if (filter.tenantSlug) result = result.filter((p) => p.tenantSlug === filter.tenantSlug)
    if (filter.authorId) result = result.filter((p) => p.authorId === filter.authorId)
    if (filter.tag) {
      const tag = filter.tag.toLowerCase()
      result = result.filter((p) => p.tags.some((t) => t.toLowerCase() === tag))
    }
    if (filter.query) result = result.filter((p) => postMatches(p, filter.query!))
    result = [...result].sort(newestFirst)

    const pageSize = filter.pageSize ?? POSTS_DEFAULT_PAGE_SIZE
    const page = Math.max(1, filter.page ?? 1)
    const start = (page - 1) * pageSize
    return delay({ items: result.slice(start, start + pageSize), total: result.length, page, pageSize })
  }

  async getPost(slug: string): Promise<Post | null> {
    // The mock has no request identity, so drafts are visible by slug too —
    // that is what lets the editor preview a draft. The API checks the caller.
    return delay(posts.find((p) => p.slug === slug) ?? null, 180)
  }

  async listManagedPosts(viewer: UserProfile): Promise<readonly Post[]> {
    let result = posts
    if (viewer.role === Role.Coach) result = result.filter((p) => p.authorId === viewer.id)
    else if (viewer.role === Role.Admin) result = result.filter((p) => p.tenantId === viewer.tenantId)
    else if (viewer.role === Role.Member) result = []
    return delay([...result].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  }

  async createPost(input: PostInput, author: UserProfile): Promise<Post> {
    await delay(null, 420)
    if (posts.some((p) => p.slug === input.slug)) throw new Error('A post with that link already exists.')
    const tenant = tenantOf(author)
    const now = new Date().toISOString()
    const created: Post = {
      id: id<'Post'>(`post-${Date.now()}`),
      tenantId: tenant.id,
      tenantName: tenant.name,
      tenantSlug: tenant.slug,
      slug: input.slug,
      title: input.title,
      excerpt: input.excerpt,
      coverImageUrl: input.coverImageUrl ?? null,
      tags: input.tags,
      blocks: input.blocks,
      authorId: author.id,
      authorName: `${author.firstName} ${author.lastName}`,
      authorRole: author.role,
      authorTitle: author.title,
      authorAvatarUrl: author.avatarUrl ?? null,
      status: input.status,
      publishedAt: input.status === PostStatus.Published ? now : null,
      createdAt: now,
      updatedAt: now,
      readingMinutes: readingMinutes(input.blocks),
    }
    posts.unshift(created)
    return created
  }

  async updatePost(postId: PostId, patch: Partial<PostInput>): Promise<Post> {
    await delay(null, 380)
    const index = posts.findIndex((p) => p.id === postId)
    if (index === -1) throw new Error('Post not found.')
    const current = posts[index]!
    if (patch.slug && patch.slug !== current.slug && posts.some((p) => p.slug === patch.slug)) {
      throw new Error('A post with that link already exists.')
    }
    const now = new Date().toISOString()
    const status = patch.status ?? current.status
    const updated: Post = {
      ...current,
      ...patch,
      status,
      publishedAt:
        status === PostStatus.Published && !current.publishedAt ? now : current.publishedAt,
      updatedAt: now,
      readingMinutes: readingMinutes(patch.blocks ?? current.blocks),
    }
    posts[index] = updated
    return updated
  }

  async setPostStatus(postId: PostId, status: PostStatus): Promise<Post> {
    return this.updatePost(postId, { status })
  }

  async deletePost(postId: PostId): Promise<void> {
    await delay(null, 300)
    const index = posts.findIndex((p) => p.id === postId)
    if (index >= 0) posts.splice(index, 1)
  }
}

// ---------------------------------------------------------------------------
// Nutrition (food diary + diet plans)
// ---------------------------------------------------------------------------

/**
 * The mock cannot look at a photo, so it returns a plausible plate with low
 * confidence and says so — enough to exercise the review-and-correct flow.
 */
const MOCK_ANALYSIS: FoodAnalysis['items'] = [
  { name: 'Grilled chicken breast', portion: '150 g', calories: 250, proteinG: 46, carbsG: 0, fatG: 5 },
  { name: 'Mixed salad with olive oil', portion: '1 bowl', calories: 150, proteinG: 2, carbsG: 8, fatG: 12 },
  { name: 'Wholegrain bread', portion: '1 slice', calories: 80, proteinG: 4, carbsG: 14, fatG: 1 },
]

const analysesToday = new Map<string, number>()
const MOCK_DEFAULT_LIMIT = 5

class MockNutrition implements NutritionPort {
  async capabilities(): Promise<NutritionCapabilities> {
    const tenant = tenants[0] ?? DEFAULT_TENANT
    const dailyLimit = tenant.nutrition?.dailyPhotoLimit ?? MOCK_DEFAULT_LIMIT
    const usedToday = analysesToday.get(`${today()}`) ?? 0
    return delay(
      {
        photoAnalysis: dailyLimit > 0,
        model: dailyLimit > 0 ? (tenant.nutrition?.model ?? 'mock') : null,
        dailyLimit,
        usedToday,
        remainingToday: Math.max(0, dailyLimit - usedToday),
      },
      60,
    )
  }

  async analyzeFoodPhoto(_memberId: UserId, _photo: string, hint?: string): Promise<FoodAnalysis> {
    const tenant = tenants[0] ?? DEFAULT_TENANT
    const dailyLimit = tenant.nutrition?.dailyPhotoLimit ?? MOCK_DEFAULT_LIMIT
    const used = analysesToday.get(today()) ?? 0
    if (used >= dailyLimit) {
      throw new Error(`That is ${dailyLimit} photo analyses today — the daily limit. You can still log meals manually until tomorrow.`)
    }
    analysesToday.set(today(), used + 1)
    await delay(null, 1400)
    return {
      dishName: hint?.trim() || 'Chicken salad plate',
      items: MOCK_ANALYSIS,
      totals: sumMacros(MOCK_ANALYSIS),
      confidence: 'low',
      notes: 'Demo mode: this is a sample estimate, not a reading of your photo. Connect the API for real analysis.',
      model: 'mock',
    }
  }

  async listFoodEntries(memberId: UserId, range: { from: IsoDate; to: IsoDate }): Promise<readonly FoodEntry[]> {
    return delay(
      foodEntries
        .filter((e) => e.memberId === memberId && e.date >= range.from && e.date <= range.to)
        .sort((a, b) => b.date.localeCompare(a.date) || b.loggedAt.localeCompare(a.loggedAt)),
    )
  }

  async dailyTotals(memberId: UserId, range: { from: IsoDate; to: IsoDate }): Promise<readonly DailyTotals[]> {
    const rows = await this.listFoodEntries(memberId, range)
    const byDay = new Map<string, { totals: FoodEntry['totals']; meals: number }>()
    for (const e of rows) {
      const day = byDay.get(e.date) ?? { totals: sumMacros([]), meals: 0 }
      byDay.set(e.date, { totals: sumMacros([day.totals, e.totals]), meals: day.meals + 1 })
    }
    return [...byDay.entries()].map(([date, v]) => ({ date, ...v })).sort((a, b) => b.date.localeCompare(a.date))
  }

  async logFood(memberId: UserId, input: FoodEntryInput): Promise<FoodEntry> {
    await delay(null, 420)
    const member = users.find((u) => u.id === memberId)
    const now = new Date().toISOString()
    const created: FoodEntry = {
      id: id<'FoodEntry'>(`f-${Date.now()}`),
      tenantId: member?.tenantId ?? DEFAULT_TENANT.id,
      memberId,
      date: input.date,
      mealType: input.mealType,
      loggedAt: now,
      title: input.title,
      items: input.items,
      totals: sumMacros(input.items),
      notes: input.notes ?? null,
      source: input.photoDataUrl ? 'photo' : (input.source ?? 'manual'),
      thumbDataUrl: input.thumbDataUrl ?? null,
      hasPhoto: Boolean(input.photoDataUrl),
      createdAt: now,
      updatedAt: now,
    }
    if (input.photoDataUrl) foodPhotos.set(created.id, input.photoDataUrl)
    foodEntries.unshift(created)
    return created
  }

  async updateFood(memberId: UserId, entryId: FoodEntryId, patch: FoodEntryPatch): Promise<FoodEntry> {
    await delay(null, 320)
    const index = foodEntries.findIndex((e) => e.id === entryId && e.memberId === memberId)
    if (index === -1) throw new Error('Meal not found.')
    const current = foodEntries[index]!
    const items = patch.items ?? current.items
    const updated: FoodEntry = {
      ...current,
      ...patch,
      notes: patch.notes === undefined ? current.notes : patch.notes,
      items,
      totals: sumMacros(items),
      updatedAt: new Date().toISOString(),
    }
    foodEntries[index] = updated
    return updated
  }

  async deleteFood(memberId: UserId, entryId: FoodEntryId): Promise<void> {
    await delay(null, 260)
    const index = foodEntries.findIndex((e) => e.id === entryId && e.memberId === memberId)
    if (index >= 0) foodEntries.splice(index, 1)
    foodPhotos.delete(entryId)
  }

  async getFoodPhoto(_memberId: UserId, entryId: FoodEntryId): Promise<string | null> {
    return delay(foodPhotos.get(entryId) ?? null, 200)
  }

  async getDietPlan(memberId: UserId): Promise<DietPlan | null> {
    return delay(dietPlans.find((p) => p.memberId === memberId && p.status === 'active') ?? null, 180)
  }

  async listDietPlans(memberId: UserId): Promise<readonly DietPlan[]> {
    return delay(
      dietPlans
        .filter((p) => p.memberId === memberId)
        .sort((a, b) => (a.status === 'active' ? -1 : b.status === 'active' ? 1 : b.updatedAt.localeCompare(a.updatedAt))),
    )
  }

  async saveDietPlan(memberId: UserId, input: DietPlanInput, author: UserProfile): Promise<DietPlan> {
    await delay(null, 480)
    const member = users.find((u) => u.id === memberId)
    const now = new Date().toISOString()
    for (let i = 0; i < dietPlans.length; i++) {
      const p = dietPlans[i]!
      if (p.memberId === memberId && p.status === 'active') dietPlans[i] = { ...p, status: 'archived', updatedAt: now }
    }
    const created: DietPlan = {
      id: id<'DietPlan'>(`dp-${Date.now()}`),
      tenantId: member?.tenantId ?? DEFAULT_TENANT.id,
      memberId,
      authorId: author.id,
      authorName: `${author.firstName} ${author.lastName}`,
      authorRole: author.role,
      ...input,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    }
    dietPlans.unshift(created)
    return created
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
  content: new MockContent(),
  nutrition: new MockNutrition(),
}
