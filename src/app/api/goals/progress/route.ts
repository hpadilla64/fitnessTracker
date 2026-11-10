import { NextResponse } from 'next/server';
import { getGoalProgress } from '@/server/db/repos/goals';
import { internal } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json(getGoalProgress()); } catch (e) { return internal(e); }
}
