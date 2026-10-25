import { getDb } from '../client';
import { userPreferences } from '../schema';
import type { PreferencesUpdate, UserPreferences } from '@/types/api';

export const DEFAULT_PREFERENCES: UserPreferences = {
  timeRange: '1y', activeTab: 'metrics', units: 'metric', trainingFocus: null,
  workoutDaysPerWeek: null, sessionMinutes: null, equipment: [], limitations: '', excludedExerciseIds: [],
};

export function getPreferences(): UserPreferences {
  const r = getDb().select().from(userPreferences).get();
  if (!r) return { ...DEFAULT_PREFERENCES };
  const { id: _id, ...rest } = r;
  return rest as UserPreferences;
}

export function updatePreferences(patch: PreferencesUpdate): UserPreferences {
  const merged: UserPreferences = { ...getPreferences(), ...patch };
  getDb().insert(userPreferences).values({ id: 1, ...merged })
    .onConflictDoUpdate({ target: userPreferences.id, set: merged }).run();
  return merged;
}
