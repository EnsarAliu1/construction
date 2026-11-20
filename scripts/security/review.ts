import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {join} from 'node:path';
import type {RowDataPacket} from 'mysql2/promise';
import {chromium} from '@playwright/test';
import JSZip from 'jszip';
import {routeInventory} from './inventory.mjs';
import {localDatabaseOptions,openLocalConnection} from '../../src/server/db/config';
import {applyMigrations} from '../../src/server/db/migrate';
import {authenticateOperator} from '../../src/server/auth/operator';
import {createAccount,setAccountActive} from '../../src/server/auth/accounts';
import {login} from '../../src/server/auth/login';
import {startEnrollment,proveEnrollment,acknowledgeCodes,resetMfa} from '../../src/server/auth/mfa';
import {authenticator} from '../../src/server/auth/mfa-crypto';
import {sessionUser,revokeSession} from '../../src/server/auth/sessions';
import {tokenDigest,OperatorRequired} from '../../src/server/auth/security';
import {createClient,listClients} from '../../src/features/clients/service';
import {createProject,getProject} from '../../src/features/projects/service';
import {createReference} from '../../src/features/references/service';
import {createExpense} from '../../src/features/expenses/service';
import {confirmPaymentWithReceipt} from '../../src/features/receipts/service';
import {checksum} from '../../src/features/receipts/storage';
import {exportBusiness} from '../../src/features/reporting/export';
import {verifyDatabaseSchema} from '../../tests/db/schema-inspection';
import {verifyReceiptPresentation} from '../documents/lifecycle';

const root='artifacts/security-review',origin='http://localhost:3000';
let stage='initialization';
async function main(){
 const options=localDatabaseOptions(process.env.TEST_DATABASE_URL,'test',process.env.DATABASE_DISPOSABLE);
 assert.match(options.database??'',/^fitimi_test_security_[a-f0-9]{8}$/);assert.equal(options.port,3307);assert.equal(process.env.AUTH_ORIGIN,origin);
 const c=await openLocalConnection(options),operator=authenticateOperator(process.env.ADORE_OPERATOR_KEY!);
 async function enrolled(connection:typeof c,label:string){
  const email=`security-${randomUUID()}@example.invalid`,password=randomUUID()+randomUUID();
  const user=await createAccount(connection,operator,{email,password,displayName:label});
  const challenge=await login(connection,email,password);assert(challenge.ok&&challenge.state==='enroll');
  const setup=await startEnrollment(connection,challenge.token);assert(setup.ok&&setup.seed);
  const proof=await proveEnrollment(connection,challenge.token,authenticator(setup.seed).generate());assert(proof.ok&&proof.codes);
  const done=await acknowledgeCodes(connection,challenge.token,'saved');assert(done.ok&&done.token);
  return {user,email,password,token:done.token,seed:setup.seed,codes:proof.codes};
 }
 try{
  if(process.argv[2]==='seed'){
   stage='synthetic seed';await applyMigrations(c);const account=await enrolled(c,'Synthetic security reviewer');
   const canary='PRIVATE-'+randomUUID(),payload=canary+'<img src=x onerror="window.__storedXSS=1"><svg onload="window.__storedXSS=1">';
   const client=await createClient(c,account.token,{type:'business',name:payload});
   const project=await createProject(c,account.token,{project:{name:'Synthetic security project',clientId:client.id,clientVersion:client.version,status:'active'},contract:{totalValue:'100.00',phases:[{name:'Phase',value:'100.00',sortOrder:0}]}});
   const detail=await getProject(c,account.token,project.id);
   const category=await createReference(c,account.token,'categories',{name:'Security test category'});
   const expense=await createExpense(c,account.token,{amount:'0.30',transactionDate:'2026-11-01',description:'Synthetic security expense',category:{id:category.id,version:category.version},project:null,person:null,vehicle:null});
   const idempotencyKey=randomUUID(),issued=await confirmPaymentWithReceipt(c,account.token,{idempotencyKey,payment:{projectId:detail.project.id,projectVersion:detail.project.version,contractId:detail.contract!.id,contractVersion:detail.contract!.version,amount:'10.00',transactionDate:'2026-11-01',method:'bank',allocations:[{phaseId:detail.phases[0].id,phaseVersion:detail.phases[0].version,amount:'10.00'}]}});
   const expired=await enrolled(c,'Synthetic expired'),revoked=await enrolled(c,'Synthetic revoked'),disabled=await enrolled(c,'Synthetic disabled');
   await c.execute('UPDATE auth_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=?',[tokenDigest(expired.token)]);
   await revokeSession(c,revoked.token);await setAccountActive(c,operator,disabled.email,false);
   const pending=await login(c,account.email,account.password);assert(pending.ok&&pending.state==='verify');
   const [triggers]=await c.query<RowDataPacket[]>('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()');assert.equal(triggers.length,13);
   await writeFile(`${root}/fixture.json`,JSON.stringify({account,canary,payload,client:client.id,project:project.id,category:category.id,expense:expense.id,issued,idempotencyKey,pending:pending.token,expired:expired.token,revoked:revoked.token,disabled:disabled.token}),{mode:0o600});
   console.log('Prepared genuine MFA accounts, attack strings and real payment/receipt in isolated schema.');return;
  }
  assert.equal(process.argv[2],'verify');
  const f=JSON.parse(await readFile(`${root}/fixture.json`,'utf8')),results:string[]=[],matrix:object[]=[];
  const check=(label:string)=>{results.push(label);console.log('PASS: '+label);};
  const cookie=(token:string)=>`__Host-fitimi_session=${token}`;
  const get=(path:string,token?:string,headers:Record<string,string>={})=>fetch(origin+path,{redirect:'manual',headers:{...(token?{Cookie:cookie(token)}:{}),...headers}});
  const post=(path:string,body:unknown,token=f.account.token,source=origin,headers:Record<string,string>={})=>fetch(origin+path,{method:'POST',redirect:'manual',headers:{Cookie:cookie(token),Origin:source,'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
  stage='runtime SQL grants';assert(await sessionUser(c,f.account.token));
  for(const sql of ['CREATE TABLE forbidden_probe(id INT)','DROP TABLE clients','ALTER TABLE clients ADD COLUMN forbidden_probe INT','DELETE FROM audit_events WHERE 1=0','UPDATE audit_events SET action=action WHERE 1=0','UPDATE entity_versions SET version=version WHERE 1=0','UPDATE receipt_versions SET version=version WHERE 1=0',"UPDATE users SET status='inactive' WHERE 1=0",'DELETE FROM auth_mfa_factors WHERE 1=0','SELECT * FROM mysql.user']){
   await assert.rejects(c.query(sql),error=>Boolean(error&&typeof error==='object'&&'errno'in error&&[1142,1143,1044].includes(Number(error.errno))));
  }
  assert((await listClients(c,f.account.token)).total>=1);
  check('Restricted runtime supports live authorization/business reads and denies DDL, account-status changes, history mutation and cross-schema reads');
  stage='private endpoint matrix';
  const fill=(path:string,kind='categories')=>path.replaceAll('[kind]',kind).replaceAll('[section]',kind).replaceAll('[key]',f.idempotencyKey).replaceAll('[version]','1').replaceAll('[id]',path.includes('receipts')?f.issued.receiptId:path.includes('payments')?f.issued.paymentId:path.includes('projects')?f.project:path.includes('expenses')?f.expense:path.includes('references')?f.category:f.client);
  const states=[{name:'anonymous',token:undefined},{name:'malformed',token:'invalid'},{name:'pre-MFA-as-session',token:f.pending},{name:'expired',token:f.expired},{name:'revoked',token:f.revoked},{name:'disabled',token:f.disabled}];
  for(const endpoint of routeInventory().filter(e=>e.kind==='api'&&!e.path.startsWith('/api/auth/'))){
   for(const kind of endpoint.path.includes('[kind]')?['categories','persons','vehicles']:['categories'])for(const state of states)for(const method of endpoint.methods){
    const path=fill(endpoint.path,kind),r=await fetch(origin+path,{method,redirect:'manual',headers:{...(state.token?{Cookie:cookie(state.token)}:{}),'Content-Type':'application/json',Origin:origin},body:['GET','HEAD'].includes(method)?undefined:'{}'});
    assert.equal(r.status,401,`${state.name} ${method} ${path}`);assert.match(r.headers.get('cache-control')??'',/no-store/);assert(!(await r.text()).includes(f.canary));matrix.push({pattern:endpoint.path,kind,method,state:state.name,status:r.status});
   }
  }
  for(const path of ['/app','/app/clients','/app/projects','/app/payments','/app/expenses','/app/receipts','/app/reports','/app/history','/app/categories','/app/persons','/app/vehicles','/app/accounts','/app/security',`/app/clients/${f.client}`,`/app/projects/${f.project}`])for(const state of states){const r=await get(path,state.token);assert.equal(r.status,307,path);assert(!(await r.text()).includes(f.canary));matrix.push({path,state:state.name,status:r.status});}
  check(`${matrix.length} real API/page denial requests: anonymous, malformed, pre-MFA, expired, revoked and disabled sessions`);
  stage='CSRF injection and request boundaries';
  for(const source of ['https://attacker.invalid','null'])assert.equal((await post('/api/clients',{type:'business',name:'Blocked'},f.account.token,source)).status,403);
  for(const value of [{type:'business',name:'Blocked',role:'operator'},{type:'business',name:'Blocked',createdBy:randomUUID()},{type:'business',name:'Blocked',passwordHash:'sentinel'}])assert.equal((await post('/api/clients',value)).status,400);
  assert.equal((await post('/api/clients',{name:'x'.repeat(9000)})).status,400);
  assert.equal((await post('/api/clients',{type:'business',name:'Blocked'},f.account.token,origin,{'Content-Type':'application/jsonp'})).status,400);
  for(const q of ["' OR 1=1 --",'%_=',"'; DROP TABLE clients; --"]){const r=await get('/api/clients?q='+encodeURIComponent(q),f.account.token);assert.equal(r.status,200);assert.equal((await r.json()).total,0);}
  const spoofed:Record<string,string>[]=[{'x-middleware-subrequest':'proxy:middleware:proxy'},{'x-forwarded-host':'attacker.invalid'},{RSC:'1'},{'x-nonce':'attacker-nonce'}];
  for(const headers of spoofed){
   let response=await get('/api/dashboard',undefined,headers);
   // Patched Next normalizes an RSC request without its cache-key query first.
   if(headers.RSC&&response.status===307){
    const location=new URL(response.headers.get('location')!,origin);
    assert.equal(location.origin,origin);assert.equal(location.pathname,'/api/dashboard');assert(location.searchParams.has('_rsc'));
    assert(!(await response.text()).includes(f.canary));response=await get(location.pathname+location.search,undefined,headers);
   }
   assert.equal(response.status,401);assert(!(await response.text()).includes(f.canary));
  }
  const preflight=await fetch(origin+'/api/clients',{method:'OPTIONS',headers:{Origin:'https://attacker.invalid','Access-Control-Request-Method':'GET'}});assert.equal(preflight.headers.get('access-control-allow-origin'),null);
  check('CSRF/foreign origins, MIME lookalikes, oversize bodies, protected fields, SQL injection and spoofed proxy headers rejected');
  stage='runtime business mutation';
  const newClient=await createClient(c,f.account.token,{type:'business',name:'Runtime privilege test'});
  const newProject=await createProject(c,f.account.token,{project:{name:'Runtime project',clientId:newClient.id,clientVersion:newClient.version,status:'active'},contract:{totalValue:'100.00',phases:[{name:'Phase',value:'100.00',sortOrder:0}]}});
  const detail=await getProject(c,f.account.token,newProject.id),idempotencyKey=randomUUID();
  const confirmation={idempotencyKey,payment:{projectId:detail.project.id,projectVersion:detail.project.version,contractId:detail.contract!.id,contractVersion:detail.contract!.version,amount:'1.23',transactionDate:'2026-11-01',method:'bank',allocations:[{phaseId:detail.phases[0].id,phaseVersion:detail.phases[0].version,amount:'1.23'}]}};
  const first=await confirmPaymentWithReceipt(c,f.account.token,confirmation),retry=await confirmPaymentWithReceipt(c,f.account.token,confirmation);assert.equal(first.paymentId,retry.paymentId);assert.equal(first.receiptId,retry.receiptId);
  const balance=await getProject(c,f.account.token,newProject.id);assert.equal(balance.phases[0].value,'100.00');
  check('Restricted runtime creates real client/project/contract/payment/receipt history and preserves idempotent payment retry');
  stage='receipt presentation lifecycle';await verifyReceiptPresentation(c,f.account.token);
  check('Receipt redesign preserves immutable original/corrected PDFs, number, replay and cancellation balances');
  stage='private downloads';
  const pdf=await get(`/api/receipts/${f.issued.receiptId}/versions/1/pdf`,f.account.token);assert.equal(pdf.status,200);assert.match(pdf.headers.get('content-type')??'',/application\/pdf/);assert.equal(pdf.headers.get('content-security-policy'),'sandbox');assert.match(pdf.headers.get('cache-control')??'',/no-store/);
  const originalPdf=Buffer.from(await pdf.arrayBuffer());assert.equal(originalPdf.subarray(0,5).toString(),'%PDF-');
  for(const format of ['pdf','xlsx']){const r=await post('/api/reports/company',{format,filters:{}});assert.equal(r.status,200);assert((await r.arrayBuffer()).byteLength>100);}
  const exported=await exportBusiness(c,f.account.token,{confirmation:'export-all'}),zip=await JSZip.loadAsync(exported.bytes);
  const forbidden=[f.account.token,tokenDigest(f.account.token),f.account.password,f.account.seed,...f.account.codes,process.env.ADORE_OPERATOR_KEY!,process.env.MFA_ENCRYPTION_KEYS!,...Object.values(JSON.parse(process.env.MFA_ENCRYPTION_KEYS!)) as string[],process.env.DATABASE_URL!,decodeURIComponent(new URL(process.env.DATABASE_URL!).password)];
  const [factor]=await c.query<RowDataPacket[]>('SELECT secret_cipher AS cipher FROM auth_mfa_factors WHERE user_id=?',[f.account.user]);forbidden.push(String(factor[0].cipher));
  for(const entry of Object.values(zip.files))if(!entry.dir&&/\.(json|csv)$/.test(entry.name)){const text=await entry.async('string');for(const secret of forbidden)assert(!text.includes(secret));}
  assert(!Object.keys(zip.files).some(name=>/auth_|mfa|passkey/i.test(name)));
  const versionFiles=Object.keys(zip.files).filter(name=>name.startsWith(`receipts/${f.issued.receiptId}/`)&&name.endsWith('.pdf'));assert(versionFiles.length>0);assert.equal(checksum(await zip.file(versionFiles[0])!.async('nodebuffer')),checksum(originalPdf));
  check('Original private PDF, actual report PDF/XLSX and complete ZIP work with restricted grants; auth secrets excluded and original PDF checksum preserved');
  stage='public and log leak probes';
  for(const path of ['/sq','/sq/about','/sq/projects','/sq/services','/sq/contact','/robots.txt','/sitemap.xml','/.env.local','/.git/config','/.private/development/mysql-root-password','/artifacts/security-review/state.json','/.next/server/server-reference-manifest.json']){const r=await get(path);const body=await r.text();for(const secret of [f.canary,...forbidden])assert(!body.includes(secret));}
  async function scan(dir:string){for(const entry of await readdir(dir,{withFileTypes:true})){const path=join(dir,entry.name);if(entry.isDirectory())await scan(path);else if(/\.(js|css|json|map)$/.test(entry.name)){const text=await readFile(path,'utf8');for(const secret of forbidden)assert(!text.includes(secret));}}}
  await scan('.next/static');
  check('Public pages, direct private-file probes and production browser bundles expose no checked credential/data sentinels');
  stage='real Edge XSS and login';
  const browser=await chromium.launch({channel:'msedge',headless:true});let browserVersion='';
  try{
   browserVersion=browser.version();const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(origin+'/administrata');await page.locator('#email').fill(f.account.email);await page.locator('#password').fill(f.account.password);await page.getByRole('button',{name:'Hyni',exact:true}).click();await page.waitForURL('**/administrata/mfa**');
   assert.equal((await context.request.get(origin+'/api/clients')).status(),401);
   const pendingCookie=(await context.cookies()).find(c=>c.name==='__Host-fitimi_pre_auth');assert(pendingCookie?.httpOnly&&pendingCookie.secure);
   // Recovery substitutes only for the second factor after genuine password verification.
   const recovered=await context.request.post(origin+'/api/auth/mfa',{headers:{Origin:origin},data:{action:'recovery',code:f.account.codes[0]}});assert.equal(recovered.status(),200);assert.equal(recovered.headers()['x-middleware-set-cookie'],undefined);
   await page.goto(origin+'/app');await page.locator('.dashboard-overview').waitFor();
   const session=(await context.cookies()).find(c=>c.name==='__Host-fitimi_session');assert(session?.httpOnly&&session.secure&&session.sameSite==='Lax');
   await page.goto(origin+`/app/clients/${f.client}`);assert((await page.locator('main h1').innerText()).includes(f.payload));assert.equal(await page.locator('img[onerror],svg[onload]').count(),0);assert.equal(await page.evaluate("window.__storedXSS"),undefined);
   await page.goto(origin+'/app/clients?q='+encodeURIComponent(f.payload));assert.equal(await page.evaluate("window.__storedXSS"),undefined);
   const policies:string[]=[];
   for(const path of ['/app','/administrata']){const r=await context.request.get(origin+path);const policy=r.headers()['content-security-policy'];assert(policy&&!policy.includes("'unsafe-eval'"));policies.push(policy);}
   assert.notEqual(policies[0].match(/nonce-([^']+)/)?.[1],policies[1].match(/nonce-([^']+)/)?.[1]);
   const probe=origin+'/app/clients/'+f.client+'?security=csp';
   await page.route(probe,async route=>{const response=await route.fetch(),html=await response.text();await route.fulfill({response,body:html.replace('</body>','<script>window.__injectedXSS=1</script><img src="/missing-csp-probe" onerror="window.__eventXSS=1"></body>')});});
   await page.goto(probe,{waitUntil:'networkidle'});assert.equal(await page.evaluate('window.__injectedXSS'),undefined);assert.equal(await page.evaluate('window.__eventXSS'),undefined);
   const publicProbe=origin+'/sq?security=csp';
   await page.route(publicProbe,async route=>{const response=await route.fetch(),html=await response.text();await route.fulfill({response,body:html.replace('</body>','<img src="/missing-public-probe" onerror="window.__eventXSS=1"></body>')});});
   await page.goto(publicProbe,{waitUntil:'networkidle'});assert.equal(await page.evaluate('window.__eventXSS'),undefined);
   await page.setViewportSize({width:390,height:844});await page.goto(origin+'/sq');
   await page.locator('.site-mobile-menu > summary').click();assert(await page.locator('.site-mobile-menu nav').isVisible());await page.keyboard.press('Escape');
   assert.equal(await page.locator('.site-mobile-menu').getAttribute('open'),null);
   await page.goto(origin+'/app');const storage=await page.evaluate<string>("JSON.stringify({local:{...localStorage},tab:{...sessionStorage}})");for(const secret of forbidden)assert(!storage.includes(secret));assert.deepEqual(errors,[]);
   await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${root}/security-mobile.png`,fullPage:true});
   const logout=await context.request.post(origin+'/api/auth/logout',{headers:{Origin:origin}});assert.equal(logout.status(),200);assert.equal((await context.request.get(origin+'/api/clients')).status(),401);await page.goto(origin+'/app');assert(page.url().includes('/administrata'));
   await context.close();
  }finally{await browser.close();}
  check('Real Edge password→MFA/recovery→private UI→logout; stored/reflected XSS escaped, private script injection and public/private event handlers blocked, no checked credentials in browser storage');
  stage='operator reset and final revocation';
  const admin=await openLocalConnection(localDatabaseOptions(process.env.OPERATOR_DATABASE_URL,'test','1'));let schemaVerification:Awaited<ReturnType<typeof verifyDatabaseSchema>>;
  try{
   await assert.rejects(resetMfa(admin,{} as ReturnType<typeof authenticateOperator>,f.account.email,{reason:'lost-authenticator-and-codes',confirmation:'reset-mfa',identityVerified:true}),OperatorRequired);
   await setAccountActive(admin,operator,f.account.email,false);assert.equal(await sessionUser(c,f.account.token),null);assert.equal((await get('/api/dashboard',f.account.token)).status,401);
   stage='schema metadata';
   try{schemaVerification=await verifyDatabaseSchema(admin);}catch(error){if(error instanceof assert.AssertionError)console.error('Schema metadata mismatch: '+error.message.slice(0,500));throw error;}
   assert.equal(schemaVerification.triggers,13);
   const [audits]=await admin.query<RowDataPacket[]>('SELECT before_snapshot AS b,after_snapshot AS a FROM audit_events');for(const row of audits)for(const secret of forbidden)assert(!JSON.stringify(row).includes(secret));
  }finally{await admin.end();}
  check('Forged operator capability rejected, live deactivation revokes existing access, 13 original triggers remain, audit snapshots contain no checked secrets');
  await writeFile(`${root}/verification.json`,JSON.stringify({date:new Date().toISOString(),browserVersion,results,matrix,schemaVerification,syntheticOnly:true,restrictedRuntime:true,ownerDatabaseTouched:false},null,2));
 }finally{await c.end();}
}
void main().catch(error=>{console.error(`Security review failed at ${stage} (${error instanceof Error?error.name:'unknown'}); details/credentials withheld.`);if(error instanceof Error)console.error(error.stack?.split('\n').filter(line=>/^\s+at /.test(line)).slice(0,2).join('\n'));process.exitCode=1;});
