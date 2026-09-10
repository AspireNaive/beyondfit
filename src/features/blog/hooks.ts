import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/app/query-client'
import { container } from '@/infrastructure/container'
import {
  POSTS_PAGE_SIZE,
  type Post,
  type PostFilter,
  type PostInput,
  type PostStatus,
} from '@/domain/content/model'
import type { UserProfile } from '@/domain/identity/model'
import type { PostId } from '@/domain/shared/types'

/**
 * The public feed: newest first, one page at a time. An infinite query rather
 * than page numbers because "show me older posts" is the only navigation a
 * reader does here, and it keeps every loaded post on screen.
 */
export function usePostFeed(filter: Omit<PostFilter, 'page' | 'pageSize'> = {}) {
  return useInfiniteQuery({
    queryKey: queryKeys.posts(filter),
    queryFn: ({ pageParam }) =>
      container.content.listPosts({ ...filter, page: pageParam, pageSize: POSTS_PAGE_SIZE }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.page * last.pageSize < last.total ? last.page + 1 : undefined,
    staleTime: 2 * 60_000,
  })
}

export function usePost(slug: string | undefined) {
  return useQuery({
    queryKey: queryKeys.post(slug ?? ''),
    queryFn: () => container.content.getPost(slug!),
    enabled: Boolean(slug),
  })
}

export function useManagedPosts(viewer: UserProfile | null) {
  return useQuery({
    queryKey: queryKeys.managedPosts(viewer?.id ?? ''),
    queryFn: () => container.content.listManagedPosts(viewer!),
    enabled: Boolean(viewer),
    staleTime: 30_000,
  })
}

/** Every write touches the feed, the managed list and the post itself. */
function useInvalidatePosts() {
  const queryClient = useQueryClient()
  return (post?: Post) => {
    void queryClient.invalidateQueries({ queryKey: ['posts'] })
    void queryClient.invalidateQueries({ queryKey: ['managed-posts'] })
    if (post) {
      queryClient.setQueryData(queryKeys.post(post.slug), post)
      void queryClient.invalidateQueries({ queryKey: queryKeys.post(post.slug) })
    } else {
      void queryClient.invalidateQueries({ queryKey: ['post'] })
    }
  }
}

export function useCreatePost(author: UserProfile | null) {
  const invalidate = useInvalidatePosts()
  return useMutation({
    mutationFn: (input: PostInput) => container.content.createPost(input, author!),
    onSuccess: (post) => invalidate(post),
  })
}

export function useUpdatePost() {
  const invalidate = useInvalidatePosts()
  return useMutation({
    mutationFn: ({ id, patch }: { id: PostId; patch: Partial<PostInput> }) =>
      container.content.updatePost(id, patch),
    onSuccess: (post) => invalidate(post),
  })
}

export function useSetPostStatus() {
  const invalidate = useInvalidatePosts()
  return useMutation({
    mutationFn: ({ id, status }: { id: PostId; status: PostStatus }) =>
      container.content.setPostStatus(id, status),
    onSuccess: (post) => invalidate(post),
  })
}

export function useDeletePost() {
  const invalidate = useInvalidatePosts()
  return useMutation({
    mutationFn: (id: PostId) => container.content.deletePost(id),
    onSuccess: () => invalidate(),
  })
}
