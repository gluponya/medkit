CREATE TABLE `members` (
	`cabinet_id` text NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` text NOT NULL,
	PRIMARY KEY(`cabinet_id`, `user_id`),
	FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `outbox` (
	`seq` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`id` text NOT NULL,
	`entity` text NOT NULL,
	`entity_id` text NOT NULL,
	`cabinet_id` text,
	`op` text NOT NULL,
	`payload` text NOT NULL,
	`edited_at` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text
);
--> statement-breakpoint
CREATE TABLE `sync_meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `cabinets` ADD `synced` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `cabinets` ADD `role` text;