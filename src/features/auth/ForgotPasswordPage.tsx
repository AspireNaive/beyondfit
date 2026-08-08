import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MailCheck } from 'lucide-react'
import { Button } from '@/shared/ui/Button'
import { Input } from '@/shared/ui/Field'
import { container } from '@/infrastructure/container'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [pending, setPending] = useState(false)
  const [sent, setSent] = useState(false)

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setPending(true)
    try {
      await container.auth.requestPasswordReset(email)
    } finally {
      setPending(false)
      // Always report success: revealing whether an address is registered is an
      // account-enumeration hole, and the API behaves the same way.
      setSent(true)
    }
  }

  if (sent) {
    return (
      <div className="text-center">
        <span className="mx-auto grid size-12 place-items-center rounded-full bg-volt-400/12 text-volt-400">
          <MailCheck className="size-6" />
        </span>
        <h1 className="mt-6 text-3xl">Check your inbox</h1>
        <p className="mt-3 text-sm text-chalk-dim text-pretty">
          If an account exists for <span className="text-chalk">{email}</span>, a reset link is on
          its way. It expires in 30 minutes.
        </p>
        <Link
          to="/login"
          className="mt-8 inline-block text-sm font-semibold text-volt-400 underline underline-offset-4"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div>
      <p className="eyebrow">Password reset</p>
      <h1 className="mt-2 text-4xl">Forgot your password?</h1>
      <p className="mt-3 text-sm text-chalk-dim text-pretty">
        Enter the email on your account and we will send you a link to set a new password.
      </p>

      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          autoFocus
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
        />
        <Button type="submit" size="lg" loading={pending} className="w-full">
          Send reset link
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-chalk-dim">
        Remembered it?{' '}
        <Link to="/login" className="font-semibold text-volt-400 underline underline-offset-4">
          Sign in
        </Link>
      </p>
    </div>
  )
}
