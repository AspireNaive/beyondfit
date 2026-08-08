import { PageHero } from './PageHero'
import { CtaBand, SectionHeading, Stars, TestimonialCarousel } from './components'
import { RESULT_STORIES, TESTIMONIALS } from './content'

export default function ResultsPage() {
  return (
    <>
      <PageHero
        eyebrow="Results"
        title="Numbers, not before-and-afters"
        lead="Every member is retested against the same screen and the same lifts they started with. These are the comparisons, with the context that makes them mean something."
      />

      <section className="section">
        <div className="shell space-y-6">
          {RESULT_STORIES.map((story) => (
            <article
              key={story.name}
              className="grid gap-8 rounded-2xl border border-ink-700 bg-ink-850/60 p-7 lg:grid-cols-[1.2fr_1fr] lg:p-10"
            >
              <div>
                <p className="eyebrow">{story.name}</p>
                <h2 className="mt-3 text-3xl sm:text-4xl text-balance">{story.headline}</h2>
                <p className="mt-4 text-sm leading-relaxed text-chalk-dim text-pretty">
                  {story.detail}
                </p>
              </div>

              <dl className="grid grid-cols-3 gap-px self-start overflow-hidden rounded-xl border border-ink-700 bg-ink-700">
                {story.stats.map((stat) => (
                  <div key={stat.label} className="bg-ink-900 p-4 text-center">
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-chalk-faint">
                      {stat.label}
                    </dt>
                    <dd className="mt-2 font-display text-2xl leading-none text-volt-400 tabular-nums">
                      {stat.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          ))}
        </div>
      </section>

      <section className="section border-y border-ink-700 bg-ink-900/40">
        <div className="shell">
          <SectionHeading eyebrow="In their words" title="What members say" />
          <div className="mt-10">
            <TestimonialCarousel />
          </div>
        </div>
      </section>

      <section className="section">
        <div className="shell">
          <SectionHeading
            eyebrow="Every review"
            title="Unedited, including the four-star ones"
            align="center"
          />
          <ul className="mt-12 columns-1 gap-5 md:columns-2 lg:columns-3">
            {TESTIMONIALS.map((item) => (
              <li
                key={item.name}
                className="mb-5 break-inside-avoid rounded-xl border border-ink-700 bg-ink-850/60 p-6"
              >
                <Stars rating={item.rating} />
                <p className="mt-3 text-sm leading-relaxed text-chalk-dim text-pretty">
                  “{item.quote}”
                </p>
                <p className="mt-4 text-sm font-semibold text-chalk">{item.name}</p>
                <p className="text-xs text-chalk-faint">{item.role}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <CtaBand
        title="Your turn"
        lead="Start with the fifteen-minute call. We will tell you honestly whether we can help and what it would take."
      />
    </>
  )
}
