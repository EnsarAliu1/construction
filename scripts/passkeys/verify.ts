import {verifyWorkspace} from './workspace-browser';
import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
import type {RowDataPacket} from 'mysql2/promise';
import {localDatabaseOptions,openLocalConnection} from '../../src/server/db/config';
import {applyMigrations} from '../../src/server/db/migrate';
import {createAccount,revokeAccountSessions} from '../../src/server/auth/accounts';
import {authenticateOperator} from '../../src/server/auth/operator';
import {authenticator} from '../../src/server/auth/mfa-crypto';
import {tokenDigest} from '../../src/server/auth/security';
import {sessionUser} from '../../src/server/auth/sessions';

async function main(){
const options=localDatabaseOptions(process.env.TEST_DATABASE_URL,'test',process.env.DATABASE_DISPOSABLE);
assert(/^fitimi_test_passkeys_[0-9a-f]{8}$/.test(String(options.database)));assert.equal(options.port,3307);assert.equal(process.env.AUTH_ORIGIN,'http://localhost:3000');
const c=await openLocalConnection(options),root='artifacts/passkeys',origin='http://localhost:3000';
const operator=authenticateOperator(process.env.ADORE_OPERATOR_KEY!);
try{
 if(process.argv[2]==='prepare'){
  await applyMigrations(c);const email=`${randomUUID()}@example.invalid`,password=randomBytes(24).toString('base64url'),id=await createAccount(c,operator,{email,password,displayName:'Përdorues provues passkey',active:true});
  await writeFile(`${root}/browser-fixture.json`,JSON.stringify({id,email,password,database:options.database}),{mode:0o600});
  const [triggers]=await c.query<RowDataPacket[]>('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()');assert.equal(triggers.length,13);console.log('Fresh synthetic schema migrated; original 13 integrity triggers preserved.');
 }else{
  const fixture=JSON.parse(await readFile(`${root}/browser-fixture.json`,'utf8'));assert.equal(fixture.database,options.database);
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'}),page=await context.newPage(),errors:string[]=[],scenarios:string[]=[];
  page.setDefaultNavigationTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(/same key|hydration|didn.t match|Encountered two children/i.test(message.text()))errors.push(message.text());});
  const protocol=await context.newCDPSession(page);await protocol.send('WebAuthn.enable');
  const virtual=await protocol.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
  const check=(name:string)=>{scenarios.push(name);console.log(`PASS: ${name}`);};
  const post=(data:unknown,headers:Record<string,string>={})=>context.request.post(origin+'/api/auth/passkeys',{data,headers:{Origin:origin,...headers}});
  const newOptions=async()=>{const r=await post({action:'authentication-options'});assert.equal(r.status(),200);return (await r.json()).options;};
  const assertion=(value:unknown,uv?:'discouraged')=>page.evaluate(async({value,uv})=>{const options=PublicKeyCredential.parseRequestOptionsFromJSON(value as PublicKeyCredentialRequestOptionsJSON);if(uv)options.userVerification=uv;const credential=await navigator.credentials.get({publicKey:options});return (credential as PublicKeyCredential).toJSON();},{value,uv});
  const expireLimits=()=>c.query('UPDATE auth_login_limits SET window_ends_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)');
  async function pending(){const cookie=(await context.cookies()).find(x=>x.name==='fitimi_passkey');assert(cookie?.httpOnly&&cookie.sameSite==='Strict');return cookie;}
  let bootstrap:Awaited<ReturnType<typeof context.cookies>>[number];
  try{
   await page.goto(origin+'/administrata');await page.locator('#email').fill(fixture.email);await page.locator('#password').fill(fixture.password);await page.getByRole('button',{name:'Hyni',exact:true}).click();await page.waitForURL(/\/administrata\/mfa/);
   if(process.env.FITIMI_WORKSPACE_CHECK==='1'){const blocked=await context.request.get(origin+'/app/history',{maxRedirects:0});assert.equal(blocked.status(),307);assert.equal(new URL(blocked.headers().location,origin).pathname,'/administrata');}
   await page.getByRole('button',{name:'Shfaqni konfigurimin e autentikimit',exact:true}).click();const seed=(await page.getByTestId('mfa-manual-key').innerText()).trim();
   await page.locator('#mfa-code').fill(authenticator(seed).generate());await page.getByRole('button',{name:'Verifikoni konfigurimin e autentikimit',exact:true}).click();await page.getByTestId('mfa-recovery-code').first().waitFor();
   await page.getByRole('checkbox').check();await page.getByRole('button',{name:'Përfundoni hyrjen e sigurt',exact:true}).click();await page.waitForURL(origin+'/app');
   bootstrap=(await context.cookies()).find(x=>x.name==='fitimi_session')!;assert(bootstrap?.httpOnly);check('Real password → TOTP enrollment → recovery acknowledgement → full session');

   await page.goto(origin+'/app/security');await page.getByLabel('Emri që do ta dalloni').fill('Telefoni provues');await page.getByRole('button',{name:'Aktivizo hyrjen me pajisje',exact:true}).click();await page.getByText('Hyrja e shpejtë u aktivizua.',{exact:false}).waitFor();
   let listed=await (await context.request.get(origin+'/api/auth/passkeys')).json();assert.equal(listed.keys.length,1);const keyId=listed.keys[0].id;await page.screenshot({path:`${root}/settings-desktop.png`,fullPage:true,caret:'initial'});
   const [stored]=await c.query<RowDataPacket[]>('SELECT credential_id,public_key,user_auth_version FROM auth_passkeys');assert.equal(stored.length,1);assert(stored[0].public_key.length>30);check('Real platform passkey registration with resident key and required device user verification');
   if(process.env.FITIMI_WORKSPACE_CHECK==='1'){try{await verifyWorkspace(page,origin);}catch(error){await page.screenshot({path:'artifacts/workspace/failure.png',fullPage:true});await writeFile('artifacts/workspace/failure.txt',String(error));throw error;}}
   await context.clearCookies();await newOptions();assert.equal((await context.request.get(origin+'/api/auth/session')).status(),401);assert.equal((await context.request.get(origin+'/api/clients')).status(),401);assert.equal((await context.request.get(origin+'/api/auth/passkeys')).status(),401);assert.equal((await post({action:'registration-options'})).status(),401);await pending();check('Pre-passkey challenge is HttpOnly and cannot access private APIs or key management');
   assert.equal((await post({action:'authentication-options'},{Origin:'https://attacker.invalid'})).status(),403);check('Cross-origin ceremony requests rejected');
   await page.goto(origin+'/administrata');await page.getByRole('button',{name:'Hyr shpejt',exact:true}).click();await page.waitForURL(origin+'/app');await page.getByRole('status').filter({hasText:'Mirë se erdhët në Construction.'}).waitFor();
   const fastCookie=(await context.cookies()).find(x=>x.name==='fitimi_session')!;assert(await sessionUser(c,fastCookie.value));assert.notEqual(fastCookie.value,bootstrap.value);check('One-click real discoverable passkey login without email/password; fresh session and welcome toast');
   await page.locator('.workspace-profile>summary').click();await page.getByRole('button',{name:'Dilni',exact:true}).click();await page.waitForURL(origin+'/administrata');assert.equal(await sessionUser(c,fastCookie.value),null);check('Logout revokes the passkey session');
   await expireLimits();const cross=await assertion(await newOptions());await newOptions();assert.equal((await post({action:'authenticate',response:cross})).status(),401);check('Wrong/new challenge cannot authenticate an older assertion');
   const noUVOptions=await newOptions();await protocol.send('WebAuthn.setUserVerified',{authenticatorId:virtual.authenticatorId,isUserVerified:false});const noUV=await assertion(noUVOptions,'discouraged');await protocol.send('WebAuthn.setUserVerified',{authenticatorId:virtual.authenticatorId,isUserVerified:true});assert.equal((await post({action:'authenticate',response:noUV})).status(),401);check('Valid device signature without user verification rejected');
   const tampered=await assertion(await newOptions()) as {response:{signature:string}};tampered.response.signature=Buffer.alloc(70).toString('base64url');assert.equal((await post({action:'authenticate',response:tampered})).status(),401);check('Invalid cryptographic signature rejected');
   const expired=await assertion(await newOptions()),expiredCookie=await pending();await c.execute('UPDATE auth_passkey_challenges SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=?',[tokenDigest(expiredCookie.value)]);assert.equal((await post({action:'authenticate',response:expired})).status(),401);check('Expired server-side challenge rejected');
   await expireLimits();const attempts=await assertion(await newOptions()) as {response:{signature:string}};attempts.response.signature=Buffer.alloc(70).toString('base64url');const attemptsCookie=await pending();for(let i=0;i<6;i++)assert.equal((await post({action:'authenticate',response:attempts})).status(),401);const [bounded]=await c.execute<RowDataPacket[]>('SELECT attempts FROM auth_passkey_challenges WHERE token_hash=?',[tokenDigest(attemptsCookie.value)]);assert.equal(bounded[0].attempts,5);check('Per-challenge verification stops after five failures');
   await expireLimits();for(let i=0;i<11;i++){await newOptions();const r=await post({action:'authenticate',response:attempts});assert.equal(r.status(),i===10?429:401);}check('Persisted per-credential rate limits survive requests for new challenges');
   await expireLimits();const replay=await assertion(await newOptions()),oldCookie=await pending();const before=await c.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM auth_sessions WHERE passkey_id IS NOT NULL');
   const pair=await Promise.all([post({action:'authenticate',response:replay}),post({action:'authenticate',response:replay})]);assert.deepEqual(pair.map(r=>r.status()).sort(),[200,401]);const [after]=await c.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM auth_sessions WHERE passkey_id IS NOT NULL');assert.equal(Number(after[0].n),Number(before[0][0].n)+1);
   assert.equal((await post({action:'authenticate',response:replay},{Cookie:`fitimi_passkey=${oldCookie.value}`})).status(),401);check('Concurrent double submit has exactly one winner; consumed challenge replay denied');
   const inUse=(await context.cookies()).find(x=>x.name==='fitimi_session')!;
   const disabled=await assertion(await newOptions());await c.execute("UPDATE users SET status='inactive' WHERE id=?",[fixture.id]);assert.equal((await post({action:'authenticate',response:disabled})).status(),401);assert.equal(await sessionUser(c,inUse.value),null);await c.execute("UPDATE users SET status='active' WHERE id=?",[fixture.id]);check('Disabled accounts cannot finish a pending assertion or use existing sessions');
   await c.execute('UPDATE auth_mfa_factors SET restore_hold=1 WHERE user_id=?',[fixture.id]);assert.equal(await sessionUser(c,inUse.value),null);const held=await assertion(await newOptions());assert.equal((await post({action:'authenticate',response:held})).status(),401);await c.execute('UPDATE auth_mfa_factors SET restore_hold=0 WHERE user_id=?',[fixture.id]);check('Restore security hold blocks passkey login and existing passkey sessions');
   await context.addCookies([bootstrap]);await c.execute('UPDATE auth_sessions SET mfa_verified_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 6 MINUTE) WHERE token_hash=?',[tokenDigest(bootstrap.value)]);const stale=await post({action:'registration-options'});assert.equal(stale.status(),401);assert.equal((await stale.json()).reauthenticate,true);await c.execute('UPDATE auth_sessions SET mfa_verified_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[tokenDigest(bootstrap.value)]);check('An old session alone cannot enroll another device');
   const registration=await post({action:'registration-options'});assert.equal(registration.status(),200);const creation=(await registration.json()).options;
   // A different device is required: the original device must reject its already-enrolled credential.
   const savedDevice=await protocol.send('WebAuthn.getCredentials',{authenticatorId:virtual.authenticatorId});
   await protocol.send('WebAuthn.removeVirtualAuthenticator',{authenticatorId:virtual.authenticatorId});
   const otherDevice=await protocol.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});
   const wrongSessionResponse=await page.evaluate(async(value)=>{const publicKey=PublicKeyCredential.parseCreationOptionsFromJSON(value);return (await navigator.credentials.create({publicKey}) as PublicKeyCredential).toJSON();},creation);
   await protocol.send('WebAuthn.removeVirtualAuthenticator',{authenticatorId:otherDevice.authenticatorId});
   const restoredDevice=await protocol.send('WebAuthn.addVirtualAuthenticator',{options:{protocol:'ctap2',transport:'internal',hasResidentKey:true,hasUserVerification:true,isUserVerified:true,automaticPresenceSimulation:true}});virtual.authenticatorId=restoredDevice.authenticatorId;
   for(const credential of savedDevice.credentials)await protocol.send('WebAuthn.addCredential',{authenticatorId:virtual.authenticatorId,credential});
   await context.addCookies([inUse]);assert.equal((await post({action:'register',label:'Wrong session',response:wrongSessionResponse})).status(),401);await context.addCookies([bootstrap]);check('A registration challenge cannot move between authenticated sessions');
   await page.goto(origin+'/app/security');await page.setViewportSize({width:390,height:1000});await page.getByRole('button',{name:'Hiq passkey: Telefoni provues',exact:true}).waitFor();assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:`${root}/settings-mobile.png`,fullPage:true,caret:'initial'});
   await page.getByRole('button',{name:'Hiq passkey: Telefoni provues',exact:true}).click();await page.getByRole('button',{name:'Po, hiqe',exact:true}).click();await page.getByText('Passkey u hoq dhe hyrjet e lidhura me të u mbyllën.',{exact:true}).waitFor();assert.equal(await sessionUser(c,inUse.value),null);listed=await (await context.request.get(origin+'/api/auth/passkeys')).json();assert.equal(listed.keys.length,0);check('Settings removal is explicit, responsive and revokes linked sessions immediately');
   // Restore only the synthetic key to test operator-version invalidation independently of removal.
   await c.execute('UPDATE auth_passkeys SET revoked_at=NULL WHERE id=?',[keyId]);await context.clearCookies();const revoked=await assertion(await newOptions());await revokeAccountSessions(c,operator,fixture.email);assert.equal((await post({action:'authenticate',response:revoked})).status(),401);check('Operator revocation during a pending assertion invalidates the credential version');
   assert.equal(errors.length,0,'Browser runtime errors were observed');
   await writeFile(`${root}/evidence.json`,JSON.stringify({browser:browser.version(),scenarios,syntheticDatabase:options.database,ownerDataTouched:false,physicalPinPrompt:'NOT VERIFIED: virtual CTAP2 authenticator used; physical device/OS selects PIN or biometric',newDependencies:{server:'14.0.3',browser:'14.0.0'}},null,2));
   console.log(`${scenarios.length} genuine Edge/MySQL passkey scenarios passed. No physical PIN/biometric claim.`);
  }finally{await browser.close();}
 }
}finally{await c.end();}

}
main().catch(error=>{console.error(error instanceof assert.AssertionError?error.message:`Passkey verification failed (${error?.code??error?.name??"unknown"}); details withheld.`);console.error(error?.stack?.split("\n").slice(1,4).join("\n"));process.exitCode=1;});
