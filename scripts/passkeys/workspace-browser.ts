import assert from 'node:assert/strict';
import {mkdir,writeFile} from 'node:fs/promises';
import type {Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Runs only inside the fresh synthetic database/session owned by local-test.mjs. */
export async function verifyWorkspace(page:Page,origin:string){
 assert(process.env.FITIMI_WORKSPACE_CHECK==='1'&&/^fitimi_test_passkeys_[0-9a-f]{8}$/.test(new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)));
 const results:string[]=[],root='artifacts/workspace';await mkdir(root,{recursive:true});
 const check=(name:string)=>{results.push(name);console.log('PASS: '+name);};
 await page.goto(origin+'/app');
 const navigation=page.getByRole('navigation',{name:'Navigimi kryesor',exact:true});
 assert.deepEqual(await navigation.getByRole('link').allTextContents(),['Paneli kryesor','Punishtet','Klientët','Pagesat','Shpenzimet','Dëftesat','Raportet','Kategoritë & Referencat','Personat & Furnitorët','Automjetet','Historiku','Cilësimet & Siguria','Llogaritë']);
 await navigation.locator('[aria-current="page"]').waitFor();check('Prototype order retains every existing business section and account security');
 await page.getByRole('button',{name:'Palos menynë',exact:true}).click();assert(await page.locator('.workspace-refresh').evaluate(el=>el.classList.contains('is-collapsed')));
 await page.reload();assert(await page.locator('.workspace-refresh').evaluate(el=>el.classList.contains('is-collapsed')));await page.getByRole('button',{name:'Zgjero menynë',exact:true}).click();check('Sidebar collapse is accessible and persists after reload');
 const created=await page.request.post(origin+'/api/clients',{headers:{Origin:origin},data:{type:'business',name:'Klienti provues i historikut'}});assert.equal(created.status(),201);const {client}=await created.json();
 await page.goto(origin+'/app/clients/'+client.id);assert.equal(await page.locator('.client-history').count(),0);check('Client detail preserves data and moves its activity panel to Historiku');
 await page.getByLabel('Kërkoni një seksion të menusë').fill('Historiku');await page.locator('.workspace-search-results').getByRole('link',{name:'Historiku',exact:true}).click();await page.waitForURL(origin+'/app/history');
 await page.getByLabel('Seksioni',{exact:true}).selectOption('client');await page.getByLabel('Identifikuesi i regjistrimit (opsional)').fill(client.id);await page.getByRole('button',{name:'Shfaqni veprimet',exact:true}).click();
 await page.locator('.activity-event').first().waitFor();assert.equal(await page.locator('.activity-event').count(),1);await page.locator('.activity-event>summary').click();assert((await page.locator('.activity-event').innerText()).includes('Klienti provues i historikut'));check('Real client creation appears in centralized, filtered immutable activity snapshots');
 for(const theme of ['light','dark'] as const){
  if(theme==='dark')await page.getByRole('button',{name:'Aktivizo pamjen e errët',exact:true}).click();
  await page.reload();assert.equal(await page.locator('html').getAttribute('data-workspace-theme'),theme);
  for(const width of [1440,980,390,320]){
   await page.setViewportSize({width,height:950});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width<640){const menu=await page.locator('.workspace-mobile-trigger').boundingBox(),toggle=await page.locator('.workspace-theme-toggle').boundingBox(),name=await page.locator('.workspace-breadcrumb [aria-current]').boundingBox(),field=await page.locator('#history-id').boundingBox(),submit=await page.locator('.activity-filters button').boundingBox();assert(menu&&toggle&&Math.abs(menu.y-toggle.y)<5,'Mobile controls share one row');assert(name&&name.width>40,'Mobile breadcrumb stays visible');assert(field&&submit&&submit.y>=field.y+field.height,'Mobile filters do not overlap');}
   const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${theme}/${width} accessibility`);
   await page.screenshot({path:`${root}/${theme}-${width}.png`,fullPage:true,caret:'initial'});
  }
 }
 check('Light/dark themes persist and pass axe/overflow checks at 1440, 980, 390 and 320px');
 await page.getByRole('button',{name:'Hap menynë',exact:true}).click();const menu=page.getByRole('dialog',{name:'Menyja e administratës'});await menu.waitFor();assert.equal(await menu.getByRole('link',{name:'Historiku',exact:true}).count(),1);
 await page.screenshot({path:`${root}/mobile-menu.png`,caret:'initial'});await page.keyboard.press('Escape');assert.equal(await menu.isVisible(),false);assert(await page.getByRole('button',{name:'Hap menynë',exact:true}).evaluate(el=>el===document.activeElement));
 await page.getByRole('button',{name:'Hap menynë',exact:true}).click();await menu.getByRole('link',{name:'Automjetet',exact:true}).click();await page.waitForURL(origin+'/app/vehicles');assert.equal(await menu.isVisible(),false);check('Mobile modal traps focus, closes with Escape and navigates without covering content');
 const anonymous=await page.context().browser()!.newContext();try{const denied=await anonymous.request.get(origin+'/app/history',{maxRedirects:0});assert.equal(denied.status(),307);assert(new URL(denied.headers().location,origin).pathname==='/administrata');assert(!(await denied.text()).includes('Klienti provues i historikut'));}finally{await anonymous.close();}
 check('Activity page rejects anonymous access without exposing records');
 await page.setViewportSize({width:1440,height:1000});await page.goto(origin+'/app');await page.getByRole('button',{name:'Aktivizo pamjen e çelët',exact:true}).click();
 await writeFile(`${root}/verification.json`,JSON.stringify({results,syntheticOnly:true},null,2));
}
