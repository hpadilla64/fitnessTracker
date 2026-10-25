import { desc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { goals } from '../schema';
import type { Goal, GoalUpdate } from '@/types/api';

type Row = typeof goals.$inferSelect;

function toGoal(r: Row): Goal {
  return {
    id: r.id, createdAt: r.createdAt, startWeightKg: r.startWeightKg,
    targetWeightKg: r.targetWeightKg, timeframeWeeks: r.timeframeWeeks,
  };
}

export function getActiveGoal(): Goal | null {
  const r = getDb().select().from(goals).where(eq(goals.active, true)).orderBy(desc(goals.id)).get();
  return r ? toGoal(r) : null;
}

export function setGoal(update: GoalUpdate): Goal {
  return getDb().transaction((tx) => {
    const cur = tx.select().from(goals).where(eq(goals.active, true)).orderBy(desc(goals.id)).get();
    if (cur && cur.startWeightKg === update.startWeightKg
      && cur.targetWeightKg === update.targetWeightKg && cur.timeframeWeeks === update.timeframeWeeks) {
      return toGoal(cur);
    }
    tx.update(goals).set({ active: false }).where(eq(goals.active, true)).run();
    const row = tx.insert(goals).values({
      createdAt: new Date().toISOString(), targetWeightKg: update.targetWeightKg,
      timeframeWeeks: update.timeframeWeeks, startWeightKg: update.startWeightKg, active: true,
    }).returning().get();
    return toGoal(row);
  });
}
