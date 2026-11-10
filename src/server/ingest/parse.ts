// Streaming port of scripts/parse_health_data.py. No server-only/Next imports: runs under tsx too.
import fs from 'node:fs';
import path from 'node:path';
import { SaxesParser } from 'saxes';
import type { DailyMetric, GpxRoute, UserProfile, Workout } from '../../types';
import type { IngestPhase } from '../../types/api';

export interface ParsedExport {
  profile: UserProfile;
  daily: DailyMetric[];
  workouts: Workout[];
  routes: GpxRoute[];
  recordCount: number;
}
export type ProgressFn = (phase: IngestPhase, fraction: number) => void;

/** Python-style round(): correctly rounded, ties to even. */
export function pyRound(x: number, digits = 0): number {
  if (!Number.isFinite(x)) return x;
  // toFixed rounds the exact binary value; only a true decimal tie needs the even rule.
  const ex = x.toFixed(Math.min(100, digits + 30));
  const tail = ex.slice(ex.indexOf('.') + 1 + digits);
  if (/^50*$/.test(tail)) {
    const f = 10 ** digits;
    const fl = Math.floor(x * f);
    return (fl % 2 === 0 ? fl : fl + 1) / f;
  }
  return Number(x.toFixed(digits));
}

/** Python 3.12+ sum() of floats: Neumaier compensated summation (plain reduce differs in the last bits). */
export function pySum(xs: number[]): number {
  let f = 0, c = 0;
  for (const x of xs) {
    const t = f + x;
    if (Math.abs(f) >= Math.abs(x)) c += (f - t) + x; else c += (x - t) + f;
    f = t;
  }
  return Number.isFinite(c) ? f + c : f;
}

/** Python float(): lenient parse, NaN when invalid. */
const pyFloat = (s: string | undefined): number => {
  if (s === undefined) return NaN;
  const t = s.trim();
  return t === '' ? NaN : Number(t);
};

interface DayAcc {
  steps: number; distanceKm: number; activeKcal: number; basalKcal: number;
  exerciseMinutes: number; standMinutes: number; flightsClimbed: number;
  hr: number[]; restingHR: number | null; walkingHR: number | null;
  hrv: number[]; vo2max: number | null; weightKg: number | null;
  bmi: number | null; leanMassKg: number | null; sleepHours: number;
}
const newDay = (): DayAcc => ({
  steps: 0, distanceKm: 0, activeKcal: 0, basalKcal: 0, exerciseMinutes: 0, standMinutes: 0,
  flightsClimbed: 0, hr: [], restingHR: null, walkingHR: null, hrv: [],
  vo2max: null, weightKg: null, bmi: null, leanMassKg: null, sleepHours: 0,
});

const LONG_DIST = new Set([
  'HKQuantityTypeIdentifierDistanceWalkingRunning', 'HKQuantityTypeIdentifierDistanceCycling',
  'HKQuantityTypeIdentifierDistanceSwimming', 'HKQuantityTypeIdentifierDistanceWheelchair',
  'HKQuantityTypeIdentifierDistanceDownhillSnowSports',
]);
const toKm = (v: number, unit: string) => (unit === 'mi' ? v * 1.60934 : unit === 'm' ? v / 1000 : unit === 'yd' ? v * 0.0009144 : v);
const toKcal = (v: number, unit: string) => (unit === 'kJ' ? v / 4.184 : v);
const SLEEP_RE = /^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/;
const secs = (s: string) => {
  const t = s.slice(0, 19);
  if (!SLEEP_RE.test(t)) return NaN;
  return Date.parse(`${t.replace(' ', 'T')}Z`) / 1000;
};

async function streamXml(file: string, parser: SaxesParser, onBytes?: (frac: number) => void) {
  const size = fs.statSync(file).size || 1;
  let read = 0;
  let err: Error | null = null;
  parser.on('error', (e) => { err = e; });
  for await (const chunk of fs.createReadStream(file, { encoding: 'utf8', highWaterMark: 1 << 20 })) {
    parser.write(chunk as string);
    if (err) throw err;
    read += Buffer.byteLength(chunk as string);
    onBytes?.(Math.min(1, read / size));
  }
  parser.close();
  if (err) throw err;
}

function parseGpx(text: string): GpxRoute | null {
  const parser = new SaxesParser();
  const pts: { lat: number; lon: number; ele: number }[] = [];
  const raw: { lat: number; lon: number }[] = [];
  let inPt = false, inEle = false, eleText = '', cur: { lat: number; lon: number } | null = null, eleSeen = false;
  let bad = false;
  parser.on('opentag', (t) => {
    const n = t.name;
    if (n === 'trkpt') {
      inPt = true; eleSeen = false; eleText = '';
      const lat = pyFloat(t.attributes.lat as string), lon = pyFloat(t.attributes.lon as string);
      if (Number.isNaN(lat) || Number.isNaN(lon)) bad = true;
      cur = { lat, lon };
    } else if (n === 'ele' && inPt && !eleSeen) { inEle = true; eleSeen = true; eleText = ''; }
  });
  parser.on('text', (t) => { if (inEle) eleText += t; });
  parser.on('closetag', (t) => {
    if (t.name === 'ele') inEle = false;
    else if (t.name === 'trkpt' && cur) {
      const e = pyFloat(eleText);
      const ele = eleText.trim() === '' ? 0 : e;
      if (Number.isNaN(ele)) bad = true;
      raw.push(cur);
      pts.push({ lat: pyRound(cur.lat, 5), lon: pyRound(cur.lon, 5), ele: pyRound(ele, 1) });
      inPt = false; cur = null;
    }
  });
  parser.write(text).close();
  if (bad) throw new Error('invalid trkpt');
  if (!pts.length) return null;
  const R = 6371.0;
  const rad = (d: number) => (d * Math.PI) / 180;
  let total = 0;
  for (let i = 1; i < raw.length; i++) {
    const dlat = rad(raw[i].lat - raw[i - 1].lat), dlon = rad(raw[i].lon - raw[i - 1].lon);
    const a = Math.sin(dlat / 2) ** 2 + Math.cos(rad(raw[i - 1].lat)) * Math.cos(rad(raw[i].lat)) * Math.sin(dlon / 2) ** 2;
    total += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  const step = Math.max(1, Math.floor(pts.length / 100));
  const sampled = pts.filter((_, i) => i % step === 0);
  const last = pts[pts.length - 1];
  if (!sampled.some((p) => p.lat === last.lat && p.lon === last.lon && p.ele === last.ele)) sampled.push(last);
  return {
    filename: '', pointCount: pts.length, distanceKm: pyRound(total, 2),
    startPoint: sampled[0], endPoint: sampled[sampled.length - 1], points: sampled,
  };
}

export async function parseExport(inputDir: string, onProgress?: ProgressFn): Promise<ParsedExport> {
  const exportXml = path.join(inputDir, 'export.xml');
  const routesDir = path.join(inputDir, 'workout-routes');

  let sex: string | null = null, dob: string | null = null, bloodType: string | null = null;
  const daily = new Map<string, DayAcc>();
  const workouts: Workout[] = [];
  let minDate = '9999-99-99', maxDate = '0000-00-00', count = 0;
  const day = (k: string) => { let d = daily.get(k); if (!d) { d = newDay(); daily.set(k, d); } return d; };

  // Workout under construction (children are small; stats summed here).
  let wk: { w: Workout; dist: number; hasDist: boolean; en: number; hasEn: boolean } | null = null;

  const parser = new SaxesParser();
  parser.on('opentag', (t) => {
    const a = t.attributes as Record<string, string>;
    switch (t.name) {
      case 'Me': {
        const s = a.HKCharacteristicTypeIdentifierBiologicalSex ?? '';
        if (s.includes('Female')) sex = 'Female'; else if (s.includes('Male')) sex = 'Male';
        dob = a.HKCharacteristicTypeIdentifierDateOfBirth ?? dob;
        bloodType = (a.HKCharacteristicTypeIdentifierBloodType ?? '').replace('HKBloodType', '') || null;
        break;
      }
      case 'Record': {
        count++;
        const rtype = a.type ?? '', sdate = a.startDate ?? '', edate = a.endDate ?? '';
        if (sdate) {
          const k = sdate.slice(0, 10);
          if (k < minDate) minDate = k;
          if (k > maxDate) maxDate = k;
          const d = day(k);
          if (a.value !== undefined) {
            let val = pyFloat(a.value);
            if (Number.isNaN(val)) val = 0;
            switch (rtype) {
              case 'HKQuantityTypeIdentifierStepCount': d.steps += Math.trunc(val); break;
              case 'HKQuantityTypeIdentifierDistanceWalkingRunning': {
                const u = a.unit ?? 'km';
                if (u === 'mi') val *= 1.60934; else if (u === 'm') val /= 1000;
                d.distanceKm += val; break;
              }
              case 'HKQuantityTypeIdentifierActiveEnergyBurned': d.activeKcal += val; break;
              case 'HKQuantityTypeIdentifierBasalEnergyBurned': d.basalKcal += val; break;
              case 'HKQuantityTypeIdentifierAppleExerciseTime': d.exerciseMinutes += val; break;
              case 'HKQuantityTypeIdentifierAppleStandTime': d.standMinutes += val; break;
              case 'HKQuantityTypeIdentifierFlightsClimbed': d.flightsClimbed += Math.trunc(val); break;
              case 'HKQuantityTypeIdentifierHeartRate': d.hr.push(val); break;
              case 'HKQuantityTypeIdentifierRestingHeartRate': d.restingHR = val; break;
              case 'HKQuantityTypeIdentifierWalkingHeartRateAverage': d.walkingHR = val; break;
              case 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN': d.hrv.push(val); break;
              case 'HKQuantityTypeIdentifierVO2Max': d.vo2max = val; break;
              case 'HKQuantityTypeIdentifierBodyMass':
                if (a.unit === 'lb' || a.unit === 'lbs') val *= 0.453592;
                d.weightKg = val; break;
              case 'HKQuantityTypeIdentifierBodyMassIndex': d.bmi = val; break;
              case 'HKQuantityTypeIdentifierLeanBodyMass':
                if (a.unit === 'lb' || a.unit === 'lbs') val *= 0.453592;
                d.leanMassKg = val; break;
              default: break; // walking speed / step length / asymmetry: accumulated but unused in Python output
            }
          }
        }
        if (rtype === 'HKCategoryTypeIdentifierSleepAnalysis' && sdate && edate) {
          const h = (secs(edate) - secs(sdate)) / 3600;
          if (h > 0 && h < 18) day(sdate.slice(0, 10)).sleepHours += h;
        }
        break;
      }
      case 'Workout': {
        count++;
        const wtype = (a.workoutActivityType ?? '').replace('HKWorkoutActivityType', '');
        let dur = a.duration === undefined ? 0 : pyFloat(a.duration);
        const du = a.durationUnit ?? 'min';
        if (du === 's' || du === 'sec') dur /= 60; else if (du === 'hr') dur *= 60;
        const attrDist = toKm(a.totalDistance === undefined ? 0 : pyFloat(a.totalDistance), a.totalDistanceUnit ?? 'km');
        const attrEn = a.totalEnergyBurned === undefined ? 0 : pyFloat(a.totalEnergyBurned);
        wk = {
          w: {
            id: `workout-${workouts.length + 1}`, type: wtype, startDate: a.startDate ?? '', endDate: a.endDate ?? '',
            durationMinutes: pyRound(dur, 1), distanceKm: attrDist, energyKcal: attrEn,
            // Python never links a route (iterparse clears WorkoutRoute children first); kept as-is.
            routePath: null,
          } as Workout,
          dist: 0, hasDist: false, en: 0, hasEn: false,
        };
        break;
      }
      case 'WorkoutStatistics': {
        if (!wk) break;
        const v = pyFloat(a.sum);
        if (Number.isNaN(v)) break;
        if (LONG_DIST.has(a.type ?? '')) { wk.dist += toKm(v, a.unit ?? 'km'); wk.hasDist = true; }
        else if (a.type === 'HKQuantityTypeIdentifierActiveEnergyBurned') { wk.en += toKcal(v, a.unit ?? 'kcal'); wk.hasEn = true; }
        break;
      }
      default: break;
    }
  });
  parser.on('closetag', (t) => {
    if (t.name !== 'Workout' || !wk) return;
    const { w } = wk;
    w.distanceKm = pyRound(wk.hasDist ? wk.dist : w.distanceKm, 2);
    w.energyKcal = pyRound(wk.hasEn ? wk.en : w.energyKcal, 1);
    workouts.push(w);
    wk = null;
  });

  onProgress?.('records', 0);
  await streamXml(exportXml, parser, (f) => onProgress?.('records', f));

  // GPX routes
  const routes: GpxRoute[] = [];
  if (fs.existsSync(routesDir)) {
    const files = fs.readdirSync(routesDir).filter((f) => f.endsWith('.gpx') && !f.startsWith('._')).sort();
    for (let i = 0; i < files.length; i++) {
      try {
        const r = parseGpx(fs.readFileSync(path.join(routesDir, files[i]), 'utf8'));
        if (r) routes.push({ ...r, filename: files[i] });
      } catch (e) {
        console.error(`Error parsing GPX ${files[i]}: ${e instanceof Error ? e.message : e}`);
      }
      onProgress?.('routes', (i + 1) / files.length);
    }
  }
  routes.sort((a, b) => (a.filename < b.filename ? -1 : 1));

  // Daily list
  const list: DailyMetric[] = [];
  let latestW: number | null = null, latestB: number | null = null, latestL: number | null = null;
  for (const k of [...daily.keys()].sort()) {
    const d = daily.get(k)!;
    if (d.weightKg) latestW = pyRound(d.weightKg, 1);
    if (d.bmi) latestB = pyRound(d.bmi, 1);
    if (d.leanMassKg) latestL = pyRound(d.leanMassKg, 1);
    if (d.steps > 0 || d.activeKcal > 0 || d.weightKg !== null || d.restingHR !== null) {
      list.push({
        date: k, steps: d.steps, distanceKm: pyRound(d.distanceKm, 2), activeKcal: pyRound(d.activeKcal, 1),
        basalKcal: pyRound(d.basalKcal, 1), exerciseMinutes: pyRound(d.exerciseMinutes, 1),
        standMinutes: pyRound(d.standMinutes, 1), flightsClimbed: d.flightsClimbed,
        avgHeartRate: d.hr.length ? pyRound(pySum(d.hr) / d.hr.length, 1) : null,
        restingHR: d.restingHR ? pyRound(d.restingHR, 1) : null,
        walkingHR: d.walkingHR ? pyRound(d.walkingHR, 1) : null,
        hrv: d.hrv.length ? pyRound(pySum(d.hrv) / d.hrv.length, 1) : null,
        vo2max: d.vo2max ? pyRound(d.vo2max, 1) : null,
        weightKg: d.weightKg ? pyRound(d.weightKg, 1) : null,
        bmi: d.bmi ? pyRound(d.bmi, 1) : null,
        leanMassKg: d.leanMassKg ? pyRound(d.leanMassKg, 1) : null,
        sleepHours: pyRound(d.sleepHours, 1),
      });
    }
  }

  const recent = list.slice(-30);
  const sum = pySum;
  const rhr = recent.map((x) => x.restingHR).filter((x): x is number => !!x);
  const vo2 = recent.map((x) => x.vo2max).filter((x): x is number => !!x);
  const typeCounts: Record<string, number> = {};
  for (const w of workouts) typeCounts[w.type] = (typeCounts[w.type] ?? 0) + 1;
  const n = recent.length;

  const profile: UserProfile = {
    sex, dob, bloodType,
    currentWeight: latestW, currentBMI: latestB, currentLeanMass: latestL,
    totalWorkouts: workouts.length,
    totalActiveCalories: pyRound(sum(list.map((x) => x.activeKcal)), 1),
    totalSteps: sum(list.map((x) => x.steps)),
    totalDistanceKm: pyRound(sum(list.map((x) => x.distanceKm)), 1),
    dateRange: { start: minDate, end: maxDate },
    avgDailySteps30d: n ? Math.trunc(sum(recent.map((x) => x.steps)) / n) : 0,
    avgActiveKcal30d: n ? Math.trunc(sum(recent.map((x) => x.activeKcal)) / n) : 0,
    avgBasalKcal30d: n ? Math.trunc(sum(recent.map((x) => x.basalKcal)) / n) : 0,
    avgRestingHR30d: n ? (rhr.length ? pyRound(sum(rhr) / rhr.length, 1) : 65.0) : 0,
    recentVO2Max: n ? (vo2.length ? pyRound(vo2[vo2.length - 1], 1) : 38.5) : 0,
    workoutTypeCounts: typeCounts,
  };
  return { profile, daily: list, workouts, routes, recordCount: count };
}
