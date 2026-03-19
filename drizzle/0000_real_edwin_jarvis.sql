CREATE TABLE `asset_sources` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`kind` text NOT NULL,
	`source_url` text,
	`metadata_json` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_sources_asset_id_idx` ON `asset_sources` (`asset_id`);--> statement-breakpoint
CREATE INDEX `asset_sources_kind_idx` ON `asset_sources` (`kind`);--> statement-breakpoint
CREATE TABLE `assets` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`source_url` text,
	`status` text NOT NULL,
	`content_text` text,
	`raw_r2_key` text,
	`content_r2_key` text,
	`mime_type` text,
	`language` text,
	`error_message` text,
	`processed_at` text,
	`failed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `assets_status_idx` ON `assets` (`status`);--> statement-breakpoint
CREATE INDEX `assets_type_idx` ON `assets` (`type`);--> statement-breakpoint
CREATE INDEX `assets_created_at_idx` ON `assets` (`created_at`);--> statement-breakpoint
CREATE INDEX `assets_source_url_idx` ON `assets` (`source_url`);--> statement-breakpoint
CREATE TABLE `ingest_jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`job_type` text NOT NULL,
	`status` text NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`error_message` text,
	`payload_json` text,
	`finished_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ingest_jobs_asset_id_idx` ON `ingest_jobs` (`asset_id`);--> statement-breakpoint
CREATE INDEX `ingest_jobs_status_idx` ON `ingest_jobs` (`status`);--> statement-breakpoint
CREATE INDEX `ingest_jobs_type_idx` ON `ingest_jobs` (`job_type`);--> statement-breakpoint
CREATE INDEX `ingest_jobs_created_at_idx` ON `ingest_jobs` (`created_at`);