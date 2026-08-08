import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { AlertCircle, Eye, EyeOff, ShieldCheck, Stethoscope, UserRound } from 'lucide-react'
import { Role } from '@/domain/identity/model'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from '@/infrastructure/mock/seed'
import { isMockMode } from '@/infrastructure/container'
import { homeRouteFor, useAuthStore } from './store'
import { cn } from '@/shared/lib/cn'

export type LoginVariant = 'general' | 'membership' | 'instructor' | 'admin'

/**
 * One component, four portals.
 *
 * The portal is sent to the server with the credentials — a member signing in
 * at /login/admin is refused even though the password is right. Keeping this in
 * one component means the four screens cannot drift apart in validation or
 * error handling, which is exactly how auth bugs get shipped.
 */

const COPY: Record<
  LoginVariant,
  {
    eyebrow: string
    title: string
    lead: string
    icon: React.ComponentType<{ className?: string }>
    cta: string
    footer?: React.ReactNode
  }
> = {
  general: {
    eyebrow: 'App login',
    title: 'Welcome back',
    lead: 'Sign in to your training plan, your progress and your next session.',
    icon: UserRound,
    cta: 'Sign in',
  },
  membership: {
    eyebrow: 'Membership',
    title: 'Member sign in',
    lead: 'Your programme, check-ins, bookings and orders — all in one place.',
    icon: UserRound,
    cta: 'Sign in to my membership',
  },
  instructor: {
    eyebrow: 'Instructors',
    title: 'Coach sign in',
    lead: "Your calendar, your clients' progress and the orders for your programmes.",
    icon: Stethoscope,
    cta: 'Sign in as coach',
  },
  admin: {
    eyebrow: 'Administration',
    title: 'Admin sign in',
    lead: 'Studio operations: members, staffing, payments and platform settings.',
    icon: ShieldCheck,
    cta: 'Sign in as admin',
  },
}

const OTHER_PORTALS: { to: string; label: string; variant: LoginVariant }[] = [
  { to: '/login/member', label: 'Member', variant: 'membership' },
  { to: '/login/instructor', label: 'Coach', variant: 'instructor' },
  { to: '/login/admin', label: 'Admin', variant: 'admin' },
]

export default function LoginPage({
  portal,
  variant,
}: {
  portal: Role
  variant: LoginVariant
}) {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useAuthStore((s) => s.login)
  const pending = useAuthStore((s) => s.pending)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)

  const copy = COPY[variant]
  const Icon = copy.icon

  // Send the user back where they were bounced from, if anywhere.
  const returnTo = (location.state as { from?: string } | null)?.from

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const session = await login({ email, password, portal, rememberMe })
      navigate(returnTo ?? homeRouteFor(session.user.role), { replace: true })
    } catch {
      // The store owns the error; the banner below renders it.
    }
  }

  const fillDemo = (demoEmail: string) => {
    clearError()
    setEmail(demoEmail)
    setPassword(DEMO_PASSWORD)
  }

  /** Demo accounts this portal will actually accept. */
  const relevantDemos = DEMO_ACCOUNTS.filter((account) =>
    portal === Role.Admin
      ? account.role === Role.Admin || account.role === Role.AppManager
      : account.role === portal,
  )

  return (
    <div>
      <span className="grid size-11 place-items-center rounded-lg bg-volt-400/12 text-volt-400">
        <Icon className="size-5.5" />
      </span>

      <p className="eyebrow mt-6">{copy.eyebrow}</p>
      <h1 className="mt-2 text-4xl">{copy.title}</h1>
      <p className="mt-3 text-sm text-chalk-dim text-pretty">{copy.lead}</p>

      {error && (
        <div
          role="alert"
          className="mt-6 flex items-start gap-3 rounded-lg border border-danger-500/35 bg-danger-500/10 p-3.5"
        >
          <AlertCircle className="mt-0.5 size-4.5 shrink-0 text-danger-500" />
          <p className="text-sm text-danger-500">{error}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          label="Email"
          type="email"
          name="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => {
            clearError()
            setEmail(e.target.value)
          }}
          placeholder="you@example.com"
        />

        <div className="relative">
          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => {
              clearError()
              setPassword(e.target.value)
            }}
            inputClassName="pr-11"
            placeholder="••••••••"
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-3 top-[2.1rem] rounded p-1 text-chalk-faint transition-colors hover:text-chalk"
          >
            {showPassword ? <EyeOff className="size-4.5" /> : <Eye className="size-4.5" />}
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-chalk-dim">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="size-4 rounded border-ink-600 bg-ink-900 accent-volt-400"
            />
            Keep me signed in
          </label>
          <Link
            to="/forgot-password"
            className="text-sm text-chalk-dim underline underline-offset-4 transition-colors hover:text-volt-400"
          >
            Forgot password?
          </Link>
        </div>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          {copy.cta}
        </Button>
      </form>

      {variant !== 'admin' && (
        <p className="mt-6 text-center text-sm text-chalk-dim">
          New here?{' '}
          <Link to="/register" className="font-semibold text-volt-400 underline underline-offset-4">
            Create an account
          </Link>
        </p>
      )}

      {/* Portal switcher — the four sign-in surfaces the brief calls for. */}
      <div className="mt-8 border-t border-ink-700 pt-6">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
          Sign in somewhere else
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {OTHER_PORTALS.filter((p) => p.variant !== variant).map((p) => (
            <Link
              key={p.to}
              to={p.to}
              className="rounded-md border border-ink-600 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-chalk-dim transition-colors hover:border-volt-400 hover:text-volt-400"
            >
              {p.label}
            </Link>
          ))}
        </div>
      </div>

      {isMockMode && relevantDemos.length > 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-ink-600 bg-ink-900/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
            Demo accounts — password “{DEMO_PASSWORD}”
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {relevantDemos.map((account) => (
              <button
                key={account.email}
                type="button"
                onClick={() => fillDemo(account.email)}
                className={cn(
                  'rounded-md bg-ink-700 px-3 py-1.5 text-xs font-medium text-chalk-dim transition-colors',
                  'hover:bg-ink-600 hover:text-chalk',
                )}
              >
                {account.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
