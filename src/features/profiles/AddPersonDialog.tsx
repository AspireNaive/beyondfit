import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, UserPlus } from 'lucide-react'
import { Role, fullName, type NewPersonInput, type UserProfile } from '@/domain/identity/model'
import type { UserId } from '@/domain/shared/types'
import { useCurrentUser, useTenant } from '@/features/auth/store'
import { Button } from '@/shared/ui/Button'
import { Input, Select, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { Tabs } from '@/shared/ui/Tabs'
import { useCreatePerson } from './hooks'

/**
 * A studio admin (or platform manager) adds a member or a coach. Leaving the
 * password empty generates one that is shown exactly once, so the manager can
 * hand it over; the person changes it from their profile afterwards.
 */
export function AddPersonDialog({
  open,
  onClose,
  coaches,
}: {
  open: boolean
  onClose: () => void
  coaches: readonly UserProfile[]
}) {
  const viewer = useCurrentUser()
  const tenant = useTenant()
  const create = useCreatePerson(viewer)

  const [role, setRole] = useState<typeof Role.Member | typeof Role.Coach>(Role.Member)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [title, setTitle] = useState('')
  const [bio, setBio] = useState('')
  const [password, setPassword] = useState('')
  const [coachId, setCoachId] = useState<string>('')
  const [specialties, setSpecialties] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ user: UserProfile; temporaryPassword: string | null } | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setRole(Role.Member)
    setFirstName('')
    setLastName('')
    setEmail('')
    setPhone('')
    setTitle('')
    setBio('')
    setPassword('')
    setCoachId('')
    setSpecialties('')
    setError(null)
    setResult(null)
    setCopied(false)
    create.reset()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const studioCoaches = useMemo(() => coaches.filter((c) => c.role === Role.Coach), [coaches])

  const submit = () => {
    if (!firstName.trim() || !lastName.trim()) return setError('First and last name are required.')
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Enter a valid email address.')
    if (password && password.length < 8) return setError('Passwords need at least 8 characters.')
    setError(null)
    const input: NewPersonInput = {
      role,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      title: title.trim() || null,
      bio: role === Role.Coach ? bio.trim() || null : null,
      password: password || null,
      assignedCoachId: role === Role.Member && coachId ? (coachId as UserId) : null,
      specialties: role === Role.Coach ? specialties.split(',').map((s) => s.trim()).filter(Boolean) : null,
    }
    create.mutate(input, { onSuccess: setResult, onError: (e) => setError(e.message) })
  }

  const copy = () => {
    if (!result?.temporaryPassword) return
    navigator.clipboard
      ?.writeText(`Email: ${result.user.email}\nTemporary password: ${result.temporaryPassword}`)
      .then(() => {
        setCopied(true)
        window.setTimeout(() => setCopied(false), 1800)
      })
      .catch(() => {})
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? 'Added' : 'Add a person'}
      description={result ? undefined : `To ${tenant?.name ?? 'your studio'}. They can sign in straight away.`}
      size="md"
      footer={
        result ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={submit} loading={create.isPending}>
              <UserPlus className="size-4" /> Add {role === Role.Coach ? 'coach' : 'member'}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <p className="text-sm text-chalk-dim">
            <span className="font-semibold text-chalk">{fullName(result.user)}</span> has been added as a{' '}
            {result.user.role === Role.Coach ? 'coach' : 'member'}.
          </p>
          {result.temporaryPassword ? (
            <div className="rounded-xl border border-volt-400/40 bg-volt-400/10 p-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-volt-400">Temporary password — shown once</p>
              <p className="mt-2 font-mono text-lg text-chalk">{result.temporaryPassword}</p>
              <p className="mt-2 text-xs text-chalk-dim">
                Send it to {result.user.email} along with the sign-in page. They can change it from their profile, or use “forgot password”.
              </p>
              <Button size="sm" variant="outline" className="mt-3" onClick={copy}>
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />} {copied ? 'Copied' : 'Copy details'}
              </Button>
            </div>
          ) : (
            <p className="text-sm text-chalk-dim">They sign in with the password you set.</p>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <Tabs
            value={role}
            onChange={setRole}
            items={[
              { id: Role.Member, label: 'Member' },
              { id: Role.Coach, label: 'Coach' },
            ]}
            className="w-fit"
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="First name" required value={firstName} onChange={(e) => setFirstName(e.target.value)} maxLength={80} />
            <Input label="Last name" required value={lastName} onChange={(e) => setLastName(e.target.value)} maxLength={80} />
          </div>
          <Input label="Email" required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" />
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={40} />
            <Input
              label={role === Role.Coach ? 'Title' : 'Goal'}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={role === Role.Coach ? 'Nutrition Coach' : 'Lose 5 kg before summer'}
              maxLength={120}
            />
          </div>
          {role === Role.Member ? (
            <Select label="Coach" value={coachId} onChange={(e) => setCoachId(e.target.value)} hint="Leave on default to assign the head coach.">
              <option value="">Default (head coach)</option>
              {studioCoaches.map((c) => (
                <option key={c.id} value={c.id}>
                  {fullName(c)}
                  {c.title ? ` — ${c.title}` : ''}
                </option>
              ))}
            </Select>
          ) : (
            <>
              <Input label="Specialties" value={specialties} onChange={(e) => setSpecialties(e.target.value)} placeholder="Strength, Nutrition" hint="Comma-separated." />
              <Textarea label="Bio" value={bio} onChange={(e) => setBio(e.target.value)} rows={2} maxLength={1000} />
            </>
          )}
          <Input
            label="Password"
            type="text"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Leave empty to generate one"
            hint="At least 8 characters if you set one."
            autoComplete="off"
          />
          {error && (
            <p role="alert" className="rounded-lg border border-danger-500/35 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
