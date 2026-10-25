# PulseFit Intelligence — Health & Fitness Tracker Dashboard

A high-performance health metrics analytics dashboard and adaptive exercise routine recommender built with **React**, **TypeScript**, **Ant Design**, **Ant Design Charts (`@ant-design/plots`)**, **Framer Motion**, and **Leaflet**.

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
- Node.js v18+ (tested on Node v20.19)
- npm v9+

### Quick Start
```bash
# 1. Install dependencies (also enables the personal-data pre-commit hook)
npm install

# 2. Unzip your Apple Health export into input/apple_health_export/, then generate public/data/
#    (required on first run and whenever the export changes; neither folder is committed)
npm run parse-data

# 3. Start development server
npm run dev
```

Visit `http://localhost:3000` (or the port indicated in your terminal).

### Production Build & Preview
```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## Project Structure

```
fitnessTracker/
├── input/
│   └── apple_health_export/
│       ├── export.xml               # Apple Health export
│       ├── export_cda.xml           # CDA vitals document
│       └── workout-routes/          # GPX GPS route tracks
├── scripts/
│   └── parse_health_data.py         # Memory-efficient streaming data extractor
├── public/
│   └── data/
│       ├── profile.json             # Demographics, averages, and totals
│       ├── daily_metrics.json       # Daily aggregated time series
│       ├── workouts.json            # Workout records
│       └── routes.json              # Downsampled GPS coordinates
├── src/
│   ├── components/
│   │   ├── MetricCard.tsx           # Framer Motion animated KPI card
│   │   └── tabs/
│   │       ├── HealthMetricsTab.tsx     # Tab 1: Charts & Vitals
│   │       ├── WeightGoalPlannerTab.tsx # Tab 2: Goal Form & Routine Table
│   │       └── WorkoutsRoutesTab.tsx    # Tab 3: Workouts & Leaflet GPS Map
│   ├── services/
│   │   ├── dataService.ts           # Data loader, downsampling & filter utils
│   │   └── recommendationEngine.ts  # Science-based deficit & routine generator
│   ├── types/
│   │   └── index.ts                 # Full TypeScript definitions
│   ├── App.tsx                      # App layout, header, and tab navigation
│   ├── main.tsx                     # React entrypoint
│   └── index.css                    # Dark theme styles & print rules
├── package.json
├── tsconfig.json
└── vite.config.ts
```
