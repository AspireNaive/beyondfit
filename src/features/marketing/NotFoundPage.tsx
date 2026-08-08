import { ButtonLink } from '@/shared/ui/Button'

const SUGGESTIONS = [
  { to: '/coaching', label: 'Coaching programmes' },
  { to: '/specialists', label: 'Find a specialist' },
  { to: '/shop', label: 'Shop' },
  { to: '/contact', label: 'Contact' },
]

export default function NotFoundPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-5 py-24">
      <div className="max-w-lg text-center">
        <p className="font-display text-[8rem] leading-none text-ink-700">404</p>
        <h1 className="mt-2 text-4xl">This page has left the building</h1>
        <p className="mt-4 text-sm text-chalk-dim text-pretty">
          The link is broken or the page moved. Here is where most people were heading.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/" size="lg">
            Back to home
          </ButtonLink>
          <ButtonLink to="/book" size="lg" variant="outline">
            Book a call
          </ButtonLink>
        </div>

        <ul className="mt-10 flex flex-wrap justify-center gap-x-6 gap-y-2">
          {SUGGESTIONS.map((item) => (
            <li key={item.to}>
              <ButtonLink
                to={item.to}
                variant="ghost"
                size="sm"
                className="text-chalk-faint hover:text-volt-400"
              >
                {item.label}
              </ButtonLink>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
