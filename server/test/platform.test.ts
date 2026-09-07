import { describe, expect, it } from 'vitest'
import { ACCOUNTS, api, auth, tokenFor } from './helpers.js'

describe('tenants, marketing forms, system', () => {
  it('health and docs are public', async () => {
    expect((await api().get('/api/health')).body.status).toBe('ok')
    expect((await api().get('/api/openapi.json')).status).toBe(200)
    expect((await api().get('/api/nope')).status).toBe(404)
  })

  it('returns the viewer tenant; lists all tenants for platform staff only', async () => {
    const mine = await api().get('/api/tenant').set(auth(await tokenFor(ACCOUNTS.member)))
    expect(mine.body.slug).toBe('ironworks')
    expect((await api().get('/api/tenants').set(auth(await tokenFor(ACCOUNTS.admin, 'admin')))).status).toBe(403)
    const all = await api().get('/api/tenants').set(auth(await tokenFor(ACCOUNTS.manager, 'admin')))
    expect(all.body).toHaveLength(3)
  })

  it('creates and updates tenants with the right permissions', async () => {
    const manager = await tokenFor(ACCOUNTS.manager, 'admin')
    const created = await api().post('/api/tenants').set(auth(manager)).send({ name: 'Harbour Gym', slug: 'harbour', plan: 'starter', seats: 50 })
    expect(created.status).toBe(201)
    expect(created.body.seatsUsed).toBe(0)
    const admin = await tokenFor(ACCOUNTS.admin, 'admin')
    expect((await api().patch(`/api/tenants/${created.body.id}`).set(auth(admin)).send({ name: 'Renamed Gym' })).status).toBe(403)
    const own = await api().patch('/api/tenants/t-ironworks').set(auth(admin)).send({ name: 'Ironworks Performance', seats: 9 })
    expect(own.status).toBe(200)
    expect(own.body.seats).toBe(500)
  })

  it('stores contact messages and newsletter signups', async () => {
    const contact = await api().post('/api/contact').send({
      firstName: 'Ada', lastName: 'Lovelace', email: 'ada@example.com', topic: 'coaching', message: 'Hello',
    })
    expect(contact.status).toBe(201)
    expect(contact.body.id).toBeTruthy()
    expect((await api().post('/api/contact').send({ firstName: 'x' })).status).toBe(422)
    expect((await api().post('/api/newsletter').send({ email: 'ada@example.com' })).status).toBe(204)
    expect((await api().post('/api/newsletter').send({ email: 'ada@example.com' })).status).toBe(204)
  })
})
