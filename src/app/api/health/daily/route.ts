import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getAllDaily } from '@/server/db/repos/health';
import { aggregateMetricsByPeriod, defaultPeriod, filterDailyMetrics } from '@/server/aggregation';
import { apiError, internal, noData } from '@/server/http';
import type { DailyResponse } from '@/types/api';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  range: z.enum(['30d', '90d', '1y', '3y', 'all']).default('1y'),
  period: z.enum(['daily', 'weekly', 'monthly']).optional(),
});

export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const q = Query.safeParse({
      range: sp.get('range') ?? undefined,
      period: sp.get('period') ?? undefined,
    });
    if (!q.success) return apiError('Invalid range or period', 400, 'BAD_REQUEST');
    const all = getAllDaily();
    if (all.length === 0) return noData();
    const { range } = q.data;
    const period = q.data.period ?? defaultPeriod(range);
    const daily = filterDailyMetrics(all, range);
    const body: DailyResponse = { range, period, daily, aggregated: aggregateMetricsByPeriod(daily, period) };
    return NextResponse.json(body);
  } catch (e) { return internal(e); }
}
