CREATE TABLE `mcp_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_value` text NOT NULL,
	`token_hash` text NOT NULL,
	`last_used_at` text,
	`revoked_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `mcp_tokens_token_hash_uidx` ON `mcp_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_created_at_idx` ON `mcp_tokens` (`created_at`);--> statement-breakpoint
CREATE INDEX `mcp_tokens_revoked_at_idx` ON `mcp_tokens` (`revoked_at`);