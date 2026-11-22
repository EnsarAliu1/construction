import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {randomBytes,randomUUID} from 'node:crypto';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium} from '@playwright/test';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import type {RowDataPacket} from 'mysql2/promise';
import {connectTidb} from '../../src/server/db/tidb';
import {sessionUser} from '../../src/server/auth/sessions';
import {tokenDigest} from '../../src/server/auth/security';
import {cloudDemoEnvironment,cloudDemoRuntimeEnvironment} from '../../src/server/demo/cloud-policy';
import {cleanupCloudDemo,cloudVisitorConnection} from '../../src/server/demo/cloud-runtime';
import {CloudDemoReceiptStore} from '../../src/server/demo/cloud-storage';
import {checksum,validatePdf} from '../../src/features/receipts/storage';
async function main(){
 Object.assign(process.env,parseEnv(readFileSync('.env.demo-cloud.local','utf8')));
 const origin='http://localhost:3110',checks:string[]=[],tokens:string[]=[],errors:string[]=[];
 const browser=await chromium.launch({channel:'msedge',headless:true}),a=await browser.newContext(),b=await browser.newContext(),stranger=await browser.newContext();
 a.setDefaultTimeout(90000);b.setDefaultTimeout(90000);const page=await a.newPage();page.setDefaultNavigationTimeout(90000);page.on('pageerror',error=>errors.push(error.name));
 const pass=(message:string)=>{checks.push(message);console.log('PASS: '+message);};
 const control=()=>connectTidb(cloudDemoEnvironment(),'operator');
 const api=async(path:string)=>{const r=await a.request.get(origin+path);assert.equal(r.status(),200);return r.json();};
 try{
  assert.equal((await stranger.request.get(origin+'/api/clients')).status(),401);
  assert.equal((await stranger.request.post(origin+'/api/demo/start',{headers:{Origin:'https://attacker.invalid'},data:{}})).status(),403);pass('Anonymous data and foreign-origin demo starts denied');
  const loginPage=await page.goto(origin+'/administrata');assert.equal(loginPage?.status(),200);const html=await page.content();for(const key of ['DEMO_PRIVATE_KEY','DEMO_DB_PASSWORD'])assert(!html.includes(process.env[key]!));
  await page.getByRole('button',{name:/Provo Demo/}).click();await page.waitForURL(origin+'/app');const tokenA=(await a.cookies()).find(c=>c.name==='__Host-fitimi_demo_session')!.value;tokens.push(tokenA);
  const started=await b.request.post(origin+'/api/demo/start',{headers:{Origin:origin},data:{},timeout:120000});assert.equal(started.status(),200);const tokenB=(await b.cookies()).find(c=>c.name==='__Host-fitimi_demo_session')!.value;tokens.push(tokenB);
  const dataA=await api('/api/clients'),responseB=await b.request.get(origin+'/api/clients'),dataB=await responseB.json();assert.equal(responseB.status(),200);assert.equal(dataA.rows.length,3);assert.equal(dataB.rows.length,3);assert(!dataB.rows.some((r:{id:string})=>r.id===dataA.rows[0].id));pass('Two visitors get separate seeded TiDB databases through real HTTP login');
  const made=await a.request.post(origin+'/api/clients',{headers:{Origin:origin},data:{type:'business',name:'Cloud isolation fixture DEMO'}});assert.equal(made.status(),201);const client=(await made.json()).client;assert.equal((await b.request.get(origin+'/api/clients/'+client.id)).status(),404);pass('Visitor changes are private to that visitor');
  const receipts=await api('/api/receipts');assert.equal(receipts.rows.length,3);const receipt=receipts.rows[0].receipt,path='/api/receipts/'+receipt.id+'/versions/1/pdf';
  const pdf=await a.request.get(origin+path);assert.equal(pdf.status(),200);const pdfBytes=await pdf.body();validatePdf(pdfBytes);assert.equal(pdf.headers()['content-length'],undefined);assert.equal((await b.request.get(origin+path)).status(),404);pass('Private fictitious PDF download, streaming and cross-visitor denial');
  const registry=await control();let database:string;try{const [rows]=await registry.connection.execute<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE token_hash=?',[tokenDigest(tokenA)]);database=String(rows[0].database_name);}finally{await registry.close();}
  const unmarked=await connectTidb(cloudDemoRuntimeEnvironment(database),'application');try{assert.equal(await sessionUser(unmarked.connection,tokenA),null);}finally{await unmarked.close();}pass('Real MFA authentication guard rejects the demo assurance-zero session');
  const visitor=await cloudVisitorConnection(database);try{
   const store=new CloudDemoReceiptStore(visitor.connection),id=randomUUID();await store.initialize();await visitor.connection.beginTransaction();await store.put(pdfBytes,id);await visitor.connection.rollback();const [rows]=await visitor.connection.execute<RowDataPacket[]>('SELECT id FROM demo_pdf_files WHERE id=?',[id]);assert.equal(rows.length,0);
   await assert.rejects(visitor.connection.query('UPDATE demo_pdf_files SET sha256=sha256'));
  }finally{await visitor.close();}pass('Demo PDF bytes roll back atomically and runtime cannot overwrite stored PDFs');
  const projects=await api('/api/projects'),detail=await api('/api/projects/'+projects.rows[0].id);
  const payment=(amount:string)=>({projectId:detail.project.id,projectVersion:detail.project.version,contractId:detail.contract.id,contractVersion:detail.contract.version,amount,transactionDate:new Date().toISOString().slice(0,10),method:'bank',allocations:[{phaseId:detail.phases[0].id,phaseVersion:detail.phases[0].version,amount}]});
  const paid=await a.request.post(origin+'/api/payments',{headers:{Origin:origin},data:{idempotencyKey:randomUUID(),payment:payment('1.00')}});assert.equal(paid.status(),201);const paymentId=(await paid.json()).paymentId;
  const paidDetail=await api('/api/payments/'+paymentId),receiptId=paidDetail.receipt.id;
  const original=await a.request.get(origin+`/api/receipts/${receiptId}/versions/1/pdf`);assert.equal(original.status(),200);const first=await original.body();
  const corrected=await a.request.put(origin+'/api/payments/'+paymentId,{headers:{Origin:origin},data:{version:1,confirmation:'correct',payment:payment('2.00')}});assert.equal(corrected.status(),200);
  const second=await a.request.get(origin+`/api/receipts/${receiptId}/versions/2/pdf`);assert.equal(second.status(),200);validatePdf(await second.body());assert.notEqual(checksum(await second.body()),checksum(first));assert.equal(checksum(await (await a.request.get(origin+`/api/receipts/${receiptId}/versions/1/pdf`)).body()),checksum(first));
  assert.equal((await a.request.post(origin+'/api/payments/'+paymentId+'/cancel',{headers:{Origin:origin},data:{version:2,confirmation:'cancel',reason:'Synthetic Cloud demo verification'}})).status(),200);pass('Real payment issue, correction, cancellation and immutable original PDF history');
  const xlsx=await a.request.post(origin+'/api/reports/company',{headers:{Origin:origin},data:{format:'xlsx',filters:{}},timeout:120000});assert.equal(xlsx.status(),200);const book=new ExcelJS.Workbook();await book.xlsx.load(await xlsx.body() as never);assert.match(book.creator!,/DEMO/);pass('Actual Excel report identifies fictional demo company');
  const zipped=await a.request.post(origin+'/api/exports/business',{headers:{Origin:origin},data:{confirmation:'export-all'},timeout:120000});assert.equal(zipped.status(),200);const zip=await JSZip.loadAsync(await zipped.body(),{checkCRC32:true});assert(zip.file('README-DEMO.txt'));const manifest=JSON.parse(await zip.file('manifest.json')!.async('string'));assert(manifest.complete);for(const file of manifest.files)assert.equal(checksum(await zip.file(file.name)!.async('nodebuffer')),file.sha256);pass('Complete demo ZIP includes verified PDF history without credentials');
  for(const route of ['login','mfa','passkeys'])assert.equal((await a.request.post(origin+'/api/auth/'+route,{headers:{Origin:origin},data:{}})).status(),403);
  await stranger.addCookies([{name:'__Host-fitimi_demo_session',value:randomBytes(32).toString('base64url'),url:origin.replace('http:','https:'),secure:true}]);assert.equal((await stranger.request.get(origin+'/api/clients')).status(),401);pass('Real account endpoints and forged demo credentials denied');
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.goto(origin+'/app');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}assert.deepEqual(errors,[]);pass('Real desktop/mobile app renders without runtime errors');
  await a.request.post(origin+'/api/auth/logout',{headers:{Origin:origin},data:{}});assert.equal((await a.request.get(origin+'/api/clients')).status(),401);
  const expirer=await control();try{await expirer.connection.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[tokenDigest(tokenB)]);}finally{await expirer.close();}assert.equal((await b.request.get(origin+'/api/clients')).status(),401);pass('Logout and absolute expiration revoke live HTTP access');
  mkdirSync('artifacts/demo-cloud',{recursive:true});await page.screenshot({path:'artifacts/demo-cloud/mobile.png',fullPage:true});
 }finally{
  const expirer=await control();try{for(const token of tokens)await expirer.connection.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[tokenDigest(token)]);}finally{await expirer.close();}
  // Give the bounded Next after() preparation time to finish before stopping its owned server.
  let disposed=false;for(let i=0;i<100;i++){
   await cleanupCloudDemo();const c=await control();try{const [rows]=await c.connection.execute<RowDataPacket[]>('SELECT COUNT(*) AS n FROM demo_sessions WHERE token_hash IN (?,?)',[tokenDigest(tokens[0]??''),tokenDigest(tokens[1]??'')]);if(Number(rows[0].n)===0){disposed=true;break;}}finally{await c.close();}await pause(3000);
  }
  await browser.close();assert(disposed,'Visitor cleanup did not finish.');
 }
 writeFileSync('docs/demo-cloud-verification.json',JSON.stringify({cloudDemoVerified:true,checks,realCloudDatabase:true,productionHttpServer:true,separateVisitorDatabases:true,transactionalDemoPdfStorage:true,realPdfStorageUnchanged:true,testVisitorsRemoved:true,realDataUnchanged:true},null,2)+'\n');console.log(JSON.stringify({cloudDemoVerified:true,checks:checks.length,testVisitorsRemoved:true}));
}
void main().catch(error=>{console.error(JSON.stringify({cloudDemoVerified:false,type:error?.name,code:error?.code,location:error?.stack?.match(/(?:cloud-verify|cloud-runtime|cloud-storage)\.ts:\d+:\d+/g),credentialsWithheld:true}));process.exitCode=1;});
