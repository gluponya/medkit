-- Migrations run in a transaction, where PRAGMA foreign_keys does nothing: dropping
-- packages would set intakes.package_id to null. Keep those links and put them back.
CREATE TABLE `__intake_packages` AS SELECT `id`, `package_id` FROM `intakes` WHERE `package_id` IS NOT NULL;--> statement-breakpoint
PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_packages` (
	`id` text PRIMARY KEY NOT NULL,
	`medicine_id` text NOT NULL,
	`expires` text,
	`quantity` integer,
	`opened_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`created_at` text DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')) NOT NULL,
	FOREIGN KEY (`medicine_id`) REFERENCES `medicines`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_packages`("id", "medicine_id", "expires", "quantity", "opened_at", "status", "created_at") SELECT "id", "medicine_id", "expires", "quantity", "opened_at", "status", "created_at" FROM `packages`;--> statement-breakpoint
DROP TABLE `packages`;--> statement-breakpoint
ALTER TABLE `__new_packages` RENAME TO `packages`;--> statement-breakpoint
UPDATE `intakes` SET `package_id` = (SELECT `k`.`package_id` FROM `__intake_packages` `k` WHERE `k`.`id` = `intakes`.`id`) WHERE `id` IN (SELECT `id` FROM `__intake_packages`);--> statement-breakpoint
DROP TABLE `__intake_packages`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `packages_medicine` ON `packages` (`medicine_id`);