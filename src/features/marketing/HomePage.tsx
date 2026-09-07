import { Link } from 'react-router-dom'
import { ArrowRight, ChevronDown, ClipboardCheck, HeartPulse, Microscope } from 'lucide-react'
import { ButtonLink } from '@/shared/ui/Button'
import { VideoHero } from './VideoHero'
import {
  CtaBand,
  FaqList,
  ProofMarquee,
  SectionHeading,
  TestimonialCarousel,
} from './components'
import { PILLARS, PROGRAMS } from './content'

const PROOF = [
  '340+ studios on the platform',
  '1.2M coaching sessions delivered',
  'Physio, dietitian and physician in one place',
  'Zoom · Google Meet · Phone',
  'Bloodwork reviewed by an MD',
  'No lock-in contracts',
]

const APPROACH = [
  {
    icon: ClipboardCheck,
    title: 'Clarity you can use',
    kicker: 'Start with purpose',
    body: 'A movement screen, a conversation about your week, and a written plan. You leave the first session knowing exactly what changes on Monday.',
  },
  {
    icon: Microscope,
    title: 'Expert coaching, real answers',
    kicker: 'No fluff, no guesswork',
    body: 'Your strength coach, dietitian and physio see the same data and talk to each other. You stop being the messenger between three professionals.',
  },
  {
    icon: HeartPulse,
    title: 'No pressure, all progress',
    kicker: 'Optimise life, unlock potential',
    body: 'Retested every twelve weeks against numbers, not vibes. If something is not working we change it — and we tell you why.',
  },
]

const NUMBERS = [
  { value: '12', unit: 'weeks', label: 'to a measurable strength change' },
  { value: '48', unit: 'markers', label: 'in the intake blood panel' },
  { value: '4.9', unit: '/ 5', label: 'average coach rating' },
  { value: '92', unit: '%', label: 'of members still training at 6 months' },
]

export default function HomePage() {
  return (
    <>
      <VideoHero>
        <div className="max-w-3xl">
          <p className="eyebrow animate-[bf-rise_.5s_var(--ease-out-expo)_both]">
            Coaching · Nutrition · Recovery
          </p>

          <h1 className="mt-5 text-[clamp(2.75rem,9vw,6.5rem)] leading-[0.88]">
            <span className="block animate-[bf-rise_.6s_var(--ease-out-expo)_.05s_both]">
              Pain-free
            </span>
            <span className="block animate-[bf-rise_.6s_var(--ease-out-expo)_.15s_both] text-volt-400">
              performance.
            </span>
            <span className="block animate-[bf-rise_.6s_var(--ease-out-expo)_.25s_both]">
              Total health, optimised.
            </span>
          </h1>

          <p className="mt-7 max-w-xl text-lg leading-relaxed text-chalk-dim text-pretty animate-[bf-rise_.6s_var(--ease-out-expo)_.35s_both]">
            Personalised fitness, nutrition and health coaching built around the week you actually
            have — delivered by coaches, dietitians, physios and physicians who share one plan.
          </p>

          <div className="mt-9 flex flex-wrap gap-3 animate-[bf-rise_.6s_var(--ease-out-expo)_.45s_both]">
            <ButtonLink to="/register" size="lg">
              Start your journey
              <ArrowRight className="size-4" />
            </ButtonLink>
            <ButtonLink to="/book" size="lg" variant="outline">
              Book my 15 min call
            </ButtonLink>
          </div>

          <p className="mt-6 text-xs uppercase tracking-[0.2em] text-chalk-faint animate-[bf-rise_.6s_var(--ease-out-expo)_.55s_both]">
            Free consultation · No card required
          </p>
        </div>

        <a
          href="#approach"
          aria-label="Scroll to content"
          className="absolute bottom-8 left-1/2 hidden -translate-x-1/2 text-chalk-faint transition-colors hover:text-volt-400 lg:block"
        >
          <ChevronDown className="size-7 animate-bounce" />
        </a>
      </VideoHero>

      <ProofMarquee items={PROOF} />

      {/* The approach */}
      <section id="approach" className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="The Kedem Life approach"
            title="One team. One plan. One place to see it all."
            lead="Most people are not short of effort — they are short of a coherent plan. We integrate training, nutrition, health and mindset instead of handing you four disconnected opinions."
          />

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {APPROACH.map((item) => (
              <article
                key={item.title}
                className="group rounded-xl border border-ink-700 bg-ink-850/60 p-7 transition-colors hover:border-ink-500"
              >
                <span className="grid size-11 place-items-center rounded-lg bg-volt-400/12 text-volt-400 transition-colors group-hover:bg-volt-400 group-hover:text-ink-950">
                  <item.icon className="size-5.5" />
                </span>
                <p className="mt-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-chalk-faint">
                  {item.kicker}
                </p>
                <h3 className="mt-2 text-2xl">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-chalk-dim text-pretty">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* Pillars */}
      <section className="section border-y border-ink-700 bg-ink-900/40">
        <div className="shell">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
            <SectionHeading
              eyebrow="Integrated pillars"
              title="Four things that decide whether training works"
              lead="Get one wrong and the other three stop paying off. We measure and coach all four from day one."
              className="lg:sticky lg:top-28"
            />

            <ol className="space-y-3">
              {PILLARS.map((pillar, index) => (
                <li
                  key={pillar.key}
                  className="rounded-xl border border-ink-700 bg-ink-850/70 p-6 transition-colors hover:border-volt-400/40"
                >
                  <div className="flex items-start gap-5">
                    <span className="font-display text-3xl leading-none text-volt-400/50 tabular-nums">
                      {String(index + 1).padStart(2, '0')}
                    </span>
                    <div className="min-w-0">
                      <h3 className="text-2xl">{pillar.title}</h3>
                      <p className="mt-1 text-sm font-medium text-volt-400">{pillar.blurb}</p>
                      <p className="mt-3 text-sm leading-relaxed text-chalk-dim text-pretty">
                        {pillar.detail}
                      </p>
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Numbers */}
      <section className="section">
        <div className="shell">
          <dl className="grid gap-px overflow-hidden rounded-xl border border-ink-700 bg-ink-700 sm:grid-cols-2 lg:grid-cols-4">
            {NUMBERS.map((item) => (
              <div key={item.label} className="bg-ink-950 p-7">
                <dt className="sr-only">{item.label}</dt>
                <dd>
                  <span className="font-display text-5xl leading-none text-volt-400 tabular-nums">
                    {item.value}
                  </span>
                  <span className="ml-1 font-display text-xl text-chalk-dim">{item.unit}</span>
                  <p className="mt-3 text-sm text-chalk-dim text-pretty">{item.label}</p>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Programmes */}
      <section className="section border-t border-ink-700">
        <div className="shell">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <SectionHeading
              eyebrow="Coaching"
              title="Transforming underdogs into legends"
              lead="Three routes in. All of them start with a screen and end with numbers you can point at."
            />
            <Link
              to="/coaching"
              className="group inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-volt-400"
            >
              All programmes
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="mt-12 grid gap-5 md:grid-cols-3">
            {PROGRAMS.map((program) => (
              <Link
                key={program.slug}
                to={`/coaching/${program.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border border-ink-700 bg-ink-850/60 p-7 transition-colors hover:border-ink-500"
              >
                <span
                  aria-hidden
                  className="absolute inset-x-0 top-0 h-1 opacity-70 transition-opacity group-hover:opacity-100"
                  style={{ background: program.accent }}
                />
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-chalk-faint">
                  {program.duration}
                </p>
                <h3 className="mt-2 text-2xl">{program.name}</h3>
                <p className="mt-2 text-sm font-medium" style={{ color: program.accent }}>
                  {program.tagline}
                </p>
                <p className="mt-4 flex-1 text-sm leading-relaxed text-chalk-dim text-pretty">
                  {program.summary}
                </p>
                <span className="mt-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-chalk">
                  Explore
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="section border-t border-ink-700 bg-ink-900/40">
        <div className="shell">
          <SectionHeading
            eyebrow="Why Kedem Life"
            title="The results members actually talk about"
          />
          <div className="mt-10">
            <TestimonialCarousel />
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="section">
        <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionHeading
            eyebrow="Questions"
            title="Before you book"
            lead="The things people ask on the first call, answered here so the call can be about you."
            className="lg:sticky lg:top-28"
          />
          <FaqList />
        </div>
      </section>

      <CtaBand />
    </>
  )
}
