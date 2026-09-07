import type { IsoDate, MetricEntryId, UserId } from '@/domain/shared/types'

/**
 * Progress context — body composition, activity and goals for one member.
 *
 * Everything is stored metric (kg / cm / kcal). Imperial is a display
 * preference applied at the edge, so no conversion drift creeps into stored
 * history when a member switches units.
 */

export type UnitSystem = 'metric' | 'imperial'

export type BodyMetricEntry = {
  readonly id: MetricEntryId
  readonly memberId: UserId
  readonly recordedOn: IsoDate
  readonly weightKg: number
  readonly heightCm: number
  readonly bodyFatPercent?: number
  readonly restingHeartRate?: number
  readonly waistCm?: number
  readonly note?: string
}

export type ActivityEntry = {
  readonly memberId: UserId
  readonly date: IsoDate
  readonly steps: number
  readonly activeMinutes: number
  readonly caloriesBurned: number
  readonly caloriesConsumed: number
  readonly proteinGrams: number
  readonly waterMl: number
  readonly sleepHours: number
  readonly workouts: number
}

export type MemberGoal = {
  readonly memberId: UserId
  readonly targetWeightKg?: number
  readonly dailyCalorieTarget: number
  readonly dailyProteinTarget: number
  readonly dailyStepTarget: number
  readonly weeklyWorkoutTarget: number
  readonly focus: string
}

// ---------------------------------------------------------------------------
// Calculations. Pure functions — no I/O, trivially unit-testable, and the same
// numbers the API computes server-side.
// ---------------------------------------------------------------------------

export const calculateBmi = (weightKg: number, heightCm: number): number => {
  if (heightCm <= 0) return 0
  const heightM = heightCm / 100
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10
}

/** WHO cut-offs. `min` is carried so a meter can size each band correctly
 *  rather than guessing its width from `max` alone. */
export const BMI_BANDS = [
  { min: 0, max: 18.5, label: 'Underweight', tone: 'info' },
  { min: 18.5, max: 25, label: 'Healthy', tone: 'ok' },
  { min: 25, max: 30, label: 'Overweight', tone: 'warn' },
  { min: 30, max: Infinity, label: 'Obese', tone: 'danger' },
] as const

export type BmiBand = (typeof BMI_BANDS)[number]

export const bmiBand = (bmi: number): BmiBand =>
  BMI_BANDS.find((band) => bmi < band.max) ?? BMI_BANDS[BMI_BANDS.length - 1]!

/** Display window for the BMI meter. Below 15 and above 40 is clinically rare
 *  and would squash the bands that matter into nothing. */
export const BMI_SCALE_MIN = 15
export const BMI_SCALE_MAX = 40

/** A band's share of the meter track, as a percentage. */
export const bmiBandWidth = (band: BmiBand): number => {
  const lo = Math.max(band.min, BMI_SCALE_MIN)
  const hi = Math.min(band.max, BMI_SCALE_MAX)
  return ((hi - lo) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100
}

/** Marker position along the meter track, clamped to the window. */
export const bmiMarkerPosition = (bmi: number): number =>
  Math.min(100, Math.max(0, ((bmi - BMI_SCALE_MIN) / (BMI_SCALE_MAX - BMI_SCALE_MIN)) * 100))

/** Mifflin–St Jeor, the estimator most coaching software standardises on. */
export const basalMetabolicRate = (input: {
  weightKg: number
  heightCm: number
  age: number
  sex: 'male' | 'female'
}): number => {
  const base = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age
  return Math.round(input.sex === 'male' ? base + 5 : base - 161)
}

export const ACTIVITY_FACTORS = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  high: 1.725,
  athlete: 1.9,
} as const

export type ActivityLevel = keyof typeof ACTIVITY_FACTORS

export const dailyEnergyExpenditure = (bmr: number, level: ActivityLevel): number =>
  Math.round(bmr * ACTIVITY_FACTORS[level])

export const kgToLb = (kg: number) => Math.round(kg * 2.20462 * 10) / 10
export const lbToKg = (lb: number) => Math.round((lb / 2.20462) * 10) / 10
export const cmToFtIn = (cm: number) => {
  const totalInches = cm / 2.54
  return { feet: Math.floor(totalInches / 12), inches: Math.round(totalInches % 12) }
}

export const formatWeight = (kg: number, units: UnitSystem) =>
  units === 'metric' ? `${Math.round(kg * 10) / 10} kg` : `${kgToLb(kg)} lb`

export const formatHeight = (cm: number, units: UnitSystem) => {
  if (units === 'metric') return `${Math.round(cm)} cm`
  const { feet, inches } = cmToFtIn(cm)
  return `${feet}'${inches}"`
}

/** Net energy balance for a day: positive means a surplus. */
export const energyBalance = (entry: ActivityEntry) =>
  entry.caloriesConsumed - entry.caloriesBurned

/** Change between the first and last entry of a series, oldest-first. */
export const seriesDelta = (values: readonly number[]): number => {
  if (values.length < 2) return 0
  const first = values[0]!
  const last = values[values.length - 1]!
  return Math.round((last - first) * 10) / 10
}

/**
 * Consecutive days, counting back from the most recent entry, where the member
 * met their step target. Assumes `entries` is sorted oldest-first.
 */
export const currentStreak = (
  entries: readonly ActivityEntry[],
  stepTarget: number,
): number => {
  let streak = 0
  for (let i = entries.length - 1; i >= 0; i--) {
    if (entries[i]!.steps < stepTarget) break
    streak++
  }
  return streak
}
