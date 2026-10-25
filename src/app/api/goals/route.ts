import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getActiveGoal, setGoal } from '@/server/db/repos/goals';
import { apiError, internal } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Update = z.object({
  startWeightKg: z.number().min(30).max(300),
  targetWeightKg: z.number().min(30).max(300),
  timeframeWeeks: z.number().int().min(2).max(52),
}).strict();

export async function GET() {
  try { return NextResponse.json(getActiveGoal()); } catch (e) { return internal(e); }
}

export async function PUT(req: Request) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return apiError('Invalid JSON', 400, 'BAD_REQUEST'); }
    const parsed = Update.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues.map((i) => i.message).join('; '), 400, 'BAD_REQUEST');
    return NextResponse.json(setGoal(parsed.data));
  } catch (e) { return internal(e); }
}
