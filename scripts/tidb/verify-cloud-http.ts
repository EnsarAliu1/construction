import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawn,type ChildProcess} from 'node:child_process';
import {createServer} from 'node:net';
import {setTimeout as pause} from 'node:timers/promises';
import {chromium,type Browser,type BrowserContext} from '@playwright/test';
import {list,del} from '@vercel/blob';
import type {RowDataPacket} from 'mysql2/promise';
import {connectTidb,tidbOptions,tidbStorageIdentity} from '../../src/server/db/tidb';
import {tidbGrantStatements} from '../../src/server/db/tidb-privileges';
import {tidbExpectedSchema} from '../../src/server/db/tidb-schema';
import {buildTidbSchemaPlan,installTidbSchema} from './schema';
import {createAccount,revokeAccountSessions} from '../../src/server/auth/accounts';
import {authenticateOperator} from '../../src/server/auth/operator';
import {authenticator} from '../../src/server/auth/mfa-crypto';
import {BlobReceiptStore,receiptBlobConfiguration} from '../../src/features/receipts/blob-storage';

let stage='configuration';
async function main(){
 assert(existsSync('.next-cloud/BUILD_ID'),'Build with FITIMI_TEST_BUILD=cloud before running this harness.');
 const mainHash=createHash('sha256').update(readFileSync('.env.local')).digest('hex');
 const sqlEnv=parseEnv(readFileSync('.env.tidb-test.local','utf8')),config=receiptBlobConfiguration(parseEnv(readFileSync('.env.blob-test.local','utf8')));
 assert.equal(config.storeId,'store_cAT7G8bhHU7JqsfA');
 const port=Number(process.env.CLOUD_HTTP_TEST_PORT??'3107');assert([3107,3108].includes(port));
 const origin=`http://localhost:${port}`,suffix=randomBytes(6).toString('hex'),database='construction_http_probe_'+suffix,root='artifacts/cloud-http/'+suffix;
 await new Promise<void>((yes,no)=>{const probe=createServer();probe.once('error',no);probe.listen(port,'127.0.0.1',()=>probe.close(()=>yes()));});
 mkdirSync(root,{recursive:true});
 const owner=await connectTidb(sqlEnv,'operator'),accounts:{name:string;password:string}[]=[],connections:Awaited<ReturnType<typeof connectTidb>>[]=[];
 const priorOperator=process.env.ADORE_OPERATOR_KEY;process.env.ADORE_OPERATOR_KEY=randomBytes(32).toString('hex');
 let created=false,server:ChildProcess|undefined,browser:Browser|undefined,context:BrowserContext|undefined,store:BlobReceiptStore|undefined,evidence:Record<string,unknown>|undefined,logs='';
 try{
  stage='schema';console.log(JSON.stringify({stage,syntheticOnly:true,realDataUntouched:true}));
  await owner.connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);created=true;
  const setup=await connectTidb({...sqlEnv,DB_DATABASE:database},'operator');connections.push(setup);
  const plan=buildTidbSchemaPlan();assert.equal(plan.fingerprint,tidbExpectedSchema.fingerprint);await installTidbSchema(setup.connection,plan);
  for(const profile of ['runtime','reporting'] as const){
   const account={name:String(sqlEnv.DB_USERNAME).split('.')[0]+'.'+(profile==='runtime'?'a_':'r_')+randomBytes(4).toString('hex'),password:randomBytes(32).toString('hex')};
   await setup.connection.query('CREATE USER ?@? IDENTIFIED BY ?',[account.name,'%',account.password]);accounts.push(account);
   for(const query of tidbGrantStatements(database,profile))await setup.connection.query(query,[account.name,'%']);
  }
  console.log(JSON.stringify({schemaInstalled:true,restrictedSqlAccountsPrepared:true}));
  const runtimeEnv={...sqlEnv,DB_DATABASE:database,DB_USERNAME:accounts[0].name,DB_PASSWORD:accounts[0].password,DB_REPORT_USERNAME:accounts[1].name,DB_REPORT_PASSWORD:accounts[1].password};
  store=new BlobReceiptStore(tidbStorageIdentity(tidbOptions(runtimeEnv,'application')),config);
  const operator=authenticateOperator(process.env.ADORE_OPERATOR_KEY!),email=randomUUID()+'@example.invalid',password=randomBytes(32).toString('hex');
  await createAccount(setup.connection,operator,{email,password,displayName:'Synthetic Cloud browser user',active:true});
  stage='server';
  const env:NodeJS.ProcessEnv={...process.env,...runtimeEnv,NODE_ENV:'production',FITIMI_TEST_BUILD:'cloud',VERCEL:'1',DATABASE_PROVIDER:'tidb',RECEIPT_STORAGE_PROVIDER:'vercel-blob',BLOB_STORE_ID:config.storeId,BLOB_READ_WRITE_TOKEN:config.token,AUTH_ORIGIN:origin,DEMO_MODE:'0',DEMO_PUBLIC_ORIGIN:'',NEXT_PUBLIC_DEMO_URL:'',FITIMI_LOCAL_DEVELOPMENT:'0',DATABASE_URL:'',DATABASE_DISPOSABLE:'',RECEIPT_BLOB_OWNER:store.owner,ADORE_OPERATOR_KEY:'',MFA_ENCRYPTION_KEY_ID:'cloud-http',MFA_ENCRYPTION_KEYS:JSON.stringify({'cloud-http':randomBytes(32).toString('base64')}),RECEIPT_COMPANY_NAME:'Synthetic Cloud verification',RECEIPT_NUMBER_PREFIX:'TEST',NEXT_TELEMETRY_DISABLED:'1'};
  server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port',String(port)],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});
  server.stdout?.on('data',data=>{logs=(logs+String(data)).slice(-60000);});server.stderr?.on('data',data=>{logs=(logs+String(data)).slice(-60000);});
  let ready=false;for(let i=0;i<90;i++){if(server.exitCode!==null)break;try{const response=await fetch(origin+'/administrata',{signal:AbortSignal.timeout(3000)});if(response.status===200){ready=true;break;}}catch{}await pause(500);}
  assert(ready,'Isolated production server did not become ready.');
  browser=await chromium.launch({channel:'msedge',headless:true});context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
  const page=await context.newPage(),errors:string[]=[],checks:string[]=[];page.setDefaultTimeout(60000);page.setDefaultNavigationTimeout(90000);
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(/hydration|didn.t match|same key|Encountered two children/i.test(message.text()))errors.push(message.text());});
  const check=(name:string)=>{checks.push(name);console.log('PASS: '+name);};
  const click=(name:RegExp)=>page.getByRole('button',{name}).click();
  const login=async()=>{await page.goto(origin+'/administrata');await page.locator('#email').fill(email);await page.locator('#password').fill(password);await click(/^Hyni$/);await page.waitForURL(/\/administrata\/mfa/);};
  const logout=async()=>{await page.locator('.workspace-profile>summary').click();await click(/^Dilni$/);await page.waitForURL(origin+'/administrata');assert.equal((await context!.request.get(origin+'/api/auth/session')).status(),401);};
  stage='activation_guards';
  await setup.connection.execute('UPDATE construction_schema_manifest SET plan_sha256=?',['0'.repeat(64)]);
  assert.equal((await context.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email,password}})).status(),503);
  await setup.connection.execute('UPDATE construction_schema_manifest SET plan_sha256=?',[plan.fingerprint]);
  await setup.connection.query(`GRANT INSERT ON \`${database}\`.construction_schema_manifest TO ?@?`,[accounts[0].name,'%']);
  assert.equal((await context.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{email,password}})).status(),503);
  await setup.connection.query(`REVOKE INSERT ON \`${database}\`.construction_schema_manifest FROM ?@?`,[accounts[0].name,'%']);
  check('Real HTTP login refuses a mismatched schema or widened runtime permissions');
  const anonymous=await browser.newContext();try{
   for(const path of ['/api/clients','/api/payments','/api/expenses','/api/receipts/'+randomUUID()+'/versions/1/pdf'])assert.equal((await anonymous.request.get(origin+path)).status(),401);
   const privatePage=await anonymous.request.get(origin+'/app',{maxRedirects:0});assert.equal(privatePage.status(),307);
  }finally{await anonymous.close();}check('Anonymous private pages and business/PDF APIs deny access');
  stage='mfa_enrollment';
  await page.goto(origin+'/administrata');await page.locator('#email').fill(email);await page.locator('#password').fill('synthetic-wrong-password');await click(/^Hyni$/);await page.getByRole('alert').waitFor();
  await login();assert.equal((await context.request.get(origin+'/api/clients')).status(),401);
  const pending=(await context.cookies()).find(cookie=>cookie.name==='__Host-fitimi_pre_auth');assert(pending?.httpOnly&&pending.secure&&pending.sameSite==='Strict');
  await click(/^Shfaqni konfigurimin e autentikimit$/);const seed=(await page.getByTestId('mfa-manual-key').innerText()).trim();assert.match(seed,/^[A-Z2-7]{32}$/);
  await page.locator('#mfa-code').fill(authenticator(seed).generate());await click(/^Verifikoni konfigurimin e autentikimit$/);
  await page.getByTestId('mfa-recovery-code').first().waitFor();const codes=await page.getByTestId('mfa-recovery-code').allTextContents();assert.equal(codes.length,16);
  await page.getByRole('checkbox').check();await click(/^P.rfundoni hyrjen e sigurt$/);await page.waitForURL(origin+'/app');
  const session=(await context.cookies()).find(cookie=>cookie.name==='__Host-fitimi_session');assert(session?.secure&&session.httpOnly&&session.sameSite==='Lax');
  check('Real password, TOTP enrollment and one-time recovery acknowledgement create a secure session');
  stage='mfa_login_recovery';await logout();await login();await page.locator('#mfa-code').fill(authenticator(seed).generate({timestamp:Date.now()+30000}));await click(/^Verifikoni dhe hyni$/);await page.waitForURL(origin+'/app');await logout();
  await login();await click(/^P.rdorni nj. kod rikuperimi$/);await page.locator('#mfa-code').fill(codes[0]);await click(/^P.rdorni kodin e rikuperimit$/);await page.waitForURL(origin+'/app');await logout();
  await login();await click(/^P.rdorni nj. kod rikuperimi$/);await page.locator('#mfa-code').fill(codes[0]);await click(/^P.rdorni kodin e rikuperimit$/);await page.getByRole('alert').waitFor();assert.equal((await context.request.get(origin+'/api/auth/session')).status(),401);
  await page.locator('#mfa-code').fill(codes[1]);await click(/^P.rdorni kodin e rikuperimit$/);await page.waitForURL(origin+'/app');
  check('Real TOTP login and recovery work; a reused recovery code is rejected');
  stage='passkey_registration';
  const protocol=await context.newCDPSession(page);await protocol.send('WebAuthn.enable');await protocol.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  await page.goto(origin+'/app/security');await page.getByLabel(/Emri q. do ta dalloni/).fill('Synthetic Cloud device');await click(/^Aktivizo hyrjen me pajisje$/);await page.getByText('Hyrja e shpejt\u00eb u aktivizua.',{exact:false}).waitFor();
  const keyList=await context.request.get(origin+'/api/auth/passkeys');assert.equal(keyList.status(),200);assert.equal((await keyList.json()).keys.length,1);
  check('Real browser WebAuthn registration persists a verified resident credential in TiDB');
  assert.equal((await context.request.post(origin+'/api/clients',{headers:{Origin:'https://attacker.invalid'},data:{}})).status(),403);check('Authenticated mutations reject foreign origins');
  stage='business_browser';
  let business:Awaited<ReturnType<typeof import('./cloud-business-browser')['verifyCloudBusiness']>>|undefined;
  for(let attempt=0;attempt<3;attempt++){
   try{
    const {verifyCloudBusiness}=await import('./cloud-business-browser.ts?attempt='+attempt);
    business=await verifyCloudBusiness(page,origin,root,errors);break;
   }catch(error){
    const diagnostic={attempt,location:error instanceof Error?error.stack?.match(/cloud-business-browser\.ts:\d+:\d+/g):undefined,message:error instanceof Error?error.message.slice(0,250).replace(/[a-z0-9._%+-]+@[a-z0-9.-]+/gi,'[redacted-email]'):'unknown'};
    writeFileSync(root+'/business-retry.json',JSON.stringify(diagnostic,null,2));
    if(attempt===2)throw error;
    console.log(JSON.stringify({browserTestNeedsReview:true,diagnostic:root+'/business-retry.json',retrySignal:root+'/retry'}));
    let retry=false;for(let i=0;i<240;i++){if(existsSync(root+'/retry')){const {unlinkSync}=await import('node:fs');unlinkSync(root+'/retry');retry=true;break;}await pause(1000);}
    if(!retry)throw error;
    if((await context.request.get(origin+'/api/auth/session')).status()!==200){await login();await click(/^P.rdorni nj. kod rikuperimi$/);await page.locator('#mfa-code').fill(codes[2+attempt]);await click(/^P.rdorni kodin e rikuperimit$/);await page.waitForURL(origin+'/app');}
   }
  }
  assert(business);
  stage='passkey_login';await click(/^Hyr shpejt$/);await page.waitForURL(origin+'/app');assert.equal((await context.request.get(origin+'/api/auth/session')).status(),200);check('One-click real browser passkey login uses the Cloud authentication generation');
  stage='private_blob';
  // Never reuse an operator or probe connection kept idle throughout browser ceremonies.
  const inspection=await connectTidb(runtimeEnv,'application');
  try{
   const [versions]=await inspection.connection.query<RowDataPacket[]>('SELECT storage_reference,file_checksum FROM receipt_versions');assert(versions.length>=3);
   for(const row of versions){
    assert(String(row.storage_reference).startsWith('r/'+store.owner+'/'));
    const url=`https://${config.storeId.slice(6).toLowerCase()}.private.blob.vercel-storage.com/${row.storage_reference}`;
    const denied=await fetch(url,{redirect:'manual',cache:'no-store',signal:AbortSignal.timeout(15000)});
    try{assert([401,403,404].includes(denied.status));}finally{await denied.body?.cancel();}
   }
  }finally{await inspection.close();}
  check('Every generated PDF is in this Cloud owner and rejects anonymous Blob downloads');
  stage='revocation';
  const revoker=await connectTidb({...sqlEnv,DB_DATABASE:database},'operator');
  try{await revokeAccountSessions(revoker.connection,operator,email);}finally{await revoker.close();}
  assert.equal((await context.request.get(origin+'/api/auth/session')).status(),401);assert.equal((await context.request.get(origin+'/api/clients')).status(),401);
  check('Operator generation advancement immediately revokes a live HTTP passkey session');
  assert.deepEqual(errors,[]);assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'),mainHash);
  evidence={...business,checks,schemaFingerprint:plan.fingerprint,browser:browser.version(),virtualAuthenticator:true,physicalPinOrBiometricVerified:false,productionBuild:true,realCloudDatabase:true,realPrivateBlob:true,realHttpAndBrowser:true,vercelDeployment:false,mainEnvironmentUnchanged:true,syntheticOnly:true,realDataMigrated:false};
 }catch(error){
  const sqlCodes=[...new Set(logs.match(/ER_[A-Z_]+/g)??[])];
  if(error instanceof Error&&/closed state|closed connection|connection.*closed/i.test(error.message))sqlCodes.push('TEST_CONNECTION_IDLE_CLOSED');
  writeFileSync(root+'/failure.json',JSON.stringify({stage,type:error instanceof Error?error.name:'unknown',location:error instanceof Error?error.stack?.match(/(?:verify-cloud-http|cloud-business-browser)\.ts:\d+:\d+/g):undefined,sqlCodes,credentialsWithheld:true},null,2));
  console.error(JSON.stringify({failedStage:stage,errorType:error instanceof Error?error.name:'unknown',sqlCodes,diagnostic:root+'/failure.json',credentialsWithheld:true}));throw new Error('Cloud browser verification failed; safe diagnostics retained.');
 }finally{
  if(priorOperator===undefined)delete process.env.ADORE_OPERATOR_KEY;else process.env.ADORE_OPERATOR_KEY=priorOperator;
  await context?.close().catch(()=>{});await browser?.close().catch(()=>{});
  if(server&&server.exitCode===null){const stopped=new Promise<void>(resolve=>server!.once('exit',()=>resolve()));server.kill();await stopped;}
  try{
   if(store)for(const prefix of [`r/${store.owner}/`,`receipt-journals/${store.owner}/`,`receipt-stores/${store.owner}/`]){
    const options:{token:string;storeId:string}={token:config.token,storeId:config.storeId};const page=await list({...options,prefix,limit:100,abortSignal:AbortSignal.timeout(30000)});assert(!page.hasMore);
    for(const blob of page.blobs){assert(blob.pathname.startsWith(prefix)&&!blob.pathname.includes('..'));await del(blob.pathname,{...options,ifMatch:blob.etag,abortSignal:AbortSignal.timeout(30000)});}
    assert.equal((await list({...options,prefix,limit:1,abortSignal:AbortSignal.timeout(30000)})).blobs.length,0);
   }
  }finally{
   await Promise.allSettled(connections.map(connection=>connection.close()));
   // A fresh, short-lived operator connection also makes failed-run disposal reliable.
   const disposer=await connectTidb(sqlEnv,'operator');
   try{
    const dropped=await Promise.allSettled(accounts.map(account=>disposer.connection.query('DROP USER ?@?',[account.name,'%'])));
    assert(dropped.every(row=>row.status==='fulfilled'));
   }finally{
    try{assert.match(database,/^construction_http_probe_[a-f0-9]{12}$/);if(created)await disposer.connection.query(`DROP DATABASE \`${database}\``);}
    finally{await disposer.close();await owner.close().catch(()=>{});}
   }
  }
 }
 assert(evidence);writeFileSync('docs/cloud-http-verification.json',JSON.stringify({...evidence,temporaryResourcesRemoved:true},null,2)+'\n');console.log(JSON.stringify({cloudHttpBrowserPassed:true,temporaryResourcesRemoved:true,mainEnvironmentUnchanged:true}));
}
void main().catch(()=>{process.exitCode=1;});
