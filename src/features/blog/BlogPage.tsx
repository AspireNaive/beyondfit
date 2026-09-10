import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useParams, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, Newspaper, PenSquare, Search, X } from 'lucide-react'
import type { Post } from '@/domain/content/model'
import { Permission } from '@/domain/identity/model'
import { useCan } from '@/features/auth/store'
import { Avatar } from '@/shared/ui/Avatar'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { PageHeading } from '@/shared/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/Feedback'
import { cn } from '@/shared/lib/cn'
import { FeedCard } from './FeedCard'
import { usePostFeed } from './hooks'
import { blogPaths } from './paths'

/**
 * The public blog, laid out like a social feed: one column of posts, newest
 * first, that keeps loading older ones as the reader scrolls. Every studio and
 * every coach has their own version of it (/blog/studio/:slug, /blog/author/:id),
 * and the search box looks inside the articles, not just at their titles.
 * Readable signed in or not; renders in the marketing shell and the app shell.
 */
export default function BlogPage() {
  const location = useLocation()
  const inApp = location.pathname.startsWith('/app')
  const paths = blogPaths(inApp)
  const canWrite = useCan(Permission.PublishContent)

  const { tenantSlug, authorId } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  const tag = searchParams.get('tag') ?? undefined
  const submitted = searchParams.get('q') ?? undefined
  const [query, setQuery] = useState(submitted ?? '')
  useEffect(() => setQuery(submitted ?? ''), [submitted])

  const setParam = (key: 'tag' | 'q', value: string | undefined) => {
    const next = new URLSearchParams(searchParams)
    if (value) next.set(key, value)
    else next.delete(key)
    setSearchParams(next, { replace: key === 'q' })
  }

  const scope = useMemo(
    () => ({ ...(tenantSlug ? { tenantSlug } : {}), ...(authorId ? { authorId } : {}) }),
    [tenantSlug, authorId],
  )
  const feed = usePostFeed({ ...scope, ...(tag ? { tag } : {}), ...(submitted ? { query: submitted } : {}) })
  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data])
  const total = feed.data?.pages[0]?.total ?? 0

  // The sidebar (tags, studios, coaches) and the scope header come from the
  // unfiltered scope, so clearing a search never empties them.
  const context = usePostFeed(scope)
  const contextPosts = useMemo(() => context.data?.pages.flatMap((p) => p.items) ?? [], [context.data])
  const sidebar = useMemo(() => summarise(contextPosts, tag), [contextPosts, tag])
  const scopeTotal = context.data?.pages[0]?.total ?? 0
  const lead = contextPosts[0]

  // Infinite scroll: a sentinel below the last card asks for the next page.
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !feed.hasNextPage || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && !feed.isFetchingNextPage) void feed.fetchNextPage()
      },
      { rootMargin: '600px 0px' },
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [feed.hasNextPage, feed.isFetchingNextPage, feed.fetchNextPage, feed])

  const filtered = Boolean(tag || submitted)
  const scoped = Boolean(tenantSlug || authorId)

  const clearFilters = () => {
    setQuery('')
    setSearchParams(new URLSearchParams(), { replace: true })
  }

  const searchBox = (
    <form
      role="search"
      className="relative"
      onSubmit={(e) => {
        e.preventDefault()
        setParam('q', query.trim() || undefined)
      }}
    >
      <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-chalk-faint" />
      <input
        type="search"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          if (e.target.value === '' && submitted) setParam('q', undefined)
        }}
        placeholder="Search articles and their content"
        aria-label="Search articles"
        className="h-11 w-full rounded-lg border border-ink-600 bg-ink-900/80 pl-10 pr-3.5 text-sm outline-none transition-colors placeholder:text-chalk-faint focus:border-volt-400"
      />
    </form>
  )

  const scopeHeader = scoped ? (
    <ScopeHeader
      kind={authorId ? 'author' : 'studio'}
      lead={lead}
      loading={context.isPending}
      total={scopeTotal}
      fallbackName={authorId ? 'Coach' : tenantSlug ?? 'Studio'}
      paths={paths}
    />
  ) : null

  const activeFilters = filtered && (
    <div className="flex flex-wrap items-center gap-2 text-sm text-chalk-dim">
      <span>
        {total} result{total === 1 ? '' : 's'}
      </span>
      {submitted && <Chip onRemove={() => setParam('q', undefined)}>“{submitted}”</Chip>}
      {tag && <Chip onRemove={() => setParam('tag', undefined)}>#{tag}</Chip>}
      <button type="button" onClick={clearFilters} className="text-xs font-semibold uppercase tracking-wider text-volt-400">
        Clear
      </button>
    </div>
  )

  const column = feed.isPending ? (
    <div className="space-y-6" role="status" aria-label="Loading articles">
      {Array.from({ length: 2 }, (_, i) => (
        <Skeleton key={i} className="h-[32rem] w-full rounded-2xl" />
      ))}
    </div>
  ) : feed.isError ? (
    <ErrorState description="Couldn't load the blog." onRetry={() => void feed.refetch()} />
  ) : posts.length === 0 ? (
    <EmptyState
      icon={Newspaper}
      title={filtered ? 'Nothing matches that' : 'No articles yet'}
      description={
        filtered
          ? 'Try another word or tag, or clear the search.'
          : scoped
            ? 'Nothing published here yet. Check back soon.'
            : canWrite
              ? 'Be the first to publish something for your members.'
              : 'Coaches and studios publish here. Check back soon.'
      }
      action={
        filtered ? (
          <Button variant="outline" size="sm" onClick={clearFilters}>
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
    <div className="space-y-6">
      {posts.map((post) => (
        <FeedCard key={post.id} post={post} paths={paths} />
      ))}
      <div ref={sentinel} aria-hidden className="h-px" />
      {feed.hasNextPage ? (
        <div className="flex justify-center py-2">
          <Button variant="outline" size="md" loading={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
            Show older articles
          </Button>
        </div>
      ) : (
        posts.length > 3 && (
          <p className="py-4 text-center text-xs font-semibold uppercase tracking-wider text-chalk-faint">
            You're all caught up
          </p>
        )
      )}
    </div>
  )

  const layout = (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="mx-auto w-full min-w-0 max-w-2xl space-y-6">
        <div className="lg:hidden">{searchBox}</div>
        {activeFilters}
        {column}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-28 space-y-8">
          {searchBox}
          <SidebarSection title="Topics">
            <div className="flex flex-wrap gap-2">
              {sidebar.tags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setParam('tag', tag === t ? undefined : t)}
                  aria-pressed={tag === t}
                  className={cn(
                    'rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors',
                    tag === t
                      ? 'border-volt-400 bg-volt-400 text-ink-950'
                      : 'border-ink-600 text-chalk-dim hover:border-ink-500 hover:text-chalk',
                  )}
                >
                  {t}
                </button>
              ))}
              {sidebar.tags.length === 0 && <p className="text-xs text-chalk-faint">No topics yet.</p>}
            </div>
          </SidebarSection>

          {!tenantSlug && sidebar.studios.length > 0 && (
            <SidebarSection title="Studios">
              <ul className="space-y-1">
                {sidebar.studios.map((s) => (
                  <li key={s.slug}>
                    <Link
                      to={paths.studio(s.slug)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm text-chalk-dim transition-colors hover:bg-ink-800 hover:text-chalk"
                    >
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-ink-800 text-chalk-faint">
                        <Building2 className="size-4" />
                      </span>
                      <span className="min-w-0 flex-1 truncate">{s.name}</span>
                      <span className="text-xs tabular-nums text-chalk-faint">{s.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SidebarSection>
          )}

          {!authorId && sidebar.authors.length > 0 && (
            <SidebarSection title="Coaches & staff">
              <ul className="space-y-1">
                {sidebar.authors.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={paths.author(a.id)}
                      className="flex items-center gap-3 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-ink-800"
                    >
                      <Avatar name={a.name} src={a.avatarUrl} size="sm" />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="block truncate text-chalk">{a.name}</span>
                        {a.title && <span className="block truncate text-xs text-chalk-faint">{a.title}</span>}
                      </span>
                      <span className="text-xs tabular-nums text-chalk-faint">{a.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </SidebarSection>
          )}
        </div>
      </aside>
    </div>
  )

  if (inApp) {
    return (
      <>
        {scoped ? (
          <div className="mb-6">
            <Link to={paths.feed} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-dim hover:text-volt-400">
              <ArrowLeft className="size-3.5" /> Whole blog
            </Link>
            {scopeHeader}
          </div>
        ) : (
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
        )}
        {layout}
      </>
    )
  }

  return (
    <>
      <section className="relative isolate overflow-hidden border-b border-ink-700">
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(60% 90% at 15% 0%, rgba(182,239,33,0.14), transparent 60%),' +
              'radial-gradient(50% 80% at 85% 10%, rgba(76,201,240,0.12), transparent 60%),' +
              'linear-gradient(180deg, #0c141d, #06090d)',
          }}
        />
        <div className="shell pb-10 pt-28 lg:pb-12 lg:pt-36">
          {scoped ? (
            <>
              <Link to={paths.feed} className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-dim hover:text-volt-400">
                <ArrowLeft className="size-3.5" /> Whole blog
              </Link>
              {scopeHeader}
            </>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">Blog</p>
                <h1 className="mt-4 max-w-4xl text-[clamp(2.5rem,6.5vw,4.5rem)] text-balance">Notes from the floor</h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-dim text-pretty">
                  What our coaches, clinicians and studios are learning, in their own words. Scroll for the
                  latest; keep scrolling for everything before it.
                </p>
              </div>
              {canWrite && (
                <ButtonLink to="/app/blog/new" size="md">
                  <PenSquare className="size-4" /> Write a post
                </ButtonLink>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="py-10 lg:py-14">
        <div className="shell">{layout}</div>
      </section>
    </>
  )
}

// ---------------------------------------------------------------------------

type Sidebar = {
  tags: string[]
  studios: { slug: string; name: string; count: number }[]
  authors: { id: string; name: string; title?: string; avatarUrl?: string | null; count: number }[]
}

/** Topics, studios and authors seen in the loaded posts, most frequent first. */
function summarise(posts: readonly Post[], activeTag?: string): Sidebar {
  const tags = new Map<string, number>()
  const studios = new Map<string, Sidebar['studios'][number]>()
  const authors = new Map<string, Sidebar['authors'][number]>()
  for (const post of posts) {
    for (const t of post.tags) tags.set(t, (tags.get(t) ?? 0) + 1)
    const studio = studios.get(post.tenantSlug) ?? { slug: post.tenantSlug, name: post.tenantName, count: 0 }
    studio.count++
    studios.set(post.tenantSlug, studio)
    const author = authors.get(post.authorId) ?? {
      id: post.authorId,
      name: post.authorName,
      title: post.authorTitle,
      avatarUrl: post.authorAvatarUrl,
      count: 0,
    }
    author.count++
    authors.set(post.authorId, author)
  }
  const byCount = <T extends { count: number }>(a: T, b: T) => b.count - a.count
  const tagList = [...tags.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t)
  if (activeTag && !tagList.includes(activeTag)) tagList.unshift(activeTag)
  return {
    tags: tagList,
    studios: [...studios.values()].sort(byCount),
    authors: [...authors.values()].sort(byCount).slice(0, 8),
  }
}

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <p className="eyebrow">{title}</p>
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Chip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-ink-600 bg-ink-800 px-2.5 py-1 text-xs text-chalk">
      {children}
      <button type="button" onClick={onRemove} aria-label="Remove filter" className="rounded-full p-0.5 text-chalk-faint hover:text-chalk">
        <X className="size-3" />
      </button>
    </span>
  )
}

/** Profile-style header for a studio's or a coach's own blog. */
function ScopeHeader({
  kind,
  lead,
  loading,
  total,
  fallbackName,
  paths,
}: {
  kind: 'studio' | 'author'
  lead: Post | undefined
  loading: boolean
  total: number
  fallbackName: string
  paths: ReturnType<typeof blogPaths>
}) {
  if (loading) {
    return (
      <div className="mt-6 flex items-center gap-5">
        <Skeleton className="size-20 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
    )
  }
  const name = lead ? (kind === 'author' ? lead.authorName : lead.tenantName) : fallbackName
  const subtitle = lead
    ? kind === 'author'
      ? [lead.authorTitle, lead.tenantName].filter(Boolean).join(' · ')
      : 'Studio blog'
    : ''
  return (
    <div className="mt-6 flex flex-wrap items-center gap-5">
      {kind === 'author' ? (
        <Avatar name={name} src={lead?.authorAvatarUrl} size="xl" />
      ) : (
        <span className="grid size-24 shrink-0 place-items-center rounded-full border border-ink-600 bg-ink-800 text-chalk-dim">
          <Building2 className="size-9" />
        </span>
      )}
      <div className="min-w-0">
        <p className="eyebrow">{kind === 'author' ? "Coach's blog" : 'Studio blog'}</p>
        <h1 className="mt-2 text-[clamp(2rem,5vw,3.5rem)] text-balance">{name}</h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-chalk-dim">
          {subtitle && <span>{subtitle}</span>}
          <span className="tabular-nums">
            <strong className="text-chalk">{total}</strong> post{total === 1 ? '' : 's'}
          </span>
          {kind === 'author' && lead && (
            <Link to={paths.studio(lead.tenantSlug)} className="text-volt-400 hover:underline">
              All of {lead.tenantName}
            </Link>
          )}
        </p>
      </div>
    </div>
  )
}
