// Shared by the API job and the CLI: fetch, then replace the catalog in one transaction.
import { eq } from 'drizzle-orm';
import type { Db } from '../db/factory';
import { catalogExercises, catalogSyncs } from '../db/schema';
import { fetchCatalog } from './fetch';

export function startSyncRow(db: Db, source: 'api' | 'cli'): number {
  return db.insert(catalogSyncs).values({ source, state: 'running', progress: 0, startedAt: new Date().toISOString() })
    .returning({ id: catalogSyncs.id }).get().id;
}

/** Runs one sync to completion and records the outcome. Never throws; returns the error message or null. */
export async function runSync(db: Db, id: number, onProgress?: (f: number) => void): Promise<string | null> {
  try {
    const items = await fetchCatalog(onProgress);
    if (!items.length) throw new Error('wger returned no English exercises');
    db.transaction((tx) => {
      tx.delete(catalogExercises).run();
      for (let i = 0; i < items.length; i += 100) tx.insert(catalogExercises).values(items.slice(i, i + 100)).run();
      tx.update(catalogSyncs).set({ state: 'succeeded', progress: 1, exerciseCount: items.length, finishedAt: new Date().toISOString() })
        .where(eq(catalogSyncs.id, id)).run();
    });
    return null;
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    db.update(catalogSyncs).set({ state: 'failed', error, finishedAt: new Date().toISOString() }).where(eq(catalogSyncs.id, id)).run();
    return error;
  }
}
