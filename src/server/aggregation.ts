import type { DailyMetric } from '@/types';
import type { AggregatedMetric, AggregationPeriod, TimeRangeKey } from '@/types/api';

export function defaultPeriod(range: TimeRangeKey): AggregationPeriod {
  if (range === '3y') return 'weekly';
  if (range === 'all') return 'monthly';
  return 'daily';
}

function isoUtc(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Cutoff is measured back from the last date in the data (not today).
export function filterDailyMetrics(metrics: DailyMetric[], range: TimeRangeKey): DailyMetric[] {
  if (metrics.length === 0) return [];
  if (range === 'all') return metrics;
  const cutoff = new Date(`${metrics[metrics.length - 1].date}T00:00:00Z`);
  if (range === '30d') cutoff.setUTCDate(cutoff.getUTCDate() - 30);
  else if (range === '90d') cutoff.setUTCDate(cutoff.getUTCDate() - 90);
  else if (range === '1y') cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
  else if (range === '3y') cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 3);
  const cutoffStr = isoUtc(cutoff);
  return metrics.filter((m) => m.date >= cutoffStr);
}

const r1 = (n: number) => Math.round(n * 10) / 10;

export function aggregateMetricsByPeriod(
  metrics: DailyMetric[],
  period: AggregationPeriod = 'daily'
): AggregatedMetric[] {
  if (period === 'daily' || metrics.length <= 90) {
    return metrics.map((m) => ({
      date: m.date, steps: m.steps, distanceKm: m.distanceKm, activeKcal: m.activeKcal,
      basalKcal: m.basalKcal, restingHR: m.restingHR, vo2max: m.vo2max, weightKg: m.weightKg, bmi: m.bmi,
    }));
  }

  const groups = new Map<string, DailyMetric[]>();
  for (const m of metrics) {
    let key = m.date;
    if (period === 'monthly') key = m.date.slice(0, 7);
    else {
      const d = new Date(`${m.date}T00:00:00Z`);
      const day = d.getUTCDay();
      d.setUTCDate(d.getUTCDate() - day + (day === 0 ? -6 : 1));
      key = isoUtc(d);
    }
    const arr = groups.get(key);
    if (arr) arr.push(m); else groups.set(key, [m]);
  }

  const avgOf = (items: DailyMetric[], f: (m: DailyMetric) => number | null) => {
    const v = items.map(f).filter((x): x is number => x !== null);
    return v.length ? r1(v.reduce((s, x) => s + x, 0) / v.length) : null;
  };
  const lastOf = (items: DailyMetric[], f: (m: DailyMetric) => number | null) => {
    const v = items.map(f).filter((x): x is number => x !== null);
    return v.length ? v[v.length - 1] : null;
  };

  return [...groups.keys()].sort().map((k) => {
    const items = groups.get(k)!;
    const n = items.length;
    const sum = (f: (m: DailyMetric) => number) => items.reduce((s, i) => s + f(i), 0);
    return {
      date: k,
      steps: Math.round(sum((i) => i.steps) / n),
      distanceKm: Math.round((sum((i) => i.distanceKm) / n) * 100) / 100,
      activeKcal: Math.round(sum((i) => i.activeKcal) / n),
      basalKcal: Math.round(sum((i) => i.basalKcal) / n),
      restingHR: avgOf(items, (i) => i.restingHR),
      vo2max: avgOf(items, (i) => i.vo2max),
      weightKg: lastOf(items, (i) => i.weightKg),
      bmi: lastOf(items, (i) => i.bmi),
    };
  });
}
