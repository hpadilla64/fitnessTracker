import { NextResponse } from 'next/server';
import { getWorkoutSummaries } from '@/server/db/repos/health';
import { internal } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json(getWorkoutSummaries()); } catch (e) { return internal(e); }
}
