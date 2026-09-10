import { ExternalLink, Play } from 'lucide-react'
import { headingAnchors, videoEmbed, type PostBlock } from '@/domain/content/model'
import { cn } from '@/shared/lib/cn'

/**
 * Renders a post body. Every block is data, never markup — React escapes the
 * strings, so an author can paste anything into a paragraph without it
 * becoming HTML. Headings carry ids so the table of contents can scroll to them.
 */
export function PostContent({
  blocks,
  className,
}: {
  blocks: readonly PostBlock[]
  className?: string
}) {
  const anchors = headingAnchors(blocks)

  return (
    <div className={cn('space-y-6', className)}>
      {blocks.map((block, index) => (
        <Block key={index} block={block} anchor={anchors.get(index)} />
      ))}
    </div>
  )
}

function Block({ block, anchor }: { block: PostBlock; anchor?: string }) {
  switch (block.type) {
    case 'heading':
      return (
        <h2 id={anchor} className="scroll-mt-28 pt-4 text-3xl text-chalk sm:text-4xl">
          {block.text}
        </h2>
      )
    case 'paragraph':
      return (
        <p className="text-base leading-relaxed text-chalk-dim text-pretty sm:text-lg">
          {block.text}
        </p>
      )
    case 'quote':
      return (
        <figure className="border-l-2 border-volt-400 pl-5 sm:pl-6">
          <blockquote className="font-display text-2xl leading-tight tracking-wide text-chalk text-balance sm:text-3xl">
            “{block.text}”
          </blockquote>
          {block.attribution && (
            <figcaption className="mt-3 text-sm text-chalk-faint">— {block.attribution}</figcaption>
          )}
        </figure>
      )
    case 'list':
      return (
        <ul className="space-y-2.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-base leading-relaxed text-chalk-dim sm:text-lg">
              <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-volt-400" aria-hidden />
              <span className="text-pretty">{item}</span>
            </li>
          ))}
        </ul>
      )
    case 'image':
      return (
        <figure>
          <img
            src={block.url}
            alt={block.alt}
            loading="lazy"
            decoding="async"
            className="w-full rounded-xl border border-ink-700 bg-ink-900 object-cover"
          />
          {block.caption && (
            <figcaption className="mt-2.5 text-center text-xs text-chalk-faint">{block.caption}</figcaption>
          )}
        </figure>
      )
    case 'video':
      return <Video url={block.url} caption={block.caption} />
  }
}

function Video({ url, caption }: { url: string; caption?: string }) {
  const embed = videoEmbed(url)

  const frame =
    embed.kind === 'youtube' || embed.kind === 'vimeo' ? (
      <iframe
        src={embed.src}
        title={caption ?? 'Embedded video'}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 size-full"
      />
    ) : embed.kind === 'file' ? (
      <video src={embed.src} controls preload="metadata" className="absolute inset-0 size-full bg-ink-950" />
    ) : (
      <a
        href={embed.href}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute inset-0 grid place-items-center bg-ink-900 text-chalk-dim transition-colors hover:text-volt-400"
      >
        <span className="flex flex-col items-center gap-3 px-6 text-center">
          <span className="grid size-14 place-items-center rounded-full border border-ink-600">
            <Play className="size-6" />
          </span>
          <span className="flex items-center gap-1.5 text-sm font-semibold">
            Watch the video <ExternalLink className="size-3.5" />
          </span>
          <span className="max-w-full truncate text-xs text-chalk-faint">{embed.href}</span>
        </span>
      </a>
    )

  return (
    <figure>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-ink-700 bg-ink-900">
        {frame}
      </div>
      {caption && <figcaption className="mt-2.5 text-center text-xs text-chalk-faint">{caption}</figcaption>}
    </figure>
  )
}
