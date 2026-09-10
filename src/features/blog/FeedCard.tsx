import { useState } from 'react'
import { Link } from 'react-router-dom'
import { BookOpen, ChevronDown, ChevronUp, Clock, Link2, Check } from 'lucide-react'
import { videoEmbed, type Post, type PostBlock } from '@/domain/content/model'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/cn'
import { coverGradient, postDate } from './format'
import { PostContent } from './PostContent'
import type { BlogPaths } from './paths'

/** The picture or video the card leads with: the cover, else the first media block. */
function leadMedia(post: Post): PostBlock | null {
  if (post.coverImageUrl) return { type: 'image', url: post.coverImageUrl, alt: '' }
  return post.blocks.find((b) => b.type === 'image' || b.type === 'video') ?? null
}

function Media({ post, media, href }: { post: Post; media: PostBlock | null; href: string }) {
  if (media?.type === 'video') {
    const embed = videoEmbed(media.url)
    if (embed.kind === 'youtube' || embed.kind === 'vimeo') {
      return (
        <div className="relative aspect-video bg-ink-950">
          <iframe
            src={embed.src}
            title={media.caption ?? post.title}
            loading="lazy"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            className="absolute inset-0 size-full"
          />
        </div>
      )
    }
    if (embed.kind === 'file') {
      return <video src={embed.src} controls preload="metadata" className="aspect-video w-full bg-ink-950" />
    }
  }
  return (
    <Link to={href} className="group relative block aspect-[4/3] overflow-hidden sm:aspect-[16/10]" style={{ background: coverGradient(post.slug) }}>
      {media?.type === 'image' && (
        <img
          src={media.url}
          alt={media.alt}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      )}
      {!media && (
        <div className="absolute inset-0 flex items-end p-6 sm:p-8">
          <p className="font-display text-4xl uppercase leading-none tracking-wide text-chalk text-balance drop-shadow sm:text-5xl">
            {post.title}
          </p>
        </div>
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-950/60 via-transparent to-transparent" />
    </Link>
  )
}

/**
 * One item in the scrolling feed: who posted, the picture or video, the
 * title and summary, and a "Read more" that unfolds the full article in place
 * — the way a caption expands — with a link to the article page for those who
 * want it on its own.
 */
export function FeedCard({ post, paths }: { post: Post; paths: BlogPaths }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const href = paths.post(post.slug)
  const media = leadMedia(post)

  const copy = () => {
    const url = `${window.location.origin}${href}`
    navigator.clipboard
      ?.writeText(url)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
      })
      .catch(() => {})
  }

  return (
    <article className="overflow-hidden rounded-2xl border border-ink-700 bg-ink-850/70">
      <header className="flex items-center gap-3 px-4 py-3 sm:px-5">
        <Link to={paths.author(post.authorId)} aria-label={`${post.authorName}'s blog`}>
          <Avatar name={post.authorName} src={post.authorAvatarUrl} size="md" />
        </Link>
        <div className="min-w-0 flex-1 leading-tight">
          <Link to={paths.author(post.authorId)} className="block truncate text-sm font-semibold text-chalk hover:text-volt-400">
            {post.authorName}
          </Link>
          <p className="truncate text-xs text-chalk-faint">
            {post.authorTitle ? `${post.authorTitle} · ` : ''}
            <Link to={paths.studio(post.tenantSlug)} className="hover:text-volt-400">
              {post.tenantName}
            </Link>
          </p>
        </div>
        <time dateTime={post.publishedAt ?? post.createdAt} className="shrink-0 text-xs text-chalk-faint">
          {postDate(post)}
        </time>
      </header>

      <Media post={post} media={media} href={href} />

      <div className="px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center gap-2">
          {post.tags.map((tag) => (
            <Link key={tag} to={paths.tag(tag)}>
              <Badge tone="volt">{tag}</Badge>
            </Link>
          ))}
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
            <Clock className="size-3" /> {post.readingMinutes} min
          </span>
        </div>

        <h2 className="mt-3 text-2xl leading-tight text-balance sm:text-3xl">
          <Link to={href} className="transition-colors hover:text-volt-400">
            {post.title}
          </Link>
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-chalk-dim text-pretty sm:text-base">{post.excerpt}</p>

        {expanded && (
          <div className="mt-6 border-t border-ink-700 pt-6">
            <PostContent blocks={post.blocks} />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-4">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-volt-400"
          >
            {expanded ? <ChevronUp className="size-3.5" /> : <ChevronDown className="size-3.5" />}
            {expanded ? 'Show less' : 'Read more'}
          </button>
          <Link
            to={href}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-dim transition-colors hover:text-chalk"
          >
            <BookOpen className="size-3.5" /> Open article
          </Link>
          <button
            type="button"
            onClick={copy}
            className={cn(
              'ml-auto inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
              copied ? 'text-ok-500' : 'text-chalk-faint hover:text-chalk',
            )}
          >
            {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />}
            {copied ? 'Copied' : 'Share'}
          </button>
        </div>
      </div>
    </article>
  )
}
