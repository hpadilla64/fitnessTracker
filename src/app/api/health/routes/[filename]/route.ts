import { NextResponse } from 'next/server';
import { getRoute } from '@/server/db/repos/health';
import { apiError, internal } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: Request, ctx: { params: Promise<{ filename: string }> }) {
  try {
    const { filename } = await ctx.params;
    if (!/^[\w.\-]+\.gpx$/.test(filename)) return apiError('Invalid filename', 400, 'BAD_REQUEST');
    const r = getRoute(filename);
    return r ? NextResponse.json(r) : apiError('Route not found', 404, 'NOT_FOUND');
  } catch (e) { return internal(e); }
}
