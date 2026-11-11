# Project goals

The product's purpose, target state and open decisions. **Orchestrator:** read this in the *Understand* step (`.agents/orchestrator.md`). Check each request against the constraints below. Ask the user about anything listed under *Open decisions* instead of assuming.

[`v1-spec.md`](v1-spec.md) holds the original acceptance criteria for v1 (a client-only dashboard). This file describes where the project is going.

## Purpose

Read the user's Apple Health export (copied into `input/`) and show it in a dashboard that helps them understand their health, set weight goals, and follow workout routines suited to them.

## Constraints

- **Runs locally.** Frontend and backend run on the user's machine. No hosting, no accounts.
- **Single user**: the owner of the health export.
- **Health data stays local.** Nothing from `input/` or `data/` leaves the machine, except the minimum an approved web or AI call needs. The user must approve what is sent (see `AGENTS.md` › Boundaries).

## Features

The app has three tabs.

### 1. Health & Activity Metrics
- **Goal:** main dashboard showing the imported health data as charts: weight/BMI, steps, energy, heart rate and VO2 max, workout mix, and sleep, with timeline filters.
- **Current state:** implemented (`src/components/tabs/HealthMetricsTab.tsx`).

### 2. Weight Goals & Routine Recommendation
- **Goal:**
  - The user sets a weight goal and a timeframe, and **tracks progress** against it using imported weigh-ins.
  - The user chooses how many days per week they want to work out, and the app suggests workouts to reach the goal.
  - **Suggestions come from the backend**, which builds them from a fetched workout catalog plus an AI recommendation tailored to the user's data and goal.
- **Current state:**
  - Goal form, deficit and safety analysis, projected trajectory chart and routine table exist (`src/components/tabs/WeightGoalPlannerTab.tsx`).
  - Suggestions come from a hardcoded **client-side** engine (`src/services/recommendationEngine.ts`, `evaluateWeightGoalAndRecommendRoutine`).
  - There is no actual-vs-goal progress tracking, and the goal isn't persisted.

### 3. Workout History & GPX Route Explorer
- **Goal:** the user's workout history (filterable and sortable), with GPS routes on a map.
- **Current state:**
  - Implemented (`src/components/tabs/WorkoutsRoutesTab.tsx`).
  - Known gap: `routePath` is `null` for every workout, so routes aren't linked to their workouts.

## Backend: multiple processes

The backend is not a single program. The **backend role owns all of these processes**:

| Process | Purpose | Status |
|---|---|---|
| Health data ingestion | Stream-parse `input/` into SQLite (`src/server/ingest/`, `POST /api/process-data`, `npm run ingest`) | done |
| Local API server | Serve health data, goals, progress and recommendations to the frontend (Next.js route handlers over SQLite) | read API + preferences done |
| Workout catalog fetcher | Fetch exercises from wger.de into SQLite (`src/server/catalog/`, `POST /api/catalog/sync`, `npm run catalog:sync`) | done |
| AI recommender | Combine health data, the goal, days per week and the catalog into a suggested routine, by running the local `claude` CLI headlessly with Haiku | planned |

Target flow:

```mermaid
flowchart LR
  IN[input/ Apple Health export] --> ING[Ingestion] --> DATA[(Health data)]
  WEB[wger.de exercise API] --> FET[Catalog fetcher] --> CAT[(Workout catalog)]
  DATA --> AI[AI recommender]
  CAT --> AI
  GOAL[(Goals and preferences)] --> AI
  DATA --> API[Local API server]
  AI --> API
  GOAL --> API
  API --> FE[Frontend dashboard]
```

The frontend⇄backend interface is the HTTP API defined in `.agents/contracts/data-contract.md`.

## Roadmap

Do these in order. Each step should leave the app working.

1. ~~**Local API server + DB.**~~ Done: Next.js app, SQLite, read API, preferences.
2. ~~**process-data.**~~ Done: TypeScript parser as a background job (`POST /api/process-data`, dashboard Import button), parity-checked against Python before the Python script was removed. Workouts now carry distance and energy.
3. ~~**Goal persistence and progress tracking.**~~ Done: goal saved via `/api/goals`, weigh-ins vs plan charted in tab 2 (`/api/goals/progress`).
4. ~~**Workout catalog fetcher.**~~ Done: wger.de exercises synced into SQLite as a background job (`POST /api/catalog/sync`, `npm run catalog:sync`), served by `/api/catalog*`, and browsable in tab 2 with CC-BY-SA attribution.
5. **AI recommendations** (Claude via the local `claude` CLI, model Haiku), with the current rule engine moved server-side as the fallback.
   - **No Anthropic API calls and no SDK dependency.** The backend spawns the Claude Code CLI (`child_process.spawn`, no shell) in print mode. The CLI must be installed on the machine and logged in. The app has no API key and doesn't read `ANTHROPIC_API_KEY`.
   - **Model:** always `--model haiku`. Don't make it configurable to a larger model.
   - **Invocation:** `claude -p --model haiku --output-format json --json-schema '<routine schema>' --tools "" --no-session-persistence --setting-sources ""`, with a fixed system prompt (`--system-prompt`) and the prompt on stdin. No tools, no MCP and no project settings, so the model can only answer. Set a timeout (for example 90 s) and kill the process on timeout.
   - **Input:** only the allowlisted summary (see *Decisions › AI data scope*), the goal, days per week, focus, and a subset of the cached catalog (ids + names + category + equipment). Send nothing else.
   - **Output:** parse the CLI's JSON result. Validate the structured routine with zod, and reject exercise ids that aren't in the catalog. Store the plan in `recommendations` with `source: 'ai'`, `model`, the token counts and `total_cost_usd` from the result (`costUsd`; on a subscription it's an estimate). Reuse a stored plan when `inputHash` matches.
   - **Fallback:** when the CLI isn't installed, isn't logged in, times out, or returns invalid output, serve the server-side rule engine (`source: 'fallback'`) and say why in the response.
   - **Detection:** `StatusResponse.aiConfigured` means "the `claude` CLI was found on `PATH`", for example via `claude --version`, which makes no model call. It replaces the current `ANTHROPIC_API_KEY` check in `src/server/db/repos/status.ts`. Allow overriding the binary path with `PULSEFIT_CLAUDE_BIN`.
   - **Cost and consent:** every generation is a model call that counts against the user's Claude plan or API billing. Generate only on an explicit user action (a "Generate with AI" button or `POST`), never on page load or in the background, and never in tests without asking the user.

Fixing the route linkage (tab 3) is independent and can be done at any time.

## Decisions

Decided with the user on 2026-10-25:
- **Framework:** one Next.js app (App Router) serving the UI and `/api/*`, bound to 127.0.0.1. Node 24 LTS.
- **Storage:** SQLite (`data/pulsefit.db`) via better-sqlite3 + Drizzle ORM, for health data, preferences/needs, goals, catalog, recommendations and job runs.
- **Parser:** ported to TypeScript (streaming SAX).
- **Workout source:** the wger.de open API (exercises, CC-BY-SA; show attribution).
- **AI:** Anthropic Claude with structured output, grounded on the cached catalog. *Changed on 2026-11-10:* called through the locally installed `claude` CLI (headless, `--json-schema`), not the HTTP API. The model is Haiku.
- **AI data scope:** only an allowlisted summary (sex, age, weight, BMI, resting HR, VO2 max, 30-day averages, workout-type counts, and the needs the user entered). Never DOB, dates, GPS or raw records.

## Open decisions

The orchestrator asks the user about these. It doesn't decide them.

- **Route linkage:** how to match GPX files to workouts (e.g. by start timestamp), since `routePath` is empty in the export.
