import { describe, expect, it } from 'vitest'
import { ACCOUNTS, api, auth, nextWeekday, tokenFor } from './helpers.js'

describe('providers & booking', () => {
  it('lists providers publicly with discipline and query filters', async () => {
    const all = await api().get('/api/providers')
    expect(all.status).toBe(200)
    expect(all.body).toHaveLength(6)
    expect(all.body[0].nextAvailable).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const physio = await api().get('/api/providers?discipline=physiotherapy')
    expect(physio.body.map((p: { id: string }) => p.id)).toEqual(['u-coach-tomas'])
    const dpt = await api().get('/api/providers?query=dpt')
    expect(dpt.body.map((p: { id: string }) => p.id)).toEqual(['u-coach-tomas'])
  })

  it('publishes hourly slots inside working hours', async () => {
    const monday = await api().get(`/api/providers/u-coach-jae/availability?date=${nextWeekday(1)}`)
    expect(monday.status).toBe(200)
    expect(monday.body).toHaveLength(12)
    expect(monday.body.every((s: { durationMinutes: number }) => s.durationMinutes === 60)).toBe(true)
    const sunday = await api().get(`/api/providers/u-coach-jae/availability?date=${nextWeekday(0)}`)
    expect(sunday.body).toHaveLength(7)
    expect((await api().get('/api/providers/u-coach-jae/availability?date=2026-1-1')).status).toBe(422)
  })

  it('books a free slot, refuses a double booking, and frees it on cancel', async () => {
    const token = await tokenFor(ACCOUNTS.member)
    const date = nextWeekday(2, 20)
    const slots = await api().get(`/api/providers/u-coach-jae/availability?date=${date}`)
    const free = slots.body.find((s: { available: boolean }) => s.available)
    expect(free).toBeDefined()

    const booked = await api().post('/api/appointments').set(auth(token)).send({
      providerId: 'u-coach-jae', startsAt: free.startsAt, durationMinutes: 60, channel: 'zoom', goal: 'Focus',
    })
    expect(booked.status).toBe(201)
    expect(booked.body.status).toBe('confirmed')
    expect(booked.body.price.amountMinor).toBe(12000)
    expect(booked.body.providerName).toBe('Jae Lindqvist')

    const again = await api().post('/api/appointments').set(auth(token)).send({
      providerId: 'u-coach-jae', startsAt: free.startsAt, durationMinutes: 30, channel: 'zoom',
    })
    expect(again.status).toBe(409)

    const after = await api().get(`/api/providers/u-coach-jae/availability?date=${date}`)
    expect(after.body.find((s: { startsAt: string }) => s.startsAt === free.startsAt).available).toBe(false)

    const mine = await api().get('/api/appointments').set(auth(token))
    expect(mine.body.some((a: { id: string }) => a.id === booked.body.id)).toBe(true)
    expect(mine.body.every((a: { memberId: string }) => a.memberId === 'u-member-1')).toBe(true)

    const cancelled = await api().post(`/api/appointments/${booked.body.id}/cancel`).set(auth(token))
    expect(cancelled.body.status).toBe('cancelled')
    const freed = await api().get(`/api/providers/u-coach-jae/availability?date=${date}`)
    expect(freed.body.find((s: { startsAt: string }) => s.startsAt === free.startsAt).available).toBe(true)
  })

  it('rejects out-of-hours, past, wrong-channel and bad-duration requests', async () => {
    const token = await tokenFor(ACCOUNTS.member)
    const date = nextWeekday(3, 20)
    const outOfHours = await api().post('/api/appointments').set(auth(token)).send({
      providerId: 'u-coach-jae', startsAt: `${date}T03:00:00.000Z`, durationMinutes: 60, channel: 'zoom',
    })
    expect(outOfHours.status).toBe(422)
    const past = await api().post('/api/appointments').set(auth(token)).send({
      providerId: 'u-coach-jae', startsAt: '2020-01-06T14:00:00.000Z', durationMinutes: 60, channel: 'zoom',
    })
    expect(past.status).toBe(409)
    const slots = await api().get(`/api/providers/u-coach-anke/availability?date=${date}`)
    const free = slots.body.find((s: { available: boolean }) => s.available)
    const channel = await api().post('/api/appointments').set(auth(token)).send({
      providerId: 'u-coach-anke', startsAt: free.startsAt, durationMinutes: 60, channel: 'in_person',
    })
    expect(channel.status).toBe(422)
    const duration = await api().post('/api/appointments').set(auth(token)).send({
      providerId: 'u-coach-anke', startsAt: free.startsAt, durationMinutes: 90, channel: 'zoom',
    })
    expect(duration.status).toBe(422)
  })

  it('a coach sees their own calendar and can complete a session; a stranger cannot', async () => {
    const coach = await tokenFor(ACCOUNTS.coach, 'coach')
    const list = await api().get('/api/appointments').set(auth(coach))
    expect(list.body.every((a: { providerId: string }) => a.providerId === 'u-coach-mara')).toBe(true)
    const upcoming = list.body.find((a: { status: string }) => a.status === 'confirmed' || a.status === 'pending')
    if (upcoming) {
      const done = await api().patch(`/api/appointments/${upcoming.id}`).set(auth(coach)).send({ status: 'completed' })
      expect(done.body.status).toBe('completed')
      const otherMember = await tokenFor('logan.millington@example.com')
      expect((await api().post(`/api/appointments/${upcoming.id}/cancel`).set(auth(otherMember))).status).toBe(403)
    }
  })
})
