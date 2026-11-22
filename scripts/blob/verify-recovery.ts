import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {put,get,list,del,head} from '@vercel/blob';
import {connectTidb} from '../../src/server/db/tidb';
import {BlobReceiptStore,receiptBlobConfiguration} from '../../src/features/receipts/blob-storage';
import {renderReceiptPdf} from '../../src/features/receipts/pdf';
import {receiptCompany} from '../../src/features/receipts/company-profile';

let stage='configuration';
async function main(){
 const env=parseEnv(readFileSync('.env.tidb-test.local','utf8')),config=receiptBlobConfiguration(parseEnv(readFileSync('.env.blob-test.local','utf8')));
 assert.equal(config.storeId,'store_cAT7G8bhHU7JqsfA');
 const owner=await connectTidb(env,'operator'),database='construction_blob_recovery_'+randomBytes(6).toString('hex');
 let created=false,source:Awaited<ReturnType<typeof connectTidb>>|undefined,store:BlobReceiptStore|undefined,proved=false;
 try{
  stage='synthetic_schema';await owner.connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);created=true;
  source=await connectTidb({...env,DB_DATABASE:database},'operator');const c=source.connection;
  await c.query('CREATE TABLE receipt_versions(id CHAR(36) PRIMARY KEY,storage_reference VARCHAR(512) NOT NULL,file_checksum CHAR(64) NOT NULL)');
  store=new BlobReceiptStore(source.identity,config);await store.initialize();
  const bytes=await renderReceiptPdf({receiptNumber:'TEST-RECOVERY',documentVersion:1,companyName:'Synthetic recovery',projectName:'Synthetic project',clientName:'Synthetic buyer',amount:'10.01',method:'bank',transactionDate:'2026-11-22',issuedAt:'2026-11-22 12:00:00.000',issuerName:'Synthetic operator',status:'issued'},{company:receiptCompany({RECEIPT_COMPANY_NAME:'Synthetic recovery'})});
  const id=randomUUID(),saved=await store.put(bytes,id);const lock=store.lockName();
  await c.execute('SELECT GET_LOCK(?,10)',[lock]);
  try{
   stage='database_read_failure';
   const execute=c.execute;
   c.execute=((...args:Parameters<typeof execute>)=>{const statement:unknown=args[0];if(typeof statement==='string'&&statement.startsWith('SELECT id FROM receipt_versions'))return Promise.reject(new Error('Synthetic database read outage.'));return execute.apply(c,args);}) as typeof execute;
   try{await assert.rejects(store.recover(c,[id]),/Synthetic database read outage/);}finally{c.execute=execute;}
   assert((await store.read(saved.storageReference,saved.fileChecksum)).equals(bytes));
   stage='orphan_cleanup';assert.equal((await store.recover(c,[id])).removed,1);
   assert.equal(await get(saved.storageReference,{...config,access:'private',useCache:false,abortSignal:AbortSignal.timeout(30000)}),null);
   const journal='receipt-journals/'+store.owner+'/'+id+'.json';assert(await head(journal,{...config,abortSignal:AbortSignal.timeout(30000)}));
   stage='late_upload_completion';
   await put(saved.storageReference,bytes,{...config,access:'private',contentType:'application/pdf',allowOverwrite:false,addRandomSuffix:false,abortSignal:AbortSignal.timeout(30000)});
   assert.equal((await store.recover(c,[id])).removed,1,'durable intent must discover a late unreferenced upload');
   stage='referenced_retention';
   const retainedId=randomUUID(),retained=await store.put(bytes,retainedId);
   await c.execute('INSERT INTO receipt_versions VALUES(?,?,?)',[randomUUID(),retained.storageReference,retained.fileChecksum]);
   assert.equal((await store.recover(c,[retainedId])).retained,1);
   assert((await store.read(retained.storageReference,retained.fileChecksum)).equals(bytes));
   proved=true;
  }finally{await c.execute('SELECT RELEASE_LOCK(?)',[lock]);}
 }finally{
  try{
   if(store)for(const prefix of [`r/${store.owner}/`,`receipt-journals/${store.owner}/`,`receipt-stores/${store.owner}/`]){
    const page=await list({...config,prefix,limit:100,abortSignal:AbortSignal.timeout(30000)});assert(!page.hasMore);
    for(const blob of page.blobs){assert(blob.pathname.startsWith(prefix)&&!blob.pathname.includes('..'));await del(blob.pathname,{...config,ifMatch:blob.etag,abortSignal:AbortSignal.timeout(30000)});}
    assert.equal((await list({...config,prefix,limit:1,abortSignal:AbortSignal.timeout(30000)})).blobs.length,0);
   }
  }finally{try{await source?.close();}finally{try{assert.match(database,/^construction_blob_recovery_[a-f0-9]{12}$/);if(created)await owner.connection.query(`DROP DATABASE \`${database}\``);}finally{await owner.close();}}}
 }
 assert(proved);const evidence={failedDatabaseReadPreservesPdf:true,durableOrphanIntent:true,lateCompletionRecovered:true,referencedPdfRetained:true,temporaryResourcesRemoved:true,syntheticOnly:true};
 writeFileSync('docs/blob-recovery-verification.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}
void main().catch(error=>{console.error(JSON.stringify({failedStage:stage,errorType:error instanceof Error?error.name:'unknown',credentialsWithheld:true}));process.exitCode=1;});
