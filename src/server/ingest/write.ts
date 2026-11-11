// Replaces profile/daily/workouts/routes in one transaction. No server-only: shared by the CLI.
import { dailyMetrics, profile, routes, workouts } from '../db/schema';
import type { Db } from '../db/factory';
import type { ParsedExport } from './parse';

function chunks<T>(a: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n));
  return out;
}

export function writeParsed(db: Db, p: ParsedExport): void {
  db.transaction((tx) => {
    tx.delete(profile).run();
    tx.delete(dailyMetrics).run();
    tx.delete(workouts).run();
    tx.delete(routes).run();
    const { dateRange, ...pr } = p.profile;
    tx.insert(profile).values({ id: 1, ...pr, dateStart: dateRange.start, dateEnd: dateRange.end }).run();
    for (const c of chunks(p.daily, 500)) tx.insert(dailyMetrics).values(c).run();
    for (const c of chunks(p.workouts, 500)) {
      tx.insert(workouts).values(c.map(({ routeData: _r, routePath, ...w }) => ({ ...w, routePath: routePath ?? null }))).run();
    }
    for (const c of chunks(p.routes, 50)) {
      tx.insert(routes).values(c.map((r) => ({
        filename: r.filename, pointCount: r.pointCount, distanceKm: r.distanceKm,
        startLat: r.startPoint.lat, startLon: r.startPoint.lon, startEle: r.startPoint.ele,
        endLat: r.endPoint.lat, endLon: r.endPoint.lon, endEle: r.endPoint.ele, points: r.points,
      }))).run();
    }
  });
}
