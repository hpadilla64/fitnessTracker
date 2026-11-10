import { and, desc, eq, gte, isNotNull, lte, max } from 'drizzle-orm';
import { getDb } from '../client';
import { dailyMetrics, goals } from '../schema';
import type { Goal, GoalProgress, GoalProgressStatus, GoalUpdate, WeightPoint } from '@/types/api';

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

const DAY_MS = 86_400_000;
const r1 = (n: number) => Math.round(n * 10) / 10;
const dayNum = (d: string) => Date.parse(`${d}T00:00:00Z`) / DAY_MS;
const addDays = (d: string, n: number) => new Date((dayNum(d) + n) * DAY_MS).toISOString().slice(0, 10);

/** Pure: builds the progress view from a goal and its weigh-ins (ascending). */
export function buildGoalProgress(
  goal: Goal, weighIns: WeightPoint[], dataEndDate: string | null,
): GoalProgress {
  const startDate = goal.createdAt.slice(0, 10);
  const totalDays = goal.timeframeWeeks * 7;
  const endDate = addDays(startDate, totalDays);
  const diff = goal.targetWeightKg - goal.startWeightKg;
  const plan: WeightPoint[] = [];
  for (let w = 0; w <= goal.timeframeWeeks; w++) {
    plan.push({ date: addDays(startDate, w * 7), weightKg: r1(goal.startWeightKg + (diff * w) / goal.timeframeWeeks) });
  }
  const inRange = weighIns.filter((w) => w.date >= startDate && w.date <= endDate);
  const last = inRange[inRange.length - 1];
  let latest: GoalProgress['latest'] = null;
  let status: GoalProgressStatus = 'no_data';
  if (last) {
    const frac = (dayNum(last.date) - dayNum(startDate)) / totalDays;
    const plannedKg = r1(goal.startWeightKg + diff * frac);
    const deltaKg = r1(last.weightKg - plannedKg);
    latest = { ...last, plannedKg, deltaKg };
    if (Math.abs(deltaKg) <= 0.5) status = 'on_track';
    else if (diff === 0) status = 'behind';
    else status = (diff < 0 ? deltaKg < 0 : deltaKg > 0) ? 'ahead' : 'behind';
  }
  return { goal, startDate, endDate, plan, weighIns, latest, status, dataEndDate };
}

export function getGoalProgress(): GoalProgress | null {
  const goal = getActiveGoal();
  if (!goal) return null;
  const db = getDb();
  const startDate = goal.createdAt.slice(0, 10);
  const from = addDays(startDate, -56);
  const to = addDays(startDate, goal.timeframeWeeks * 7);
  const rows = db.select({ date: dailyMetrics.date, weightKg: dailyMetrics.weightKg }).from(dailyMetrics)
    .where(and(isNotNull(dailyMetrics.weightKg), gte(dailyMetrics.date, from), lte(dailyMetrics.date, to)))
    .orderBy(dailyMetrics.date).all();
  const weighIns = rows.map((r) => ({ date: r.date, weightKg: r.weightKg as number }));
  const end = db.select({ d: max(dailyMetrics.date) }).from(dailyMetrics).get();
  return buildGoalProgress(goal, weighIns, end?.d ?? null);
}
