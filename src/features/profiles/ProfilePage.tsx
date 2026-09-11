import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { Activity, ArrowLeft, CalendarDays, ClipboardList, Mail, MapPin, Phone, Star, Utensils } from 'lucide-react'
import { ROLE_LABELS, Role, fullName } from '@/domain/identity/model'
import { isUpcoming } from '@/domain/scheduling/model'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { Card, CardBody, CardTitle } from '@/shared/ui/Card'
import { ErrorState, Skeleton } from '@/shared/ui/Feedback'
import { useCurrentUser } from '@/features/auth/store'
import { AppointmentCard } from '@/features/booking/AppointmentCard'
import { useAppointments } from '@/features/booking/hooks'
import { Select } from '@/shared/ui/Field'
import { useMappedProfiles, useProfile, useUpdatePerson } from './hooks'
import type { UserId } from '@/domain/shared/types'

export default function ProfilePage() {
  const viewer = useCurrentUser()
  const { userId } = useParams()

  // /app/profile renders the viewer; /app/people/:userId renders someone else.
  const targetId = (userId ?? viewer?.id) as UserId | undefined
  const isSelf = !userId || userId === viewer?.id

  const { data: fetched, isPending, isError, refetch } = useProfile(isSelf ? undefined : targetId)
  const profile = isSelf ? viewer : fetched

  const { data: appointments } = useAppointments(viewer)

  // Admins map members to coaches from here.
  const canManage = viewer?.role === Role.Admin || viewer?.role === Role.AppManager
  const people = useMappedProfiles(canManage ? viewer : null)
  const coaches = useMemo(
    () => (people.data ?? []).filter((p) => p.role === Role.Coach && p.tenantId === (fetched?.tenantId ?? viewer?.tenantId)),
    [people.data, fetched?.tenantId, viewer?.tenantId],
  )
  const coachById = useMemo(() => new Map((people.data ?? []).map((p) => [p.id, p])), [people.data])
  const updatePerson = useUpdatePerson(viewer)

  /** Sessions between the viewer and this person, upcoming first. */
  const shared = useMemo(() => {
    if (!appointments || !profile) return []
    return appointments
      .filter((a) => a.memberId === profile.id || a.providerId === profile.id)
      .filter((a) => isUpcoming(a))
      .slice(0, 4)
  }, [appointments, profile])

  if (!isSelf && isPending) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError || !profile) {
    return (
      <ErrorState
        title="Profile not available"
        description="You may not have access to this person, or they no longer exist."
        onRetry={() => void refetch()}
      />
    )
  }

  const isCoach = profile.role === Role.Coach
  // Coaches see every member in their studio; the assigned coach is flagged, not gated.
  const canSeeProgress = isSelf || viewer?.role !== Role.Member
  const isMyClient = viewer?.role === Role.Coach && profile.assignedCoachId === viewer.id

  return (
    <>
      {!isSelf && (
        <Link
          to="/app/people"
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-chalk-faint transition-colors hover:text-chalk"
        >
          <ArrowLeft className="size-4" />
          All people
        </Link>
      )}

      <header className="flex flex-wrap items-start gap-6 rounded-xl border border-ink-700 bg-ink-850/70 p-6">
        <Avatar name={fullName(profile)} src={profile.avatarUrl} size="xl" ring={isSelf} />

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl">{fullName(profile)}</h1>
            <Badge tone={isCoach ? 'volt' : 'neutral'}>{ROLE_LABELS[profile.role]}</Badge>
            {isSelf && <Badge tone="info">This is you</Badge>}
            {isMyClient && <Badge tone="volt">Your client</Badge>}
            {profile.status !== 'active' && <Badge tone="warn">{profile.status}</Badge>}
          </div>

          <p className="mt-1.5 text-base text-chalk-dim">{profile.title ?? '—'}</p>

          {profile.bio && (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-chalk-dim text-pretty">
              {profile.bio}
            </p>
          )}

          <dl className="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <dt className="sr-only">Email</dt>
              <Mail className="size-4 text-chalk-faint" />
              <dd>
                <a
                  href={`mailto:${profile.email}`}
                  className="text-chalk-dim underline-offset-4 hover:text-volt-400 hover:underline"
                >
                  {profile.email}
                </a>
              </dd>
            </div>
            {profile.phone && (
              <div className="flex items-center gap-2">
                <dt className="sr-only">Phone</dt>
                <Phone className="size-4 text-chalk-faint" />
                <dd>
                  <a
                    href={`tel:${profile.phone.replace(/\s/g, '')}`}
                    className="text-chalk-dim underline-offset-4 hover:text-volt-400 hover:underline"
                  >
                    {profile.phone}
                  </a>
                </dd>
              </div>
            )}
            {profile.location && (
              <div className="flex items-center gap-2">
                <dt className="sr-only">Location</dt>
                <MapPin className="size-4 text-chalk-faint" />
                <dd className="text-chalk-dim">{profile.location}</dd>
              </div>
            )}
            <div className="flex items-center gap-2">
              <dt className="sr-only">Joined</dt>
              <CalendarDays className="size-4 text-chalk-faint" />
              <dd className="text-chalk-dim">
                Joined {format(new Date(profile.joinedAt), 'MMMM yyyy')}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex flex-col gap-2">
          {isCoach && !isSelf && (
            <ButtonLink to={`/app/book/${profile.id}`} size="md">
              Book a session
            </ButtonLink>
          )}
          {canSeeProgress && profile.role === Role.Member && (
            <>
              <ButtonLink
                to={isSelf ? '/app/progress' : `/app/progress/${profile.id}`}
                size="md"
                variant={isSelf ? 'primary' : 'outline'}
              >
                <Activity className="size-4" />
                View progress
              </ButtonLink>
              <ButtonLink to={isSelf ? '/app/nutrition' : `/app/nutrition/${profile.id}`} size="md" variant="outline">
                <Utensils className="size-4" />
                Food diary
              </ButtonLink>
              {!isSelf && viewer?.role !== Role.Member && (
                <ButtonLink to={`/app/nutrition/${profile.id}/plan`} size="md" variant="outline">
                  <ClipboardList className="size-4" />
                  Diet plan
                </ButtonLink>
              )}
            </>
          )}
        </div>
      </header>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_1.2fr] lg:items-start">
        <div className="space-y-5">
          {isCoach && (
            <Card>
              <CardBody>
                <CardTitle>Credentials</CardTitle>
                <ul className="mt-4 space-y-2">
                  {(profile.credentials ?? []).map((credential) => (
                    <li key={credential} className="flex items-center gap-2 text-sm text-chalk-dim">
                      <span className="size-1.5 rounded-full bg-volt-400" aria-hidden />
                      {credential}
                    </li>
                  ))}
                </ul>

                {profile.specialties && profile.specialties.length > 0 && (
                  <>
                    <h4 className="mt-6 text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
                      Specialties
                    </h4>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {profile.specialties.map((specialty) => (
                        <Badge key={specialty}>{specialty}</Badge>
                      ))}
                    </div>
                  </>
                )}

                {(profile.rating !== undefined || profile.sessionsDelivered !== undefined) && (
                  <dl className="mt-6 grid grid-cols-2 gap-4 border-t border-ink-700 pt-5">
                    {profile.rating !== undefined && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
                          Rating
                        </dt>
                        <dd className="mt-1 flex items-center gap-1.5">
                          <Star className="size-4 fill-volt-400 text-volt-400" />
                          <span className="font-display text-2xl leading-none tabular-nums">
                            {profile.rating}
                          </span>
                        </dd>
                      </div>
                    )}
                    {profile.sessionsDelivered !== undefined && (
                      <div>
                        <dt className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
                          Sessions
                        </dt>
                        <dd className="mt-1 font-display text-2xl leading-none tabular-nums">
                          {profile.sessionsDelivered.toLocaleString()}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </CardBody>
            </Card>
          )}

          {profile.role === Role.Member && (
            <Card>
              <CardBody>
                <CardTitle>Coaching</CardTitle>
                {canManage && !isSelf ? (
                  <div className="mt-3">
                    <Select
                      label="Assigned coach"
                      value={profile.assignedCoachId ?? ''}
                      disabled={updatePerson.isPending || people.isPending}
                      onChange={(e) =>
                        updatePerson.mutate({
                          userId: profile.id,
                          patch: { assignedCoachId: e.target.value ? (e.target.value as UserId) : null },
                        })
                      }
                      hint={updatePerson.isPending ? 'Saving…' : updatePerson.isSuccess ? 'Saved. The coach can see this member straight away.' : 'Who is responsible for this member.'}
                      error={updatePerson.isError ? (updatePerson.error as Error).message : undefined}
                    >
                      <option value="">No coach</option>
                      {coaches.map((c) => (
                        <option key={c.id} value={c.id}>
                          {fullName(c)}
                          {c.title ? ` — ${c.title}` : ''}
                        </option>
                      ))}
                    </Select>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-chalk-dim">
                    {profile.assignedCoachId ? (
                      <>
                        Assigned coach:{' '}
                        <Link
                          to={`/app/people/${profile.assignedCoachId}`}
                          className="text-volt-400 underline underline-offset-4"
                        >
                          {coachById.get(profile.assignedCoachId) ? fullName(coachById.get(profile.assignedCoachId)!) : 'view profile'}
                        </Link>
                      </>
                    ) : (
                      'No coach assigned yet.'
                    )}
                  </p>
                )}
                {profile.title && (
                  <p className="mt-4 rounded-lg border border-ink-700 bg-ink-900/60 p-3 text-sm text-chalk-dim">
                    <span className="font-semibold text-chalk">Current goal: </span>
                    {profile.title}
                  </p>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <div>
          <h2 className="mb-4 text-xl">
            {isSelf ? 'Your next sessions' : 'Upcoming sessions together'}
          </h2>
          {shared.length === 0 ? (
            <Card>
              <CardBody>
                <p className="text-sm text-chalk-dim">
                  Nothing scheduled.{' '}
                  {isCoach && !isSelf && (
                    <Link
                      to={`/app/book/${profile.id}`}
                      className="text-volt-400 underline underline-offset-4"
                    >
                      Book a session
                    </Link>
                  )}
                </p>
              </CardBody>
            </Card>
          ) : (
            <div className="space-y-4">
              {shared.map((appointment) => (
                <AppointmentCard
                  key={appointment.id}
                  appointment={appointment}
                  perspective={viewer?.role === Role.Member ? 'member' : 'provider'}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
