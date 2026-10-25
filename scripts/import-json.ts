// One-off: load public/data/*.json into SQLite. Usage: npm run db:import-json
import fs from 'node:fs';
import { eq } from 'drizzle-orm';
import path from 'node:path';
import { openDb } from '../src/server/db/factory';
import { dailyMetrics, ingestRuns, profile, routes, workouts } from '../src/server/db/schema';
import type { DailyMetric, GpxRoute, UserProfile, Workout } from '../src/types';

const dir = path.join(process.cwd(), 'public', 'data');
const load = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

function chunks<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

const db = openDb();
const startedAt = new Date().toISOString();
const runId = db.insert(ingestRuns).values({ source: 'json-import', state: 'running', startedAt }).returning({ id: ingestRuns.id }).get().id;

try {
  const p = load<UserProfile>('profile.json');
  const daily = load<DailyMetric[]>('daily_metrics.json');
  const wk = load<Workout[]>('workouts.json');
  const rt = Object.values(load<Record<string, GpxRoute>>('routes.json'));

  db.transaction((tx) => {
    tx.delete(profile).run();
    tx.delete(dailyMetrics).run();
    tx.delete(workouts).run();
    tx.delete(routes).run();
    const { dateRange, ...pr } = p;
    tx.insert(profile).values({ id: 1, ...pr, dateStart: dateRange.start, dateEnd: dateRange.end }).run();
    for (const c of chunks(daily, 500)) tx.insert(dailyMetrics).values(c).run();
    for (const c of chunks(wk, 500)) {
      tx.insert(workouts).values(c.map(({ routeData: _r, routePath, ...w }) => ({ ...w, routePath: routePath ?? null }))).run();
    }
    for (const c of chunks(rt, 50)) {
      tx.insert(routes).values(c.map((r) => ({
        filename: r.filename, pointCount: r.pointCount, distanceKm: r.distanceKm,
        startLat: r.startPoint.lat, startLon: r.startPoint.lon, startEle: r.startPoint.ele,
        endLat: r.endPoint.lat, endLon: r.endPoint.lon, endEle: r.endPoint.ele, points: r.points,
      }))).run();
    }
  });

  const counts = { days: daily.length, workouts: wk.length, routes: rt.length };
  db.update(ingestRuns).set({ state: 'succeeded', counts, finishedAt: new Date().toISOString() })
    .where(eq(ingestRuns.id, runId)).run();
  const dbCounts = {
    days: db.select().from(dailyMetrics).all().length,
    workouts: db.select().from(workouts).all().length,
    routes: db.select({ f: routes.filename }).from(routes).all().length,
  };
  console.log('json   :', JSON.stringify(counts));
  console.log('db     :', JSON.stringify(dbCounts));
} catch (e) {
  db.update(ingestRuns).set({ state: 'failed', error: e instanceof Error ? e.message : String(e), finishedAt: new Date().toISOString() })
    .where(eq(ingestRuns.id, runId)).run();
  console.error('import failed:', e instanceof Error ? e.message : e);
  process.exit(1);
}
