import { Link } from 'react-router-dom'
import { Check, Clock, PhoneCall, Video } from 'lucide-react'
import { ButtonLink } from '@/shared/ui/Button'
import { PageHero } from './PageHero'
import { CtaBand, FaqList, SectionHeading, TestimonialCarousel } from './components'

const INCLUDED = [
  'A 45-minute session with a senior coach',
  'Movement screen and postural assessment',
  'Review of your training history and current sticking point',
  'Nutrition snapshot — what is actually worth changing first',
  'Recommendations on testing, if any are warranted',
  'A written summary you keep, whether or not you train with us',
]

const VALUE = [
  {
    title: 'Clarity you can use',
    kicker: 'Start with purpose',
    body: 'You leave knowing the one thing to change first, and why it is that and not the other five.',
  },
  {
    title: 'Expert coaching, real answers',
    kicker: 'No fluff, no guesswork',
    body: 'A coach who has done this for fifteen years, looking at your actual movement rather than a questionnaire.',
  },
  {
    title: 'No pressure, all progress',
    kicker: 'Optimise life, unlock potential',
    body: 'It is a session, not a sales call. Plenty of people take the plan and run it themselves.',
  },
]

export default function BookCallPage() {
  return (
    <>
      <PageHero
        eyebrow="Game plan session"
        title="Book your game plan session"
        lead="One powerful session. A personalised strategy to move forward with clarity, confidence and real results."
      >
        <div className="flex flex-wrap items-center gap-3">
          <ButtonLink to="/register" size="lg">
            Schedule my session
          </ButtonLink>
          <ButtonLink to="/contact" size="lg" variant="outline">
            Ask a question first
          </ButtonLink>
        </div>

        <div className="mt-7 flex flex-wrap gap-x-7 gap-y-3 text-xs uppercase tracking-wider text-chalk-faint">
          <span className="flex items-center gap-2">
            <Clock className="size-4 text-volt-400" />
            45 minutes
          </span>
          <span className="flex items-center gap-2">
            <Video className="size-4 text-volt-400" />
            Zoom or Google Meet
          </span>
          <span className="flex items-center gap-2">
            <PhoneCall className="size-4 text-volt-400" />
            Or a plain phone call
          </span>
        </div>
      </PageHero>

      <section className="section">
        <div className="shell">
          <div className="grid gap-5 md:grid-cols-3">
            {VALUE.map((item) => (
              <article key={item.title} className="rounded-xl border border-ink-700 bg-ink-850/60 p-7">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-chalk-faint">
                  {item.kicker}
                </p>
                <h2 className="mt-2 text-2xl">{item.title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-chalk-dim text-pretty">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section border-y border-ink-700 bg-ink-900/40">
        <div className="shell grid gap-12 lg:grid-cols-[1fr_0.85fr] lg:items-start">
          <div>
            <SectionHeading
              eyebrow="What's included"
              title="Everything in the session"
              lead="Forty-five minutes is enough to find the thing that has been holding you up, if the person on the other end knows what to look for."
            />
            <ul className="mt-8 space-y-3">
              {INCLUDED.map((item) => (
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

          <aside className="rounded-2xl border border-volt-500/30 bg-ink-850/80 p-7 lg:sticky lg:top-28">
            <p className="eyebrow">Game plan session</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-6xl leading-none text-chalk">$149</span>
              <span className="text-sm text-chalk-faint line-through">$249</span>
            </p>
            <p className="mt-3 text-sm text-chalk-dim text-pretty">
              Credited in full against your first month if you go on to join a programme.
            </p>

            <ButtonLink to="/register" size="lg" className="mt-7 w-full">
              Schedule my session
            </ButtonLink>

            <p className="mt-4 text-center text-xs text-chalk-faint">
              Reschedule free up to 24 hours before.
            </p>

            <div className="mt-6 border-t border-ink-700 pt-5 text-sm text-chalk-dim">
              Already a member?{' '}
              <Link to="/app/specialists" className="text-volt-400 underline underline-offset-4">
                Book from your dashboard
              </Link>{' '}
              instead — sessions are included in your plan.
            </div>
          </aside>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHeading eyebrow="After the call" title="What people did next" />
          <div className="mt-10">
            <TestimonialCarousel />
          </div>
        </div>
      </section>

      <section className="section border-t border-ink-700">
        <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionHeading eyebrow="Questions" title="Before you book" className="lg:sticky lg:top-28" />
          <FaqList />
        </div>
      </section>

      <CtaBand
        title="One session. Real clarity."
        lead="Book it, take the plan, and decide afterwards whether you want us to run it with you."
        primary={{ label: 'Schedule my session', to: '/register' }}
        secondary={{ label: 'See the programmes', to: '/coaching' }}
      />
    </>
  )
}
