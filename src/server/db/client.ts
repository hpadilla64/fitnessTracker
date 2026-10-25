import 'server-only';
import { openDb, type Db } from './factory';

const g = globalThis as unknown as { __pulsefitDb?: Db };

export function getDb(): Db {
  if (!g.__pulsefitDb) g.__pulsefitDb = openDb();
  return g.__pulsefitDb;
}
