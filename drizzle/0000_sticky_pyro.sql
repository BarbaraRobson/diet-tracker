CREATE TABLE `ai_analyses` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`model` text NOT NULL,
	`input_kind` text NOT NULL,
	`status` text NOT NULL,
	`confidence` text,
	`input_tokens` integer,
	`output_tokens` integer,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_ai_user_created` ON `ai_analyses` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `categories` (
	`user_id` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`target` real NOT NULL,
	`guide` text DEFAULT '' NOT NULL,
	`sort_order` integer NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`user_id`, `id`)
);
--> statement-breakpoint
CREATE TABLE `meal_templates` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`energy_kj` real,
	`protein_g` real,
	`carbohydrate_g` real,
	`sugars_g` real,
	`fat_g` real,
	`saturated_fat_g` real,
	`fibre_g` real,
	`sodium_mg` real,
	`confidence` text,
	`assumptions` text DEFAULT '[]' NOT NULL,
	`components` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_used_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_templates_user_used` ON `meal_templates` (`user_id`,`last_used_at`);--> statement-breakpoint
CREATE TABLE `meal_units` (
	`meal_id` text NOT NULL,
	`category_id` text NOT NULL,
	`units` real NOT NULL,
	PRIMARY KEY(`meal_id`, `category_id`)
);
--> statement-breakpoint
CREATE TABLE `meals` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`meal_date` text NOT NULL,
	`meal_time` text NOT NULL,
	`name` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`source` text NOT NULL,
	`template_id` text,
	`energy_kj` real,
	`protein_g` real,
	`carbohydrate_g` real,
	`sugars_g` real,
	`fat_g` real,
	`saturated_fat_g` real,
	`fibre_g` real,
	`sodium_mg` real,
	`confidence` text,
	`assumptions` text DEFAULT '[]' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_meals_user_date` ON `meals` (`user_id`,`meal_date`);--> statement-breakpoint
CREATE TABLE `template_units` (
	`template_id` text NOT NULL,
	`category_id` text NOT NULL,
	`units` real NOT NULL,
	PRIMARY KEY(`template_id`, `category_id`)
);

-- metadata: GPT-5.6 Sol; time: 2026-09-11 14:19 Australia/Sydney; date: 2026-09-11; prompt: Generate the initial private Diet Tracker D1 database migration.
