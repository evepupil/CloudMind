CREATE TABLE `asset_assertions` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`assertion_index` integer NOT NULL,
	`kind` text NOT NULL,
	`text` text NOT NULL,
	`source_chunk_index` integer,
	`source_span_json` text,
	`confidence` real,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_assertions_asset_id_idx` ON `asset_assertions` (`asset_id`);--> statement-breakpoint
CREATE INDEX `asset_assertions_asset_id_index_idx` ON `asset_assertions` (`asset_id`,`assertion_index`);--> statement-breakpoint
CREATE INDEX `asset_assertions_kind_idx` ON `asset_assertions` (`kind`);--> statement-breakpoint
CREATE TABLE `asset_facets` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`facet_key` text NOT NULL,
	`facet_value` text NOT NULL,
	`facet_label` text NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_facets_asset_id_idx` ON `asset_facets` (`asset_id`);--> statement-breakpoint
CREATE INDEX `asset_facets_key_value_idx` ON `asset_facets` (`facet_key`,`facet_value`);--> statement-breakpoint
CREATE INDEX `asset_facets_key_value_asset_id_idx` ON `asset_facets` (`facet_key`,`facet_value`,`asset_id`);--> statement-breakpoint
ALTER TABLE `assets` ADD `document_class` text DEFAULT 'reference_doc';--> statement-breakpoint
ALTER TABLE `assets` ADD `source_host` text;--> statement-breakpoint
CREATE INDEX `assets_document_class_idx` ON `assets` (`document_class`);--> statement-breakpoint
CREATE INDEX `assets_source_host_idx` ON `assets` (`source_host`);