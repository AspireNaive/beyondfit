import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { addDays, format } from 'date-fns'
import {
  ArrowLeft,
  CalendarCheck,
  Check,
  MapPin,
  Phone,
  Star,
  Video,
} from 'lucide-react'
import {
  CANCELLATION_WINDOW_HOURS,
  CHANNEL_LABELS,
  DISCIPLINE_LABELS,
  MeetingChannel,
} from '@/domain/scheduling/model'
import { formatMoney } from '@/domain/shared/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Textarea } from '@/shared/ui/Field'
import { ErrorState, Skeleton } from '@/shared/ui/Feedback'
import { useCurrentUser } from '@/features/auth/store'
import { toIsoDate, today } from '@/shared/lib/dates'
import { Calendar } from './Calendar'
import { useAvailability, useBookAppointment, useProvider } from './hooks'
import { cn } from '@/shared/lib/cn'

const DURATIONS = [30, 45, 60] as const

const CHANNEL_ICONS: Record<MeetingChannel, React.ComponentType<{ className?: string }>> = {
  [MeetingChannel.Zoom]: Video,
  [MeetingChannel.GoogleMeet]: Video,
  [MeetingChannel.Phone]: Phone,
  [MeetingChannel.InPerson]: MapPin,
}

export default function BookingPage() {
  const { providerId } = useParams()
  const navigate = useNavigate()
  const member = useCurrentUser()

  const [date, setDate] = useState(today)
  // Once the member picks a date themselves we stop auto-advancing, even if
  // that day is empty — overriding their choice would feel broken.
  const [datePinned, setDatePinned] = useState(false)
  const [autoAdvances, setAutoAdvances] = useState(0)
  const [slot, setSlot] = useState<string | null>(null)
  const [duration, setDuration] = useState<(typeof DURATIONS)[number]>(60)
  const [channel, setChannel] = useState<MeetingChannel | null>(null)
  const [goal, setGoal] = useState('')
  const [notes, setNotes] = useState('')

  const { data: provider, isPending: providerPending } = useProvider(providerId)
  const { data: slots, isPending: slotsPending } = useAvailability(providerId, date)
  const booking = useBookAppointment(member)

  // Default the channel to the provider's first supported option.
  const effectiveChannel = channel ?? provider?.channels[0] ?? MeetingChannel.Zoom

  const openSlots = useMemo(() => slots?.filter((s) => s.available) ?? [], [slots])

  /**
   * Landing on "today" usually means landing on a day whose slots have already
   * been and gone — an empty grid is a terrible first frame for a booking page.
   * Roll forward to the first day that actually has something, giving up after
   * three weeks so a fully-booked provider can't spin this forever.
   */
  useEffect(() => {
    if (datePinned || slotsPending || !slots) return
    if (openSlots.length > 0 || autoAdvances >= 21) return

    setDate((current) => toIsoDate(addDays(new Date(`${current}T00:00:00`), 1)))
    setAutoAdvances((n) => n + 1)
  }, [datePinned, slotsPending, slots, openSlots.length, autoAdvances])

  if (providerPending) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-32 w-full" />
        <div className="grid gap-5 lg:grid-cols-2">
          <Skeleton className="h-96 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    )
  }

  if (!provider) {
    return (
      <ErrorState
        title="Specialist not found"
        description="That profile is no longer taking bookings."
      />
    )
  }

  // --- Success -------------------------------------------------------------
  if (booking.isSuccess) {
    const appointment = booking.data
    const start = new Date(appointment.startsAt)

    return (
      <div className="mx-auto max-w-lg py-8 text-center">
        <span className="mx-auto grid size-14 place-items-center rounded-full bg-volt-400/15 text-volt-400 animate-[bf-pulse-ring_2s_ease-out_infinite]">
          <CalendarCheck className="size-7" />
        </span>

        <h1 className="mt-6 text-4xl">You're booked</h1>
        <p className="mt-3 text-sm text-chalk-dim">
          A confirmation is on its way, and the session is in your schedule.
        </p>

        <dl className="mt-8 space-y-3 rounded-xl border border-ink-700 bg-ink-850/70 p-6 text-left">
          {[
            ['Specialist', appointment.providerName],
            ['When', format(start, "EEEE d MMMM 'at' h:mm a")],
            ['Duration', `${appointment.durationMinutes} minutes`],
            ['Channel', CHANNEL_LABELS[appointment.channel]],
            ['Price', formatMoney(appointment.price)],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between gap-4 text-sm">
              <dt className="text-chalk-faint">{label}</dt>
              <dd className="text-right font-medium text-chalk">{value}</dd>
            </div>
          ))}
        </dl>

        {appointment.joinUrl && (
          <a
            href={appointment.joinUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 block truncate rounded-lg border border-ink-700 bg-ink-900 p-3 text-sm text-volt-400 underline underline-offset-4"
          >
            {appointment.joinUrl}
          </a>
        )}

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/app/schedule" size="lg">
            View my schedule
          </ButtonLink>
          <Button variant="outline" size="lg" onClick={() => booking.reset()}>
            Book another
          </Button>
        </div>
      </div>
    )
  }

  const canConfirm = Boolean(slot) && !booking.isPending

  const onConfirm = () => {
    if (!slot || !member) return
    booking.mutate({
      providerId: provider.id,
      startsAt: slot,
      durationMinutes: duration,
      channel: effectiveChannel,
      goal: goal || undefined,
      notes: notes || undefined,
    })
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-chalk-faint transition-colors hover:text-chalk"
      >
        <ArrowLeft className="size-4" />
        Back
      </button>

      {/* Provider header */}
      <header className="flex flex-wrap items-start gap-5 rounded-xl border border-ink-700 bg-ink-850/70 p-6">
        <Avatar name={provider.name} src={provider.avatarUrl} size="xl" />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl">{provider.name}</h1>
          <p className="mt-1 text-sm text-chalk-dim">{provider.title}</p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge tone="volt">{DISCIPLINE_LABELS[provider.discipline]}</Badge>
            <span className="flex items-center gap-1.5 text-xs text-chalk-dim">
              <Star className="size-3.5 fill-volt-400 text-volt-400" />
              <span className="font-semibold tabular-nums text-chalk">{provider.rating}</span>(
              {provider.reviewCount} reviews)
            </span>
          </div>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk-dim text-pretty">
            {provider.bio}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl leading-none text-chalk">
            {formatMoney(provider.sessionRate)}
          </p>
          <p className="mt-1 text-xs text-chalk-faint">per session</p>
        </div>
      </header>

      {booking.isError && (
        <div className="mt-5">
          <ErrorState
            title="Could not book that slot"
            description={(booking.error as Error).message}
            onRetry={() => booking.reset()}
          />
        </div>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="space-y-6">
          {/* Date + time */}
          <section>
            <h2 className="text-xl">1. Pick a date and time</h2>
            <div className="mt-4 grid gap-5 sm:grid-cols-[minmax(0,20rem)_1fr]">
              <Calendar
                value={date}
                onChange={(next) => {
                  setDate(next)
                  setDatePinned(true)
                  setSlot(null)
                }}
              />

              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
                  {format(new Date(`${date}T00:00:00`), 'EEEE d MMMM')} ·{' '}
                  {provider.timezone.replace('_', ' ')}
                </p>

                {slotsPending ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {Array.from({ length: 8 }, (_, i) => (
                      <Skeleton key={i} className="h-11" />
                    ))}
                  </div>
                ) : openSlots.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed border-ink-600 p-6 text-center">
                    <p className="text-sm text-chalk-dim">Nothing free on this day.</p>
                    <p className="mt-1 text-xs text-chalk-faint">Try another date.</p>
                  </div>
                ) : (
                  <div
                    role="radiogroup"
                    aria-label="Available times"
                    className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3"
                  >
                    {openSlots.map((option) => {
                      const active = slot === option.startsAt
                      return (
                        <button
                          key={option.startsAt}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setSlot(option.startsAt)}
                          className={cn(
                            'h-11 rounded-lg border text-sm font-semibold tabular-nums transition-colors',
                            active
                              ? 'border-volt-400 bg-volt-400 text-ink-950'
                              : 'border-ink-600 text-chalk-dim hover:border-ink-500 hover:text-chalk',
                          )}
                        >
                          {format(new Date(option.startsAt), 'h:mm a')}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* Duration */}
          <section>
            <h2 className="text-xl">2. How long?</h2>
            <div role="radiogroup" aria-label="Session length" className="mt-4 flex flex-wrap gap-2">
              {DURATIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={duration === option}
                  onClick={() => setDuration(option)}
                  className={cn(
                    'rounded-lg border px-5 py-2.5 text-sm font-semibold transition-colors',
                    duration === option
                      ? 'border-volt-400 bg-volt-400 text-ink-950'
                      : 'border-ink-600 text-chalk-dim hover:border-ink-500 hover:text-chalk',
                  )}
                >
                  {option} min
                </button>
              ))}
            </div>
          </section>

          {/* Channel */}
          <section>
            <h2 className="text-xl">3. Where should it happen?</h2>
            <div
              role="radiogroup"
              aria-label="Meeting channel"
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              {provider.channels.map((option) => {
                const Icon = CHANNEL_ICONS[option]
                const active = effectiveChannel === option
                return (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    onClick={() => setChannel(option)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                      active
                        ? 'border-volt-400 bg-volt-400/10'
                        : 'border-ink-600 hover:border-ink-500',
                    )}
                  >
                    <span
                      className={cn(
                        'grid size-9 shrink-0 place-items-center rounded-lg',
                        active ? 'bg-volt-400 text-ink-950' : 'bg-ink-700 text-chalk-dim',
                      )}
                    >
                      <Icon className="size-4.5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold text-chalk">
                        {CHANNEL_LABELS[option]}
                      </span>
                      <span className="block truncate text-xs text-chalk-faint">
                        {option === MeetingChannel.InPerson
                          ? 'At the studio'
                          : option === MeetingChannel.Phone
                            ? 'We call you'
                            : 'Link sent on confirmation'}
                      </span>
                    </span>
                    {active && <Check className="ml-auto size-4.5 shrink-0 text-volt-400" />}
                  </button>
                )
              })}
            </div>
          </section>

          {/* Context */}
          <section>
            <h2 className="text-xl">4. What do you want out of it?</h2>
            <div className="mt-4 space-y-4">
              <Textarea
                label="Your goal for this session"
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                placeholder="e.g. My left knee hurts on squats and I want to know whether to keep training through it."
                hint="Optional, but it makes the first ten minutes much more useful."
              />
              <Textarea
                label="Anything else they should know"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Injuries, medication, recent tests…"
              />
            </div>
          </section>
        </div>

        {/* Summary */}
        <aside className="rounded-xl border border-ink-700 bg-ink-850/80 p-6 lg:sticky lg:top-24">
          <h2 className="text-xl">Your session</h2>

          <dl className="mt-5 space-y-3 text-sm">
            {[
              ['Specialist', provider.name],
              ['Discipline', DISCIPLINE_LABELS[provider.discipline]],
              [
                'When',
                slot ? format(new Date(slot), "EEE d MMM 'at' h:mm a") : 'Pick a time',
              ],
              ['Duration', `${duration} minutes`],
              ['Channel', CHANNEL_LABELS[effectiveChannel]],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-4">
                <dt className="shrink-0 text-chalk-faint">{label}</dt>
                <dd
                  className={cn(
                    'text-right font-medium',
                    label === 'When' && !slot ? 'text-chalk-faint' : 'text-chalk',
                  )}
                >
                  {value}
                </dd>
              </div>
            ))}
          </dl>

          <div className="mt-5 flex items-baseline justify-between border-t border-ink-700 pt-5">
            <span className="text-sm text-chalk-dim">Total</span>
            <span className="font-display text-3xl leading-none text-chalk">
              {formatMoney(provider.sessionRate)}
            </span>
          </div>

          <Button
            size="lg"
            className="mt-5 w-full"
            disabled={!canConfirm}
            loading={booking.isPending}
            onClick={onConfirm}
          >
            {slot ? 'Confirm booking' : 'Pick a time first'}
          </Button>

          <p className="mt-4 text-xs leading-relaxed text-chalk-faint">
            Free to cancel or reschedule up to {CANCELLATION_WINDOW_HOURS} hours before. Inside that
            window the session is charged.
          </p>

          <p className="mt-3 text-xs text-chalk-faint">
            Included in Performance and Elite memberships —{' '}
            <Link to="/shop/membership-performance" className="text-volt-400 underline underline-offset-4">
              see plans
            </Link>
            .
          </p>
        </aside>
      </div>
    </div>
  )
}
