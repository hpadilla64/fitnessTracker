import { UserProfile, DailyMetric, Workout, GpxRoute } from '../types';

let cachedProfile: UserProfile | null = null;
let cachedDaily: DailyMetric[] | null = null;
let cachedWorkouts: Workout[] | null = null;
let cachedRoutes: Record<string, GpxRoute> | null = null;

export async function fetchHealthData(): Promise<{
  profile: UserProfile;
  daily: DailyMetric[];
  workouts: Workout[];
  routes: Record<string, GpxRoute>;
}> {
  if (cachedProfile && cachedDaily && cachedWorkouts && cachedRoutes) {
    return {
      profile: cachedProfile,
      daily: cachedDaily,
      workouts: cachedWorkouts,
      routes: cachedRoutes,
    };
  }

  const [resProfile, resDaily, resWorkouts, resRoutes] = await Promise.all([
    fetch('/data/profile.json').then((r) => r.json()),
    fetch('/data/daily_metrics.json').then((r) => r.json()),
    fetch('/data/workouts.json').then((r) => r.json()),
    fetch('/data/routes.json').then((r) => r.json()),
  ]);

  cachedProfile = resProfile;
  cachedDaily = resDaily;
  cachedWorkouts = resWorkouts;
  cachedRoutes = resRoutes;

  return {
    profile: resProfile,
    daily: resDaily,
    workouts: resWorkouts,
    routes: resRoutes,
  };
}

export type TimeRangeKey = '30d' | '90d' | '1y' | '3y' | 'all';

export function filterDailyMetrics(
  metrics: DailyMetric[],
  range: TimeRangeKey
): DailyMetric[] {
  if (!metrics || metrics.length === 0) return [];
  if (range === 'all') return metrics;

  const lastDate = new Date(metrics[metrics.length - 1].date);
  const cutoff = new Date(lastDate);

  if (range === '30d') {
    cutoff.setDate(cutoff.getDate() - 30);
  } else if (range === '90d') {
    cutoff.setDate(cutoff.getDate() - 90);
  } else if (range === '1y') {
    cutoff.setFullYear(cutoff.getFullYear() - 1);
  } else if (range === '3y') {
    cutoff.setFullYear(cutoff.getFullYear() - 3);
  }

  const cutoffStr = cutoff.toISOString().slice(0, 10);
  return metrics.filter((m) => m.date >= cutoffStr);
}

// For massive series (e.g. 10 years), downsample to weekly or monthly averages for high performance charting
export function aggregateMetricsByPeriod(
  metrics: DailyMetric[],
  period: 'daily' | 'weekly' | 'monthly' = 'daily'
): {
  date: string;
  steps: number;
  distanceKm: number;
  activeKcal: number;
  basalKcal: number;
  restingHR: number | null;
  vo2max: number | null;
  weightKg: number | null;
  bmi: number | null;
}[] {
  if (period === 'daily' || metrics.length <= 90) {
    return metrics.map((m) => ({
      date: m.date,
      steps: m.steps,
      distanceKm: m.distanceKm,
      activeKcal: m.activeKcal,
      basalKcal: m.basalKcal,
      restingHR: m.restingHR,
      vo2max: m.vo2max,
      weightKg: m.weightKg,
      bmi: m.bmi,
    }));
  }

  const groups: Record<string, DailyMetric[]> = {};

  metrics.forEach((m) => {
    let key = m.date;
    if (period === 'monthly') {
      key = m.date.slice(0, 7); // YYYY-MM
    } else if (period === 'weekly') {
      const d = new Date(m.date);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      key = monday.toISOString().slice(0, 10);
    }
    if (!groups[key]) groups[key] = [];
    groups[key].push(m);
  });

  return Object.keys(groups)
    .sort()
    .map((k) => {
      const items = groups[k];
      const count = items.length;
      const totalSteps = items.reduce((sum, i) => sum + i.steps, 0);
      const totalDist = items.reduce((sum, i) => sum + i.distanceKm, 0);
      const totalActive = items.reduce((sum, i) => sum + i.activeKcal, 0);
      const totalBasal = items.reduce((sum, i) => sum + i.basalKcal, 0);

      const rhrItems = items.filter((i) => i.restingHR !== null);
      const avgRhr = rhrItems.length
        ? Math.round((rhrItems.reduce((s, i) => s + (i.restingHR || 0), 0) / rhrItems.length) * 10) / 10
        : null;

      const vo2Items = items.filter((i) => i.vo2max !== null);
      const avgVo2 = vo2Items.length
        ? Math.round((vo2Items.reduce((s, i) => s + (i.vo2max || 0), 0) / vo2Items.length) * 10) / 10
        : null;

      const weightItems = items.filter((i) => i.weightKg !== null);
      const latestWeight = weightItems.length ? weightItems[weightItems.length - 1].weightKg : null;

      const bmiItems = items.filter((i) => i.bmi !== null);
      const latestBmi = bmiItems.length ? bmiItems[bmiItems.length - 1].bmi : null;

      return {
        date: k,
        steps: Math.round(totalSteps / count),
        distanceKm: Math.round((totalDist / count) * 100) / 100,
        activeKcal: Math.round(totalActive / count),
        basalKcal: Math.round(totalBasal / count),
        restingHR: avgRhr,
        vo2max: avgVo2,
        weightKg: latestWeight,
        bmi: latestBmi,
      };
    });
}
