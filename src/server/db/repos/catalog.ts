import { and, asc, count, desc, eq, or, sql, type SQL } from 'drizzle-orm';
import { getDb } from '../client';
import { catalogExercises, catalogSyncs } from '../schema';
import type { CatalogExercise, CatalogExercisesResponse, CatalogSummary } from '@/types/api';

export function getCatalogSummary(): CatalogSummary {
  const db = getDb();
  const rows = db.select({ category: catalogExercises.category, muscles: catalogExercises.muscles,
    sec: catalogExercises.musclesSecondary, equipment: catalogExercises.equipment }).from(catalogExercises).all();
  const cats = new Map<string, number>();
  const equipment = new Set<string>();
  const muscles = new Set<string>();
  for (const r of rows) {
    if (r.category) cats.set(r.category, (cats.get(r.category) ?? 0) + 1);
    r.equipment.forEach((e) => equipment.add(e));
    r.muscles.forEach((m) => muscles.add(m));
    r.sec.forEach((m) => muscles.add(m));
  }
  const last = db.select({ f: catalogSyncs.finishedAt }).from(catalogSyncs)
    .where(eq(catalogSyncs.state, 'succeeded')).orderBy(desc(catalogSyncs.id)).get();
  const sort = (s: Iterable<string>) => [...s].sort((a, b) => a.localeCompare(b));
  return {
    exerciseCount: rows.length,
    lastSyncedAt: last?.f ?? null,
    categories: sort(cats.keys()).map((name) => ({ name, count: cats.get(name)! })),
    equipment: sort(equipment),
    muscles: sort(muscles),
    source: { name: 'wger', url: 'https://wger.de', license: 'CC-BY-SA 4' },
  };
}

export interface CatalogQuery { q?: string; category?: string; equipment?: string; muscle?: string; limit: number; offset: number }

const esc = (s: string) => s.replace(/[\\%_]/g, '\\$&');
// JSON arrays are stored as text; match the quoted element exactly (case-sensitive, per contract's exact names).
const jsonHas = (col: SQL | unknown, v: string) => sql`${col} LIKE ${'%' + esc(JSON.stringify(v)) + '%'} ESCAPE '\\'`;

export function listCatalogExercises(q: CatalogQuery): CatalogExercisesResponse {
  const db = getDb();
  const conds: (SQL | undefined)[] = [];
  if (q.q) conds.push(sql`${catalogExercises.name} LIKE ${'%' + esc(q.q) + '%'} ESCAPE '\\'`);
  if (q.category) conds.push(eq(catalogExercises.category, q.category));
  if (q.equipment) conds.push(q.equipment === 'none' ? eq(catalogExercises.equipment, []) : jsonHas(catalogExercises.equipment, q.equipment));
  if (q.muscle) conds.push(or(jsonHas(catalogExercises.muscles, q.muscle), jsonHas(catalogExercises.musclesSecondary, q.muscle)));
  const where = and(...conds);
  const total = db.select({ n: count() }).from(catalogExercises).where(where).get()!.n;
  const items = db.select().from(catalogExercises).where(where)
    .orderBy(sql`${catalogExercises.name} COLLATE NOCASE`, asc(catalogExercises.id)).limit(q.limit).offset(q.offset).all();
  return { total, items: items as CatalogExercise[] };
}
