CREATE TABLE `asset_artifacts` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`artifact_type` text NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`storage_kind` text NOT NULL,
	`r2_key` text,
	`content_text` text,
	`metadata_json` text,
	`created_by_run_id` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by_run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `asset_artifacts_asset_id_idx` ON `asset_artifacts` (`asset_id`);--> statement-breakpoint
CREATE INDEX `asset_artifacts_type_idx` ON `asset_artifacts` (`artifact_type`);--> statement-breakpoint
CREATE INDEX `asset_artifacts_run_id_idx` ON `asset_artifacts` (`created_by_run_id`);--> statement-breakpoint
CREATE TABLE `workflow_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`asset_id` text NOT NULL,
	`workflow_type` text NOT NULL,
	`trigger_type` text NOT NULL,
	`status` text NOT NULL,
	`current_step` text,
	`error_message` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workflow_runs_asset_id_idx` ON `workflow_runs` (`asset_id`);--> statement-breakpoint
CREATE INDEX `workflow_runs_status_idx` ON `workflow_runs` (`status`);--> statement-breakpoint
CREATE INDEX `workflow_runs_type_idx` ON `workflow_runs` (`workflow_type`);--> statement-breakpoint
CREATE INDEX `workflow_runs_created_at_idx` ON `workflow_runs` (`created_at`);--> statement-breakpoint
CREATE TABLE `workflow_steps` (
	`id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	`asset_id` text NOT NULL,
	`step_key` text NOT NULL,
	`step_type` text NOT NULL,
	`status` text NOT NULL,
	`attempt` integer DEFAULT 0 NOT NULL,
	`input_json` text,
	`output_json` text,
	`error_message` text,
	`started_at` text,
	`finished_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`run_id`) REFERENCES `workflow_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`asset_id`) REFERENCES `assets`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `workflow_steps_run_id_idx` ON `workflow_steps` (`run_id`);--> statement-breakpoint
CREATE INDEX `workflow_steps_asset_id_idx` ON `workflow_steps` (`asset_id`);--> statement-breakpoint
CREATE INDEX `workflow_steps_status_idx` ON `workflow_steps` (`status`);--> statement-breakpoint
CREATE INDEX `workflow_steps_type_idx` ON `workflow_steps` (`step_type`);