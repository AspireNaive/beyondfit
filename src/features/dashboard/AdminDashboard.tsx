import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { format } from 'date-fns'
import { Building2, CreditCard, TrendingUp, Users } from 'lucide-react'
import { Role, fullName } from '@/domain/identity/model'
import { AppointmentStatus } from '@/domain/scheduling/model'
import { PAYMENT_STATUS_TONE, PaymentStatus } from '@/domain/commerce/model'
import { formatMoney, money } from '@/domain/shared/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { Card, CardBody, CardTitle } from '@/shared/ui/Card'
import { Stat } from '@/shared/ui/Stat'
import { Skeleton } from '@/shared/ui/Feedback'
import { useCurrentUser, useTenant } from '@/features/auth/store'
import { useMappedProfiles } from '@/features/profiles/hooks'
import { NutritionSettingsCard } from './NutritionSettingsCard'
import { useAppointments } from '@/features/booking/hooks'
import { usePayments, useSubscriptions } from '@/features/payments/hooks'

export default function AdminDashboard() {
  const user = useCurrentUser()
  const tenant = useTenant()

  const people = useMappedProfiles(user)
  const appointments = useAppointments(user)
  const payments = usePayments()
  const subscriptions = useSubscriptions()

  const counts = useMemo(() => {
    const all = people.data ?? []
    return {
      members: all.filter((p) => p.role === Role.Member).length,
      coaches: all.filter((p) => p.role === Role.Coach).length,
    }
  }, [people.data])

  const revenue = useMemo(() => {
    const rows = payments.data ?? []
    const succeeded = rows.filter((p) => p.status === PaymentStatus.Succeeded)
    return {
      gross: succeeded.reduce((sum, p) => sum + p.gross.amountMinor, 0),
      net: succeeded.reduce((sum, p) => sum + p.net.amountMinor, 0),
      failed: rows.filter((p) => p.status === PaymentStatus.Failed).length,
      disputed: rows.filter((p) => p.status === PaymentStatus.Disputed).length,
    }
  }, [payments.data])

  const mrr = useMemo(
    () =>
      (subscriptions.data ?? [])
        .filter((s) => s.status === 'active')
        // Annual plans are amortised so the figure means one thing.
        .reduce(
          (sum, s) =>
            sum + (s.interval === 'year' ? Math.round(s.price.amountMinor / 12) : s.price.amountMinor),
          0,
        ),
    [subscriptions.data],
  )

  const sessionsBooked = useMemo(
    () =>
      (appointments.data ?? []).filter(
        (a) =>
          a.status === AppointmentStatus.Confirmed || a.status === AppointmentStatus.Completed,
      ).length,
    [appointments.data],
  )

  const recentPayments = (payments.data ?? []).slice(0, 6)
  const atRisk = (subscriptions.data ?? []).filter((s) => s.status === 'past_due')
  const loading = payments.isPending || people.isPending

  if (!user) return null

  const seatUsage = tenant ? Math.round((tenant.seatsUsed / tenant.seats) * 100) : 0

  return (
    <>
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">
            {user.role === Role.AppManager ? 'Platform operations' : 'Studio administration'}
          </p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{tenant?.name ?? 'Dashboard'}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <ButtonLink to="/app/payments" size="md">
            <CreditCard className="size-4" />
            Payments
          </ButtonLink>
          {user.role === Role.AppManager && (
            <ButtonLink to="/app/tenants" size="md" variant="outline">
              <Building2 className="size-4" />
              All studios
            </ButtonLink>
          )}
        </div>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="Monthly recurring"
            value={formatMoney(money(mrr), { compact: true })}
            hint={`${(subscriptions.data ?? []).filter((s) => s.status === 'active').length} active plans`}
            icon={TrendingUp}
          />
          <Stat
            label="Net collected"
            value={formatMoney(money(revenue.net), { compact: true })}
            hint={`${formatMoney(money(revenue.gross), { compact: true })} gross`}
            icon={CreditCard}
          />
          <Stat
            label="Members"
            value={counts.members}
            hint={`${counts.coaches} coaches`}
            icon={Users}
          />
          <Stat label="Sessions booked" value={sessionsBooked} hint="all time" icon={Building2} />
        </div>
      )}

      {/* Attention band — surfaced above the fold because these cost money. */}
      {(revenue.failed > 0 || revenue.disputed > 0 || atRisk.length > 0) && (
        <div className="mt-5 flex flex-wrap gap-3">
          {revenue.failed > 0 && (
            <Link
              to="/app/payments"
              className="flex items-center gap-2 rounded-lg border border-danger-500/35 bg-danger-500/10 px-4 py-2.5 text-sm text-danger-500 transition-colors hover:bg-danger-500/15"
            >
              <strong className="tabular-nums">{revenue.failed}</strong> failed payments
            </Link>
          )}
          {revenue.disputed > 0 && (
            <Link
              to="/app/payments"
              className="flex items-center gap-2 rounded-lg border border-ember-500/35 bg-ember-500/10 px-4 py-2.5 text-sm text-ember-400 transition-colors hover:bg-ember-500/15"
            >
              <strong className="tabular-nums">{revenue.disputed}</strong> disputed
            </Link>
          )}
          {atRisk.length > 0 && (
            <Link
              to="/app/payments"
              className="flex items-center gap-2 rounded-lg border border-warn-500/35 bg-warn-500/10 px-4 py-2.5 text-sm text-warn-500 transition-colors hover:bg-warn-500/15"
            >
              <strong className="tabular-nums">{atRisk.length}</strong> subscriptions past due
            </Link>
          )}
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <Card>
          <CardBody>
            <div className="flex items-center justify-between gap-4">
              <CardTitle>Recent payments</CardTitle>
              <Link
                to="/app/payments"
                className="text-xs font-semibold uppercase tracking-wider text-volt-400"
              >
                View all
              </Link>
            </div>

            {payments.isPending ? (
              <div className="mt-4 space-y-3">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : (
              <ul className="mt-4 divide-y divide-ink-700">
                {recentPayments.map((payment) => (
                  <li key={payment.id} className="flex items-center gap-3 py-3">
                    <Avatar name={payment.customerName} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-chalk">{payment.customerName}</p>
                      <p className="truncate text-xs text-chalk-faint">
                        {payment.description} · {format(new Date(payment.processedAt), 'd MMM')}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold tabular-nums text-chalk">
                        {formatMoney(payment.gross)}
                      </p>
                      <Badge tone={PAYMENT_STATUS_TONE[payment.status]} className="mt-1">
                        {payment.status}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <div className="space-y-5">
          {tenant && (
            <Card>
              <CardBody>
                <CardTitle>Plan &amp; seats</CardTitle>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <span className="text-sm text-chalk-dim">Current plan</span>
                  <Badge tone="volt">{tenant.plan}</Badge>
                </div>

                <div className="mt-5">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-sm text-chalk-dim">Seats used</span>
                    <span className="font-display text-2xl leading-none tabular-nums text-chalk">
                      {tenant.seatsUsed.toLocaleString()}
                      <span className="text-sm text-chalk-faint">
                        {' '}
                        / {tenant.seats.toLocaleString()}
                      </span>
                    </span>
                  </div>

                  <div
                    className="mt-3 h-2 overflow-hidden rounded-full bg-ink-700"
                    role="meter"
                    aria-valuenow={seatUsage}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label="Seat usage"
                  >
                    <div
                      className={
                        seatUsage > 90
                          ? 'h-full rounded-full bg-danger-500'
                          : seatUsage > 75
                            ? 'h-full rounded-full bg-warn-500'
                            : 'h-full rounded-full bg-volt-400'
                      }
                      style={{ width: `${seatUsage}%` }}
                    />
                  </div>

                  <p className="mt-2 text-xs text-chalk-faint">
                    {seatUsage > 75
                      ? 'Approaching your seat limit — consider upgrading.'
                      : `${(tenant.seats - tenant.seatsUsed).toLocaleString()} seats available.`}
                  </p>
                </div>

                <ButtonLink to="/platform" variant="secondary" size="sm" className="mt-5 w-full">
                  Compare plans
                </ButtonLink>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody>
              <CardTitle>Coaches</CardTitle>
              <ul className="mt-4 space-y-3">
                {(people.data ?? [])
                  .filter((p) => p.role === Role.Coach)
                  .slice(0, 5)
                  .map((coach) => (
                    <li key={coach.id}>
                      <Link
                        to={`/app/people/${coach.id}`}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-ink-800"
                      >
                        <Avatar name={fullName(coach)} src={coach.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-chalk">
                            {fullName(coach)}
                          </p>
                          <p className="truncate text-xs text-chalk-faint">{coach.title}</p>
                        </div>
                        <span className="shrink-0 text-xs tabular-nums text-chalk-faint">
                          {coach.sessionsDelivered?.toLocaleString()}
                        </span>
                      </Link>
                    </li>
                  ))}
              </ul>
            </CardBody>
          </Card>
        </div>
      </div>

      {tenant && (
        <div className="mt-8">
          <NutritionSettingsCard tenant={tenant} />
        </div>
      )}
    </>
  )
}
