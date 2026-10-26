-- Row-level historical guards. These do not enforce cross-row financial sums.
CREATE TRIGGER `receipt_versions_no_update` BEFORE UPDATE ON `receipt_versions`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Issued receipt versions are immutable';
--> statement-breakpoint
CREATE TRIGGER `receipt_versions_no_delete` BEFORE DELETE ON `receipt_versions`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Issued receipt versions cannot be deleted';
--> statement-breakpoint
CREATE TRIGGER `audit_events_no_update` BEFORE UPDATE ON `audit_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit events are append-only';
--> statement-breakpoint
CREATE TRIGGER `audit_events_no_delete` BEFORE DELETE ON `audit_events`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Audit events cannot be deleted';
--> statement-breakpoint
CREATE TRIGGER `entity_versions_no_update` BEFORE UPDATE ON `entity_versions`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Entity versions are append-only';
--> statement-breakpoint
CREATE TRIGGER `entity_versions_no_delete` BEFORE DELETE ON `entity_versions`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Entity versions cannot be deleted';
--> statement-breakpoint
CREATE TRIGGER `payments_no_delete` BEFORE DELETE ON `payments`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cancel payments instead of deleting financial history';
--> statement-breakpoint
CREATE TRIGGER `expenses_no_delete` BEFORE DELETE ON `expenses`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Cancel expenses instead of deleting financial history';
--> statement-breakpoint
CREATE TRIGGER `contracts_no_delete` BEFORE DELETE ON `contracts`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Contract identity must be retained';
--> statement-breakpoint
CREATE TRIGGER `contract_phases_no_delete` BEFORE DELETE ON `contract_phases`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Use logical deletion for contract phases';
--> statement-breakpoint
CREATE TRIGGER `payment_allocations_no_delete` BEFORE DELETE ON `payment_allocations`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allocation history must be retained';
--> statement-breakpoint
CREATE TRIGGER `payment_receipts_no_delete` BEFORE DELETE ON `payment_receipts`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Receipt identity and number must be retained';
--> statement-breakpoint
CREATE TRIGGER `payment_receipts_identity_guard` BEFORE UPDATE ON `payment_receipts`
FOR EACH ROW
BEGIN
  IF CAST(NEW.receipt_number AS BINARY) <> CAST(OLD.receipt_number AS BINARY) OR NEW.payment_id <> OLD.payment_id OR NEW.id <> OLD.id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Receipt corrections must retain the receipt number and payment';
  END IF;
END;
