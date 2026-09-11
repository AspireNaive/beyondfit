import type {
  Role,
  AuthSession,
  LoginRequest,
  NewPersonInput,
  PersonPatch,
  RegisterRequest,
  Tenant,
  UserProfile,
} from '@/domain/identity/model'
import type {
  DailyTotals,
  DietPlan,
  DietPlanInput,
  FoodAnalysis,
  FoodEntry,
  FoodEntryInput,
  FoodEntryPatch,
  NutritionCapabilities,
} from '@/domain/nutrition/model'
import type {
  Appointment,
  AvailabilitySlot,
  BookAppointmentRequest,
  Discipline,
  Provider,
} from '@/domain/scheduling/model'
import type { ActivityEntry, BodyMetricEntry, MemberGoal } from '@/domain/progress/model'
import type {
  CartLine,
  Order,
  Payment,
  PaymentMethod,
  Product,
  ProductCategory,
  Subscription,
} from '@/domain/commerce/model'
import type { Post, PostFilter, PostInput, PostStatus } from '@/domain/content/model'
import type { ContactMessage, Container } from '@/domain/ports'
import type { FoodEntryId, IsoDate, OrderId, Page, PostId, UserId } from '@/domain/shared/types'
import { ApiClient, ApiError, qs } from './api-client'

/**
 * The HTTP adapter for the Node API in ./server.
 *
 * Every path below is a route the server exposes. Because the UI only ever
 * talks to `Container`, VITE_API_MODE=http is the entire integration — no
 * screen or hook changes.
 */

const SESSION_KEY = 'beyondfit.session'

const readSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    return raw ? (JSON.parse(raw) as AuthSession) : null
  } catch {
    return null
  }
}

const readToken = (): string | null => readSession()?.accessToken ?? null

export function createHttpContainer(baseUrl = import.meta.env.VITE_KEDEM_API_URL ?? '/api'): Container {
  const api = new ApiClient({
    baseUrl,
    getToken: readToken,
    onUnauthorized: () => {
      try {
        localStorage.removeItem(SESSION_KEY)
      } catch {
        /* storage unavailable */
      }
    },
  })

  const persist = (session: AuthSession) => {
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    } catch {
      /* storage unavailable */
    }
    return session
  }

  return {
    auth: {
      // POST /api/auth/login          { email, password, portal, tenantSlug }
      login: async (request: LoginRequest) =>
        persist(await api.post<AuthSession>('/auth/login', request)),

      // POST /api/auth/register
      register: async (request: RegisterRequest) =>
        persist(await api.post<AuthSession>('/auth/register', request)),

      // POST /api/auth/logout
      logout: async () => {
        await api.post<void>('/auth/logout')
        localStorage.removeItem(SESSION_KEY)
      },

      // GET /api/auth/me — revalidates the stored token and refreshes user + tenant;
      // the tokens themselves stay as issued.
      restore: async () => {
        const stored = readSession()
        if (!stored?.accessToken) return null
        if (stored.expiresAt && new Date(stored.expiresAt) < new Date()) {
          localStorage.removeItem(SESSION_KEY)
          return null
        }
        try {
          const fresh = await api.get<Pick<AuthSession, 'user' | 'tenant'>>('/auth/me')
          return persist({ ...stored, ...fresh })
        } catch {
          return null
        }
      },

      // POST /api/auth/password-reset
      requestPasswordReset: (email: string) => api.post<void>('/auth/password-reset', { email }),

      // POST /api/auth/password-reset/confirm
      resetPassword: (token: string, password: string) =>
        api.post<void>('/auth/password-reset/confirm', { token, password }),
    },

    directory: {
      // GET /api/directory/mapped — server derives scope from the bearer token
      listMappedProfiles: (_viewer: UserProfile) =>
        api.get<readonly UserProfile[]>('/directory/mapped'),
      getProfile: (userId: UserId) => api.get<UserProfile | null>(`/directory/${userId}`),
      listByRole: (role: Role) => api.get<readonly UserProfile[]>(`/directory${qs({ role })}`),
      // POST /api/directory — admin / app_manager adds a member or coach
      createPerson: (input: NewPersonInput) =>
        api.post<{ user: UserProfile; temporaryPassword: string | null }>('/directory', input),
      // PATCH /api/directory/:userId — map to a coach, change status
      updatePerson: (userId: UserId, patch: PersonPatch) => api.patch<UserProfile>(`/directory/${userId}`, patch),
    },

    scheduling: {
      listProviders: (filter?: { discipline?: Discipline; query?: string }) =>
        api.get<readonly Provider[]>(`/providers${qs({ ...filter })}`),
      getProvider: (providerId: UserId) => api.get<Provider | null>(`/providers/${providerId}`),
      getAvailability: (providerId: UserId, date: IsoDate) =>
        api.get<readonly AvailabilitySlot[]>(`/providers/${providerId}/availability${qs({ date })}`),
      listAppointments: (_viewer: UserProfile) =>
        api.get<readonly Appointment[]>('/appointments'),
      book: (request: BookAppointmentRequest, _member: UserProfile) =>
        api.post<Appointment>('/appointments', request),
      cancel: (appointmentId: Appointment['id']) =>
        api.post<Appointment>(`/appointments/${appointmentId}/cancel`),
    },

    progress: {
      listBodyMetrics: (memberId: UserId) =>
        api.get<readonly BodyMetricEntry[]>(`/members/${memberId}/body-metrics`),
      listActivity: (memberId: UserId, days: number) =>
        api.get<readonly ActivityEntry[]>(`/members/${memberId}/activity${qs({ days })}`),
      getGoal: (memberId: UserId) => api.get<MemberGoal>(`/members/${memberId}/goal`),
      logBodyMetric: (entry: Omit<BodyMetricEntry, 'id'>) =>
        api.post<BodyMetricEntry>(`/members/${entry.memberId}/body-metrics`, entry),
    },

    catalog: {
      listProducts: (filter?: { category?: ProductCategory; query?: string }) =>
        api.get<readonly Product[]>(`/products${qs({ ...filter })}`),
      getProduct: (slug: string) => api.get<Product | null>(`/products/${slug}`),
    },

    orders: {
      listOrders: (_viewer: UserProfile) => api.get<readonly Order[]>('/orders'),
      getOrder: (orderId: OrderId) => api.get<Order | null>(`/orders/${orderId}`),
      placeOrder: (lines: readonly CartLine[], _customer: UserProfile, options?: { method?: PaymentMethod }) =>
        api.post<Order>('/orders', {
          lines: lines.map((l) => ({ productId: l.product.id, quantity: l.quantity })),
          method: options?.method ?? 'card',
        }),
      updateStatus: (orderId: OrderId, status: Order['status']) =>
        api.patch<Order>(`/orders/${orderId}`, { status }),
    },

    payments: {
      listPayments: () => api.get<readonly Payment[]>('/payments'),
      listSubscriptions: () => api.get<readonly Subscription[]>('/subscriptions'),
    },

    tenants: {
      getTenant: () => api.get<Tenant>('/tenant'),
      listTenants: () => api.get<readonly Tenant[]>('/tenants'),
    },

    marketing: {
      // POST /api/contact
      sendContactMessage: (message: ContactMessage) => api.post<void>('/contact', message),
      // POST /api/newsletter
      subscribeNewsletter: (email: string) => api.post<void>('/newsletter', { email }),
    },

    nutrition: {
      capabilities: () => api.get<NutritionCapabilities>('/nutrition/capabilities'),
      // POST /api/members/:id/food/analyze — Claude reads the photo; nothing saved
      analyzeFoodPhoto: (memberId: UserId, photo: string, hint?: string) =>
        api.post<FoodAnalysis>(`/members/${memberId}/food/analyze`, { photo, hint }),
      listFoodEntries: (memberId: UserId, range: { from: IsoDate; to: IsoDate }) =>
        api.get<readonly FoodEntry[]>(`/members/${memberId}/food${qs(range)}`),
      dailyTotals: (memberId: UserId, range: { from: IsoDate; to: IsoDate }) =>
        api.get<readonly DailyTotals[]>(`/members/${memberId}/food/summary${qs(range)}`),
      logFood: (memberId: UserId, input: FoodEntryInput) => api.post<FoodEntry>(`/members/${memberId}/food`, input),
      updateFood: (memberId: UserId, entryId: FoodEntryId, patch: FoodEntryPatch) =>
        api.patch<FoodEntry>(`/members/${memberId}/food/${entryId}`, patch),
      deleteFood: (memberId: UserId, entryId: FoodEntryId) => api.delete<void>(`/members/${memberId}/food/${entryId}`),
      getFoodPhoto: async (memberId: UserId, entryId: FoodEntryId) => {
        try {
          return (await api.get<{ dataUrl: string }>(`/members/${memberId}/food/${entryId}/photo`)).dataUrl
        } catch (error) {
          if (error instanceof ApiError && error.status === 404) return null
          throw error
        }
      },
      getDietPlan: (memberId: UserId) => api.get<DietPlan | null>(`/members/${memberId}/diet-plan`),
      listDietPlans: (memberId: UserId) => api.get<readonly DietPlan[]>(`/members/${memberId}/diet-plan/history`),
      // PUT /api/members/:id/diet-plan — author comes from the bearer token
      saveDietPlan: (memberId: UserId, input: DietPlanInput, _author: UserProfile) =>
        api.put<DietPlan>(`/members/${memberId}/diet-plan`, input),
    },

    content: {
      // GET /api/posts — public, published only, newest first, paged
      listPosts: (filter: PostFilter = {}) =>
        api.get<Page<Post>>(
          `/posts${qs({
            tenant: filter.tenantSlug,
            author: filter.authorId,
            tag: filter.tag,
            query: filter.query,
            page: filter.page,
            pageSize: filter.pageSize,
          })}`,
        ),
      // GET /api/posts/:slug — drafts included when the bearer may manage them
      getPost: (slug: string) => api.get<Post | null>(`/posts/${encodeURIComponent(slug)}`),
      // GET /api/posts/mine — scope derived from the bearer token
      listManagedPosts: (_viewer: UserProfile) => api.get<readonly Post[]>('/posts/mine'),
      // POST /api/posts
      createPost: (input: PostInput, _author: UserProfile) => api.post<Post>('/posts', input),
      // PATCH /api/posts/:postId
      updatePost: (postId: PostId, patch: Partial<PostInput>) => api.patch<Post>(`/posts/${postId}`, patch),
      setPostStatus: (postId: PostId, status: PostStatus) => api.patch<Post>(`/posts/${postId}`, { status }),
      // DELETE /api/posts/:postId
      deletePost: (postId: PostId) => api.delete<void>(`/posts/${postId}`),
    },
  }
}
