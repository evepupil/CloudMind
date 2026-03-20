ALTER TABLE `assets` ADD `deleted_at` text;--> statement-breakpoint
CREATE INDEX `assets_deleted_at_idx` ON `assets` (`deleted_at`);