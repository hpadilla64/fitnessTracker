import { NextResponse } from 'next/server';
import { getCatalogSummary } from '@/server/db/repos/catalog';
import { internal } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try { return NextResponse.json(getCatalogSummary()); } catch (e) { return internal(e); }
}
