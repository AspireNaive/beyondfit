import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { format } from 'date-fns'
import { ArrowDown, ArrowLeft, ArrowUp, Plus, Save, Trash2 } from 'lucide-react'
import { Role, fullName } from '@/domain/identity/model'
import { macroCalories, type DietPlan, type DietPlanInput } from '@/domain/nutrition/model'
import type { UserId } from '@/domain/shared/types'
import { useCurrentUser } from '@/features/auth/store'
import { useProfile } from '@/features/profiles/hooks'
import { Badge } from '@/shared/ui/Badge'
import { Button } from '@/shared/ui/Button'
import { Card, CardBody, CardTitle } from '@/shared/ui/Card'
import { ErrorState, Skeleton } from '@/shared/ui/Feedback'
import { Input, Textarea } from '@/shared/ui/Field'
import { useDietPlan, useDietPlanHistory, useSaveDietPlan } from './hooks'

type MealDraft = { name: string; time: string; description: string; calories: string }
type Draft = {
  title: string
  summary: string
  calories: string
  proteinG: string
  carbsG: string
  fatG: string
  meals: MealDraft[]
  guidelines: string[]
}

const blank = (): Draft => ({
  title: '',
  summary: '',
  calories: '2200',
  proteinG: '160',
  carbsG: '220',
  fatG: '70',
  meals: [
    { name: 'Breakfast', time: '07:30', description: '', calories: '' },
    { name: 'Lunch', time: '12:30', description: '', calories: '' },
    { name: 'Dinner', time: '19:00', description: '', calories: '' },
  ],
  guidelines: [''],
})

const fromPlan = (p: DietPlan): Draft => ({
  title: p.title,
  summary: p.summary,
  calories: String(p.targets.calories),
  proteinG: String(p.targets.proteinG),
  carbsG: String(p.targets.carbsG),
  fatG: String(p.targets.fatG),
  meals: p.meals.map((m) => ({ name: m.name, time: m.time ?? '', description: m.description, calories: m.calories == null ? '' : String(m.calories) })),
  guidelines: p.guidelines.length ? [...p.guidelines] : [''],
})

const int = (v: string) => Math.round(Number(v) || 0)

function toInput(d: Draft): DietPlanInput {
  return {
    title: d.title.trim(),
    summary: d.summary.trim(),
    targets: { calories: int(d.calories), proteinG: int(d.proteinG), carbsG: int(d.carbsG), fatG: int(d.fatG) },
    meals: d.meals
      .filter((m) => m.name.trim() && m.description.trim())
      .map((m) => ({ name: m.name.trim(), time: m.time.trim() || null, description: m.description.trim(), calories: m.calories.trim() ? int(m.calories) : null })),
    guidelines: d.guidelines.map((g) => g.trim()).filter(Boolean),
  }
}

function validate(d: Draft): string | null {
  if (d.title.trim().length < 2) return 'Give the plan a title.'
  const c = int(d.calories)
  if (c < 800 || c > 10_000) return 'Daily calories should be between 800 and 10,000.'
  if (toInput(d).meals.length === 0) return 'Add at least one meal with a description.'
  return null
}

/** Coaches and studio staff write a member's diet plan here. Saving archives the previous plan. */
export default function DietPlanEditorPage() {
  const viewer = useCurrentUser()
  const { memberId } = useParams()
  const navigate = useNavigate()
  const profile = useProfile(memberId as UserId | undefined)
  const current = useDietPlan(memberId)
  const history = useDietPlanHistory(memberId)
  const save = useSaveDietPlan(memberId, viewer)

  const [draft, setDraft] = useState<Draft>(blank)
  const [seeded, setSeeded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (seeded || current.isPending) return
    if (current.data) setDraft(fromPlan(current.data))
    setSeeded(true)
  }, [current.data, current.isPending, seeded])

  const implied = useMemo(() => macroCalories({ calories: 0, proteinG: int(draft.proteinG), carbsG: int(draft.carbsG), fatG: int(draft.fatG) }), [draft])
  const mealSum = useMemo(() => draft.meals.reduce((s, m) => s + int(m.calories), 0), [draft.meals])

  if (!viewer) return null
  if (viewer.role === Role.Member) return <ErrorState title="Coaches write diet plans" description="Ask your coach to set one for you." />
  if (profile.isError || (!profile.isPending && !profile.data)) {
    return <ErrorState title="Member not available" description="You may not have access to this person." />
  }

  const patch = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }))
  const setMeal = (i: number, p: Partial<MealDraft>) => setDraft((d) => ({ ...d, meals: d.meals.map((m, j) => (j === i ? { ...m, ...p } : m)) }))
  const moveMeal = (i: number, delta: -1 | 1) =>
    setDraft((d) => {
      const meals = [...d.meals]
      const j = i + delta
      if (j < 0 || j >= meals.length) return d
      ;[meals[i], meals[j]] = [meals[j]!, meals[i]!]
      return { ...d, meals }
    })

  const submit = () => {
    const problem = validate(draft)
    setError(problem)
    if (problem) return
    save.mutate(toInput(draft), {
      onSuccess: () => navigate(`/app/nutrition/${memberId}`),
      onError: (e) => setError(e.message),
    })
  }

  const memberName = profile.data ? fullName(profile.data) : 'member'

  return (
    <>
      <Link
        to={`/app/nutrition/${memberId}`}
        className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-chalk-faint transition-colors hover:text-chalk"
      >
        <ArrowLeft className="size-4" /> {memberName}'s food diary
      </Link>

      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">{current.data ? 'Update diet plan' : 'New diet plan'}</p>
          <h1 className="mt-2 text-4xl sm:text-5xl">{profile.isPending ? <Skeleton className="h-10 w-64" /> : memberName}</h1>
          <p className="mt-2 max-w-2xl text-sm text-chalk-dim">
            Daily targets drive the bars on their diary. Saving replaces the current plan; the old one stays in the history below.
          </p>
        </div>
        <Button onClick={submit} loading={save.isPending}>
          <Save className="size-4" /> {current.data ? 'Save new version' : 'Save plan'}
        </Button>
      </div>

      {error && (
        <p role="alert" className="mb-6 rounded-lg border border-danger-500/35 bg-danger-500/10 px-4 py-3 text-sm text-danger-500">
          {error}
        </p>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardBody className="space-y-5">
              <Input label="Plan title" required value={draft.title} onChange={(e) => patch({ title: e.target.value })} placeholder="Lean-out phase: 12 weeks" maxLength={120} />
              <Textarea
                label="Summary for the member"
                value={draft.summary}
                onChange={(e) => patch({ summary: e.target.value })}
                placeholder="What this phase is for, how long it runs, when you will review it."
                rows={3}
                maxLength={1000}
              />
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="mb-4 flex items-center justify-between gap-3">
                <CardTitle>Meals</CardTitle>
                <p className="text-xs tabular-nums text-chalk-faint">
                  {mealSum > 0 ? `${mealSum} kcal across meals` : 'Per-meal calories optional'}
                </p>
              </div>
              <div className="space-y-4">
                {draft.meals.map((m, i) => (
                  <div key={i} className="rounded-xl border border-ink-700 bg-ink-900/40 p-4">
                    <div className="grid gap-3 sm:grid-cols-[1fr_7rem_7rem_auto]">
                      <Input aria-label="Meal name" value={m.name} onChange={(e) => setMeal(i, { name: e.target.value })} placeholder="Breakfast" maxLength={60} />
                      <Input aria-label="Time" value={m.time} onChange={(e) => setMeal(i, { time: e.target.value })} placeholder="07:30" maxLength={20} />
                      <Input aria-label="Calories" inputMode="numeric" value={m.calories} onChange={(e) => setMeal(i, { calories: e.target.value })} placeholder="kcal" />
                      <div className="flex items-center gap-1">
                        <IconButton label="Move up" disabled={i === 0} onClick={() => moveMeal(i, -1)}>
                          <ArrowUp className="size-4" />
                        </IconButton>
                        <IconButton label="Move down" disabled={i === draft.meals.length - 1} onClick={() => moveMeal(i, 1)}>
                          <ArrowDown className="size-4" />
                        </IconButton>
                        <IconButton label="Remove meal" disabled={draft.meals.length === 1} onClick={() => setDraft((d) => ({ ...d, meals: d.meals.filter((_, j) => j !== i) }))} danger>
                          <Trash2 className="size-4" />
                        </IconButton>
                      </div>
                    </div>
                    <Textarea
                      className="mt-3"
                      aria-label="What to eat"
                      value={m.description}
                      onChange={(e) => setMeal(i, { description: e.target.value })}
                      placeholder="What to eat, roughly how much, and any swaps."
                      rows={2}
                      maxLength={1000}
                    />
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setDraft((d) => ({ ...d, meals: [...d.meals, { name: '', time: '', description: '', calories: '' }] }))}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-volt-400"
              >
                <Plus className="size-3.5" /> Add a meal
              </button>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardTitle>Guidelines</CardTitle>
              <p className="mt-1 text-xs text-chalk-faint">Short rules the member can remember. Up to 15.</p>
              <div className="mt-4 space-y-2">
                {draft.guidelines.map((g, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="size-1.5 shrink-0 rounded-full bg-volt-400" aria-hidden />
                    <Input
                      className="flex-1"
                      aria-label={`Guideline ${i + 1}`}
                      value={g}
                      onChange={(e) => setDraft((d) => ({ ...d, guidelines: d.guidelines.map((x, j) => (j === i ? e.target.value : x)) }))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          setDraft((d) => {
                            const guidelines = [...d.guidelines]
                            guidelines.splice(i + 1, 0, '')
                            return { ...d, guidelines }
                          })
                        }
                      }}
                      placeholder="Protein at every meal"
                      maxLength={200}
                    />
                    <IconButton label="Remove guideline" disabled={draft.guidelines.length === 1} onClick={() => setDraft((d) => ({ ...d, guidelines: d.guidelines.filter((_, j) => j !== i) }))}>
                      <Trash2 className="size-4" />
                    </IconButton>
                  </div>
                ))}
              </div>
              {draft.guidelines.length < 15 && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, guidelines: [...d.guidelines, ''] }))}
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-volt-400"
                >
                  <Plus className="size-3.5" /> Add a guideline
                </button>
              )}
            </CardBody>
          </Card>
        </div>

        <aside className="min-w-0 space-y-5">
          <Card>
            <CardBody className="space-y-4">
              <CardTitle>Daily targets</CardTitle>
              <Input label="Calories" required inputMode="numeric" value={draft.calories} onChange={(e) => patch({ calories: e.target.value })} hint="kcal per day" />
              <div className="grid grid-cols-3 gap-3">
                <Input label="Protein" inputMode="numeric" value={draft.proteinG} onChange={(e) => patch({ proteinG: e.target.value })} hint="g" />
                <Input label="Carbs" inputMode="numeric" value={draft.carbsG} onChange={(e) => patch({ carbsG: e.target.value })} hint="g" />
                <Input label="Fat" inputMode="numeric" value={draft.fatG} onChange={(e) => patch({ fatG: e.target.value })} hint="g" />
              </div>
              <p className="text-xs text-chalk-faint">
                Those macros add up to <span className="tabular-nums text-chalk">{implied}</span> kcal
                {Math.abs(implied - int(draft.calories)) > 150 ? ' — a fair way from the calorie target; check the numbers.' : '.'}
              </p>
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardTitle>Previous plans</CardTitle>
              {history.isPending ? (
                <Skeleton className="mt-4 h-16 w-full" />
              ) : (history.data ?? []).length === 0 ? (
                <p className="mt-3 text-sm text-chalk-dim">This will be the first plan for {memberName}.</p>
              ) : (
                <ul className="mt-3 divide-y divide-ink-700">
                  {(history.data ?? []).map((p) => (
                    <li key={p.id} className="flex items-start justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-chalk">{p.title}</p>
                        <p className="text-xs text-chalk-faint">
                          {p.authorName} · {format(new Date(p.createdAt), 'd MMM yyyy')} · {p.targets.calories} kcal
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <Badge tone={p.status === 'active' ? 'ok' : 'neutral'}>{p.status}</Badge>
                        {p.status !== 'active' && (
                          <button type="button" onClick={() => setDraft(fromPlan(p))} className="text-[11px] font-semibold uppercase tracking-wider text-volt-400">
                            Load into editor
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </aside>
      </div>
    </>
  )
}

function IconButton({ label, onClick, disabled, danger, children }: { label: string; onClick: () => void; disabled?: boolean; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md p-1.5 text-chalk-faint transition-colors hover:bg-ink-700 hover:text-chalk disabled:pointer-events-none disabled:opacity-30 ${danger ? 'hover:text-danger-500' : ''}`}
    >
      {children}
    </button>
  )
}
