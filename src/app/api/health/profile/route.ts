import { NextResponse } from 'next/server';
import { getProfile } from '@/server/db/repos/health';
import { internal, noData } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const p = getProfile();
    return p ? NextResponse.json(p) : noData();
  } catch (e) { return internal(e); }
}
