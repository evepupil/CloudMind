DROP TABLE `asset_assertions`;--> statement-breakpoint
DROP TABLE `asset_facets`;--> statement-breakpoint
DROP INDEX `assets_sensitivity_idx`;--> statement-breakpoint
DROP INDEX `assets_document_class_idx`;--> statement-breakpoint
ALTER TABLE `assets` DROP COLUMN `sensitivity`;--> statement-breakpoint
ALTER TABLE `assets` DROP COLUMN `document_class`;--> statement-breakpoint
ALTER TABLE `assets` DROP COLUMN `descriptor_json`;