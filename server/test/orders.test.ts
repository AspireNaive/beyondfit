import { describe, expect, it } from 'vitest'
import { ACCOUNTS, api, auth, tokenFor } from './helpers.js'

describe('catalogue, orders, payments, subscriptions', () => {
  it('serves the catalogue publicly', async () => {
    const all = await api().get('/api/products')
    expect(all.status).toBe(200)
    expect(all.body).toHaveLength(12)
    expect((await api().get('/api/products?category=membership')).body).toHaveLength(1)
    expect((await api().get('/api/products?query=creatine')).body[0].slug).toBe('creatine-monohydrate')
    expect((await api().get('/api/products/lifting-belt')).body.price.amountMinor).toBe(11900)
    expect((await api().get('/api/products/nope')).body).toBeNull()
  })

  it('places an order with server-side totals and records the payment', async () => {
    const token = await tokenFor(ACCOUNTS.member)
    const res = await api().post('/api/orders').set(auth(token)).send({
      lines: [{ productId: 'p-5', quantity: 2 }, { productId: 'p-2', quantity: 1 }], method: 'card',
    })
    expect(res.status).toBe(201)
    // 2 × 3200 + 21900 = 28300; physical item but over the free-shipping bar.
    expect(res.body.subtotal.amountMinor).toBe(28300)
    expect(res.body.shipping.amountMinor).toBe(0)
    expect(res.body.tax.amountMinor).toBe(Math.round(28300 * 0.0825))
    expect(res.body.total.amountMinor).toBe(28300 + Math.round(28300 * 0.0825))
    expect(res.body.status).toBe('paid')
    expect(res.body.reference).toMatch(/^KL-\d+$/)
    expect(res.body.lines.find((l: { productId: string }) => l.productId === 'p-2').instructorId).toBe('u-coach-devon')

    const small = await api().post('/api/orders').set(auth(token)).send({ lines: [{ productId: 'p-5', quantity: 1 }] })
    expect(small.body.shipping.amountMinor).toBe(795)

    const admin = await tokenFor(ACCOUNTS.admin, 'admin')
    const payments = await api().get('/api/payments').set(auth(admin))
    const payment = payments.body.find((p: { orderId?: string }) => p.orderId === res.body.id)
    expect(payment.status).toBe('succeeded')
    expect(payment.gross.amountMinor).toBe(res.body.total.amountMinor)
    expect(payment.net.amountMinor).toBe(payment.gross.amountMinor - payment.fee.amountMinor)
  })

  it('rejects empty carts, unknown products and out-of-stock items', async () => {
    const token = await tokenFor(ACCOUNTS.member)
    expect((await api().post('/api/orders').set(auth(token)).send({ lines: [] })).status).toBe(422)
    expect((await api().post('/api/orders').set(auth(token)).send({ lines: [{ productId: 'ghost', quantity: 1 }] })).status).toBe(422)
    const oos = await api().post('/api/orders').set(auth(token)).send({ lines: [{ productId: 'p-8', quantity: 1 }] })
    expect(oos.status).toBe(409)
    expect(oos.body.code).toBe('out_of_stock')
  })

  it('buying a membership starts a subscription', async () => {
    const email = `sub.${Date.now()}@example.com`
    const reg = await api().post('/api/auth/register').send({ firstName: 'Sub', lastName: 'Scriber', email, password: 'longenough1' })
    const token = reg.body.accessToken as string
    const order = await api().post('/api/orders').set(auth(token)).send({ lines: [{ productId: 'p-9', quantity: 1 }] })
    expect(order.status).toBe(201)
    const subs = await api().get('/api/subscriptions').set(auth(token))
    expect(subs.body).toHaveLength(1)
    expect(subs.body[0].planName).toBe('Performance Membership')
    expect(subs.body[0].status).toBe('active')
    expect(new Date(subs.body[0].renewsAt).getTime()).toBeGreaterThan(Date.now())

    const dup = await api().post('/api/subscriptions').set(auth(token)).send({ productId: 'p-9' })
    expect(dup.status).toBe(409)
    const cancel = await api().post(`/api/subscriptions/${subs.body[0].id}/cancel`).set(auth(token))
    expect(cancel.body.status).toBe('cancelled')
    const direct = await api().post('/api/subscriptions').set(auth(token)).send({ productId: 'p-9' })
    expect(direct.status).toBe(201)
    expect(direct.body.status).toBe('active')
    const admin = await tokenFor(ACCOUNTS.admin, 'admin')
    const all = await api().get('/api/subscriptions').set(auth(admin))
    expect(all.body.filter((s: { memberId: string }) => s.memberId === reg.body.user.id)).toHaveLength(2)
  })

  it('scopes order lists and status changes by role', async () => {
    const member = await tokenFor(ACCOUNTS.member)
    const mine = await api().get('/api/orders').set(auth(member))
    expect(mine.body.every((o: { customerId: string }) => o.customerId === 'u-member-1')).toBe(true)
    const target = mine.body[0]

    expect((await api().patch(`/api/orders/${target.id}`).set(auth(member)).send({ status: 'shipped' })).status).toBe(403)

    const coach = await tokenFor('devon@kedemlife.app', 'coach')
    const theirs = await api().get('/api/orders').set(auth(coach))
    expect(theirs.body.every((o: { lines: { instructorId?: string }[] }) => o.lines.some((l) => l.instructorId === 'u-coach-devon'))).toBe(true)

    const admin = await tokenFor(ACCOUNTS.admin, 'admin')
    const shipped = await api().patch(`/api/orders/${target.id}`).set(auth(admin)).send({ status: 'shipped' })
    expect(shipped.body.status).toBe('shipped')
    expect(shipped.body.fulfilledAt).toBeTruthy()
    const refunded = await api().patch(`/api/orders/${target.id}`).set(auth(admin)).send({ status: 'refunded' })
    expect(refunded.body.status).toBe('refunded')
    const payments = await api().get('/api/payments').set(auth(admin))
    expect(payments.body.find((p: { orderId?: string }) => p.orderId === target.id)?.status).toBe('refunded')

    expect((await api().get('/api/payments').set(auth(member))).status).toBe(403)
    expect((await api().get(`/api/orders/${target.id}`).set(auth(await tokenFor('logan.millington@example.com')))).body).toBeNull()
  })

  it('lets admins manage the catalogue', async () => {
    const admin = await tokenFor(ACCOUNTS.admin, 'admin')
    const created = await api().post('/api/products').set(auth(admin)).send({
      slug: 'foam-roller', name: 'Foam Roller', description: 'Dense.', category: 'equipment', priceMinor: 2900,
    })
    expect(created.status).toBe(201)
    const hidden = await api().patch(`/api/products/${created.body.id}`).set(auth(admin)).send({ active: false })
    expect(hidden.status).toBe(200)
    expect((await api().get('/api/products/foam-roller')).body).toBeNull()
    expect((await api().post('/api/products').set(auth(await tokenFor(ACCOUNTS.member))).send({})).status).toBe(403)
  })
})
