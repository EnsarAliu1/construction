ALTER TABLE `payment_allocations` ADD `version` int unsigned DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `payment_allocations` ADD `deleted_at` datetime(3);--> statement-breakpoint
ALTER TABLE `payment_allocations` ADD `created_by` char(36);--> statement-breakpoint
ALTER TABLE `payment_allocations` ADD `updated_by` char(36);--> statement-breakpoint
ALTER TABLE `payments` ADD `updated_by` char(36);--> statement-breakpoint
ALTER TABLE `payment_allocations` ADD CONSTRAINT `allocations_version_ck` CHECK (`payment_allocations`.`version` >= 1);--> statement-breakpoint
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `payment_allocations` ADD CONSTRAINT `payment_allocations_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE restrict ON UPDATE restrict;--> statement-breakpoint
CREATE INDEX `allocations_created_by_idx` ON `payment_allocations` (`created_by`);--> statement-breakpoint
CREATE INDEX `allocations_updated_by_idx` ON `payment_allocations` (`updated_by`);--> statement-breakpoint
CREATE INDEX `allocations_active_phase_idx` ON `payment_allocations` (`phase_id`,`deleted_at`);--> statement-breakpoint
CREATE INDEX `payments_updated_by_idx` ON `payments` (`updated_by`);