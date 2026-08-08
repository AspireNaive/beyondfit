import { Check, Cloud, Gauge, Lock, Plug, Users } from 'lucide-react'
import { ButtonLink } from '@/shared/ui/Button'
import { Badge } from '@/shared/ui/Badge'
import { PageHero } from './PageHero'
import { CtaBand, SectionHeading } from './components'

/**
 * The PaaS side of the product: BeyondFit sold to studios rather than to
 * members. Plans mirror `Tenant['plan']` in the identity domain, so what is
 * advertised here and what the app enforces cannot drift.
 */

const CAPABILITIES = [
  {
    icon: Users,
    title: 'Multi-tenant by default',
    body: 'Every studio gets isolated data, its own staff roles and its own branding. One deployment, any number of gyms.',
  },
  {
    icon: Plug,
    title: 'Bring your own stack',
    body: 'REST APIs and webhooks for members, bookings, orders and payments. Zoom, Google Meet and Stripe are wired in already.',
  },
  {
    icon: Gauge,
    title: 'Built for scale',
    body: 'Route-level code splitting, edge-cached static assets and a read-optimised API. Designed for millions of members, not hundreds.',
  },
  {
    icon: Lock,
    title: 'Role-based access',
    body: 'Members, coaches, admins and platform operators each see exactly their slice — enforced server-side on every request.',
  },
  {
    icon: Cloud,
    title: 'No infrastructure to run',
    body: 'Fully managed. Upgrades, backups and scaling are ours; the coaching is yours.',
  },
  {
    icon: Check,
    title: 'Live in a week',
    body: 'Import your member list, invite your coaches, publish your storefront. Most studios are taking bookings within five days.',
  },
]

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$149',
    period: '/ month',
    blurb: 'A single studio finding its feet.',
    seats: 'Up to 100 members',
    features: [
      '2 coach seats',
      '1:1 booking with Zoom, Meet and phone',
      'Progress and activity tracking',
      'Storefront with up to 25 products',
      'Email support',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    price: '$399',
    period: '/ month',
    blurb: 'Multiple coaches and a real storefront.',
    seats: 'Up to 500 members',
    featured: true,
    features: [
      '10 coach seats',
      'Everything in Starter',
      'Specialist consultations (nutrition, physio, medical)',
      'Lab testing workflow and results in-app',
      'Payments and payout reporting',
      'Priority support',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    price: 'Custom',
    period: '',
    blurb: 'Multi-site groups and franchises.',
    seats: 'Unlimited members',
    features: [
      'Unlimited coach seats',
      'Everything in Growth',
      'Multi-site tenancy and cross-site reporting',
      'SSO / SAML and audit logging',
      'Custom domain and white-label branding',
      'Named account manager and 99.9% SLA',
    ],
  },
]

export default function PlatformPage() {
  return (
    <>
      <PageHero
        eyebrow="BeyondFit for studios"
        title="Run your studio on the platform your members already love"
        lead="Everything on this site — booking, progress tracking, consultations, storefront, payments — delivered as a service for your gym, under your brand."
      >
        <div className="flex flex-wrap gap-3">
          <ButtonLink to="/contact" size="lg">
            Book a platform demo
          </ButtonLink>
          <ButtonLink to="/login/admin" size="lg" variant="outline">
            Admin sign in
          </ButtonLink>
        </div>
      </PageHero>

      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Capabilities"
            title="One platform, four audiences"
            lead="Members book and track. Coaches deliver and see their orders. Admins own billing and staffing. Platform operators run the whole estate."
          />
          <div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {CAPABILITIES.map((item) => (
              <article key={item.title} className="rounded-xl border border-ink-700 bg-ink-850/60 p-6">
                <span className="grid size-11 place-items-center rounded-lg bg-volt-400/12 text-volt-400">
                  <item.icon className="size-5.5" />
                </span>
                <h3 className="mt-5 text-xl">{item.title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-chalk-dim text-pretty">{item.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section border-y border-ink-700 bg-ink-900/40">
        <div className="shell">
          <SectionHeading
            eyebrow="Pricing"
            title="Priced per studio, not per seat you might use"
            align="center"
          />

          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {PLANS.map((plan) => (
              <article
                key={plan.id}
                className={
                  plan.featured
                    ? 'relative flex flex-col rounded-2xl border-2 border-volt-400 bg-ink-850 p-7'
                    : 'relative flex flex-col rounded-2xl border border-ink-700 bg-ink-850/60 p-7'
                }
              >
                {plan.featured && (
                  <Badge tone="volt" className="absolute -top-3 left-7">
                    Most studios
                  </Badge>
                )}

                <h3 className="text-2xl">{plan.name}</h3>
                <p className="mt-1 text-sm text-chalk-dim">{plan.blurb}</p>

                <p className="mt-6 flex items-baseline gap-1">
                  <span className="font-display text-5xl leading-none text-chalk">{plan.price}</span>
                  <span className="text-sm text-chalk-faint">{plan.period}</span>
                </p>
                <p className="mt-2 text-xs uppercase tracking-wider text-volt-400">{plan.seats}</p>

                <ul className="mt-7 flex-1 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5 text-sm text-chalk-dim">
                      <Check className="mt-0.5 size-4 shrink-0 text-volt-400" />
                      <span className="text-pretty">{feature}</span>
                    </li>
                  ))}
                </ul>

                <ButtonLink
                  to="/contact"
                  size="md"
                  variant={plan.featured ? 'primary' : 'outline'}
                  className="mt-7 w-full"
                >
                  {plan.price === 'Custom' ? 'Talk to sales' : 'Start free trial'}
                </ButtonLink>
              </article>
            ))}
          </div>

          <p className="mt-8 text-center text-xs text-chalk-faint">
            14-day trial on Starter and Growth. No card required. Cancel in one click.
          </p>
        </div>
      </section>

      <CtaBand
        title="See it with your own data"
        lead="Send us a member export and we will have a working tenant to show you inside two working days."
        primary={{ label: 'Book a demo', to: '/contact' }}
        secondary={{ label: 'See the member experience', to: '/' }}
      />
    </>
  )
}
