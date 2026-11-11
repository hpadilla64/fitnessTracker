// Request/response shapes for /api/*. Spec: .agents/contracts/data-contract.md › API
import { DailyMetric, GpxRoute, TrainingFocus, Workout } from './index';

export type TimeRangeKey = '30d' | '90d' | '1y' | '3y' | 'all';
export type AggregationPeriod = 'daily' | 'weekly' | 'monthly';
export type TabKey = 'metrics' | 'planner' | 'workouts';

export interface ApiError {
  error: string;
  code?: 'NO_DATA' | 'NOT_FOUND' | 'BAD_REQUEST' | 'INTERNAL' | 'CONFLICT' | 'NO_INPUT';
}

export type IngestState = 'running' | 'succeeded' | 'failed';
export type IngestPhase = 'records' | 'routes' | 'writing';

export interface IngestJob {
  id: number;
  state: IngestState;
  phase: IngestPhase | null; // only while running
  progress: number | null; // 0–1 over the whole job
  counts: Record<string, number> | null; // records, days, workouts, routes
  startedAt: string; // ISO timestamp
  finishedAt: string | null;
  error: string | null;
}

export interface StatusResponse {
  hasData: boolean;
  lastProcessedAt: string | null; // ISO timestamp of the last successful import
  dataRange: { start: string; end: string } | null;
  counts: { days: number; workouts: number; routes: number };
  catalogSyncedAt: string | null;
  aiConfigured: boolean;
}

export interface AggregatedMetric {
  date: string; // YYYY-MM-DD, or period start for weekly/monthly
  steps: number;
  distanceKm: number;
  activeKcal: number;
  basalKcal: number;
  restingHR: number | null;
  vo2max: number | null;
  weightKg: number | null;
  bmi: number | null;
}

export interface DailyResponse {
  range: TimeRangeKey;
  period: AggregationPeriod;
  daily: DailyMetric[]; // every day in range, ascending
  aggregated: AggregatedMetric[]; // chart series at `period` granularity
}

// Workout history row; route points are fetched separately via /api/health/routes/[filename]
export interface WorkoutSummary extends Omit<Workout, 'routeData'> {
  hasRoute: boolean;
}

export type RouteResponse = GpxRoute;

export interface UserPreferences {
  timeRange: TimeRangeKey;
  activeTab: TabKey;
  units: 'metric';
  trainingFocus: TrainingFocus | null;
  workoutDaysPerWeek: number | null;
  sessionMinutes: number | null;
  equipment: string[];
  limitations: string;
  excludedExerciseIds: number[];
}

export type PreferencesUpdate = Partial<UserPreferences>;

export interface Goal {
  id: number;
  createdAt: string; // ISO timestamp
  startWeightKg: number;
  targetWeightKg: number;
  timeframeWeeks: number;
}

export interface GoalUpdate {
  startWeightKg: number;
  targetWeightKg: number;
  timeframeWeeks: number;
}

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  weightKg: number;
}

export type GoalProgressStatus = 'ahead' | 'on_track' | 'behind' | 'no_data';

export interface GoalProgress {
  goal: Goal;
  startDate: string; // YYYY-MM-DD, date part of goal.createdAt
  endDate: string; // startDate + timeframeWeeks
  plan: WeightPoint[]; // weekly, linear from startWeightKg to targetWeightKg
  weighIns: WeightPoint[]; // from startDate − 8 weeks to endDate, ascending
  latest: (WeightPoint & { plannedKg: number; deltaKg: number }) | null; // latest weigh-in in [startDate, endDate]
  status: GoalProgressStatus;
  dataEndDate: string | null; // last date in the imported health data
}
