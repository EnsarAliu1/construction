import {createHash,randomUUID} from 'node:crypto';
import {put,get,head,del,list,BlobNotFoundError,BlobError} from '@vercel/blob';
import type {Connection,RowDataPacket} from 'mysql2/promise';
import {checksum,validatePdf,type ReceiptFault,type ReceiptStore} from './storage';
import {tidbConnectionIdentity} from '@/server/db/tidb';

const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const digest=/^[a-f0-9]{64}$/;
const maxPdf=8*1024*1024;
type Environment=Record<string,string|undefined>;
type BlobConfiguration={storeId:string;token:string;owner?:string};
export class ReceiptBlobError extends Error{constructor(){super('Private receipt storage configuration or integrity validation failed; details withheld.');}}
export function receiptBlobConfiguration(env:Environment):BlobConfiguration{
 const storeId=env.BLOB_STORE_ID,token=env.BLOB_READ_WRITE_TOKEN,owner=env.RECEIPT_BLOB_OWNER;
 if(!storeId||!/^store_[A-Za-z0-9]{8,64}$/.test(storeId)||!token?.startsWith('vercel_blob_rw_')||/\s/.test(token)||token.split('_')[3]?.toLowerCase()!==storeId.slice(6).toLowerCase()||owner!==undefined&&!uuid.test(owner))throw new ReceiptBlobError();
 if(env.VERCEL_BLOB_API_URL||env.NEXT_PUBLIC_VERCEL_BLOB_API_URL||process.env.VERCEL_BLOB_API_URL||process.env.NEXT_PUBLIC_VERCEL_BLOB_API_URL)throw new ReceiptBlobError();
 return {storeId,token,...(owner?{owner}:{})};
}
/** Deterministic fresh-store owner; a reviewed migration can explicitly retain the original local owner UUID. */
export function receiptBlobOwner(identity:string,storeId:string){
 const hash=createHash('sha256').update('construction-receipts-blob/1|'+identity+'|'+storeId).digest('hex');
 return hash.slice(0,8)+'-'+hash.slice(8,12)+'-5'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32);
}
type Journal={application:'construction-receipt-journal/1';owner:string;id:string;checksum:string;createdAt:string};

/** Server-only durable storage. Every recovery call requires the issuance advisory lock. */
export class BlobReceiptStore implements ReceiptStore{
 readonly written:string[]=[];
 readonly owner:string;
 private ready=false;
 private readonly host:string;
 private readonly options:{token:string;storeId:string};
 constructor(private identity:string,configuration:BlobConfiguration,private fault:ReceiptFault=async()=>{}){
  if(!/^tidb\/[a-f0-9]{64}$/.test(identity))throw new ReceiptBlobError();
  const validated=receiptBlobConfiguration({BLOB_STORE_ID:configuration.storeId,BLOB_READ_WRITE_TOKEN:configuration.token,RECEIPT_BLOB_OWNER:configuration.owner});
  this.owner=validated.owner??receiptBlobOwner(identity,validated.storeId);this.options={storeId:validated.storeId,token:validated.token};
  this.host=validated.storeId.slice(6).toLowerCase()+'.private.blob.vercel-storage.com';
 }
 lockName(){return 'fitimi_files_'+checksum(Buffer.from(this.identity+'|blob|'+this.options.storeId+'|'+this.owner)).slice(0,48);}
 private marker(){return `receipt-stores/${this.owner}/owner.json`;}
 private journal(id:string){if(!uuid.test(id))throw new ReceiptBlobError();return `receipt-journals/${this.owner}/${id}.json`;}
 key(id:string){if(!uuid.test(id))throw new ReceiptBlobError();return `r/${this.owner}/${id}.pdf`;}
 private signal(){return AbortSignal.timeout(30000);}
 private checkUrl(value:string,key:string){const u=new URL(value);if(u.protocol!=='https:'||u.hostname!==this.host||u.username||u.password||u.port||u.search||u.hash||u.pathname!=='/'+key)throw new ReceiptBlobError();}
 private async bytes(key:string,maximum:number){
  const result=await get(key,{...this.options,access:'private',useCache:false,abortSignal:this.signal()});
  if(!result)return null;
  if(result.statusCode!==200)throw new ReceiptBlobError();
  this.checkUrl(result.blob.url,key);
  if(result.blob.pathname!==key||result.blob.size>maximum){await result.stream.cancel();throw new ReceiptBlobError();}
  const reader=result.stream.getReader(),chunks:Uint8Array[]=[];let size=0;
  try{while(true){const next=await reader.read();if(next.done)break;size+=next.value.byteLength;if(size>maximum)throw new ReceiptBlobError();chunks.push(next.value);}}
  finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
  if(size!==result.blob.size)throw new ReceiptBlobError();
  return Buffer.concat(chunks);
 }
 async initialize(){
  if(this.ready)return;
  const key=this.marker(),expected={application:'construction-private-receipts-blob/1',owner:this.owner,database:this.identity,storeId:this.options.storeId};
  let bytes=await this.bytes(key,4096);
  if(!bytes){
   for(const prefix of [`r/${this.owner}/`,`receipt-journals/${this.owner}/`])if((await list({...this.options,prefix,limit:1,abortSignal:this.signal()})).blobs.length)throw new ReceiptBlobError();
   try{const result=await put(key,JSON.stringify(expected),{...this.options,access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false,abortSignal:this.signal()});this.checkUrl(result.url,key);}
   catch(error){if(!(error instanceof BlobError))throw error;/* Concurrent initialization is accepted only after exact owner verification below. */}
   bytes=await this.bytes(key,4096);
  }
  if(!bytes)throw new ReceiptBlobError();
  let owner:Record<string,unknown>;try{owner=JSON.parse(bytes.toString('utf8'));}catch{throw new ReceiptBlobError();}
  if(!owner||Array.isArray(owner)||Object.keys(owner).length!==4||Object.entries(expected).some(([name,value])=>owner[name]!==value))throw new ReceiptBlobError();
  this.ready=true;
 }
 async put(bytes:Buffer,id=randomUUID()){
  if(!this.ready)throw new ReceiptBlobError();validatePdf(bytes);
  const key=this.key(id),hash=checksum(bytes),journal:Journal={application:'construction-receipt-journal/1',owner:this.owner,id,checksum:hash,createdAt:new Date().toISOString()};
  // Persist the complete intent before any document upload. Unknown journal-upload outcomes cannot have uploaded a PDF.
  const saved=await put(this.journal(id),JSON.stringify(journal),{...this.options,access:'private',contentType:'application/json',addRandomSuffix:false,allowOverwrite:false,abortSignal:this.signal()});this.checkUrl(saved.url,this.journal(id));
  this.written.push(id);await this.fault('afterJournal');await this.fault('beforeFinalize');
  const result=await put(key,bytes,{...this.options,access:'private',contentType:'application/pdf',addRandomSuffix:false,allowOverwrite:false,abortSignal:this.signal()});this.checkUrl(result.url,key);
  await this.fault('afterFinalize');await this.read(key,hash);
  return {storageReference:key,fileChecksum:hash};
 }
 async read(key:string,expected:string){
  if(!this.ready||!digest.test(expected))throw new ReceiptBlobError();
  const id=key.startsWith(`r/${this.owner}/`)&&key.endsWith('.pdf')?key.slice(`r/${this.owner}/`.length,-4):'';
  if(!uuid.test(id)||key!==this.key(id))throw new ReceiptBlobError();
  const bytes=await this.bytes(key,maxPdf);if(!bytes)throw new ReceiptBlobError();
  validatePdf(bytes);if(checksum(bytes)!==expected)throw new ReceiptBlobError();return bytes;
 }
 async recover(c:Connection,only?:string[],after='',limit=100){
  if(!this.ready||tidbConnectionIdentity(c)!==this.identity||!Number.isInteger(limit)||limit<1||limit>1000||only&&only.length>1000)throw new ReceiptBlobError();
  // TiDB returns this connection's ID for its own lock, or 1 for a lock owned by another connection.
  const [lease]=await c.execute<RowDataPacket[]>('SELECT IS_USED_LOCK(?) AS owner,CONNECTION_ID() AS current',[this.lockName()]);
  if(lease[0].owner===null||String(lease[0].owner)!==String(lease[0].current))throw new ReceiptBlobError();
  let cursor:string|undefined;
  if(after){
   if(!after.startsWith('b1.')||after.length>4096)throw new ReceiptBlobError();
   try{const parsed=JSON.parse(Buffer.from(after.slice(3),'base64url').toString('utf8'));if(parsed.owner!==this.owner||typeof parsed.cursor!=='string'||parsed.cursor.length>2048)throw new ReceiptBlobError();cursor=parsed.cursor;}catch{throw new ReceiptBlobError();}
  }
  let names:string[],next:string|null=null;
  if(only){if(only.some(id=>!uuid.test(id)))throw new ReceiptBlobError();names=[...new Set(only)];}
  else{
   const prefix=`receipt-journals/${this.owner}/`,page=await list({...this.options,prefix,cursor,limit,abortSignal:this.signal()});
   names=page.blobs.map(blob=>{this.checkUrl(blob.url,blob.pathname);const id=blob.pathname.startsWith(prefix)&&blob.pathname.endsWith('.json')?blob.pathname.slice(prefix.length,-5):'';if(!uuid.test(id)||blob.pathname!==this.journal(id))throw new ReceiptBlobError();return id;});
   if(page.hasMore){if(!page.cursor)throw new ReceiptBlobError();next='b1.'+Buffer.from(JSON.stringify({owner:this.owner,cursor:page.cursor})).toString('base64url');}
  }
  let removed=0,retained=0;
  for(const id of names){
   const key=this.key(id);
   // A failed/unknown DB read must prevent deletion. This query runs outside the rolled-back business transaction.
   const [references]=await c.execute<RowDataPacket[]>('SELECT id FROM receipt_versions WHERE storage_reference=? LIMIT 1',[key]);
   if(references.length){retained++;continue;}
   const bytes=await this.bytes(this.journal(id),4096);if(!bytes)throw new ReceiptBlobError();
   let j:Journal;try{j=JSON.parse(bytes.toString('utf8'));}catch{throw new ReceiptBlobError();}
   if(!j||Object.keys(j).length!==5||j.application!=='construction-receipt-journal/1'||j.owner!==this.owner||j.id!==id||!digest.test(j.checksum)||typeof j.createdAt!=='string'||!Number.isFinite(Date.parse(j.createdAt)))throw new ReceiptBlobError();
   let metadata;try{metadata=await head(key,{...this.options,abortSignal:this.signal()});}catch(error){if(!(error instanceof BlobNotFoundError))throw error;}
   if(metadata){this.checkUrl(metadata.url,key);await this.read(key,j.checksum);await this.fault('beforeCleanup');await del(key,{...this.options,ifMatch:metadata.etag,abortSignal:this.signal()});removed++;}
   // Keep intent journals even after cleanup: a late completion after lost DB connectivity stays discoverable.
  }
  return {removed,retained,cursor:next};
 }
}
