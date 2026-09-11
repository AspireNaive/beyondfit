import { describe, expect, it } from 'vitest'
import { ACCOUNTS, api, auth, tokenFor } from './helpers.js'

describe('directory', () => {
  it('a member sees the coaches plus themselves', async () => {
    const res = await api().get('/api/directory/mapped').set(auth(await tokenFor(ACCOUNTS.member)))
    expect(res.status).toBe(200)
    const roles = new Set(res.body.map((u: { role: string }) => u.role))
    expect(roles).toEqual(new Set(['member', 'coach']))
    expect(res.body.filter((u: { role: string }) => u.role === 'member')).toHaveLength(1)
  })

  it('a coach sees every member in the studio, their own clients included, plus peer coaches', async () => {
    const res = await api().get('/api/directory/mapped').set(auth(await tokenFor(ACCOUNTS.coach, 'coach')))
    expect(res.status).toBe(200)
    const members = res.body.filter((u: { role: string; assignedCoachId: string | null }) => u.role === 'member')
    expect(members.length).toBeGreaterThan(0)
    expect(members.some((m: { assignedCoachId: string }) => m.assignedCoachId === 'u-coach-mara')).toBe(true)
    expect(members.some((m: { assignedCoachId: string }) => m.assignedCoachId !== 'u-coach-mara')).toBe(true)
    expect(res.body.filter((u: { role: string }) => u.role === 'coach').length).toBeGreaterThan(1)
    // Still nothing from another studio, and no studio or platform staff.
    expect(res.body.every((u: { tenantId: string }) => u.tenantId === 't-ironworks')).toBe(true)
    expect(res.body.every((u: { role: string }) => u.role === 'member' || u.role === 'coach')).toBe(true)
  })

  it('an admin sees the whole studio', async () => {
    const res = await api().get('/api/directory/mapped').set(auth(await tokenFor(ACCOUNTS.admin, 'admin')))
    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(25)
  })

  it('members cannot read another member, but can read a coach', async () => {
    const token = await tokenFor(ACCOUNTS.member)
    expect((await api().get('/api/directory/u-member-2').set(auth(token))).body).toBeNull()
    expect((await api().get('/api/directory/u-coach-mara').set(auth(token))).body.email).toBe(ACCOUNTS.coach)
  })

  it('role listing is staff-only for members', async () => {
    expect((await api().get('/api/directory?role=member').set(auth(await tokenFor(ACCOUNTS.member)))).status).toBe(403)
    const coaches = await api().get('/api/directory?role=coach').set(auth(await tokenFor(ACCOUNTS.admin, 'admin')))
    // Six seeded coaches; other suites may add more, never fewer.
    expect(coaches.body.length).toBeGreaterThanOrEqual(6)
    expect(coaches.body.every((u: { role: string }) => u.role === 'coach')).toBe(true)
  })
})
