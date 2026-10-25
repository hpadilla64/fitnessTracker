// DB factory without server-only so scripts (tsx) can reuse it.
import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from './schema';

export const DB_PATH = path.join(process.cwd(), 'data', 'pulsefit.db');
export const MIGRATIONS_DIR = path.join(process.cwd(), 'src', 'server', 'db', 'migrations');

export function openDb(file: string = DB_PATH) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const sqlite = new Database(file);
  sqlite.pragma('journal_mode = WAL');
  sqlite.pragma('foreign_keys = ON');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: MIGRATIONS_DIR });
  return db;
}

export type Db = ReturnType<typeof openDb>;
