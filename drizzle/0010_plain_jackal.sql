ALTER TABLE `asset_chunks` ADD `content_hash` text;--> statement-breakpoint
ALTER TABLE `asset_chunks` ADD `embedding_model` text;--> statement-breakpoint
ALTER TABLE `asset_chunks` ADD `embedding_dim` integer;--> statement-breakpoint
CREATE INDEX `asset_chunks_asset_id_content_hash_idx` ON `asset_chunks` (`asset_id`,`content_hash`);