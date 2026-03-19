CREATE TABLE `asset_chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`text_preview` text NOT NULL,
	`vector_id` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `asset_chunks_asset_id_idx` ON `asset_chunks` (`asset_id`);--> statement-breakpoint
CREATE INDEX `asset_chunks_asset_id_chunk_index_idx` ON `asset_chunks` (`asset_id`,`chunk_index`);--> statement-breakpoint
CREATE INDEX `asset_chunks_vector_id_idx` ON `asset_chunks` (`vector_id`);