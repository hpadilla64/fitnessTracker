// Compares the TS parser with the legacy Python JSON. Usage: npm run compare-parsers -- <pythonJsonDir>
// Prints only match/mismatch and relative diffs, never raw personal values.
import fs from 'node:fs';
import path from 'node:path';
import { parseExport } from '../src/server/ingest/parse';
import type { DailyMetric, GpxRoute, UserProfile, Workout } from '../src/types';

const dir = process.argv[2];
if (!dir) { console.error('usage: compare-parsers <pythonJsonDir>'); process.exit(2); }
const load = <T>(f: string): T => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
const py = {
  profile: load<UserProfile>('profile.json'),
  daily: load<DailyMetric[]>('daily_metrics.json'),
  workouts: load<Workout[]>('workouts.json'),
  routes: load<Record<string, GpxRoute>>('routes.json'),
};

let bad = 0;
const check = (name: string, ok: boolean, detail = '') => {
  console.log(`${ok ? 'MATCH   ' : 'MISMATCH'} ${name}${detail ? ' ' + detail : ''}`);
  if (!ok) bad++;
};
const rel = (a: number, b: number) => (a === b ? 0 : Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-12));
const EPS = 1e-9;

const ts = await parseExport(path.join(process.cwd(), 'input', 'apple_health_export'));

// counts
check('days count', ts.daily.length === py.daily.length, `(rel ${rel(ts.daily.length, py.daily.length)})`);
check('workouts count', ts.workouts.length === py.workouts.length);
check('routes count', ts.routes.length === Object.keys(py.routes).length);
check('date range', ts.profile.dateRange.start === py.profile.dateRange.start && ts.profile.dateRange.end === py.profile.dateRange.end);

// daily fields: sum + non-null count, plus per-row mismatches
const pyDay = new Map(py.daily.map((d) => [d.date, d]));
const fields = Object.keys(py.daily[0]).filter((k) => k !== 'date') as (keyof DailyMetric)[];
const num = (v: unknown) => (typeof v === 'number' ? v : null);
for (const f of fields) {
  const agg = (xs: DailyMetric[]) => ({ s: xs.reduce((s, x) => s + (num(x[f]) ?? 0), 0), n: xs.filter((x) => x[f] !== null).length });
  const a = agg(ts.daily), b = agg(py.daily);
  let rows = 0;
  for (const d of ts.daily) { const p = pyDay.get(d.date); if (!p || rel(num(d[f]) ?? -1, num(p[f]) ?? -1) > EPS) rows++; }
  check(`daily.${f}`, rel(a.s, b.s) <= EPS && a.n === b.n && rows === 0, `(sum rel ${rel(a.s, b.s).toExponential(1)}, nonnull ${a.n}/${b.n}, differing rows ${rows})`);
}

// workouts by id
const pyW = new Map(py.workouts.map((w) => [w.id, w]));
let wBad = 0, distFilled = 0, enFilled = 0, routeDiff = 0;
for (const w of ts.workouts) {
  const p = pyW.get(w.id);
  if (!p || p.type !== w.type || p.startDate !== w.startDate || p.endDate !== w.endDate || p.durationMinutes !== w.durationMinutes) wBad++;
  if (p && (p.routePath ?? null) !== (w.routePath ?? null)) routeDiff++;
  if (w.distanceKm > 0) distFilled++;
  if (w.energyKcal > 0) enFilled++;
}
check('workouts type/dates/duration', wBad === 0, `(differing ${wBad})`);
check('workouts routePath', routeDiff === 0, `(differing ${routeDiff})`);
console.log(`EXPECTED workouts distance/energy now filled: distance>0 ${distFilled}/${ts.workouts.length}, energy>0 ${enFilled}/${ts.workouts.length} (python: all 0)`);

// routes by filename
let rBad = 0;
for (const r of ts.routes) {
  const p = py.routes[r.filename];
  const same = (a: { lat: number; lon: number; ele: number }, b: { lat: number; lon: number; ele: number }) => a.lat === b.lat && a.lon === b.lon && a.ele === b.ele;
  if (!p || p.pointCount !== r.pointCount || p.distanceKm !== r.distanceKm || !same(p.startPoint, r.startPoint) || !same(p.endPoint, r.endPoint)
    || p.points.length !== r.points.length || !p.points.every((q, i) => same(q, r.points[i]))) rBad++;
}
check('routes pointCount/distance/start/end/points', rBad === 0, `(differing ${rBad})`);

// profile
const skip = new Set(['workoutTypeCounts', 'dateRange']);
for (const [k, v] of Object.entries(py.profile)) {
  if (skip.has(k)) continue;
  const t = (ts.profile as unknown as Record<string, unknown>)[k];
  const ok = typeof v === 'number' && typeof t === 'number' ? rel(v, t) <= EPS : v === t;
  check(`profile.${k}`, ok, typeof v === 'number' && typeof t === 'number' ? `(rel ${rel(v, t).toExponential(1)})` : '');
}
check('profile.workoutTypeCounts', JSON.stringify(Object.entries(py.profile.workoutTypeCounts).sort()) === JSON.stringify(Object.entries(ts.profile.workoutTypeCounts).sort()));

console.log(bad ? `\n${bad} unexpected mismatch(es)` : '\nall checks match');
process.exit(bad ? 1 : 0);
