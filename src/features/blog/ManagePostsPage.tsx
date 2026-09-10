import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Eye, EyeOff, Globe, Newspaper, PenSquare, Trash2 } from 'lucide-react'
import { POST_STATUS_LABELS, PostStatus, type Post } from '@/domain/content/model'
import { Role } from '@/domain/identity/model'
import { useCurrentUser } from '@/features/auth/store'
import { Badge } from '@/shared/ui/Badge'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { PageHeading } from '@/shared/ui/Card'
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { Modal } from '@/shared/ui/Modal'
import { Tabs } from '@/shared/ui/Tabs'
import { useDeletePost, useManagedPosts, useSetPostStatus } from './hooks'

type Filter = 'all' | PostStatus

/** Where coaches and studio staff manage what they have written. */
export default function ManagePostsPage() {
  const user = useCurrentUser()
  const { data, isPending, isError, refetch } = useManagedPosts(user)
  const setStatus = useSetPostStatus()
  const remove = useDeletePost()

  const [filter, setFilter] = useState<Filter>('all')
  const [pendingDelete, setPendingDelete] = useState<Post | null>(null)

  const posts = useMemo(() => {
    const all = data ?? []
    return filter === 'all' ? all : all.filter((p) => p.status === filter)
  }, [data, filter])

  const counts = useMemo(
    () => ({
      all: data?.length ?? 0,
      published: data?.filter((p) => p.status === PostStatus.Published).length ?? 0,
      draft: data?.filter((p) => p.status === PostStatus.Draft).length ?? 0,
    }),
    [data],
  )

  if (!user) return null

  const scope =
    user.role === Role.Coach
      ? 'Articles you have written.'
      : user.role === Role.Admin
        ? 'Every article from your studio.'
        : 'Every article on the platform.'

  return (
    <>
      <PageHeading
        title="Blog"
        subtitle={`${scope} Published posts are public — anyone can read them without signing in.`}
        actions={
          <>
            <ButtonLink to="/app/blog/feed" size="sm" variant="outline">
              <Globe className="size-4" /> View the blog
            </ButtonLink>
            <ButtonLink to="/app/blog/new" size="sm">
              <PenSquare className="size-4" /> Write a post
            </ButtonLink>
          </>
        }
      />

      <Tabs<Filter>
        className="mb-6 w-fit"
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'all', label: 'All', count: counts.all },
          { id: PostStatus.Published, label: 'Published', count: counts.published },
          { id: PostStatus.Draft, label: 'Drafts', count: counts.draft },
        ]}
      />

      {isPending ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorState description="Couldn't load your posts." onRetry={() => void refetch()} />
      ) : posts.length === 0 ? (
        <EmptyState
          icon={Newspaper}
          title={filter === 'all' ? 'Nothing written yet' : `No ${filter === PostStatus.Draft ? 'drafts' : 'published posts'}`}
          description="Share what you are seeing on the floor: training notes, nutrition guidance, studio news."
          action={
            <ButtonLink to="/app/blog/new" size="sm">
              Write your first post
            </ButtonLink>
          }
        />
      ) : (
        <ul className="divide-y divide-ink-700 overflow-hidden rounded-xl border border-ink-700 bg-ink-850/70">
          {posts.map((post) => {
            const published = post.status === PostStatus.Published
            const busy = setStatus.isPending && setStatus.variables?.id === post.id
            return (
              <li key={post.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={published ? 'ok' : 'warn'} dot>
                      {POST_STATUS_LABELS[post.status]}
                    </Badge>
                    {post.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag}>{tag}</Badge>
                    ))}
                  </div>
                  <h3 className="mt-2 text-xl leading-tight">
                    <Link
                      to={published ? `/app/blog/read/${post.slug}` : `/app/blog/${post.id}/edit`}
                      className="transition-colors hover:text-volt-400"
                    >
                      {post.title}
                    </Link>
                  </h3>
                  <p className="mt-1 truncate text-xs text-chalk-faint">
                    {post.authorName}
                    {user.role !== Role.Coach ? ` · ${post.tenantName}` : ''}
                    {' · '}
                    {published && post.publishedAt
                      ? `Published ${format(new Date(post.publishedAt), 'd MMM yyyy')}`
                      : `Edited ${format(new Date(post.updatedAt), 'd MMM yyyy, HH:mm')}`}
                    {' · '}
                    {post.readingMinutes} min read
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {published && (
                    <ButtonLink to={`/app/blog/read/${post.slug}`} size="sm" variant="ghost">
                      <Eye className="size-4" /> View
                    </ButtonLink>
                  )}
                  <ButtonLink to={`/app/blog/${post.id}/edit`} size="sm" variant="outline">
                    <PenSquare className="size-4" /> Edit
                  </ButtonLink>
                  <Button
                    size="sm"
                    variant={published ? 'secondary' : 'primary'}
                    loading={busy}
                    onClick={() =>
                      setStatus.mutate({
                        id: post.id,
                        status: published ? PostStatus.Draft : PostStatus.Published,
                      })
                    }
                  >
                    {published ? <EyeOff className="size-4" /> : <Globe className="size-4" />}
                    {published ? 'Unpublish' : 'Publish'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    aria-label={`Delete ${post.title}`}
                    onClick={() => setPendingDelete(post)}
                  >
                    <Trash2 className="size-4 text-danger-500" />
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {setStatus.isError && (
        <p role="alert" className="mt-4 text-sm text-danger-500">
          {(setStatus.error as Error).message}
        </p>
      )}

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this post?"
        description={pendingDelete?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => {
                if (!pendingDelete) return
                remove.mutate(pendingDelete.id, { onSuccess: () => setPendingDelete(null) })
              }}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-chalk-dim">
          This removes the article for everyone, including readers who have the link. If you just want
          to take it down for a while, unpublish it instead.
        </p>
        {remove.isError && (
          <p role="alert" className="mt-3 text-sm text-danger-500">
            {(remove.error as Error).message}
          </p>
        )}
      </Modal>
    </>
  )
}
