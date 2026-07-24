DROP INDEX `edges_scope_src_expired_idx`;--> statement-breakpoint
ALTER TABLE `edges` ADD `context_key` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `edges` ADD `record_kind` text DEFAULT 'library' NOT NULL;--> statement-breakpoint
CREATE INDEX `edges_context_key_idx` ON `edges` (`context_key`);--> statement-breakpoint
CREATE INDEX `edges_record_kind_idx` ON `edges` (`record_kind`);--> statement-breakpoint
CREATE INDEX `edges_scope_src_expired_idx` ON `edges` (`scope_id`,`context_key`,`record_kind`,`src_entity_id`,`expired_at`);--> statement-breakpoint
DROP INDEX `entities_scope_normalized_idx`;--> statement-breakpoint
ALTER TABLE `entities` ADD `context_key` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
CREATE INDEX `entities_context_key_idx` ON `entities` (`context_key`);--> statement-breakpoint
CREATE INDEX `entities_scope_normalized_idx` ON `entities` (`scope_id`,`context_key`,`normalized_name`);--> statement-breakpoint
DROP INDEX `statements_scope_subject_expired_idx`;--> statement-breakpoint
ALTER TABLE `statements` ADD `context_key` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `statements` ADD `record_kind` text DEFAULT 'library' NOT NULL;--> statement-breakpoint
CREATE INDEX `statements_context_key_idx` ON `statements` (`context_key`);--> statement-breakpoint
CREATE INDEX `statements_record_kind_idx` ON `statements` (`record_kind`);--> statement-breakpoint
CREATE INDEX `statements_scope_subject_expired_idx` ON `statements` (`scope_id`,`context_key`,`record_kind`,`subject_entity_id`,`expired_at`);--> statement-breakpoint
ALTER TABLE `asset_chunks` ADD `record_kind` text DEFAULT 'library' NOT NULL;--> statement-breakpoint
ALTER TABLE `asset_chunks` ADD `scope_id` text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
ALTER TABLE `asset_chunks` ADD `context_key` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
CREATE INDEX `asset_chunks_record_scope_context_idx` ON `asset_chunks` (`record_kind`,`scope_id`,`context_key`);--> statement-breakpoint
ALTER TABLE `assets` ADD `record_kind` text DEFAULT 'library' NOT NULL;--> statement-breakpoint
ALTER TABLE `assets` ADD `context_key` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
CREATE INDEX `assets_record_kind_idx` ON `assets` (`record_kind`);--> statement-breakpoint
CREATE INDEX `assets_context_key_idx` ON `assets` (`context_key`);--> statement-breakpoint
CREATE INDEX `assets_record_scope_context_idx` ON `assets` (`record_kind`,`scope_id`,`context_key`);--> statement-breakpoint
ALTER TABLE `communities` ADD `context_key` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `communities` ADD `record_kind` text DEFAULT 'library' NOT NULL;--> statement-breakpoint
CREATE INDEX `communities_record_scope_context_idx` ON `communities` (`record_kind`,`scope_id`,`context_key`);--> statement-breakpoint
ALTER TABLE `provenance` ADD `context_key` text DEFAULT 'global' NOT NULL;--> statement-breakpoint
ALTER TABLE `provenance` ADD `record_kind` text DEFAULT 'library' NOT NULL;--> statement-breakpoint
CREATE INDEX `provenance_context_key_idx` ON `provenance` (`context_key`);--> statement-breakpoint
CREATE INDEX `provenance_record_kind_idx` ON `provenance` (`record_kind`);--> statement-breakpoint
UPDATE `assets` SET `record_kind` = 'memory' WHERE `scope_id` = 'agent';--> statement-breakpoint
UPDATE `asset_chunks` SET
  `record_kind` = COALESCE((SELECT `record_kind` FROM `assets` WHERE `assets`.`id` = `asset_chunks`.`asset_id`), 'library'),
  `scope_id` = COALESCE((SELECT `scope_id` FROM `assets` WHERE `assets`.`id` = `asset_chunks`.`asset_id`), 'personal'),
  `context_key` = COALESCE((SELECT `context_key` FROM `assets` WHERE `assets`.`id` = `asset_chunks`.`asset_id`), 'global');--> statement-breakpoint
UPDATE `provenance` SET
  `record_kind` = COALESCE((SELECT `record_kind` FROM `assets` WHERE `assets`.`id` = `provenance`.`asset_id`), 'library'),
  `scope_id` = COALESCE((SELECT `scope_id` FROM `assets` WHERE `assets`.`id` = `provenance`.`asset_id`), `scope_id`),
  `context_key` = COALESCE((SELECT `context_key` FROM `assets` WHERE `assets`.`id` = `provenance`.`asset_id`), 'global');--> statement-breakpoint
UPDATE `statements` SET
  `record_kind` = COALESCE((SELECT `record_kind` FROM `provenance` WHERE `provenance`.`memory_type` = 'statement' AND `provenance`.`memory_id` = `statements`.`id` LIMIT 1), 'library'),
  `context_key` = COALESCE((SELECT `context_key` FROM `provenance` WHERE `provenance`.`memory_type` = 'statement' AND `provenance`.`memory_id` = `statements`.`id` LIMIT 1), 'global');--> statement-breakpoint
UPDATE `edges` SET
  `record_kind` = COALESCE((SELECT `record_kind` FROM `provenance` WHERE `provenance`.`memory_type` = 'edge' AND `provenance`.`memory_id` = `edges`.`id` LIMIT 1), 'library'),
  `context_key` = COALESCE((SELECT `context_key` FROM `provenance` WHERE `provenance`.`memory_type` = 'edge' AND `provenance`.`memory_id` = `edges`.`id` LIMIT 1), 'global');
