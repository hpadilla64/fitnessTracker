import { NextResponse } from 'next/server';
import { getStatus } from '@/server/db/repos/status';
import { internal } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json(getStatus()); } catch (e) { return internal(e); }
}
