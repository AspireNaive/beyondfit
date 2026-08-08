import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Minus, Plus, Star } from 'lucide-react'
import { ButtonLink } from '@/shared/ui/Button'
import { cn } from '@/shared/lib/cn'
import { FAQS, TESTIMONIALS, type Faq, type Testimonial } from './content'

export function SectionHeading({
  eyebrow,
  title,
  lead,
  align = 'left',
  className,
}: {
  eyebrow?: string
  title: React.ReactNode
  lead?: string
  align?: 'left' | 'center'
  className?: string
}) {
  return (
    <div
      className={cn(
        'max-w-2xl',
        align === 'center' && 'mx-auto text-center',
        className,
      )}
    >
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="mt-3 text-4xl text-balance sm:text-5xl">{title}</h2>
      {lead && <p className="mt-4 text-base leading-relaxed text-chalk-dim text-pretty">{lead}</p>}
    </div>
  )
}

export function Stars({ rating, className }: { rating: number; className?: string }) {
  return (
    <div className={cn('flex items-center gap-0.5', className)} aria-label={`${rating} out of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          aria-hidden
          className={cn(
            'size-4',
            i < Math.round(rating) ? 'fill-volt-400 text-volt-400' : 'text-ink-600',
          )}
        />
      ))}
    </div>
  )
}

function TestimonialCard({ item }: { item: Testimonial }) {
  return (
    <figure className="flex h-full min-w-[19rem] max-w-sm shrink-0 snap-start flex-col rounded-xl border border-ink-700 bg-ink-850/80 p-6 sm:min-w-[22rem]">
      <Stars rating={item.rating} />
      <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-chalk-dim text-pretty">
        “{item.quote}”
      </blockquote>
      <figcaption className="mt-5 border-t border-ink-700 pt-4">
        <p className="text-sm font-semibold text-chalk">{item.name}</p>
        <p className="text-xs text-chalk-faint">{item.role}</p>
      </figcaption>
    </figure>
  )
}

/**
 * Scroll-snap carousel rather than a JS slider: swipe works natively on touch,
 * the arrows just nudge scrollLeft, and every card stays in the DOM for search
 * engines and screen readers.
 */
export function TestimonialCarousel({ items = TESTIMONIALS }: { items?: readonly Testimonial[] }) {
  const trackRef = useRef<HTMLDivElement>(null)

  const nudge = (direction: 1 | -1) => {
    const track = trackRef.current
    if (!track) return
    track.scrollBy({ left: direction * (track.clientWidth * 0.8), behavior: 'smooth' })
  }

  return (
    <div className="relative">
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-5 overflow-x-auto pb-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {items.map((item) => (
          <TestimonialCard key={item.name} item={item} />
        ))}
      </div>

      <div className="mt-2 flex justify-end gap-2">
        <button
          type="button"
          onClick={() => nudge(-1)}
          aria-label="Previous testimonials"
          className="grid size-10 place-items-center rounded-full border border-ink-600 text-chalk-dim transition-colors hover:border-volt-400 hover:text-volt-400"
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          type="button"
          onClick={() => nudge(1)}
          aria-label="More testimonials"
          className="grid size-10 place-items-center rounded-full border border-ink-600 text-chalk-dim transition-colors hover:border-volt-400 hover:text-volt-400"
        >
          <ChevronRight className="size-5" />
        </button>
      </div>
    </div>
  )
}

function FaqRow({ item, index }: { item: Faq; index: number }) {
  const [open, setOpen] = useState(index === 0)
  const panelId = `faq-panel-${index}`

  return (
    <div className="border-b border-ink-700">
      <h3>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={panelId}
          className="flex w-full items-center justify-between gap-6 py-5 text-left"
        >
          <span className="font-display text-lg tracking-wide text-chalk sm:text-xl">
            {item.question}
          </span>
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-ink-600 text-chalk-dim">
            {open ? <Minus className="size-4" /> : <Plus className="size-4" />}
          </span>
        </button>
      </h3>
      {/* Kept mounted and hidden so browser find-in-page still hits the answer. */}
      <div id={panelId} hidden={!open} className="pb-6 pr-14">
        <p className="text-sm leading-relaxed text-chalk-dim text-pretty">{item.answer}</p>
      </div>
    </div>
  )
}

export function FaqList({ items = FAQS }: { items?: readonly Faq[] }) {
  return (
    <div className="border-t border-ink-700">
      {items.map((item, index) => (
        <FaqRow key={item.question} item={item} index={index} />
      ))}
    </div>
  )
}

export function CtaBand({
  title = 'Book your game plan session',
  lead = 'One session. A personalised strategy, a movement screen and a written summary you keep — whether or not you go on to train with us.',
  primary = { label: 'Book my 15 min call', to: '/book' },
  secondary = { label: 'See the programmes', to: '/coaching' },
}: {
  title?: string
  lead?: string
  primary?: { label: string; to: string }
  secondary?: { label: string; to: string }
}) {
  return (
    <section className="section">
      <div className="shell">
        <div className="relative overflow-hidden rounded-2xl border border-ink-700 px-6 py-14 text-center sm:px-12">
          <div
            aria-hidden
            className="absolute inset-0 -z-10"
            style={{
              background:
                'radial-gradient(70% 120% at 50% 0%, rgba(182,239,33,0.18), transparent 65%), linear-gradient(180deg, #101a24, #080c11)',
            }}
          />
          <h2 className="mx-auto max-w-2xl text-4xl text-balance sm:text-5xl">{title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-base text-chalk-dim text-pretty">{lead}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <ButtonLink to={primary.to} size="lg">
              {primary.label}
            </ButtonLink>
            <ButtonLink to={secondary.to} size="lg" variant="outline">
              {secondary.label}
            </ButtonLink>
          </div>
        </div>
      </div>
    </section>
  )
}

/** Infinite marquee of proof points. Duplicated once and translated -50%, so
 *  the loop is seamless without measuring anything at runtime. */
export function ProofMarquee({ items }: { items: readonly string[] }) {
  const doubled = [...items, ...items]
  return (
    <div className="border-y border-ink-700 bg-ink-900/60 py-4">
      <div
        className="flex overflow-hidden"
        style={{ maskImage: 'linear-gradient(90deg, transparent, #000 8%, #000 92%, transparent)' }}
      >
        <div className="flex shrink-0 animate-[bf-marquee_38s_linear_infinite] items-center gap-10 pr-10">
          {doubled.map((item, i) => (
            <span
              key={`${item}-${i}`}
              className="flex shrink-0 items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-chalk-faint"
            >
              <span className="size-1.5 rounded-full bg-volt-400" aria-hidden />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
