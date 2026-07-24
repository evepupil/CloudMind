PRAGMA defer_foreign_keys = true;--> statement-breakpoint
CREATE TABLE `__new_provenance` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text DEFAULT 'default' NOT NULL,
	`context_key` text DEFAULT 'global' NOT NULL,
	`record_kind` text DEFAULT 'library' NOT NULL,
	`memory_type` text NOT NULL,
	`memory_id` text NOT NULL,
	`asset_id` text,
	`chunk_index` integer,
	`span` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_provenance`("id", "scope_id", "context_key", "record_kind", "memory_type", "memory_id", "asset_id", "chunk_index", "span", "created_at") SELECT "id", "scope_id", "context_key", "record_kind", "memory_type", "memory_id", "asset_id", "chunk_index", "span", "created_at" FROM `provenance`;--> statement-breakpoint
DROP TABLE `provenance`;--> statement-breakpoint
ALTER TABLE `__new_provenance` RENAME TO `provenance`;--> statement-breakpoint
DROP TABLE `episodes`;--> statement-breakpoint
CREATE INDEX `provenance_scope_id_idx` ON `provenance` (`scope_id`);--> statement-breakpoint
CREATE INDEX `provenance_context_key_idx` ON `provenance` (`context_key`);--> statement-breakpoint
CREATE INDEX `provenance_record_kind_idx` ON `provenance` (`record_kind`);--> statement-breakpoint
CREATE INDEX `provenance_memory_idx` ON `provenance` (`memory_type`,`memory_id`);--> statement-breakpoint
CREATE INDEX `provenance_asset_id_idx` ON `provenance` (`asset_id`);
