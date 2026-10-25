# AGENTS.md

Canonical instructions for any AI coding agent working in this repository (Claude Code, Codex, Cursor, Gemini CLI, Copilot, etc.).
Tool-specific files (e.g. `CLAUDE.md`, `.claude/agents/*`) only point here and add tool wiring. **If they disagree with this file, this file wins.**

## Project

PulseFit is a local Next.js app over a personal Apple Health export. One process (Node 24, `.nvmrc`) serves the dashboard and the `/api/*` endpoints, and stores everything in a local SQLite database.

| Half | Stack | Lives in |
|---|---|---|
| Backend | Next.js 16 route handlers, SQLite (`better-sqlite3` + Drizzle ORM), TypeScript. Legacy Python parser until the TS port lands | `src/app/api/`, `src/server/`, `scripts/`, data in `data/pulsefit.db` |
| Frontend | React 19 client components, Ant Design 6, `@ant-design/plots` 2 (G2 v5), Framer Motion, react-leaflet 5 | `src/app/` (layout/page), `src/components/`, `src/services/` (API client) |

The boundary between them is the HTTP API, specified in [`.agents/contracts/data-contract.md`](.agents/contracts/data-contract.md) and typed in `src/types/api.ts` (domain types in `src/types/index.ts`).

**Product goal, target architecture and roadmap: [`docs/PROJECT_GOALS.md`](docs/PROJECT_GOALS.md).** The backend is growing into several local processes: ingestion, API server, workout catalog fetcher and AI recommender. Original v1 requirements: `docs/v1-spec.md`. v1 architecture and feature list: `docs/v1-plan.md`, `README.md`.

## Commands

```bash
nvm use                      # Node 24 (see .nvmrc); Node 20 is too old for better-sqlite3
npm install                  # install deps (also enables the pre-commit hook)
npm run dev                  # app + API on http://127.0.0.1:3000 (local only)
npm run typecheck            # tsc --noEmit (fast; run after every change)
npm run build                # production build (the "test suite" for now)
npm run db:generate          # create a migration after editing src/server/db/schema.ts
npm run db:import-json       # load public/data/*.json into data/pulsefit.db (until the TS parser lands)
npm run parse-data           # legacy Python re-parse of input/ (slow: ~1.25 GB XML), only when the pipeline changed
npm run check-personal-data  # scan tracked files for personal values
```

There is no unit-test runner or linter yet. Verification = type-check + build + visual check of the affected UI (see `.agents/roles/qa.md`).

## Conventions

- TypeScript strict; functional React components with hooks; follow the existing file's style and comment density.
- UI components come from Ant Design; charts from `@ant-design/plots` (G2 v5 option syntax — e.g. `style.radius` is a number; use `radiusTopLeft`/`radiusTopRight` for per-corner rounding).
- Dark theme (`theme: 'dark'` on charts, card background `#151a28`).
- Data shaping (filtering, aggregation) happens server-side in `src/server/`. `src/services/` is only the typed API client; components stay presentational where practical.
- Route handlers stay thin (`runtime = 'nodejs'`): validate input with zod, call `src/server` repos, and return contract shapes. Server-only modules `import 'server-only'`.
- Schema changes go through Drizzle migrations (`npm run db:generate`). Never edit the DB by hand.
- Parser: streaming (`iterparse`) only — never load the full XML into memory. Stdlib only unless a dependency is agreed with the user.

## Boundaries

- **Always:** keep `src/types/`, the DB schema, the API handlers and the data contract in sync in the same task; run the verification commands before claiming done.
- **Ask first:** adding dependencies, changing an API response shape, running the full `npm run parse-data`, deleting files, any call that costs money (AI requests).
- **Never:** hardcode personal values (date of birth, age, weight, blood type, totals, coordinates, …) in code or docs. Derive them from the imported data at runtime, and use neutral examples in docs. The pre-commit hook (`scripts/check_personal_data.py`, enabled via `core.hooksPath .githooks` by `npm install`) blocks them; never bypass it with `--no-verify`.
- **Never:** upload, paste, or send anything from `input/`, `public/data/` or `data/` to an external service; it is personal health data. Never read `input/**/*.xml` whole (918 MB / 334 MB); stream or `head` it. Never hand-edit `public/data/*.json` or `data/pulsefit.db`; regenerate them. Never edit `.next/` or `node_modules/`.

## Token economy (all agents)

Every token read is paid for on every later turn, so keep context small:
- **Never `cat`/Read `public/data/*.json` or dump DB tables.** `routes.json` is 5.3 MB (~1.5M tokens), `daily_metrics.json` 1.4 MB. Query them with a one-line `python3 -c` that prints counts, keys or a few records.
- Locate before reading: `grep -n` first, then read only the line range you need. Don't re-read a file you just edited.
- Trim command output: `npm run build 2>&1 | tail -15`, `npx tsc --noEmit 2>&1 | head -30`.
- Batch independent tool calls in one message.
- Screenshots cost ~1–2k tokens each: capture the affected card, not the full page.

## Multi-agent workflow

The agent that receives the user's request is the **orchestrator** and follows [`.agents/orchestrator.md`](.agents/orchestrator.md). Subagents (`frontend`, `backend`, `qa`) follow `.agents/roles/<role>.md`. They exchange work through `.agents/templates/` (brief in, handoff out), coordinate on `.agents/contracts/data-contract.md`, and keep state in `.agents/runs/`. Tools with native subagents map roles to their own format (Claude Code: `.claude/agents/`). Tools without them run roles sequentially, as described in the orchestrator file.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
