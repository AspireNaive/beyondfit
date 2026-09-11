import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'
import type { Tenant, TenantPatch } from '@/domain/identity/model'
import { useAuthStore } from '@/features/auth/store'

export function usePayments() {
  return useQuery({
    queryKey: queryKeys.payments(),
    queryFn: () => container.payments.listPayments(),
  })
}

export function useSubscriptions() {
  return useQuery({
    queryKey: queryKeys.subscriptions(),
    queryFn: () => container.payments.listSubscriptions(),
  })
}

export function useTenants() {
  return useQuery({
    queryKey: queryKeys.tenants(),
    queryFn: () => container.tenants.listTenants(),
    staleTime: 5 * 60_000,
  })
}

/** Studio settings. On success the signed-in session's tenant is refreshed too, so the rest of the app sees it. */
export function useUpdateTenant() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: Tenant['id']; patch: TenantPatch }) => container.tenants.updateTenant(id, patch),
    onSuccess: (tenant) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.tenants() })
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutritionCapabilities() })
      useAuthStore.setState((s) => (s.session && s.session.tenant.id === tenant.id ? { session: { ...s.session, tenant } } : {}))
    },
  })
}
