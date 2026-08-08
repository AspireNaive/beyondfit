import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AlertCircle, Check, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input, Select } from '@/shared/ui/Field'
import { homeRouteFor, useAuthStore } from './store'
import { cn } from '@/shared/lib/cn'

const GOALS = [
  'Lose weight and keep it off',
  'Get out of pain',
  'Build strength',
  'Improve sports performance',
  'Fix my energy and bloodwork',
  'Build a consistent habit',
]

/** Cheap, honest strength meter — length first, because it matters most. */
function scorePassword(value: string) {
  let score = 0
  if (value.length >= 8) score++
  if (value.length >= 12) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^\w\s]/.test(value)) score++
  return Math.min(score, 4)
}

const STRENGTH = [
  { label: 'Too short', tone: 'bg-danger-500' },
  { label: 'Weak', tone: 'bg-danger-500' },
  { label: 'Fair', tone: 'bg-warn-500' },
  { label: 'Good', tone: 'bg-ok-500' },
  { label: 'Strong', tone: 'bg-volt-400' },
] as const

export default function RegisterPage() {
  const navigate = useNavigate()
  const register = useAuthStore((s) => s.register)
  const pending = useAuthStore((s) => s.pending)
  const error = useAuthStore((s) => s.error)
  const clearError = useAuthStore((s) => s.clearError)

  const [form, setForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    goal: GOALS[0]!,
  })
  const [showPassword, setShowPassword] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [touchedPassword, setTouchedPassword] = useState(false)

  const strength = useMemo(() => scorePassword(form.password), [form.password])
  const passwordError =
    touchedPassword && form.password.length > 0 && form.password.length < 8
      ? 'Use at least 8 characters.'
      : undefined

  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => {
    clearError()
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    try {
      const session = await register(form)
      navigate(homeRouteFor(session.user.role), { replace: true })
    } catch {
      // Rendered from the store below.
    }
  }

  return (
    <div>
      <p className="eyebrow">Get started</p>
      <h1 className="mt-2 text-4xl">Create your account</h1>
      <p className="mt-3 text-sm text-chalk-dim text-pretty">
        Free to join. You will be matched with a coach and can book your first session straight
        away.
      </p>

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
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="First name"
            autoComplete="given-name"
            required
            value={form.firstName}
            onChange={(e) => set('firstName', e.target.value)}
          />
          <Input
            label="Last name"
            autoComplete="family-name"
            required
            value={form.lastName}
            onChange={(e) => set('lastName', e.target.value)}
          />
        </div>

        <Input
          label="Email"
          type="email"
          autoComplete="email"
          required
          value={form.email}
          onChange={(e) => set('email', e.target.value)}
          placeholder="you@example.com"
        />

        <Input
          label="Phone"
          type="tel"
          autoComplete="tel"
          hint="So your coach can reach you about sessions"
          value={form.phone}
          onChange={(e) => set('phone', e.target.value)}
        />

        <div>
          <div className="relative">
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              required
              minLength={8}
              error={passwordError}
              value={form.password}
              onBlur={() => setTouchedPassword(true)}
              onChange={(e) => set('password', e.target.value)}
              inputClassName="pr-11"
              placeholder="At least 8 characters"
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

          {form.password.length > 0 && (
            <div className="mt-2 flex items-center gap-3">
              <div className="flex flex-1 gap-1" aria-hidden>
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className={cn(
                      'h-1 flex-1 rounded-full transition-colors',
                      i < strength ? STRENGTH[strength]!.tone : 'bg-ink-700',
                    )}
                  />
                ))}
              </div>
              <span className="text-xs text-chalk-faint">{STRENGTH[strength]!.label}</span>
            </div>
          )}
        </div>

        <Select
          label="What are you here for?"
          value={form.goal}
          onChange={(e) => set('goal', e.target.value)}
        >
          {GOALS.map((goal) => (
            <option key={goal} value={goal}>
              {goal}
            </option>
          ))}
        </Select>

        <label className="flex cursor-pointer items-start gap-2.5 text-sm text-chalk-dim">
          <input
            type="checkbox"
            required
            checked={accepted}
            onChange={(e) => setAccepted(e.target.checked)}
            className="mt-0.5 size-4 shrink-0 rounded border-ink-600 bg-ink-900 accent-volt-400"
          />
          <span className="text-pretty">
            I agree to the terms of service and privacy policy, and to being contacted about my
            training.
          </span>
        </label>

        <Button type="submit" size="lg" loading={pending} className="w-full">
          Create my account
        </Button>
      </form>

      <ul className="mt-6 space-y-2">
        {['No card required', 'Matched with a coach in 24 hours', 'Cancel any time'].map((item) => (
          <li key={item} className="flex items-center gap-2 text-xs text-chalk-faint">
            <Check className="size-3.5 text-volt-400" />
            {item}
          </li>
        ))}
      </ul>

      <p className="mt-6 text-center text-sm text-chalk-dim">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-volt-400 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  )
}
