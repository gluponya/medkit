CREATE TABLE `cabinets` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`place` text NOT NULL,
	`icon` text NOT NULL,
	`mode` text NOT NULL,
	`expiry_warning_days` integer DEFAULT 30 NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `medicines` (
	`id` text PRIMARY KEY NOT NULL,
	`cabinet_id` text NOT NULL,
	`name` text NOT NULL,
	`inn` text,
	`form` text,
	`strength` text,
	`manufacturer` text,
	`rx` integer DEFAULT false NOT NULL,
	`low_stock_threshold` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`cabinet_id`) REFERENCES `cabinets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `medicines_cabinet` ON `medicines` (`cabinet_id`);--> statement-breakpoint
CREATE TABLE `packages` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`expires` text NOT NULL,
	`quantity` integer,
	`opened_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `packages_medicine` ON `packages` (`medicine_id`);