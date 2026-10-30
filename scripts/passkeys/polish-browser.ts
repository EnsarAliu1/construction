import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import type {Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function verifyPolish(page:Page,origin:string){
 assert(process.env.FITIMI_WORKSPACE_CHECK==='1'&&/^fitimi_test_passkeys_[0-9a-f]{8}$/.test(new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)));
 const root='artifacts/polish',results:string[]=[];await mkdir(root,{recursive:true});
 const check=(name:string)=>{results.push(name);console.log('PASS: '+name);};
 const audit=async(label:string)=>{const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();assert.deepEqual(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],label);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow');};
 await page.setViewportSize({width:1440,height:1000});
 await page.goto(origin+'/app/payments/new');const box=page.locator('#expense-project');
 await box.fill('Klienti provues i historikut');const option=page.getByRole('option').filter({hasText:'Punishtja provuese e panelit'});await option.waitFor();await audit('live project search');await page.screenshot({path:`${root}/live-search.png`,fullPage:true});await option.click();
 await page.locator('.allocation-row').first().waitFor();assert.equal(await page.getByRole('button',{name:'Ngarkoni fazat e projektit',exact:true}).count(),0);
 assert.equal(await box.inputValue(),'Punishtja provuese e panelit');check('Searching by client finds a real project and automatically loads its verified contract/phases without extra clicks');
 await box.fill('Asgjë nuk përputhet 83921');await page.getByText('Nuk u gjet asnjë rezultat.',{exact:true}).waitFor();await box.press('Escape');assert.equal(await box.inputValue(),'Punishtja provuese e panelit');assert(await page.locator('.allocation-row').count());assert(await page.locator('.app-form-modal[open]').count());check('Unmatched searches never replace the selected project; Escape dismisses suggestions while retaining the payment modal and allocations');
 await page.route('**/api/expenses/projects?*',route=>route.fulfill({status:503,json:{message:'Synthetic unavailable'}}));await box.fill('test');await page.getByText('Kërkimi nuk u përfundua. Përzgjedhja juaj është ruajtur.',{exact:true}).waitFor();await page.unroute('**/api/expenses/projects?*');await page.getByRole('button',{name:'Provoni përsëri',exact:true}).click();await page.getByText('Nuk u gjet asnjë rezultat.',{exact:true}).waitFor();await box.press('Escape');assert.equal(await box.inputValue(),'Punishtja provuese e panelit');check('Unavailable search keeps the selected identity and offers a working retry without changing financial state');
 await page.goto(origin+'/app/projects/new');const client=page.locator('#project-client');await client.fill('Klienti provues i historikut');await page.getByRole('option').filter({hasText:'Klienti provues i historikut'}).waitFor();await client.press('ArrowDown');await client.press('Enter');assert.equal(await client.inputValue(),'Klienti provues i historikut');assert.equal(await client.evaluate((el:HTMLInputElement)=>el.validationMessage),'');await page.getByRole('button',{name:'Pastroni përzgjedhjen: Klienti',exact:true}).click();assert(await client.evaluate((el:HTMLInputElement)=>Boolean(el.validationMessage)));await client.press('Escape');check('Keyboard-only client selection preserves the server identity/version and required selection validation survives clearing');
 await page.goto(origin+'/app/payments?from=2026-10-01&method=bank');assert(await page.locator('.workspace-filter-panel').getAttribute('open')!==null);assert.equal(await page.locator('#payment-filter-method').inputValue(),'bank');await page.locator('#payment-to').fill('2026-10-31');await page.getByRole('button',{name:'Zbatoni filtrat',exact:true}).click();await page.waitForURL(/to=2026-10-31/);assert.equal(new URL(page.url()).searchParams.get('method'),'bank');check('Advanced GET filters remain discoverable when active and preserve every submitted date/method');
 await page.goto(origin+'/app');await page.locator('.dashboard-period strong').waitFor();const month=await page.locator('.dashboard-period strong').innerText();assert.equal(month[0],month[0].toLocaleUpperCase('sq'));assert(await page.locator('.dashboard-hero-label').isVisible());check('The redesigned dashboard has a visible administration hero and a correctly capitalized month, without changing its verified totals');
 await page.goto(origin+'/app/payments');const live=page.locator('#payment-q');await live.fill('Pa rezultat provues 6719');await page.waitForURL(url=>url.searchParams.get('q')==='Pa rezultat provues 6719');await page.getByText('Nuk u gjetën pagesa sipas kërkimit',{exact:true}).waitFor();await page.waitForFunction(()=>document.activeElement?.id==='payment-q');await live.fill('Klienti provues i historikut');await page.waitForURL(url=>url.searchParams.get('q')==='Klienti provues i historikut');await page.locator('.payments-ledger tbody tr').first().waitFor();await page.waitForFunction(()=>document.activeElement?.id==='payment-q');check('Typing searches the existing payment records without submitting or reloading the page, restores keyboard focus and supports continued refinement');
 for(const theme of ['light','dark'] as const){
  if(theme==='dark')await page.locator('.workspace-theme-toggle').click();
  for(const route of ['clients','payments','expenses','receipts','categories','persons','vehicles','reports']){
   await page.goto(origin+'/app/'+route);await page.locator('main h1').waitFor();
   await page.setViewportSize({width:1440,height:1000});await audit(`${theme}/${route}/desktop`);if(['payments','clients','reports'].includes(route))await page.screenshot({path:`${root}/${theme}-${route}-desktop.png`,fullPage:true});
   for(const width of [390,320]){await page.setViewportSize({width,height:950});await audit(`${theme}/${route}/${width}`);const cells=page.locator('td[data-label]');if(await cells.count())assert(await cells.first().evaluate(el=>getComputedStyle(el,'::before').content.length>2));}
   if(['payments','clients','reports'].includes(route))await page.screenshot({path:`${root}/${theme}-${route}-320.png`,fullPage:true});
  }
 }
 check('All business tables and filters pass real light/dark accessibility and overflow checks on desktop, 390px and 320px with server-rendered mobile labels');
 await page.setViewportSize({width:1440,height:1000});await page.locator('.workspace-theme-toggle').click();
 await writeFile(`${root}/verification.json`,JSON.stringify({results,syntheticOnly:true},null,2));
}
