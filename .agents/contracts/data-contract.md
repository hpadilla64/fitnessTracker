# Data contract: backend ⇄ frontend

The interface between `scripts/parse_health_data.py` (producer) and `src/` (consumer). The frontend codes against **this file**. TypeScript mirror: `src/types/index.ts`. Owner: backend role. Changes need orchestrator approval, and breaking changes need the user's.

All files are UTF-8 JSON in `public/data/`, served statically and fetched by `src/services/dataService.ts`.

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
| routePath | string \| null | key into `routes.json`; currently `null` for all workouts (routes are not yet linked) |
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

## API (planned)

There is no server yet. When the local API server is created (roadmap step 1 in `docs/PROJECT_GOALS.md`), specify each endpoint here: method, path, request and response shapes, and errors. The frontend codes against this section, as it does for the files above.

## Changelog

Newest first. One line per change: date · file.field · change · breaking yes/no.

- 2026-10-25 · profile.sex/dob/bloodType/currentWeight/currentBMI/currentLeanMass · now nullable; parser no longer hardcodes defaults · no (consumers handle null)
- 2026-10-24 · all · contract documented from existing output · no
