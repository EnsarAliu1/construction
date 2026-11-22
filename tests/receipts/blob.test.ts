import assert from 'node:assert/strict';
import test from 'node:test';
import {randomUUID} from 'node:crypto';
import {BlobReceiptStore,receiptBlobConfiguration,receiptBlobOwner,ReceiptBlobError} from '../../src/features/receipts/blob-storage';
import {privateDownload} from '../../src/server/download';
const fixture={BLOB_STORE_ID:'store_synthetic123',BLOB_READ_WRITE_TOKEN:'vercel_blob_rw_synthetic123_SYNTHETIC_TEST_TOKEN'};

test('private Blob configuration rejects mismatched stores, malformed owners and alternate API endpoints without exposing tokens',()=>{
 assert.equal(receiptBlobConfiguration(fixture).storeId,fixture.BLOB_STORE_ID);
 for(const change of [{BLOB_STORE_ID:'store_other12345'},{BLOB_READ_WRITE_TOKEN:''},{BLOB_READ_WRITE_TOKEN:'<token>'},{RECEIPT_BLOB_OWNER:'../foreign-owner'},{VERCEL_BLOB_API_URL:'https://attacker.invalid'},{NEXT_PUBLIC_VERCEL_BLOB_API_URL:'https://attacker.invalid'}])assert.throws(()=>receiptBlobConfiguration({...fixture,...change}),error=>error instanceof ReceiptBlobError&&!error.message.includes(fixture.BLOB_READ_WRITE_TOKEN));
});
test('owner identity binds the database and private store while permitting reviewed historical key preservation',()=>{
 const database='tidb/'+'a'.repeat(64),other='tidb/'+'b'.repeat(64);
 assert.equal(receiptBlobOwner(database,fixture.BLOB_STORE_ID),receiptBlobOwner(database,fixture.BLOB_STORE_ID));
 assert.notEqual(receiptBlobOwner(database,fixture.BLOB_STORE_ID),receiptBlobOwner(other,fixture.BLOB_STORE_ID));
 const legacyOwner=randomUUID(),store=new BlobReceiptStore(database,{...receiptBlobConfiguration(fixture),owner:legacyOwner}),id=randomUUID();
 assert.equal(store.key(id),`r/${legacyOwner}/${id}.pdf`);assert.throws(()=>store.key('../../.env.local'));
 assert.notEqual(store.lockName(),new BlobReceiptStore(other,receiptBlobConfiguration(fixture)).lockName());
 assert.throws(()=>new BlobReceiptStore('unverified-db',receiptBlobConfiguration(fixture)),ReceiptBlobError);
});
test('Cloud download transport streams verified bytes above 4.5 MB and preserves private security headers',async()=>{
 const previous=process.env.VERCEL;process.env.VERCEL='1';
 try{
  const original=Buffer.alloc(5*1024*1024+7,0x41),headers={'Content-Length':String(original.length),'Content-Type':'application/pdf','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="test.pdf"','X-Content-Type-Options':'nosniff'};
  const response=privateDownload(original,headers);assert.equal(response.headers.get('Content-Length'),null);assert.equal(response.headers.get('Cache-Control'),'private, no-store');assert.equal(response.headers.get('X-Content-Type-Options'),'nosniff');
  const reader=response.body!.getReader(),parts:Uint8Array[]=[];
  while(true){const next=await reader.read();if(next.done)break;assert(next.value.byteLength<=64*1024);parts.push(next.value);}
  assert(Buffer.concat(parts).equals(original));
  const cancelled=privateDownload(original,headers);await cancelled.body!.cancel();
 }finally{if(previous===undefined)delete process.env.VERCEL;else process.env.VERCEL=previous;}
});
