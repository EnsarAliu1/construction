import {finishFixtureBrowserLogin} from '../../tests/auth/mfa-browser-fixture';
import assert from "node:assert/strict";
import {writeFile,mkdir} from "node:fs/promises";
import {chromium} from "@playwright/test";
import {randomUUID} from "node:crypto";
import {clientFixture} from "../../tests/clients/fixture";
import {createClient} from "../../src/features/clients/service";
import {setAccountActive} from "../../src/server/auth/accounts";
import {localDatabaseOptions} from "../../src/server/db/config";
import {tokenDigest} from "../../src/server/auth/security";

async function main(){
 const wp16=process.env.AUTH_TEST_WORK_PACKAGE==='WP-16';const wp15=process.env.AUTH_TEST_WORK_PACKAGE==='WP-15',evidence=wp16?'artifacts/wp16':wp15?'artifacts/wp15':'artifacts/wp14';
 const options=localDatabaseOptions(process.env.TEST_DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE);
 assert.equal(options.database,process.env.AUTH_LOCALIZATION_TEST==='1'?'fitimi_test_sq':(wp16?"fitimi_test_wp16":wp15?"fitimi_test_wp15":"fitimi_test_wp14"));assert.equal(options.port,3307);assert.equal(process.env.AUTH_ORIGIN,"http://127.0.0.1:3000");
 const f=await clientFixture(),browser=await chromium.launch({channel:"msedge",headless:true}),origin=process.env.AUTH_ORIGIN;
 const results:string[]=[],errors:string[]=[],canary=`PRIVATE-BROWSER-${randomUUID()}`,payload=`${canary}<img src=x onerror="window.__storedXSS=1">`;
 try{
  const client=await createClient(f.connection,f.token,f.input({name:payload}));
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route("**/*",route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
  const page=await context.newPage();let expectedViolations=false;
  page.on("pageerror",error=>errors.push(error.message));page.on("console",message=>{if(message.type()==="error"&&!expectedViolations)errors.push(message.text());});
  const signIn=async()=>{await page.goto(`${origin}/login`);await page.locator('#email').fill(f.email);await page.locator('#password').fill(f.password);await page.getByRole('button',{name:"Hyni",exact:true}).click();await finishFixtureBrowserLogin(page,f.connection,f.userId);await page.waitForURL(`${origin}/app`);await page.locator('h1').waitFor();};
  await signIn();
  const cookies=await context.cookies(),session=cookies.find(c=>c.name==='__Host-fitimi_session');assert(session);assert(session.httpOnly&&session.secure&&session.sameSite==='Lax'&&session.path==='/');assert.equal(session.domain,'127.0.0.1');assert.equal((await context.request.get(`${origin}/api/auth/session`)).status(),200);results.push('Actual login form, host-only Secure/HttpOnly/SameSite cookie and cookie-authenticated API');
  await page.goto(`${origin}/app/clients/${client.id}`);assert((await page.locator('h1').innerText()).includes(payload));assert.equal(await page.locator('img[onerror]').count(),0);assert.equal(await page.evaluate(()=>('__storedXSS'in window)),false);results.push('Stored HTML/event payload rendered as text; no execution');
  await page.goto(`${origin}/app/clients?q=${encodeURIComponent(payload)}`);assert.equal(await page.locator('img[onerror]').count(),0);assert.equal(await page.evaluate(()=>('__storedXSS'in window)),false);results.push('Reflected search payload remains escaped');
  assert.deepEqual(errors,[]);expectedViolations=true;
  await page.addInitScript(()=>{Object.assign(window,{__violations:[]});document.addEventListener('securitypolicyviolation',e=>(window as unknown as {__violations:string[]}).__violations.push(e.violatedDirective));});
  const injectionUrl=`${origin}/app/clients/${client.id}?csp=probe`;
  await page.route(injectionUrl,async route=>{const response=await route.fetch();const html=await response.text();await route.fulfill({response,body:html.replace('</body>','<script>window.__injectedXSS=1</script></body>')});});
  await page.goto(injectionUrl,{waitUntil:'networkidle'});
  await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>('__injectedXSS'in window)),false);assert((await page.evaluate(()=>(window as unknown as {__violations:string[]}).__violations)).some(s=>s.startsWith('script-src')));results.push('Enforced private nonce CSP blocks untrusted inline script while React hydrates');
  await page.route(`${origin}/security-frame-test`,route=>route.fulfill({contentType:'text/html',body:'<!doctype html><iframe src="/app" title="Security test"></iframe>'}));await page.goto(`${origin}/security-frame-test`);await page.waitForTimeout(300);
  const exposed=await page.evaluate(()=>{try{return document.querySelector('iframe')?.contentDocument?.body.innerText??'';}catch{return '';}});assert(!exposed.includes("Përmbledhja"));results.push('Real browser frame embedding denied');
  expectedViolations=false;await page.goto(`${origin}/app`);await page.getByRole('button',{name:"Dilni",exact:true}).click();await page.waitForURL(`${origin}/login`);assert.equal((await context.request.get(`${origin}/api/auth/session`)).status(),401);results.push('Actual logout Server Action invalidates cookie/session');
  await signIn();const current=(await context.cookies()).find(c=>c.name==='__Host-fitimi_session')!;
  await f.connection.execute('UPDATE auth_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=?',[tokenDigest(current.value)]);await page.goto(`${origin}/app/clients`);assert(new URL(page.url()).pathname==='/login');results.push('Expired real cookie redirects and cannot retrieve private data');
  await signIn();await setAccountActive(f.connection,f.operator,f.email,false);assert.equal((await context.request.get(`${origin}/api/clients`)).status(),401);await page.goto(`${origin}/app`);assert(new URL(page.url()).pathname==='/login');results.push('Account deactivation invalidates actual browser session');
  await page.goBack();assert(!(await page.locator('body').innerText()).includes(canary));results.push('Back navigation after deactivation exposes no canary');
  await mkdir(evidence,{recursive:true});await page.screenshot({path:`${evidence}/security-browser-login.png`,fullPage:true});await context.close();
  await writeFile(`${evidence}/security-browser.json`,JSON.stringify({browser:browser.version(),viewport:'1440x1000',results,unexpectedErrors:errors},null,2));console.log(`PASS: ${results.length} genuine cookie/browser security scenarios; ${browser.version()}.`);
 }catch(error){let message=error instanceof Error?error.stack??error.message:String(error);for(const secret of [f.email,f.password,f.token])message=message.replaceAll(secret,"[redacted]");await writeFile(`${evidence}/security-browser-failure.txt`,message);throw error;}finally{await browser.close();await f.close();}
}
void main().catch(()=>{console.error('Browser security verification failed; sensitive fixture details withheld.');process.exitCode=1;});
