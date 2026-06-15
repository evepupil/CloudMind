ALTER TABLE `assets` ADD `scope_id` text DEFAULT 'personal' NOT NULL;--> statement-breakpoint
CREATE INDEX `assets_scope_id_idx` ON `assets` (`scope_id`);--> statement-breakpoint
UPDATE `statements` SET `scope_id` = 'personal' WHERE `scope_id` = 'default';--> statement-breakpoint
UPDATE `entities` SET `scope_id` = 'personal' WHERE `scope_id` = 'default';--> statement-breakpoint
UPDATE `edges` SET `scope_id` = 'personal' WHERE `scope_id` = 'default';--> statement-breakpoint
UPDATE `communities` SET `scope_id` = 'personal' WHERE `scope_id` = 'default';--> statement-breakpoint
UPDATE `provenance` SET `scope_id` = 'personal' WHERE `scope_id` = 'default';--> statement-breakpoint
UPDATE `episodes` SET `scope_id` = 'personal' WHERE `scope_id` = 'default';