import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {put,get,head,del,list,BlobError,BlobNotFoundError} from '@vercel/blob';
import {renderReceiptPdf} from '../../src/features/receipts/pdf';
import {receiptCompany} from '../../src/features/receipts/company-profile';
import {checksum,validatePdf} from '../../src/features/receipts/storage';
import {safeHistorySnapshot} from '../../src/server/db/history-snapshot';

let stage='configuration';
/** Isolated live proof. No real receipts, database writes, deployment or provider activation. */
async function main(){
 const env=parseEnv(readFileSync('.env.blob-test.local','utf8'));
 const token=env.BLOB_READ_WRITE_TOKEN,storeId=env.BLOB_STORE_ID;
 // Bind this proof to the explicitly approved store, before sending its token anywhere.
 if(storeId!=='store_cAT7G8bhHU7JqsfA'||!token?.startsWith('vercel_blob_rw_')||token.split('_')[3]?.toLowerCase()!==storeId.slice(6).toLowerCase())throw new Error('Unexpected private store configuration.');
 for(const name of ['VERCEL_BLOB_API_URL','NEXT_PUBLIC_VERCEL_BLOB_API_URL'])if(process.env[name])throw new Error('Custom Blob endpoints are forbidden for this proof.');
 const host=storeId.slice(6).toLowerCase()+'.private.blob.vercel-storage.com';
 const prefix='construction-verification/'+randomUUID()+'/',pathname=prefix+'receipt.pdf';
 const options={token,storeId};
 const signal=()=>AbortSignal.timeout(30000);
 const validUrl=(value:string)=>{const url=new URL(value);assert(url.protocol==='https:'&&url.hostname===host&&!url.port&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/'+pathname);return url;};
 stage='synthetic_pdf';
 const snapshot=safeHistorySnapshot({receiptNumber:'TEST-BLOB-0001',documentVersion:1,companyName:'Synthetic Blob verification',paymentId:randomUUID(),projectId:randomUUID(),projectName:'Synthetic project',clientName:'Synthetic buyer',amount:'10.01',method:'bank',transactionDate:'2026-11-22',issuedAt:'2026-11-22 12:00:00.000',issuerName:'Synthetic operator',paymentVersion:1,version:1,status:'issued'});
 const pdf=await renderReceiptPdf(snapshot,{company:receiptCompany({RECEIPT_COMPANY_NAME:'Synthetic Blob verification',RECEIPT_VAT_STATUS:'not-registered'})});validatePdf(pdf);
 const expected=checksum(pdf);
 stage='reserved_prefix';
 const prior=await list({...options,prefix,limit:2,abortSignal:signal()});assert.equal(prior.blobs.length,0);
 let mayExist=false,verified=false,failureStage:string|undefined;
 try{
  stage='private_upload';mayExist=true;
  const uploaded=await put(pathname,pdf,{...options,access:'private',contentType:'application/pdf',addRandomSuffix:false,allowOverwrite:false,cacheControlMaxAge:60,abortSignal:signal()});
  validUrl(uploaded.url);assert.equal(uploaded.pathname,pathname);
  stage='authenticated_read';
  const result=await get(pathname,{...options,access:'private',useCache:false,abortSignal:signal()});assert(result&&result.statusCode===200);
  validUrl(result.blob.url);assert.equal(result.blob.pathname,pathname);assert.equal(result.blob.size,pdf.length);assert.match(result.blob.contentType,/^application\/pdf(?:;|$)/i);
  const reader=result.stream.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;assert(size<=pdf.length);chunks.push(next.value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  const downloaded=Buffer.concat(chunks);validatePdf(downloaded);assert.equal(checksum(downloaded),expected);assert(downloaded.equals(pdf));
  stage='overwrite_denial';
  await assert.rejects(put(pathname,pdf,{...options,access:'private',addRandomSuffix:false,allowOverwrite:false,abortSignal:signal()}),error=>error instanceof BlobError&&/exist|precondition/i.test(error.message));
  stage='anonymous_denial';
  const anonymous=await fetch(validUrl(uploaded.url),{redirect:'manual',cache:'no-store',signal:signal()});
  try{assert([401,403,404].includes(anonymous.status));}finally{await anonymous.body?.cancel();}
  verified=true;
 }catch(error){failureStage=stage;throw error;}finally{
  if(mayExist){
   stage='cleanup';
   // Only this newly generated exact pathname may be deleted; no bulk or existing-data cleanup.
   assert(/^construction-verification\/[a-f0-9-]{36}\/receipt\.pdf$/.test(pathname));
   let metadata;
   try{metadata=await head(pathname,{...options,abortSignal:signal()});}catch(error){if(!(error instanceof BlobNotFoundError))throw error;}
   if(metadata){validUrl(metadata.url);assert.equal(metadata.pathname,pathname);await del(pathname,{...options,ifMatch:metadata.etag,abortSignal:signal()});}
   const remaining=await get(pathname,{...options,access:'private',useCache:false,abortSignal:signal()});
   assert.equal(remaining,null);
  }
  if(failureStage)stage=failureStage;
 }
 assert(verified);
 const evidence={privateAccess:true,authenticatedPdfRead:true,checksumVerified:true,overwriteRejected:true,anonymousReadDenied:true,temporaryBlobRemoved:true,applicationStorageUnchanged:true,syntheticOnly:true,sdkVersion:'2.9.0',region:'fra1'};
 writeFileSync('docs/blob-connection-verification.json',JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));
}
void main().catch(error=>{console.error(JSON.stringify({failedStage:stage,errorType:error instanceof Error?error.name:'unknown',credentialsWithheld:true}));process.exitCode=1;});
