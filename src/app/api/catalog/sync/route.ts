import { NextResponse } from 'next/server';
import { z } from 'zod';
import { CatalogConflict, getLatestSync, startCatalogSync } from '@/server/catalog/job';
import { apiError, internal } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z.object({}).strict();

export async function GET() {
  try { return NextResponse.json(getLatestSync()); } catch (e) { return internal(e); }
}

export async function POST(req: Request) {
  try {
    const text = await req.text();
    if (text.trim()) {
      let body: unknown;
      try { body = JSON.parse(text); } catch { return apiError('Invalid JSON', 400, 'BAD_REQUEST'); }
      if (!Body.safeParse(body).success) return apiError('Body must be empty or {}', 400, 'BAD_REQUEST');
    }
    return NextResponse.json(startCatalogSync(), { status: 202 });
  } catch (e) {
    if (e instanceof CatalogConflict) return apiError(e.message, 409, 'CONFLICT');
    return internal(e);
  }
}
