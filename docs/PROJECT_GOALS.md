# Project goals

The product's purpose, target state and open decisions. **Orchestrator:** read this in the *Understand* step (`.agents/orchestrator.md`). Check each request against the constraints below. Ask the user about anything listed under *Open decisions* instead of assuming.

[`v1-spec.md`](v1-spec.md) holds the original acceptance criteria for v1 (a client-only dashboard). This file describes where the project is going.

## Purpose

Read the user's Apple Health export (copied into `input/`) and show it in a dashboard that helps them understand their health, set weight goals, and follow workout routines suited to them.

## Constraints

- **Runs locally.** Frontend and backend run on the user's machine. No hosting, no accounts.
- **Single user**: the owner of the health export.
- **Health data stays local.** Nothing from `input/`, `public/data/` or `data/` leaves the machine, except the minimum an approved web or AI call needs. The user must approve what is sent (see `AGENTS.md` › Boundaries).

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
| Health data ingestion | Stream-parse `input/` → `public/data/*.json` (`scripts/parse_health_data.py`) | exists |
| Local API server | Serve health data, goals, progress and recommendations to the frontend (Next.js route handlers over SQLite) | read API + preferences done |
| Workout catalog fetcher | Fetch workout plans and exercises from a web source; store them locally | planned (source TBD) |
| AI recommender | Combine health data, the goal, days per week and the catalog into a suggested routine | planned (provider TBD) |

Target flow:

```mermaid
flowchart LR
  IN[input/ Apple Health export] --> ING[Ingestion] --> DATA[(Health data)]
  WEB[Workout web source - TBD] --> FET[Catalog fetcher] --> CAT[(Workout catalog)]
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
2. **process-data.** Port the parser to TypeScript (`POST /api/process-data` as a background job), with a parity check against the Python output before the Python script is removed.
3. **Goal persistence and progress tracking.** Store the goal, and chart actual weigh-ins against it in tab 2.
4. **Workout catalog fetcher** (wger.de).
5. **AI recommendations** (Claude), with the current rule engine moved server-side as the fallback.

Fixing the route linkage (tab 3) is independent and can be done at any time.

## Decisions

Decided with the user on 2026-10-25:
- **Framework:** one Next.js app (App Router) serving the UI and `/api/*`, bound to 127.0.0.1. Node 24 LTS.
- **Storage:** SQLite (`data/pulsefit.db`) via better-sqlite3 + Drizzle ORM, for health data, preferences/needs, goals, catalog, recommendations and job runs.
- **Parser:** ported to TypeScript (streaming SAX).
- **Workout source:** the wger.de open API (exercises, CC-BY-SA; show attribution).
- **AI:** Anthropic Claude with structured output, grounded on the cached catalog.
- **AI data scope:** only an allowlisted summary (sex, age, weight, BMI, resting HR, VO2 max, 30-day averages, workout-type counts, and the needs the user entered). Never DOB, dates, GPS or raw records.

## Open decisions

The orchestrator asks the user about these. It doesn't decide them.

- **Route linkage:** how to match GPX files to workouts (e.g. by start timestamp), since `routePath` is empty in the export.
