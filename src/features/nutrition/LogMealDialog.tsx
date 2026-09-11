import { useEffect, useMemo, useRef, useState } from 'react'
import { Camera, ImagePlus, Plus, Sparkles, Trash2, X } from 'lucide-react'
import {
  MEAL_ORDER,
  MEAL_TYPE_LABELS,
  sumMacros,
  type FoodAnalysis,
  type FoodEntry,
  type FoodItem,
  type MealType,
} from '@/domain/nutrition/model'
import type { IsoDate } from '@/domain/shared/types'
import { Button } from '@/shared/ui/Button'
import { Input, Select, Textarea } from '@/shared/ui/Field'
import { Modal } from '@/shared/ui/Modal'
import { cn } from '@/shared/lib/cn'
import { ConfidenceBadge } from './components'
import { useAnalyzeFoodPhoto, useLogFood, useNutritionCapabilities, useUpdateFood } from './hooks'
import { preparePhoto, type PreparedPhoto } from './image'

/**
 * Log a meal: snap or pick a photo, let the analyser fill in the foods, then
 * correct anything before saving — or type it in by hand. Editing an existing
 * entry reuses the same form without the photo step.
 */

type EditableItem = { name: string; portion: string; calories: string; proteinG: string; carbsG: string; fatG: string }

const blankItem = (): EditableItem => ({ name: '', portion: '', calories: '', proteinG: '', carbsG: '', fatG: '' })
const fromFood = (i: FoodItem): EditableItem => ({
  name: i.name,
  portion: i.portion,
  calories: String(i.calories),
  proteinG: String(i.proteinG),
  carbsG: String(i.carbsG),
  fatG: String(i.fatG),
})
const num = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) && n >= 0 ? n : 0
}
const toFood = (i: EditableItem): FoodItem => ({
  name: i.name.trim(),
  portion: i.portion.trim(),
  calories: Math.round(num(i.calories)),
  proteinG: Math.round(num(i.proteinG)),
  carbsG: Math.round(num(i.carbsG)),
  fatG: Math.round(num(i.fatG)),
})

const defaultMealType = (): MealType => {
  const h = new Date().getHours()
  return h < 10 ? 'breakfast' : h < 15 ? 'lunch' : h < 18 ? 'snack' : 'dinner'
}

export function LogMealDialog({
  open,
  onClose,
  memberId,
  date,
  existing,
}: {
  open: boolean
  onClose: () => void
  memberId: string | undefined
  date: IsoDate
  existing?: FoodEntry | null
}) {
  const caps = useNutritionCapabilities()
  const analyze = useAnalyzeFoodPhoto(memberId)
  const log = useLogFood(memberId)
  const update = useUpdateFood(memberId)

  const [mealType, setMealType] = useState<MealType>(defaultMealType)
  const [title, setTitle] = useState('')
  const [notes, setNotes] = useState('')
  const [hint, setHint] = useState('')
  const [items, setItems] = useState<EditableItem[]>([blankItem()])
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null)
  const [analysis, setAnalysis] = useState<FoodAnalysis | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  // Reset for each opening; hydrate when editing.
  useEffect(() => {
    if (!open) return
    setError(null)
    setAnalysis(null)
    setPhoto(null)
    setHint('')
    analyze.reset()
    if (existing) {
      setMealType(existing.mealType)
      setTitle(existing.title)
      setNotes(existing.notes ?? '')
      setItems(existing.items.map(fromFood))
    } else {
      setMealType(defaultMealType())
      setTitle('')
      setNotes('')
      setItems([blankItem()])
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing?.id])

  const totals = useMemo(() => sumMacros(items.filter((i) => i.name.trim()).map(toFood)), [items])
  const photoAnalysis = caps.data?.photoAnalysis ?? false
  const saving = log.isPending || update.isPending

  const onPickFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      const prepared = await preparePhoto(file)
      setPhoto(prepared)
      setAnalysis(null)
      if (photoAnalysis) void runAnalysis(prepared)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const runAnalysis = async (prepared: PreparedPhoto = photo!) => {
    setError(null)
    try {
      const result = await analyze.mutateAsync({ photo: prepared.photoDataUrl, hint: hint.trim() || undefined })
      setAnalysis(result)
      if (result.items.length > 0) setItems(result.items.map(fromFood))
      if (!title.trim() && result.dishName) setTitle(result.dishName)
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const setItem = (index: number, patch: Partial<EditableItem>) =>
    setItems((list) => list.map((it, i) => (i === index ? { ...it, ...patch } : it)))

  const save = () => {
    const clean = items.filter((i) => i.name.trim()).map(toFood)
    if (!title.trim()) return setError('Give the meal a name.')
    if (clean.length === 0) return setError('Add at least one food.')
    setError(null)
    const onSuccess = () => onClose()
    if (existing) {
      update.mutate(
        { entryId: existing.id, patch: { mealType, title: title.trim(), items: clean, notes: notes.trim() || null } },
        { onSuccess, onError: (e) => setError(e.message) },
      )
    } else {
      log.mutate(
        {
          date,
          mealType,
          title: title.trim(),
          items: clean,
          notes: notes.trim() || null,
          source: analysis ? 'photo' : 'manual',
          photoDataUrl: photo?.photoDataUrl ?? null,
          thumbDataUrl: photo?.thumbDataUrl ?? null,
        },
        { onSuccess, onError: (e) => setError(e.message) },
      )
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={existing ? 'Edit meal' : 'Log a meal'}
      description={existing ? undefined : `For ${new Date(`${date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} loading={saving} disabled={analyze.isPending}>
            {existing ? 'Save changes' : 'Save meal'}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {!existing && (
          <section className="rounded-xl border border-dashed border-ink-600 bg-ink-900/40 p-4">
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => void onPickFile(e.target.files?.[0])}
            />
            {photo ? (
              <div className="flex flex-col gap-4 sm:flex-row">
                <img src={photo.photoDataUrl} alt="Your meal" className="aspect-[4/3] w-full rounded-lg object-cover sm:w-56" />
                <div className="min-w-0 flex-1 space-y-3">
                  {analyze.isPending ? (
                    <div className="flex items-center gap-3 text-sm text-chalk-dim" role="status">
                      <span className="size-5 animate-spin rounded-full border-2 border-ink-600 border-t-volt-400" />
                      Reading the plate… this takes a few seconds.
                    </div>
                  ) : analysis ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Sparkles className="size-4 text-volt-400" />
                        <p className="text-sm font-semibold text-chalk">{analysis.dishName}</p>
                        <ConfidenceBadge confidence={analysis.confidence} />
                      </div>
                      {analysis.notes && <p className="text-xs leading-relaxed text-chalk-dim">{analysis.notes}</p>}
                      <p className="text-xs text-chalk-faint">
                        Estimates from a photo are a starting point. Check the portions below and correct anything that looks off.
                      </p>
                    </div>
                  ) : photoAnalysis ? (
                    <p className="text-sm text-chalk-dim">Photo attached. Analyse it to fill in the foods, or type them in below.</p>
                  ) : (
                    <p className="text-sm text-chalk-dim">
                      Photo attached. Automatic calorie reading is not switched on for this studio yet, so type the foods in below.
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {photoAnalysis && (
                      <Button size="sm" variant={analysis ? 'outline' : 'primary'} loading={analyze.isPending} onClick={() => void runAnalysis()}>
                        <Sparkles className="size-4" /> {analysis ? 'Analyse again' : 'Analyse photo'}
                      </Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
                      <ImagePlus className="size-4" /> Change photo
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => { setPhoto(null); setAnalysis(null) }}>
                      <X className="size-4" /> Remove
                    </Button>
                  </div>
                  {photoAnalysis && (
                    <Input
                      value={hint}
                      onChange={(e) => setHint(e.target.value)}
                      placeholder="Optional hint, e.g. “half portion”, “oat milk”"
                      aria-label="Hint for the analysis"
                      maxLength={300}
                    />
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3 py-4 text-center">
                <span className="grid size-12 place-items-center rounded-full bg-ink-800 text-volt-400">
                  <Camera className="size-6" />
                </span>
                <div>
                  <p className="text-sm font-semibold text-chalk">Snap your plate</p>
                  <p className="mt-1 max-w-sm text-xs text-chalk-dim">
                    {photoAnalysis
                      ? 'We will identify the foods and estimate calories and macros. You can correct anything before saving.'
                      : 'Attach a photo for your diary, then type in what you ate.'}
                  </p>
                </div>
                <Button size="sm" onClick={() => fileInput.current?.click()}>
                  <ImagePlus className="size-4" /> Take or choose a photo
                </Button>
              </div>
            )}
          </section>
        )}

        <div className="grid gap-4 sm:grid-cols-[1fr_12rem]">
          <Input label="Meal" required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Chicken and rice" maxLength={120} />
          <Select label="Type" value={mealType} onChange={(e) => setMealType(e.target.value as MealType)}>
            {MEAL_ORDER.map((t) => (
              <option key={t} value={t}>
                {MEAL_TYPE_LABELS[t]}
              </option>
            ))}
          </Select>
        </div>

        <section>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-base tracking-wide text-chalk">Foods</h3>
            <p className="text-xs tabular-nums text-chalk-faint">
              {totals.calories} kcal · P {totals.proteinG} · C {totals.carbsG} · F {totals.fatG}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[36rem] text-sm">
              <thead>
                <tr className="text-left text-[11px] font-semibold uppercase tracking-wider text-chalk-faint">
                  <th className="pb-2 pr-2">Food</th>
                  <th className="pb-2 pr-2">Portion</th>
                  <th className="pb-2 pr-2 text-right">kcal</th>
                  <th className="pb-2 pr-2 text-right">P g</th>
                  <th className="pb-2 pr-2 text-right">C g</th>
                  <th className="pb-2 pr-2 text-right">F g</th>
                  <th className="pb-2" />
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-t border-ink-700">
                    <td className="py-1.5 pr-2">
                      <input aria-label={`Food ${i + 1}`} value={it.name} onChange={(e) => setItem(i, { name: e.target.value })} placeholder="e.g. Grilled chicken" className={cell} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input aria-label="Portion" value={it.portion} onChange={(e) => setItem(i, { portion: e.target.value })} placeholder="150 g" className={cn(cell, 'w-24')} />
                    </td>
                    {(['calories', 'proteinG', 'carbsG', 'fatG'] as const).map((k) => (
                      <td key={k} className="py-1.5 pr-2">
                        <input aria-label={k} inputMode="decimal" value={it[k]} onChange={(e) => setItem(i, { [k]: e.target.value })} className={cn(cell, 'w-16 text-right tabular-nums')} />
                      </td>
                    ))}
                    <td className="py-1.5">
                      <button
                        type="button"
                        aria-label="Remove food"
                        disabled={items.length === 1}
                        onClick={() => setItems((l) => l.filter((_, j) => j !== i))}
                        className="rounded-md p-1.5 text-chalk-faint hover:bg-ink-700 hover:text-danger-500 disabled:opacity-30"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button
            type="button"
            onClick={() => setItems((l) => [...l, blankItem()])}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-volt-400"
          >
            <Plus className="size-3.5" /> Add a food
          </button>
        </section>

        <Textarea label="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="How you felt, where you ate, anything for your coach." rows={2} maxLength={1000} />

        {error && (
          <p role="alert" className="rounded-lg border border-danger-500/35 bg-danger-500/10 px-3 py-2 text-sm text-danger-500">
            {error}
          </p>
        )}
      </div>
    </Modal>
  )
}

const cell =
  'h-9 w-full min-w-0 rounded-md border border-ink-600 bg-ink-900/80 px-2.5 text-sm text-chalk outline-none placeholder:text-chalk-faint focus:border-volt-400'
