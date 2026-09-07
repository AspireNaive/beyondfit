import { describe, expect, it } from 'vitest'
import { ACCOUNTS, api, auth, tokenFor } from './helpers.js'

describe('progress', () => {
  it('returns a member their own history, oldest first', async () => {
    const token = await tokenFor(ACCOUNTS.member)
    const metrics = await api().get('/api/members/u-member-1/body-metrics').set(auth(token))
    expect(metrics.status).toBe(200)
    expect(metrics.body).toHaveLength(26)
    expect(metrics.body[0].recordedOn < metrics.body[25].recordedOn).toBe(true)
    const activity = await api().get('/api/members/u-member-1/activity?days=7').set(auth(token))
    expect(activity.body).toHaveLength(7)
    const goal = await api().get('/api/members/u-member-1/goal').set(auth(token))
    expect(goal.body.dailyStepTarget).toBeGreaterThan(0)
  })

  it('logging twice on one day updates rather than duplicates', async () => {
    const token = await tokenFor(ACCOUNTS.member)
    const today = new Date().toISOString().slice(0, 10)
    const first = await api().post('/api/members/u-member-1/body-metrics').set(auth(token)).send({ recordedOn: today, weightKg: 80.4, heightCm: 178 })
    expect(first.status).toBe(201)
    const second = await api().post('/api/members/u-member-1/body-metrics').set(auth(token)).send({ recordedOn: today, weightKg: 80.1, heightCm: 178, note: 'am' })
    expect(second.body.weightKg).toBe(80.1)
    const all = await api().get('/api/members/u-member-1/body-metrics').set(auth(token))
    expect(all.body.filter((m: { recordedOn: string }) => m.recordedOn === today)).toHaveLength(1)
  })

  it('keeps other members out, lets the assigned coach and the admin in', async () => {
    const other = await tokenFor('logan.millington@example.com')
    expect((await api().get('/api/members/u-member-1/body-metrics').set(auth(other))).status).toBe(403)
    const admin = await tokenFor(ACCOUNTS.admin, 'admin')
    expect((await api().get('/api/members/u-member-1/body-metrics').set(auth(admin))).status).toBe(200)
    const me = await api().get('/api/auth/me').set(auth(await tokenFor(ACCOUNTS.member)))
    const coachId = me.body.user.assignedCoachId as string
    const coachEmail = (await api().get(`/api/directory/${coachId}`).set(auth(admin))).body.email
    const coach = await tokenFor(coachEmail, 'coach')
    expect((await api().get('/api/members/u-member-1/goal').set(auth(coach))).status).toBe(200)
  })

  it('upserts activity and goals', async () => {
    const token = await tokenFor(ACCOUNTS.member)
    const day = '2026-01-15'
    const put = await api().put(`/api/members/u-member-1/activity/${day}`).set(auth(token)).send({ steps: 12000, sleepHours: 7.5, workouts: 1 })
    expect(put.status).toBe(200)
    expect(put.body.steps).toBe(12000)
    const goal = await api().put('/api/members/u-member-1/goal').set(auth(token)).send({
      dailyCalorieTarget: 2400, dailyProteinTarget: 160, dailyStepTarget: 9000, weeklyWorkoutTarget: 5, focus: 'Meet prep', targetWeightKg: 78,
    })
    expect(goal.body.focus).toBe('Meet prep')
    expect(goal.body.targetWeightKg).toBe(78)
  })
})
