import { useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Phone, Search, Star, Video } from 'lucide-react'
import {
  DISCIPLINE_BLURB,
  DISCIPLINE_LABELS,
  Discipline,
  MeetingChannel,
  type Provider,
} from '@/domain/scheduling/model'
import { formatMoney } from '@/domain/shared/types'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { EmptyState, ErrorState, SkeletonList } from '@/shared/ui/Feedback'
import { PageHeading } from '@/shared/ui/Card'
import { PageHero } from '@/features/marketing/PageHero'
import { CtaBand } from '@/features/marketing/components'
import { useCurrentUser } from '@/features/auth/store'
import { useProviders } from './hooks'
import { cn } from '@/shared/lib/cn'

const FILTERS = [
  { id: 'all', label: 'Everyone' },
  ...Object.values(Discipline).map((d) => ({ id: d, label: DISCIPLINE_LABELS[d] })),
] as const

function ChannelIcons({ channels }: { channels: readonly MeetingChannel[] }) {
  return (
    <div className="flex items-center gap-2 text-chalk-faint">
      {channels.includes(MeetingChannel.Zoom) || channels.includes(MeetingChannel.GoogleMeet) ? (
        <span className="flex items-center gap-1 text-xs">
          <Video className="size-3.5" />
          Video
        </span>
      ) : null}
      {channels.includes(MeetingChannel.Phone) && (
        <span className="flex items-center gap-1 text-xs">
          <Phone className="size-3.5" />
          Phone
        </span>
      )}
      {channels.includes(MeetingChannel.InPerson) && (
        <span className="text-xs">In person</span>
      )}
    </div>
  )
}

function ProviderCard({ provider, bookTo }: { provider: Provider; bookTo: string }) {
  return (
    <article className="flex flex-col rounded-xl border border-ink-700 bg-ink-850/70 p-6 transition-colors hover:border-ink-500">
      <div className="flex items-start gap-4">
        <Avatar name={provider.name} src={provider.avatarUrl} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-xl">{provider.name}</h3>
          <p className="truncate text-sm text-chalk-dim">{provider.title}</p>
          <div className="mt-1.5 flex items-center gap-1.5">
            <Star className="size-3.5 fill-volt-400 text-volt-400" />
            <span className="text-xs font-semibold tabular-nums text-chalk">{provider.rating}</span>
            <span className="text-xs text-chalk-faint">({provider.reviewCount})</span>
          </div>
        </div>
      </div>

      <Badge tone="volt" className="mt-4 self-start">
        {DISCIPLINE_LABELS[provider.discipline]}
      </Badge>

      <p className="mt-4 flex-1 text-sm leading-relaxed text-chalk-dim text-pretty">{provider.bio}</p>

      <p className="mt-4 text-xs uppercase tracking-wider text-chalk-faint">
        {provider.credentials.join(' · ')}
      </p>

      <div className="mt-5 flex items-end justify-between gap-3 border-t border-ink-700 pt-4">
        <div>
          <p className="font-display text-2xl leading-none text-chalk">
            {formatMoney(provider.sessionRate)}
          </p>
          <p className="mt-1 text-xs text-chalk-faint">per session</p>
        </div>
        <ChannelIcons channels={provider.channels} />
      </div>

      <ButtonLink to={bookTo} size="md" className="mt-4 w-full">
        Book a session
      </ButtonLink>
    </article>
  )
}

export default function SpecialistsPage() {
  const location = useLocation()
  const user = useCurrentUser()
  const inApp = location.pathname.startsWith('/app')

  const [discipline, setDiscipline] = useState<string>('all')
  const [query, setQuery] = useState('')

  const { data, isPending, isError, refetch } = useProviders(
    discipline === 'all' ? {} : { discipline: discipline as Discipline },
  )

  const providers = useMemo(() => {
    if (!data) return []
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.title.toLowerCase().includes(q) ||
        p.credentials.some((c) => c.toLowerCase().includes(q)),
    )
  }, [data, query])

  const bookTarget = (provider: Provider) =>
    user ? `/app/book/${provider.id}` : `/register?next=/app/book/${provider.id}`

  const controls = (
    <>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-chalk-faint" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name or credential"
          aria-label="Search specialists"
          className="h-11 w-full rounded-lg border border-ink-600 bg-ink-900/80 pl-10 pr-3.5 text-sm outline-none transition-colors placeholder:text-chalk-faint focus:border-volt-400 sm:w-72"
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setDiscipline(filter.id)}
            aria-pressed={discipline === filter.id}
            className={cn(
              'rounded-full border px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors',
              discipline === filter.id
                ? 'border-volt-400 bg-volt-400 text-ink-950'
                : 'border-ink-600 text-chalk-dim hover:border-ink-500 hover:text-chalk',
            )}
          >
            {filter.label}
          </button>
        ))}
      </div>
    </>
  )

  const grid = isPending ? (
    <SkeletonList rows={3} className="mt-8" />
  ) : isError ? (
    <ErrorState
      description="We couldn't load the specialist roster."
      onRetry={() => void refetch()}
    />
  ) : providers.length === 0 ? (
    <EmptyState
      icon={Search}
      title="No specialists match that"
      description="Try a different discipline, or clear the search."
    />
  ) : (
    <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
      {providers.map((provider) => (
        <ProviderCard key={provider.id} provider={provider} bookTo={bookTarget(provider)} />
      ))}
    </div>
  )

  // Inside the app this is a normal page; on the public site it gets the hero.
  if (inApp) {
    return (
      <>
        <PageHeading
          title="Find a specialist"
          subtitle="Book a one-to-one with a coach, dietitian, physiotherapist, physician or mental performance coach. Sessions run on Zoom, Google Meet, phone or in person."
        />
        <div className="mb-8 flex flex-col gap-4">{controls}</div>
        {grid}
      </>
    )
  }

  return (
    <>
      <PageHero
        eyebrow="Consultations"
        title="Book the right expert, not just any expert"
        lead="Five disciplines under one roof, all working from the same record. Choose who you need and pick a time that fits."
      />

      <section className="section">
        <div className="shell">
          <div className="mb-8 flex flex-col gap-4">{controls}</div>
          {grid}
        </div>
      </section>

      <section className="section border-t border-ink-700 bg-ink-900/40">
        <div className="shell">
          <h2 className="text-4xl">What each discipline covers</h2>
          <dl className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Object.values(Discipline).map((d) => (
              <div key={d} className="rounded-xl border border-ink-700 bg-ink-850/60 p-6">
                <dt className="text-xl">
                  <span className="font-display uppercase tracking-wide">
                    {DISCIPLINE_LABELS[d]}
                  </span>
                </dt>
                <dd className="mt-2 text-sm text-chalk-dim text-pretty">{DISCIPLINE_BLURB[d]}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-8 text-sm text-chalk-dim">
            Not sure who you need?{' '}
            <Link to="/book" className="text-volt-400 underline underline-offset-4">
              Book the free 15-minute call
            </Link>{' '}
            and we will point you at the right person.
          </p>
        </div>
      </section>

      <CtaBand
        title="One record, every specialist"
        lead="Your coach, dietitian and physio all see the same plan and the same numbers. No repeating your history three times."
        primary={{ label: 'Create an account', to: '/register' }}
        secondary={{ label: 'Book a 15 min call', to: '/book' }}
      />
    </>
  )
}
