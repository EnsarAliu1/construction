import {assertNoBlue} from './presentation-audit';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdir,writeFile} from 'node:fs/promises';
import type {Page} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {calendarMonth} from '../../src/features/dashboard/overview';

export async function verifyDashboard(page:Page,origin:string,client:{id:string;version:number}){
 assert(process.env.FITIMI_WORKSPACE_CHECK==='1'&&/^fitimi_test_passkeys_[0-9a-f]{8}$/.test(new URL(process.env.TEST_DATABASE_URL!).pathname.slice(1)));
 const root='artifacts/dashboard';await mkdir(root,{recursive:true});const results:string[]=[],check=(name:string)=>{results.push(name);console.log('PASS: '+name);};
 const post=async(path:string,data:unknown)=>{const response=await page.request.post(origin+path,{headers:{Origin:origin},data});assert(response.status()===200||response.status()===201,`Synthetic ${path}: ${response.status()}`);return response.json();};
 const saved=await post('/api/projects',{project:{name:'Punishtja provuese e panelit',clientId:client.id,clientVersion:client.version,status:'active'},contract:{totalValue:'1000.00',phases:[{name:'Faza e parë',value:'1000.00',sortOrder:0}]}});
 const category=(await post('/api/references/categories',{name:'Materiale provuese të panelit'})).record;
 const period=calendarMonth(new Date()),previous=new Date(period.from+'T12:00:00Z');previous.setUTCDate(0);const prior=previous.toISOString().slice(0,10),nextDate=new Date(period.to+'T12:00:00Z');nextDate.setUTCDate(nextDate.getUTCDate()+1);const next=nextDate.toISOString().slice(0,10);
 for(const [date,amount,cost] of [[prior,'200.00','40.00'],[period.today,'125.00','25.00'],[next,'15.00','10.00']]){
  const detail=await(await page.request.get(origin+`/api/projects/${saved.project.id}`)).json();
  await post('/api/payments',{idempotencyKey:randomUUID(),payment:{projectId:detail.project.id,projectVersion:detail.project.version,contractId:detail.contract.id,contractVersion:detail.contract.version,amount,transactionDate:date,method:'bank',allocations:[{phaseId:detail.phases[0].id,phaseVersion:detail.phases[0].version,amount}]}});
  await post('/api/expenses',{amount:cost,transactionDate:date,description:date===period.today?'Materiale të muajit aktual':'Materiale jashtë muajit',category:{id:category.id,version:category.version}});
 }
 check('Synthetic real API transactions and receipt PDFs span the previous, current and next calendar months');
 await page.goto(origin+'/app');await page.locator('.dashboard-overview').waitFor();
 assert.deepEqual(await page.locator('.dashboard-primary-metrics .dashboard-metric-value').allTextContents(),['1.000 €','125 €','25 €','100 €','660 €']);
 assert((await page.locator('.dashboard-period').innerText()).toLocaleLowerCase('sq').includes(period.label.toLocaleLowerCase('sq')));assert.equal(await page.locator('.dashboard-primary-metrics>.dashboard-metric').count(),5);assert.equal(await page.locator('.dashboard-count').count(),4);
 check('Five top cards show exact monthly cash flow and separate full contract balances; four real counters render');
 assert.equal(await page.locator('.dashboard-transactions>li').count(),2);assert(!(await page.locator('.dashboard-recent').innerText()).includes('jashtë muajit'));assert.equal(await page.locator('.dashboard-site').count(),1);assert(!(await page.locator('.dashboard-overview').innerText()).includes('%'));assert.equal(await page.locator('.activity-event,.client-history').count(),0);
 check('Recent transactions stay within the current month; active sites have exact balances without percentages or activity logs');
 assert.equal(await page.locator('.dashboard-alltime-metrics').count(),0);await page.getByRole('button',{name:'Shfaqni totalet',exact:true}).click();
 assert.deepEqual(await page.locator('.dashboard-alltime-metrics .dashboard-metric-value').allTextContents(),['340 €','75 €','265 €']);
 await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));assert.equal(await page.locator('.dashboard-alltime-metrics').count(),0);
 await page.getByRole('button',{name:'Shfaqni totalet',exact:true}).click();await page.getByRole('button',{name:'Fshihni totalet',exact:true}).click();await page.reload();assert.equal(await page.locator('.dashboard-alltime-metrics').count(),0);
 check('All-time totals sit last, require explicit reveal and hide on tab change, manual close and reload');
 for(const theme of ['light','dark'] as const){
  if(theme==='dark')await page.locator('.workspace-theme-toggle').click();
  for(const width of [1440,980,390,320]){
   await page.setViewportSize({width,height:950});await page.evaluate(()=>window.scrollTo(0,0));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width<640){const a=await page.locator('.workspace-mobile-trigger').boundingBox(),b=await page.locator('.workspace-theme-toggle').boundingBox();assert(a&&b&&Math.abs(a.y-b.y)<8,'Premium header mobile controls stay aligned');}
   await assertNoBlue(page,`${theme}/${width} dashboard`);
   const audit=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze();assert.deepEqual(audit.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[],`${theme}/${width} dashboard accessibility`);
   await page.screenshot({path:`${root}/${theme}-${width}.png`,fullPage:true,caret:'initial'});
  }
 }
 check('Premium header/dashboard pass overflow and axe checks in light/dark mode at 1440, 980, 390 and 320px');
 await page.setViewportSize({width:1440,height:1000});await page.locator('.workspace-theme-toggle').click();
 await writeFile(`${root}/verification.json`,JSON.stringify({results,syntheticOnly:true,monthly:{income:'125.00',expenses:'25.00',difference:'100.00'},allTime:{income:'340.00',expenses:'75.00',difference:'265.00'}},null,2));
}
