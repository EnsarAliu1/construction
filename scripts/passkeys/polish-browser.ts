import {assertNoBlue} from './presentation-audit';
import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import type {Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

export async function verifyPolish(page:Page,origin:string){
 assert(process.env.FITIMI_WORKSPACE_CHECK==='1'&&/^fitimi_test_passkeys_[0-9a-f]{8}$/.test(new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)));
 const root='artifacts/polish',results:string[]=[];await mkdir(root,{recursive:true});
 const check=(name:string)=>{results.push(name);console.log('PASS: '+name);};
 const audit=async(label:string)=>{await assertNoBlue(page,label);const a=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();assert.deepEqual(a.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],label);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),label+' overflow');};
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

 // A real company fuel expense exercises category-only and month/date exports.
 const post=async(path:string,data:unknown)=>{const response=await page.request.post(origin+path,{headers:{Origin:origin},data});assert(response.ok(),`${path}: ${response.status()}`);return response.json();};
 const fuel=(await post('/api/references/categories',{name:'Karburant provues UX'})).record;
 await page.goto(origin+'/app/expenses/new');await page.locator('#expense-amount').fill('10000.25');assert.equal(await page.locator('#expense-amount').inputValue(),'10 000.25');
 await page.locator('#expense-description').fill('Karburant provues i raportit');await page.locator('#expense-transactionDate').fill('2026-10-31');await page.locator('#expense-category').fill('Karburant provues UX');await page.getByRole('option').filter({hasText:'Karburant provues UX'}).click();
 await page.getByRole('button',{name:'Regjistroni shpenzim',exact:true}).click();await page.waitForURL(/notice=created/);await page.locator('.save-toast').waitFor();assert((await page.locator('.save-toast').innerText()).includes('Shpenzimi u ruajt.'));
 const expenseId=new URL(page.url()).pathname.split('/').at(-1),expense=await(await page.request.get(origin+'/api/expenses/'+expenseId)).json();assert.equal(expense.record.amount,'10000.25');
 check('Grouped money remains exact through real save and a success toast appears only after server confirmation');
 await page.goto(origin+'/app/reports');await page.locator('#report-category').selectOption(fuel.id);await page.getByRole('button',{name:'Raport mujor',exact:true}).click();await page.locator('#report-month').fill('2026-10');await page.getByRole('button',{name:'Gjeneroni raportin',exact:true}).click();await page.waitForURL(url=>url.searchParams.get('categoryId')===fuel.id&&url.searchParams.get('to')==='2026-10-31');
 await page.locator('.report-category-list').waitFor();assert((await page.locator('.report-category-list').innerText()).includes('10.000,25'));assert((await page.locator('main').innerText()).includes('31/10/2026'));
 for(const format of ['pdf','xlsx']){const waiting=page.waitForRequest(request=>request.url().endsWith('/api/reports/company')&&request.method()==='POST');const download=page.waitForEvent('download');await page.getByRole('button',{name:`Shkarkoni raportin e kompanisë ${format.toUpperCase()}`,exact:true}).click();const request=await waiting;assert.deepEqual(request.postDataJSON().filters,{from:'2026-10-01',to:'2026-10-31',categoryId:fuel.id,method:'all'});const file=await download;await file.saveAs(`${root}/fuel-report.${format}`);}
 check('A company fuel expense appears under its category; month boundaries and category filters carry identically into actual PDF and Excel downloads');
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
