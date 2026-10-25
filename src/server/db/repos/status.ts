import { desc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { catalogSyncs, ingestRuns, profile } from '../schema';
import { getCounts } from './health';
import type { StatusResponse } from '@/types/api';

export function getStatus(): StatusResponse {
  const db = getDb();
  const counts = getCounts();
  const p = db.select({ s: profile.dateStart, e: profile.dateEnd }).from(profile).get();
  const run = db.select({ f: ingestRuns.finishedAt }).from(ingestRuns)
    .where(eq(ingestRuns.state, 'succeeded')).orderBy(desc(ingestRuns.id)).get();
  const sync = db.select({ s: catalogSyncs.syncedAt }).from(catalogSyncs).orderBy(desc(catalogSyncs.id)).get();
  return {
    hasData: !!p && counts.days > 0,
    lastProcessedAt: run?.f ?? null,
    dataRange: p ? { start: p.s, end: p.e } : null,
    counts,
    catalogSyncedAt: sync?.s ?? null,
    aiConfigured: !!process.env.ANTHROPIC_API_KEY,
  };
}
