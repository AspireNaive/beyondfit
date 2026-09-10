import { describe, expect, it } from 'vitest'
import { ACCOUNTS, api, auth, tokenFor } from './helpers.js'

const draft = (overrides: Record<string, unknown> = {}) => ({
  title: 'Tempo runs for lifters',
  slug: `tempo-runs-${Math.random().toString(36).slice(2, 8)}`,
  excerpt: 'Why a weekly tempo run makes your squat day feel easier.',
  tags: ['Training', 'Conditioning'],
  blocks: [
    { type: 'paragraph', text: 'Most lifters avoid running. Here is the one run worth keeping.' },
    { type: 'heading', text: 'The session' },
    { type: 'list', items: ['10 min easy', '20 min at a comfortably hard pace', '5 min walk'] },
    { type: 'video', url: 'https://www.youtube.com/watch?v=aUaInS6HIGo', caption: 'Pacing walkthrough' },
  ],
  ...overrides,
})

describe('content (blog)', () => {
  it('the public feed lists published posts newest first, without a token', async () => {
    const res = await api().get('/api/posts')
    expect(res.status).toBe(200)
    expect(res.body.total).toBeGreaterThanOrEqual(5)
    expect(res.body.page).toBe(1)
    expect(res.body.items.every((p: { status: string }) => p.status === 'published')).toBe(true)
    const dates = res.body.items.map((p: { publishedAt: string }) => p.publishedAt)
    expect([...dates].sort().reverse()).toEqual(dates)
    // The seed draft never leaks into the feed.
    expect(res.body.items.some((p: { slug: string }) => p.slug === 'rotational-power-for-golfers')).toBe(false)
  })

  it('pages, filters by tag and studio, and searches', async () => {
    const paged = await api().get('/api/posts?page=2&pageSize=2')
    expect(paged.status).toBe(200)
    expect(paged.body.items).toHaveLength(2)
    expect(paged.body.pageSize).toBe(2)

    const tagged = await api().get('/api/posts?tag=nutrition')
    expect(tagged.body.items.length).toBeGreaterThan(0)
    expect(tagged.body.items.every((p: { tags: string[] }) => p.tags.includes('Nutrition'))).toBe(true)

    const studio = await api().get('/api/posts?tenant=ironworks')
    expect(studio.body.total).toBe((await api().get('/api/posts')).body.total)
    expect((await api().get('/api/posts?tenant=northside')).body.total).toBe(0)

    const searched = await api().get('/api/posts?query=zone 2')
    expect(searched.body.items.map((p: { slug: string }) => p.slug)).toContain('why-zone-2-is-the-base-of-everything')
  })

  it('a published post is public by slug; a draft is null unless the caller manages it', async () => {
    const pub = await api().get('/api/posts/why-zone-2-is-the-base-of-everything')
    expect(pub.status).toBe(200)
    expect(pub.body.title).toBe('Why Zone 2 is the base of everything')
    expect(pub.body.blocks.some((b: { type: string }) => b.type === 'heading')).toBe(true)
    expect(pub.body.readingMinutes).toBeGreaterThanOrEqual(1)

    expect((await api().get('/api/posts/rotational-power-for-golfers')).body).toBeNull()
    expect((await api().get('/api/posts/rotational-power-for-golfers').set(auth(await tokenFor(ACCOUNTS.member)))).body).toBeNull()
    // Written by u-coach-devon; the head coach is a different author and may not see it…
    expect((await api().get('/api/posts/rotational-power-for-golfers').set(auth(await tokenFor(ACCOUNTS.coach, 'coach')))).body).toBeNull()
    // …but the studio admin can.
    const asAdmin = await api().get('/api/posts/rotational-power-for-golfers').set(auth(await tokenFor(ACCOUNTS.admin, 'admin')))
    expect(asAdmin.body.status).toBe('draft')
  })

  it('members cannot write; coaches can create, edit, publish and delete their own posts', async () => {
    expect((await api().post('/api/posts').send(draft())).status).toBe(401)
    expect((await api().post('/api/posts').set(auth(await tokenFor(ACCOUNTS.member))).send(draft())).status).toBe(403)

    const coach = auth(await tokenFor(ACCOUNTS.coach, 'coach'))
    const body = draft()
    const created = await api().post('/api/posts').set(coach).send(body)
    expect(created.status).toBe(201)
    expect(created.body.status).toBe('draft')
    expect(created.body.publishedAt).toBeNull()
    expect(created.body.authorId).toBe('u-coach-mara')
    expect(created.body.tenantSlug).toBe('ironworks')
    expect(created.body.readingMinutes).toBe(1)

    // Drafts are not public…
    expect((await api().get(`/api/posts/${body.slug}`)).body).toBeNull()
    // …but show up in the author's own list.
    const mine = await api().get('/api/posts/mine').set(coach)
    expect(mine.status).toBe(200)
    expect(mine.body.map((p: { id: string }) => p.id)).toContain(created.body.id)

    const published = await api().patch(`/api/posts/${created.body.id}`).set(coach).send({ status: 'published', title: 'Tempo runs for lifters, revisited' })
    expect(published.status).toBe(200)
    expect(published.body.status).toBe('published')
    expect(published.body.publishedAt).not.toBeNull()
    expect(published.body.title).toBe('Tempo runs for lifters, revisited')

    const publicRead = await api().get(`/api/posts/${body.slug}`)
    expect(publicRead.body.id).toBe(created.body.id)

    // Unpublishing keeps the original publish date.
    const unpublished = await api().patch(`/api/posts/${created.body.id}`).set(coach).send({ status: 'draft' })
    expect(unpublished.body.publishedAt).toBe(published.body.publishedAt)

    expect((await api().delete(`/api/posts/${created.body.id}`).set(coach)).status).toBe(204)
    expect((await api().get(`/api/posts/${body.slug}`)).body).toBeNull()
    // The slug is free again once the post is gone.
    expect((await api().post('/api/posts').set(coach).send(body)).status).toBe(201)
  })

  it('slugs are unique and bodies are validated', async () => {
    const coach = auth(await tokenFor(ACCOUNTS.coach, 'coach'))
    const clash = await api().post('/api/posts').set(coach).send(draft({ slug: 'why-zone-2-is-the-base-of-everything' }))
    expect(clash.status).toBe(409)

    const bad = await api().post('/api/posts').set(coach).send(draft({ blocks: [{ type: 'image', url: 'javascript:alert(1)', alt: '' }] }))
    expect(bad.status).toBe(422)
    expect(bad.body.errors).toHaveProperty('blocks.0.url')

    const empty = await api().post('/api/posts').set(coach).send(draft({ blocks: [] }))
    expect(empty.status).toBe(422)
  })

  it('ownership: a coach cannot touch a peer\'s post, an admin can within the studio, a manager anywhere', async () => {
    const coach = auth(await tokenFor(ACCOUNTS.coach, 'coach'))
    const admin = auth(await tokenFor(ACCOUNTS.admin, 'admin'))
    const manager = auth(await tokenFor(ACCOUNTS.manager, 'admin'))

    // post-protein is by u-coach-priya, not the demo coach.
    expect((await api().patch('/api/posts/post-protein').set(coach).send({ excerpt: 'Changed by someone else entirely.' })).status).toBe(403)
    expect((await api().delete('/api/posts/post-protein').set(coach)).status).toBe(403)

    const byAdmin = await api().patch('/api/posts/post-protein').set(admin).send({ tags: ['Nutrition', 'Protein'] })
    expect(byAdmin.status).toBe(200)
    expect(byAdmin.body.tags).toEqual(['Nutrition', 'Protein'])

    const byManager = await api().patch('/api/posts/post-protein').set(manager).send({ tags: ['Nutrition'] })
    expect(byManager.status).toBe(200)

    // Scope of /mine: coach → own, admin → studio, manager → everything.
    const coachMine = await api().get('/api/posts/mine').set(coach)
    expect(coachMine.body.every((p: { authorId: string }) => p.authorId === 'u-coach-mara')).toBe(true)
    const adminMine = await api().get('/api/posts/mine').set(admin)
    expect(adminMine.body.length).toBeGreaterThan(coachMine.body.length)
    expect(adminMine.body.some((p: { status: string }) => p.status === 'draft')).toBe(true)
    expect((await api().get('/api/posts/mine').set(auth(await tokenFor(ACCOUNTS.member)))).status).toBe(403)

    expect((await api().patch('/api/posts/nope').set(manager).send({ title: 'Ghost post' })).status).toBe(404)
  })
})
