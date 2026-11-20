import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {join} from 'node:path';
import {performance} from 'node:perf_hooks';
import {chromium} from '@playwright/test';
import {drizzle} from 'drizzle-orm/mysql2';
import type {RowDataPacket} from 'mysql2/promise';
import {localDatabaseOptions,openLocalConnection} from '../../src/server/db/config';
import {applyMigrations} from '../../src/server/db/migrate';
import {createAccount} from '../../src/server/auth/accounts';
import {authenticateOperator} from '../../src/server/auth/operator';
import {login} from '../../src/server/auth/login';
import {startEnrollment,proveEnrollment,acknowledgeCodes} from '../../src/server/auth/mfa';
import {authenticator} from '../../src/server/auth/mfa-crypto';
import {sessionUser} from '../../src/server/auth/sessions';
import {createClient} from '../../src/features/clients/service';
import {createProject,getProject} from '../../src/features/projects/service';
import {confirmPaymentWithReceipt} from '../../src/features/receipts/service';
import {materialize} from '../../src/features/reporting/snapshot';
import {dashboardOverview} from '../../src/features/dashboard/overview';
import {kosovoDate} from '../../src/lib/presentation';
import * as schema from '../../src/server/db/schema';

let stage='initialization';
async function main(){
const root='artifacts/speed',mode=process.argv[2],options=localDatabaseOptions(process.env.TEST_DATABASE_URL,'test',process.env.DATABASE_DISPOSABLE);
assert(/^fitimi_test_speed_[a-f0-9]{8}$/.test(options.database??''));assert.equal(options.port,3307);assert.equal(process.env.AUTH_ORIGIN,'http://localhost:3000');
const c=await openLocalConnection(options),save=(name:string,value:unknown)=>writeFile(`${root}/${name}.json`,JSON.stringify(value,null,2));
const summary=(values:number[])=>{const v=[...values].sort((a,b)=>a-b);return {n:v.length,medianMs:v[Math.floor(v.length/2)],minMs:v[0],maxMs:v.at(-1)};};
async function timed(work:()=>Promise<unknown>|unknown,n=10){await work();const samples=[];for(let i=0;i<n;i++){const start=performance.now();await work();samples.push(performance.now()-start);}return summary(samples);}
try{
 const [settings]=await c.query<RowDataPacket[]>('SELECT @@session.time_zone AS zone, @@session.default_storage_engine AS engine, @@session.sql_mode AS mode');
 assert.equal(settings[0].zone,'+00:00');assert.equal(settings[0].engine,'InnoDB');
 assert.deepEqual(String(settings[0].mode).split(',').sort(),['STRICT_ALL_TABLES','NO_ZERO_DATE','NO_ZERO_IN_DATE','ERROR_FOR_DIVISION_BY_ZERO','NO_ENGINE_SUBSTITUTION'].sort());
 assert.equal(options.multipleStatements,false);
 if(mode==='seed'){
  await applyMigrations(c);const email='speed-'+randomUUID()+'@example.invalid',password=randomUUID()+randomUUID(),user=await createAccount(c,authenticateOperator(process.env.ADORE_OPERATOR_KEY!),{email,password,displayName:'Synthetic speed account'});
  const pending=await login(c,email,password);assert(pending.ok&&pending.state==='enroll');const setup=await startEnrollment(c,pending.token);assert(setup.ok&&setup.seed);
  const proof=await proveEnrollment(c,pending.token,authenticator(setup.seed).generate());assert(proof.ok&&proof.codes);const complete=await acknowledgeCodes(c,pending.token,'saved');assert(complete.ok&&complete.token);const token=complete.token;
  const client=await createClient(c,token,{type:'business',name:'Synthetic receipt client'});
  const project=await createProject(c,token,{project:{name:'Synthetic receipt project',clientId:client.id,clientVersion:client.version,status:'active'},contract:{totalValue:'100.00',phases:[{name:'Phase',value:'100.00',sortOrder:0}]}});
  const detail=await getProject(c,token,project.id);
  await confirmPaymentWithReceipt(c,token,{idempotencyKey:randomUUID(),payment:{projectId:detail.project.id,projectVersion:detail.project.version,contractId:detail.contract!.id,contractVersion:detail.contract!.version,amount:'10.00',transactionDate:'2026-11-01',method:'bank',allocations:[{phaseId:detail.phases[0].id,phaseVersion:detail.phases[0].version,amount:'10.00'}]}});
  const db=drizzle(c),category=randomUUID();await db.insert(schema.expenseCategories).values({id:category,name:'Synthetic materials'});
  const clients=Array.from({length:1000},(_,i)=>({id:randomUUID(),type:'business' as const,name:`Synthetic client ${i}`,createdBy:user}));
  const projects=clients.map((v,i)=>({id:randomUUID(),clientId:v.id,name:`Synthetic project ${i}`,createdBy:user}));
  const contracts=projects.map(v=>({id:randomUUID(),projectId:v.id,totalValue:'100.00',status:'active' as const,createdBy:user}));
  const phases=contracts.flatMap(v=>[0,1].map(i=>({id:randomUUID(),contractId:v.id,name:'Synthetic phase '+i,value:'50.00',sortOrder:i,createdBy:user})));
  const payments=projects.slice(0,300).map(v=>({id:randomUUID(),projectId:v.id,amount:'1.00',transactionDate:'2026-11-01',method:'bank' as const,createdBy:user}));
  await db.insert(schema.clients).values(clients);await db.insert(schema.projects).values(projects);await db.insert(schema.contracts).values(contracts);await db.insert(schema.contractPhases).values(phases);
  await db.insert(schema.payments).values(payments);await db.insert(schema.paymentAllocations).values(payments.map((v,i)=>({id:randomUUID(),paymentId:v.id,phaseId:phases[i*2].id,amount:'1.00',createdBy:user})));
  await db.insert(schema.expenses).values(projects.slice(0,300).map(v=>({id:randomUUID(),projectId:v.id,categoryId:category,amount:'0.30',transactionDate:'2026-11-01',description:'Synthetic expense',createdBy:user})));
  await writeFile(`${root}/fixture.json`,JSON.stringify({token,user,projectId:detail.project.id}),{mode:0o600});
  const [triggers]=await c.query<RowDataPacket[]>('SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()');assert.equal(triggers.length,13);
  console.log('Seeded 1,001 synthetic projects with balanced phases/payments, MFA and an actual receipt.');
 }else{
  assert(['baseline','optimized'].includes(mode));const f=JSON.parse(await readFile(`${root}/fixture.json`,'utf8'));assert(await sessionUser(c,f.token));
  const snapshot=await materialize(c,f.token),now=new Date('2026-11-20T10:00:00Z'),canonical=dashboardOverview(snapshot,now);
  // Stable financial output is the oracle, not timings or generated timestamps.
  const financial=JSON.parse(JSON.stringify(canonical));delete financial.all.generatedAt;delete financial.monthly.generatedAt;
  if(mode==='baseline')await save('financial-oracle',financial);else assert.deepEqual(financial,JSON.parse(await readFile(`${root}/financial-oracle.json`,'utf8')));
  stage='compute measurements';
  const results:Record<string,unknown>={mysqlSessionInvariants:true,projects:snapshot.data.projects.length,rows:Object.values(snapshot.counts).reduce((a,b)=>a+b,0),dashboardCompute:await timed(()=>dashboardOverview(snapshot,now),30),snapshot:await timed(()=>materialize(c,f.token)),connection:await timed(async()=>{const n=await openLocalConnection(options);await n.end();}),dates1000:await timed(()=>{for(let i=0;i<1000;i++)kosovoDate('2026-11-20 10:15:00.000');},8)};
  stage='HTTP measurements';
  const origin='http://localhost:3000',cookie=`__Host-fitimi_session=${f.token}`;
  for(const path of ['/api/dashboard','/api/clients','/api/projects','/api/payments','/api/reports/company','/app','/app/projects','/app/clients','/app/reports'])results[path]=await timed(async()=>{const r=await fetch(origin+path,{headers:{Cookie:cookie}});assert.equal(r.status,200,path);assert.match(r.headers.get('cache-control')??'',/no-store/);await r.arrayBuffer();},7);
  stage='browser measurements';
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
   const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce',extraHTTPHeaders:{Cookie:cookie}});
   await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
   const page=await context.newPage(),errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));
   const navigation:Record<string,unknown>={};
   for(const path of ['/app','/app/projects','/app/clients','/app/reports']){
    navigation[path]=await timed(async()=>{const response=await page.goto(origin+path,{waitUntil:'load'});assert.equal(response?.status(),200);assert(!page.url().includes('/administrata'));await page.locator('main h1').waitFor();},4);
    results[path+'-jsBytes']=await page.evaluate<number>("performance.getEntriesByType('resource').filter(r=>r.name.includes('.js')).reduce((n,r)=>n+r.encodedBodySize,0)");
   }
   assert.deepEqual(errors,[]);results.browser={version:browser.version(),navigation};await page.goto(origin+'/app');await page.screenshot({path:`${root}/${mode}-dashboard.png`,fullPage:true});await context.close();
  }finally{await browser.close();}
  async function chunks(directory:string):Promise<string[]>{const entries=await readdir(directory,{withFileTypes:true});return (await Promise.all(entries.map(e=>e.isDirectory()?chunks(join(directory,e.name)):e.name.endsWith('.js')?[join(directory,e.name)]:[]))).flat();}
  const files=await chunks('.next/static/chunks');results.clientChunks={files:files.length,gzipBytes:(await Promise.all(files.map(async file=>gzipSync(await readFile(file)).length))).reduce((a,b)=>a+b,0)};
  results.financialEquivalence=true;results.mode='production / loopback / synthetic / warm server';await save(mode,results);console.log(JSON.stringify(results));
 }
}finally{await c.end();}

}
void main().catch(error=>{console.error('Speed verification failed at '+stage+' ('+(error instanceof Error?error.name:'unknown')+'); credentials withheld.');if(error instanceof Error)console.error(error.stack?.split('\n').slice(1,4).join('\n'));process.exitCode=1;});
