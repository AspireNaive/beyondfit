import { format, formatDistanceToNowStrict, isToday, isTomorrow } from 'date-fns'
import { Calendar, MapPin, Phone, Video } from 'lucide-react'
import {
  APPOINTMENT_STATUS_TONE,
  AppointmentStatus,
  CHANNEL_LABELS,
  DISCIPLINE_LABELS,
  MeetingChannel,
  canCancelFreeOfCharge,
  isUpcoming,
  type Appointment,
} from '@/domain/scheduling/model'
import { formatMoney } from '@/domain/shared/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { Button, ExternalButtonLink } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'

const CHANNEL_ICONS: Record<MeetingChannel, React.ComponentType<{ className?: string }>> = {
  [MeetingChannel.Zoom]: Video,
  [MeetingChannel.GoogleMeet]: Video,
  [MeetingChannel.Phone]: Phone,
  [MeetingChannel.InPerson]: MapPin,
}

/** "Today at 9:00 am" reads better than a full date for the next few days. */
function whenLabel(startsAt: string) {
  const date = new Date(startsAt)
  const time = format(date, 'h:mm a')
  if (isToday(date)) return `Today at ${time}`
  if (isTomorrow(date)) return `Tomorrow at ${time}`
  return format(date, "EEE d MMM 'at' h:mm a")
}

export function AppointmentCard({
  appointment,
  /** Which side of the session the viewer is on — decides whose name shows. */
  perspective,
  onCancel,
  cancelling,
  className,
}: {
  appointment: Appointment
  perspective: 'member' | 'provider'
  onCancel?: (appointment: Appointment) => void
  cancelling?: boolean
  className?: string
}) {
  const counterpartName =
    perspective === 'member' ? appointment.providerName : appointment.memberName
  const ChannelIcon = CHANNEL_ICONS[appointment.channel]
  const upcoming = isUpcoming(appointment)
  const startsAt = new Date(appointment.startsAt)

  // Join opens 10 minutes before the hour; earlier than that it is noise.
  const joinable =
    upcoming &&
    appointment.status === AppointmentStatus.Confirmed &&
    Boolean(appointment.joinUrl) &&
    startsAt.getTime() - Date.now() < 10 * 60_000

  return (
    <article
      className={cn(
        'rounded-xl border border-ink-700 bg-ink-850/70 p-5 transition-colors',
        upcoming && 'hover:border-ink-500',
        !upcoming && 'opacity-80',
        className,
      )}
    >
      <div className="flex flex-wrap items-start gap-4">
        <Avatar name={counterpartName} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg leading-tight">{counterpartName}</h3>
            <Badge tone={APPOINTMENT_STATUS_TONE[appointment.status]}>
              {appointment.status.replace('_', ' ')}
            </Badge>
          </div>

          <p className="mt-1 text-sm text-chalk-dim">
            {DISCIPLINE_LABELS[appointment.discipline]} · {appointment.durationMinutes} min
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-chalk-faint">
            <span className="flex items-center gap-1.5">
              <Calendar className="size-3.5" />
              {whenLabel(appointment.startsAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <ChannelIcon className="size-3.5" />
              {CHANNEL_LABELS[appointment.channel]}
            </span>
            {upcoming && (
              <span className="text-volt-400">
                in {formatDistanceToNowStrict(startsAt)}
              </span>
            )}
            <span className="tabular-nums">{formatMoney(appointment.price)}</span>
          </div>

          {appointment.memberGoal && perspective === 'provider' && (
            <p className="mt-3 rounded-lg border border-ink-700 bg-ink-900/60 px-3 py-2 text-xs text-chalk-dim">
              <span className="font-semibold text-chalk">Goal: </span>
              {appointment.memberGoal}
            </p>
          )}

          {appointment.notes && (
            <p className="mt-2 text-xs italic text-chalk-faint text-pretty">{appointment.notes}</p>
          )}
        </div>
      </div>

      {upcoming && (onCancel || appointment.joinUrl) && (
        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-ink-700 pt-4">
          {appointment.joinUrl && (
            <ExternalButtonLink
              href={appointment.joinUrl}
              target="_blank"
              rel="noreferrer"
              size="sm"
              variant={joinable ? 'primary' : 'secondary'}
            >
              {appointment.channel === MeetingChannel.Phone ? 'Call now' : 'Join session'}
            </ExternalButtonLink>
          )}

          {onCancel && (
            <Button
              size="sm"
              variant="ghost"
              loading={cancelling}
              onClick={() => onCancel(appointment)}
            >
              Cancel
            </Button>
          )}

          {!canCancelFreeOfCharge(appointment) && (
            <span className="text-xs text-warn-500">Inside the free-cancellation window</span>
          )}
        </div>
      )}
    </article>
  )
}
