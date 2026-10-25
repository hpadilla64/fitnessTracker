import { count, desc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { dailyMetrics, profile, routes, workouts } from '../schema';
import type { DailyMetric, GpxRoute, UserProfile } from '@/types';
import type { WorkoutSummary } from '@/types/api';

export function getProfile(): UserProfile | null {
  const r = getDb().select().from(profile).get();
  if (!r) return null;
  const { id: _id, dateStart, dateEnd, ...rest } = r;
  return { ...rest, dateRange: { start: dateStart, end: dateEnd } };
}

export function getAllDaily(): DailyMetric[] {
  return getDb().select().from(dailyMetrics).orderBy(dailyMetrics.date).all();
}

export function getWorkoutSummaries(): WorkoutSummary[] {
  const db = getDb();
  const rows = db.select().from(workouts).orderBy(desc(workouts.startDate)).all();
  const names = new Set(db.select({ f: routes.filename }).from(routes).all().map((r) => r.f));
  return rows.map((w) => ({
    ...w,
    hasRoute: !!w.routePath && names.has(w.routePath.split('/').pop()!),
  }));
}

export function getRoute(filename: string): GpxRoute | null {
  const r = getDb().select().from(routes).where(eq(routes.filename, filename)).get();
  if (!r) return null;
  return {
    filename: r.filename,
    pointCount: r.pointCount,
    distanceKm: r.distanceKm,
    startPoint: { lat: r.startLat, lon: r.startLon, ele: r.startEle },
    endPoint: { lat: r.endLat, lon: r.endLon, ele: r.endEle },
    points: r.points,
  };
}

export function getCounts() {
  const db = getDb();
  const n = (t: typeof dailyMetrics | typeof workouts | typeof routes) =>
    db.select({ c: count() }).from(t).get()!.c;
  return { days: n(dailyMetrics), workouts: n(workouts), routes: n(routes) };
}
