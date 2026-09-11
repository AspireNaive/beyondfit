import { describe, expect, it } from 'vitest'
import { ACCOUNTS, api, auth, tokenFor } from './helpers.js'

const today = new Date().toISOString().slice(0, 10)
// A real (tiny) JPEG so the analyse route gets past decoding on a server with a key.
const TINY_JPEG =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AVN//2Q=='

const meal = (overrides: Record<string, unknown> = {}) => ({
  date: today,
  mealType: 'lunch',
  title: 'Chicken and rice',
  items: [
    { name: 'Grilled chicken breast', portion: '150 g', calories: 250, proteinG: 46, carbsG: 0, fatG: 5 },
    { name: 'Basmati rice', portion: '180 g cooked', calories: 235, proteinG: 5, carbsG: 50, fatG: 1 },
  ],
  ...overrides,
})

describe('nutrition: food diary', () => {
  it('reports whether photo analysis is switched on, and says so plainly when it is not', async () => {
    const member = auth(await tokenFor(ACCOUNTS.member))
    const caps = await api().get('/api/nutrition/capabilities').set(member)
    expect(caps.status).toBe(200)
    expect(typeof caps.body.photoAnalysis).toBe('boolean')
    if (!caps.body.photoAnalysis) {
      const res = await api().post('/api/members/u-member-1/food/analyze').set(member).send({ photo: TINY_JPEG })
      expect(res.status).toBe(503)
      expect(res.body.code).toBe('ai_unavailable')
    }
    // Garbage is rejected before any model is called.
    const bad = await api().post('/api/members/u-member-1/food/analyze').set(member).send({ photo: 'data:text/plain;base64,aGVsbG8gd29ybGQgdGhpcyBpcyBub3QgYW4gaW1hZ2U=' })
    expect([400, 503]).toContain(bad.status)
  })

  it('a member logs, edits, and deletes their own meals; totals are computed server-side', async () => {
    const member = auth(await tokenFor(ACCOUNTS.member))
    const created = await api().post('/api/members/u-member-1/food').set(member).send(meal({ thumbDataUrl: TINY_JPEG, photoDataUrl: TINY_JPEG }))
    expect(created.status).toBe(201)
    expect(created.body.totals).toEqual({ calories: 485, proteinG: 51, carbsG: 50, fatG: 6 })
    expect(created.body.source).toBe('photo')
    expect(created.body.hasPhoto).toBe(true)
    expect(created.body.thumbDataUrl).toBe(TINY_JPEG)

    const photo = await api().get(`/api/members/u-member-1/food/${created.body.id}/photo`).set(member)
    expect(photo.status).toBe(200)
    expect(photo.body.dataUrl).toBe(TINY_JPEG)

    const list = await api().get(`/api/members/u-member-1/food?from=${today}&to=${today}`).set(member)
    expect(list.status).toBe(200)
    expect(list.body.map((e: { id: string }) => e.id)).toContain(created.body.id)

    const edited = await api()
      .patch(`/api/members/u-member-1/food/${created.body.id}`)
      .set(member)
      .send({ items: [{ name: 'Grilled chicken breast', portion: '200 g', calories: 330, proteinG: 62, carbsG: 0, fatG: 7 }] })
    expect(edited.status).toBe(200)
    expect(edited.body.totals.calories).toBe(330)

    const summary = await api().get(`/api/members/u-member-1/food/summary?from=${today}&to=${today}`).set(member)
    expect(summary.status).toBe(200)
    expect(summary.body[0].date).toBe(today)
    expect(summary.body[0].totals.calories).toBeGreaterThanOrEqual(330)

    expect((await api().delete(`/api/members/u-member-1/food/${created.body.id}`).set(member)).status).toBe(204)
    expect((await api().get(`/api/members/u-member-1/food/${created.body.id}/photo`).set(member)).status).toBe(404)
  })

  it('other members are kept out; every coach in the studio, the admin and the manager can see the diary', async () => {
    const other = auth(await tokenFor('logan.millington@example.com'))
    expect((await api().get('/api/members/u-member-1/food').set(other)).status).toBe(403)
    // The demo coach is not necessarily u-member-1's assigned coach — coaches see the whole studio.
    expect((await api().get('/api/members/u-member-1/food').set(auth(await tokenFor(ACCOUNTS.coach, 'coach')))).status).toBe(200)
    expect((await api().get('/api/members/u-member-1/food').set(auth(await tokenFor(ACCOUNTS.admin, 'admin')))).status).toBe(200)
    expect((await api().get('/api/members/u-member-1/food').set(auth(await tokenFor(ACCOUNTS.manager, 'admin')))).status).toBe(200)
    expect((await api().get('/api/members/u-member-1/food')).status).toBe(401)
    // Reading is shared; writing the diary is the member's alone.
    const coach = auth(await tokenFor(ACCOUNTS.coach, 'coach'))
    expect((await api().post('/api/members/u-member-1/food').set(coach).send(meal())).status).toBe(403)
    expect((await api().delete('/api/members/u-member-1/food/f-0-lunch').set(coach)).status).toBe(403)
  })

  it('validates meals', async () => {
    const member = auth(await tokenFor(ACCOUNTS.member))
    expect((await api().post('/api/members/u-member-1/food').set(member).send(meal({ items: [] }))).status).toBe(422)
    expect((await api().post('/api/members/u-member-1/food').set(member).send(meal({ mealType: 'brunch' }))).status).toBe(422)
    expect((await api().post('/api/members/u-member-1/food').set(member).send(meal({ date: '15/01/2026' }))).status).toBe(422)
  })
})

describe('nutrition: diet plans', () => {
  const plan = {
    title: 'Lean-out phase',
    summary: 'Modest deficit, protein high.',
    targets: { calories: 2200, proteinG: 170, carbsG: 210, fatG: 70 },
    meals: [
      { name: 'Breakfast', time: '07:00', description: 'Yoghurt or eggs, toast, fruit.', calories: 450 },
      { name: 'Dinner', time: '19:30', description: 'Protein, starch, two fists of vegetables.', calories: 750 },
    ],
    guidelines: ['Protein every meal', 'Two litres of water'],
  }

  it('coaches and staff write plans; the member reads them; the previous plan is archived', async () => {
    const member = auth(await tokenFor(ACCOUNTS.member))
    const coach = auth(await tokenFor(ACCOUNTS.coach, 'coach'))

    expect((await api().put('/api/members/u-member-1/diet-plan').set(member).send(plan)).status).toBe(403)

    const first = await api().put('/api/members/u-member-1/diet-plan').set(coach).send(plan)
    expect(first.status).toBe(200)
    expect(first.body.status).toBe('active')
    expect(first.body.authorId).toBe('u-coach-mara')
    expect(first.body.targets.calories).toBe(2200)

    const read = await api().get('/api/members/u-member-1/diet-plan').set(member)
    expect(read.body.id).toBe(first.body.id)

    const second = await api().put('/api/members/u-member-1/diet-plan').set(auth(await tokenFor(ACCOUNTS.admin, 'admin'))).send({ ...plan, title: 'Maintenance' })
    expect(second.status).toBe(200)
    expect((await api().get('/api/members/u-member-1/diet-plan').set(member)).body.title).toBe('Maintenance')

    const history = await api().get('/api/members/u-member-1/diet-plan/history').set(coach)
    expect(history.body.map((p: { status: string }) => p.status)).toEqual(['active', 'archived', ...history.body.slice(2).map((p: { status: string }) => p.status)])
    expect(history.body.filter((p: { status: string }) => p.status === 'active')).toHaveLength(1)
  })

  it('validates a plan', async () => {
    const coach = auth(await tokenFor(ACCOUNTS.coach, 'coach'))
    expect((await api().put('/api/members/u-member-1/diet-plan').set(coach).send({ ...plan, meals: [] })).status).toBe(422)
    expect((await api().put('/api/members/u-member-1/diet-plan').set(coach).send({ ...plan, targets: { ...plan.targets, calories: 100 } })).status).toBe(422)
  })
})

describe('studio management: adding people and mapping coaches', () => {
  const email = () => `new-${Math.random().toString(36).slice(2, 8)}@example.com`

  it('an admin adds a coach and a member (with a generated password) and maps them', async () => {
    const admin = auth(await tokenFor(ACCOUNTS.admin, 'admin'))

    const coach = await api().post('/api/directory').set(admin).send({
      role: 'coach', firstName: 'Nia', lastName: 'Okafor', email: email(), title: 'Nutrition Coach', specialties: ['Nutrition'],
    })
    expect(coach.status).toBe(201)
    expect(coach.body.user.role).toBe('coach')
    expect(coach.body.user.tenantId).toBe('t-ironworks')
    expect(typeof coach.body.temporaryPassword).toBe('string')

    const memberEmail = email()
    const member = await api().post('/api/directory').set(admin).send({
      role: 'member', firstName: 'Sam', lastName: 'Reyes', email: memberEmail, password: 'welcome-sam-1', assignedCoachId: coach.body.user.id,
    })
    expect(member.status).toBe(201)
    expect(member.body.user.assignedCoachId).toBe(coach.body.user.id)
    expect(member.body.temporaryPassword).toBeNull()

    // The new member can sign in with the password the admin set.
    const login = await api().post('/api/auth/login').send({ email: memberEmail, password: 'welcome-sam-1', portal: 'member' })
    expect(login.status).toBe(200)

    // Re-map to the head coach.
    const remapped = await api().patch(`/api/directory/${member.body.user.id}`).set(admin).send({ assignedCoachId: 'u-coach-mara' })
    expect(remapped.status).toBe(200)
    expect(remapped.body.assignedCoachId).toBe('u-coach-mara')

    // Cannot map to someone who is not a coach in this studio.
    expect((await api().patch(`/api/directory/${member.body.user.id}`).set(admin).send({ assignedCoachId: 'u-admin-1' })).status).toBe(400)

    // Duplicate email is a conflict.
    expect((await api().post('/api/directory').set(admin).send({ role: 'member', firstName: 'Sam', lastName: 'Again', email: memberEmail })).status).toBe(409)

    // A new coach is bookable straight away: a provider row with hours exists.
    const provider = await api().get(`/api/providers/${coach.body.user.id}`)
    expect(provider.status).toBe(200)
    expect(provider.body?.discipline).toBe('coaching')

    // An admin manages members and coaches, never the platform manager or a fellow admin.
    expect((await api().patch('/api/directory/u-manager-1').set(admin).send({ status: 'suspended' })).status).toBe(403)
    expect((await api().patch('/api/directory/u-admin-1').set(admin).send({ status: 'suspended' })).status).toBe(400)
    expect((await api().get('/api/auth/me').set(auth(await tokenFor(ACCOUNTS.manager, 'admin')))).status).toBe(200)
  })

  it('coaches and members cannot add people; the manager can, in any studio', async () => {
    expect((await api().post('/api/directory').set(auth(await tokenFor(ACCOUNTS.coach, 'coach'))).send({ role: 'member', firstName: 'A', lastName: 'B', email: email() })).status).toBe(403)
    expect((await api().post('/api/directory').set(auth(await tokenFor(ACCOUNTS.member))).send({ role: 'member', firstName: 'A', lastName: 'B', email: email() })).status).toBe(403)

    const manager = auth(await tokenFor(ACCOUNTS.manager, 'admin'))
    const created = await api().post('/api/directory').set(manager).send({ role: 'coach', firstName: 'Ola', lastName: 'Berg', email: email(), tenantId: 't-northside' })
    expect(created.status).toBe(201)
    expect(created.body.user.tenantId).toBe('t-northside')
  })
})
