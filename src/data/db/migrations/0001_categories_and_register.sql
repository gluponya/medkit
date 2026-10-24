CREATE TABLE `custom_categories` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`icon` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicine_categories` (
	`medicine_id` text NOT NULL,
	`category` text NOT NULL,
	PRIMARY KEY(`medicine_id`, `category`),
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `medicine_categories_category` ON `medicine_categories` (`category`);--> statement-breakpoint
ALTER TABLE `medicines` ADD `register_id` text;