import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {list,del} from '@vercel/blob';
import {connectTidb,validateRuntimeGrants,validateReportingGrants} from '../../src/server/db/tidb';
import {tidbGrantStatements} from '../../src/server/db/tidb-privileges';
import {buildTidbSchemaPlan,installTidbSchema} from '../tidb/schema';
import {createAccount,setAccountActive} from '../../src/server/auth/accounts';
import {authenticateOperator} from '../../src/server/auth/operator';
import {login} from '../../src/server/auth/login';
import {startEnrollment,proveEnrollment,acknowledgeCodes} from '../../src/server/auth/mfa';
import {authenticator} from '../../src/server/auth/mfa-crypto';
import {AuthenticationRequired} from '../../src/server/auth/security';
import {createClient} from '../../src/features/clients/service';
import {createProject,getProject} from '../../src/features/projects/service';
import {confirmPaymentWithReceipt,correctPaymentWithReceipt,cancelPaymentWithReceipt,withReceiptWorkflow,getPaymentReceipt,downloadReceipt,recoverReceiptFiles} from '../../src/features/receipts/service';
import {confirmPayment,paymentOperationStatus} from '../../src/features/payments/service';
import {BlobReceiptStore,receiptBlobConfiguration} from '../../src/features/receipts/blob-storage';
import {checksum} from '../../src/features/receipts/storage';
import type {RowDataPacket} from 'mysql2/promise';

let stage='configuration';
/** Real service functions, real MFA, disposable TiDB and an isolated private Blob owner. */
async function main(){
 const sqlEnv=parseEnv(readFileSync('.env.tidb-test.local','utf8')),blobEnv=parseEnv(readFileSync('.env.blob-test.local','utf8'));
 const config=receiptBlobConfiguration(blobEnv);assert.equal(config.storeId,'store_cAT7G8bhHU7JqsfA');
 const owner=await connectTidb(sqlEnv,'operator'),database='construction_blob_probe_'+randomBytes(6).toString('hex');
 const accounts:{name:string;password:string}[]=[],connections:Awaited<ReturnType<typeof connectTidb>>[]=[];
 const keys=['RECEIPT_STORAGE_PROVIDER','BLOB_STORE_ID','BLOB_READ_WRITE_TOKEN','RECEIPT_BLOB_OWNER','RECEIPT_COMPANY_NAME','RECEIPT_NUMBER_PREFIX','ADORE_OPERATOR_KEY','MFA_ENCRYPTION_KEY_ID','MFA_ENCRYPTION_KEYS'] as const;
 const prior=Object.fromEntries(keys.map(key=>[key,process.env[key]]));
 let created=false,store:BlobReceiptStore|undefined,evidence:Record<string,unknown>|undefined;
 try{
  stage='schema';
  await owner.connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);created=true;
  const setup=await connectTidb({...sqlEnv,DB_DATABASE:database},'operator');connections.push(setup);
  await installTidbSchema(setup.connection,buildTidbSchemaPlan());
  for(const profile of ['runtime','reporting'] as const){
   const account={name:String(sqlEnv.DB_USERNAME).split('.')[0]+'.'+(profile==='runtime'?'a_':'r_')+randomBytes(4).toString('hex'),password:randomBytes(32).toString('hex')};
   await owner.connection.query('CREATE USER ?@? IDENTIFIED BY ?',[account.name,'%',account.password]);accounts.push(account);
   for(const query of tidbGrantStatements(database,profile))await setup.connection.query(query,[account.name,'%']);
  }
  const runtimeEnv={...sqlEnv,DB_DATABASE:database,DB_USERNAME:accounts[0].name,DB_PASSWORD:accounts[0].password,DB_REPORT_USERNAME:accounts[1].name,DB_REPORT_PASSWORD:accounts[1].password};
  const source=await connectTidb(runtimeEnv,'application');connections.push(source);const c=source.connection;
  const [grants]=await c.query<RowDataPacket[]>('SHOW GRANTS');validateRuntimeGrants(grants.map(row=>Object.values(row)[0]),database);
  const reader=await connectTidb({...runtimeEnv,DB_USERNAME:accounts[1].name,DB_PASSWORD:accounts[1].password},'reporting');connections.push(reader);
  const [readerGrants]=await reader.connection.query<RowDataPacket[]>('SHOW GRANTS');validateReportingGrants(readerGrants.map(row=>Object.values(row)[0]),database);
  Object.assign(process.env,{RECEIPT_STORAGE_PROVIDER:'vercel-blob',BLOB_STORE_ID:config.storeId,BLOB_READ_WRITE_TOKEN:config.token,RECEIPT_COMPANY_NAME:'Synthetic Blob service company',RECEIPT_NUMBER_PREFIX:'TEST',ADORE_OPERATOR_KEY:randomBytes(32).toString('hex'),MFA_ENCRYPTION_KEY_ID:'blob-test',MFA_ENCRYPTION_KEYS:JSON.stringify({'blob-test':randomBytes(32).toString('base64')})});delete process.env.RECEIPT_BLOB_OWNER;
  store=new BlobReceiptStore(source.identity,config);await store.initialize();
  console.log(JSON.stringify({syntheticSchemaReady:true,restrictedGrantsVerified:true,privateOwnerInitialized:true}));
  stage='mfa';
  const operator=authenticateOperator(process.env.ADORE_OPERATOR_KEY!),email=randomUUID()+'@example.invalid',password=randomBytes(32).toString('hex');
  await createAccount(setup.connection,operator,{email,displayName:'Synthetic Blob operator',password,active:true});
  const challenge=await login(c,email,password);assert(challenge.ok);if(!challenge.ok)throw new Error('Synthetic challenge failed.');
  const enrollment=await startEnrollment(c,challenge.token);assert(enrollment.ok&&enrollment.seed);
  const proof=await proveEnrollment(c,challenge.token,authenticator(enrollment.seed).generate());assert(proof.ok);
  const session=await acknowledgeCodes(c,challenge.token,'saved');assert(session.ok&&session.token);const token=session.token;
  const client=await createClient(c,token,{type:'private_person',name:'Synthetic Blob client'});
  const saved=await createProject(c,token,{project:{name:'Synthetic Blob project',clientId:client.id,clientVersion:client.version,status:'active',location:'Synthetic site',startDate:'2026-01-01',endDate:'2026-12-31'},contract:{totalValue:'100.00',phases:[{name:'Synthetic phase',value:'100.00',sortOrder:0}]}});
  const detail=await getProject(c,token,saved.id);assert(detail.contract);
  const input=(amount='10.01')=>({projectId:detail.project.id,projectVersion:detail.project.version,contractId:detail.contract!.id,contractVersion:detail.contract!.version,amount,transactionDate:'2026-11-22',method:'bank',allocations:[{phaseId:detail.phases[0].id,phaseVersion:detail.phases[0].version,amount}]});
  stage='issue_correct_cancel';
  const request={idempotencyKey:randomUUID(),payment:input()},issued=await confirmPaymentWithReceipt(c,token,request);
  const receipt=await getPaymentReceipt(c,token,issued.paymentId);assert(receipt&&receipt.documentAvailable);
  const original=await downloadReceipt(c,token,receipt.receipt.id,1);
  await correctPaymentWithReceipt(c,token,issued.paymentId,{version:1,confirmation:'correct',payment:input('20.02')});
  const corrected=await downloadReceipt(c,token,receipt.receipt.id,2);
  assert((await downloadReceipt(c,token,receipt.receipt.id,1)).bytes.equals(original.bytes));
  await cancelPaymentWithReceipt(c,token,issued.paymentId,{version:2,confirmation:'cancel',reason:'Synthetic cancellation'});
  const cancelled=await getPaymentReceipt(c,token,issued.paymentId);assert(cancelled);assert.equal(cancelled.receipt.status,'void');assert.equal(cancelled.receipt.receiptNumber,receipt.receipt.receiptNumber);
  assert((await downloadReceipt(c,token,receipt.receipt.id,2)).bytes.equals(corrected.bytes));
  stage='rollback_recovery';
  const failed={idempotencyKey:randomUUID(),payment:input()};
  await assert.rejects(withReceiptWorkflow(c,token,b=>confirmPayment(c,token,failed,b),async point=>{if(point==='beforeMetadata')throw new Error('Synthetic pre-metadata failure.');}));
  await assert.rejects(paymentOperationStatus(c,token,failed.idempotencyKey));
  const lock=store.lockName();await c.execute('SELECT GET_LOCK(?,10)',[lock]);
  let recovered;
  try{recovered=await store.recover(c);}finally{await c.execute('SELECT RELEASE_LOCK(?)',[lock]);}
  assert(recovered.retained>=2);assert((await downloadReceipt(c,token,receipt.receipt.id,1)).bytes.equals(original.bytes));
  stage='unknown_commit_response';
  const interrupted={idempotencyKey:randomUUID(),payment:input()};
  await assert.rejects(withReceiptWorkflow(c,token,b=>confirmPayment(c,token,interrupted,b),async point=>{if(point==='afterCommit')throw new Error('Synthetic lost response.');}));
  const retry=await confirmPaymentWithReceipt(c,token,interrupted);assert.equal(retry.replayed,true);assert.equal(retry.documentAvailable,true);
  const peer=await connectTidb(runtimeEnv,'application');connections.push(peer);
  stage='concurrent_exact_retries';
  const same={idempotencyKey:randomUUID(),payment:input()};
  const outcomes=await Promise.all([confirmPaymentWithReceipt(c,token,same),confirmPaymentWithReceipt(peer.connection,token,same)]);
  assert.equal(outcomes[0].paymentId,outcomes[1].paymentId);assert.equal(outcomes.filter(row=>row.replayed).length,1);
  stage='scope_and_recovery_guards';
  const [versions]=await c.query<RowDataPacket[]>('SELECT storage_reference,file_checksum FROM receipt_versions ORDER BY id');
  const first=versions[0];assert.equal(checksum(await store.read(first.storage_reference,first.file_checksum)),first.file_checksum);
  await assert.rejects(store.read(first.storage_reference,'0'.repeat(64)));
  await assert.rejects(store.read('../../.env.local',first.file_checksum));
  await assert.rejects(store.recover(c)); // No lease: destructive recovery must be refused.
  const foreign=new BlobReceiptStore('tidb/'+'0'.repeat(64),{...config,owner:store.owner});await assert.rejects(foreign.initialize());
  stage='revoked_download';
  await setAccountActive(setup.connection,operator,email,false);
  await assert.rejects(downloadReceipt(c,token,receipt.receipt.id,1),AuthenticationRequired);
  stage='operator_recovery';
  const operatorRecovery=await recoverReceiptFiles(c,operator);assert(operatorRecovery.retained>=versions.length);
  evidence={privateBlobReceiptServices:true,realMfa:true,stableNumber:true,originalPdfHistory:true,correctionAndCancellation:true,rollbackRecovery:true,unknownCommitRetry:true,concurrentIdempotency:true,checksumAndScopeGuards:true,leaseRequiredForRecovery:true,revokedDownloadsDenied:true,operatorRecovery:true,syntheticOnly:true,applicationProviderStillLocal:true};
 }finally{
  for(const key of keys){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}
  // Explicit disposal of this generated fixture only; application recovery never deletes referenced receipts.
  try{
   if(store){
    const options={token:config.token,storeId:config.storeId};
    for(const prefix of [`r/${store.owner}/`,`receipt-journals/${store.owner}/`,`receipt-stores/${store.owner}/`]){
     const page=await list({...options,prefix,limit:100,abortSignal:AbortSignal.timeout(30000)});assert(!page.hasMore);
     for(const blob of page.blobs){assert(blob.pathname.startsWith(prefix)&&!blob.pathname.includes('..'));await del(blob.pathname,{...options,ifMatch:blob.etag,abortSignal:AbortSignal.timeout(30000)});}
     assert.equal((await list({...options,prefix,limit:1,abortSignal:AbortSignal.timeout(30000)})).blobs.length,0);
    }
   }
  }finally{
   const closed=await Promise.allSettled(connections.map(connection=>connection.close()));
   try{const dropped=await Promise.allSettled(accounts.map(account=>owner.connection.query('DROP USER ?@?',[account.name,'%'])));assert(dropped.every(row=>row.status==='fulfilled'));}
   finally{try{assert.match(database,/^construction_blob_probe_[a-f0-9]{12}$/);if(created)await owner.connection.query(`DROP DATABASE \`${database}\``);}finally{await owner.close();}}
   assert(closed.every(row=>row.status==='fulfilled'));
  }
 }
 assert(evidence);writeFileSync('docs/blob-receipts-verification.json',JSON.stringify({...evidence,temporaryResourcesRemoved:true},null,2)+'\n');console.log(JSON.stringify({...evidence,temporaryResourcesRemoved:true}));
}
void main().catch(error=>{console.error(JSON.stringify({failedStage:stage,errorType:error instanceof Error?error.name:'unknown',code:/^[A-Z_0-9]+$/.test(String(error?.code))?error.code:undefined,location:error instanceof Error?error.stack?.match(/verify-receipts\.ts:\d+:\d+/)?.[0]:undefined,credentialsWithheld:true}));process.exitCode=1;});
