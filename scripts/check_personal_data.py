#!/usr/bin/env python3
"""
Block commits that contain personal health data.

Builds a list of distinctive personal values from the local, git-ignored
data store (data/pulsefit.db, falling back to the public/data/*.json import
files): date of birth, weights, lifetime totals, GPS start points
and scans files for them, so real values never get hardcoded into tracked
code or docs. Also rejects any staged path under input/ or public/data/.

Usage:
  python3 scripts/check_personal_data.py --staged   # pre-commit hook (staged files)
  python3 scripts/check_personal_data.py            # all tracked files
"""

import json
import os
import re
import sqlite3
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(ROOT, "public", "data")
DB_PATH = os.path.join(ROOT, "data", "pulsefit.db")
BLOCKED_PATHS = ("input/", "public/data/", "data/")
BLOCKED_SUFFIXES = (".db", ".db-wal", ".db-shm", ".sqlite")
SKIP_FILES = {"package-lock.json", "scripts/check_personal_data.py"}


def load(name):
    try:
        with open(os.path.join(DATA_DIR, name)) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def number_variants(value):
    """'11159' -> ['11159', '11,159']; floats keep one decimal."""
    if value is None:
        return []
    if isinstance(value, float) and not value.is_integer():
        text = f"{value:.1f}"
        whole, frac = text.split(".")
        return [text, f"{int(whole):,}.{frac}"]
    n = int(value)
    return [str(n), f"{n:,}"]


def load_from_db():
    """(profile dict in the JSON field names, list of route start points) or (None, None)."""
    if not os.path.exists(DB_PATH):
        return None, None
    try:
        con = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
        con.row_factory = sqlite3.Row
        row = con.execute("SELECT * FROM profile LIMIT 1").fetchone()
        starts = [{"lat": r["start_lat"], "lon": r["start_lon"]}
                  for r in con.execute("SELECT start_lat, start_lon FROM routes")]
        con.close()
    except sqlite3.Error:
        return None, None
    if not row:
        return None, None
    camel = lambda k: re.sub(r"_([a-z0-9])", lambda m: m.group(1).upper(), k)
    profile = {camel(k): row[k] for k in row.keys()}
    profile["currentBMI"] = profile.pop("currentBmi", None)
    profile["avgRestingHR30d"] = profile.pop("avgRestingHr30d", None)
    profile["recentVO2Max"] = profile.pop("recentVo2Max", None)
    try:
        profile["workoutTypeCounts"] = json.loads(profile.get("workoutTypeCounts") or "{}")
    except ValueError:
        profile["workoutTypeCounts"] = {}
    return profile, starts


def build_patterns():
    profile, starts = load_from_db()
    if not profile:
        profile = load("profile.json")
        routes_json = load("routes.json") or {}
        starts = [r.get("startPoint") or {} for r in routes_json.values()]
    if not profile:
        return []

    literals = set()
    if profile.get("dob"):
        literals.add(profile["dob"])
    if profile.get("bloodType"):
        literals.add(profile["bloodType"])

    # Distinctive numbers: decimals and large integers rarely collide with code
    for key in ("currentWeight", "currentBMI", "currentLeanMass", "recentVO2Max",
                "totalActiveCalories", "totalSteps", "totalDistanceKm", "totalWorkouts",
                "avgDailySteps30d", "avgBasalKcal30d"):
        v = profile.get(key)
        if isinstance(v, (int, float)) and (not float(v).is_integer() or v >= 100):
            literals.update(number_variants(v))
    # Energy figures are often quoted rounded (BMR, TDEE): also match the nearest 10
    basal, active = profile.get("avgBasalKcal30d"), profile.get("avgActiveKcal30d")
    for kcal in (basal, (basal or 0) + (active or 0) if basal and active else None):
        if kcal:
            literals.update(number_variants(kcal) + number_variants(round(kcal, -1)))
    for count in (profile.get("workoutTypeCounts") or {}).values():
        if count >= 100:
            literals.update(number_variants(count))
    if starts and len(starts) >= 100:
        literals.update(number_variants(len(starts)))

    # Not part of a longer number: no adjacent word chars, decimals or thousands groups
    patterns = [(lit, re.compile(r"(?<![\w.])(?<!\d,)" + re.escape(lit) + r"(?!\w|\.\d|,\d)")) for lit in literals]

    dob = profile.get("dob") or ""
    if re.match(r"\d{4}-\d{2}-\d{2}$", dob):
        from datetime import date
        y, m, d = map(int, dob.split("-"))
        today = date.today()
        age = today.year - y - ((today.month, today.day) < (m, d))
        patterns.append((f"age {age}", re.compile(rf"\bage\s*[~:]?\s*(?:{age}|{age - 1}|{age + 1})\b", re.I)))

    # GPS start points to ~100 m: any coordinate beginning with these digits
    coords = set()
    for sp in starts or []:
        for axis in ("lat", "lon"):
            if isinstance(sp.get(axis), (int, float)):
                coords.add(f"{sp[axis]:.3f}")
    for c in coords:
        patterns.append((f"GPS {c}", re.compile(r"(?<![\w.])" + re.escape(c) + r"\d*")))
    return patterns


def git(*args):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True, text=True, check=True).stdout


def main():
    staged = "--staged" in sys.argv
    files = git("diff", "--cached", "--name-only", "--diff-filter=ACMR") if staged else git("ls-files")
    files = [f for f in files.splitlines() if f]

    problems = [f"{f}: personal data path must never be committed" for f in files
                if f.startswith(BLOCKED_PATHS) or f.endswith(BLOCKED_SUFFIXES)]

    patterns = build_patterns()
    if not patterns:
        print("check_personal_data: public/data/profile.json not found; value scan skipped", file=sys.stderr)

    for f in files:
        if f in SKIP_FILES or f.startswith(BLOCKED_PATHS) or f.endswith(BLOCKED_SUFFIXES):
            continue
        try:
            text = git("show", f":{f}") if staged else open(os.path.join(ROOT, f), encoding="utf-8").read()
        except (subprocess.CalledProcessError, UnicodeDecodeError, OSError):
            continue
        for lineno, line in enumerate(text.splitlines(), 1):
            for label, rx in patterns:
                if rx.search(line):
                    problems.append(f"{f}:{lineno}: contains personal value ({label})")

    if problems:
        print("Personal health data found. Derive these values from the imported data instead:", file=sys.stderr)
        for p in problems:
            print(f"  {p}", file=sys.stderr)
        sys.exit(1)
    print(f"check_personal_data: OK ({len(files)} files, {len(patterns)} patterns)")


if __name__ == "__main__":
    main()
