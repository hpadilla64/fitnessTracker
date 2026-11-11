import 'server-only';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { catalogSyncs } from '../db/schema';
import { runSync, startSyncRow } from './sync';
import type { CatalogSyncJob } from '@/types/api';

const CLI_STALE_MS = 15 * 60 * 1000;

interface Live { id: number; progress: number }
const g = globalThis as unknown as { __pulsefitCatalog?: Live | null };

export class CatalogConflict extends Error {}

type Row = typeof catalogSyncs.$inferSelect;
const toJob = (r: Row, live?: Live | null): CatalogSyncJob => ({
  id: r.id,
  state: r.state as CatalogSyncJob['state'],
  progress: r.state === 'succeeded' ? 1 : r.state === 'running' && live?.id === r.id ? live.progress : r.progress ?? null,
  exerciseCount: r.exerciseCount ?? null,
  startedAt: r.startedAt,
  finishedAt: r.finishedAt,
  error: r.error,
});

export function getLatestSync(): CatalogSyncJob | null {
  const db = getDb();
  let row = db.select().from(catalogSyncs).orderBy(desc(catalogSyncs.id)).get();
  if (!row) return null;
  const live = g.__pulsefitCatalog;
  // Same rule as the ingest job: a server run with no live job was interrupted by a restart;
  // CLI runs live in another process, so only call them interrupted once they're stale.
  const dead = row.source === 'cli' ? Date.now() - Date.parse(row.startedAt) > CLI_STALE_MS : live?.id !== row.id;
  if (row.state === 'running' && dead) {
    db.update(catalogSyncs).set({ state: 'failed', error: 'interrupted', finishedAt: new Date().toISOString() })
      .where(eq(catalogSyncs.id, row.id)).run();
    row = db.select().from(catalogSyncs).where(eq(catalogSyncs.id, row.id)).get()!;
  }
  return toJob(row, live);
}

export function startCatalogSync(): CatalogSyncJob {
  if (g.__pulsefitCatalog) throw new CatalogConflict('A catalog sync is already running');
  const db = getDb();
  if (getLatestSync()?.state === 'running') throw new CatalogConflict('A catalog sync is already running');
  const id = startSyncRow(db, 'api');
  const live: Live = { id, progress: 0 };
  g.__pulsefitCatalog = live;
  let lastPersist = 0;
  void runSync(db, id, (f) => {
    live.progress = f;
    const now = Date.now();
    if (now - lastPersist >= 1000) {
      lastPersist = now;
      db.update(catalogSyncs).set({ progress: f }).where(eq(catalogSyncs.id, id)).run();
    }
  }).finally(() => { g.__pulsefitCatalog = null; });
  return toJob(db.select().from(catalogSyncs).where(eq(catalogSyncs.id, id)).get()!, live);
}
