CREATE TABLE `communities` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text DEFAULT 'default' NOT NULL,
	`member_entity_ids_json` text NOT NULL,
	`summary` text,
	`summary_vector_id` text,
	`refreshed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `communities_scope_id_idx` ON `communities` (`scope_id`);--> statement-breakpoint
CREATE INDEX `communities_summary_vector_id_idx` ON `communities` (`summary_vector_id`);--> statement-breakpoint
CREATE TABLE `edges` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text DEFAULT 'default' NOT NULL,
	`src_entity_id` text NOT NULL,
	`dst_entity_id` text NOT NULL,
	`relation` text NOT NULL,
	`weight` real DEFAULT 1 NOT NULL,
	`confidence` real,
	`valid_from` text,
	`valid_until` text,
	`created_at` text NOT NULL,
	`expired_at` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`src_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`dst_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `edges_scope_id_idx` ON `edges` (`scope_id`);--> statement-breakpoint
CREATE INDEX `edges_src_entity_id_idx` ON `edges` (`src_entity_id`);--> statement-breakpoint
CREATE INDEX `edges_dst_entity_id_idx` ON `edges` (`dst_entity_id`);--> statement-breakpoint
CREATE INDEX `edges_relation_idx` ON `edges` (`relation`);--> statement-breakpoint
CREATE INDEX `edges_expired_at_idx` ON `edges` (`expired_at`);--> statement-breakpoint
CREATE INDEX `edges_scope_src_expired_idx` ON `edges` (`scope_id`,`src_entity_id`,`expired_at`);--> statement-breakpoint
CREATE TABLE `entities` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text DEFAULT 'default' NOT NULL,
	`canonical_name` text NOT NULL,
	`normalized_name` text NOT NULL,
	`type` text,
	`embedding_vector_id` text,
	`salience` real DEFAULT 0 NOT NULL,
	`mention_count` integer DEFAULT 0 NOT NULL,
	`aliases_json` text,
	`first_seen_at` text,
	`last_seen_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `entities_scope_id_idx` ON `entities` (`scope_id`);--> statement-breakpoint
CREATE INDEX `entities_normalized_name_idx` ON `entities` (`normalized_name`);--> statement-breakpoint
CREATE INDEX `entities_type_idx` ON `entities` (`type`);--> statement-breakpoint
CREATE INDEX `entities_embedding_vector_id_idx` ON `entities` (`embedding_vector_id`);--> statement-breakpoint
CREATE INDEX `entities_scope_normalized_idx` ON `entities` (`scope_id`,`normalized_name`);--> statement-breakpoint
CREATE INDEX `entities_salience_idx` ON `entities` (`salience`);--> statement-breakpoint
CREATE TABLE `episodes` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text DEFAULT 'default' NOT NULL,
	`kind` text NOT NULL,
	`asset_id` text,
	`raw_text` text,
	`raw_r2_key` text,
	`actor` text,
	`occurred_at` text,
	`recorded_at` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `episodes_scope_id_idx` ON `episodes` (`scope_id`);--> statement-breakpoint
CREATE INDEX `episodes_kind_idx` ON `episodes` (`kind`);--> statement-breakpoint
CREATE INDEX `episodes_asset_id_idx` ON `episodes` (`asset_id`);--> statement-breakpoint
CREATE INDEX `episodes_occurred_at_idx` ON `episodes` (`occurred_at`);--> statement-breakpoint
CREATE INDEX `episodes_scope_kind_occurred_idx` ON `episodes` (`scope_id`,`kind`,`occurred_at`);--> statement-breakpoint
CREATE TABLE `provenance` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text DEFAULT 'default' NOT NULL,
	`memory_type` text NOT NULL,
	`memory_id` text NOT NULL,
	`episode_id` text,
	`asset_id` text,
	`chunk_index` integer,
	`span` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`episode_id`) REFERENCES `episodes`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `provenance_scope_id_idx` ON `provenance` (`scope_id`);--> statement-breakpoint
CREATE INDEX `provenance_memory_idx` ON `provenance` (`memory_type`,`memory_id`);--> statement-breakpoint
CREATE INDEX `provenance_episode_id_idx` ON `provenance` (`episode_id`);--> statement-breakpoint
CREATE INDEX `provenance_asset_id_idx` ON `provenance` (`asset_id`);--> statement-breakpoint
CREATE TABLE `statements` (
	`id` text PRIMARY KEY NOT NULL,
	`scope_id` text DEFAULT 'default' NOT NULL,
	`subject_entity_id` text NOT NULL,
	`predicate` text NOT NULL,
	`object_entity_id` text,
	`object_literal` text,
	`nl_text` text NOT NULL,
	`embedding_vector_id` text,
	`confidence` real,
	`importance` real DEFAULT 0 NOT NULL,
	`valid_from` text,
	`valid_until` text,
	`created_at` text NOT NULL,
	`expired_at` text,
	`superseded_by_id` text,
	`last_accessed_at` text,
	`access_count` integer DEFAULT 0 NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`subject_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`object_entity_id`) REFERENCES `entities`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `statements_scope_id_idx` ON `statements` (`scope_id`);--> statement-breakpoint
CREATE INDEX `statements_subject_entity_id_idx` ON `statements` (`subject_entity_id`);--> statement-breakpoint
CREATE INDEX `statements_object_entity_id_idx` ON `statements` (`object_entity_id`);--> statement-breakpoint
CREATE INDEX `statements_predicate_idx` ON `statements` (`predicate`);--> statement-breakpoint
CREATE INDEX `statements_embedding_vector_id_idx` ON `statements` (`embedding_vector_id`);--> statement-breakpoint
CREATE INDEX `statements_expired_at_idx` ON `statements` (`expired_at`);--> statement-breakpoint
CREATE INDEX `statements_scope_subject_expired_idx` ON `statements` (`scope_id`,`subject_entity_id`,`expired_at`);