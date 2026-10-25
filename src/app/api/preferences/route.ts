import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getPreferences, updatePreferences } from '@/server/db/repos/preferences';
import { apiError, internal } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Update = z.object({
  timeRange: z.enum(['30d', '90d', '1y', '3y', 'all']),
  activeTab: z.enum(['metrics', 'planner', 'workouts']),
  units: z.literal('metric'),
  trainingFocus: z.enum(['balanced', 'cardio', 'strength', 'fat_loss']).nullable(),
  workoutDaysPerWeek: z.number().int().min(1).max(7).nullable(),
  sessionMinutes: z.number().int().min(5).max(300).nullable(),
  equipment: z.array(z.string().max(100)).max(50),
  limitations: z.string().max(2000),
  excludedExerciseIds: z.array(z.number().int()).max(1000),
}).partial().strict();

export async function GET() {
  try { return NextResponse.json(getPreferences()); } catch (e) { return internal(e); }
}

export async function PUT(req: Request) {
  try {
    let body: unknown;
    try { body = await req.json(); } catch { return apiError('Invalid JSON', 400, 'BAD_REQUEST'); }
    const parsed = Update.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues.map((i) => i.message).join('; '), 400, 'BAD_REQUEST');
    return NextResponse.json(updatePreferences(parsed.data));
  } catch (e) { return internal(e); }
}
