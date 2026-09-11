import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { addDays, format, isToday, parseISO } from 'date-fns'
import { ArrowLeft, Camera, ChevronLeft, ChevronRight, ClipboardList, PenSquare, Plus, Trash2, Utensils } from 'lucide-react'
import { Role, fullName } from '@/domain/identity/model'
import { MEAL_ORDER, MEAL_TYPE_LABELS, sumMacros, type FoodEntry, type Macros } from '@/domain/nutrition/model'
import type { FoodEntryId, UserId } from '@/domain/shared/types'
import { useCurrentUser } from '@/features/auth/store'
import { useGoal } from '@/features/progress/hooks'
import { useProfile } from '@/features/profiles/hooks'
import { Badge } from '@/shared/ui/Badge'
import { Button, ButtonLink } from '@/shared/ui/Button'
import { Card, CardBody, CardTitle, PageHeading } from '@/shared/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/shared/ui/Feedback'
import { Modal } from '@/shared/ui/Modal'
import { toIsoDate, today } from '@/shared/lib/dates'
import { cn } from '@/shared/lib/cn'
import { MacroSummary, MealThumb } from './components'
import { LogMealDialog } from './LogMealDialog'
import { useDailyTotals, useDeleteFood, useDietPlan, useFoodEntries, useFoodPhoto } from './hooks'

/**
 * The food diary: one day at a time, totals against the member's plan (or
 * their goal when there is no plan), every meal with its photo, and a
 * fortnight of daily totals to see the pattern. Members log here; coaches and
 * staff read the same page for any member in their studio.
 */
export default function FoodDiaryPage() {
  const viewer = useCurrentUser()
  const { memberId: routeMemberId } = useParams()
  const isSelf = !routeMemberId || routeMemberId === viewer?.id
  const memberId = (routeMemberId ?? viewer?.id) as UserId | undefined
  const canEdit = isSelf
  const canPlan = viewer && viewer.role !== Role.Member

  const [date, setDate] = useState(today())
  const [logOpen, setLogOpen] = useState(false)
  const [editing, setEditing] = useState<FoodEntry | null>(null)
  const [pendingDelete, setPendingDelete] = useState<FoodEntry | null>(null)
  const [photoOf, setPhotoOf] = useState<FoodEntry | null>(null)

  const profile = useProfile(isSelf ? undefined : memberId)
  const member = isSelf ? viewer : profile.data
  const entries = useFoodEntries(memberId, { from: date, to: date })
  const fortnight = useMemo(() => ({ from: toIsoDate(addDays(new Date(), -13)), to: today() }), [])
  const totals14 = useDailyTotals(memberId, fortnight)
  const plan = useDietPlan(memberId)
  const goal = useGoal(memberId)
  const remove = useDeleteFood(memberId)

  const dayTotals = useMemo(() => sumMacros((entries.data ?? []).map((e) => e.totals)), [entries.data])
  const targets: Macros | null = plan.data
    ? plan.data.targets
    : goal.data
      ? { calories: goal.data.dailyCalorieTarget, proteinG: goal.data.dailyProteinTarget, carbsG: 0, fatG: 0 }
      : null

  const byMeal = useMemo(() => {
    const groups = new Map<string, FoodEntry[]>()
    for (const type of MEAL_ORDER) groups.set(type, [])
    for (const e of entries.data ?? []) groups.get(e.mealType)?.push(e)
    return groups
  }, [entries.data])

  const shift = (days: number) => setDate((d) => toIsoDate(addDays(parseISO(d), days)))
  const parsed = parseISO(date)

  if (!viewer) return null
  if (!isSelf && profile.isError) {
    return <ErrorState title="Member not available" description="You may not have access to this person." />
  }

  const heading = isSelf ? 'Food diary' : `${member ? fullName(member) : 'Member'}'s food diary`

  return (
    <>
      {!isSelf && (
        <Link
          to={memberId ? `/app/people/${memberId}` : '/app/people'}
          className="mb-5 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-chalk-faint transition-colors hover:text-chalk"
        >
          <ArrowLeft className="size-4" /> Back to profile
        </Link>
      )}

      <PageHeading
        title={heading}
        subtitle={
          isSelf
            ? 'Snap a photo of each meal and we will estimate the calories. Correct anything, then save.'
            : 'What they logged, against the plan you set.'
        }
        actions={
          <>
            {canPlan && memberId && (
              <ButtonLink to={`/app/nutrition/${memberId}/plan`} size="sm" variant="outline">
                <ClipboardList className="size-4" /> {plan.data ? 'Edit diet plan' : 'Write a diet plan'}
              </ButtonLink>
            )}
            {canEdit && (
              <Button size="sm" onClick={() => { setEditing(null); setLogOpen(true) }}>
                <Camera className="size-4" /> Log a meal
              </Button>
            )}
          </>
        }
      />

      {/* Day picker */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <div className="inline-flex items-center rounded-lg border border-ink-700 bg-ink-900/60">
          <button type="button" onClick={() => shift(-1)} aria-label="Previous day" className="rounded-l-lg p-2.5 text-chalk-dim hover:bg-ink-800 hover:text-chalk">
            <ChevronLeft className="size-4" />
          </button>
          <input
            type="date"
            value={date}
            max={today()}
            onChange={(e) => e.target.value && setDate(e.target.value)}
            aria-label="Day"
            className="h-10 border-x border-ink-700 bg-transparent px-3 text-sm text-chalk outline-none [color-scheme:dark]"
          />
          <button
            type="button"
            onClick={() => shift(1)}
            disabled={date >= today()}
            aria-label="Next day"
            className="rounded-r-lg p-2.5 text-chalk-dim hover:bg-ink-800 hover:text-chalk disabled:opacity-30"
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
        <p className="text-sm text-chalk-dim">
          {isToday(parsed) ? 'Today' : format(parsed, 'EEEE')}, {format(parsed, 'd MMMM yyyy')}
        </p>
        {!isToday(parsed) && (
          <Button size="sm" variant="ghost" onClick={() => setDate(today())}>
            Jump to today
          </Button>
        )}
      </div>

      <Card className="mb-6">
        <CardBody>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Day so far</CardTitle>
            <p className="text-xs text-chalk-faint">
              {plan.data ? `Targets from “${plan.data.title}”` : goal.data ? 'Targets from your goal' : 'No targets set yet'}
            </p>
          </div>
          <MacroSummary totals={dayTotals} targets={targets} />
        </CardBody>
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:items-start">
        <section className="min-w-0 space-y-4">
          {entries.isPending ? (
            <>
              <Skeleton className="h-28 w-full" />
              <Skeleton className="h-28 w-full" />
            </>
          ) : entries.isError ? (
            <ErrorState description="Couldn't load the diary." onRetry={() => void entries.refetch()} />
          ) : (entries.data ?? []).length === 0 ? (
            <EmptyState
              icon={Utensils}
              title={isToday(parsed) ? 'Nothing logged yet today' : 'Nothing logged this day'}
              description={canEdit ? 'A photo takes ten seconds. Start with your next meal.' : 'The member did not log any meals.'}
              action={
                canEdit ? (
                  <Button size="sm" onClick={() => { setEditing(null); setLogOpen(true) }}>
                    <Plus className="size-4" /> Log a meal
                  </Button>
                ) : undefined
              }
            />
          ) : (
            MEAL_ORDER.map((type) => {
              const list = byMeal.get(type) ?? []
              if (list.length === 0) return null
              const mealTotals = sumMacros(list.map((e) => e.totals))
              return (
                <div key={type}>
                  <div className="mb-2 flex items-baseline justify-between gap-3">
                    <h2 className="text-lg tracking-wide text-chalk">{MEAL_TYPE_LABELS[type]}</h2>
                    <p className="text-xs tabular-nums text-chalk-faint">{mealTotals.calories} kcal</p>
                  </div>
                  <ul className="space-y-3">
                    {list.map((entry) => (
                      <li key={entry.id} className="flex min-w-0 gap-4 rounded-xl border border-ink-700 bg-ink-850/70 p-4">
                        <MealThumb entry={entry} className="size-16 sm:size-24" onClick={() => setPhotoOf(entry)} />
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h3 className="truncate text-base font-semibold text-chalk">{entry.title}</h3>
                              <p className="text-xs text-chalk-faint">
                                {format(new Date(entry.loggedAt), 'HH:mm')}
                                {entry.source === 'photo' && (
                                  <>
                                    {' · '}
                                    <Badge tone="volt" className="align-middle">
                                      From photo
                                    </Badge>
                                  </>
                                )}
                              </p>
                            </div>
                            <p className="shrink-0 text-right">
                              <span className="font-display text-2xl leading-none tabular-nums text-chalk">{entry.totals.calories}</span>
                              <span className="text-xs text-chalk-dim"> kcal</span>
                            </p>
                          </div>
                          <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-chalk-dim">
                            {entry.items.map((it, i) => (
                              <li key={i}>
                                {it.name}
                                {it.portion ? <span className="text-chalk-faint"> · {it.portion}</span> : null}
                              </li>
                            ))}
                          </ul>
                          <p className="mt-2 text-[11px] uppercase tracking-wider text-chalk-faint">
                            P {entry.totals.proteinG} g · C {entry.totals.carbsG} g · F {entry.totals.fatG} g
                          </p>
                          {entry.notes && <p className="mt-2 text-sm text-chalk-dim">{entry.notes}</p>}
                          {canEdit && (
                            <div className="mt-3 flex gap-1">
                              <Button size="sm" variant="ghost" onClick={() => { setEditing(entry); setLogOpen(true) }}>
                                <PenSquare className="size-4" /> Edit
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setPendingDelete(entry)} aria-label={`Delete ${entry.title}`}>
                                <Trash2 className="size-4 text-danger-500" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )
            })
          )}
        </section>

        <aside className="min-w-0 space-y-5">
          <Card>
            <CardBody>
              <div className="flex items-center justify-between gap-3">
                <CardTitle>Diet plan</CardTitle>
                {plan.data && <Badge tone="ok" dot>Active</Badge>}
              </div>
              {plan.isPending ? (
                <Skeleton className="mt-4 h-24 w-full" />
              ) : plan.data ? (
                <div className="mt-3 space-y-3">
                  <p className="text-base font-semibold text-chalk">{plan.data.title}</p>
                  {plan.data.summary && <p className="text-sm leading-relaxed text-chalk-dim text-pretty">{plan.data.summary}</p>}
                  <ul className="divide-y divide-ink-700 rounded-lg border border-ink-700">
                    {plan.data.meals.map((m, i) => (
                      <li key={i} className="p-3">
                        <div className="flex items-baseline justify-between gap-3">
                          <p className="text-sm font-semibold text-chalk">
                            {m.name}
                            {m.time && <span className="ml-2 text-xs font-normal text-chalk-faint">{m.time}</span>}
                          </p>
                          {m.calories != null && <p className="text-xs tabular-nums text-chalk-faint">~{m.calories} kcal</p>}
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-chalk-dim">{m.description}</p>
                      </li>
                    ))}
                  </ul>
                  {plan.data.guidelines.length > 0 && (
                    <ul className="space-y-1.5">
                      {plan.data.guidelines.map((g, i) => (
                        <li key={i} className="flex gap-2 text-xs text-chalk-dim">
                          <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-volt-400" aria-hidden />
                          {g}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-[11px] text-chalk-faint">
                    By {plan.data.authorName} · {format(new Date(plan.data.updatedAt), 'd MMM yyyy')}
                  </p>
                </div>
              ) : (
                <p className="mt-3 text-sm text-chalk-dim">
                  {canPlan ? 'No plan yet. Write one so their targets show up here.' : 'Your coach has not set a plan yet. Your goal targets are used meanwhile.'}
                </p>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <CardTitle>Last 14 days</CardTitle>
              {totals14.isPending ? (
                <Skeleton className="mt-4 h-28 w-full" />
              ) : (
                <FortnightBars
                  data={totals14.data ?? []}
                  from={fortnight.from}
                  target={targets?.calories}
                  selected={date}
                  onSelect={setDate}
                />
              )}
            </CardBody>
          </Card>
        </aside>
      </div>

      <LogMealDialog open={logOpen} onClose={() => setLogOpen(false)} memberId={memberId} date={date} existing={editing} />

      <Modal
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        title="Delete this meal?"
        description={pendingDelete?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPendingDelete(null)}>
              Keep it
            </Button>
            <Button
              variant="danger"
              loading={remove.isPending}
              onClick={() => pendingDelete && remove.mutate(pendingDelete.id as FoodEntryId, { onSuccess: () => setPendingDelete(null) })}
            >
              Delete
            </Button>
          </>
        }
      >
        <p className="text-sm text-chalk-dim">The photo and the calories come off the day's total.</p>
      </Modal>

      <PhotoModal memberId={memberId} entry={photoOf} onClose={() => setPhotoOf(null)} />
    </>
  )
}

function PhotoModal({ memberId, entry, onClose }: { memberId: string | undefined; entry: FoodEntry | null; onClose: () => void }) {
  const photo = useFoodPhoto(memberId, entry?.id ?? null)
  return (
    <Modal open={entry !== null} onClose={onClose} title={entry?.title ?? 'Photo'} size="lg">
      {photo.isPending ? (
        <Skeleton className="aspect-[4/3] w-full" />
      ) : photo.data ? (
        <img src={photo.data} alt={entry?.title ?? 'Meal'} className="w-full rounded-lg" />
      ) : (
        <p className="text-sm text-chalk-dim">No photo saved for this meal.</p>
      )}
    </Modal>
  )
}

function FortnightBars({
  data,
  from,
  target,
  selected,
  onSelect,
}: {
  data: readonly { date: string; totals: Macros; meals: number }[]
  from: string
  target?: number
  selected: string
  onSelect: (date: string) => void
}) {
  const days = useMemo(() => {
    const byDate = new Map(data.map((d) => [d.date, d]))
    return Array.from({ length: 14 }, (_, i) => {
      const date = toIsoDate(addDays(parseISO(from), i))
      return { date, calories: byDate.get(date)?.totals.calories ?? 0, meals: byDate.get(date)?.meals ?? 0 }
    })
  }, [data, from])
  const max = Math.max(target ?? 0, ...days.map((d) => d.calories), 1)
  const logged = days.filter((d) => d.meals > 0)
  const avg = logged.length ? Math.round(logged.reduce((s, d) => s + d.calories, 0) / logged.length) : 0

  return (
    <div className="mt-4">
      <div className="relative flex h-28 items-end gap-1">
        {target ? (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-chalk-faint/60" style={{ bottom: `${(target / max) * 100}%` }} aria-hidden />
        ) : null}
        {days.map((d) => (
          <button
            key={d.date}
            type="button"
            onClick={() => onSelect(d.date)}
            title={`${format(parseISO(d.date), 'EEE d MMM')}: ${d.calories} kcal, ${d.meals} meal${d.meals === 1 ? '' : 's'}`}
            aria-label={`${format(parseISO(d.date), 'EEEE d MMMM')}, ${d.calories} calories`}
            className="group flex h-full flex-1 items-end"
          >
            <span
              className={cn(
                'w-full rounded-t-sm transition-colors',
                d.date === selected ? 'bg-volt-400' : d.calories === 0 ? 'bg-ink-700' : target && d.calories > target ? 'bg-warn-500/70 group-hover:bg-warn-500' : 'bg-volt-600/70 group-hover:bg-volt-500',
              )}
              style={{ height: `${Math.max(d.calories === 0 ? 3 : 6, (d.calories / max) * 100)}%` }}
            />
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] text-chalk-faint">
        <span>{format(parseISO(days[0]!.date), 'd MMM')}</span>
        <span>{format(parseISO(days[13]!.date), 'd MMM')}</span>
      </div>
      <p className="mt-3 text-xs text-chalk-dim">
        <span className="font-semibold text-chalk tabular-nums">{avg}</span> kcal a day on average across {logged.length} logged day{logged.length === 1 ? '' : 's'}
        {target ? <span className="text-chalk-faint"> · dashed line is the {target} target</span> : null}
      </p>
    </div>
  )
}
