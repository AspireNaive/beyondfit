import type { Role } from '@/domain/identity/model'
import type { DietPlanId, FoodEntryId, IsoDate, IsoDateTime, TenantId, UserId } from '@/domain/shared/types'

/**
 * Nutrition — what a member eats (the food diary) and what their coach wants
 * them to eat (the diet plan). Calories and macros are stored per item so a
 * photo estimate can be corrected line by line before it is saved.
 */

export const MealType = {
  Breakfast: 'breakfast',
  Lunch: 'lunch',
  Dinner: 'dinner',
  Snack: 'snack',
} as const
export type MealType = (typeof MealType)[keyof typeof MealType]

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
}

export const MEAL_ORDER: readonly MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export type Macros = {
  readonly calories: number
  readonly proteinG: number
  readonly carbsG: number
  readonly fatG: number
}

export const ZERO_MACROS: Macros = { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 }

export const sumMacros = (items: readonly Macros[]): Macros =>
  items.reduce(
    (t, i) => ({
      calories: t.calories + i.calories,
      proteinG: t.proteinG + i.proteinG,
      carbsG: t.carbsG + i.carbsG,
      fatG: t.fatG + i.fatG,
    }),
    ZERO_MACROS,
  )

export type FoodItem = Macros & {
  readonly name: string
  /** Everyday portion, e.g. "1 cup", "150 g". */
  readonly portion: string
}

export type AnalysisConfidence = 'low' | 'medium' | 'high'

/** What the photo analyser returns. Nothing is saved until the member confirms. */
export type FoodAnalysis = {
  readonly dishName: string
  readonly items: readonly FoodItem[]
  readonly totals: Macros
  readonly confidence: AnalysisConfidence
  readonly notes: string | null
  readonly model: string
}

export type FoodSource = 'manual' | 'photo'

export type FoodEntry = {
  readonly id: FoodEntryId
  readonly tenantId: TenantId
  readonly memberId: UserId
  readonly date: IsoDate
  readonly mealType: MealType
  readonly loggedAt: IsoDateTime
  readonly title: string
  readonly items: readonly FoodItem[]
  readonly totals: Macros
  readonly notes: string | null
  readonly source: FoodSource
  /** Small inline preview; the full photo is fetched on demand. */
  readonly thumbDataUrl: string | null
  readonly hasPhoto: boolean
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type FoodEntryInput = {
  readonly date: IsoDate
  readonly mealType: MealType
  readonly title: string
  readonly items: readonly FoodItem[]
  readonly notes?: string | null
  readonly source?: FoodSource
  /** Downsized JPEG as a data URL, plus a tiny thumbnail for the list. */
  readonly photoDataUrl?: string | null
  readonly thumbDataUrl?: string | null
}

export type FoodEntryPatch = Partial<Pick<FoodEntryInput, 'date' | 'mealType' | 'title' | 'items' | 'notes'>>

export type DailyTotals = { readonly date: IsoDate; readonly totals: Macros; readonly meals: number }

export type DietPlanMeal = {
  readonly name: string
  readonly time: string | null
  readonly description: string
  readonly calories: number | null
}

export type DietPlan = {
  readonly id: DietPlanId
  readonly tenantId: TenantId
  readonly memberId: UserId
  readonly authorId: UserId
  readonly authorName: string
  readonly authorRole: Role
  readonly title: string
  readonly summary: string
  readonly targets: Macros
  readonly meals: readonly DietPlanMeal[]
  readonly guidelines: readonly string[]
  readonly status: 'active' | 'archived'
  readonly createdAt: IsoDateTime
  readonly updatedAt: IsoDateTime
}

export type DietPlanInput = {
  readonly title: string
  readonly summary: string
  readonly targets: Macros
  readonly meals: readonly DietPlanMeal[]
  readonly guidelines: readonly string[]
}

export type NutritionCapabilities = {
  readonly photoAnalysis: boolean
  readonly model: string | null
  /** The studio's cap per member per day, and where this member stands today. */
  readonly dailyLimit: number
  readonly usedToday: number
  readonly remainingToday: number
}

/** Calories implied by the macros — a sanity check the editor shows. */
export const macroCalories = (m: Macros) => Math.round(m.proteinG * 4 + m.carbsG * 4 + m.fatG * 9)

/** Share of a daily target, clamped for progress bars. */
export const targetShare = (value: number, target: number) => (target > 0 ? Math.min(1, value / target) : 0)

export const CONFIDENCE_LABELS: Record<AnalysisConfidence, string> = {
  low: 'Rough estimate',
  medium: 'Reasonable estimate',
  high: 'Confident estimate',
}
