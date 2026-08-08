import { Activity, Droplets, FlaskConical, HeartPulse, Moon, Zap } from 'lucide-react'
import { ButtonLink } from '@/shared/ui/Button'
import { PageHero } from './PageHero'
import { CtaBand, SectionHeading } from './components'

const PANELS = [
  {
    icon: Droplets,
    title: 'Metabolic & lipid',
    markers: 'Glucose, HbA1c, insulin, full lipid panel, ApoB',
    why: 'Tells us whether the plan needs to prioritise fat loss, or whether your numbers are already fine and the goal is performance.',
  },
  {
    icon: Zap,
    title: 'Thyroid & hormones',
    markers: 'TSH, free T3/T4, testosterone, oestradiol, cortisol',
    why: 'Explains the fatigue and stalled progress that training changes alone will not fix.',
  },
  {
    icon: HeartPulse,
    title: 'Inflammation & iron',
    markers: 'hs-CRP, ferritin, transferrin saturation, B12, vitamin D',
    why: 'Low iron is the single most common reason a motivated person feels flat in every session.',
  },
  {
    icon: FlaskConical,
    title: 'Gut health',
    markers: 'Microbiome diversity, calprotectin, zonulin (optional add-on)',
    why: 'For the bloating and digestive complaints that make people abandon otherwise sound nutrition.',
  },
  {
    icon: Activity,
    title: 'Movement screen',
    markers: 'FMS-based screen, single-leg control, overhead position',
    why: 'Finds the restriction that is about to become an injury, before it does.',
  },
  {
    icon: Moon,
    title: 'Sleep & recovery',
    markers: 'HRV trend, resting heart rate, sleep staging (wearable)',
    why: 'Decides how hard we can push in a given week without digging a hole.',
  },
]

const STEPS = [
  { step: '01', title: 'Order online', body: 'Pick the panel in the shop. A requisition is issued the same day.' },
  { step: '02', title: 'Get drawn locally', body: 'Any partner lab near you, or a mobile phlebotomist at home.' },
  { step: '03', title: 'Results in 5–7 days', body: 'Loaded straight into your member profile, not emailed as a PDF.' },
  { step: '04', title: 'Review with a physician', body: 'A 45-minute call that explains what moved, what matters and what changes.' },
]

export default function TestingPage() {
  return (
    <>
      <PageHero
        eyebrow="Root cause testing"
        title="Stop guessing. Measure."
        lead="Forty-eight markers, a movement screen and a physician who reads them back to you in plain language. Tested at intake and again at twelve weeks, so progress is a fact rather than an opinion."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/shop/full-panel-bloodwork" size="lg">
            Order the full panel
          </ButtonLink>
          <ButtonLink to="/book" size="lg" variant="outline">
            Ask a question first
          </ButtonLink>
        </div>
      </PageHero>

      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="What we test"
            title="Six windows into why training is or is not working"
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {PANELS.map((panel) => (
              <article key={panel.title} className="rounded-xl border border-ink-700 bg-ink-850/60 p-6">
                <span className="grid size-11 place-items-center rounded-lg bg-volt-400/12 text-volt-400">
                  <panel.icon className="size-5.5" />
                </span>
                <h3 className="mt-5 text-xl">{panel.title}</h3>
                <p className="mt-2 text-xs uppercase tracking-wider text-chalk-faint text-pretty">
                  {panel.markers}
                </p>
                <p className="mt-4 text-sm leading-relaxed text-chalk-dim text-pretty">{panel.why}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section border-y border-ink-700 bg-ink-900/40">
        <div className="shell">
          <SectionHeading eyebrow="How it works" title="Four steps, about a week" />
          <ol className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((item) => (
              <li key={item.step} className="rounded-xl border border-ink-700 bg-ink-850/60 p-6">
                <span className="font-display text-4xl leading-none text-volt-400/60 tabular-nums">
                  {item.step}
                </span>
                <h3 className="mt-4 text-xl">{item.title}</h3>
                <p className="mt-2 text-sm text-chalk-dim text-pretty">{item.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand
        title="Test, don't guess"
        lead="Every panel includes the physician review call. If the results are unremarkable we will tell you that too — and get straight back to training."
        primary={{ label: 'Order a panel', to: '/shop' }}
        secondary={{ label: 'Book a 15 min call', to: '/book' }}
      />
    </>
  )
}
