CREATE TABLE `auth_mfa_challenges` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`token_hash` char(64) NOT NULL,
	`user_auth_version` int unsigned NOT NULL,
	`source_session_hash` char(64),
	`purpose` enum('login','replace','codes') NOT NULL,
	`state` enum('enroll','verify','ack','consumed') NOT NULL,
	`secret_cipher` varchar(2048),
	`key_id` varchar(64),
	`recovery_hashes` json,
	`last_step` bigint unsigned,
	`attempts` int unsigned NOT NULL DEFAULT 0,
	`expires_at` datetime(3) NOT NULL,
	`consumed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `auth_mfa_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `mfa_challenge_token_uq` UNIQUE(`token_hash`),
	CONSTRAINT `mfa_challenge_attempts_ck` CHECK(`auth_mfa_challenges`.`attempts` <= 5),
	CONSTRAINT `mfa_challenge_version_ck` CHECK(`auth_mfa_challenges`.`user_auth_version` >= 1),
	CONSTRAINT `mfa_challenge_secret_pair_ck` CHECK((`auth_mfa_challenges`.`secret_cipher` IS NULL) = (`auth_mfa_challenges`.`key_id` IS NULL)),
	CONSTRAINT `mfa_challenge_consumed_ck` CHECK((`auth_mfa_challenges`.`state` = 'consumed') = (`auth_mfa_challenges`.`consumed_at` IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE `auth_mfa_factors` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`secret_cipher` varchar(2048) NOT NULL,
	`key_id` varchar(64) NOT NULL,
	`last_step` bigint unsigned NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `auth_mfa_factors_id` PRIMARY KEY(`id`),
	CONSTRAINT `mfa_factor_user_uq` UNIQUE(`user_id`),
	CONSTRAINT `mfa_factor_step_ck` CHECK(`auth_mfa_factors`.`last_step` >= 0)
);
--> statement-breakpoint
CREATE TABLE `auth_mfa_recovery_codes` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`generation_id` char(36) NOT NULL,
	`verifier` char(64) NOT NULL,
	`used_at` datetime(3),
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `auth_mfa_recovery_codes_id` PRIMARY KEY(`id`),
	CONSTRAINT `mfa_recovery_verifier_uq` UNIQUE(`verifier`)
);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `assurance_version` int unsigned DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `mfa_verified_at` datetime(3);--> statement-breakpoint
ALTER TABLE `auth_mfa_challenges` ADD CONSTRAINT `auth_mfa_challenges_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `auth_mfa_factors` ADD CONSTRAINT `auth_mfa_factors_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `auth_mfa_recovery_codes` ADD CONSTRAINT `auth_mfa_recovery_codes_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `mfa_challenge_user_state_idx` ON `auth_mfa_challenges` (`user_id`,`state`,`expires_at`);--> statement-breakpoint
CREATE INDEX `mfa_challenge_expiry_idx` ON `auth_mfa_challenges` (`expires_at`);--> statement-breakpoint
CREATE INDEX `mfa_recovery_user_generation_idx` ON `auth_mfa_recovery_codes` (`user_id`,`generation_id`,`used_at`,`revoked_at`);--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_assurance_ck` CHECK (`auth_sessions`.`assurance_version` IN (0,2));--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_mfa_ck` CHECK ((`auth_sessions`.`assurance_version` = 2) = (`auth_sessions`.`mfa_verified_at` IS NOT NULL));
--> statement-breakpoint
UPDATE `auth_sessions` SET `revoked_at` = COALESCE(`revoked_at`, UTC_TIMESTAMP(3)), `updated_at` = UTC_TIMESTAMP(3);
--> statement-breakpoint
UPDATE `users` SET `auth_version` = `auth_version` + 1, `updated_at` = UTC_TIMESTAMP(3);
