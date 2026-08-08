import { useMemo, useState } from 'react'
import { CalendarX2 } from 'lucide-react'
import { Role } from '@/domain/identity/model'
import {
  AppointmentStatus,
  isUpcoming,
  type Appointment,
} from '@/domain/scheduling/model'
import type { AppointmentId } from '@/domain/shared/types'
import { PageHeading } from '@/shared/ui/Card'
import { ButtonLink } from '@/shared/ui/Button'
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { Tabs } from '@/shared/ui/Tabs'
import { Modal } from '@/shared/ui/Modal'
import { Button } from '@/shared/ui/Button'
import { useCurrentUser } from '@/features/auth/store'
import { AppointmentCard } from './AppointmentCard'
import { useAppointments, useCancelAppointment } from './hooks'

type Filter = 'upcoming' | 'past' | 'cancelled'

export default function SchedulePage() {
  const user = useCurrentUser()
  const [filter, setFilter] = useState<Filter>('upcoming')
  const [toCancel, setToCancel] = useState<Appointment | null>(null)

  const { data, isPending, isError, refetch } = useAppointments(user)
  const cancel = useCancelAppointment(user?.id)

  const perspective = user?.role === Role.Member ? 'member' : 'provider'

  const groups = useMemo(() => {
    const all = data ?? []
    const cancelled = all.filter(
      (a) =>
        a.status === AppointmentStatus.Cancelled || a.status === AppointmentStatus.NoShow,
    )
    const upcoming = all.filter((a) => isUpcoming(a))
    const past = all
      .filter((a) => !isUpcoming(a) && !cancelled.includes(a))
      .sort((a, b) => b.startsAt.localeCompare(a.startsAt))

    return { upcoming, past, cancelled }
  }, [data])

  const visible = groups[filter]

  const onConfirmCancel = () => {
    if (!toCancel) return
    cancel.mutate(toCancel.id as AppointmentId, { onSettled: () => setToCancel(null) })
  }

  return (
    <>
      <PageHeading
        title={perspective === 'member' ? 'My appointments' : 'My schedule'}
        subtitle={
          perspective === 'member'
            ? 'Everything you have booked, with the join link ready ten minutes before.'
            : 'Sessions your clients have booked with you, newest first.'
        }
        actions={
          user?.role === Role.Member && (
            <ButtonLink to="/app/specialists" size="md">
              Book a session
            </ButtonLink>
          )
        }
      />

      <Tabs
        className="mb-6 max-w-md"
        value={filter}
        onChange={setFilter}
        items={[
          { id: 'upcoming', label: 'Upcoming', count: groups.upcoming.length },
          { id: 'past', label: 'Past', count: groups.past.length },
          { id: 'cancelled', label: 'Cancelled', count: groups.cancelled.length },
        ]}
      />

      {isPending ? (
        <SkeletonList rows={4} />
      ) : isError ? (
        <ErrorState description="Couldn't load your schedule." onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={CalendarX2}
          title={
            filter === 'upcoming'
              ? 'Nothing booked yet'
              : filter === 'past'
                ? 'No past sessions'
                : 'Nothing cancelled'
          }
          description={
            filter === 'upcoming' && perspective === 'member'
              ? 'Pick a specialist and grab a time that suits you.'
              : undefined
          }
          action={
            filter === 'upcoming' &&
            perspective === 'member' && (
              <ButtonLink to="/app/specialists">Find a specialist</ButtonLink>
            )
          }
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {visible.map((appointment) => (
            <AppointmentCard
              key={appointment.id}
              appointment={appointment}
              perspective={perspective}
              onCancel={filter === 'upcoming' ? setToCancel : undefined}
              cancelling={cancel.isPending && toCancel?.id === appointment.id}
            />
          ))}
        </div>
      )}

      <Modal
        open={Boolean(toCancel)}
        onClose={() => setToCancel(null)}
        title="Cancel this session?"
        description={
          toCancel
            ? `${toCancel.providerName} will be notified and the slot is released immediately.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setToCancel(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={cancel.isPending} onClick={onConfirmCancel}>
              Cancel session
            </Button>
          </>
        }
      >
        <p className="text-sm text-chalk-dim">
          {toCancel && new Date(toCancel.startsAt).getTime() - Date.now() > 24 * 3_600_000
            ? 'You are outside the 24-hour window, so there is no charge.'
            : 'This is inside the 24-hour window, so the session will still be charged.'}
        </p>
      </Modal>
    </>
  )
}
