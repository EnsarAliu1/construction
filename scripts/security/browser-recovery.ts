import assert from "node:assert/strict";
import {writeFile} from "node:fs/promises";
import {chromium,type Page} from "@playwright/test";
import type {RowDataPacket} from "mysql2/promise";
import {projectFixture} from "../../tests/projects/fixtures";
import {localDatabaseOptions} from "../../src/server/db/config";

async function main(){
 const baseline=process.argv[2]==='baseline',o=localDatabaseOptions(process.env.TEST_DATABASE_URL,'test',process.env.DATABASE_DISPOSABLE);assert.equal(o.database,'fitimi_test_wp14');assert.equal(o.port,3307);assert.equal(process.env.AUTH_ORIGIN,'http://127.0.0.1:3000');
 const f=await projectFixture(),browser=await chromium.launch({channel:'msedge',headless:true}),origin=process.env.AUTH_ORIGIN,results:string[]=[];
 try{
  const context=await browser.newContext(),page=await context.newPage();await page.goto(`${origin}/login`);await page.locator('#email').fill(f.email);await page.locator('#password').fill(f.password);await page.getByRole('button',{name:'Sign in',exact:true}).click();await page.waitForURL(`${origin}/app`);
  const fill=async(p:Page,name:string)=>{await p.locator('#expense-project').fill(name);await p.locator('#expense-project').press('Enter');await p.locator('ul[aria-label="Project search results"] button').first().click();await p.getByRole('button',{name:'Load project phases',exact:true}).click();await p.locator('[id^="payment-allocation-"]').first().waitFor();await p.locator('#payment-amount').fill('13.37');await p.locator('#payment-transactionDate').fill('2024-02-29');await p.locator('[id^="payment-allocation-"]').first().fill('13.37');};
  for(const committed of baseline?[false]:[false,true]){
   const d=await f.fresh({name:`Synthetic WP14 recovery ${committed?'committed':'uncommitted'}`});await page.goto(`${origin}/app/payments/new`);await fill(page,d.project.name);
   await page.route(`${origin}/api/payments`,async route=>{if(route.request().method()==='POST'){if(committed)await route.fetch();await route.abort('failed');}else await route.continue();});
   await page.getByRole('button',{name:'Confirm payment & issue receipt',exact:true}).click();await page.waitForFunction(()=>Object.keys(sessionStorage).some(k=>k.startsWith('fitimi.payment.pending.')));await page.getByRole('button',{name:'Confirm payment & issue receipt',exact:true}).waitFor({state:'visible'});await page.waitForFunction(()=>!(document.querySelector('button[value="confirm"]') as HTMLButtonElement)?.disabled);
   const key=`fitimi.payment.pending.${f.userId}`,pending=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!),key);
   if(baseline){assert(pending.payment);await writeFile('artifacts/wp14/recovery-before.json',JSON.stringify({confirmed:true,persistedFields:Object.keys(pending),financialPayloadPresent:true,condition:'Interrupted confirmation leaves financial draft readable in tab storage after page change.'},null,2));console.log('Confirmed baseline financial payload in sessionStorage; values withheld.');break;}
   assert.deepEqual(Object.keys(pending),['idempotencyKey']);const retained=pending.idempotencyKey;
   await page.unroute(`${origin}/api/payments`);await page.reload();await page.getByRole('button',{name:'Recover / retry last confirmation',exact:true}).click();
   if(committed){await page.waitForURL(/\/app\/payments\/[a-f0-9-]+$/);results.push('Lost committed response: key-only reload recovery returns existing payment/receipt');}
   else{await page.getByRole('alert').filter({hasText:'Re-enter'}).waitFor();await fill(page,d.project.name);await page.getByRole('button',{name:'Confirm payment & issue receipt',exact:true}).click();await page.waitForURL(/\/app\/payments\/[a-f0-9-]+$/);results.push('Uncommitted interruption: explicit re-entry retains original key and commits once');}
   const [rows]=await f.connection.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM payments WHERE project_id=?',[d.project.id]);assert.equal(Number(rows[0].n),1);
   const operation=await context.request.get(`${origin}/api/payments/operations/${retained}`);assert.equal(operation.status(),200);assert.equal((await operation.json()).status,'completed');assert.equal(await page.evaluate(key=>sessionStorage.getItem(key),key),null);
  }
  if(!baseline){
   const key=`fitimi.payment.pending.${f.userId}`;await page.evaluate(key=>sessionStorage.setItem(key,JSON.stringify({idempotencyKey:crypto.randomUUID(),payment:{amount:'13.37',projectName:'PRIVATE-LEGACY-DRAFT'}})),key);
   await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.waitForURL(`${origin}/login`);await page.waitForFunction(key=>!sessionStorage.getItem(key)?.includes('payment'),key);const retained=await page.evaluate(key=>JSON.parse(sessionStorage.getItem(key)!),key);assert.deepEqual(Object.keys(retained),['idempotencyKey']);results.push('Login/logout migration removes legacy financial drafts and retains opaque recovery keys');
   await writeFile('artifacts/wp14/recovery-after.json',JSON.stringify({browser:browser.version(),financialPayloadPresent:false,results},null,2));console.log(`PASS: ${results.length} browser recovery/storage scenarios preserve one logical payment and no persisted financial payload.`);
  }
  await context.close();
 }catch(error){let message=error instanceof Error?error.stack??error.message:String(error);for(const value of [f.email,f.password,f.token])message=message.replaceAll(value,'[redacted]');await writeFile('artifacts/wp14/recovery-failure.txt',message);throw error;}finally{await browser.close();await f.close();}
}
void main().catch(()=>{console.error('Recovery browser test failed; sensitive fixture details withheld.');process.exitCode=1;});
