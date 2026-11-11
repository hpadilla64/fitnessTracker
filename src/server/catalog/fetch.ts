// wger.de workout catalog fetcher. Public GETs only; nothing about the user is sent.
// No server-only import so scripts (tsx) can reuse it.
export const WGER_BASE = () => process.env.PULSEFIT_WGER_BASE ?? 'https://wger.de';
const PAGE = 100;
const EN = 2; // wger language id for English

export interface NormalisedExercise {
  id: number; name: string; description: string; category: string | null;
  muscles: string[]; musclesSecondary: string[]; equipment: string[];
  license: string | null; licenseUrl: string | null; author: string | null;
}

interface WgerMuscle { name?: string; name_en?: string }
interface WgerResult {
  id: number;
  category?: { name?: string } | null;
  muscles?: WgerMuscle[]; muscles_secondary?: WgerMuscle[];
  equipment?: { name?: string }[];
  license?: { short_name?: string; url?: string } | null;
  license_author?: string | null;
  translations?: { language: number; name?: string; description?: string }[];
}
interface WgerPage { count: number; next: string | null; results: WgerResult[] }

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };
export function htmlToText(html: string): string {
  return html
    .replace(/<\s*(br|\/p|\/li|\/div|\/h\d)\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e: string) => {
      if (e[0] === '#') {
        const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return Number.isFinite(n) ? String.fromCodePoint(n) : m;
      }
      return ENTITIES[e.toLowerCase()] ?? m;
    })
    .replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const uniq = (xs: (string | undefined)[]) => [...new Set(xs.map((x) => x?.trim()).filter((x): x is string => !!x))];
const muscleNames = (ms: WgerMuscle[] = []) => uniq(ms.map((m) => m.name_en?.trim() || m.name));

export function normalise(r: WgerResult): NormalisedExercise | null {
  const t = r.translations?.find((x) => x.language === EN && x.name?.trim());
  if (!t) return null;
  return {
    id: r.id,
    name: t.name!.trim().replace(/\s+/g, ' '),
    description: htmlToText(t.description ?? ''),
    category: r.category?.name?.trim() || null,
    muscles: muscleNames(r.muscles),
    musclesSecondary: muscleNames(r.muscles_secondary),
    equipment: uniq((r.equipment ?? []).map((e) => e.name)),
    license: r.license?.short_name?.trim() || null,
    licenseUrl: r.license?.url?.trim() || null,
    author: r.license_author?.trim() || null,
  };
}

async function getJson(url: string): Promise<WgerPage> {
  let last: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'PulseFit (local)', Accept: 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (res.ok) return (await res.json()) as WgerPage;
      last = new Error(`wger responded ${res.status}`);
      if (res.status < 500) throw last; // 4xx: retrying won't help
    } catch (e) {
      if (e === last) throw e;
      last = e;
    }
    await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
  }
  const msg = last instanceof Error ? (last.cause instanceof Error ? `${last.message} (${last.cause.message})` : last.message) : String(last);
  throw new Error(`Catalog fetch failed: ${msg}`);
}

/** Fetches every page; onProgress gets pages done / total pages. Deduped by id, English only. */
export async function fetchCatalog(onProgress?: (f: number) => void): Promise<NormalisedExercise[]> {
  const out = new Map<number, NormalisedExercise>();
  let url: string | null = `${WGER_BASE()}/api/v2/exerciseinfo/?limit=${PAGE}&offset=0`;
  let done = 0;
  while (url) {
    const page: WgerPage = await getJson(url);
    for (const r of page.results) { const e = normalise(r); if (e) out.set(e.id, e); }
    done++;
    const total = Math.max(1, Math.ceil(page.count / PAGE));
    onProgress?.(Math.min(1, done / total));
    url = page.next;
  }
  return [...out.values()];
}
