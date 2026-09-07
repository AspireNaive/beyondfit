import { Link, Outlet } from 'react-router-dom'
import { ArrowLeft, ShieldCheck } from 'lucide-react'
import { Logo } from '@/shared/ui/Logo'

const PROOF = [
  'Used by 340+ studios',
  '1.2M sessions delivered',
  'SOC 2 Type II',
] as const

/**
 * Split layout: the form on the left, brand reassurance on the right. The right
 * panel is decorative and drops out below `lg` so the form is above the fold on
 * a phone, which is where most member sign-ins happen.
 */
export function AuthLayout() {
  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-2">
      <div className="flex min-h-dvh flex-col px-5 py-8 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to="/" aria-label="Kedem Life home">
            <Logo />
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-faint transition-colors hover:text-chalk"
          >
            <ArrowLeft className="size-3.5" />
            Back to site
          </Link>
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>

        <p className="text-center text-xs text-chalk-faint">
          © {new Date().getFullYear()} Kedem Life · Product developed by AspireNaive ·{' '}
          <Link to="/contact" className="underline underline-offset-4 hover:text-chalk-dim">
            Need help?
          </Link>
        </p>
      </div>

      <div className="relative hidden overflow-hidden border-l border-ink-700 bg-ink-900 lg:block">
        <div
          aria-hidden
          className="absolute inset-0 opacity-70"
          style={{
            background:
              'radial-gradient(80% 60% at 20% 10%, rgba(182,239,33,0.16), transparent 60%),' +
              'radial-gradient(70% 70% at 90% 90%, rgba(76,201,240,0.14), transparent 60%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              'linear-gradient(var(--color-chalk) 1px, transparent 1px), linear-gradient(90deg, var(--color-chalk) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
          }}
        />

        <div className="relative flex h-full flex-col justify-end p-12">
          <blockquote className="max-w-md">
            <p className="font-display text-4xl leading-[0.95] text-chalk">
              “I stopped guessing. Six months later I'm squatting pain-free and my bloodwork is
              back in range.”
            </p>
            <footer className="mt-5 text-sm text-chalk-dim">
              Rebecca V. — member since 2024
            </footer>
          </blockquote>

          <div className="mt-10 flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-ink-700 pt-6">
            {PROOF.map((item) => (
              <span key={item} className="flex items-center gap-2 text-xs text-chalk-faint">
                <ShieldCheck className="size-4 text-volt-400" />
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
