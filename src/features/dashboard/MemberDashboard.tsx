import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import {
  Activity,
  ArrowRight,
  CalendarPlus,
  Flame,
  Footprints,
  Package,
  Scale,
  Stethoscope,
} from 'lucide-react'
import { fullName } from '@/domain/identity/model'
import { isUpcoming } from '@/domain/scheduling/model'
import { calculateBmi, currentStreak, seriesDelta } from '@/domain/progress/model'
import { formatMoney } from '@/domain/shared/types'
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONE } from '@/domain/commerce/model'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { Card, CardBody, CardTitle } from '@/shared/ui/Card'
import { Stat } from '@/shared/ui/Stat'
import { Skeleton } from '@/shared/ui/Feedback'
import { useCurrentUser } from '@/features/auth/store'
import { AppointmentCard } from '@/features/booking/AppointmentCard'
import { useAppointments } from '@/features/booking/hooks'
import { useActivity, useBodyMetrics, useGoal } from '@/features/progress/hooks'
import { useOrders } from '@/features/orders/hooks'
import { useProfile } from '@/features/profiles/hooks'
import type { UserId } from '@/domain/shared/types'

const QUICK_ACTIONS = [
  { to: '/app/specialists', label: 'Book a session', icon: CalendarPlus },
  { to: '/app/progress', label: 'Log my numbers', icon: Activity },
  { to: '/shop', label: 'Browse the shop', icon: Package },
  { to: '/app/people', label: 'Find my coach', icon: Stethoscope },
]

function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export default function MemberDashboard() {
  const user = useCurrentUser()

  const appointments = useAppointments(user)
  const metrics = useBodyMetrics(user?.id)
  const activity = useActivity(user?.id, 30)
  const goal = useGoal(user?.id)
  const orders = useOrders(user)
  const coach = useProfile(user?.assignedCoachId as UserId | undefined)

  const upcoming = useMemo(
    () => (appointments.data ?? []).filter((a) => isUpcoming(a)).slice(0, 3),
    [appointments.data],
  )

  const latest = metrics.data?.[metrics.data.length - 1]
  const bmi = latest ? calculateBmi(latest.weightKg, latest.heightCm) : 0

  const weightDelta = useMemo(
    () => seriesDelta((metrics.data ?? []).map((m) => m.weightKg)),
    [metrics.data],
  )

  const streak = useMemo(
    () => currentStreak(activity.data ?? [], goal.data?.dailyStepTarget ?? 10_000),
    [activity.data, goal.data],
  )

  const weekWorkouts = useMemo(
    () => (activity.data ?? []).slice(-7).reduce((sum, day) => sum + day.workouts, 0),
    [activity.data],
  )

  const recentOrders = (orders.data ?? []).slice(0, 3)
  const loading = metrics.isPending || activity.isPending

  if (!user) return null

  return (
    <>
      <div className="mb-8">
        <p className="eyebrow">{greeting()}</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">{user.firstName}</h1>
        {goal.data?.focus && (
          <p className="mt-3 max-w-2xl text-sm text-chalk-dim">
            Working on: <span className="text-chalk">{goal.data.focus}</span>
          </p>
        )}
      </div>

      {/* KPI row */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Weight"
            value={latest ? Math.round(latest.weightKg * 10) / 10 : '—'}
            unit="kg"
            delta={weightDelta}
            deltaGoodWhen="down"
            hint="since you started"
            icon={Scale}
          />
          <Stat label="BMI" value={bmi ? bmi.toFixed(1) : '—'} hint="screening number" icon={Activity} />
          <Stat
            label="Step streak"
            value={streak}
            unit={streak === 1 ? 'day' : 'days'}
            hint={`target ${(goal.data?.dailyStepTarget ?? 10_000).toLocaleString()}`}
            icon={Footprints}
          />
          <Stat
            label="Workouts this week"
            value={weekWorkouts}
            hint={`target ${goal.data?.weeklyWorkoutTarget ?? 4}`}
            icon={Flame}
          />
        </div>
      )}

      {/* Quick actions */}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK_ACTIONS.map((action) => (
          <Link
            key={action.to}
            to={action.to}
            className="group flex items-center gap-3 rounded-xl border border-ink-700 bg-ink-850/60 p-4 transition-colors hover:border-volt-400/50 hover:bg-ink-800/60"
          >
            <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-volt-400/12 text-volt-400 transition-colors group-hover:bg-volt-400 group-hover:text-ink-950">
              <action.icon className="size-5" />
            </span>
            <span className="text-sm font-semibold text-chalk">{action.label}</span>
            <ArrowRight className="ml-auto size-4 text-chalk-faint transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        {/* Upcoming */}
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl">Coming up</h2>
            <Link
              to="/app/schedule"
              className="text-xs font-semibold uppercase tracking-wider text-volt-400"
            >
              All appointments
            </Link>
          </div>

          {appointments.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : upcoming.length === 0 ? (
            <Card>
              <CardBody className="text-center">
                <p className="text-sm text-chalk-dim">
                  Nothing booked. Your next session is the one that keeps the streak alive.
                </p>
                <ButtonLink to="/app/specialists" className="mt-5">
                  Book a session
                </ButtonLink>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {upcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  perspective="member"
                />
              ))}
            </div>
          )}
        </section>

        <div className="space-y-5">
          {/* Coach */}
          {coach.data && (
            <Card>
              <CardBody>
                <CardTitle>Your coach</CardTitle>
                <div className="mt-4">
                  <p className="text-lg text-chalk">{fullName(coach.data)}</p>
                  <p className="text-sm text-chalk-dim">{coach.data.title}</p>
                  <p className="mt-3 text-sm leading-relaxed text-chalk-dim text-pretty">
                    {coach.data.bio}
                  </p>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <ButtonLink to={`/app/book/${coach.data.id}`} size="sm">
                      Book with them
                    </ButtonLink>
                    <ButtonLink to={`/app/people/${coach.data.id}`} size="sm" variant="outline">
                      View profile
                    </ButtonLink>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          {/* Orders */}
          <Card>
            <CardBody>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Recent orders</CardTitle>
                <Link
                  to="/app/my-orders"
                  className="text-xs font-semibold uppercase tracking-wider text-volt-400"
                >
                  All
                </Link>
              </div>

              {recentOrders.length === 0 ? (
                <p className="mt-4 text-sm text-chalk-dim">
                  Nothing ordered yet.{' '}
                  <Link to="/shop" className="text-volt-400 underline underline-offset-4">
                    Visit the shop
                  </Link>
                  .
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {recentOrders.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-3 border-b border-ink-700 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-chalk">{order.lines[0]?.name}</p>
                        <p className="text-xs text-chalk-faint">
                          {order.reference} · {format(new Date(order.placedAt), 'd MMM')}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-sm tabular-nums text-chalk">
                          {formatMoney(order.total)}
                        </p>
                        <Badge tone={ORDER_STATUS_TONE[order.status]} className="mt-1">
                          {ORDER_STATUS_LABELS[order.status]}
                        </Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
