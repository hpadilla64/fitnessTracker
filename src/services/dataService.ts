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
  TimeRangeKey,
} from '../types/api';

export type { TimeRangeKey };

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) {
    let msg = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
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
