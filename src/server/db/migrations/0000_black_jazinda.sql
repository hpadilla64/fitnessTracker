CREATE TABLE `catalog_exercises` (
	`id` integer PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`category` text,
	`muscles` text NOT NULL,
	`equipment` text NOT NULL,
	`license` text,
	`author` text
);
--> statement-breakpoint
CREATE TABLE `catalog_syncs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`synced_at` text NOT NULL,
	`exercise_count` integer NOT NULL,
	`source` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `daily_metrics` (
	`date` text PRIMARY KEY NOT NULL,
	`steps` integer NOT NULL,
	`distance_km` real NOT NULL,
	`active_kcal` real NOT NULL,
	`basal_kcal` real NOT NULL,
	`exercise_minutes` real NOT NULL,
	`stand_minutes` real NOT NULL,
	`flights_climbed` integer NOT NULL,
	`avg_heart_rate` real,
	`resting_hr` real,
	`walking_hr` real,
	`hrv` real,
	`vo2max` real,
	`weight_kg` real,
	`bmi` real,
	`lean_mass_kg` real,
	`sleep_hours` real NOT NULL
);
--> statement-breakpoint
CREATE TABLE `goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`target_weight_kg` real NOT NULL,
	`timeframe_weeks` integer NOT NULL,
	`start_weight_kg` real NOT NULL,
	`active` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ingest_runs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`source` text NOT NULL,
	`state` text NOT NULL,
	`progress` real,
	`counts` text,
	`started_at` text NOT NULL,
	`finished_at` text,
	`error` text
);
--> statement-breakpoint
CREATE TABLE `profile` (
	`id` integer PRIMARY KEY NOT NULL,
	`sex` text,
	`dob` text,
	`blood_type` text,
	`current_weight` real,
	`current_bmi` real,
	`current_lean_mass` real,
	`total_workouts` integer NOT NULL,
	`total_active_calories` real NOT NULL,
	`total_steps` integer NOT NULL,
	`total_distance_km` real NOT NULL,
	`date_start` text NOT NULL,
	`date_end` text NOT NULL,
	`avg_daily_steps_30d` real NOT NULL,
	`avg_active_kcal_30d` real NOT NULL,
	`avg_basal_kcal_30d` real NOT NULL,
	`avg_resting_hr_30d` real NOT NULL,
	`recent_vo2_max` real NOT NULL,
	`workout_type_counts` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `recommendations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`created_at` text NOT NULL,
	`goal_id` integer,
	`input_hash` text NOT NULL,
	`source` text NOT NULL,
	`model` text,
	`plan_json` text NOT NULL,
	`input_tokens` integer,
	`output_tokens` integer,
	`cache_read_tokens` integer,
	`cost_usd` real
);
--> statement-breakpoint
CREATE TABLE `routes` (
	`filename` text PRIMARY KEY NOT NULL,
	`point_count` integer NOT NULL,
	`distance_km` real NOT NULL,
	`start_lat` real NOT NULL,
	`start_lon` real NOT NULL,
	`start_ele` real NOT NULL,
	`end_lat` real NOT NULL,
	`end_lon` real NOT NULL,
	`end_ele` real NOT NULL,
	`points` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user_preferences` (
	`id` integer PRIMARY KEY NOT NULL,
	`time_range` text NOT NULL,
	`active_tab` text NOT NULL,
	`units` text NOT NULL,
	`training_focus` text,
	`workout_days_per_week` integer,
	`session_minutes` integer,
	`equipment` text NOT NULL,
	`limitations` text NOT NULL,
	`excluded_exercise_ids` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `workouts` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`start_date` text NOT NULL,
	`end_date` text NOT NULL,
	`duration_minutes` real NOT NULL,
	`distance_km` real NOT NULL,
	`energy_kcal` real NOT NULL,
	`route_path` text
);
