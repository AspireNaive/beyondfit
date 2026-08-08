import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'
import type { UserProfile } from '@/domain/identity/model'
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
