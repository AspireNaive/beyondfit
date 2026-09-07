import { Logo } from '@/shared/ui/Logo'
import { ButtonLink } from '@/shared/ui/Button'

/**
 * Stands in for sign-in and sign-up until the app opens. The auth routes
 * redirect here while VITE_AUTH_LAUNCHED is unset (see app/router.tsx).
 */
export default function LaunchingSoonPage() {
  return (
    <div className="grid min-h-[70vh] place-items-center px-5 py-24">
      <div className="max-w-lg text-center">
        <Logo className="mx-auto size-40" />
        <p className="eyebrow mt-8">The Kedem Life app</p>
        <h1 className="mt-3 text-5xl sm:text-6xl">Launching soon</h1>
        <p className="mt-4 text-sm text-chalk-dim text-pretty">
          Member sign-in, progress tracking, bookings and the storefront are being finished right
          now. Book a free call today and you'll be first through the door when it opens.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <ButtonLink to="/book" size="lg">
            Book my free 15 min call
          </ButtonLink>
          <ButtonLink to="/" size="lg" variant="outline">
            Back to home
          </ButtonLink>
        </div>
      </div>
    </div>
  )
}
