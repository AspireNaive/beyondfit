import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'
import type { NewPersonInput, PersonPatch, UserProfile } from '@/domain/identity/model'
import type { UserId } from '@/domain/shared/types'

/**
 * "Mapped profiles" — the people the signed-in user is allowed to see, always
 * including themselves. Scope is decided by the adapter (and, in production, by
 * the server from the bearer token) rather than filtered in the component.
 */
export function useMappedProfiles(viewer: UserProfile | null) {
  return useQuery({
    queryKey: queryKeys.directory(viewer?.id ?? ''),
    queryFn: () => container.directory.listMappedProfiles(viewer!),
    enabled: Boolean(viewer),
  })
}

export function useProfile(userId: UserId | undefined) {
  return useQuery({
    queryKey: queryKeys.profile(userId ?? ''),
    queryFn: () => container.directory.getProfile(userId!),
    enabled: Boolean(userId),
  })
}

/** Studio management: add a member or coach. Refreshes the directory. */
export function useCreatePerson(viewer: UserProfile | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewPersonInput) => container.directory.createPerson(input),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.directory(viewer?.id ?? '') })
      void queryClient.invalidateQueries({ queryKey: ['tenants'] })
    },
  })
}

/** Map a member to a coach, or change someone's status. */
export function useUpdatePerson(viewer: UserProfile | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: UserId; patch: PersonPatch }) => container.directory.updatePerson(userId, patch),
    onSuccess: (user) => {
      queryClient.setQueryData(queryKeys.profile(user.id), user)
      void queryClient.invalidateQueries({ queryKey: queryKeys.directory(viewer?.id ?? '') })
    },
  })
}
