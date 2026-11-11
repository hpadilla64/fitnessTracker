# PulseFit Intelligence — Health & Fitness Tracker Dashboard

A high-performance health metrics analytics dashboard and adaptive exercise routine recommender built with **Next.js** (App Router + API routes), **React**, **TypeScript**, **SQLite** (Drizzle ORM), **Ant Design**, **Ant Design Charts (`@ant-design/plots`)**, **Framer Motion**, and **Leaflet**. Runs entirely on your machine.

Powered by your own Apple Health export (records, workouts and GPX routes), processed and served locally. Personal data never leaves your machine and is never committed.

---

## Features

### 1. Health & Activity Metrics Tab
- **KPI Summary Cards**: Animated cards for Current Weight & BMI, Daily Steps, Active Energy Expenditure, Resting Heart Rate, VO2 Max cardio fitness, and Workout volume.
- **Interactive Graphics (`@ant-design/plots`)**:
  - **Body Weight & BMI Progression**: Continuous area/line chart tracking historical weigh-ins.
  - **Daily Steps & Walking Activity**: Bar/column charts comparing daily counts against the 10,000 steps goal.
  - **Energy Expenditure**: Dual-series visualization of Active Energy vs Basal Metabolic Rate (BMR).
  - **Cardiovascular Health**: Longitudinal trend lines of Resting Heart Rate and VO2 Max.
  - **Workout Activity Distribution**: Donut chart breaking down sessions (Walking, Functional Strength Training, HIIT, Running, etc.).
  - **Sleep Duration**: Nightly sleep tracking.
- **Interactive Timeline Filters**: Fast switching between 30 Days, 90 Days, 1 Year, 3 Years, and All Time (10 Years).

### 2. Weight Goals & Routine Recommendation Tab
- **Interactive Goal Setup**:
  - Pre-populated with your latest imported weight, basal metabolic rate, and TDEE (computed from the 30-day averages).
  - Configurable target weight, timeframe slider (2 to 52 weeks), weekly workout frequency (3 to 6 days/week), and training focus (Balanced, Cardio & Incline Walk, Strength & Hypertrophy, HIIT).
- **Caloric Deficit & Feasibility Analysis**:
  - Computes total required deficit (based on $7,700\text{ kcal/kg}$ fat mass equivalent), daily deficit, target dietary intake, and weekly exercise expenditure.
  - Automatic safety check (Safe / Moderate / Aggressive / Extreme alert) with medically guided advice.
  - **Target Weight Trajectory Chart**: Visualizes projected goal progression vs current baseline over the planned weeks.
- **Recommended Routine Table (Ant Design `Table`)**:
  - Displays a customized 7-day training schedule matching the user's historical fitness capabilities.
  - Columns: **Day**, **Workout Category**, **Session Title**, **Duration**, **Intensity / Zone**, **Volume / Protocol**, **Est. Burn**, and **Action**.
  - Interactive row expansion and "View Plan" modal displaying individual exercise movements, sets, reps, form cues, required equipment, and coaching tips.
  - "Print / Save Routine" capability with print-optimized stylesheets.

### 3. Workouts History & GPX Route Explorer Tab
- Filterable and searchable catalog of all recorded workouts with sorting by date, duration, distance, and calories.
- **Interactive Leaflet GPS Map**: Renders outdoor workout routes using OpenStreetMap tiles, route polylines, start/finish elevation markers, and track statistics.

---

## Getting Started

### Prerequisites
- Node.js 24 LTS (`nvm use` reads `.nvmrc`)
- npm v10+
- Python 3 (for the `check-personal-data` pre-commit hook)
- [Claude Code](https://docs.claude.com/en/docs/claude-code) CLI, installed and logged in (`claude --version` should work in the shell that runs `npm run dev`). Only needed for AI routine recommendations, which run the CLI locally with the Haiku model and use your Claude plan. Without it, the app falls back to the built-in rule engine.

### Quick Start
```bash
# 1. Install dependencies (also enables the personal-data pre-commit hook)
npm install

# 2. Unzip your Apple Health export into input/apple_health_export/
#    (input/ and data/ are never committed)

# 3. Start the app (dashboard + API, bound to 127.0.0.1)
npm run dev
```

Then click **Import Apple Health data** in the dashboard. It stream-parses the export into the local SQLite database (`data/pulsefit.db`) in the background, in well under a minute. Re-import from the header button whenever the export changes, or run `npm run ingest` from the terminal.

The **Exercise catalog** card in the Weight Goals tab syncs the public [wger.de](https://wger.de) exercise database (CC-BY-SA 4.0) into the same database. Click **Sync catalog**, or run `npm run catalog:sync`. Only public requests are made, and nothing about you is sent.

Visit `http://127.0.0.1:3000`.

### Production Build & Preview
```bash
# Build production bundle
npm run build

# Serve the production build locally (127.0.0.1:3000)
npm run start
```

---

## Project Structure

```
fitnessTracker/
├── input/apple_health_export/       # your Apple Health export (git-ignored)
├── data/pulsefit.db                 # local SQLite database (git-ignored)
├── scripts/
│   ├── ingest.ts                    # npm run ingest: import the export from the terminal
│   ├── catalog-sync.ts              # npm run catalog:sync: fetch the wger.de exercise catalog
│   └── check_personal_data.py       # pre-commit guard against hardcoded personal values
├── src/
│   ├── app/
│   │   ├── layout.tsx, page.tsx     # Next.js shell (dashboard is a client-only component)
│   │   └── api/                     # route handlers: status, health/*, workouts, preferences, goals, process-data
│   ├── components/                  # Dashboard + tabs (metrics, goal planner, workouts/routes)
│   ├── server/                      # db (Drizzle schema, migrations, repos), aggregation, ingest (parser + import job)
│   ├── services/                    # typed API client + (for now) client-side recommendation engine
│   └── types/                       # domain types (index.ts) and API types (api.ts)
├── docs/                            # PROJECT_GOALS.md (roadmap), v1 spec and plan
├── .agents/                         # orchestrator, roles, data contract (see AGENTS.md)
├── drizzle.config.ts, next.config.ts, tsconfig.json
└── package.json
```
