import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import { PageHero } from './PageHero'
import { CtaBand, SectionHeading } from './components'
import { PILLARS, PROGRAMS } from './content'

export default function CoachingPage() {
  return (
    <>
      <PageHero
        eyebrow="Coaching"
        title="Pick the route in"
        lead="Every programme runs on the same engine — screen, plan, coach, retest. What changes is who it is built for and what we are optimising."
      />

      <section className="section">
        <div className="shell space-y-6">
          {PROGRAMS.map((program, index) => (
            <article
              key={program.slug}
              className="grid gap-8 rounded-2xl border border-ink-700 bg-ink-850/60 p-7 lg:grid-cols-[1.15fr_1fr] lg:p-10"
            >
              <div>
                <div className="flex items-center gap-3">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: program.accent }}
                    aria-hidden
                  />
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-chalk-faint">
                    {String(index + 1).padStart(2, '0')} · {program.duration}
                  </p>
                </div>

                <h2 className="mt-4 text-4xl">{program.name}</h2>
                <p className="mt-2 text-lg font-medium" style={{ color: program.accent }}>
                  {program.tagline}
                </p>
                <p className="mt-5 text-sm leading-relaxed text-chalk-dim text-pretty">
                  {program.summary}
                </p>

                <p className="mt-5 rounded-lg border border-ink-700 bg-ink-900/60 p-4 text-sm text-chalk-dim">
                  <span className="font-semibold text-chalk">Who it is for: </span>
                  {program.who}
                </p>

                <Link
                  to={`/coaching/${program.slug}`}
                  className="group mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-volt-400"
                >
                  Full breakdown
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>

              <div className="rounded-xl border border-ink-700 bg-ink-900/50 p-6">
                <h3 className="text-sm tracking-widest text-chalk">What you walk away with</h3>
                <ul className="mt-4 space-y-3">
                  {program.outcomes.map((outcome) => (
                    <li key={outcome} className="flex gap-3 text-sm text-chalk-dim">
                      <Check className="mt-0.5 size-4 shrink-0 text-volt-400" />
                      <span className="text-pretty">{outcome}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="section border-t border-ink-700 bg-ink-900/40">
        <div className="shell">
          <SectionHeading
            eyebrow="Every programme"
            title="Built on the same four pillars"
            align="center"
          />
          <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {PILLARS.map((pillar) => (
              <div key={pillar.key} className="rounded-xl border border-ink-700 bg-ink-850/60 p-6">
                <h3 className="text-xl">{pillar.title}</h3>
                <p className="mt-2 text-sm text-chalk-dim text-pretty">{pillar.blurb}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <CtaBand
        title="Not sure which one?"
        lead="Fifteen minutes on the phone is usually enough to tell. No pitch — if we are the wrong fit we will say so and point you somewhere better."
        primary={{ label: 'Book my 15 min call', to: '/book' }}
        secondary={{ label: 'Meet the specialists', to: '/specialists' }}
      />
    </>
  )
}
