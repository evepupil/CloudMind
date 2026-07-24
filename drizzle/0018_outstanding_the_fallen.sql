CREATE TABLE `deletion_audits` (
	`id` text PRIMARY KEY NOT NULL,
	`target_hash` text NOT NULL,
	`target_kind` text NOT NULL,
	`status` text NOT NULL,
	`asset_count` integer NOT NULL,
	`blob_count` integer NOT NULL,
	`asset_vector_count` integer NOT NULL,
	`graph_vector_count` integer NOT NULL,
	`l2_record_count` integer NOT NULL,
	`error_code` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`completed_at` text
);
--> statement-breakpoint
CREATE INDEX `deletion_audits_status_idx` ON `deletion_audits` (`status`);--> statement-breakpoint
CREATE INDEX `deletion_audits_target_hash_idx` ON `deletion_audits` (`target_hash`);--> statement-breakpoint
CREATE INDEX `deletion_audits_created_at_idx` ON `deletion_audits` (`created_at`);--> statement-breakpoint
ALTER TABLE `assets` ADD `purge_pending_at` text;--> statement-breakpoint
CREATE INDEX `assets_purge_pending_at_idx` ON `assets` (`purge_pending_at`);