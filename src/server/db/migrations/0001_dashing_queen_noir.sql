PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_catalog_syncs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`state` text DEFAULT 'running' NOT NULL,
	`synced_at` text NOT NULL,
	`finished_at` text,
	`progress` real,
	`error` text,
	`exercise_count` integer,
	`source` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_catalog_syncs`("id", "state", "synced_at", "finished_at", "exercise_count", "source") SELECT "id", 'succeeded', "synced_at", "synced_at", "exercise_count", "source" FROM `catalog_syncs`;--> statement-breakpoint
DROP TABLE `catalog_syncs`;--> statement-breakpoint
ALTER TABLE `__new_catalog_syncs` RENAME TO `catalog_syncs`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `catalog_exercises` ADD `description` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_exercises` ADD `muscles_secondary` text DEFAULT '[]' NOT NULL;--> statement-breakpoint
ALTER TABLE `catalog_exercises` ADD `license_url` text;