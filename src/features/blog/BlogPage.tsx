import { useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Newspaper, PenSquare, Search } from 'lucide-react'
import { Permission } from '@/domain/identity/model'
import { useCan } from '@/features/auth/store'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { PageHeading } from '@/shared/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/Feedback'
import { PageHero } from '@/features/marketing/PageHero'
import { CtaBand } from '@/features/marketing/components'
import { cn } from '@/shared/lib/cn'
import { FeaturedPost, PostCard } from './PostCard'
import { usePostFeed } from './hooks'

/**
 * The public blog. Anyone can read it — signed in or not — and it renders in
 * both the marketing shell (/blog) and the app shell (/app/blog/feed).
 * Newest post leads; older posts arrive a page at a time with "Show older".
 */
export default function BlogPage() {
  const location = useLocation()
  const inApp = location.pathname.startsWith('/app')
  const basePath = inApp ? '/app/blog/read' : '/blog'
  const canWrite = useCan(Permission.PublishContent)

  const [query, setQuery] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [tag, setTag] = useState<string | null>(null)

  const feed = usePostFeed({ ...(tag ? { tag } : {}), ...(submitted ? { query: submitted } : {}) })
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data])
  const total = feed.data?.pages[0]?.total ?? 0

  // Tag chips come from whatever the unfiltered first page carries; the
  // selected tag stays visible even if the filtered results no longer mention it.
  const allPosts = usePostFeed({})
  const tags = useMemo(() => {
    const seen = new Map<string, number>()
    for (const post of allPosts.data?.pages.flatMap((p) => p.items) ?? []) {
      for (const t of post.tags) seen.set(t, (seen.get(t) ?? 0) + 1)
    }
    const list = [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
    if (tag && !list.includes(tag)) list.unshift(tag)
    return list
  }, [allPosts.data, tag])

  const filtered = Boolean(tag || submitted)
  const [featured, ...rest] = posts

  const controls = (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-2">
        <FilterChip active={!tag} onClick={() => setTag(null)}>
          Everything
        </FilterChip>
        {tags.map((t) => (
          <FilterChip key={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)}>
            {t}
          </FilterChip>
        ))}
      </div>

      <form
        className="relative"
        onSubmit={(e) => {
          e.preventDefault()
          setSubmitted(query.trim())
        }}
      >
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-chalk-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            if (e.target.value === '') setSubmitted('')
          }}
          placeholder="Search articles"
          aria-label="Search articles"
          className="h-11 w-full rounded-lg border border-ink-600 bg-ink-900/80 pl-10 pr-3.5 text-sm outline-none transition-colors placeholder:text-chalk-faint focus:border-volt-400 lg:w-72"
        />
      </form>
    </div>
  )

  const body = feed.isPending ? (
    <div className="space-y-6" role="status" aria-label="Loading articles">
      <Skeleton className="h-80 w-full rounded-2xl" />
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-96 w-full rounded-xl" />
        ))}
      </div>
    </div>
  ) : feed.isError ? (
    <ErrorState description="Couldn't load the blog." onRetry={() => void feed.refetch()} />
  ) : posts.length === 0 ? (
    <EmptyState
      icon={Newspaper}
      title={filtered ? 'Nothing matches that' : 'No articles yet'}
      description={
        filtered
          ? 'Try another tag or clear the search.'
          : canWrite
            ? 'Be the first to publish something for your members.'
            : 'Coaches and studios publish here. Check back soon.'
      }
      action={
        filtered ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTag(null)
              setQuery('')
              setSubmitted('')
            }}
          >
            Clear filters
          </Button>
        ) : canWrite ? (
          <ButtonLink to="/app/blog/new" size="sm">
            Write a post
          </ButtonLink>
        ) : undefined
      }
    />
  ) : (
    <div className="space-y-10">
      {featured && !filtered ? <FeaturedPost post={featured} basePath={basePath} /> : null}

      <div>
        {!filtered && rest.length > 0 && (
          <div className="mb-5 flex items-end justify-between gap-4">
            <h2 className="text-2xl">Previously</h2>
            <p className="text-xs text-chalk-faint">
              {total} article{total === 1 ? '' : 's'}
            </p>
          </div>
        )}
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {(filtered ? posts : rest).map((post) => (
            <PostCard key={post.id} post={post} basePath={basePath} />
          ))}
        </div>
      </div>

      {feed.hasNextPage && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            size="md"
            loading={feed.isFetchingNextPage}
            onClick={() => void feed.fetchNextPage()}
          >
            Show older articles
          </Button>
        </div>
      )}
    </div>
  )

  if (inApp) {
    return (
      <>
        <PageHeading
          title="Blog"
          subtitle="Articles from coaches and studios across Kedem Life."
          actions={
            canWrite ? (
              <>
                <ButtonLink to="/app/blog" size="sm" variant="outline">
                  Manage my posts
                </ButtonLink>
                <ButtonLink to="/app/blog/new" size="sm">
                  <PenSquare className="size-4" /> Write a post
                </ButtonLink>
              </>
            ) : undefined
          }
        />
        <div className="mb-8">{controls}</div>
        {body}
      </>
    )
  }

  return (
    <>
      <PageHero
        eyebrow="Blog"
        title="Notes from the floor"
        lead="What our coaches, clinicians and studios are learning, in their own words. Training, nutrition, recovery and the occasional studio announcement."
      >
        {canWrite && (
          <ButtonLink to="/app/blog/new" size="md">
            <PenSquare className="size-4" /> Write a post
          </ButtonLink>
        )}
      </PageHero>

      <section className="section">
        <div className="shell">
          <div className="mb-8">{controls}</div>
          {body}
        </div>
      </section>

      <CtaBand
        title="Prefer to talk it through?"
        lead="Reading is a start. Fifteen minutes with a coach will tell you which of it applies to you."
        primary={{ label: 'Book my 15 min call', to: '/book' }}
        secondary={{ label: 'Meet the specialists', to: '/specialists' }}
      />
    </>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
        active
          ? 'border-volt-400 bg-volt-400 text-ink-950'
          : 'border-ink-600 text-chalk-dim hover:border-ink-500 hover:text-chalk',
      )}
    >
      {children}
    </button>
  )
}
