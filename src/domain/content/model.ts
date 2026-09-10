import type { Role } from '@/domain/identity/model'
import type { IsoDateTime, PostId, TenantId, UserId } from '@/domain/shared/types'

/**
 * Content — the bounded context that owns articles and blog posts written by
 * coaches and studio staff and read by anyone, signed in or not.
 *
 * A post body is a list of typed blocks rather than HTML. That keeps the
 * editor simple (no rich-text engine), makes rendering safe by construction
 * (React escapes every string; nothing is ever injected as markup) and lets the
 * reader build a table of contents from the heading blocks.
 */

export const PostStatus = {
  Draft: 'draft',
  Published: 'published',
} as const

export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus]

export const POST_STATUS_LABELS: Record<PostStatus, string> = {
  [PostStatus.Draft]: 'Draft',
  [PostStatus.Published]: 'Published',
}

export const PostBlockType = {
  Heading: 'heading',
  Paragraph: 'paragraph',
  Image: 'image',
  Video: 'video',
  Quote: 'quote',
  List: 'list',
} as const

export type PostBlockType = (typeof PostBlockType)[keyof typeof PostBlockType]

export const POST_BLOCK_LABELS: Record<PostBlockType, string> = {
  [PostBlockType.Heading]: 'Heading',
  [PostBlockType.Paragraph]: 'Paragraph',
  [PostBlockType.Image]: 'Image',
  [PostBlockType.Video]: 'Video',
  [PostBlockType.Quote]: 'Quote',
  [PostBlockType.List]: 'Bullet list',
}

export type HeadingBlock = { readonly type: 'heading'; readonly text: string }
export type ParagraphBlock = { readonly type: 'paragraph'; readonly text: string }
export type ImageBlock = {
  readonly type: 'image'
  readonly url: string
  readonly alt: string
  readonly caption?: string
}
/** A link to YouTube, Vimeo or a direct video file. Embedding is a UI concern. */
export type VideoBlock = { readonly type: 'video'; readonly url: string; readonly caption?: string }
export type QuoteBlock = { readonly type: 'quote'; readonly text: string; readonly attribution?: string }
export type ListBlock = { readonly type: 'list'; readonly items: readonly string[] }

export type PostBlock = HeadingBlock | ParagraphBlock | ImageBlock | VideoBlock | QuoteBlock | ListBlock

export type Post = {
  readonly id: PostId
  readonly tenantId: TenantId
  readonly tenantName: string
  readonly tenantSlug: string
  readonly slug: string
  readonly title: string
  /** One or two sentences shown on the feed card. */
  readonly excerpt: string
  readonly coverImageUrl?: string | null
  readonly tags: readonly string[]
  readonly blocks: readonly PostBlock[]
  readonly authorId: UserId
  readonly authorName: string
  readonly authorRole: Role
  readonly authorTitle?: string
  readonly authorAvatarUrl?: string | null
  readonly status: PostStatus
  /** Set the first time a post is published; kept when it is unpublished. */
  readonly publishedAt?: IsoDateTime | null
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
  readonly readingMinutes: number
}

/** What an author supplies. Everything else on `Post` is derived server-side. */
export type PostInput = {
  readonly title: string
  readonly slug: string
  readonly excerpt: string
  readonly coverImageUrl?: string | null
  readonly tags: readonly string[]
  readonly blocks: readonly PostBlock[]
  readonly status: PostStatus
}

export type PostFilter = {
  /** Only posts from this studio — its own blog. */
  readonly tenantSlug?: string
  /** Only posts by this coach or staff member — their own blog. */
  readonly authorId?: string
  readonly tag?: string
  /** Substring match on title, excerpt, tags and the body text. */
  readonly query?: string
  /** 1-based. */
  readonly page?: number
  readonly pageSize?: number
}

export const POSTS_PAGE_SIZE = 9

// --- Helpers shared by the editor, the mock adapter and the seed ------------

/** URL-safe slug from a title: `Why Zone 2 Works` → `why-zone-2-works`. */
export const slugify = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)

export const SLUG_PATTERN = /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/

/** Words in the body, so the card can show "4 min read". */
export function wordCount(blocks: readonly PostBlock[]): number {
  let words = 0
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
      case 'quote':
        words += countWords(block.text)
        break
      case 'list':
        for (const item of block.items) words += countWords(item)
        break
      case 'image':
        words += countWords(block.caption ?? '')
        break
      case 'video':
        words += countWords(block.caption ?? '')
        break
    }
  }
  return words
}

const countWords = (text: string) => text.split(/\s+/).filter(Boolean).length

/** Every human-readable string in the body, for search. */
export function blockText(blocks: readonly PostBlock[]): string {
  const parts: string[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
        parts.push(block.text)
        break
      case 'quote':
        parts.push(block.text, block.attribution ?? '')
        break
      case 'list':
        parts.push(...block.items)
        break
      case 'image':
        parts.push(block.alt, block.caption ?? '')
        break
      case 'video':
        parts.push(block.caption ?? '')
        break
    }
  }
  return parts.join(' ')
}

/** Does a post match a free-text search? Title, summary, tags and body. */
export function postMatches(
  post: Pick<Post, 'title' | 'excerpt' | 'tags' | 'blocks'>,
  query: string,
): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return (
    post.title.toLowerCase().includes(q) ||
    post.excerpt.toLowerCase().includes(q) ||
    post.tags.some((t) => t.toLowerCase().includes(q)) ||
    blockText(post.blocks).toLowerCase().includes(q)
  )
}

/** 200 words a minute, never less than one minute; images count for a little. */
export const readingMinutes = (blocks: readonly PostBlock[]) =>
  Math.max(1, Math.round((wordCount(blocks) + blocks.filter((b) => b.type === 'image' || b.type === 'video').length * 30) / 200))

/** Stable anchor for a heading block, unique within a post. */
export function headingAnchors(blocks: readonly PostBlock[]): Map<number, string> {
  const seen = new Map<string, number>()
  const anchors = new Map<number, string>()
  blocks.forEach((block, index) => {
    if (block.type !== 'heading') return
    const base = slugify(block.text) || `section-${index + 1}`
    const count = seen.get(base) ?? 0
    seen.set(base, count + 1)
    anchors.set(index, count === 0 ? base : `${base}-${count + 1}`)
  })
  return anchors
}

export type VideoEmbed =
  | { readonly kind: 'youtube'; readonly src: string }
  | { readonly kind: 'vimeo'; readonly src: string }
  | { readonly kind: 'file'; readonly src: string }
  | { readonly kind: 'link'; readonly href: string }

/**
 * Turns a pasted video link into something the reader can show inline.
 * Only YouTube and Vimeo are embedded (they are the only hosts the CSP
 * allows in a frame); direct files play in <video>; anything else stays a link.
 */
export function videoEmbed(url: string): VideoEmbed {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return { kind: 'link', href: url }
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return { kind: 'link', href: url }

  const host = parsed.hostname.replace(/^www\./, '').replace(/^m\./, '')
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    const id =
      parsed.pathname === '/watch'
        ? parsed.searchParams.get('v')
        : parsed.pathname.match(/^\/(?:embed|shorts|live)\/([\w-]{6,})/)?.[1]
    if (id && /^[\w-]{6,}$/.test(id)) {
      return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` }
    }
  }
  if (host === 'youtu.be') {
    const id = parsed.pathname.slice(1).split('/')[0]
    if (id && /^[\w-]{6,}$/.test(id)) {
      return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` }
    }
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const id = parsed.pathname.match(/(\d{6,})/)?.[1]
    if (id) return { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}` }
  }
  if (/\.(mp4|webm|ogg|mov|m4v)$/i.test(parsed.pathname)) return { kind: 'file', src: url }
  return { kind: 'link', href: url }
}
