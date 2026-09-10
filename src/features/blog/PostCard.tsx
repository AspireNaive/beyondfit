import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import type { Post } from '@/domain/content/model'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { cn } from '@/shared/lib/cn'
import { coverGradient, postDate } from './format'

export function PostCover({ post, className }: { post: Post; className?: string }) {
  return (
    <div className={cn('relative overflow-hidden bg-ink-900', className)} style={{ background: coverGradient(post.slug) }}>
      {post.coverImageUrl && (
        <img
          src={post.coverImageUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
        />
      )}
      <div aria-hidden className="absolute inset-0 bg-gradient-to-t from-ink-950/70 via-transparent to-transparent" />
    </div>
  )
}

export function PostCard({ post, basePath = '/blog' }: { post: Post; basePath?: string }) {
  const href = `${basePath}/${post.slug}`
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-850/70 transition-colors hover:border-ink-500">
      <Link to={href} className="block" aria-hidden tabIndex={-1}>
        <PostCover post={post} className="aspect-[16/10]" />
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex flex-wrap items-center gap-2">
          {post.tags.slice(0, 2).map((tag) => (
            <Badge key={tag} tone="volt">
              {tag}
            </Badge>
          ))}
          <span className="ml-auto flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
            <Clock className="size-3" /> {post.readingMinutes} min
          </span>
        </div>

        <h3 className="mt-3 text-2xl leading-tight text-balance">
          <Link to={href} className="transition-colors hover:text-volt-400">
            {post.title}
          </Link>
        </h3>

        <p className="mt-2 flex-1 text-sm leading-relaxed text-chalk-dim text-pretty">{post.excerpt}</p>

        <div className="mt-5 flex items-center gap-3 border-t border-ink-700 pt-4">
          <Avatar name={post.authorName} src={post.authorAvatarUrl} size="sm" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-chalk">{post.authorName}</p>
            <p className="truncate text-xs text-chalk-faint">{post.tenantName}</p>
          </div>
          <time dateTime={post.publishedAt ?? post.createdAt} className="shrink-0 text-xs text-chalk-faint">
            {postDate(post)}
          </time>
        </div>
      </div>
    </article>
  )
}
