import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'
import type { UserProfile } from '@/domain/identity/model'
import type { Order } from '@/domain/commerce/model'
import type { CartLine } from '@/domain/commerce/model'
import type { OrderId } from '@/domain/shared/types'

export function useOrders(viewer: UserProfile | null) {
  return useQuery({
    queryKey: queryKeys.orders(viewer?.id ?? ''),
    queryFn: () => container.orders.listOrders(viewer!),
    enabled: Boolean(viewer),
  })
}

export function useUpdateOrderStatus(viewerId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, status }: { id: OrderId; status: Order['status'] }) =>
      container.orders.updateStatus(id, status),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders(viewerId ?? '') })
    },
  })
}

export function usePlaceOrder(customer: UserProfile | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (lines: readonly CartLine[]) => container.orders.placeOrder(lines, customer!),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.orders(customer?.id ?? '') })
      void queryClient.invalidateQueries({ queryKey: queryKeys.payments() })
    },
  })
}
