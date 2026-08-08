import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'

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
