import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const profile = sqliteTable('profile', {
  id: integer('id').primaryKey(),
  sex: text('sex'),
  dob: text('dob'),
  bloodType: text('blood_type'),
  currentWeight: real('current_weight'),
  currentBMI: real('current_bmi'),
  currentLeanMass: real('current_lean_mass'),
  totalWorkouts: integer('total_workouts').notNull(),
  totalActiveCalories: real('total_active_calories').notNull(),
  totalSteps: integer('total_steps').notNull(),
  totalDistanceKm: real('total_distance_km').notNull(),
  dateStart: text('date_start').notNull(),
  dateEnd: text('date_end').notNull(),
  avgDailySteps30d: real('avg_daily_steps_30d').notNull(),
  avgActiveKcal30d: real('avg_active_kcal_30d').notNull(),
  avgBasalKcal30d: real('avg_basal_kcal_30d').notNull(),
  avgRestingHR30d: real('avg_resting_hr_30d').notNull(),
  recentVO2Max: real('recent_vo2_max').notNull(),
  workoutTypeCounts: text('workout_type_counts', { mode: 'json' }).$type<Record<string, number>>().notNull(),
});

export const dailyMetrics = sqliteTable('daily_metrics', {
  date: text('date').primaryKey(),
  steps: integer('steps').notNull(),
  distanceKm: real('distance_km').notNull(),
  activeKcal: real('active_kcal').notNull(),
  basalKcal: real('basal_kcal').notNull(),
  exerciseMinutes: real('exercise_minutes').notNull(),
  standMinutes: real('stand_minutes').notNull(),
  flightsClimbed: integer('flights_climbed').notNull(),
  avgHeartRate: real('avg_heart_rate'),
  restingHR: real('resting_hr'),
  walkingHR: real('walking_hr'),
  hrv: real('hrv'),
  vo2max: real('vo2max'),
  weightKg: real('weight_kg'),
  bmi: real('bmi'),
  leanMassKg: real('lean_mass_kg'),
  sleepHours: real('sleep_hours').notNull(),
});

export const workouts = sqliteTable('workouts', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  durationMinutes: real('duration_minutes').notNull(),
  distanceKm: real('distance_km').notNull(),
  energyKcal: real('energy_kcal').notNull(),
  routePath: text('route_path'),
});

export const routes = sqliteTable('routes', {
  filename: text('filename').primaryKey(),
  pointCount: integer('point_count').notNull(),
  distanceKm: real('distance_km').notNull(),
  startLat: real('start_lat').notNull(),
  startLon: real('start_lon').notNull(),
  startEle: real('start_ele').notNull(),
  endLat: real('end_lat').notNull(),
  endLon: real('end_lon').notNull(),
  endEle: real('end_ele').notNull(),
  points: text('points', { mode: 'json' }).$type<{ lat: number; lon: number; ele: number }[]>().notNull(),
});

export const userPreferences = sqliteTable('user_preferences', {
  id: integer('id').primaryKey(),
  timeRange: text('time_range').notNull(),
  activeTab: text('active_tab').notNull(),
  units: text('units').notNull(),
  trainingFocus: text('training_focus'),
  workoutDaysPerWeek: integer('workout_days_per_week'),
  sessionMinutes: integer('session_minutes'),
  equipment: text('equipment', { mode: 'json' }).$type<string[]>().notNull(),
  limitations: text('limitations').notNull(),
  excludedExerciseIds: text('excluded_exercise_ids', { mode: 'json' }).$type<number[]>().notNull(),
});

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull(),
  targetWeightKg: real('target_weight_kg').notNull(),
  timeframeWeeks: integer('timeframe_weeks').notNull(),
  startWeightKg: real('start_weight_kg').notNull(),
  active: integer('active', { mode: 'boolean' }).notNull(),
});

export const catalogExercises = sqliteTable('catalog_exercises', {
  id: integer('id').primaryKey(), // wger id
  name: text('name').notNull(),
  category: text('category'),
  muscles: text('muscles', { mode: 'json' }).$type<string[]>().notNull(),
  equipment: text('equipment', { mode: 'json' }).$type<string[]>().notNull(),
  license: text('license'),
  author: text('author'),
});

export const catalogSyncs = sqliteTable('catalog_syncs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  syncedAt: text('synced_at').notNull(),
  exerciseCount: integer('exercise_count').notNull(),
  source: text('source').notNull(),
});

export const recommendations = sqliteTable('recommendations', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  createdAt: text('created_at').notNull(),
  goalId: integer('goal_id'),
  inputHash: text('input_hash').notNull(),
  source: text('source', { enum: ['ai', 'fallback'] }).notNull(),
  model: text('model'),
  planJson: text('plan_json', { mode: 'json' }).notNull(),
  inputTokens: integer('input_tokens'),
  outputTokens: integer('output_tokens'),
  cacheReadTokens: integer('cache_read_tokens'),
  costUsd: real('cost_usd'),
});

export const ingestRuns = sqliteTable('ingest_runs', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  source: text('source').notNull(),
  state: text('state').notNull(), // running | succeeded | failed
  progress: real('progress'),
  counts: text('counts', { mode: 'json' }).$type<Record<string, number>>(),
  startedAt: text('started_at').notNull(),
  finishedAt: text('finished_at'),
  error: text('error'),
});
