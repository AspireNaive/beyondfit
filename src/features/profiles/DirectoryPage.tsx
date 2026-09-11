import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, UserPlus, Users } from 'lucide-react'
import { ROLE_LABELS, Role, fullName, type UserProfile } from '@/domain/identity/model'
import { PageHeading } from '@/shared/ui/Card'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { Tabs } from '@/shared/ui/Tabs'
import { Button } from '@/shared/ui/Button'
import { useCurrentUser } from '@/features/auth/store'
import { AddPersonDialog } from './AddPersonDialog'
import { useMappedProfiles } from './hooks'
import { cn } from '@/shared/lib/cn'

const ROLE_TONE: Record<Role, 'volt' | 'info' | 'ember' | 'neutral'> = {
  [Role.Member]: 'neutral',
  [Role.Coach]: 'volt',
  [Role.Admin]: 'info',
  [Role.AppManager]: 'ember',
}

function ProfileCard({ profile, isSelf, isClient }: { profile: UserProfile; isSelf: boolean; isClient?: boolean }) {
  return (
    <Link
      to={isSelf ? '/app/profile' : `/app/people/${profile.id}`}
      className={cn(
        'flex flex-col rounded-xl border bg-ink-850/70 p-5 transition-colors',
        isSelf ? 'border-volt-400/50 hover:border-volt-400' : 'border-ink-700 hover:border-ink-500',
      )}
    >
      <div className="flex items-start gap-4">
        <Avatar name={fullName(profile)} src={profile.avatarUrl} size="lg" ring={isSelf} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-lg leading-tight">{fullName(profile)}</h3>
            {isSelf && <Badge tone="volt">You</Badge>}
            {isClient && <Badge tone="volt">Your client</Badge>}
          </div>
          <p className="mt-0.5 truncate text-sm text-chalk-dim">{profile.title ?? '—'}</p>
          <Badge tone={ROLE_TONE[profile.role]} className="mt-2">
            {ROLE_LABELS[profile.role]}
          </Badge>
        </div>
      </div>

      {profile.specialties && profile.specialties.length > 0 && (
        <p className="mt-4 text-xs uppercase tracking-wider text-chalk-faint">
          {profile.specialties.join(' · ')}
        </p>
      )}

      <dl className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-ink-700 pt-4 text-xs">
        <div className="flex gap-1.5">
          <dt className="text-chalk-faint">Joined</dt>
          <dd className="text-chalk-dim">{new Date(profile.joinedAt).getFullYear()}</dd>
        </div>
        {profile.location && (
          <div className="flex gap-1.5">
            <dt className="sr-only">Location</dt>
            <dd className="text-chalk-dim">{profile.location}</dd>
          </div>
        )}
        {profile.sessionsDelivered !== undefined && (
          <div className="flex gap-1.5">
            <dt className="text-chalk-faint">Sessions</dt>
            <dd className="tabular-nums text-chalk-dim">
              {profile.sessionsDelivered.toLocaleString()}
            </dd>
          </div>
        )}
      </dl>
    </Link>
  )
}

export default function DirectoryPage() {
  const viewer = useCurrentUser()
  const [query, setQuery] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all' | 'mine'>('all')
  const [adding, setAdding] = useState(false)

  const { data, isPending, isError, refetch } = useMappedProfiles(viewer)
  const canManage = viewer?.role === Role.Admin || viewer?.role === Role.AppManager
  const myClients = useMemo(
    () => (viewer?.role === Role.Coach ? (data ?? []).filter((p) => p.assignedCoachId === viewer.id) : []),
    [data, viewer],
  )

  const counts = useMemo(() => {
    const all = data ?? []
    return {
      all: all.length,
      [Role.Member]: all.filter((p) => p.role === Role.Member).length,
      [Role.Coach]: all.filter((p) => p.role === Role.Coach).length,
      [Role.Admin]: all.filter((p) => p.role === Role.Admin).length,
      [Role.AppManager]: all.filter((p) => p.role === Role.AppManager).length,
    }
  }, [data])

  const visible = useMemo(() => {
    let rows = data ?? []
    if (roleFilter === 'mine') rows = rows.filter((p) => p.assignedCoachId === viewer?.id)
    else if (roleFilter !== 'all') rows = rows.filter((p) => p.role === roleFilter)

    const q = query.trim().toLowerCase()
    if (q) {
      rows = rows.filter(
        (p) =>
          fullName(p).toLowerCase().includes(q) ||
          p.email.toLowerCase().includes(q) ||
          p.title?.toLowerCase().includes(q) ||
          p.specialties?.some((s) => s.toLowerCase().includes(q)),
      )
    }

    // Self always sorts first — the brief calls for "mapped profiles and self".
    return [...rows].sort((a, b) => {
      if (a.id === viewer?.id) return -1
      if (b.id === viewer?.id) return 1
      return fullName(a).localeCompare(fullName(b))
    })
  }, [data, roleFilter, query, viewer?.id])

  const tabs = [
    { id: 'all' as const, label: 'Everyone', count: counts.all },
    ...(viewer?.role === Role.Coach ? [{ id: 'mine' as const, label: 'My clients', count: myClients.length }] : []),
    ...(
      [Role.Member, Role.Coach, Role.Admin, Role.AppManager] as const
    )
      .filter((role) => counts[role] > 0)
      .map((role) => ({ id: role, label: `${ROLE_LABELS[role]}s`, count: counts[role] })),
  ]

  const subtitle =
    viewer?.role === Role.Member
      ? 'Your coach and every specialist you can book with — plus your own profile.'
      : viewer?.role === Role.Coach
        ? 'Every member in your studio — your own clients are flagged — plus your fellow coaches.'
        : 'Everyone in your studio. Add members and coaches, and map members to coaches from their profile.'

  return (
    <>
      <PageHeading
        title="People"
        subtitle={subtitle}
        actions={
          canManage ? (
            <Button size="sm" onClick={() => setAdding(true)}>
              <UserPlus className="size-4" /> Add a person
            </Button>
          ) : undefined
        }
      />
      {canManage && (
        <AddPersonDialog open={adding} onClose={() => setAdding(false)} coaches={(data ?? []).filter((p) => p.role === Role.Coach)} />
      )}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <Tabs value={roleFilter} onChange={setRoleFilter} items={tabs} className="max-w-full" />

        <div className="relative shrink-0">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-chalk-faint" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people"
            aria-label="Search people"
            className="h-11 w-full rounded-lg border border-ink-600 bg-ink-900/80 pl-10 pr-3.5 text-sm outline-none transition-colors placeholder:text-chalk-faint focus:border-volt-400 sm:w-64"
          />
        </div>
      </div>

      {isPending ? (
        <SkeletonList rows={6} />
      ) : isError ? (
        <ErrorState description="Couldn't load the directory." onRetry={() => void refetch()} />
      ) : visible.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody matches that"
          description="Try a different search or filter."
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {visible.map((profile) => (
            <ProfileCard
              key={profile.id}
              profile={profile}
              isSelf={profile.id === viewer?.id}
              isClient={viewer?.role === Role.Coach && profile.assignedCoachId === viewer.id}
            />
          ))}
        </div>
      )}
    </>
  )
}
