import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'
import type { UserProfile } from '@/domain/identity/model'
import type { BookAppointmentRequest, Discipline } from '@/domain/scheduling/model'
import type { AppointmentId, IsoDate, UserId } from '@/domain/shared/types'

export function useProviders(filter: { discipline?: Discipline; query?: string } = {}) {
  return useQuery({
    queryKey: queryKeys.providers(filter),
    queryFn: () => container.scheduling.listProviders(filter),
    // The specialist roster barely changes; don't refetch it on every visit.
    staleTime: 5 * 60_000,
  })
}

export function useProvider(providerId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.provider(providerId ?? ''),
    queryFn: () => container.scheduling.getProvider(providerId as UserId),
    enabled: Boolean(providerId),
    staleTime: 5 * 60_000,
  })
}

export function useAvailability(providerId: string | undefined, date: IsoDate) {
  return useQuery({
    queryKey: queryKeys.availability(providerId ?? '', date),
    queryFn: () => container.scheduling.getAvailability(providerId as UserId, date),
    enabled: Boolean(providerId && date),
    // Slots go stale fast — someone else may take one while you deliberate.
    staleTime: 30_000,
  })
}

export function useAppointments(viewer: UserProfile | null) {
  return useQuery({
    queryKey: queryKeys.appointments(viewer?.id ?? ''),
    queryFn: () => container.scheduling.listAppointments(viewer!),
    enabled: Boolean(viewer),
  })
}

export function useBookAppointment(member: UserProfile | null) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (request: BookAppointmentRequest) =>
      container.scheduling.book(request, member!),
    onSuccess: (appointment) => {
      // The booked slot is gone and the member's list has a new row.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.availability(appointment.providerId, appointment.startsAt.slice(0, 10)),
      })
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments(member?.id ?? '') })
    },
  })
}

export function useCancelAppointment(viewerId: string | undefined) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (appointmentId: AppointmentId) => container.scheduling.cancel(appointmentId),
    onSuccess: (appointment) => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.appointments(viewerId ?? '') })
      void queryClient.invalidateQueries({
        queryKey: queryKeys.availability(appointment.providerId, appointment.startsAt.slice(0, 10)),
      })
    },
  })
}
