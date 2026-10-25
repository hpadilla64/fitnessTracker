#!/usr/bin/env python3
import os
import re
import glob
import json
import math
import sys
import xml.etree.ElementTree as ET
from datetime import datetime
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INPUT_DIR = os.path.join(BASE_DIR, "input", "apple_health_export")
EXPORT_XML = os.path.join(INPUT_DIR, "export.xml")
ROUTES_DIR = os.path.join(INPUT_DIR, "workout-routes")
OUTPUT_DIR = os.path.join(BASE_DIR, "public", "data")

os.makedirs(OUTPUT_DIR, exist_ok=True)

print("Starting Apple Health data extraction...")
print(f"Input: {EXPORT_XML}")
print(f"Output: {OUTPUT_DIR}")

# 1. Inspect Profile & Demographics
profile = {
    # Personal fields are filled only from the export; never hardcode real values here
    "sex": None,
    "dob": None,
    "bloodType": None,
    "currentWeight": None,
    "currentBMI": None,
    "currentLeanMass": None,
    "totalWorkouts": 0,
    "totalActiveCalories": 0,
    "totalSteps": 0,
    "totalDistanceKm": 0,
    "dateRange": {"start": None, "end": None}
}

# Daily accumulators: date_str -> metrics dict
daily = defaultdict(lambda: {
    "steps": 0,
    "distanceKm": 0.0,
    "activeKcal": 0.0,
    "basalKcal": 0.0,
    "exerciseMinutes": 0.0,
    "standMinutes": 0.0,
    "flightsClimbed": 0,
    "heartRates": [],
    "restingHR": None,
    "walkingHR": None,
    "hrv": [],
    "vo2max": None,
    "weightKg": None,
    "bmi": None,
    "leanMassKg": None,
    "sleepHours": 0.0,
    "walkingSpeed": [],
    "stepLength": [],
    "walkingAsymmetry": []
})

workouts = []

# Streaming parser for export.xml
count = 0
min_date = "9999-99-99"
max_date = "0000-00-00"

context = ET.iterparse(EXPORT_XML, events=("start", "end"))
_, root = next(context)

for event, elem in context:
    if event == "start" and elem.tag == "Me":
        sex = elem.get("HKCharacteristicTypeIdentifierBiologicalSex", "")
        if "Female" in sex:
            profile["sex"] = "Female"
        elif "Male" in sex:
            profile["sex"] = "Male"
        profile["dob"] = elem.get("HKCharacteristicTypeIdentifierDateOfBirth", profile["dob"])
        profile["bloodType"] = elem.get("HKCharacteristicTypeIdentifierBloodType", "").replace("HKBloodType", "") or None

    elif event == "end":
        if elem.tag == "Record":
            count += 1
            rtype = elem.get("type", "")
            sdate = elem.get("startDate", "")
            edate = elem.get("endDate", "")
            val_str = elem.get("value")

            if sdate:
                day = sdate[:10]
                if day < min_date:
                    min_date = day
                if day > max_date:
                    max_date = day

                d = daily[day]

                if val_str is not None:
                    try:
                        val = float(val_str)
                    except ValueError:
                        val = 0.0

                    if rtype == "HKQuantityTypeIdentifierStepCount":
                        d["steps"] += int(val)
                    elif rtype == "HKQuantityTypeIdentifierDistanceWalkingRunning":
                        unit = elem.get("unit", "km")
                        if unit == "mi":
                            val *= 1.60934
                        elif unit == "m":
                            val /= 1000.0
                        d["distanceKm"] += val
                    elif rtype == "HKQuantityTypeIdentifierActiveEnergyBurned":
                        d["activeKcal"] += val
                    elif rtype == "HKQuantityTypeIdentifierBasalEnergyBurned":
                        d["basalKcal"] += val
                    elif rtype == "HKQuantityTypeIdentifierAppleExerciseTime":
                        d["exerciseMinutes"] += val
                    elif rtype == "HKQuantityTypeIdentifierAppleStandTime":
                        d["standMinutes"] += val
                    elif rtype == "HKQuantityTypeIdentifierFlightsClimbed":
                        d["flightsClimbed"] += int(val)
                    elif rtype == "HKQuantityTypeIdentifierHeartRate":
                        d["heartRates"].append(val)
                    elif rtype == "HKQuantityTypeIdentifierRestingHeartRate":
                        d["restingHR"] = val
                    elif rtype == "HKQuantityTypeIdentifierWalkingHeartRateAverage":
                        d["walkingHR"] = val
                    elif rtype == "HKQuantityTypeIdentifierHeartRateVariabilitySDNN":
                        d["hrv"].append(val)
                    elif rtype == "HKQuantityTypeIdentifierVO2Max":
                        d["vo2max"] = val
                    elif rtype == "HKQuantityTypeIdentifierBodyMass":
                        unit = elem.get("unit", "kg")
                        if unit in ("lb", "lbs"):
                            val *= 0.453592
                        d["weightKg"] = val
                    elif rtype == "HKQuantityTypeIdentifierBodyMassIndex":
                        d["bmi"] = val
                    elif rtype == "HKQuantityTypeIdentifierLeanBodyMass":
                        unit = elem.get("unit", "kg")
                        if unit in ("lb", "lbs"):
                            val *= 0.453592
                        d["leanMassKg"] = val
                    elif rtype == "HKQuantityTypeIdentifierWalkingSpeed":
                        d["walkingSpeed"].append(val)
                    elif rtype == "HKQuantityTypeIdentifierWalkingStepLength":
                        d["stepLength"].append(val)
                    elif rtype == "HKQuantityTypeIdentifierWalkingAsymmetryPercentage":
                        d["walkingAsymmetry"].append(val)

            if rtype == "HKCategoryTypeIdentifierSleepAnalysis":
                # Calculate sleep duration in hours
                if sdate and edate:
                    try:
                        # parse e.g. 2024-01-31 07:00:00 +0000
                        t1 = datetime.strptime(sdate[:19], "%Y-%m-%d %H:%M:%S")
                        t2 = datetime.strptime(edate[:19], "%Y-%m-%d %H:%M:%S")
                        dur_hours = (t2 - t1).total_seconds() / 3600.0
                        if 0 < dur_hours < 18:
                            daily[sdate[:10]]["sleepHours"] += dur_hours
                    except Exception:
                        pass

        elif elem.tag == "Workout":
            count += 1
            w_type = elem.get("workoutActivityType", "").replace("HKWorkoutActivityType", "")
            sdate = elem.get("startDate", "")
            edate = elem.get("endDate", "")
            duration = float(elem.get("duration", "0"))
            dur_unit = elem.get("durationUnit", "min")
            if dur_unit == "s" or dur_unit == "sec":
                duration /= 60.0
            elif dur_unit == "hr":
                duration *= 60.0

            dist = float(elem.get("totalDistance", "0"))
            dist_unit = elem.get("totalDistanceUnit", "km")
            if dist_unit == "mi":
                dist *= 1.60934
            elif dist_unit == "m":
                dist /= 1000.0

            energy = float(elem.get("totalEnergyBurned", "0"))

            # Check if there is a WorkoutRoute child
            route_path = None
            for child in elem:
                if child.tag == "WorkoutRoute":
                    for sub in child:
                        if sub.tag == "FileReference":
                            route_path = sub.get("path")

            workouts.append({
                "id": f"workout-{len(workouts)+1}",
                "type": w_type,
                "startDate": sdate,
                "endDate": edate,
                "durationMinutes": round(duration, 1),
                "distanceKm": round(dist, 2),
                "energyKcal": round(energy, 1),
                "routePath": route_path
            })

        elem.clear()
        root.clear()
        if count % 500000 == 0 and count > 0:
            print(f"Processed {count:,} elements...", file=sys.stderr)

print(f"Completed XML streaming. Total elements processed: {count:,}")
print(f"Recorded days: {len(daily)}, Workouts: {len(workouts)}")

# 2. Parse GPX workout routes
routes = {}
if os.path.exists(ROUTES_DIR):
    gpx_files = sorted(glob.glob(os.path.join(ROUTES_DIR, "*.gpx")))
    print(f"Processing {len(gpx_files)} GPX route files...")
    for gpx_file in gpx_files:
        basename = os.path.basename(gpx_file)
        if basename.startswith("._"):
            continue
        try:
            tree = ET.parse(gpx_file)
            groot = tree.getroot()
            ns = {"gpx": "http://www.topografix.com/GPX/1/1"}
            trkpts = groot.findall(".//gpx:trkpt", ns)
            if not trkpts:
                # fallback without namespace
                trkpts = groot.findall(".//trkpt")

            pts = []
            total_dist = 0.0
            elevations = []
            prev_lat, prev_lon = None, None

            # Haversine distance helper
            def haversine(lat1, lon1, lat2, lon2):
                R = 6371.0
                dlat = math.radians(lat2 - lat1)
                dlon = math.radians(lon2 - lon1)
                a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon/2)**2
                c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
                return R * c

            for pt in trkpts:
                lat = float(pt.get("lat"))
                lon = float(pt.get("lon"))
                ele_elem = pt.find("gpx:ele", ns) if ns else pt.find("ele")
                ele = float(ele_elem.text) if ele_elem is not None and ele_elem.text else 0.0

                if prev_lat is not None:
                    total_dist += haversine(prev_lat, prev_lon, lat, lon)
                prev_lat, prev_lon = lat, lon

                pts.append({"lat": round(lat, 5), "lon": round(lon, 5), "ele": round(ele, 1)})

            if pts:
                # Downsample points for smooth Leaflet rendering (max 100 points)
                step = max(1, len(pts) // 100)
                sampled_pts = pts[::step]
                if pts[-1] not in sampled_pts:
                    sampled_pts.append(pts[-1])

                routes[basename] = {
                    "filename": basename,
                    "pointCount": len(pts),
                    "distanceKm": round(total_dist, 2),
                    "startPoint": sampled_pts[0],
                    "endPoint": sampled_pts[-1],
                    "points": sampled_pts
                }
        except Exception as e:
            print(f"Error parsing GPX {basename}: {e}", file=sys.stderr)

print(f"Extracted {len(routes)} valid GPX routes.")

# 3. Post-process Daily Metrics into clean sorted chronological array
daily_list = []
latest_weight = None
latest_bmi = None
latest_lean_mass = None

for day in sorted(daily.keys()):
    d = daily[day]
    # Update latest weight/bmi if available
    if d["weightKg"]:
        latest_weight = round(d["weightKg"], 1)
    if d["bmi"]:
        latest_bmi = round(d["bmi"], 1)
    if d["leanMassKg"]:
        latest_lean_mass = round(d["leanMassKg"], 1)

    avg_hr = round(sum(d["heartRates"]) / len(d["heartRates"]), 1) if d["heartRates"] else None
    avg_hrv = round(sum(d["hrv"]) / len(d["hrv"]), 1) if d["hrv"] else None

    # Only include days that have actual activity or vitals recorded
    if d["steps"] > 0 or d["activeKcal"] > 0 or d["weightKg"] is not None or d["restingHR"] is not None:
        daily_list.append({
            "date": day,
            "steps": d["steps"],
            "distanceKm": round(d["distanceKm"], 2),
            "activeKcal": round(d["activeKcal"], 1),
            "basalKcal": round(d["basalKcal"], 1),
            "exerciseMinutes": round(d["exerciseMinutes"], 1),
            "standMinutes": round(d["standMinutes"], 1),
            "flightsClimbed": d["flightsClimbed"],
            "avgHeartRate": avg_hr,
            "restingHR": round(d["restingHR"], 1) if d["restingHR"] else None,
            "walkingHR": round(d["walkingHR"], 1) if d["walkingHR"] else None,
            "hrv": avg_hrv,
            "vo2max": round(d["vo2max"], 1) if d["vo2max"] else None,
            "weightKg": round(d["weightKg"], 1) if d["weightKg"] else None,
            "bmi": round(d["bmi"], 1) if d["bmi"] else None,
            "leanMassKg": round(d["leanMassKg"], 1) if d["leanMassKg"] else None,
            "sleepHours": round(d["sleepHours"], 1)
        })

# 4. Finalize Profile
if latest_weight:
    profile["currentWeight"] = latest_weight
if latest_bmi:
    profile["currentBMI"] = latest_bmi
if latest_lean_mass:
    profile["currentLeanMass"] = latest_lean_mass

profile["totalWorkouts"] = len(workouts)
profile["totalSteps"] = sum(x["steps"] for x in daily_list)
profile["totalActiveCalories"] = round(sum(x["activeKcal"] for x in daily_list), 1)
profile["totalDistanceKm"] = round(sum(x["distanceKm"] for x in daily_list), 1)
profile["dateRange"] = {"start": min_date, "end": max_date}

# Calculate 30-day recent averages
recent_30 = daily_list[-30:] if len(daily_list) >= 30 else daily_list
if recent_30:
    profile["avgDailySteps30d"] = int(sum(x["steps"] for x in recent_30) / len(recent_30))
    profile["avgActiveKcal30d"] = int(sum(x["activeKcal"] for x in recent_30) / len(recent_30))
    profile["avgBasalKcal30d"] = int(sum(x["basalKcal"] for x in recent_30) / len(recent_30))
    recent_rhr = [x["restingHR"] for x in recent_30 if x["restingHR"]]
    profile["avgRestingHR30d"] = round(sum(recent_rhr)/len(recent_rhr), 1) if recent_rhr else 65.0
    recent_vo2 = [x["vo2max"] for x in recent_30 if x["vo2max"]]
    profile["recentVO2Max"] = round(recent_vo2[-1], 1) if recent_vo2 else 38.5

# Calculate workout distribution
workout_types = defaultdict(int)
for w in workouts:
    workout_types[w["type"]] += 1
profile["workoutTypeCounts"] = dict(workout_types)

# 5. Link routes to workouts if matching routePath
for w in workouts:
    if w["routePath"]:
        base_route = os.path.basename(w["routePath"])
        if base_route in routes:
            w["routeData"] = routes[base_route]

# 6. Save JSON datasets
with open(os.path.join(OUTPUT_DIR, "profile.json"), "w") as f:
    json.dump(profile, f, indent=2)

with open(os.path.join(OUTPUT_DIR, "daily_metrics.json"), "w") as f:
    json.dump(daily_list, f, indent=2)

with open(os.path.join(OUTPUT_DIR, "workouts.json"), "w") as f:
    json.dump(workouts, f, indent=2)

with open(os.path.join(OUTPUT_DIR, "routes.json"), "w") as f:
    json.dump(routes, f, indent=2)

print("\n--- Data Ingestion Successful! ---")
print(f"Profile: {profile['sex']}, {profile['dob']}, Weight: {profile['currentWeight']}kg, Workouts: {profile['totalWorkouts']}")
print(f"Daily records written: {len(daily_list)}")
print(f"Workouts written: {len(workouts)}")
print(f"Routes written: {len(routes)}")
print("All JSON files saved into public/data/")
