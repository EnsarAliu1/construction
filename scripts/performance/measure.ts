/** Loopback-only, synthetic WP-13 laboratory. Never uses the owner database. */
import assert from "node:assert/strict";
import {randomUUID,createHash} from "node:crypto";
import {readFile,writeFile,mkdir} from "node:fs/promises";
import {performance as clock} from "node:perf_hooks";
import os from "node:os";
import {drizzle} from "drizzle-orm/mysql2";
import type {RowDataPacket} from "mysql2/promise";
import {chromium} from "@playwright/test";
import {localDatabaseOptions,openLocalConnection} from "../../src/server/db/config";
import * as schema from "../../src/server/db/schema";
import {paymentFixture} from "../../tests/payments/fixtures";
import {confirmPaymentWithReceipt} from "../../src/features/receipts/service";
import {createReference} from "../../src/features/references/service";
import {getProject} from "../../src/features/projects/service";
import {materialize} from "../../src/features/reporting/snapshot";
import {finances} from "../../src/features/reporting/finance";
import {reportFilter} from "../../src/features/reporting/validation";

async function main(){
const wp16=process.env.AUTH_TEST_WORK_PACKAGE==="WP-16";const release=process.env.AUTH_TEST_WORK_PACKAGE==="WP-15",root=wp16?"artifacts/wp16/performance":release?"artifacts/wp15/performance":"artifacts/wp13",mode=process.argv[2],label=process.argv[3]??"baseline";
assert(["seed","db","browser","races"].includes(mode));assert(["baseline","optimized"].includes(label));
const options=localDatabaseOptions(process.env.TEST_DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE);
assert(options.database===(wp16?"fitimi_test_wp16":release?"fitimi_test_wp15":"fitimi_test_wp13")&&options.port===3307&&process.env.TEST_DATABASE_URL===process.env.DATABASE_URL);
const origin=new URL(process.env.AUTH_ORIGIN!);assert.equal(origin.origin,"http://127.0.0.1:3000");
await mkdir(root,{recursive:true});
const summary=(values:number[])=>{const v=[...values].sort((a,b)=>a-b);return {n:v.length,medianMs:v[Math.floor(v.length/2)],p95Ms:v[Math.min(v.length-1,Math.ceil(v.length*.95)-1)],minMs:v[0],maxMs:v.at(-1)};};
const save=async(name:string,value:unknown)=>writeFile(`${root}/${name}.json`,JSON.stringify(value,null,2));
if(mode==="seed"){
 const f=await paymentFixture();try{const db=drizzle(f.connection),d=await f.fresh({name:"Synthetic WP13 receipt project"});
 // Authoritative services issue actual immutable PDFs. Bulk rows below are test fixtures only.
 const issued=await confirmPaymentWithReceipt(f.connection,f.token,f.confirmation(d));
 const category=await createReference(f.connection,f.token,"categories",{name:"Synthetic WP13 category"});
 await createReference(f.connection,f.token,"persons",{name:"Synthetic WP13 supplier"});
 await createReference(f.connection,f.token,"vehicles",{identifier:"SYNTHETIC-WP13"});
 const clients=Array.from({length:1000},(_,i)=>({id:randomUUID(),type:"business" as const,name:`Synthetic WP13 client ${String(i).padStart(4,"0")}`,createdBy:f.userId}));
 const projects=clients.map((c,i)=>({id:randomUUID(),clientId:c.id,name:`Synthetic WP13 project ${i}`,createdBy:f.userId}));
 const contracts=projects.map(p=>({id:randomUUID(),projectId:p.id,totalValue:"100.00",status:"active" as const,createdBy:f.userId}));
 const phases=contracts.flatMap(c=>[0,1].map(i=>({id:randomUUID(),contractId:c.id,name:`Synthetic phase ${i}`,value:"50.00",sortOrder:i,createdBy:f.userId})));
 const payments=projects.slice(0,300).map(p=>({id:randomUUID(),projectId:p.id,amount:"1.00",transactionDate:"2024-02-29",method:"cash" as const,createdBy:f.userId}));
 const expenses=projects.slice(0,300).map(p=>({id:randomUUID(),projectId:p.id,categoryId:category.id,amount:"0.30",transactionDate:"2024-02-29",description:"Synthetic WP13 expense",createdBy:f.userId}));
 await db.insert(schema.clients).values(clients);await db.insert(schema.projects).values(projects);await db.insert(schema.contracts).values(contracts);await db.insert(schema.contractPhases).values(phases);
 await db.insert(schema.payments).values(payments);await db.insert(schema.paymentAllocations).values(payments.map((p,i)=>({id:randomUUID(),paymentId:p.id,phaseId:phases[i*2].id,amount:"1.00",createdBy:f.userId})));await db.insert(schema.expenses).values(expenses);
 // 12,000 immutable history rows approach the existing 20,000-row export ceiling.
 for(let batch=0;batch<12;batch++){
  await db.insert(schema.auditEvents).values(clients.map(c=>({id:randomUUID(),actorId:f.userId,entityType:"client",entityId:c.id,action:"synthetic_benchmark",afterSnapshot:{name:c.name,version:batch+1}})));
 }
 const [receipt]=await f.connection.query<RowDataPacket[]>("SELECT id FROM payment_receipts WHERE payment_id=?",[issued.paymentId]);
 await save("fixture",{token:f.token,email:f.email,password:f.password,projectId:d.project.id,receiptId:receipt[0].id,privateCanary:f.prefix});
 const counts:Record<string,number>={};
 for(const table of ["clients","projects","contracts","contract_phases","payments","payment_allocations","expenses","audit_events","entity_versions","receipt_versions","persons","vehicles"]){const [rows]=await f.connection.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${table}`);counts[table]=Number(rows[0].n);}
 await save("dataset",counts);
 await f.connection.end();console.log("Seeded isolated synthetic dataset; credentials withheld.");}catch(error){await f.close();throw error;}
}else{
 const fixture=JSON.parse(await readFile(`${root}/fixture.json`,"utf8")),headers={Cookie:`__Host-fitimi_session=${fixture.token}`};
 const c=await openLocalConnection(options);
 try{
 const [version]=await c.query<RowDataPacket[]>("SELECT VERSION() AS version,@@server_uuid AS serverUUID");
 const environment={at:new Date().toISOString(),node:process.version,mysql:version[0].version,platform:os.platform(),cpu:os.cpus()[0].model,logicalCpus:os.cpus().length,ramBytes:os.totalmem(),dataset:JSON.parse(await readFile(`${root}/dataset.json`,"utf8")),label,mode};
 if(mode==="races"){
  const d=await getProject(c,fixture.token,fixture.projectId),phase=d.phases.find(p=>p.value==="60.00")!;
  const payment=(amount:string)=>({projectId:d.project.id,projectVersion:d.project.version,contractId:d.contract!.id,contractVersion:d.contract!.version,amount,transactionDate:"2024-02-29",method:"cash",allocations:[{phaseId:phase.id,phaseVersion:phase.version,amount}]});
  const post=async(path:string,body:unknown)=>{const t=clock.now();const r=await fetch(new URL(path,origin),{method:"POST",headers:{...headers,Origin:origin.origin,"Content-Type":"application/json"},body:JSON.stringify(body)});return {status:r.status,ms:clock.now()-t,body:await r.json()};};
  const previews=await Promise.all(Array.from({length:8},()=>post("/api/payments/preview",payment("1.00"))));assert(previews.every(p=>p.status===200));
  const idempotencyKey=randomUUID(),retries=await Promise.all(Array.from({length:4},()=>post("/api/payments",{idempotencyKey,payment:payment("1.00")})));
  assert(retries.every(p=>[200,201].includes(p.status)));assert.equal(new Set(retries.map(p=>p.body.paymentId)).size,1);
  const competing=await Promise.all(Array.from({length:2},()=>post("/api/payments",{idempotencyKey:randomUUID(),payment:payment("40.00")})));
  assert.equal(competing.filter(p=>p.status===201).length,1);assert.equal(competing.filter(p=>p.status===409).length,1);
  const after=await getProject(c,fixture.token,d.project.id);assert.equal(after.financial.verified,true);
  const [documents]=await c.query<RowDataPacket[]>("SELECT payment_id,COUNT(*) AS n FROM payment_receipts GROUP BY payment_id HAVING COUNT(*)<>1");assert.equal(documents.length,0);
  const [locks]=await c.query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Innodb_row_lock_waits','Innodb_row_lock_time','Threads_connected','Threads_running')");
  await save("concurrency",{environment,previews:summary(previews.map(p=>p.ms)),idempotentRetries:{...summary(retries.map(p=>p.ms)),uniquePaymentIds:1},competing:{...summary(competing.map(p=>p.ms)),statuses:competing.map(p=>p.status)},verified:true,locks});console.log("Concurrent previews, idempotent retries and competing capacity confirmations preserve exact balances and receipt uniqueness.");
 }else if(mode==="db"){
  const snapshot=await materialize(c,fixture.token),results:Record<string,unknown>={};
  for(const [name,work,n]of [
   ["finance",()=>finances(snapshot,reportFilter()),30],
   ["snapshot",()=>materialize(c,fixture.token),12],
   ["fullSnapshot",()=>materialize(c,fixture.token,true),6],
  ] as const){await work();const times=[];for(let i=0;i<n;i++){const t=clock.now();await work();times.push(clock.now()-t);}results[name]=summary(times);}
  const canonical=JSON.stringify(finances(snapshot,reportFilter()));await save(`${label}-finance`,JSON.parse(canonical));
  if(label==="optimized"){
   const baseline=JSON.parse(await readFile(`${root}/baseline-finance.json`,"utf8")),current=JSON.parse(canonical);
   delete baseline.generatedAt;delete current.generatedAt;assert.deepEqual(current,baseline);
   await save("financial-equivalence",{pass:true,projects:current.projects.length,phases:current.projects.reduce((n:number,p:{phases:unknown[]})=>n+p.phases.length,0),incomeRows:current.income.length,expenseRows:current.outgoing.length,totals:current.totals,scope:"Every finance field and ordering, excluding generation timestamp."});
  }
  const queries={lateOffset:"SELECT id FROM audit_events ORDER BY id LIMIT 100 OFFSET 11900",keyset:"SELECT id FROM audit_events WHERE id > (SELECT id FROM audit_events ORDER BY id LIMIT 1 OFFSET 11899) ORDER BY id LIMIT 100",client:"SELECT id,name FROM clients WHERE deleted_at IS NULL ORDER BY name,id LIMIT 20",project:"SELECT id FROM projects WHERE client_id = ? LIMIT 20",allocation:"SELECT id,amount FROM payment_allocations WHERE phase_id = ? AND deleted_at IS NULL",expense:"SELECT id FROM expenses WHERE transaction_date >= '2024-01-01' AND status='recorded' LIMIT 20",payment:"SELECT id FROM payments WHERE status='received' ORDER BY transaction_date LIMIT 20",history:"SELECT id FROM audit_events WHERE entity_type='client' AND entity_id=? ORDER BY recorded_at DESC LIMIT 20"};
  const [ids]=await c.query<RowDataPacket[]>("SELECT id FROM clients LIMIT 1");const [phase]=await c.query<RowDataPacket[]>("SELECT id FROM contract_phases LIMIT 1");const plans:Record<string,unknown>={};
  for(const [name,q]of Object.entries(queries)){const [plan]=await c.query(`EXPLAIN ANALYZE ${q}`,name==="project"||name==="history"?[ids[0].id]:name==="allocation"?[phase[0].id]:[]);plans[name]=plan;}
  const [statusBefore]=await c.query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Innodb_row_lock_waits','Innodb_row_lock_time','Created_tmp_disk_tables')");
  const paths=["/api/dashboard","/api/clients?q=Synthetic","/api/projects?q=Synthetic","/api/expenses","/api/payments","/api/receipts","/api/reports/company",`/api/receipts/${fixture.receiptId}/versions/1/pdf`];
  const request=async(path:string,body?:object)=>{const t=clock.now();const r=await fetch(new URL(path,origin),{headers:{...headers,...(body?{"Content-Type":"application/json",Origin:origin.origin}:{})},method:body?"POST":"GET",body:body?JSON.stringify(body):undefined});const bytes=await r.arrayBuffer();assert.equal(r.status,200,`${path}: ${r.status}`);assert.match(r.headers.get("cache-control")!,/no-store/);return {ms:clock.now()-t,bytes:bytes.byteLength};};
  for(const path of paths){await request(path);const samples=[];for(let i=0;i<7;i++)samples.push(await request(path));results[path]={...summary(samples.map(s=>s.ms)),bytes:samples.at(-1)!.bytes};}
  for(const format of ["pdf","xlsx","zip"]){const samples=[];for(let i=0;i<3;i++)samples.push(await request(format==="zip"?"/api/exports/business":"/api/reports/company",format==="zip"?{confirmation:"export-all"}:{format,filters:{}}));results[format]={...summary(samples.map(s=>s.ms)),bytes:samples.at(-1)!.bytes};}
  const samples:number[]=[];const started=clock.now();for(let batch=0;batch<8;batch++)await Promise.all(paths.slice(0,4).map(async path=>samples.push((await request(path)).ms)));
  results.concurrentReads={...summary(samples),concurrency:4,requests:samples.length,elapsedMs:clock.now()-started,unexpectedErrors:0};
  const contention=await Promise.all([request("/api/exports/business",{confirmation:"export-all"}),...paths.slice(0,4).map(path=>request(path))]);results.exportWithReads=contention;
  const [statusAfter]=await c.query("SHOW GLOBAL STATUS WHERE Variable_name IN ('Threads_connected','Threads_running','Innodb_row_lock_waits','Innodb_row_lock_time','Created_tmp_disk_tables')");
  await save(`${label}-db`,{environment,results,plans,statusBefore,statusAfter,measurementProcessMemory:process.memoryUsage(),financeSHA256:createHash("sha256").update(canonical).digest("hex")});console.log(JSON.stringify(results));
 }else{
  const browser=await chromium.launch({channel:"msedge",headless:true});const measurements=[];const errors:string[]=[];
  try{for(const mobile of [false,true])for(const locale of ["sq","en"])for(const suffix of ["","/about","/services","/projects","/contact"]){
   for(let run=0;run<3;run++){
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},reducedMotion:"reduce"});const page=await context.newPage();
    page.on("pageerror",e=>errors.push(e.message));page.on("console",m=>{if(m.type()==="error")errors.push(m.text());});
    await page.addInitScript(()=>{const data={lcp:0,cls:0,longTasks:0};Object.assign(window,{__lab:data});new PerformanceObserver(l=>{for(const e of l.getEntries())data.lcp=e.startTime;}).observe({type:"largest-contentful-paint",buffered:true});new PerformanceObserver(l=>{for(const entry of l.getEntries()){const e=entry as PerformanceEntry&{hadRecentInput:boolean;value:number};if(!e.hadRecentInput)data.cls+=e.value;}}).observe({type:"layout-shift",buffered:true});new PerformanceObserver(l=>{for(const e of l.getEntries())data.longTasks+=Math.max(0,e.duration-50);}).observe({type:"longtask",buffered:true});});
    await page.goto(`${origin.origin}/${locale}${suffix}`,{waitUntil:"networkidle"});await page.locator("h1").waitFor();
    const metrics=await page.evaluate(()=>{const n=performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming;const resources=performance.getEntriesByType("resource") as PerformanceResourceTiming[];return {...(window as unknown as {__lab:object}).__lab,ttfb:n.responseStart,domContentLoaded:n.domContentLoadedEventEnd,fcp:performance.getEntriesByName("first-contentful-paint")[0]?.startTime,jsTransfer:resources.filter(r=>r.name.includes(".js")).reduce((n,r)=>n+r.transferSize,0),jsResources:resources.filter(r=>r.name.includes(".js")).length,totalTransfer:resources.reduce((n,r)=>n+r.transferSize,0),overflow:document.documentElement.scrollWidth>innerWidth};});
    assert.equal(metrics.overflow,false);measurements.push({route:`/${locale}${suffix}`,mobile,run,cache:"cold-context/warm-server",...metrics});await context.close();
   }
  }
  const context=await browser.newContext({viewport:{width:1440,height:1000},extraHTTPHeaders:headers});await context.route("**/*",route=>new URL(route.request().url()).origin===origin.origin?route.continue():route.abort());const page=await context.newPage();page.on("pageerror",e=>errors.push(e.message));
  const privateRoutes=["/app","/app/clients","/app/projects",`/app/projects/${fixture.projectId}`,`/app/projects/${fixture.projectId}/contract`,"/app/categories","/app/persons","/app/vehicles","/app/expenses","/app/payments","/app/receipts","/app/reports"];
  const privateMeasurements=[];for(const route of privateRoutes)for(let run=0;run<3;run++){const t=clock.now();const r=await page.goto(`${origin.origin}${route}`,{waitUntil:"networkidle"});assert.equal(r!.status(),200,route);assert(!page.url().includes("/login"));privateMeasurements.push({route,run,navigationMs:clock.now()-t});}
  // Warm client navigation and real filter submit; no synthetic production mutations.
  await page.goto(`${origin.origin}/app/clients`);await page.locator("#clients-search").fill("Synthetic WP13 client 0999");let t=clock.now();await Promise.all([page.waitForURL(/q=Synthetic/),page.getByRole("button",{name:"Search",exact:true}).click()]);await page.waitForLoadState("networkidle");const searchMs=clock.now()-t;
  await page.goto(`${origin.origin}/sq`);t=clock.now();await page.locator('a[href="/sq/about"]').first().click();await page.waitForURL("**/sq/about");await page.locator("h1").waitFor();const warmPublicNavigationMs=clock.now()-t;
  await page.screenshot({path:`${root}/${label}-public.png`,fullPage:true});await context.close();assert.deepEqual(errors,[]);
  await save(`${label}-browser`,{environment,browser:browser.version(),mobileSimulation:"390x844 viewport only; no CPU/network throttling",measurements,privateMeasurements,searchMs,warmPublicNavigationMs,errors});console.log(`Measured ${measurements.length} public and ${privateMeasurements.length} private production navigations; no browser errors.`);
  }finally{await browser.close();}
 }
 }finally{await c.end();}
}

}
void main().catch(error=>{console.error(error);process.exitCode=1;});
