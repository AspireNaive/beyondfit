import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { AlertCircle, KeyRound } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { container } from '@/infrastructure/container'

/** Second half of the reset flow: the emailed link lands here with ?token=. */
export default function ResetPasswordPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mismatch = confirm.length > 0 && confirm !== password

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (mismatch) return
    setPending(true)
    setError(null)
    try {
      await container.auth.resetPassword(token, password)
      navigate('/login?reset=1', { replace: true })
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setPending(false)
    }
  }

  if (!token) {
    return (
      <div className="text-center">
        <h1 className="text-3xl">That link is incomplete</h1>
        <p className="mt-3 text-sm text-chalk-dim">Open the reset link from your email again, or request a new one.</p>
        <Link to="/forgot-password" className="mt-8 inline-block text-sm font-semibold text-volt-400 underline underline-offset-4">
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div>
      <span className="grid size-11 place-items-center rounded-lg bg-volt-400/12 text-volt-400">
        <KeyRound className="size-5.5" />
      </span>
      <p className="eyebrow mt-6">Password reset</p>
      <h1 className="mt-2 text-4xl">Choose a new password</h1>
      <p className="mt-3 text-sm text-chalk-dim text-pretty">At least 8 characters. You will be signed out everywhere else.</p>

      {error && (
        <div role="alert" className="mt-6 flex items-start gap-3 rounded-lg border border-danger-500/35 bg-danger-500/10 p-3.5">
          <AlertCircle className="mt-0.5 size-4.5 shrink-0 text-danger-500" />
          <p className="text-sm text-danger-500">{error}</p>
        </div>
      )}

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Input
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          error={mismatch ? 'Passwords do not match.' : undefined}
        />
        <Button type="submit" size="lg" loading={pending} className="w-full" disabled={mismatch}>
          Set new password
        </Button>
      </form>
    </div>
  )
}
