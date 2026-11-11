// CLI catalog sync without the server. Usage: npm run catalog:sync
import { openDb } from '../src/server/db/factory';
import { runSync, startSyncRow } from '../src/server/catalog/sync';

const db = openDb();
const id = startSyncRow(db, 'cli');
let last = '';
const error = await runSync(db, id, (f) => {
  const s = `${Math.floor(f * 10) * 10}%`;
  if (s !== last) { last = s; console.log(`fetching ${s}`); }
});
if (error) { console.error('catalog sync failed:', error); process.exit(1); }
const n = db.$client.prepare('SELECT COUNT(*) AS n FROM catalog_exercises').get() as { n: number };
console.log(`stored ${n.n} exercises`);
