import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Eye,
  Globe,
  Heading2,
  Image as ImageIcon,
  List as ListIcon,
  Pilcrow,
  Plus,
  Quote,
  Save,
  Trash2,
  Video,
} from 'lucide-react'
import {
  POST_BLOCK_LABELS,
  PostBlockType,
  PostStatus,
  SLUG_PATTERN,
  readingMinutes,
  slugify,
  type Post,
  type PostBlock,
  type PostInput,
} from '@/domain/content/model'
import type { PostId } from '@/domain/shared/types'
import { useCurrentUser } from '@/features/auth/store'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody } from '@/shared/ui/Card'
import { ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { Input, Textarea } from '@/shared/ui/Field'
import { cn } from '@/shared/lib/cn'
import { PostContent } from './PostContent'
import { useCreatePost, useManagedPosts, useUpdatePost } from './hooks'

/**
 * The writing surface. Deliberately a structured block editor rather than a
 * rich-text field: authors pick a block (heading, paragraph, image, video,
 * quote, list), fill it in and reorder it. The result is data the reader can
 * render safely and build a table of contents from.
 */

type Draft = {
  title: string
  slug: string
  slugTouched: boolean
  excerpt: string
  coverImageUrl: string
  tags: string
  blocks: PostBlock[]
}

const emptyBlock = (type: PostBlock['type']): PostBlock => {
  switch (type) {
    case 'heading':
      return { type, text: '' }
    case 'paragraph':
      return { type, text: '' }
    case 'image':
      return { type, url: '', alt: '', caption: '' }
    case 'video':
      return { type, url: '', caption: '' }
    case 'quote':
      return { type, text: '', attribution: '' }
    case 'list':
      return { type, items: [''] }
  }
}

const BLOCK_ICONS: Record<PostBlock['type'], React.ComponentType<{ className?: string }>> = {
  heading: Heading2,
  paragraph: Pilcrow,
  image: ImageIcon,
  video: Video,
  quote: Quote,
  list: ListIcon,
}

const fromPost = (post: Post): Draft => ({
  title: post.title,
  slug: post.slug,
  slugTouched: true,
  excerpt: post.excerpt,
  coverImageUrl: post.coverImageUrl ?? '',
  tags: post.tags.join(', '),
  blocks: post.blocks.map((b) => ({ ...b })),
})

const blank = (): Draft => ({
  title: '',
  slug: '',
  slugTouched: false,
  excerpt: '',
  coverImageUrl: '',
  tags: '',
  blocks: [{ type: 'paragraph', text: '' }],
})

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:'
  } catch {
    return false
  }
}

/** Drops empty blocks and trims; what actually gets saved. */
function cleanBlocks(blocks: readonly PostBlock[]): PostBlock[] {
  const out: PostBlock[] = []
  for (const block of blocks) {
    switch (block.type) {
      case 'heading':
      case 'paragraph':
        if (block.text.trim()) out.push({ type: block.type, text: block.text.trim() })
        break
      case 'quote':
        if (block.text.trim()) {
          out.push({
            type: 'quote',
            text: block.text.trim(),
            ...(block.attribution?.trim() ? { attribution: block.attribution.trim() } : {}),
          })
        }
        break
      case 'list': {
        const items = block.items.map((i) => i.trim()).filter(Boolean)
        if (items.length) out.push({ type: 'list', items })
        break
      }
      case 'image':
        if (block.url.trim()) {
          out.push({
            type: 'image',
            url: block.url.trim(),
            alt: block.alt.trim(),
            ...(block.caption?.trim() ? { caption: block.caption.trim() } : {}),
          })
        }
        break
      case 'video':
        if (block.url.trim()) {
          out.push({
            type: 'video',
            url: block.url.trim(),
            ...(block.caption?.trim() ? { caption: block.caption.trim() } : {}),
          })
        }
        break
    }
  }
  return out
}

function validate(draft: Draft): Record<string, string> {
  const errors: Record<string, string> = {}
  if (draft.title.trim().length < 3) errors.title = 'Give the article a title (at least 3 characters).'
  if (!SLUG_PATTERN.test(draft.slug)) errors.slug = 'Lower-case letters, digits and hyphens only.'
  if (draft.excerpt.trim().length < 10) errors.excerpt = 'Write a short summary for the feed card.'
  if (draft.coverImageUrl.trim() && !isHttpUrl(draft.coverImageUrl.trim())) errors.coverImageUrl = 'Paste a full https:// link.'
  const blocks = cleanBlocks(draft.blocks)
  if (blocks.length === 0) errors.blocks = 'Add at least one block of content.'
  for (const block of blocks) {
    if ((block.type === 'image' || block.type === 'video') && !isHttpUrl(block.url)) {
      errors.blocks = `Every ${block.type} needs a full https:// link.`
      break
    }
  }
  return errors
}

const toInput = (draft: Draft, status: PostStatus): PostInput => ({
  title: draft.title.trim(),
  slug: draft.slug,
  excerpt: draft.excerpt.trim(),
  coverImageUrl: draft.coverImageUrl.trim() || null,
  tags: [...new Set(draft.tags.split(',').map((t) => t.trim()).filter(Boolean))].slice(0, 8),
  blocks: cleanBlocks(draft.blocks),
  status,
})

export default function PostEditorPage() {
  const { postId } = useParams()
  const navigate = useNavigate()
  const user = useCurrentUser()
  const editing = Boolean(postId)

  const managed = useManagedPosts(user)
  const existing = useMemo(() => managed.data?.find((p) => p.id === postId), [managed.data, postId])

  const [draft, setDraft] = useState<Draft>(blank)
  const [loadedId, setLoadedId] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [preview, setPreview] = useState(false)
  const [savedAt, setSavedAt] = useState<string | null>(null)

  // Hydrate once the post we are editing arrives; never clobber in-progress edits.
  useEffect(() => {
    if (existing && loadedId !== existing.id) {
      setDraft(fromPost(existing))
      setLoadedId(existing.id)
    }
  }, [existing, loadedId])

  const create = useCreatePost(user)
  const update = useUpdatePost()
  const saving = create.isPending || update.isPending
  const saveError = (create.error ?? update.error) as Error | null

  const patch = (partial: Partial<Draft>) => setDraft((d) => ({ ...d, ...partial }))

  const setTitle = (title: string) =>
    setDraft((d) => ({ ...d, title, slug: d.slugTouched ? d.slug : slugify(title) }))

  const updateBlock = (index: number, block: PostBlock) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.map((b, i) => (i === index ? block : b)) }))

  const moveBlock = (index: number, delta: -1 | 1) =>
    setDraft((d) => {
      const next = [...d.blocks]
      const target = index + delta
      if (target < 0 || target >= next.length) return d
      ;[next[index], next[target]] = [next[target]!, next[index]!]
      return { ...d, blocks: next }
    })

  const removeBlock = (index: number) =>
    setDraft((d) => ({ ...d, blocks: d.blocks.filter((_, i) => i !== index) }))

  const addBlock = (type: PostBlock['type'], after?: number) =>
    setDraft((d) => {
      const next = [...d.blocks]
      next.splice(after === undefined ? next.length : after + 1, 0, emptyBlock(type))
      return { ...d, blocks: next }
    })

  const save = (status: PostStatus) => {
    const found = validate(draft)
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setPreview(false)
      return
    }
    const input = toInput(draft, status)
    const onSuccess = (post: Post) => {
      setSavedAt(new Date().toLocaleTimeString())
      if (status === PostStatus.Published) navigate(`/app/blog/read/${post.slug}`)
      else if (!editing) navigate(`/app/blog/${post.id}/edit`, { replace: true })
    }
    if (editing && existing) update.mutate({ id: existing.id as PostId, patch: input }, { onSuccess })
    else create.mutate(input, { onSuccess })
  }

  if (!user) return null

  if (editing && managed.isPending) return <SkeletonList rows={5} />
  if (editing && (managed.isError || (!managed.isPending && !existing))) {
    return (
      <>
        <ErrorState
          title="Post not found"
          description="It may have been deleted, or it belongs to another author."
        />
        <div className="mt-6 text-center">
          <Link to="/app/blog" className="text-sm text-volt-400 underline underline-offset-4">
            Back to your posts
          </Link>
        </div>
      </>
    )
  }

  const minutes = readingMinutes(cleanBlocks(draft.blocks))
  const isPublished = existing?.status === PostStatus.Published

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/app/blog"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-dim transition-colors hover:text-volt-400"
        >
          <ArrowLeft className="size-3.5" /> Your posts
        </Link>
        <div className="flex items-center gap-3 text-xs text-chalk-faint">
          {existing && (
            <Badge tone={isPublished ? 'ok' : 'warn'} dot>
              {isPublished ? 'Published' : 'Draft'}
            </Badge>
          )}
          <span>{minutes} min read</span>
          {savedAt && <span>Saved {savedAt}</span>}
        </div>
      </div>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{editing ? 'Edit article' : 'New article'}</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{draft.title.trim() || 'Untitled'}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPreview((v) => !v)} aria-pressed={preview}>
            <Eye className="size-4" /> {preview ? 'Back to editing' : 'Preview'}
          </Button>
          <Button variant="outline" size="sm" loading={saving} onClick={() => save(PostStatus.Draft)}>
            <Save className="size-4" /> {isPublished ? 'Save as draft' : 'Save draft'}
          </Button>
          <Button size="sm" loading={saving} onClick={() => save(PostStatus.Published)}>
            <Globe className="size-4" /> {isPublished ? 'Update & publish' : 'Publish'}
          </Button>
        </div>
      </div>

      {saveError && (
        <p role="alert" className="mb-6 rounded-lg border border-danger-500/35 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {saveError.message}
        </p>
      )}

      {preview ? (
        <Card>
          <CardBody className="p-6 sm:p-10">
            <div className="mx-auto max-w-3xl">
              <div className="flex flex-wrap gap-2">
                {toInput(draft, PostStatus.Draft).tags.map((tag) => (
                  <Badge key={tag} tone="volt">
                    {tag}
                  </Badge>
                ))}
              </div>
              <h2 className="mt-4 text-[clamp(2rem,5vw,3.5rem)] text-balance">{draft.title || 'Untitled'}</h2>
              <p className="mt-4 text-lg text-chalk-dim text-pretty">{draft.excerpt}</p>
              {draft.coverImageUrl && isHttpUrl(draft.coverImageUrl) && (
                <img src={draft.coverImageUrl} alt="" className="mt-8 aspect-[21/9] w-full rounded-2xl border border-ink-700 object-cover" />
              )}
              <PostContent blocks={cleanBlocks(draft.blocks)} className="mt-10" />
            </div>
          </CardBody>
        </Card>
      ) : (
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
          <div className="space-y-6">
            <Card>
              <CardBody className="space-y-5">
                <Input
                  label="Title"
                  required
                  value={draft.title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Why Zone 2 is the base of everything"
                  error={errors.title}
                  maxLength={160}
                />
                <Textarea
                  label="Summary"
                  required
                  value={draft.excerpt}
                  onChange={(e) => patch({ excerpt: e.target.value })}
                  placeholder="One or two sentences shown on the feed."
                  hint={`${draft.excerpt.length}/300`}
                  error={errors.excerpt}
                  maxLength={300}
                  rows={3}
                />
              </CardBody>
            </Card>

            <section aria-labelledby="blocks-heading">
              <div className="mb-3 flex items-center justify-between gap-4">
                <h2 id="blocks-heading" className="text-2xl">
                  Content
                </h2>
                <p className="text-xs text-chalk-faint">
                  {draft.blocks.length} block{draft.blocks.length === 1 ? '' : 's'}
                </p>
              </div>
              {errors.blocks && (
                <p role="alert" className="mb-3 text-sm text-danger-500">
                  {errors.blocks}
                </p>
              )}

              <div className="space-y-4">
                {draft.blocks.map((block, index) => (
                  <BlockEditor
                    key={index}
                    block={block}
                    index={index}
                    total={draft.blocks.length}
                    onChange={(b) => updateBlock(index, b)}
                    onMove={(delta) => moveBlock(index, delta)}
                    onRemove={() => removeBlock(index)}
                    onInsertAfter={(type) => addBlock(type, index)}
                  />
                ))}
              </div>

              <AddBlockBar onAdd={(type) => addBlock(type)} className="mt-4" />
            </section>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-24">
            <Card>
              <CardBody className="space-y-5">
                <Input
                  label="Link"
                  required
                  value={draft.slug}
                  onChange={(e) => patch({ slug: slugify(e.target.value), slugTouched: true })}
                  hint={`/blog/${draft.slug || '…'}`}
                  error={errors.slug}
                />
                <Input
                  label="Tags"
                  value={draft.tags}
                  onChange={(e) => patch({ tags: e.target.value })}
                  placeholder="Training, Nutrition"
                  hint="Comma-separated, up to 8."
                />
                <Input
                  label="Cover image"
                  type="url"
                  value={draft.coverImageUrl}
                  onChange={(e) => patch({ coverImageUrl: e.target.value })}
                  placeholder="https://…"
                  hint="Optional. Shown on the card and at the top of the article."
                  error={errors.coverImageUrl}
                />
                {draft.coverImageUrl && isHttpUrl(draft.coverImageUrl) && (
                  <img
                    src={draft.coverImageUrl}
                    alt="Cover preview"
                    className="aspect-[16/9] w-full rounded-lg border border-ink-700 object-cover"
                  />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">Author</p>
                <p className="mt-1.5 text-sm font-semibold text-chalk">
                  {existing?.authorName ?? `${user.firstName} ${user.lastName}`}
                </p>
                <p className="text-xs text-chalk-faint">{existing?.tenantName ?? 'Your studio'}</p>
                <p className="mt-4 text-xs leading-relaxed text-chalk-faint">
                  Published articles are public: anyone can read them, signed in or not. Drafts are only
                  visible to you and your studio staff.
                </p>
              </CardBody>
            </Card>
          </aside>
        </div>
      )}
    </>
  )
}

function AddBlockBar({ onAdd, className }: { onAdd: (type: PostBlock['type']) => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-ink-600 p-3', className)}>
      <span className="mr-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-faint">
        <Plus className="size-3.5" /> Add
      </span>
      {Object.values(PostBlockType).map((type) => {
        const Icon = BLOCK_ICONS[type]
        return (
          <button
            key={type}
            type="button"
            onClick={() => onAdd(type)}
            className="inline-flex items-center gap-1.5 rounded-md border border-ink-600 px-2.5 py-1.5 text-xs font-medium text-chalk-dim transition-colors hover:border-volt-400 hover:text-volt-400"
          >
            <Icon className="size-3.5" /> {POST_BLOCK_LABELS[type]}
          </button>
        )
      })}
    </div>
  )
}

function BlockEditor({
  block,
  index,
  total,
  onChange,
  onMove,
  onRemove,
  onInsertAfter,
}: {
  block: PostBlock
  index: number
  total: number
  onChange: (block: PostBlock) => void
  onMove: (delta: -1 | 1) => void
  onRemove: () => void
  onInsertAfter: (type: PostBlock['type']) => void
}) {
  const Icon = BLOCK_ICONS[block.type]
  const [insertOpen, setInsertOpen] = useState(false)

  return (
    <div className="rounded-xl border border-ink-700 bg-ink-850/70">
      <div className="flex items-center gap-2 border-b border-ink-700 px-4 py-2.5">
        <Icon className="size-4 text-volt-400" />
        <span className="text-xs font-semibold uppercase tracking-wider text-chalk-dim">
          {POST_BLOCK_LABELS[block.type]}
        </span>
        <span className="text-xs text-chalk-faint">#{index + 1}</span>
        <div className="ml-auto flex items-center gap-1">
          <IconButton label="Move up" disabled={index === 0} onClick={() => onMove(-1)}>
            <ArrowUp className="size-4" />
          </IconButton>
          <IconButton label="Move down" disabled={index === total - 1} onClick={() => onMove(1)}>
            <ArrowDown className="size-4" />
          </IconButton>
          <IconButton label="Insert a block below" onClick={() => setInsertOpen((v) => !v)}>
            <Plus className="size-4" />
          </IconButton>
          <IconButton label="Remove block" onClick={onRemove} danger>
            <Trash2 className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="p-4">
        <BlockFields block={block} onChange={onChange} />
      </div>

      {insertOpen && (
        <div className="px-4 pb-4">
          <AddBlockBar
            onAdd={(type) => {
              onInsertAfter(type)
              setInsertOpen(false)
            }}
          />
        </div>
      )}
    </div>
  )
}

function IconButton({
  label,
  onClick,
  disabled,
  danger,
  children,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-md p-1.5 text-chalk-faint transition-colors hover:bg-ink-700 hover:text-chalk disabled:pointer-events-none disabled:opacity-30',
        danger && 'hover:text-danger-500',
      )}
    >
      {children}
    </button>
  )
}

function BlockFields({ block, onChange }: { block: PostBlock; onChange: (block: PostBlock) => void }) {
  switch (block.type) {
    case 'heading':
      return (
        <Input
          aria-label="Heading text"
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Section heading"
          maxLength={160}
          inputClassName="font-display text-xl uppercase tracking-wide"
        />
      )
    case 'paragraph':
      return (
        <Textarea
          aria-label="Paragraph text"
          value={block.text}
          onChange={(e) => onChange({ ...block, text: e.target.value })}
          placeholder="Write a paragraph…"
          rows={4}
          maxLength={5000}
        />
      )
    case 'quote':
      return (
        <div className="space-y-3">
          <Textarea
            aria-label="Quote"
            value={block.text}
            onChange={(e) => onChange({ ...block, text: e.target.value })}
            placeholder="The line worth pulling out"
            rows={2}
            maxLength={600}
          />
          <Input
            aria-label="Attribution"
            value={block.attribution ?? ''}
            onChange={(e) => onChange({ ...block, attribution: e.target.value })}
            placeholder="Who said it (optional)"
            maxLength={120}
          />
        </div>
      )
    case 'list':
      return (
        <div className="space-y-2">
          {block.items.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="size-1.5 shrink-0 rounded-full bg-volt-400" aria-hidden />
              <Input
                aria-label={`List item ${i + 1}`}
                className="flex-1"
                value={item}
                onChange={(e) =>
                  onChange({ ...block, items: block.items.map((it, j) => (j === i ? e.target.value : it)) })
                }
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const items = [...block.items]
                    items.splice(i + 1, 0, '')
                    onChange({ ...block, items })
                  }
                }}
                placeholder={`Item ${i + 1}`}
                maxLength={400}
              />
              <IconButton
                label="Remove item"
                disabled={block.items.length === 1}
                onClick={() => onChange({ ...block, items: block.items.filter((_, j) => j !== i) })}
              >
                <Trash2 className="size-4" />
              </IconButton>
            </div>
          ))}
          <button
            type="button"
            onClick={() => onChange({ ...block, items: [...block.items, ''] })}
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-volt-400"
          >
            <Plus className="size-3.5" /> Add item
          </button>
        </div>
      )
    case 'image':
      return (
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr]">
          <Input
            label="Image link"
            type="url"
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            placeholder="https://…/photo.jpg"
            className="sm:col-span-2"
          />
          <Input
            label="Describe the image"
            value={block.alt}
            onChange={(e) => onChange({ ...block, alt: e.target.value })}
            placeholder="For readers who cannot see it"
            maxLength={200}
          />
          <Input
            label="Caption"
            value={block.caption ?? ''}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="Optional"
            maxLength={200}
          />
          {block.url && isHttpUrl(block.url) && (
            <img
              src={block.url}
              alt={block.alt}
              className="max-h-56 w-full rounded-lg border border-ink-700 object-cover sm:col-span-2"
            />
          )}
        </div>
      )
    case 'video':
      return (
        <div className="grid gap-3">
          <Input
            label="Video link"
            type="url"
            value={block.url}
            onChange={(e) => onChange({ ...block, url: e.target.value })}
            placeholder="https://www.youtube.com/watch?v=… or https://vimeo.com/…"
            hint="YouTube and Vimeo links play inline; other links open in a new tab."
          />
          <Input
            label="Caption"
            value={block.caption ?? ''}
            onChange={(e) => onChange({ ...block, caption: e.target.value })}
            placeholder="Optional"
            maxLength={200}
          />
        </div>
      )
  }
}
