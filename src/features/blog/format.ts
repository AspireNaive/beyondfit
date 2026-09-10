import { format } from 'date-fns'
import type { Post } from '@/domain/content/model'

export const postDate = (post: Post) => format(new Date(post.publishedAt ?? post.createdAt), 'd MMM yyyy')

/** Deterministic gradient for posts without a cover image, keyed on the slug. */
export function coverGradient(seed: string) {
  const hue = [...seed].reduce((acc, ch) => acc + ch.charCodeAt(0), 0) % 360
  return `radial-gradient(80% 120% at 20% 0%, hsl(${hue} 70% 45% / 0.55), transparent 60%), radial-gradient(60% 90% at 90% 100%, hsl(${(hue + 60) % 360} 70% 50% / 0.35), transparent 60%), linear-gradient(180deg, #101a24, #080c11)`
}
