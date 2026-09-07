import { describe, expect, it } from 'vitest'
import { ACCOUNTS, DEMO_PASSWORD, api, auth, tokenFor } from './helpers.js'

describe('auth', () => {
  it('signs a member in and returns a session', async () => {
    const res = await api().post('/api/auth/login').send({ email: ACCOUNTS.member, password: DEMO_PASSWORD, portal: 'member' })
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(ACCOUNTS.member)
    expect(res.body.user.role).toBe('member')
    expect(res.body.tenant.slug).toBe('ironworks')
    expect(res.body.accessToken).toMatch(/^eyJ/)
    expect(res.body.refreshToken).toBeTruthy()
    expect(new Date(res.body.expiresAt).getTime()).toBeGreaterThan(Date.now())
  })

  it('rejects a wrong password without revealing which part was wrong', async () => {
    const res = await api().post('/api/auth/login').send({ email: ACCOUNTS.member, password: 'nope-nope', portal: 'member' })
    expect(res.status).toBe(400)
    expect(res.body.code).toBe('invalid_credentials')
    expect(res.body.detail).toMatch(/not recognised/)
  })

  it('rejects member credentials at the admin portal', async () => {
    const res = await api().post('/api/auth/login').send({ email: ACCOUNTS.member, password: DEMO_PASSWORD, portal: 'admin' })
    expect(res.status).toBe(403)
    expect(res.body.code).toBe('wrong_portal')
  })

  it('accepts an app manager at the admin portal', async () => {
    const res = await api().post('/api/auth/login').send({ email: ACCOUNTS.manager, password: DEMO_PASSWORD, portal: 'admin' })
    expect(res.status).toBe(200)
    expect(res.body.user.role).toBe('app_manager')
  })

  it('validates the body', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'not-an-email', password: '' })
    expect(res.status).toBe(422)
    expect(res.body.errors.email).toBeDefined()
    expect(res.body.errors.password).toBeDefined()
  })

  it('GET /auth/me needs a token and returns the current user', async () => {
    expect((await api().get('/api/auth/me')).status).toBe(401)
    const res = await api().get('/api/auth/me').set(auth(await tokenFor(ACCOUNTS.member)))
    expect(res.status).toBe(200)
    expect(res.body.user.email).toBe(ACCOUNTS.member)
    expect(res.body.tenant.seatsUsed).toBeGreaterThan(0)
  })

  it('rejects a tampered token', async () => {
    const res = await api().get('/api/auth/me').set(auth('eyJhbGciOiJIUzI1NiJ9.bad.sig'))
    expect(res.status).toBe(401)
  })

  it('registers a member, assigns the head coach, and counts a seat', async () => {
    const before = (await api().get('/api/auth/me').set(auth(await tokenFor(ACCOUNTS.member)))).body.tenant.seatsUsed
    const email = `new.${Date.now()}@example.com`
    const res = await api().post('/api/auth/register').send({
      firstName: 'New', lastName: 'Person', email, password: 'longenough1', phone: '+1 555 0100', goal: 'Get strong',
    })
    expect(res.status).toBe(201)
    expect(res.body.user.role).toBe('member')
    expect(res.body.user.assignedCoachId).toBeTruthy()
    expect(res.body.user.title).toBe('Get strong')

    const login = await api().post('/api/auth/login').send({ email, password: 'longenough1', portal: 'member' })
    expect(login.status).toBe(200)
    expect(login.body.tenant.seatsUsed).toBe(before + 1)
  })

  it('refuses a duplicate email and a weak password', async () => {
    const dup = await api().post('/api/auth/register').send({ firstName: 'A', lastName: 'B', email: ACCOUNTS.member, password: 'longenough1' })
    expect(dup.status).toBe(409)
    expect(dup.body.code).toBe('email_taken')
    const weak = await api().post('/api/auth/register').send({ firstName: 'A', lastName: 'B', email: 'x@example.com', password: 'short' })
    expect(weak.status).toBe(422)
    expect(weak.body.errors.password[0]).toMatch(/8 characters/)
  })

  it('rotates refresh tokens and revokes the old one', async () => {
    const login = await api().post('/api/auth/login').send({ email: ACCOUNTS.coach, password: DEMO_PASSWORD, portal: 'coach' })
    const first = login.body.refreshToken as string
    const refreshed = await api().post('/api/auth/refresh').send({ refreshToken: first })
    expect(refreshed.status).toBe(200)
    expect(refreshed.body.refreshToken).not.toBe(first)
    expect((await api().post('/api/auth/refresh').send({ refreshToken: first })).status).toBe(401)
    expect((await api().post('/api/auth/refresh').send({ refreshToken: refreshed.body.refreshToken })).status).toBe(200)
  })

  it('logout revokes the session refresh token', async () => {
    const login = await api().post('/api/auth/login').send({ email: ACCOUNTS.coach, password: DEMO_PASSWORD, portal: 'coach' })
    expect((await api().post('/api/auth/logout').set(auth(login.body.accessToken))).status).toBe(204)
    expect((await api().post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken })).status).toBe(401)
  })

  it('password reset never reveals whether an email exists', async () => {
    expect((await api().post('/api/auth/password-reset').send({ email: ACCOUNTS.member })).status).toBe(204)
    expect((await api().post('/api/auth/password-reset').send({ email: 'ghost@example.com' })).status).toBe(204)
    const bad = await api().post('/api/auth/password-reset/confirm').send({ token: 'nope', password: 'longenough1' })
    expect(bad.status).toBe(400)
    expect(bad.body.code).toBe('reset_invalid')
  })

  it('updates the profile and changes the password', async () => {
    const email = `profile.${Date.now()}@example.com`
    const reg = await api().post('/api/auth/register').send({ firstName: 'Pat', lastName: 'Lee', email, password: 'longenough1' })
    const token = reg.body.accessToken as string
    const patched = await api().patch('/api/auth/me').set(auth(token)).send({ location: 'Remote', bio: 'Hi' })
    expect(patched.status).toBe(200)
    expect(patched.body.location).toBe('Remote')
    const wrong = await api().post('/api/auth/change-password').set(auth(token)).send({ currentPassword: 'x', newPassword: 'longenough2' })
    expect(wrong.status).toBe(400)
    const ok = await api().post('/api/auth/change-password').set(auth(token)).send({ currentPassword: 'longenough1', newPassword: 'longenough2' })
    expect(ok.status).toBe(204)
    expect((await api().post('/api/auth/login').send({ email, password: 'longenough2', portal: 'member' })).status).toBe(200)
  })
})
