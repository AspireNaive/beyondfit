import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'
import type { BodyMetricEntry } from '@/domain/progress/model'
import type { UserId } from '@/domain/shared/types'

export function useBodyMetrics(memberId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.bodyMetrics(memberId ?? ''),
    queryFn: () => container.progress.listBodyMetrics(memberId as UserId),
    enabled: Boolean(memberId),
  })
}

export function useActivity(memberId: string | undefined, days: number) {
  return useQuery({
    queryKey: queryKeys.activity(memberId ?? '', days),
    queryFn: () => container.progress.listActivity(memberId as UserId, days),
    enabled: Boolean(memberId),
  })
}

export function useGoal(memberId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.goal(memberId ?? ''),
    queryFn: () => container.progress.getGoal(memberId as UserId),
    enabled: Boolean(memberId),
    staleTime: 5 * 60_000,
  })
}

export function useLogBodyMetric(memberId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (entry: Omit<BodyMetricEntry, 'id'>) => container.progress.logBodyMetric(entry),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bodyMetrics(memberId ?? '') })
    },
  })
}
