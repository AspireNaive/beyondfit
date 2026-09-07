import type { RowDataPacket } from 'mysql2/promise'
import type { Db } from '../../db/pool.js'
import { execute, pool, query, queryOne } from '../../db/pool.js'
import type { ActivityEntry, BodyMetricEntry, MemberGoal } from '../../domain.js'

interface MetricRow extends RowDataPacket {
  id: string
  member_id: string
  recorded_on: string
  weight_kg: number
  height_cm: number
  body_fat_percent: number | null
  resting_heart_rate: number | null
  waist_cm: number | null
  note: string | null
}

const toMetric = (r: MetricRow): BodyMetricEntry => ({
  id: r.id,
  memberId: r.member_id,
  recordedOn: r.recorded_on,
  weightKg: Number(r.weight_kg),
  heightCm: Number(r.height_cm),
  ...(r.body_fat_percent != null ? { bodyFatPercent: Number(r.body_fat_percent) } : {}),
  ...(r.resting_heart_rate != null ? { restingHeartRate: r.resting_heart_rate } : {}),
  ...(r.waist_cm != null ? { waistCm: Number(r.waist_cm) } : {}),
  ...(r.note ? { note: r.note } : {}),
})

const METRIC_COLS = 'id, member_id, recorded_on, weight_kg, height_cm, body_fat_percent, resting_heart_rate, waist_cm, note'

export async function listBodyMetrics(memberId: string, db: Db = pool): Promise<BodyMetricEntry[]> {
  const rows = await query<MetricRow>(`SELECT ${METRIC_COLS} FROM body_metrics WHERE member_id = ? ORDER BY recorded_on`, [memberId], db)
  return rows.map(toMetric)
}

/** Same-day re-logging overwrites rather than creating a duplicate point. */
export async function upsertBodyMetric(entry: Omit<BodyMetricEntry, 'id'> & { id: string }, db: Db = pool): Promise<BodyMetricEntry> {
  await execute(
    `INSERT INTO body_metrics (id, member_id, recorded_on, weight_kg, height_cm, body_fat_percent, resting_heart_rate, waist_cm, note)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE weight_kg = VALUES(weight_kg), height_cm = VALUES(height_cm), body_fat_percent = VALUES(body_fat_percent),
       resting_heart_rate = VALUES(resting_heart_rate), waist_cm = VALUES(waist_cm), note = VALUES(note)`,
    [
      entry.id, entry.memberId, entry.recordedOn, entry.weightKg, entry.heightCm,
      entry.bodyFatPercent ?? null, entry.restingHeartRate ?? null, entry.waistCm ?? null, entry.note ?? null,
    ],
    db,
  )
  const row = await queryOne<MetricRow>(`SELECT ${METRIC_COLS} FROM body_metrics WHERE member_id = ? AND recorded_on = ?`, [entry.memberId, entry.recordedOn], db)
  return toMetric(row!)
}

interface ActivityRow extends RowDataPacket {
  member_id: string
  date: string
  steps: number
  active_minutes: number
  calories_burned: number
  calories_consumed: number
  protein_grams: number
  water_ml: number
  sleep_hours: number
  workouts: number
}

const toActivity = (r: ActivityRow): ActivityEntry => ({
  memberId: r.member_id,
  date: r.date,
  steps: r.steps,
  activeMinutes: r.active_minutes,
  caloriesBurned: r.calories_burned,
  caloriesConsumed: r.calories_consumed,
  proteinGrams: r.protein_grams,
  waterMl: r.water_ml,
  sleepHours: Number(r.sleep_hours),
  workouts: r.workouts,
})

export async function listActivity(memberId: string, days: number, db: Db = pool): Promise<ActivityEntry[]> {
  // Newest `days` rows, returned oldest-first — matches the chart's expectation.
  const rows = await query<ActivityRow>(
    `SELECT * FROM (SELECT member_id, \`date\`, steps, active_minutes, calories_burned, calories_consumed, protein_grams, water_ml, sleep_hours, workouts
                    FROM activity_entries WHERE member_id = ? ORDER BY \`date\` DESC LIMIT ?) recent ORDER BY \`date\``,
    [memberId, days],
    db,
  )
  return rows.map(toActivity)
}

export async function upsertActivity(entry: ActivityEntry, db: Db = pool): Promise<ActivityEntry> {
  await execute(
    `INSERT INTO activity_entries (member_id, \`date\`, steps, active_minutes, calories_burned, calories_consumed, protein_grams, water_ml, sleep_hours, workouts)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE steps = VALUES(steps), active_minutes = VALUES(active_minutes), calories_burned = VALUES(calories_burned),
       calories_consumed = VALUES(calories_consumed), protein_grams = VALUES(protein_grams), water_ml = VALUES(water_ml),
       sleep_hours = VALUES(sleep_hours), workouts = VALUES(workouts)`,
    [
      entry.memberId, entry.date, entry.steps, entry.activeMinutes, entry.caloriesBurned, entry.caloriesConsumed,
      entry.proteinGrams, entry.waterMl, entry.sleepHours, entry.workouts,
    ],
    db,
  )
  return entry
}

interface GoalRow extends RowDataPacket {
  member_id: string
  target_weight_kg: number | null
  daily_calorie_target: number
  daily_protein_target: number
  daily_step_target: number
  weekly_workout_target: number
  focus: string
}

export const DEFAULT_GOAL = (memberId: string): MemberGoal => ({
  memberId,
  dailyCalorieTarget: 2200,
  dailyProteinTarget: 150,
  dailyStepTarget: 10_000,
  weeklyWorkoutTarget: 4,
  focus: 'General health',
})

export async function getGoal(memberId: string, db: Db = pool): Promise<MemberGoal> {
  const r = await queryOne<GoalRow>('SELECT * FROM member_goals WHERE member_id = ?', [memberId], db)
  if (!r) return DEFAULT_GOAL(memberId)
  return {
    memberId: r.member_id,
    ...(r.target_weight_kg != null ? { targetWeightKg: Number(r.target_weight_kg) } : {}),
    dailyCalorieTarget: r.daily_calorie_target,
    dailyProteinTarget: r.daily_protein_target,
    dailyStepTarget: r.daily_step_target,
    weeklyWorkoutTarget: r.weekly_workout_target,
    focus: r.focus,
  }
}

export async function upsertGoal(goal: MemberGoal, db: Db = pool): Promise<MemberGoal> {
  await execute(
    `INSERT INTO member_goals (member_id, target_weight_kg, daily_calorie_target, daily_protein_target, daily_step_target, weekly_workout_target, focus)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE target_weight_kg = VALUES(target_weight_kg), daily_calorie_target = VALUES(daily_calorie_target),
       daily_protein_target = VALUES(daily_protein_target), daily_step_target = VALUES(daily_step_target),
       weekly_workout_target = VALUES(weekly_workout_target), focus = VALUES(focus)`,
    [goal.memberId, goal.targetWeightKg ?? null, goal.dailyCalorieTarget, goal.dailyProteinTarget, goal.dailyStepTarget, goal.weeklyWorkoutTarget, goal.focus],
    db,
  )
  return getGoal(goal.memberId, db)
}
