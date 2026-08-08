import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { isToday, isThisWeek } from 'date-fns'
import { CalendarDays, DollarSign, Package, Users } from 'lucide-react'
import { Role, fullName } from '@/domain/identity/model'
import { AppointmentStatus, isUpcoming } from '@/domain/scheduling/model'
import { OrderStatus } from '@/domain/commerce/model'
import { formatMoney, money } from '@/domain/shared/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { Card, CardBody, CardTitle } from '@/shared/ui/Card'
import { Stat } from '@/shared/ui/Stat'
import { EmptyState, Skeleton } from '@/shared/ui/Feedback'
import { useCurrentUser } from '@/features/auth/store'
import { AppointmentCard } from '@/features/booking/AppointmentCard'
import { useAppointments } from '@/features/booking/hooks'
import { useMappedProfiles } from '@/features/profiles/hooks'
import { useOrders } from '@/features/orders/hooks'

export default function CoachDashboard() {
  const user = useCurrentUser()

  const appointments = useAppointments(user)
  const people = useMappedProfiles(user)
  const orders = useOrders(user)

  const { today, upcoming, weekCount, weekEarnings } = useMemo(() => {
    const all = appointments.data ?? []
    const live = all.filter((a) => isUpcoming(a))

    const completedThisWeek = all.filter(
      (a) =>
        a.status === AppointmentStatus.Completed &&
        isThisWeek(new Date(a.startsAt), { weekStartsOn: 1 }),
    )

    return {
      today: live.filter((a) => isToday(new Date(a.startsAt))),
      upcoming: live.slice(0, 6),
      weekCount: completedThisWeek.length,
      weekEarnings: completedThisWeek.reduce(
        (total, a) => total + a.price.amountMinor,
        0,
      ),
    }
  }, [appointments.data])

  /** Members assigned to this coach — the "mapped profiles" for their role. */
  const clients = useMemo(
    () => (people.data ?? []).filter((p) => p.role === Role.Member),
    [people.data],
  )

  const openOrders = useMemo(
    () =>
      (orders.data ?? []).filter(
        (o) => o.status === OrderStatus.Paid || o.status === OrderStatus.Processing,
      ),
    [orders.data],
  )

  const productRevenue = useMemo(
    () =>
      (orders.data ?? [])
        .filter((o) => o.status !== OrderStatus.Cancelled && o.status !== OrderStatus.Refunded)
        .reduce(
          (total, order) =>
            total +
            order.lines
              .filter((line) => line.instructorId === user?.id)
              .reduce((sum, line) => sum + line.unitPrice.amountMinor * line.quantity, 0),
          0,
        ),
    [orders.data, user?.id],
  )

  if (!user) return null

  return (
    <>
      <div className="mb-8">
        <p className="eyebrow">Coach dashboard</p>
        <h1 className="mt-2 text-4xl sm:text-5xl">{user.firstName}</h1>
        <p className="mt-3 text-sm text-chalk-dim">
          {today.length === 0
            ? 'Nothing on your calendar today.'
            : `${today.length} session${today.length === 1 ? '' : 's'} today.`}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Sessions today" value={today.length} icon={CalendarDays} />
        <Stat
          label="Completed this week"
          value={weekCount}
          hint={formatMoney(money(weekEarnings)) + ' billed'}
          icon={CalendarDays}
        />
        <Stat label="Active clients" value={clients.length} icon={Users} />
        <Stat
          label="Programme revenue"
          value={formatMoney(money(productRevenue), { compact: true })}
          hint={`${openOrders.length} orders to fulfil`}
          icon={DollarSign}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start">
        <section>
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-2xl">Your schedule</h2>
            <Link
              to="/app/schedule"
              className="text-xs font-semibold uppercase tracking-wider text-volt-400"
            >
              Full calendar
            </Link>
          </div>

          {appointments.isPending ? (
            <div className="space-y-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : upcoming.length === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No sessions booked"
              description="Members will appear here as soon as they book with you."
            />
          ) : (
            <div className="space-y-4">
              {upcoming.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  perspective="provider"
                />
              ))}
            </div>
          )}
        </section>

        <div className="space-y-5">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Your clients</CardTitle>
                <Link
                  to="/app/people"
                  className="text-xs font-semibold uppercase tracking-wider text-volt-400"
                >
                  All
                </Link>
              </div>

              {clients.length === 0 ? (
                <p className="mt-4 text-sm text-chalk-dim">No members assigned to you yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {clients.slice(0, 6).map((client) => (
                    <li key={client.id}>
                      <Link
                        to={`/app/people/${client.id}`}
                        className="flex items-center gap-3 rounded-lg p-2 transition-colors hover:bg-ink-800"
                      >
                        <Avatar name={fullName(client)} src={client.avatarUrl} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-chalk">
                            {fullName(client)}
                          </p>
                          <p className="truncate text-xs text-chalk-faint">{client.title}</p>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="flex items-center justify-between gap-4">
                <CardTitle>Orders to fulfil</CardTitle>
                <Link
                  to="/app/orders"
                  className="text-xs font-semibold uppercase tracking-wider text-volt-400"
                >
                  All orders
                </Link>
              </div>

              {openOrders.length === 0 ? (
                <p className="mt-4 flex items-center gap-2 text-sm text-chalk-dim">
                  <Package className="size-4 text-chalk-faint" />
                  Nothing waiting on you.
                </p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {openOrders.slice(0, 5).map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-3 border-b border-ink-700 pb-3 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm text-chalk">{order.customerName}</p>
                        <p className="truncate text-xs text-chalk-faint">{order.lines[0]?.name}</p>
                      </div>
                      <Badge tone={order.status === OrderStatus.Paid ? 'ok' : 'info'}>
                        {order.status.replace('_', ' ')}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}

              <ButtonLink to="/app/orders" variant="secondary" size="sm" className="mt-5 w-full">
                Manage orders
              </ButtonLink>
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
