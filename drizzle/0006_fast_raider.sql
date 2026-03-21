ALTER TABLE `assets` ADD `source_kind` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `domain` text DEFAULT 'general' NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `sensitivity` text DEFAULT 'internal' NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `ai_visibility` text DEFAULT 'allow' NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `retrieval_priority` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `collection_key` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `captured_at` text;--> statement-breakpoint
ALTER TABLE `assets` ADD `descriptor_json` text;--> statement-breakpoint
CREATE INDEX `assets_source_kind_idx` ON `assets` (`source_kind`);--> statement-breakpoint
CREATE INDEX `assets_domain_idx` ON `assets` (`domain`);--> statement-breakpoint
CREATE INDEX `assets_sensitivity_idx` ON `assets` (`sensitivity`);--> statement-breakpoint
CREATE INDEX `assets_collection_key_idx` ON `assets` (`collection_key`);--> statement-breakpoint
CREATE INDEX `assets_captured_at_idx` ON `assets` (`captured_at`);--> statement-breakpoint
CREATE INDEX `assets_domain_status_deleted_at_idx` ON `assets` (`domain`,`status`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `assets_collection_captured_deleted_at_idx` ON `assets` (`collection_key`,`captured_at`,`deleted_at`);