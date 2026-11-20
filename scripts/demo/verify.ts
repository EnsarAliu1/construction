import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir,writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {chromium} from '@playwright/test';
import {createConnection} from 'mysql2/promise';
import {tokenDigest} from '../../src/server/auth/security';
import {sessionUser} from '../../src/server/auth/sessions';
import {cleanupDemo} from '../../src/server/demo/runtime';
import ExcelJS from 'exceljs';
import {setTimeout as pause} from 'node:timers/promises';

async function main(){
 const origin='http://localhost:3001',results:string[]=[];
 const pass=(name:string)=>{results.push(name);console.log(`PASS: ${name}`);};
 const password=readFileSync('.private/demo/mysql-password','utf8').trim();assert.match(password,/^[a-f0-9]{64}$/);
 Object.assign(process.env,{DEMO_MODE:'1',DEMO_PRIVATE_KEY:readFileSync('.private/demo/private-key','utf8').trim(),DEMO_DATABASE_URL:`mysql://root:${password}@127.0.0.1:3308/fitimi_dev_demo_control`,DEMO_RECEIPT_DIR:'.private/demo/receipts',DATABASE_URL:'',ADORE_OPERATOR_KEY:'',MFA_ENCRYPTION_KEYS:''});
 const c=await createConnection({host:'127.0.0.1',port:3308,user:'root',password,database:'fitimi_dev_demo_control'});
 const browser=await chromium.launch({channel:'msedge',headless:true}),a=await browser.newContext(),b=await browser.newContext(),stranger=await browser.newContext();
 const tokens:string[]=[];
 try{
  const denied=await stranger.request.get(origin+'/api/clients');assert.equal(denied.status(),401);pass('Anonymous business API denied');
  assert.equal((await stranger.request.post(origin+'/api/demo/start',{headers:{Origin:'https://attacker.invalid'},data:{}})).status(),403);pass('Cross-origin demo creation denied');
  const page=await a.newPage(),hydrationErrors:string[]=[];page.on('console',message=>{if(message.type()==='error'&&/hydrat/i.test(message.text()))hydrationErrors.push(message.text());});await page.goto(origin+'/administrata');await page.getByRole('button',{name:'Provo Demo'}).click();await page.waitForURL('**/app',{timeout:120000});await page.getByRole('status').filter({hasText:'DEMO'}).waitFor();
  const cookie=(await a.cookies()).find(v=>v.name==='fitimi_demo_session');assert(cookie&&cookie.httpOnly&&cookie.sameSite==='Lax');tokens.push(cookie.value);assert.equal((await a.cookies()).some(v=>v.name==='fitimi_session'),false);pass('Actual Edge one-click demo uses separate HttpOnly cookie');
  assert.equal(await page.locator('a[href="/app/security"]').count(),0);assert.equal(await page.locator('a[href="/app/accounts"]').count(),0);
  await page.reload();await page.getByRole('status').filter({hasText:'DEMO'}).waitFor();pass('Refresh retains the demo; account management is hidden');
  const second=await b.request.post(origin+'/api/demo/start',{headers:{Origin:origin},data:{},timeout:120000});assert.equal(second.status(),200);const tokenB=(await b.cookies()).find(v=>v.name==='fitimi_demo_session')!.value;tokens.push(tokenB);
  const dataA=await(await a.request.get(origin+'/api/clients')).json(),dataB=await(await b.request.get(origin+'/api/clients')).json();assert.equal(dataA.rows.length,3);assert.equal(dataB.rows.length,3);assert(!dataB.rows.some((v:{id:string})=>v.id===dataA.rows[0].id));pass('Two visitors receive separate seeded clients and identities');
  const created=await a.request.post(origin+'/api/clients',{headers:{Origin:origin},data:{type:'business',name:'Isolation test — DEMO'}});assert.equal(created.status(),201);const id=(await created.json()).client.id;
  assert.equal((await b.request.get(origin+`/api/clients/${id}`)).status(),404);assert.equal((await(await b.request.get(origin+'/api/clients')).json()).rows.length,3);pass('Visitor A can create; visitor B cannot read that client');
  const receipts=await(await a.request.get(origin+'/api/receipts')).json();assert.equal(receipts.rows.length,3);const receipt=receipts.rows[0].receipt;
  const pdfPath=`/api/receipts/${receipt.id}/versions/1/pdf`,pdf=await a.request.get(origin+pdfPath);assert.equal(pdf.status(),200);assert((await pdf.body()).subarray(0,5).equals(Buffer.from('%PDF-')));assert.equal((await b.request.get(origin+pdfPath)).status(),404);pass('Real generated private receipt PDF downloads; cross-visitor PDF denied');
  const xlsx=await a.request.post(origin+'/api/reports/company',{headers:{Origin:origin},data:{format:'xlsx',filters:{}}});assert.equal(xlsx.status(),200);const book=new ExcelJS.Workbook();await book.xlsx.load(await xlsx.body() as never);assert.match(book.creator!,/DEMO/);assert.equal(book.worksheets.length,8);pass('Excel export works and identifies fictional demo company');
  for(const path of ['/api/auth/login','/api/auth/mfa','/api/auth/passkeys'])assert.equal((await a.request.post(origin+path,{headers:{Origin:origin},data:{}})).status(),403);pass('Demo cannot invoke real login, MFA or passkey enrollment');
  await stranger.addCookies([{name:'fitimi_demo_session',value:randomBytes(32).toString('base64url'),url:origin}]);assert.equal((await stranger.request.get(origin+'/api/clients')).status(),401);pass('Forged demo credential denied');
  const [rows]=await c.execute('SELECT database_name FROM demo_sessions WHERE token_hash=?',[tokenDigest(cookie.value)]);const database=String((rows as {database_name:string}[])[0].database_name);assert.match(database,/^fitimi_demo_[a-f0-9]{24}$/);
  const untrusted=await createConnection({host:'127.0.0.1',port:3308,user:'root',password,database});try{assert.equal(await sessionUser(untrusted,cookie.value),null);}finally{await untrusted.end();}pass('Demo token is rejected by the unchanged real-session MFA guard');
  await page.goto('about:blank');
  await c.execute('UPDATE demo_sessions SET requests=1499 WHERE token_hash=?',[tokenDigest(cookie.value)]);
  const parallel=await Promise.all(Array.from({length:6},()=>a.request.get(origin+'/api/clients')));
  assert.equal(parallel.filter(r=>r.status()===200).length,1);assert.equal(parallel.filter(r=>r.status()===401).length,5);
  const [budget]=await c.execute('SELECT requests FROM demo_sessions WHERE token_hash=?',[tokenDigest(cookie.value)]);assert.equal((budget as {requests:number}[])[0].requests,1500);
  await c.execute('UPDATE demo_sessions SET requests=0 WHERE token_hash=?',[tokenDigest(cookie.value)]);pass('Concurrent requests have exactly one remaining budget winner; hard limit cannot be exceeded');
  for(const width of [1440,390]){await page.setViewportSize({width,height:900});await page.goto(origin+'/app');assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
  assert.deepEqual(await page.evaluate(()=>({local:Object.keys(localStorage).filter(k=>/token|secret|password|demo_session/.test(k)),session:Object.keys(sessionStorage).filter(k=>/token|secret|password|demo_session/.test(k))})),{local:[],session:[]});pass('Desktop/mobile layout fits; credentials absent from web storage');
  await mkdir('artifacts/demo',{recursive:true});await page.screenshot({path:'artifacts/demo/mobile.png',fullPage:true,caret:'initial'});assert.deepEqual(hydrationErrors,[]);
  await a.request.post(origin+'/api/auth/logout',{headers:{Origin:origin},data:{}});assert.equal((await a.request.get(origin+'/api/clients')).status(),401);pass('Logout revokes demo access');
  await c.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[tokenDigest(tokenB)]);assert.equal((await b.request.get(origin+'/api/clients')).status(),401);pass('Expired visitor cannot access private API');
  let remaining=2;
  for(let i=0;i<90&&remaining;i++){await cleanupDemo();const [left]=await c.execute('SELECT token_hash FROM demo_sessions WHERE token_hash IN (?,?)',tokens.map(tokenDigest));remaining=(left as unknown[]).length;if(remaining)await pause(1000);}
  assert.equal(remaining,0);pass('Cleanup removes expired visitor databases, users and document stores');
  await writeFile('artifacts/demo/verification.json',JSON.stringify({syntheticOnly:true,checks:results},null,2));
 }finally{
  for(const token of tokens)await c.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[tokenDigest(token)]);
  await cleanupDemo();await c.end();await browser.close();
 }
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Demo verification failed');process.exitCode=1;});
