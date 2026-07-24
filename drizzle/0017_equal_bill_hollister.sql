ALTER TABLE `assets` ADD `memory_root_id` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `memory_version` integer;--> statement-breakpoint
ALTER TABLE `assets` ADD `previous_version_id` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `superseded_by_id` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `superseded_at` text;--> statement-breakpoint
CREATE INDEX `assets_memory_root_version_idx` ON `assets` (`memory_root_id`,`memory_version`);--> statement-breakpoint
CREATE INDEX `assets_superseded_at_idx` ON `assets` (`superseded_at`);