// Typed client for the /api/* endpoints (contract: .agents/contracts/data-contract.md › API)
import type { UserProfile, GpxRoute } from '../types';
import type {
  StatusResponse,
  DailyResponse,
  WorkoutSummary,
  UserPreferences,
  PreferencesUpdate,
  Goal,
  GoalUpdate,
  GoalProgress,
  IngestJob,
  CatalogSummary,
  CatalogExercisesResponse,
  CatalogSyncJob,
  TimeRangeKey,
} from '../types/api';

export type { TimeRangeKey };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.code ? `${body.error} (${body.code})` : body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(`${url}: ${msg}`);
  }
  return res.json() as Promise<T>;
}

export const fetchStatus = () => request<StatusResponse>('/api/status');
export const fetchProfile = () => request<UserProfile>('/api/health/profile');
export const fetchDaily = (range: TimeRangeKey) =>
  request<DailyResponse>(`/api/health/daily?range=${encodeURIComponent(range)}`);
export const fetchWorkouts = () => request<WorkoutSummary[]>('/api/workouts');
export const fetchRoute = (filename: string) =>
  request<GpxRoute>(`/api/health/routes/${encodeURIComponent(filename)}`);
export const fetchPreferences = () => request<UserPreferences>('/api/preferences');
export const updatePreferences = (update: PreferencesUpdate) =>
  request<UserPreferences>('/api/preferences', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });

export const fetchGoal = () => request<Goal | null>('/api/goals');
export const saveGoal = (update: GoalUpdate) =>
  request<Goal>('/api/goals', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(update),
  });

export const fetchGoalProgress = () => request<GoalProgress | null>('/api/goals/progress');

export const startProcessData = () => request<IngestJob>('/api/process-data', { method: 'POST' });
export const fetchIngestJob = () => request<IngestJob | null>('/api/process-data');

export interface CatalogExercisesParams {
  q?: string;
  category?: string;
  equipment?: string;
  muscle?: string;
  limit?: number;
  offset?: number;
}

export const fetchCatalogSummary = () => request<CatalogSummary>('/api/catalog');
export const fetchCatalogExercises = (params: CatalogExercisesParams = {}) => {
  const qs = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  });
  return request<CatalogExercisesResponse>(`/api/catalog/exercises?${qs}`);
};
export const startCatalogSync = () => request<CatalogSyncJob>('/api/catalog/sync', { method: 'POST' });
export const fetchCatalogSync = () => request<CatalogSyncJob | null>('/api/catalog/sync');
