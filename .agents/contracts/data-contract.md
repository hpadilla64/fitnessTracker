# Data contract: backend ⇄ frontend

The interface between the backend (parser in `src/server/ingest/`, SQLite, `/api/*`) and the frontend (`src/`). The frontend codes against **this file**. TypeScript mirror: `src/types/index.ts` (domain) and `src/types/api.ts` (API). Owner: backend role. Changes need orchestrator approval, and breaking changes need the user's.

The domain shapes below are what the parser produces, what SQLite stores, and what the API serves (the headings keep the historical JSON file names).

## `profile.json` → `UserProfile` (object)

| Field | Type | Notes |
|---|---|---|
| sex, dob, bloodType | string \| null | from the export's `Me` element; `null` if absent. `dob` is `YYYY-MM-DD`; `bloodType` is the HealthKit enum suffix (e.g. `ONegative`) |
| currentWeight, currentBMI, currentLeanMass | number \| null | latest recorded values (kg, kg/m², kg); `null` if never recorded |
| totalWorkouts, totalSteps | integer | lifetime totals |
| totalActiveCalories, totalDistanceKm | number | lifetime totals |
| dateRange | `{ start, end }` strings | `YYYY-MM-DD`; equals first/last `daily_metrics` date |
| avgDailySteps30d, avgActiveKcal30d, avgBasalKcal30d, avgRestingHR30d | number | trailing 30 days ending at `dateRange.end` |
| recentVO2Max | number | latest VO2 max |
| workoutTypeCounts | `Record<string, integer>` | key = HealthKit workout type without prefix (e.g. `FunctionalStrengthTraining`) |

## `daily_metrics.json` → `DailyMetric[]`

One object per calendar day. Sorted ascending by `date`, dates unique, no gaps are guaranteed only within recorded periods.

| Field | Type | Null semantics |
|---|---|---|
| date | string `YYYY-MM-DD` | never null |
| steps, flightsClimbed | integer | `0` = nothing recorded |
| distanceKm, activeKcal, basalKcal, exerciseMinutes, standMinutes, sleepHours | number | `0` = nothing recorded (sums) |
| avgHeartRate, restingHR, walkingHR, hrv, vo2max | number \| null | `null` = no sample that day (averages / point readings) |
| weightKg, bmi, leanMassKg | number \| null | `null` = no measurement that day |

Rule: **sums use `0`, averages and point readings use `null`.** Consumers must not chart `null` as zero.

## `workouts.json` → `Workout[]`

| Field | Type | Notes |
|---|---|---|
| id | string | `workout-<n>`, unique |
| type | string | same keys as `profile.workoutTypeCounts` |
| startDate, endDate | string | HealthKit format `YYYY-MM-DD HH:MM:SS ±ZZZZ` (not ISO) |
| durationMinutes, distanceKm, energyKcal | number | `0` = not recorded |
| routePath | string \| null | key into routes (`GET /api/health/routes/[filename]`); currently `null` for all workouts (routes are not yet linked) |
| routeData | GpxRoute \| null | optional; not emitted by the parser (frontend may attach at runtime) |

## `routes.json` → `Record<string, GpxRoute>`

Key = GPX filename (e.g. `route_2024-01-31_7.15am.gpx`).

| Field | Type | Notes |
|---|---|---|
| filename | string | same as key |
| pointCount | integer | points in the original track |
| distanceKm | number | haversine sum over the original track |
| startPoint, endPoint | `{ lat, lon, ele }` | degrees, degrees, metres |
| points | `{ lat, lon, ele }[]` | downsampled for rendering |

## API

The Next.js route handlers (`src/app/api/**`) serve the same domain shapes from SQLite (`data/pulsefit.db`). TypeScript types: `src/types/api.ts`. All responses are JSON. Errors are `{ error, code? }` with a 4xx/5xx status. When no data has been imported, data endpoints return `503 { code: "NO_DATA" }`.

| Method & path | Request | Response |
|---|---|---|
| `GET /api/status` | none | `StatusResponse`; always 200, even with no data |
| `GET /api/health/profile` | none | `UserProfile` |
| `GET /api/health/daily` | `?range=30d\|90d\|1y\|3y\|all` (default `1y`), `?period=daily\|weekly\|monthly` (default: `daily` up to 1y, `weekly` for 3y, `monthly` for all) | `DailyResponse`. The range is measured back from the **last** date in the data, not today. `aggregated` averages sums per period, averages non-null vitals, and takes the latest weight/BMI |
| `GET /api/workouts` | none | `WorkoutSummary[]`, newest first |
| `GET /api/health/routes/[filename]` | filename = `routes` key | `GpxRoute`, or `404 NOT_FOUND` |
| `GET /api/preferences` | none | `UserPreferences` (defaults if never saved: `1y`, `metrics`, `metric`, nulls, `[]`, `""`) |
| `PUT /api/preferences` | `PreferencesUpdate` (partial; unknown keys → 400) | the merged `UserPreferences` |
| `GET /api/goals` | none | the active `Goal`, or `null` (200) if none was saved |
| `PUT /api/goals` | `GoalUpdate`: all fields required; weights 30–300 kg, timeframe 2–52 weeks, integers not required; unknown keys → 400 | the active `Goal`. If the values equal the active goal, it's returned unchanged (no new row); otherwise the previous goal is archived (`active=false`) and a new one is created |
| `GET /api/goals/progress` | none | `GoalProgress`, or `null` (200) if no active goal. `startDate` = date part of the goal's `createdAt` (UTC); `endDate` = start + `timeframeWeeks`. `plan`: one point per week (incl. both ends), linear from `startWeightKg` to `targetWeightKg`, 1 decimal. `weighIns`: non-null `weightKg` days from start − 8 weeks to `endDate`. `latest`: the newest weigh-in in [start, end] with the linearly interpolated `plannedKg` and `deltaKg = weightKg − plannedKg`, else `null`. `status`: `no_data` if `latest` is null; else `on_track` if \|delta\| ≤ 0.5 kg, otherwise `ahead`/`behind` by direction of the goal (loss: below plan = ahead; gain: above plan = ahead). `dataEndDate` = last date in `daily_metrics`, or `null` |
| `POST /api/process-data` | none (empty body or `{}`; anything else → 400) | `202 IngestJob` (state `running`). `409 { code: "CONFLICT" }` if a job is already running; `400 { code: "NO_INPUT" }` if `input/apple_health_export/export.xml` is missing. Runs in the background: streams `export.xml` + `workout-routes/*.gpx`, then replaces profile, daily_metrics, workouts and routes in **one transaction** (a failed or killed run leaves the previous data intact). Each run is logged in `ingest_runs` (`source: "ts-parser"`; `npm run ingest` logs `"cli"`, and a running CLI run also yields 409) |
| `GET /api/process-data` | none | the latest `IngestJob`, or `null` if none ever ran. `phase` is set only while running (`records` → `routes` → `writing`); `progress` 0–1 over the whole job. A `running` row with no live job in this process (server restarted) is reported and stored as `failed` with `error: "interrupted"` (a `cli` run only after 15 min, since it runs in another process) |
| `GET /api/catalog` | none | `CatalogSummary`; always 200 (`exerciseCount: 0`, nulls/`[]` if never synced) |
| `GET /api/catalog/exercises` | `?q=` (case-insensitive substring of name), `?category=`, `?equipment=`, `?muscle=` (exact names from `CatalogSummary`; muscle matches primary or secondary; `equipment=none` matches `[]`), `?limit=` 1–200 (default 50), `?offset=` ≥ 0; unknown params ignored, invalid values → 400 | `CatalogExercisesResponse`, sorted by name. Empty `items` if never synced |
| `POST /api/catalog/sync` | none (empty body or `{}`; anything else → 400) | `202 CatalogSyncJob` (state `running`). `409 CONFLICT` if a sync is already running. In the background fetches all pages of `https://wger.de/api/v2/exerciseinfo/` (public, no auth, GET only, nothing about the user is sent), keeps exercises with an English (`language: 2`) translation, then replaces `catalog_exercises` in **one transaction** (a failed run keeps the previous catalog). Logged in `catalog_syncs`; `npm run catalog:sync` does the same from the CLI |
| `GET /api/catalog/sync` | none | the latest `CatalogSyncJob`, or `null` if never run. A `running` row with no live job in this process is reported and stored as `failed`, `error: "interrupted"` (CLI runs after 15 min) |

`POST /api/process-data` and `npm run ingest` run the TypeScript parser and write these shapes straight to SQLite. (The legacy Python parser and its JSON files were removed on 2026-11-09 after a full parity check.)

## Changelog

Newest first. One line per change: date · file.field · change · breaking yes/no.

- 2026-11-10 · API · `GET /api/catalog`, `GET /api/catalog/exercises`, `POST/GET /api/catalog/sync` added (wger.de workout catalog) · no
- 2026-11-09 · all · Python parser, `public/data/*.json` and `db:import-json` removed; the TS parser is the only producer · no
- 2026-11-09 · API · `POST/GET /api/process-data` added; `ApiError.code` gains `CONFLICT`, `NO_INPUT`; workouts' `distanceKm`/`energyKcal` now filled from `<WorkoutStatistics>` · no
- 2026-11-09 · API · `GET /api/goals/progress` added (weigh-ins vs goal plan) · no
- 2026-10-25 · API · `GET/PUT /api/goals` added (planner form persistence) · no
- 2026-10-25 · API · phase-1 endpoints (status, health, workouts, routes, preferences) defined; data now served from SQLite · no
- 2026-10-25 · profile.sex/dob/bloodType/currentWeight/currentBMI/currentLeanMass · now nullable; parser no longer hardcodes defaults · no (consumers handle null)
- 2026-10-24 · all · contract documented from existing output · no
