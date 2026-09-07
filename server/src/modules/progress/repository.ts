import { col, db, docOf, Timestamp as Ts } from '../../db/firestore.js'
import type { ActivityEntry, BodyMetricEntry, MemberGoal } from '../../domain.js'

/** Document ids are `${memberId}_${day}`, which makes same-day logging an overwrite. */
const metricId = (memberId: string, day: string) => `${memberId}_${day}`

type MetricDoc = Omit<BodyMetricEntry, 'id' | 'bodyFatPercent' | 'restingHeartRate' | 'waistCm' | 'note'> & {
  bodyFatPercent: number | null
  restingHeartRate: number | null
  waistCm: number | null
  note: string | null
}

const metrics = () => db.collection(col.bodyMetrics)
const activity = () => db.collection(col.activity)
const goals = () => db.collection(col.goals)

const toMetric = (id: string, d: MetricDoc): BodyMetricEntry => ({
  id,
  memberId: d.memberId,
  recordedOn: d.recordedOn,
  weightKg: d.weightKg,
  heightCm: d.heightCm,
  ...(d.bodyFatPercent != null ? { bodyFatPercent: d.bodyFatPercent } : {}),
  ...(d.restingHeartRate != null ? { restingHeartRate: d.restingHeartRate } : {}),
  ...(d.waistCm != null ? { waistCm: d.waistCm } : {}),
  ...(d.note ? { note: d.note } : {}),
})

export async function listBodyMetrics(memberId: string): Promise<BodyMetricEntry[]> {
  const snap = await metrics().where('memberId', '==', memberId).orderBy('recordedOn').get()
  return snap.docs.map((d) => toMetric(d.id, d.data() as MetricDoc))
}

export function metricDoc(entry: Omit<BodyMetricEntry, 'id'>): { id: string; data: MetricDoc } {
  return {
    id: metricId(entry.memberId, entry.recordedOn),
    data: {
      memberId: entry.memberId,
      recordedOn: entry.recordedOn,
      weightKg: entry.weightKg,
      heightCm: entry.heightCm,
      bodyFatPercent: entry.bodyFatPercent ?? null,
      restingHeartRate: entry.restingHeartRate ?? null,
      waistCm: entry.waistCm ?? null,
      note: entry.note ?? null,
    },
  }
}

/** Same-day re-logging overwrites rather than creating a duplicate point. */
export async function upsertBodyMetric(entry: Omit<BodyMetricEntry, 'id'>): Promise<BodyMetricEntry> {
  const { id, data } = metricDoc(entry)
  await metrics().doc(id).set({ ...data, updatedAt: Ts.now() })
  return toMetric(id, data)
}

export async function listActivity(memberId: string, days: number): Promise<ActivityEntry[]> {
  // Newest `days` rows, returned oldest-first — what the charts expect.
  const snap = await activity().where('memberId', '==', memberId).orderBy('date', 'desc').limit(days).get()
  return snap.docs.map((d) => d.data() as ActivityEntry).reverse()
}

export const activityId = (e: Pick<ActivityEntry, 'memberId' | 'date'>) => `${e.memberId}_${e.date}`

export async function upsertActivity(entry: ActivityEntry): Promise<ActivityEntry> {
  await activity().doc(activityId(entry)).set({ ...entry, updatedAt: Ts.now() })
  return entry
}

export const DEFAULT_GOAL = (memberId: string): MemberGoal => ({
  memberId,
  dailyCalorieTarget: 2200,
  dailyProteinTarget: 150,
  dailyStepTarget: 10_000,
  weeklyWorkoutTarget: 4,
  focus: 'General health',
})

type GoalDoc = Omit<MemberGoal, 'targetWeightKg'> & { targetWeightKg: number | null }

export async function getGoal(memberId: string): Promise<MemberGoal> {
  const row = docOf<GoalDoc>(await goals().doc(memberId).get())
  if (!row) return DEFAULT_GOAL(memberId)
  const { targetWeightKg, ...rest } = row
  return { ...rest, memberId, ...(targetWeightKg != null ? { targetWeightKg } : {}) }
}

export async function upsertGoal(goal: MemberGoal): Promise<MemberGoal> {
  const doc: GoalDoc = { ...goal, targetWeightKg: goal.targetWeightKg ?? null }
  await goals().doc(goal.memberId).set({ ...doc, updatedAt: Ts.now() })
  return getGoal(goal.memberId)
}
