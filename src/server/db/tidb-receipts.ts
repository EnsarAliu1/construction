import {mysqlTable,unique,index,check,mysqlEnum,text,varchar} from 'drizzle-orm/mysql-core';
import {sql} from 'drizzle-orm';
import {eventTime,id,referenceId,restrict,version} from './schema/common';
import {users} from './schema/identity';
import {payments} from './schema/finance';
import {historyJsonSchema} from './history-snapshot';

// Cloud-only models, deliberately excluded from the local Drizzle migration schema.
export const receiptIdentities=mysqlTable('payment_receipt_identities',{
 id:id(),paymentId:referenceId('payment_id').notNull().unique('receipt_identity_payment_uq').references(()=>payments.id,restrict),
 receiptNumber:varchar('receipt_number',{length:64}).notNull().unique('receipt_identity_number_uq'),
 createdBy:referenceId('created_by').references(()=>users.id,restrict),createdAt:eventTime('created_at').notNull().default(sql`CURRENT_TIMESTAMP(3)`),
});
export const receiptStates=mysqlTable('payment_receipt_states',{
 id:id(),receiptId:referenceId('receipt_id').notNull().references(()=>receiptIdentities.id,restrict),version:version(),
 status:mysqlEnum('status',['draft','issued','void']).notNull(),updatedBy:referenceId('updated_by').references(()=>users.id,restrict),
 cancelledBy:referenceId('cancelled_by').references(()=>users.id,restrict),cancelledAt:eventTime('cancelled_at'),cancellationReason:text('cancellation_reason'),
 updatedAt:eventTime('updated_at').notNull().default(sql`CURRENT_TIMESTAMP(3)`),
},t=>[unique('receipt_state_version_uq').on(t.receiptId,t.version),index('receipt_state_actor_idx').on(t.updatedBy),index('receipt_state_canceller_idx').on(t.cancelledBy),check('receipt_state_version_ck',sql`${t.version} >= 1`)]);

/** Fresh-schema DDL only. Never applied automatically, never alters existing owner tables. */
export function tidbReceiptDdl(){
 const snapshot=JSON.stringify(historyJsonSchema).replaceAll("'","''");
 return [
  `CREATE TABLE payment_receipt_identities (
   id CHAR(36) PRIMARY KEY,payment_id CHAR(36) NOT NULL UNIQUE,receipt_number VARCHAR(64) NOT NULL UNIQUE,
   created_by CHAR(36),created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
   FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
   FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT)`,
  `CREATE TABLE payment_receipt_states (
   id CHAR(36) PRIMARY KEY,receipt_id CHAR(36) NOT NULL,version INT UNSIGNED NOT NULL DEFAULT 1,
   status ENUM('draft','issued','void') NOT NULL,updated_by CHAR(36),cancelled_by CHAR(36),cancelled_at DATETIME(3),cancellation_reason TEXT,
   updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
   UNIQUE KEY receipt_state_version_uq(receipt_id,version),KEY receipt_state_actor_idx(updated_by),KEY receipt_state_canceller_idx(cancelled_by),
   CONSTRAINT receipt_state_version_ck CHECK (version >= 1) ENFORCED,
   FOREIGN KEY (receipt_id) REFERENCES payment_receipt_identities(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
   FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
   FOREIGN KEY (cancelled_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT)`,
  // INVOKER avoids granting a view its creator's administrative privileges.
  `CREATE SQL SECURITY INVOKER VIEW payment_receipts AS
   SELECT i.id,i.payment_id,i.receipt_number,s.status,s.version,i.created_by,s.updated_by,s.cancelled_by,s.cancelled_at,s.cancellation_reason,i.created_at,s.updated_at
   FROM payment_receipt_identities i JOIN payment_receipt_states s ON s.receipt_id=i.id
   WHERE NOT EXISTS (SELECT 1 FROM payment_receipt_states newer WHERE newer.receipt_id=s.receipt_id AND newer.version>s.version)`,
  `CREATE TABLE receipt_versions (
   id CHAR(36) PRIMARY KEY,receipt_id CHAR(36) NOT NULL,version INT UNSIGNED NOT NULL DEFAULT 1,content_snapshot JSON NOT NULL,
   storage_reference VARCHAR(512) NOT NULL,file_checksum VARCHAR(64) NOT NULL,issued_at DATETIME(3) NOT NULL,issued_by CHAR(36),
   UNIQUE KEY receipt_versions_receipt_version_uq(receipt_id,version),KEY receipt_versions_issuer_idx(issued_by),
   CONSTRAINT receipt_versions_version_ck CHECK (version >= 1) ENFORCED,
   CONSTRAINT receipt_versions_checksum_ck CHECK (CHAR_LENGTH(file_checksum)=64 AND file_checksum REGEXP '^[0-9a-f]{64}$') ENFORCED,
   CONSTRAINT receipt_versions_safe_ck CHECK (JSON_SCHEMA_VALID('${snapshot}',content_snapshot)) ENFORCED,
   FOREIGN KEY (receipt_id) REFERENCES payment_receipt_identities(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
   FOREIGN KEY (issued_by) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT)`,
  `CREATE TABLE receipt_counters (scope VARCHAR(32) PRIMARY KEY DEFAULT 'company',next_number BIGINT UNSIGNED NOT NULL DEFAULT 1,
   created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
   CONSTRAINT receipt_counters_scope_ck CHECK (scope='company') ENFORCED,CONSTRAINT receipt_counters_next_ck CHECK (next_number>=1) ENFORCED)`,
 ];
}
