import { Navigate, useParams } from 'react-router-dom'
import { Check, Dot } from 'lucide-react'
import { ButtonLink } from '@/shared/ui/Button'
import { PageHero } from './PageHero'
import { CtaBand, FaqList, SectionHeading, TestimonialCarousel } from './components'
import { programBySlug } from './content'

const PHASES = [
  {
    label: 'Weeks 1–2',
    title: 'Screen and baseline',
    body: 'Movement screen, strength baseline, food log and — if you are testing — bloodwork drawn. Nothing is prescribed before it is measured.',
  },
  {
    label: 'Weeks 3–8',
    title: 'Build',
    body: 'Progressive loading with weekly adjustments. Technique reviewed on video; nutrition adjusted from adherence, not from the scale alone.',
  },
  {
    label: 'Weeks 9–11',
    title: 'Push',
    body: 'The heaviest block. Volume comes down, intensity goes up, and recovery is monitored rather than assumed.',
  },
  {
    label: 'Week 12',
    title: 'Retest and plan',
    body: 'Same screen, same lifts, same panel. You get the comparison and a written plan for what comes next.',
  },
]

export default function ProgramPage() {
  const { slug } = useParams()
  const program = slug ? programBySlug(slug) : undefined

  // Unknown slug is a content error, not a crash — send them to the index.
  if (!program) return <Navigate to="/coaching" replace />

  return (
    <>
      <PageHero eyebrow={program.duration} title={program.name} lead={program.summary}>
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/register" size="lg">
            Start this programme
          </ButtonLink>
          <ButtonLink to="/book" size="lg" variant="outline">
            Talk to a coach first
          </ButtonLink>
        </div>
      </PageHero>

      <section className="section">
        <div className="shell grid gap-12 lg:grid-cols-[1.1fr_0.9fr]">
          <div>
            <SectionHeading
              eyebrow="What's included"
              title="Everything in the programme"
              lead={program.who}
            />
            <ul className="mt-8 space-y-3">
              {program.includes.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-3 rounded-lg border border-ink-700 bg-ink-850/50 p-4"
                >
                  <Check className="mt-0.5 size-4.5 shrink-0 text-volt-400" />
                  <span className="text-sm text-chalk-dim text-pretty">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-ink-700 bg-ink-850/60 p-7">
            <h3 className="text-2xl">Outcomes</h3>
            <p className="mt-2 text-sm text-chalk-faint">
              Measured at intake and again at the end. No vague promises.
            </p>
            <ul className="mt-6 space-y-4">
              {program.outcomes.map((outcome) => (
                <li key={outcome} className="flex gap-2 text-sm text-chalk-dim">
                  <Dot className="size-5 shrink-0" style={{ color: program.accent }} />
                  <span className="text-pretty">{outcome}</span>
                </li>
              ))}
            </ul>

            <div className="mt-7 border-t border-ink-700 pt-6">
              <ButtonLink to="/shop" variant="secondary" className="w-full">
                See pricing in the shop
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <section className="section border-y border-ink-700 bg-ink-900/40">
        <div className="shell">
          <SectionHeading eyebrow="How it runs" title="Twelve weeks, four phases" />
          <ol className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PHASES.map((phase, index) => (
              <li key={phase.label} className="relative rounded-xl border border-ink-700 bg-ink-850/60 p-6">
                <span
                  aria-hidden
                  className="absolute right-5 top-4 font-display text-5xl leading-none text-ink-700"
                >
                  {index + 1}
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-volt-400">
                  {phase.label}
                </p>
                <h3 className="mt-2 text-xl">{phase.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-chalk-dim text-pretty">{phase.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHeading eyebrow="Members" title="How it went for them" />
          <div className="mt-10">
            <TestimonialCarousel />
          </div>
        </div>
      </section>

      <section className="section border-t border-ink-700">
        <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionHeading eyebrow="Questions" title="Before you start" className="lg:sticky lg:top-28" />
          <FaqList />
        </div>
      </section>

      <CtaBand />
    </>
  )
}
