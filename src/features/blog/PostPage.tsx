import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowUp, Check, Clock, Link2, PenSquare } from 'lucide-react'
import { PostStatus, headingAnchors } from '@/domain/content/model'
import { Permission } from '@/domain/identity/model'
import { useCan, useCurrentUser } from '@/features/auth/store'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { ErrorState, Skeleton } from '@/shared/ui/Feedback'
import { cn } from '@/shared/lib/cn'
import { postDate } from './format'
import { PostCard, PostCover } from './PostCard'
import { PostContent } from './PostContent'
import { usePost, usePostFeed } from './hooks'
import { blogPaths } from './paths'

/** Thin bar along the top edge that fills as the reader scrolls the article. */
function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const onScroll = () => {
      const root = document.documentElement
      const total = root.scrollHeight - root.clientHeight
      setProgress(total > 0 ? Math.min(1, root.scrollTop / total) : 0)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 z-[60] h-0.5 bg-transparent">
      <div className="h-full bg-volt-400 transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
    </div>
  )
}

/** Section list that highlights the heading currently in view. */
function TableOfContents({ items }: { items: readonly { id: string; text: string }[] }) {
  const [active, setActive] = useState(items[0]?.id)

  useEffect(() => {
    if (items.length === 0 || typeof IntersectionObserver === 'undefined') return
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)
        if (visible[0]) setActive(visible[0].target.id)
      },
      { rootMargin: '-25% 0px -60% 0px' },
    )
    for (const item of items) {
      const el = document.getElementById(item.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [items])

  if (items.length === 0) return null

  return (
    <nav aria-label="In this article" className="text-sm">
      <p className="eyebrow">In this article</p>
      <ol className="mt-3 space-y-1 border-l border-ink-700">
        {items.map((item) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={(e) => {
                e.preventDefault()
                document.getElementById(item.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                history.replaceState(null, '', `#${item.id}`)
              }}
              className={cn(
                '-ml-px block border-l-2 py-1.5 pl-4 leading-snug transition-colors',
                active === item.id
                  ? 'border-volt-400 text-chalk'
                  : 'border-transparent text-chalk-faint hover:border-ink-500 hover:text-chalk-dim',
              )}
            >
              {item.text}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  )
}

function CopyLinkButton() {
  const [copied, setCopied] = useState(false)
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        navigator.clipboard
          ?.writeText(window.location.href)
          .then(() => {
            setCopied(true)
            window.setTimeout(() => setCopied(false), 1800)
          })
          .catch(() => {})
      }}
    >
      {copied ? <Check className="size-4" /> : <Link2 className="size-4" />}
      {copied ? 'Copied' : 'Copy link'}
    </Button>
  )
}

export default function PostPage() {
  const { slug } = useParams()
  const location = useLocation()
  const inApp = location.pathname.startsWith('/app')
  const paths = blogPaths(inApp)
  const basePath = inApp ? '/app/blog/read' : '/blog'
  const feedPath = paths.feed

  const user = useCurrentUser()
  const canWrite = useCan(Permission.PublishContent)

  const { data: post, isPending, isError } = usePost(slug)
  const more = usePostFeed({})

  const toc = useMemo(() => {
    if (!post) return []
    const anchors = headingAnchors(post.blocks)
    return post.blocks.flatMap((block, index) =>
      block.type === 'heading' ? [{ id: anchors.get(index)!, text: block.text }] : [],
    )
  }, [post])

  const related = useMemo(
    () => (more.data?.pages.flatMap((p) => p.items) ?? []).filter((p) => p.id !== post?.id).slice(0, 3),
    [more.data, post?.id],
  )

  useEffect(() => {
    if (post) document.title = `${post.title} — Kedem Life`
    return () => {
      document.title = 'Kedem Life'
    }
  }, [post])

  if (isPending) {
    return (
      <div className={cn('shell', inApp ? 'py-4' : 'py-32')}>
        <div className="mx-auto max-w-3xl space-y-5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-6 w-2/3" />
          <Skeleton className="aspect-[16/9] w-full rounded-2xl" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    )
  }

  if (isError || !post) {
    return (
      <div className={cn('shell', inApp ? 'py-4' : 'py-32')}>
        <ErrorState
          title="Article not found"
          description="It may have been unpublished or the link is wrong. Everything live is on the blog."
        />
        <div className="mt-6 text-center">
          <Link to={feedPath} className="text-sm text-volt-400 underline underline-offset-4">
            Back to the blog
          </Link>
        </div>
      </div>
    )
  }

  const canEdit =
    canWrite &&
    user &&
    (user.role === 'app_manager' ||
      (user.role === 'admin' && user.tenantId === post.tenantId) ||
      post.authorId === user.id)

  return (
    <>
      <ReadingProgress />

      <article className={cn(inApp ? '' : 'pt-24 lg:pt-32')}>
        <div className="shell">
          <div className="mx-auto max-w-5xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Link
                to={feedPath}
                className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-dim transition-colors hover:text-volt-400"
              >
                <ArrowLeft className="size-3.5" /> All articles
              </Link>
              {canEdit && (
                <ButtonLink to={`/app/blog/${post.id}/edit`} size="sm" variant="outline">
                  <PenSquare className="size-4" /> Edit
                </ButtonLink>
              )}
            </div>

            {post.status === PostStatus.Draft && (
              <div className="mt-4 rounded-lg border border-warn-500/40 bg-warn-500/10 px-4 py-3 text-sm text-warn-500">
                This is a draft. Only you and your studio staff can see it until it is published.
              </div>
            )}

            <header className="mt-6">
              <div className="flex flex-wrap items-center gap-2">
                {post.tags.map((tag) => (
                  <Link key={tag} to={paths.tag(tag)}>
                    <Badge tone="volt">{tag}</Badge>
                  </Link>
                ))}
              </div>
              <h1 className="mt-4 max-w-4xl text-[clamp(2.25rem,6vw,4.25rem)] text-balance">{post.title}</h1>
              <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-dim text-pretty">{post.excerpt}</p>

              <div className="mt-8 flex flex-wrap items-center gap-4 border-y border-ink-700 py-4">
                <div className="flex items-center gap-3">
                  <Link to={paths.author(post.authorId)} aria-label={`${post.authorName}'s blog`}>
                    <Avatar name={post.authorName} src={post.authorAvatarUrl} size="md" />
                  </Link>
                  <div>
                    <Link to={paths.author(post.authorId)} className="text-sm font-semibold text-chalk hover:text-volt-400">
                      {post.authorName}
                    </Link>
                    <p className="text-xs text-chalk-faint">
                      {post.authorTitle ? `${post.authorTitle} · ` : ''}
                      <Link to={paths.studio(post.tenantSlug)} className="hover:text-volt-400">
                        {post.tenantName}
                      </Link>
                    </p>
                  </div>
                </div>
                <p className="flex items-center gap-2 text-xs text-chalk-faint sm:ml-auto">
                  <time dateTime={post.publishedAt ?? post.createdAt}>{postDate(post)}</time>
                  <span aria-hidden>·</span>
                  <span className="flex items-center gap-1">
                    <Clock className="size-3" /> {post.readingMinutes} min read
                  </span>
                </p>
                <CopyLinkButton />
              </div>
            </header>

            {post.coverImageUrl && (
              <PostCover post={post} className="mt-8 aspect-[21/9] rounded-2xl border border-ink-700" />
            )}

            <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_14rem] lg:gap-14">
              <PostContent blocks={post.blocks} className="min-w-0 max-w-3xl" />

              <aside className="hidden lg:block">
                <div className="sticky top-28 space-y-8">
                  <TableOfContents items={toc} />
                  <button
                    type="button"
                    onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                    className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-faint transition-colors hover:text-volt-400"
                  >
                    <ArrowUp className="size-3.5" /> Back to top
                  </button>
                </div>
              </aside>
            </div>

            {toc.length > 0 && (
              <details className="mt-10 rounded-xl border border-ink-700 bg-ink-850/70 p-5 lg:hidden">
                <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-chalk-dim">
                  In this article
                </summary>
                <ol className="mt-4 space-y-2">
                  {toc.map((item) => (
                    <li key={item.id}>
                      <a href={`#${item.id}`} className="text-sm text-chalk-dim hover:text-volt-400">
                        {item.text}
                      </a>
                    </li>
                  ))}
                </ol>
              </details>
            )}
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className={cn('section', inApp ? 'pb-0' : 'border-t border-ink-700')}>
          <div className="shell">
            <div className="mb-6 flex items-end justify-between gap-4">
              <h2 className="text-3xl">More from the blog</h2>
              <div className="flex flex-wrap gap-4">
                <Link to={paths.author(post.authorId)} className="text-xs font-semibold uppercase tracking-wider text-volt-400">
                  More by {post.authorName.split(' ')[0]}
                </Link>
                <Link to={paths.studio(post.tenantSlug)} className="text-xs font-semibold uppercase tracking-wider text-volt-400">
                  {post.tenantName}
                </Link>
                <Link to={feedPath} className="text-xs font-semibold uppercase tracking-wider text-volt-400">
                  All articles
                </Link>
              </div>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((item) => (
                <PostCard key={item.id} post={item} basePath={basePath} />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  )
}
