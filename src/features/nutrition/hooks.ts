import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'
import type { UserProfile } from '@/domain/identity/model'
import type { DietPlanInput, FoodEntryInput, FoodEntryPatch } from '@/domain/nutrition/model'
import type { FoodEntryId, IsoDate, UserId } from '@/domain/shared/types'

export function useNutritionCapabilities() {
  return useQuery({
    queryKey: queryKeys.nutritionCapabilities(),
    queryFn: () => container.nutrition.capabilities(),
    staleTime: 60_000,
  })
}

export function useFoodEntries(memberId: string | undefined, range: { from: IsoDate; to: IsoDate }) {
  return useQuery({
    queryKey: queryKeys.foodEntries(memberId ?? '', range.from, range.to),
    queryFn: () => container.nutrition.listFoodEntries(memberId as UserId, range),
    enabled: Boolean(memberId),
    staleTime: 30_000,
  })
}

export function useDailyTotals(memberId: string | undefined, range: { from: IsoDate; to: IsoDate }) {
  return useQuery({
    queryKey: queryKeys.foodTotals(memberId ?? '', range.from, range.to),
    queryFn: () => container.nutrition.dailyTotals(memberId as UserId, range),
    enabled: Boolean(memberId),
    staleTime: 30_000,
  })
}

export function useDietPlan(memberId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dietPlan(memberId ?? ''),
    queryFn: () => container.nutrition.getDietPlan(memberId as UserId),
    enabled: Boolean(memberId),
    staleTime: 5 * 60_000,
  })
}

export function useDietPlanHistory(memberId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.dietPlans(memberId ?? ''),
    queryFn: () => container.nutrition.listDietPlans(memberId as UserId),
    enabled: Boolean(memberId),
  })
}

function useInvalidateFood(memberId: string | undefined) {
  const queryClient = useQueryClient()
  return () => {
    void queryClient.invalidateQueries({ queryKey: queryKeys.foodEntriesFor(memberId ?? '') })
    void queryClient.invalidateQueries({ queryKey: queryKeys.foodTotalsFor(memberId ?? '') })
  }
}

export function useAnalyzeFoodPhoto(memberId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ photo, hint }: { photo: string; hint?: string }) =>
      container.nutrition.analyzeFoodPhoto(memberId as UserId, photo, hint),
    // Success or failure, the remaining-today count may have moved.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.nutritionCapabilities() }),
  })
}

export function useLogFood(memberId: string | undefined) {
  const invalidate = useInvalidateFood(memberId)
  return useMutation({
    mutationFn: (input: FoodEntryInput) => container.nutrition.logFood(memberId as UserId, input),
    onSuccess: invalidate,
  })
}

export function useUpdateFood(memberId: string | undefined) {
  const invalidate = useInvalidateFood(memberId)
  return useMutation({
    mutationFn: ({ entryId, patch }: { entryId: FoodEntryId; patch: FoodEntryPatch }) =>
      container.nutrition.updateFood(memberId as UserId, entryId, patch),
    onSuccess: invalidate,
  })
}

export function useDeleteFood(memberId: string | undefined) {
  const invalidate = useInvalidateFood(memberId)
  return useMutation({
    mutationFn: (entryId: FoodEntryId) => container.nutrition.deleteFood(memberId as UserId, entryId),
    onSuccess: invalidate,
  })
}

export function useFoodPhoto(memberId: string | undefined, entryId: FoodEntryId | null) {
  return useQuery({
    queryKey: queryKeys.foodPhoto(memberId ?? '', entryId ?? ''),
    queryFn: () => container.nutrition.getFoodPhoto(memberId as UserId, entryId!),
    enabled: Boolean(memberId && entryId),
    staleTime: Infinity,
  })
}

export function useSaveDietPlan(memberId: string | undefined, author: UserProfile | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: DietPlanInput) => container.nutrition.saveDietPlan(memberId as UserId, input, author!),
    onSuccess: (plan) => {
      queryClient.setQueryData(queryKeys.dietPlan(memberId ?? ''), plan)
      void queryClient.invalidateQueries({ queryKey: queryKeys.dietPlans(memberId ?? '') })
    },
  })
}
