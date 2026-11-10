// CLI ingest without the server. Usage: npm run ingest
import path from 'node:path';
import { openDb } from '../src/server/db/factory';
import { ingestRuns } from '../src/server/db/schema';
import { eq } from 'drizzle-orm';
import { parseExport } from '../src/server/ingest/parse';
import { writeParsed } from '../src/server/ingest/write';

const inputDir = path.join(process.cwd(), 'input', 'apple_health_export');
const t0 = Date.now();
const db = openDb();
const runId = db.insert(ingestRuns).values({ source: 'cli', state: 'running', startedAt: new Date().toISOString() })
  .returning({ id: ingestRuns.id }).get().id;
let last = '';
try {
  const parsed = await parseExport(inputDir, (phase, f) => {
    const s = `${phase} ${Math.floor(f * 10) * 10}%`;
    if (s !== last) { last = s; console.log(s); }
  });
  writeParsed(db, parsed);
  const counts = { records: parsed.recordCount, days: parsed.daily.length, workouts: parsed.workouts.length, routes: parsed.routes.length };
  db.update(ingestRuns).set({ state: 'succeeded', progress: 1, counts, finishedAt: new Date().toISOString() }).where(eq(ingestRuns.id, runId)).run();
  console.log('counts :', JSON.stringify(counts));
  console.log(`elapsed: ${((Date.now() - t0) / 1000).toFixed(1)}s`);
} catch (e) {
  db.update(ingestRuns).set({ state: 'failed', error: e instanceof Error ? e.message : String(e), finishedAt: new Date().toISOString() }).where(eq(ingestRuns.id, runId)).run();
  console.error('ingest failed:', e instanceof Error ? e.message : e);
  process.exit(1);
}
