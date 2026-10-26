CREATE TABLE `audit_events` (
	`id` char(36) NOT NULL,
	`actor_id` char(36),
	`entity_type` varchar(64) NOT NULL,
	`entity_id` char(36) NOT NULL,
	`action` varchar(64) NOT NULL,
	`before_snapshot` json,
	`after_snapshot` json,
	`recorded_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`operation_id` char(36),
	CONSTRAINT `audit_events_id` PRIMARY KEY(`id`),
	CONSTRAINT `audit_before_safe_ck` CHECK(JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"properties":{"id":{"type":["string","number","boolean","null"]},"name":{"type":["string","number","boolean","null"]},"displayName":{"type":["string","number","boolean","null"]},"email":{"type":["string","number","boolean","null"]},"type":{"type":["string","number","boolean","null"]},"status":{"type":["string","number","boolean","null"]},"clientId":{"type":["string","number","boolean","null"]},"projectId":{"type":["string","number","boolean","null"]},"contractId":{"type":["string","number","boolean","null"]},"phaseId":{"type":["string","number","boolean","null"]},"paymentId":{"type":["string","number","boolean","null"]},"receiptId":{"type":["string","number","boolean","null"]},"categoryId":{"type":["string","number","boolean","null"]},"personId":{"type":["string","number","boolean","null"]},"vehicleId":{"type":["string","number","boolean","null"]},"amount":{"type":["string","number","boolean","null"]},"totalValue":{"type":["string","number","boolean","null"]},"value":{"type":["string","number","boolean","null"]},"version":{"type":["string","number","boolean","null"]},"sortOrder":{"type":["string","number","boolean","null"]},"transactionDate":{"type":["string","number","boolean","null"]},"method":{"type":["string","number","boolean","null"]},"description":{"type":["string","number","boolean","null"]},"location":{"type":["string","number","boolean","null"]},"startDate":{"type":["string","number","boolean","null"]},"endDate":{"type":["string","number","boolean","null"]},"deletedAt":{"type":["string","number","boolean","null"]},"cancelledAt":{"type":["string","number","boolean","null"]},"cancellationReason":{"type":["string","number","boolean","null"]},"isActive":{"type":["string","number","boolean","null"]},"identifier":{"type":["string","number","boolean","null"]},"receiptNumber":{"type":["string","number","boolean","null"]},"issuedAt":{"type":["string","number","boolean","null"]},"clientName":{"type":["string","number","boolean","null"]},"projectName":{"type":["string","number","boolean","null"]},"issuerName":{"type":["string","number","boolean","null"]},"storageReference":{"type":["string","number","boolean","null"]},"fileChecksum":{"type":["string","number","boolean","null"]},"resultId":{"type":["string","number","boolean","null"]},"resultType":{"type":["string","number","boolean","null"]}}}', `audit_events`.`before_snapshot`)),
	CONSTRAINT `audit_after_safe_ck` CHECK(JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"properties":{"id":{"type":["string","number","boolean","null"]},"name":{"type":["string","number","boolean","null"]},"displayName":{"type":["string","number","boolean","null"]},"email":{"type":["string","number","boolean","null"]},"type":{"type":["string","number","boolean","null"]},"status":{"type":["string","number","boolean","null"]},"clientId":{"type":["string","number","boolean","null"]},"projectId":{"type":["string","number","boolean","null"]},"contractId":{"type":["string","number","boolean","null"]},"phaseId":{"type":["string","number","boolean","null"]},"paymentId":{"type":["string","number","boolean","null"]},"receiptId":{"type":["string","number","boolean","null"]},"categoryId":{"type":["string","number","boolean","null"]},"personId":{"type":["string","number","boolean","null"]},"vehicleId":{"type":["string","number","boolean","null"]},"amount":{"type":["string","number","boolean","null"]},"totalValue":{"type":["string","number","boolean","null"]},"value":{"type":["string","number","boolean","null"]},"version":{"type":["string","number","boolean","null"]},"sortOrder":{"type":["string","number","boolean","null"]},"transactionDate":{"type":["string","number","boolean","null"]},"method":{"type":["string","number","boolean","null"]},"description":{"type":["string","number","boolean","null"]},"location":{"type":["string","number","boolean","null"]},"startDate":{"type":["string","number","boolean","null"]},"endDate":{"type":["string","number","boolean","null"]},"deletedAt":{"type":["string","number","boolean","null"]},"cancelledAt":{"type":["string","number","boolean","null"]},"cancellationReason":{"type":["string","number","boolean","null"]},"isActive":{"type":["string","number","boolean","null"]},"identifier":{"type":["string","number","boolean","null"]},"receiptNumber":{"type":["string","number","boolean","null"]},"issuedAt":{"type":["string","number","boolean","null"]},"clientName":{"type":["string","number","boolean","null"]},"projectName":{"type":["string","number","boolean","null"]},"issuerName":{"type":["string","number","boolean","null"]},"storageReference":{"type":["string","number","boolean","null"]},"fileChecksum":{"type":["string","number","boolean","null"]},"resultId":{"type":["string","number","boolean","null"]},"resultType":{"type":["string","number","boolean","null"]}}}', `audit_events`.`after_snapshot`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `clients` (
	`id` char(36) NOT NULL,
	`type` enum('private_person','business') NOT NULL,
	`name` varchar(200) NOT NULL,
	`nui` varchar(100),
	`email` varchar(254),
	`phone` varchar(64),
	`address_line_1` varchar(255),
	`address_line_2` varchar(255),
	`city` varchar(150),
	`postal_code` varchar(32),
	`country` varchar(100),
	`deleted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `clients_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `contract_phases` (
	`id` char(36) NOT NULL,
	`contract_id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`description` text,
	`value` decimal(19,2) NOT NULL,
	`sort_order` int unsigned NOT NULL DEFAULT 0,
	`version` int unsigned NOT NULL DEFAULT 1,
	`deleted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `contract_phases_id` PRIMARY KEY(`id`),
	CONSTRAINT `phases_value_ck` CHECK(`contract_phases`.`value` >= 0),
	CONSTRAINT `phases_version_ck` CHECK(`contract_phases`.`version` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `contracts` (
	`id` char(36) NOT NULL,
	`project_id` char(36) NOT NULL,
	`total_value` decimal(19,2) NOT NULL,
	`version` int unsigned NOT NULL DEFAULT 1,
	`status` enum('draft','active','cancelled') NOT NULL DEFAULT 'draft',
	`activated_at` datetime(3),
	`cancelled_at` datetime(3),
	`cancellation_reason` text,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `contracts_id` PRIMARY KEY(`id`),
	CONSTRAINT `contracts_project_uq` UNIQUE(`project_id`),
	CONSTRAINT `contracts_total_ck` CHECK(`contracts`.`total_value` >= 0),
	CONSTRAINT `contracts_version_ck` CHECK(`contracts`.`version` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `entity_versions` (
	`id` char(36) NOT NULL,
	`entity_type` varchar(64) NOT NULL,
	`entity_id` char(36) NOT NULL,
	`version` int unsigned NOT NULL DEFAULT 1,
	`snapshot` json NOT NULL,
	`recorded_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `entity_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `entity_versions_identity_uq` UNIQUE(`entity_type`,`entity_id`,`version`),
	CONSTRAINT `entity_versions_version_ck` CHECK(`entity_versions`.`version` >= 1),
	CONSTRAINT `entity_versions_safe_ck` CHECK(JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"properties":{"id":{"type":["string","number","boolean","null"]},"name":{"type":["string","number","boolean","null"]},"displayName":{"type":["string","number","boolean","null"]},"email":{"type":["string","number","boolean","null"]},"type":{"type":["string","number","boolean","null"]},"status":{"type":["string","number","boolean","null"]},"clientId":{"type":["string","number","boolean","null"]},"projectId":{"type":["string","number","boolean","null"]},"contractId":{"type":["string","number","boolean","null"]},"phaseId":{"type":["string","number","boolean","null"]},"paymentId":{"type":["string","number","boolean","null"]},"receiptId":{"type":["string","number","boolean","null"]},"categoryId":{"type":["string","number","boolean","null"]},"personId":{"type":["string","number","boolean","null"]},"vehicleId":{"type":["string","number","boolean","null"]},"amount":{"type":["string","number","boolean","null"]},"totalValue":{"type":["string","number","boolean","null"]},"value":{"type":["string","number","boolean","null"]},"version":{"type":["string","number","boolean","null"]},"sortOrder":{"type":["string","number","boolean","null"]},"transactionDate":{"type":["string","number","boolean","null"]},"method":{"type":["string","number","boolean","null"]},"description":{"type":["string","number","boolean","null"]},"location":{"type":["string","number","boolean","null"]},"startDate":{"type":["string","number","boolean","null"]},"endDate":{"type":["string","number","boolean","null"]},"deletedAt":{"type":["string","number","boolean","null"]},"cancelledAt":{"type":["string","number","boolean","null"]},"cancellationReason":{"type":["string","number","boolean","null"]},"isActive":{"type":["string","number","boolean","null"]},"identifier":{"type":["string","number","boolean","null"]},"receiptNumber":{"type":["string","number","boolean","null"]},"issuedAt":{"type":["string","number","boolean","null"]},"clientName":{"type":["string","number","boolean","null"]},"projectName":{"type":["string","number","boolean","null"]},"issuerName":{"type":["string","number","boolean","null"]},"storageReference":{"type":["string","number","boolean","null"]},"fileChecksum":{"type":["string","number","boolean","null"]},"resultId":{"type":["string","number","boolean","null"]},"resultType":{"type":["string","number","boolean","null"]}}}', `entity_versions`.`snapshot`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `expense_categories` (
	`id` char(36) NOT NULL,
	`name` varchar(150) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `expense_categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `expense_categories_name_uq` UNIQUE(`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` char(36) NOT NULL,
	`amount` decimal(19,2) NOT NULL,
	`transaction_date` date NOT NULL,
	`category_id` char(36) NOT NULL,
	`description` text NOT NULL,
	`project_id` char(36),
	`person_id` char(36),
	`vehicle_id` char(36),
	`status` enum('recorded','cancelled') NOT NULL DEFAULT 'recorded',
	`cancelled_at` datetime(3),
	`cancellation_reason` text,
	`created_by` char(36),
	`cancelled_by` char(36),
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`),
	CONSTRAINT `expenses_amount_ck` CHECK(`expenses`.`amount` > 0),
	CONSTRAINT `expenses_version_ck` CHECK(`expenses`.`version` >= 1),
	CONSTRAINT `expenses_cancellation_ck` CHECK((`expenses`.`status` = 'recorded' AND `expenses`.`cancelled_at` IS NULL AND `expenses`.`cancellation_reason` IS NULL) OR (`expenses`.`status` = 'cancelled' AND `expenses`.`cancelled_at` IS NOT NULL AND `expenses`.`cancellation_reason` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `operation_requests` (
	`id` char(36) NOT NULL,
	`operation_type` varchar(64) NOT NULL,
	`idempotency_key` varchar(128) COLLATE utf8mb4_0900_bin NOT NULL,
	`request_fingerprint` varchar(64) NOT NULL,
	`status` enum('processing','completed','failed') NOT NULL DEFAULT 'processing',
	`result_metadata` json,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `operation_requests_id` PRIMARY KEY(`id`),
	CONSTRAINT `operations_type_key_uq` UNIQUE(`operation_type`,`idempotency_key`),
	CONSTRAINT `operations_key_ck` CHECK(CHAR_LENGTH(`operation_requests`.`idempotency_key`) > 0),
	CONSTRAINT `operations_fingerprint_ck` CHECK(CHAR_LENGTH(`operation_requests`.`request_fingerprint`) = 64 AND `operation_requests`.`request_fingerprint` REGEXP '^[0-9a-f]{64}$'),
	CONSTRAINT `operations_result_safe_ck` CHECK(JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"properties":{"id":{"type":["string","number","boolean","null"]},"name":{"type":["string","number","boolean","null"]},"displayName":{"type":["string","number","boolean","null"]},"email":{"type":["string","number","boolean","null"]},"type":{"type":["string","number","boolean","null"]},"status":{"type":["string","number","boolean","null"]},"clientId":{"type":["string","number","boolean","null"]},"projectId":{"type":["string","number","boolean","null"]},"contractId":{"type":["string","number","boolean","null"]},"phaseId":{"type":["string","number","boolean","null"]},"paymentId":{"type":["string","number","boolean","null"]},"receiptId":{"type":["string","number","boolean","null"]},"categoryId":{"type":["string","number","boolean","null"]},"personId":{"type":["string","number","boolean","null"]},"vehicleId":{"type":["string","number","boolean","null"]},"amount":{"type":["string","number","boolean","null"]},"totalValue":{"type":["string","number","boolean","null"]},"value":{"type":["string","number","boolean","null"]},"version":{"type":["string","number","boolean","null"]},"sortOrder":{"type":["string","number","boolean","null"]},"transactionDate":{"type":["string","number","boolean","null"]},"method":{"type":["string","number","boolean","null"]},"description":{"type":["string","number","boolean","null"]},"location":{"type":["string","number","boolean","null"]},"startDate":{"type":["string","number","boolean","null"]},"endDate":{"type":["string","number","boolean","null"]},"deletedAt":{"type":["string","number","boolean","null"]},"cancelledAt":{"type":["string","number","boolean","null"]},"cancellationReason":{"type":["string","number","boolean","null"]},"isActive":{"type":["string","number","boolean","null"]},"identifier":{"type":["string","number","boolean","null"]},"receiptNumber":{"type":["string","number","boolean","null"]},"issuedAt":{"type":["string","number","boolean","null"]},"clientName":{"type":["string","number","boolean","null"]},"projectName":{"type":["string","number","boolean","null"]},"issuerName":{"type":["string","number","boolean","null"]},"storageReference":{"type":["string","number","boolean","null"]},"fileChecksum":{"type":["string","number","boolean","null"]},"resultId":{"type":["string","number","boolean","null"]},"resultType":{"type":["string","number","boolean","null"]}}}', `operation_requests`.`result_metadata`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `payment_allocations` (
	`id` char(36) NOT NULL,
	`payment_id` char(36) NOT NULL,
	`phase_id` char(36) NOT NULL,
	`amount` decimal(19,2) NOT NULL,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `payment_allocations_id` PRIMARY KEY(`id`),
	CONSTRAINT `allocations_payment_phase_uq` UNIQUE(`payment_id`,`phase_id`),
	CONSTRAINT `allocations_amount_ck` CHECK(`payment_allocations`.`amount` > 0)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `payment_receipts` (
	`id` char(36) NOT NULL,
	`payment_id` char(36) NOT NULL,
	`receipt_number` varchar(64) NOT NULL,
	`status` enum('draft','issued','void') NOT NULL DEFAULT 'draft',
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `payment_receipts_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipts_payment_uq` UNIQUE(`payment_id`),
	CONSTRAINT `receipts_number_uq` UNIQUE(`receipt_number`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` char(36) NOT NULL,
	`project_id` char(36) NOT NULL,
	`amount` decimal(19,2) NOT NULL,
	`transaction_date` date NOT NULL,
	`method` enum('cash','bank') NOT NULL,
	`status` enum('received','cancelled') NOT NULL DEFAULT 'received',
	`cancelled_at` datetime(3),
	`cancellation_reason` text,
	`cancelled_by` char(36),
	`created_by` char(36),
	`version` int unsigned NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`),
	CONSTRAINT `payments_amount_ck` CHECK(`payments`.`amount` > 0),
	CONSTRAINT `payments_version_ck` CHECK(`payments`.`version` >= 1),
	CONSTRAINT `payments_cancellation_ck` CHECK((`payments`.`status` = 'received' AND `payments`.`cancelled_at` IS NULL AND `payments`.`cancellation_reason` IS NULL) OR (`payments`.`status` = 'cancelled' AND `payments`.`cancelled_at` IS NOT NULL AND `payments`.`cancellation_reason` IS NOT NULL))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `persons` (
	`id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`email` varchar(254),
	`phone` varchar(64),
	`identification_reference` varchar(150),
	`address` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `persons_id` PRIMARY KEY(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` char(36) NOT NULL,
	`client_id` char(36) NOT NULL,
	`name` varchar(200) NOT NULL,
	`location` varchar(255),
	`start_date` date,
	`end_date` date,
	`status` enum('active','suspended','completed') NOT NULL DEFAULT 'active',
	`deleted_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `projects_id` PRIMARY KEY(`id`),
	CONSTRAINT `projects_dates_ck` CHECK(`projects`.`end_date` IS NULL OR `projects`.`start_date` IS NULL OR `projects`.`end_date` >= `projects`.`start_date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `receipt_counters` (
	`scope` varchar(32) NOT NULL DEFAULT 'company',
	`next_number` bigint unsigned NOT NULL DEFAULT 1,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `receipt_counters_scope` PRIMARY KEY(`scope`),
	CONSTRAINT `receipt_counters_scope_ck` CHECK(`receipt_counters`.`scope` = 'company'),
	CONSTRAINT `receipt_counters_next_ck` CHECK(`receipt_counters`.`next_number` >= 1)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `receipt_versions` (
	`id` char(36) NOT NULL,
	`receipt_id` char(36) NOT NULL,
	`version` int unsigned NOT NULL DEFAULT 1,
	`content_snapshot` json NOT NULL,
	`storage_reference` varchar(512) NOT NULL,
	`file_checksum` varchar(64) NOT NULL,
	`issued_at` datetime(3) NOT NULL,
	`issued_by` char(36),
	CONSTRAINT `receipt_versions_id` PRIMARY KEY(`id`),
	CONSTRAINT `receipt_versions_receipt_version_uq` UNIQUE(`receipt_id`,`version`),
	CONSTRAINT `receipt_versions_version_ck` CHECK(`receipt_versions`.`version` >= 1),
	CONSTRAINT `receipt_versions_checksum_ck` CHECK(CHAR_LENGTH(`receipt_versions`.`file_checksum`) = 64 AND `receipt_versions`.`file_checksum` REGEXP '^[0-9a-f]{64}$'),
	CONSTRAINT `receipt_versions_safe_ck` CHECK(JSON_SCHEMA_VALID('{"type":"object","additionalProperties":false,"properties":{"id":{"type":["string","number","boolean","null"]},"name":{"type":["string","number","boolean","null"]},"displayName":{"type":["string","number","boolean","null"]},"email":{"type":["string","number","boolean","null"]},"type":{"type":["string","number","boolean","null"]},"status":{"type":["string","number","boolean","null"]},"clientId":{"type":["string","number","boolean","null"]},"projectId":{"type":["string","number","boolean","null"]},"contractId":{"type":["string","number","boolean","null"]},"phaseId":{"type":["string","number","boolean","null"]},"paymentId":{"type":["string","number","boolean","null"]},"receiptId":{"type":["string","number","boolean","null"]},"categoryId":{"type":["string","number","boolean","null"]},"personId":{"type":["string","number","boolean","null"]},"vehicleId":{"type":["string","number","boolean","null"]},"amount":{"type":["string","number","boolean","null"]},"totalValue":{"type":["string","number","boolean","null"]},"value":{"type":["string","number","boolean","null"]},"version":{"type":["string","number","boolean","null"]},"sortOrder":{"type":["string","number","boolean","null"]},"transactionDate":{"type":["string","number","boolean","null"]},"method":{"type":["string","number","boolean","null"]},"description":{"type":["string","number","boolean","null"]},"location":{"type":["string","number","boolean","null"]},"startDate":{"type":["string","number","boolean","null"]},"endDate":{"type":["string","number","boolean","null"]},"deletedAt":{"type":["string","number","boolean","null"]},"cancelledAt":{"type":["string","number","boolean","null"]},"cancellationReason":{"type":["string","number","boolean","null"]},"isActive":{"type":["string","number","boolean","null"]},"identifier":{"type":["string","number","boolean","null"]},"receiptNumber":{"type":["string","number","boolean","null"]},"issuedAt":{"type":["string","number","boolean","null"]},"clientName":{"type":["string","number","boolean","null"]},"projectName":{"type":["string","number","boolean","null"]},"issuerName":{"type":["string","number","boolean","null"]},"storageReference":{"type":["string","number","boolean","null"]},"fileChecksum":{"type":["string","number","boolean","null"]},"resultId":{"type":["string","number","boolean","null"]},"resultType":{"type":["string","number","boolean","null"]}}}', `receipt_versions`.`content_snapshot`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `users` (
	`id` char(36) NOT NULL,
	`display_name` varchar(200) NOT NULL,
	`email` varchar(254) NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`status` enum('active','inactive') NOT NULL DEFAULT 'inactive',
	`deactivated_at` datetime(3),
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_uq` UNIQUE(`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
CREATE TABLE `vehicles` (
	`id` char(36) NOT NULL,
	`identifier` varchar(100) NOT NULL,
	`description` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	`updated_at` datetime(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
	CONSTRAINT `vehicles_id` PRIMARY KEY(`id`),
	CONSTRAINT `vehicles_identifier_uq` UNIQUE(`identifier`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
--> statement-breakpoint
ALTER TABLE `audit_events` ADD CONSTRAINT `audit_events_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `contract_phases` ADD CONSTRAINT `contract_phases_contract_id_contracts_id_fk` FOREIGN KEY (`contract_id`) REFERENCES `contracts`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `contracts` ADD CONSTRAINT `contracts_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_category_id_expense_categories_id_fk` FOREIGN KEY (`category_id`) REFERENCES `expense_categories`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_person_id_persons_id_fk` FOREIGN KEY (`person_id`) REFERENCES `persons`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_vehicle_id_vehicles_id_fk` FOREIGN KEY (`vehicle_id`) REFERENCES `vehicles`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_cancelled_by_users_id_fk` FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_phase_id_contract_phases_id_fk` FOREIGN KEY (`phase_id`) REFERENCES `contract_phases`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `payment_receipts` ADD CONSTRAINT `payment_receipts_payment_id_payments_id_fk` FOREIGN KEY (`payment_id`) REFERENCES `payments`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_project_id_projects_id_fk` FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_cancelled_by_users_id_fk` FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `projects` ADD CONSTRAINT `projects_client_id_clients_id_fk` FOREIGN KEY (`client_id`) REFERENCES `clients`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `receipt_versions` ADD CONSTRAINT `receipt_versions_receipt_id_payment_receipts_id_fk` FOREIGN KEY (`receipt_id`) REFERENCES `payment_receipts`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `receipt_versions` ADD CONSTRAINT `receipt_versions_issued_by_users_id_fk` FOREIGN KEY (`issued_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `audit_entity_recorded_idx` ON `audit_events` (`entity_type`,`entity_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `audit_actor_recorded_idx` ON `audit_events` (`actor_id`,`recorded_at`);--> statement-breakpoint
CREATE INDEX `audit_operation_idx` ON `audit_events` (`operation_id`);--> statement-breakpoint
CREATE INDEX `clients_name_idx` ON `clients` (`name`);--> statement-breakpoint
CREATE INDEX `clients_deleted_idx` ON `clients` (`deleted_at`);--> statement-breakpoint
CREATE INDEX `phases_contract_deleted_order_idx` ON `contract_phases` (`contract_id`,`deleted_at`,`sort_order`);--> statement-breakpoint
CREATE INDEX `expenses_date_status_idx` ON `expenses` (`transaction_date`,`status`);--> statement-breakpoint
CREATE INDEX `expenses_project_date_idx` ON `expenses` (`project_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `expenses_category_date_idx` ON `expenses` (`category_id`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `expenses_person_idx` ON `expenses` (`person_id`);--> statement-breakpoint
CREATE INDEX `expenses_vehicle_idx` ON `expenses` (`vehicle_id`);--> statement-breakpoint
CREATE INDEX `expenses_created_by_idx` ON `expenses` (`created_by`);--> statement-breakpoint
CREATE INDEX `expenses_cancelled_by_idx` ON `expenses` (`cancelled_by`);--> statement-breakpoint
CREATE INDEX `operations_status_created_idx` ON `operation_requests` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `allocations_phase_payment_idx` ON `payment_allocations` (`phase_id`,`payment_id`);--> statement-breakpoint
CREATE INDEX `payments_project_status_date_idx` ON `payments` (`project_id`,`status`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `payments_status_date_idx` ON `payments` (`status`,`transaction_date`);--> statement-breakpoint
CREATE INDEX `payments_created_by_idx` ON `payments` (`created_by`);--> statement-breakpoint
CREATE INDEX `payments_cancelled_by_idx` ON `payments` (`cancelled_by`);--> statement-breakpoint
CREATE INDEX `persons_name_idx` ON `persons` (`name`);--> statement-breakpoint
CREATE INDEX `projects_client_idx` ON `projects` (`client_id`);--> statement-breakpoint
CREATE INDEX `projects_status_deleted_idx` ON `projects` (`status`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `receipt_versions_issuer_idx` ON `receipt_versions` (`issued_by`);--> statement-breakpoint
CREATE INDEX `users_status_idx` ON `users` (`status`);