# AGENTS.md

Canonical instructions for any AI coding agent working in this repository (Claude Code, Codex, Cursor, Gemini CLI, Copilot, etc.).
Tool-specific files (e.g. `CLAUDE.md`, `.claude/agents/*`) only point here and add tool wiring. **If they disagree with this file, this file wins.**

## Project

PulseFit — a React dashboard over a personal Apple Health export. Two halves joined by a file-based data contract:

| Half | Stack | Lives in |
|---|---|---|
| Backend (data pipeline) | Python 3.12, streaming XML/GPX parser, stdlib only | `scripts/` → writes `public/data/*.json` |
| Frontend (dashboard) | React 18, TypeScript, Vite 6, Ant Design 5, `@ant-design/plots` 2 (G2 v5), Framer Motion, Leaflet | `src/` |

The boundary between them is `public/data/*.json`, described in [`.agents/contracts/data-contract.md`](.agents/contracts/data-contract.md) and typed in `src/types/index.ts`.

**Product goal, target architecture and roadmap: [`docs/PROJECT_GOALS.md`](docs/PROJECT_GOALS.md).** The backend is growing into several local processes: ingestion, API server, workout catalog fetcher and AI recommender. Original v1 requirements: `docs/v1-spec.md`. v1 architecture and feature list: `docs/v1-plan.md`, `README.md`.

## Commands

```bash
npm install                  # install deps
npm run dev                  # dev server on http://localhost:3000
npx tsc --noEmit             # type-check (fast; run after every frontend change)
npm run build                # tsc + production build (the frontend "test suite" for now)
python3 -m py_compile scripts/parse_health_data.py   # syntax-check the parser
npm run parse-data           # full re-parse of input/ (slow: ~1.25 GB XML) — only when the pipeline changed
```

There is no unit-test runner or linter yet. Verification = type-check + build + visual check of the affected UI (see `.agents/roles/qa.md`).

## Conventions

- TypeScript strict; functional React components with hooks; follow the existing file's style and comment density.
- UI components come from Ant Design; charts from `@ant-design/plots` (G2 v5 option syntax — e.g. `style.radius` is a number; use `radiusTopLeft`/`radiusTopRight` for per-corner rounding).
- Dark theme (`theme: 'dark'` on charts, card background `#151a28`).
- Data shaping for charts belongs in `src/services/`; components stay presentational where practical.
- Parser: streaming (`iterparse`) only — never load the full XML into memory. Stdlib only unless a dependency is agreed with the user.

## Boundaries

- **Always:** keep `src/types/index.ts`, the parser output, and the data contract in sync in the same task; run the verification commands before claiming done.
- **Ask first:** adding dependencies, changing the shape of any `public/data/*.json` file, running the full `npm run parse-data`, deleting files.
- **Never:** hardcode personal values (date of birth, age, weight, blood type, totals, coordinates, …) in code or docs. Derive them from the imported data at runtime, and use neutral examples in docs. The pre-commit hook (`scripts/check_personal_data.py`, enabled via `core.hooksPath .githooks` by `npm install`) blocks them; never bypass it with `--no-verify`.
- **Never:** upload, paste, or send anything from `input/` or `public/data/` to an external service — it is personal health data. Never read `input/**/*.xml` whole (918 MB / 334 MB); stream or `head` it. Never hand-edit `public/data/*.json`; regenerate it. Never edit `dist/` or `node_modules/`.

## Token economy (all agents)

Every token read is paid for on every later turn, so keep context small:
- **Never `cat`/Read `public/data/*.json`.** `routes.json` is 5.3 MB (~1.5M tokens), `daily_metrics.json` 1.4 MB. Query them with a one-line `python3 -c` that prints counts, keys or a few records.
- Locate before reading: `grep -n` first, then read only the line range you need. Don't re-read a file you just edited.
- Trim command output: `npm run build 2>&1 | tail -15`, `npx tsc --noEmit 2>&1 | head -30`.
- Batch independent tool calls in one message.
- Screenshots cost ~1–2k tokens each: capture the affected card, not the full page.

## Multi-agent workflow

The agent that receives the user's request is the **orchestrator** and follows [`.agents/orchestrator.md`](.agents/orchestrator.md). Subagents (`frontend`, `backend`, `qa`) follow `.agents/roles/<role>.md`. They exchange work through `.agents/templates/` (brief in, handoff out), coordinate on `.agents/contracts/data-contract.md`, and keep state in `.agents/runs/`. Tools with native subagents map roles to their own format (Claude Code: `.claude/agents/`). Tools without them run roles sequentially, as described in the orchestrator file.
