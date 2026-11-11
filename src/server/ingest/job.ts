import 'server-only';
import fs from 'node:fs';
import path from 'node:path';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '../db/client';
import { ingestRuns } from '../db/schema';
import { parseExport } from './parse';
import { writeParsed } from './write';
import type { IngestJob, IngestPhase } from '@/types/api';

export const INPUT_DIR = path.join(process.cwd(), 'input', 'apple_health_export');

// Phase weights over the whole job: records dominate, routes are small, the write is quick.
const W: Record<IngestPhase, [number, number]> = { records: [0, 0.8], routes: [0.8, 0.95], writing: [0.95, 1] };

const CLI_STALE_MS = 15 * 60 * 1000;

interface Live { id: number; phase: IngestPhase; progress: number }
const g = globalThis as unknown as { __pulsefitIngest?: Live | null };

export class IngestConflict extends Error {}
export class IngestNoInput extends Error {}

type Row = typeof ingestRuns.$inferSelect;
const toJob = (r: Row, live?: Live | null): IngestJob => ({
  id: r.id,
  state: r.state as IngestJob['state'],
  phase: r.state === 'running' && live?.id === r.id ? live.phase : null,
  progress: r.state === 'succeeded' ? 1 : r.state === 'running' && live?.id === r.id ? live.progress : r.progress ?? null,
  counts: r.counts ?? null,
  startedAt: r.startedAt,
  finishedAt: r.finishedAt,
  error: r.error,
});

export function getLatestJob(): IngestJob | null {
  const db = getDb();
  let row = db.select().from(ingestRuns).orderBy(desc(ingestRuns.id)).get();
  if (!row) return null;
  const live = g.__pulsefitIngest;
  // A server run with no live job means the server restarted. CLI runs (`npm run ingest`) live in
  // another process, so only call them interrupted once they're far older than a full run takes.
  const dead = row.source === 'cli' ? Date.now() - Date.parse(row.startedAt) > CLI_STALE_MS : live?.id !== row.id;
  if (row.state === 'running' && dead) {
    db.update(ingestRuns).set({ state: 'failed', error: 'interrupted', finishedAt: new Date().toISOString() })
      .where(eq(ingestRuns.id, row.id)).run();
    row = db.select().from(ingestRuns).where(eq(ingestRuns.id, row.id)).get()!;
  }
  return toJob(row, live);
}

export function startIngest(): IngestJob {
  if (!fs.existsSync(path.join(INPUT_DIR, 'export.xml'))) throw new IngestNoInput('input/apple_health_export/export.xml not found');
  if (g.__pulsefitIngest) throw new IngestConflict('An ingest job is already running');
  const db = getDb();
  // Marks a stale running row as interrupted; a live one (e.g. a CLI run) blocks a new run.
  if (getLatestJob()?.state === 'running') throw new IngestConflict('An ingest job is already running');
  const id = db.insert(ingestRuns).values({ source: 'ts-parser', state: 'running', progress: 0, startedAt: new Date().toISOString() })
    .returning({ id: ingestRuns.id }).get().id;
  const live: Live = { id, phase: 'records', progress: 0 };
  g.__pulsefitIngest = live;
  let lastPersist = 0;

  const set = (phase: IngestPhase, f: number) => {
    const [a, b] = W[phase];
    live.phase = phase;
    live.progress = a + (b - a) * Math.min(1, Math.max(0, f));
    const now = Date.now();
    if (now - lastPersist >= 1000) {
      lastPersist = now;
      db.update(ingestRuns).set({ progress: live.progress }).where(eq(ingestRuns.id, id)).run();
    }
  };

  // Detached on purpose: the HTTP handler returns 202 immediately.
  void (async () => {
    try {
      const parsed = await parseExport(INPUT_DIR, set);
      set('writing', 0);
      writeParsed(db, parsed);
      const counts = { records: parsed.recordCount, days: parsed.daily.length, workouts: parsed.workouts.length, routes: parsed.routes.length };
      db.update(ingestRuns).set({ state: 'succeeded', progress: 1, counts, finishedAt: new Date().toISOString() }).where(eq(ingestRuns.id, id)).run();
    } catch (e) {
      db.update(ingestRuns).set({ state: 'failed', error: e instanceof Error ? e.message : String(e), finishedAt: new Date().toISOString() })
        .where(eq(ingestRuns.id, id)).run();
    } finally {
      g.__pulsefitIngest = null;
    }
  })();

  return toJob(db.select().from(ingestRuns).where(eq(ingestRuns.id, id)).get()!, live);
}
