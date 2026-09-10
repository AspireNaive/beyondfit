/**
 * The blog lives in two shells: the public marketing site (/blog) and the
 * signed-in app (/app/blog/feed). Same pages, different prefixes — so every
 * link is built from one of these.
 */
export type BlogPaths = {
  readonly feed: string
  readonly post: (slug: string) => string
  readonly studio: (tenantSlug: string) => string
  readonly author: (authorId: string) => string
  readonly tag: (tag: string) => string
}

export const blogPaths = (inApp: boolean): BlogPaths => {
  const feed = inApp ? '/app/blog/feed' : '/blog'
  return {
    feed,
    post: (slug) => (inApp ? `/app/blog/read/${slug}` : `/blog/${slug}`),
    studio: (tenantSlug) => `${feed}/studio/${encodeURIComponent(tenantSlug)}`,
    author: (authorId) => `${feed}/author/${encodeURIComponent(authorId)}`,
    tag: (tag) => `${feed}?tag=${encodeURIComponent(tag)}`,
  }
}
