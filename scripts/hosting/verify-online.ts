import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {randomBytes} from 'node:crypto';
import {chromium} from '@playwright/test';
import PDFDocument from 'pdfkit';
import JSZip from 'jszip';
import type {RowDataPacket} from 'mysql2/promise';
import {setTimeout as pause} from 'node:timers/promises';
import {connectTidb} from '../../src/server/db/tidb';
import {cloudDemoEnvironment} from '../../src/server/demo/cloud-policy';
import {cloudVisitorConnection,cleanupCloudDemo} from '../../src/server/demo/cloud-runtime';
import {CloudDemoReceiptStore} from '../../src/server/demo/cloud-storage';
import {tokenDigest} from '../../src/server/auth/security';
import {checksum,validatePdf} from '../../src/features/receipts/storage';
let stage='readiness';
async function main(){
 Object.assign(process.env,parseEnv(readFileSync('.env.demo-cloud.local','utf8')));
 const origin='https://construction-demo-ensar.vercel.app',ready=await fetch(origin+'/api/demo/ready',{signal:AbortSignal.timeout(30000)});assert.equal(ready.status,200);assert((await ready.json()).ready);
 let prepared=false;for(let i=0;i<180;i++){const source=await connectTidb(cloudDemoEnvironment(),'operator');try{const [rows]=await source.connection.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM demo_sessions WHERE ready=TRUE AND expires_at>UTC_TIMESTAMP(3)');if(Number(rows[0].n)>0){prepared=true;break;}}finally{await source.close();}await pause(1500);}assert(prepared,'Demo preparation did not finish.');
 const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext(),page=await context.newPage();page.setDefaultNavigationTimeout(90000);page.setDefaultTimeout(120000);
 let token:string|undefined,database:string|undefined;const checks:string[]=[];
 const control=()=>connectTidb(cloudDemoEnvironment(),'operator');
 const pass=(text:string)=>{checks.push(text);console.log('PASS: '+text);};
 try{
  stage='public_browser';await page.goto(origin+'/sq');assert(await page.locator('h1').count());await page.goto(origin+'/demo');
  // The real public website-to-demo route automatically starts its personal workspace.
  await page.waitForURL(origin+'/app',{timeout:180000});token=(await context.cookies()).find(c=>c.name==='__Host-fitimi_demo_session')?.value;assert(token);pass('Public HTTPS website -> demo -> seeded application works in a real browser');
  const projects=await context.request.get(origin+'/api/projects');assert.equal(projects.status(),200);const receipts=await context.request.get(origin+'/api/receipts');assert.equal(receipts.status(),200);const list=await receipts.json();assert.equal(list.rows.length,3);const receiptId=list.rows[0].receipt.id;
  const path=`/api/receipts/${receiptId}/versions/1/pdf`,originalResponse=await context.request.get(origin+path);assert.equal(originalResponse.status(),200);const original=await originalResponse.body();validatePdf(original);pass('Actual Vercel function generates and downloads private PDFs');
  stage='large_stream';const c=await control();try{const [rows]=await c.connection.execute<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE token_hash=?',[tokenDigest(token)]);database=String(rows[0].database_name);}finally{await c.close();}
  const big=await new Promise<Buffer>((resolve,reject)=>{const doc=new PDFDocument({size:'A4',compress:false}),chunks:Buffer[]=[];doc.on('data',part=>chunks.push(part));doc.on('error',reject);doc.on('end',()=>resolve(Buffer.concat(chunks)));doc.text('DEMO - synthetic transport verification');doc.file(randomBytes(5*1024*1024),{name:'synthetic-demo.bin'});doc.end();});validatePdf(big);assert(big.length>4.5*1024*1024);
  const visitor=await cloudVisitorConnection(database),store=new CloudDemoReceiptStore(visitor.connection);let prior:RowDataPacket|undefined;
  try{
   await store.initialize();await visitor.connection.beginTransaction();const saved=await store.put(big);await visitor.connection.commit();
   const admin=await connectTidb({...cloudDemoEnvironment(),DB_DATABASE:database},'operator');try{const [rows]=await admin.connection.execute<RowDataPacket[]>('SELECT storage_reference,file_checksum FROM receipt_versions WHERE receipt_id=? AND version=1',[receiptId]);prior=rows[0];await admin.connection.execute('UPDATE receipt_versions SET storage_reference=?,file_checksum=? WHERE receipt_id=? AND version=1',[saved.storageReference,saved.fileChecksum,receiptId]);}finally{await admin.close();}
   const download=await context.request.get(origin+path,{timeout:120000});assert.equal(download.status(),200);assert.equal(checksum(await download.body()),checksum(big));assert(download.headers()['cache-control'].includes('no-store'));pass('Private PDF above 4.5 MiB streams completely through deployed Vercel');
   const archive=await context.request.post(origin+'/api/exports/business',{headers:{Origin:origin},data:{confirmation:'export-all'},timeout:120000});assert.equal(archive.status(),200);const payload=await archive.body();assert(payload.length>4.5*1024*1024);const zip=await JSZip.loadAsync(payload,{checkCRC32:true});const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));assert(manifest.complete);for(const file of manifest.files)assert.equal(checksum(await zip.file(file.name)!.async('nodebuffer')),file.sha256);pass('Complete ZIP above 4.5 MiB streams with verified historical PDF checksums');
  }finally{
   await visitor.close();if(prior){const admin=await connectTidb({...cloudDemoEnvironment(),DB_DATABASE:database},'operator');try{await admin.connection.execute('UPDATE receipt_versions SET storage_reference=?,file_checksum=? WHERE receipt_id=? AND version=1',[prior.storage_reference,prior.file_checksum,receiptId]);}finally{await admin.close();}}
  }
  assert.equal(checksum(await(await context.request.get(origin+path)).body()),checksum(original));
  stage='isolation';const anonymous=await browser.newContext();try{assert.equal((await anonymous.request.get(origin+'/api/clients')).status(),401);assert.equal((await anonymous.request.get(origin+path)).status(),401);}finally{await anonymous.close();}
  await context.request.post(origin+'/api/auth/logout',{headers:{Origin:origin},data:{}});assert.equal((await context.request.get(origin+'/api/clients')).status(),401);pass('Anonymous PDF/business access denied; deployed logout revokes the session');
 }finally{
  await browser.close();if(token){const c=await control();try{await c.connection.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[tokenDigest(token)]);}finally{await c.close();}}
  for(let i=0;i<100;i++){await cleanupCloudDemo();const c=await control();try{const [rows]=await c.connection.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM demo_sessions WHERE token_hash=?',[tokenDigest(token??'')]);if(Number(rows[0].n)===0)break;}finally{await c.close();}await pause(3000);}
 }
 writeFileSync('docs/online-demo-verification.json',JSON.stringify({httpsLive:true,url:origin,realBrowser:true,checks,deployedLargePdfAndZipStreaming:true,realDataUntouched:true},null,2)+'\n');console.log(JSON.stringify({onlineDemoVerified:true,checks:checks.length}));
}
void main().catch(error=>{console.error(JSON.stringify({onlineDemoVerified:false,stage,type:error?.name,code:error?.code,location:error?.stack?.match(/verify-online\.ts:\d+:\d+/g),credentialsWithheld:true}));process.exitCode=1;});
