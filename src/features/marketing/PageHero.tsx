/**
 * Compact hero for interior marketing pages. Shares the homepage's gradient
 * language so the video hero does not feel like it belongs to another site,
 * but stays short — these pages are read, not admired.
 */
export function PageHero({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow?: string
  title: string
  lead?: string
  children?: React.ReactNode
}) {
  return (
    <section className="relative isolate overflow-hidden border-b border-ink-700">
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(60% 90% at 15% 0%, rgba(182,239,33,0.14), transparent 60%),' +
            'radial-gradient(50% 80% at 85% 10%, rgba(76,201,240,0.12), transparent 60%),' +
            'linear-gradient(180deg, #0c141d, #06090d)',
        }}
      />
      <div className="shell pb-16 pt-32 lg:pb-20 lg:pt-40">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1 className="mt-4 max-w-4xl text-[clamp(2.5rem,6.5vw,4.5rem)] text-balance">{title}</h1>
        {lead && (
          <p className="mt-5 max-w-2xl text-lg leading-relaxed text-chalk-dim text-pretty">{lead}</p>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  )
}
