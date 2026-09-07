import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { Avatar } from '@/shared/ui/Avatar'
import { Badge } from '@/shared/ui/Badge'
import { PageHero } from './PageHero'
import { CtaBand, SectionHeading } from './components'
import { DISCIPLINE_LABELS } from '@/domain/scheduling/model'
import { PROVIDERS } from '@/infrastructure/mock/seed'

const VALUES = [
  {
    title: 'Measure before you prescribe',
    body: 'Nobody gets a programme before they get a screen. Guessing is cheap for us and expensive for you.',
  },
  {
    title: 'One plan, not four opinions',
    body: 'Coach, dietitian, physio and physician work from the same record. You should never have to relay messages between professionals.',
  },
  {
    title: 'Honest about fit',
    body: 'If your problem is medical, or you would be better served by someone else, we say so on the first call.',
  },
  {
    title: 'Built to survive a bad week',
    body: 'A plan that only works when everything goes right is not a plan. Ours is designed to still work at sixty percent.',
  },
]

export default function AboutPage() {
  return (
    <>
      <PageHero
        eyebrow="About"
        title="Transforming underdogs into legends"
        lead="Kedem Life started in one gym with one frustration: people were working hard against plans nobody had bothered to individualise. We built the team — and then the software — to fix that."
      />

      <section className="section">
        <div className="shell grid gap-12 lg:grid-cols-2 lg:items-start">
          <div>
            <SectionHeading eyebrow="Our mission" title="The underdog is the point" />
            <div className="mt-6 space-y-4 text-sm leading-relaxed text-chalk-dim text-pretty">
              <p>
                A dark horse is the competitor nobody rates until the result is in. Most of our
                members arrive as exactly that: people in their thirties, forties and fifties who
                have been told their best years are behind them, or that the pain is just age.
              </p>
              <p>
                It usually is not. It is usually a joint that stopped contributing years ago, a
                nutrition plan built for somebody else's life, and a blood marker nobody checked.
                Fix those three and the picture changes fast.
              </p>
              <p>
                We are not interested in transformation photos. We are interested in whether you can
                still deadlift at sixty, play with your kids without your back going, and get your
                bloodwork back into range — and in proving it with numbers.
              </p>
            </div>
          </div>

          <ul className="grid gap-4 sm:grid-cols-2">
            {VALUES.map((value) => (
              <li key={value.title} className="rounded-xl border border-ink-700 bg-ink-850/60 p-6">
                <h3 className="text-lg">{value.title}</h3>
                <p className="mt-2 text-sm text-chalk-dim text-pretty">{value.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section border-y border-ink-700 bg-ink-900/40">
        <div className="shell">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              eyebrow="The team"
              title="Five disciplines, one record"
              lead="Every practitioner below can see your plan, and each of them owns their own part of it."
            />
            <Link
              to="/specialists"
              className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-volt-400"
            >
              Book with any of them
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {PROVIDERS.map((provider) => (
              <li key={provider.id} className="rounded-xl border border-ink-700 bg-ink-850/60 p-6">
                <div className="flex items-center gap-4">
                  <Avatar name={provider.name} src={provider.avatarUrl} size="lg" />
                  <div className="min-w-0">
                    <h3 className="truncate text-xl">{provider.name}</h3>
                    <p className="truncate text-sm text-chalk-dim">{provider.title}</p>
                  </div>
                </div>

                <Badge tone="volt" className="mt-4">
                  {DISCIPLINE_LABELS[provider.discipline]}
                </Badge>

                <p className="mt-4 text-sm leading-relaxed text-chalk-dim text-pretty">
                  {provider.bio}
                </p>

                <p className="mt-4 text-xs uppercase tracking-wider text-chalk-faint">
                  {provider.credentials.join(' · ')}
                </p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Come and be underestimated"
        lead="Book the call. Worst case you leave with a clearer idea of what is actually going on."
      />
    </>
  )
}
