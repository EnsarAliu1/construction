import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as fs from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {parseEnv} from 'node:util';
import {drizzle} from 'drizzle-orm/mysql2';
import {asc} from 'drizzle-orm';
import {connectTidb} from '../../src/server/db/tidb';
import {tidbReceiptDdl,receiptStates} from '../../src/server/db/tidb-receipts';
import {paymentReceipts,receiptVersions} from '../../src/server/db/schema';
import {lockReceipt,issueReceiptRecord,reviseReceiptRecord} from '../../src/features/receipts/records';
import {renderReceiptPdf} from '../../src/features/receipts/pdf';
import {PrivateReceiptStore,checksum} from '../../src/features/receipts/storage';
import {formatReceiptNumber} from '../../src/features/receipts/service';
import {safeHistorySnapshot} from '../../src/server/db/history-snapshot';
import {withReadSnapshot} from '../../src/server/db/read-snapshot';

let stage='operator_connection';
/** Synthetic Cloud receipts only; all generated SQL objects and private test files are removed. */
async function main(){
 const env=parseEnv(readFileSync('.env.tidb-test.local','utf8'));
 const owner=await connectTidb(env,'operator');
 const suffix=randomBytes(6).toString('hex'),database='construction_receipt_probe_'+suffix;
 const username=String(env.DB_USERNAME).split('.')[0]+'.p_'+randomBytes(4).toString('hex'),password=randomBytes(32).toString('hex');
 const root=resolve('.private','tidb-receipt-probe-'+suffix),previousRoot=process.env.RECEIPT_STORAGE_DIR;
 let created=false,userCreated=false,createdRoot=false;
 const clients:Awaited<ReturnType<typeof connectTidb>>[]=[];
 try{
  stage='fresh_schema';
  await owner.connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);created=true;
  const setup=await connectTidb({...env,DB_DATABASE:database},'operator');clients.push(setup);
  await setup.connection.query('CREATE TABLE users (id CHAR(36) PRIMARY KEY)');
  await setup.connection.query('CREATE TABLE payments (id CHAR(36) PRIMARY KEY)');
  for(const statement of tidbReceiptDdl())await setup.connection.query(statement);
  const actor=randomUUID(),payment=randomUUID(),receipt=randomUUID();
  await setup.connection.execute('INSERT INTO users VALUES (?)',[actor]);
  await setup.connection.execute('INSERT INTO payments VALUES (?)',[payment]);
  stage='restricted_principal';
  await owner.connection.query('CREATE USER ?@? IDENTIFIED BY ?',[username,'%',password]);userCreated=true;
  for(const table of ['payment_receipts','payment_receipt_identities','payment_receipt_states','receipt_versions','receipt_counters'])await owner.connection.query(`GRANT SELECT ON \`${database}\`.\`${table}\` TO ?@?`,[username,'%']);
  for(const table of ['payment_receipt_identities','payment_receipt_states','receipt_versions','receipt_counters'])await owner.connection.query(`GRANT INSERT ON \`${database}\`.\`${table}\` TO ?@?`,[username,'%']);
  await owner.connection.query(`GRANT UPDATE ON \`${database}\`.receipt_counters TO ?@?`,[username,'%']);
  const runtimeEnv={...env,DB_DATABASE:database,DB_USERNAME:username,DB_PASSWORD:password};
  const runtime=await connectTidb(runtimeEnv,'application');clients.push(runtime);
  const c=runtime.connection,db=drizzle(c);
  await fs.mkdir(root);createdRoot=true;process.env.RECEIPT_STORAGE_DIR=root;
  const store=new PrivateReceiptStore(runtime.identity);await store.initialize();
  const snapshot=(version:number)=>safeHistorySnapshot({receiptId:receipt,receiptNumber:formatReceiptNumber(BigInt(1),'TEST'),documentVersion:version,companyName:'Synthetic test company',paymentId:payment,paymentVersion:version,version,projectName:'Synthetic project',clientName:'Synthetic buyer',amount:version===1?'10.01':'20.02',method:'bank',transactionDate:'2026-11-20',issuedAt:'2026-11-20 12:00:00.000',issuerName:'Synthetic operator',status:'issued'});
  const original=await renderReceiptPdf(snapshot(1)),corrected=await renderReceiptPdf(snapshot(2));
  const documents=[original,corrected];
  stage='issuance';
  await db.transaction(async tx=>{
   assert.equal(await lockReceipt(tx,payment,true),undefined);
   await issueReceiptRecord(tx,{id:receipt,paymentId:payment,receiptNumber:formatReceiptNumber(BigInt(1),'TEST'),createdBy:actor,updatedBy:actor},true);
   const stored=await store.put(original);
   await tx.insert(receiptVersions).values({id:randomUUID(),receiptId:receipt,version:1,contentSnapshot:snapshot(1),...stored,issuedAt:'2026-11-20 12:00:00.000',issuedBy:actor});
  });
  stage='correction';
  await db.transaction(async tx=>{
   const before=await lockReceipt(tx,payment,true);assert(before);
   await reviseReceiptRecord(tx,before,{version:2,updatedBy:actor},true);
   const stored=await store.put(corrected);
   await tx.insert(receiptVersions).values({id:randomUUID(),receiptId:receipt,version:2,contentSnapshot:snapshot(2),...stored,issuedAt:'2026-11-20 12:00:01.000',issuedBy:actor});
  });
  stage='rollback';
  let orphan='';
  await assert.rejects(db.transaction(async tx=>{
   const before=await lockReceipt(tx,payment,true);assert(before);
   await reviseReceiptRecord(tx,before,{version:3,updatedBy:actor},true);
   const stored=await store.put(corrected);orphan=stored.storageReference;
   await tx.insert(receiptVersions).values({id:randomUUID(),receiptId:receipt,version:3,contentSnapshot:snapshot(3),...stored,fileChecksum:'invalid',issuedAt:'2026-11-20 12:00:02.000',issuedBy:actor});
  }));
  assert.equal((await db.select().from(paymentReceipts))[0].version,2);
  const recovered=await store.recover(c);assert.equal(recovered.removed,1);assert.equal(recovered.retained,2);
  await assert.rejects(store.read(orphan,checksum(corrected)));
  stage='concurrent_cancellation';
  const second=await connectTidb(runtimeEnv,'application');clients.push(second);
  const race=await Promise.allSettled([c,second.connection].map(connection=>drizzle(connection).transaction(async tx=>{
   const before=await lockReceipt(tx,payment,true);assert(before);assert.equal(before.version,2);
   await reviseReceiptRecord(tx,before,{version:3,status:'void',updatedBy:actor,cancelledBy:actor,cancelledAt:'2026-11-20 12:01:00.000',cancellationReason:'Synthetic cancellation'},true);
  })));
  assert.equal(race.filter(result=>result.status==='fulfilled').length,1);
  const [current]=await db.select().from(paymentReceipts);assert.equal(current.status,'void');assert.equal(current.version,3);assert.equal(current.receiptNumber,'TEST-00000001');assert.equal(current.paymentId,payment);
  const states=await db.select().from(receiptStates).orderBy(asc(receiptStates.version));assert.deepEqual(states.map(row=>row.status),['issued','issued','void']);
  const versions=await db.select().from(receiptVersions).orderBy(asc(receiptVersions.version));assert.equal(versions.length,2);
  for(const [i,version] of versions.entries())assert((await store.read(version.storageReference,version.fileChecksum)).equals(documents[i]));
  stage='immutable_history';
  let denied=0;
  for(const statement of ['UPDATE payment_receipt_identities SET receipt_number=receipt_number','DELETE FROM payment_receipt_identities','UPDATE payment_receipt_states SET status=status','DELETE FROM payment_receipt_states','UPDATE receipt_versions SET file_checksum=file_checksum','DELETE FROM receipt_versions','ALTER TABLE payment_receipt_states ADD COLUMN forbidden INT']){
   await assert.rejects(c.query(statement),error=>error instanceof Error&&/privilege|denied/i.test(error.message));denied++;
  }
  stage='reporting_view';
  const readerName=String(env.DB_USERNAME).split('.')[0]+'.r_'+randomBytes(4).toString('hex'),readerPassword=randomBytes(32).toString('hex');
  await owner.connection.query('CREATE USER ?@? IDENTIFIED BY ?',[readerName,'%',readerPassword]);
  try{
   for(const table of ['payment_receipts','payment_receipt_identities','payment_receipt_states','receipt_versions'])await owner.connection.query(`GRANT SELECT ON \`${database}\`.\`${table}\` TO ?@?`,[readerName,'%']);
   const reportingSource=await connectTidb({...runtimeEnv,DB_REPORT_USERNAME:readerName,DB_REPORT_PASSWORD:readerPassword},'application');clients.push(reportingSource);
   await withReadSnapshot(reportingSource.connection,async tx=>{
    assert.equal((await tx.select().from(paymentReceipts))[0].status,'void');
    assert.equal((await tx.select().from(receiptStates)).length,3);
   });
  }finally{await owner.connection.query('DROP USER ?@?',[readerName,'%']);}
  console.log(JSON.stringify({receiptRepository:true,issuedCorrectedCancelled:true,stableIdentity:true,historyStates:states.length,originalPdfVersions:versions.length,rollbackRecovery:true,concurrentWinner:true,deniedMutations:denied,reportingView:true,syntheticOnly:true}));
 }finally{
  if(previousRoot===undefined)delete process.env.RECEIPT_STORAGE_DIR;else process.env.RECEIPT_STORAGE_DIR=previousRoot;
  try{
   for(const client of clients)await client.close();
  }finally{
   try{if(userCreated)await owner.connection.query('DROP USER ?@?',[username,'%']);}
   finally{
    try{assert.match(database,/^construction_receipt_probe_[a-f0-9]{12}$/);if(created)await owner.connection.query(`DROP DATABASE \`${database}\``);}
    finally{
     try{await owner.close();}
     finally{if(createdRoot){assert(root.startsWith(resolve('.private')+sep)&&root.endsWith('tidb-receipt-probe-'+suffix));await fs.rm(root,{recursive:true,force:true});}}
    }
   }
  }
 }
 console.log(JSON.stringify({temporaryObjectsRemoved:true,applicationProviderUnchanged:true}));
}
void main().catch(error=>{console.error(JSON.stringify({failedStage:stage,errorType:error instanceof Error?error.name:'unknown',code:/^[A-Z_0-9]+$/.test(String(error?.code))?error.code:undefined,credentialsWithheld:true}));process.exitCode=1;});
