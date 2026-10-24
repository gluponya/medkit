CREATE TABLE `intakes` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`reminder_id` text,
	`package_id` text,
	`dose` integer NOT NULL,
	`status` text NOT NULL,
	`due` text,
	`at` text NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`reminder_id`) REFERENCES `reminders`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `intakes_medicine` ON `intakes` (`medicine_id`);--> statement-breakpoint
CREATE TABLE `reminders` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`schedule` text NOT NULL,
	`times` text NOT NULL,
	`days_of_week` text,
	`start` text NOT NULL,
	`days` integer,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `reminders_medicine` ON `reminders` (`medicine_id`);