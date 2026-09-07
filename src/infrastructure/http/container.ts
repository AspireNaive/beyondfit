import type { Role, AuthSession, LoginRequest, RegisterRequest, Tenant, UserProfile } from '@/domain/identity/model'
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
import type { ContactMessage, Container } from '@/domain/ports'
import type { IsoDate, OrderId, UserId } from '@/domain/shared/types'
import { ApiClient, qs } from './api-client'

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

export function createHttpContainer(baseUrl = import.meta.env.VITE_API_URL ?? '/api'): Container {
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
  }
}
