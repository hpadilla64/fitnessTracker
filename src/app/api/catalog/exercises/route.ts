import { NextResponse } from 'next/server';
import { z } from 'zod';
import { listCatalogExercises } from '@/server/db/repos/catalog';
import { apiError, internal } from '@/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({
  q: z.string().trim().min(1).optional(),
  category: z.string().min(1).optional(),
  equipment: z.string().min(1).optional(),
  muscle: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(req: Request) {
  try {
    const parsed = Query.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return apiError(parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '), 400, 'BAD_REQUEST');
    return NextResponse.json(listCatalogExercises(parsed.data));
  } catch (e) { return internal(e); }
}
