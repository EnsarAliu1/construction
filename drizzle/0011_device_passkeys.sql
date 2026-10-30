CREATE TABLE `auth_passkey_challenges` (
	`id` char(36) NOT NULL,
	`user_id` char(36),
	`source_session_hash` char(64),
	`purpose` enum('register','authenticate') NOT NULL,
	`token_hash` char(64) NOT NULL,
	`challenge_hash` char(64) NOT NULL,
	`eligible_keys` json NOT NULL,
	`user_auth_version` int unsigned,
	`attempts` int unsigned NOT NULL DEFAULT 0,
	`expires_at` datetime(3) NOT NULL,
	`consumed_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `auth_passkey_challenges_id` PRIMARY KEY(`id`),
	CONSTRAINT `passkey_challenge_token_uq` UNIQUE(`token_hash`),
	CONSTRAINT `passkey_challenge_attempts_ck` CHECK(`auth_passkey_challenges`.`attempts` <= 5),
	CONSTRAINT `passkey_challenge_binding_ck` CHECK((`auth_passkey_challenges`.`purpose` = 'register' AND `auth_passkey_challenges`.`user_id` IS NOT NULL AND `auth_passkey_challenges`.`source_session_hash` IS NOT NULL AND `auth_passkey_challenges`.`user_auth_version` IS NOT NULL) OR (`auth_passkey_challenges`.`purpose` = 'authenticate' AND `auth_passkey_challenges`.`user_id` IS NULL AND `auth_passkey_challenges`.`source_session_hash` IS NULL AND `auth_passkey_challenges`.`user_auth_version` IS NULL))
);
--> statement-breakpoint
CREATE TABLE `auth_passkeys` (
	`id` char(36) NOT NULL,
	`user_id` char(36) NOT NULL,
	`credential_id` varchar(1400) NOT NULL,
	`credential_hash` char(64) NOT NULL,
	`public_key` varchar(2048) NOT NULL,
	`counter` bigint unsigned NOT NULL,
	`transports` json NOT NULL,
	`device_type` enum('singleDevice','multiDevice') NOT NULL,
	`backed_up` int unsigned NOT NULL,
	`user_auth_version` int unsigned NOT NULL,
	`label` varchar(80) NOT NULL,
	`last_used_at` datetime(3),
	`revoked_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `auth_passkeys_id` PRIMARY KEY(`id`),
	CONSTRAINT `passkey_credential_hash_uq` UNIQUE(`credential_hash`),
	CONSTRAINT `passkey_backed_up_ck` CHECK(`auth_passkeys`.`backed_up` IN (0,1)),
	CONSTRAINT `passkey_version_ck` CHECK(`auth_passkeys`.`user_auth_version` >= 1)
);
--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD `passkey_id` char(36);--> statement-breakpoint
ALTER TABLE `auth_passkey_challenges` ADD CONSTRAINT `auth_passkey_challenges_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `auth_passkeys` ADD CONSTRAINT `auth_passkeys_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `passkey_challenge_expiry_idx` ON `auth_passkey_challenges` (`expires_at`);--> statement-breakpoint
CREATE INDEX `passkey_user_state_idx` ON `auth_passkeys` (`user_id`,`revoked_at`);--> statement-breakpoint
ALTER TABLE `auth_sessions` ADD CONSTRAINT `auth_sessions_passkey_id_auth_passkeys_id_fk` FOREIGN KEY (`passkey_id`) REFERENCES `auth_passkeys`(`id`) ON DELETE restrict ON UPDATE restrict;