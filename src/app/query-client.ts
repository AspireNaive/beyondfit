import { QueryClient } from '@tanstack/react-query'
import { AuthError } from '@/domain/identity/model'
import { ApiError } from '@/infrastructure/http/api-client'

/**
 * Defaults tuned for this app rather than the library's:
 *  - a minute of freshness, because coaching data does not change per second
 *    and refetch storms are what actually hurt at scale;
 *  - no retry on 4xx, which is a bug or a permission problem, not a blip.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof AuthError) return false
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false
        return failureCount < 2
      },
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    },
    mutations: {
      retry: false,
    },
  },
})

/** Central key factory — keeps invalidation honest and greppable. */
export const queryKeys = {
  directory: (viewerId: string) => ['directory', viewerId] as const,
  profile: (userId: string) => ['profile', userId] as const,
  providers: (filter: { discipline?: string; query?: string }) => ['providers', filter] as const,
  provider: (providerId: string) => ['provider', providerId] as const,
  availability: (providerId: string, date: string) => ['availability', providerId, date] as const,
  appointments: (viewerId: string) => ['appointments', viewerId] as const,
  bodyMetrics: (memberId: string) => ['body-metrics', memberId] as const,
  activity: (memberId: string, days: number) => ['activity', memberId, days] as const,
  goal: (memberId: string) => ['goal', memberId] as const,
  products: (filter: { category?: string; query?: string }) => ['products', filter] as const,
  product: (slug: string) => ['product', slug] as const,
  orders: (viewerId: string) => ['orders', viewerId] as const,
  payments: () => ['payments'] as const,
  subscriptions: () => ['subscriptions'] as const,
  tenants: () => ['tenants'] as const,
  posts: (filter: { tenantSlug?: string; authorId?: string; tag?: string; query?: string }) =>
    ['posts', filter] as const,
  post: (slug: string) => ['post', slug] as const,
  managedPosts: (viewerId: string) => ['managed-posts', viewerId] as const,
  nutritionCapabilities: () => ['nutrition-capabilities'] as const,
  foodEntries: (memberId: string, from: string, to: string) => ['food', memberId, from, to] as const,
  foodTotals: (memberId: string, from: string, to: string) => ['food-totals', memberId, from, to] as const,
  dietPlan: (memberId: string) => ['diet-plan', memberId] as const,
  dietPlans: (memberId: string) => ['diet-plans', memberId] as const,
} as const
