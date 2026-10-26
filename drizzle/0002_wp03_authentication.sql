CREATE TABLE `auth_account_control` (
	`scope` char(7) NOT NULL,
	CONSTRAINT `auth_account_control_scope` PRIMARY KEY(`scope`),
	CONSTRAINT `auth_account_control_scope_ck` CHECK(`auth_account_control`.`scope` = 'company')
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `auth_login_limits` (
	`bucket_key` char(64) NOT NULL,
	`attempt_count` int unsigned NOT NULL,
	`window_ends_at` datetime(3) NOT NULL,
	CONSTRAINT `auth_login_limits_bucket_key` PRIMARY KEY(`bucket_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `auth_sessions` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`user_auth_version` int unsigned NOT NULL,
	`expires_at` datetime(3) NOT NULL,
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `auth_sessions_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_sessions_token_uq` UNIQUE(`token_hash`),
	CONSTRAINT `auth_sessions_version_ck` CHECK(`auth_sessions`.`user_auth_version` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
ALTER TABLE `users` ADD `auth_version` int unsigned DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `auth_login_limits_expiry_idx` ON `auth_login_limits` (`window_ends_at`);--> statement-breakpoint
CREATE INDEX `auth_sessions_user_state_idx` ON `auth_sessions` (`user_id`,`revoked_at`,`expires_at`);--> statement-breakpoint
CREATE INDEX `auth_sessions_expiry_idx` ON `auth_sessions` (`expires_at`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_auth_version_ck` CHECK (`users`.`auth_version` >= 1);
--> statement-breakpoint
INSERT INTO `auth_account_control` (`scope`) VALUES ('company');
