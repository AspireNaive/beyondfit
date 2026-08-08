import { useState } from 'react'
import { Mail, MapPin, MessageSquare, Phone } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input, Select, Textarea } from '@/shared/ui/Field'
import { PageHero } from './PageHero'
import { FaqList, SectionHeading } from './components'

const CHANNELS = [
  { icon: Phone, label: 'Call the studio', value: '+1 (845) 555-0142', href: 'tel:+18455550142' },
  { icon: Mail, label: 'Email', value: 'hello@beyondfit.app', href: 'mailto:hello@beyondfit.app' },
  { icon: MapPin, label: 'Post', value: 'P.O. Box 174, Pine Bush, NY 12566' },
  { icon: MessageSquare, label: 'Members', value: 'Message your coach in the app', href: '/app' },
]

export default function ContactPage() {
  const [sent, setSent] = useState(false)
  const [pending, setPending] = useState(false)

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    // Stands in for POST /api/contact until the .NET endpoint exists.
    window.setTimeout(() => {
      setPending(false)
      setSent(true)
    }, 700)
  }

  return (
    <>
      <PageHero
        eyebrow="Contact"
        title="Talk to a human"
        lead="Questions about a programme, the testing, or running BeyondFit at your own studio — this reaches the team directly, not a ticket queue."
      />

      <section className="section">
        <div className="shell grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div>
            <SectionHeading eyebrow="Send a message" title="We reply within one working day" />

            {sent ? (
              <div className="mt-8 rounded-xl border border-volt-500/35 bg-volt-500/10 p-8">
                <h3 className="text-2xl text-volt-400">Message sent</h3>
                <p className="mt-3 text-sm text-chalk-dim">
                  Thanks — we have it. If it is urgent, ring the studio on{' '}
                  <a href="tel:+18455550142" className="text-volt-400 underline underline-offset-4">
                    +1 (845) 555-0142
                  </a>
                  .
                </p>
                <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>
                  Send another
                </Button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="mt-8 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input label="First name" name="firstName" autoComplete="given-name" required />
                  <Input label="Last name" name="lastName" autoComplete="family-name" required />
                </div>
                <Input label="Email" name="email" type="email" autoComplete="email" required />
                <Input label="Phone" name="phone" type="tel" autoComplete="tel" hint="Optional" />
                <Select label="What is this about?" name="topic" defaultValue="coaching" required>
                  <option value="coaching">Coaching programmes</option>
                  <option value="testing">Root cause testing</option>
                  <option value="specialists">Booking a specialist</option>
                  <option value="orders">An order or payment</option>
                  <option value="platform">Running BeyondFit at my studio</option>
                  <option value="other">Something else</option>
                </Select>
                <Textarea
                  label="Message"
                  name="message"
                  required
                  placeholder="Tell us what is going on and what you are trying to achieve."
                />
                <Button type="submit" size="lg" loading={pending} className="w-full sm:w-auto">
                  Send message
                </Button>
              </form>
            )}
          </div>

          <div className="space-y-5">
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              {CHANNELS.map((channel) => {
                const body = (
                  <>
                    <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-volt-400/12 text-volt-400">
                      <channel.icon className="size-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
                        {channel.label}
                      </span>
                      <span className="block truncate text-sm text-chalk">{channel.value}</span>
                    </span>
                  </>
                )
                return (
                  <li key={channel.label}>
                    {channel.href ? (
                      <a
                        href={channel.href}
                        className="flex items-center gap-4 rounded-xl border border-ink-700 bg-ink-850/60 p-5 transition-colors hover:border-ink-500"
                      >
                        {body}
                      </a>
                    ) : (
                      <div className="flex items-center gap-4 rounded-xl border border-ink-700 bg-ink-850/60 p-5">
                        {body}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>

            <div className="rounded-xl border border-ink-700 bg-ink-850/60 p-6">
              <h3 className="text-lg">Studio hours</h3>
              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ['Monday – Thursday', '05:30 – 20:00'],
                  ['Friday', '05:30 – 18:00'],
                  ['Saturday', '07:00 – 13:00'],
                  ['Sunday', 'Closed'],
                ].map(([day, hours]) => (
                  <div key={day} className="flex justify-between gap-4">
                    <dt className="text-chalk-dim">{day}</dt>
                    <dd className="tabular-nums text-chalk">{hours}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
      </section>

      <section className="section border-t border-ink-700 bg-ink-900/40">
        <div className="shell grid gap-12 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <SectionHeading
            eyebrow="Questions"
            title="Maybe it's answered already"
            className="lg:sticky lg:top-28"
          />
          <FaqList />
        </div>
      </section>
    </>
  )
}
