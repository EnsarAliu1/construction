import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {createServer} from 'node:net';
import {setTimeout as pause} from 'node:timers/promises';
import {mkdir} from 'node:fs/promises';
import {chromium} from '@playwright/test';

async function main(){
 const probe=createServer();await new Promise<void>((yes,no)=>{probe.once('error',no);probe.listen(3000,'127.0.0.1',()=>probe.close(()=>yes()));});
 const require=createRequire(resolve('package.json'));
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3000'],{windowsHide:true,stdio:'ignore',env:{...process.env,DEMO_MODE:'',DEMO_ORIGIN:'http://localhost:3001',AUTH_ORIGIN:'http://localhost:3000',FITIMI_TEST_BUILD:'demo-entry',DATABASE_URL:'',ADORE_OPERATOR_KEY:'',MFA_ENCRYPTION_KEYS:''}});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  let ready=false;for(let i=0;i<60;i++){try{const r=await fetch('http://localhost:3000/administrata');if(r.ok){ready=true;break;}}catch{}await pause(1000);}assert(ready);
  const context=await browser.newContext(),page=await context.newPage(),errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error'&&/hydrat/i.test(message.text()))errors.push(message.text());});
  page.on('response',response=>{const url=new URL(response.url());if(['/demo','/api/demo/start'].includes(url.pathname))console.log(`Demo navigation: ${url.origin}${url.pathname} ${response.status()}`);});
  const publicPage=await context.newPage();await publicPage.goto('http://localhost:3000/sq');
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   await publicPage.setViewportSize(viewport);assert(await publicPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await publicPage.locator('.hero-reference-actions a[href="/demo"]').waitFor({state:'visible'});
  }
  await publicPage.locator('.hero-reference-actions').evaluate(async element=>{await Promise.all(element.getAnimations().map(animation=>animation.finished.catch(()=>{})));});
  await publicPage.screenshot({path:'artifacts/demo/website-mobile.png',fullPage:false,caret:'initial'});
  const entry=await context.request.get('http://localhost:3000/demo',{maxRedirects:0});assert.equal(entry.status(),200);assert.equal(entry.headers().location,undefined);assert.match(entry.headers()['cache-control'],/no-store/);
  await page.goto('http://localhost:3000/administrata');
  assert.equal((await context.request.post('http://localhost:3000/api/demo/start',{headers:{Origin:'http://localhost:3000'},data:{}})).status(),404);
  assert.equal((await context.request.get('http://localhost:3000/api/clients')).status(),401);
  for(const viewport of [{width:1440,height:900},{width:390,height:844}]){
   await page.setViewportSize(viewport);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   assert(await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2),'Login should fit the viewport');
  }
  await mkdir('artifacts/demo',{recursive:true});await page.screenshot({path:'artifacts/demo/login-mobile.png',fullPage:true,caret:'initial'});
  await publicPage.close();await page.goto('http://localhost:3000/sq');
  let readinessChecks=0;
  await context.route('http://localhost:3000/api/demo/status',async route=>{
   readinessChecks++;
   if(readinessChecks<=2){assert.equal(new URL(page.url()).origin,'http://localhost:3000');await route.fulfill({json:{ready:false}});return;}
   await route.continue();
  });
  await page.locator('.hero-reference-actions a[href="/demo"]').click();
  await page.getByRole('status').filter({hasText:'Po përgatitim aplikacionin demo'}).waitFor();
  try{await page.waitForURL('http://localhost:3001/app',{timeout:135000});}catch{await page.screenshot({path:'artifacts/demo/entry-failure.png',fullPage:true,caret:'initial'});throw new Error(`Demo navigation stopped at ${new URL(page.url()).origin}${new URL(page.url()).pathname}`);}await page.locator('.demo-banner').waitFor();
  assert.equal((await context.request.get('http://localhost:3000/api/clients')).status(),401);
  assert.deepEqual(errors,[]);
  assert(readinessChecks>=3,'The entry must wait for readiness before leaving the website');
  await context.request.post('http://localhost:3001/api/auth/logout',{headers:{Origin:'http://localhost:3001'},data:{}});
  console.log('PASS: Website waits safely while demo starts, then opens the isolated app; desktop/mobile fit; no hydration errors; real APIs deny demo cookies; entry is no-store.');
 }finally{
  await browser.close();
  if(child.pid){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});else child.kill();}
 }
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Entry verification failed');process.exitCode=1;});
