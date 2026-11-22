import {randomUUID} from 'node:crypto';
import {eq,sql} from 'drizzle-orm';
import {paymentReceipts} from '@/server/db/schema';
import {receiptIdentities,receiptStates} from '@/server/db/tidb-receipts';
import type {ReadSnapshotTransaction} from '@/server/db/read-snapshot';

type Tx=ReadSnapshotTransaction;
type Receipt=typeof paymentReceipts.$inferSelect;
type Issuance=Pick<Receipt,'id'|'paymentId'|'receiptNumber'|'createdBy'|'updatedBy'>;
type Revision=Pick<Receipt,'version'|'updatedBy'>&Partial<Pick<Receipt,'status'|'cancelledBy'|'cancelledAt'|'cancellationReason'>>;

/** Lock a physical identity, never rely on locking a derived current-state view. */
export async function lockReceipt(tx:Tx,paymentId:string,appendOnly:boolean){
 if(appendOnly)await tx.select({id:receiptIdentities.id}).from(receiptIdentities).where(eq(receiptIdentities.paymentId,paymentId)).for('update');
 const query=tx.select().from(paymentReceipts).where(eq(paymentReceipts.paymentId,paymentId));
 const [row]=await (appendOnly?query:query.for('update'));return row;
}
export async function issueReceiptRecord(tx:Tx,value:Issuance,appendOnly:boolean){
 if(!appendOnly){await tx.insert(paymentReceipts).values({...value,status:'issued'});return;}
 await tx.insert(receiptIdentities).values({id:value.id,paymentId:value.paymentId,receiptNumber:value.receiptNumber,createdBy:value.createdBy});
 await tx.insert(receiptStates).values({id:randomUUID(),receiptId:value.id,version:1,status:'issued',updatedBy:value.updatedBy});
}
export async function reviseReceiptRecord(tx:Tx,before:Receipt,change:Revision,appendOnly:boolean){
 if(change.version!==before.version+1||before.status!=='issued'||change.status!==undefined&&change.status!=='issued'&&change.status!=='void')throw new Error('Invalid receipt revision.');
 if(!appendOnly){await tx.update(paymentReceipts).set({...change,updatedAt:sql`UTC_TIMESTAMP(3)`}).where(eq(paymentReceipts.id,before.id));return;}
 await tx.insert(receiptStates).values({id:randomUUID(),receiptId:before.id,version:change.version,status:change.status??before.status,
  updatedBy:change.updatedBy,cancelledBy:change.cancelledBy??before.cancelledBy,cancelledAt:change.cancelledAt??before.cancelledAt,
  cancellationReason:change.cancellationReason??before.cancellationReason});
}
