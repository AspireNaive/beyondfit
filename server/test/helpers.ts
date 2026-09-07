import { createServer } from 'node:http'
import request from 'supertest'
import { createApp } from '../src/app.js'
import type { Role } from '../src/domain.js'

export const app = createApp()

/**
 * Bound explicitly to 127.0.0.1 rather than letting supertest call
 * `app.listen(0)`: that binds the IPv6 wildcard, and on a machine where
 * another process squats IPv4 wildcard ports the client's IPv4 connection
 * lands on the squatter instead of the app under test.
 */
const server = createServer(app)
server.listen(0, '127.0.0.1')
export const api = () => request(server)

export const DEMO_PASSWORD = 'kedemlife'
export const ACCOUNTS = {
  member: 'member@kedemlife.app',
  coach: 'coach@kedemlife.app',
  admin: 'admin@kedemlife.app',
  manager: 'manager@kedemlife.app',
} as const

const cache = new Map<string, string>()

/** Bearer token for a demo account, cached per test file. */
export async function tokenFor(email: string, portal: Role = 'member', password = DEMO_PASSWORD): Promise<string> {
  const key = `${email}:${portal}`
  const cached = cache.get(key)
  if (cached) return cached
  const res = await api().post('/api/auth/login').send({ email, password, portal })
  if (res.status !== 200) throw new Error(`login failed for ${email}: ${res.status} ${JSON.stringify(res.body)}`)
  cache.set(key, res.body.accessToken as string)
  return res.body.accessToken as string
}

export const auth = (token: string) => ({ Authorization: `Bearer ${token}` })

/** Next occurrence of a weekday (0 = Sunday) at least `minDaysAhead` days out, as YYYY-MM-DD in New York. */
export function nextWeekday(weekday: number, minDaysAhead = 2): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + minDaysAhead)
  while (d.getUTCDay() !== weekday) d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().slice(0, 10)
}
