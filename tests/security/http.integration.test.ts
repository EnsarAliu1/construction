import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {readFile,writeFile,readdir,lstat} from "node:fs/promises";
import {join} from "node:path";
import type {RowDataPacket} from "mysql2/promise";
import JSZip from "jszip";
import {paymentFixture,mysqlSkip} from "../payments/fixtures";
import {confirmPaymentWithReceipt} from "../../src/features/receipts/service";
import {createReference} from "../../src/features/references/service";
import {createExpense} from "../../src/features/expenses/service";
import {createClient} from "../../src/features/clients/service";
import {setAccountActive} from "../../src/server/auth/accounts";
import {revokeSession} from "../../src/server/auth/sessions";
import {tokenDigest,trustedOrigin} from "../../src/server/auth/security";

const evidence=process.env.AUTH_TEST_WORK_PACKAGE==='WP-15'?'artifacts/wp15':'artifacts/wp14',build=process.env.AUTH_TEST_WORK_PACKAGE==='WP-15'?'.next-wp15':'.next-wp14';
type Endpoint={file:string;path:string;kind:"page"|"api";methods:string[]};
test("WP14 complete local endpoint denial, canary and export security matrix",{skip:mysqlSkip,timeout:240000},async t=>{
 const f=await paymentFixture(),c=f.connection,origin=trustedOrigin();assert.equal(origin.origin,"http://127.0.0.1:3000");
 const inventory=JSON.parse(await readFile("docs/security/endpoint-inventory.json","utf8")) as Endpoint[];
 const canary=`PRIVATE-WP14-${randomUUID()}`,d=await f.fresh({name:canary}),request=f.confirmation(d),issued=await confirmPaymentWithReceipt(c,f.token,request);
 const category=await createReference(c,f.token,"categories",{name:canary}),person=await createReference(c,f.token,"persons",{name:canary}),vehicle=await createReference(c,f.token,"vehicles",{identifier:canary});
 const expense=await createExpense(c,f.token,{amount:"0.01",transactionDate:"2024-02-29",description:canary,category:{id:category.id,version:1},project:null,person:null,vehicle:null});
 const payload=`${canary}<img src=x onerror="window.__storedXSS=1">`;
 const xssClient=await createClient(c,f.token,f.input({name:payload}));
 const peer=await f.anotherUser(),expired=await f.anotherUser(),revoked=await f.anotherUser(),disabled=await f.anotherUser();
 await c.execute("UPDATE auth_sessions SET expires_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND) WHERE token_hash=?",[tokenDigest(expired.token)]);await revokeSession(c,revoked.token);
 const [disabledUser]=await c.query<RowDataPacket[]>("SELECT email FROM users WHERE id=?",[disabled.id]);await setAccountActive(c,f.operator,String(disabledUser[0].email),false);
 const matrix:object[]=[];
 const cookie=(token?:string):Record<string,string>=>token?{Cookie:`__Host-fitimi_session=${token}`}:{},get=(path:string,token?:string)=>fetch(new URL(path,origin),{redirect:"manual",headers:cookie(token)});
 const post=(path:string,body:unknown,token=f.token,source=origin.origin)=>fetch(new URL(path,origin),{method:"POST",headers:{...cookie(token),Origin:source,"Content-Type":"application/json"},body:JSON.stringify(body)});
 const ids=(path:string,kind="categories")=>path.replace("[section]",kind).replace("[kind]",kind).replace("[key]",request.idempotencyKey).replace("[version]","1").replace("[id]",path.includes("receipts")?issued.receiptId:path.includes("payments")?issued.paymentId:path.includes("projects")?d.project.id:path.includes("expenses")?expense.id:path.includes("references")||path.includes("[section]")?kind==="persons"?person.id:kind==="vehicles"?vehicle.id:category.id:f.client.id);
 try{
 await t.test("all private API methods and page patterns deny anonymous, malformed, expired, revoked and disabled sessions",async()=>{
  const states=[{name:"anonymous",token:undefined},{name:"malformed",token:"invalid"},{name:"expired",token:expired.token},{name:"revoked",token:revoked.token},{name:"disabled",token:disabled.token}];
  for(const endpoint of inventory){if(endpoint.path==="/api/auth/login"||endpoint.path==="/api/auth/logout")continue;
   for(const kind of endpoint.path==="/app/[section]"?["categories","persons","vehicles","accounts"]:endpoint.path.includes("[kind]")||endpoint.path.includes("[section]")?["categories","persons","vehicles"]:["categories"]){const path=ids(endpoint.path,kind);
    for(const state of states)for(const method of endpoint.methods){const r=await fetch(new URL(path,origin),{method,redirect:"manual",headers:{...cookie(state.token),Origin:origin.origin,"Content-Type":"application/json"},body:["GET","HEAD"].includes(method)?undefined:"{}"});const text=await r.text();assert.equal(r.status,endpoint.kind==="page"?307:401,`${state.name} ${method} ${path}`);assert(!text.includes(canary));assert.match(r.headers.get("cache-control")??"",/no-store/);matrix.push({pattern:endpoint.path,path,method,state:state.name,status:r.status});}
   }
  }
  await writeFile(`${evidence}/endpoint-results.json`,JSON.stringify(matrix,null,2));
 });
 await t.test("equal peers retain company access but cannot recover another user's confirmation operation",async()=>{
  assert.equal((await get(`/api/clients/${f.client.id}`,peer.token)).status,200);
  assert.equal((await get(`/api/payments/operations/${request.idempotencyKey}`,peer.token)).status,404);
  assert.equal((await get(`/api/payments/operations/${request.idempotencyKey}`,f.token)).status,200);
  for(const path of [`/api/projects/${f.client.id}`,`/api/receipts/${issued.paymentId}`,`/api/receipts/${issued.receiptId}/versions/999999/pdf`,`/api/clients/${randomUUID()}`,"/api/clients/not-a-uuid"]){const r=await get(path,f.token);assert.equal(r.status,404,path);assert(!((await r.text()).includes(canary)));}
 });
 await t.test("framework/proxy headers cannot substitute for server-side authorization",async()=>{
  for(const [name,value] of [['RSC','1'],['x-middleware-subrequest','proxy:middleware:proxy'],['x-forwarded-host','attacker.invalid'],['x-nonce','attacker-selected-nonce']]){
   const r=await fetch(new URL('/api/dashboard',origin),{headers:{[name]:value}});assert.equal(r.status,401);assert(!(await r.text()).includes(canary));
  }
 });
 await t.test("unsupported methods, malicious origins, oversized JSON and protected payload fields fail safely",async()=>{
  for(const endpoint of inventory.filter(e=>e.kind==="api")){const method=["PATCH","DELETE","PUT"].find(m=>!endpoint.methods.includes(m))!;const r=await fetch(new URL(ids(endpoint.path),origin),{method,headers:{...cookie(f.token),Origin:origin.origin}});assert.equal(r.status,405,endpoint.path);assert(!(await r.text()).includes(canary));assert.match(r.headers.get("cache-control")??"",/no-store/);}
  for(const body of [{...f.input(),role:"operator"},{...f.input(),createdBy:peer.id},{...f.input(),passwordHash:"sentinel"}])assert.equal((await post("/api/clients",body)).status,400);
  assert.equal((await post("/api/clients",f.input(),f.token,"https://attacker.invalid")).status,403);
  assert.equal((await post("/api/clients",{name:"x".repeat(9000)})).status,400);
  const preflight=await fetch(new URL("/api/clients",origin),{method:"OPTIONS",headers:{Origin:"https://attacker.invalid","Access-Control-Request-Method":"GET"}});assert.equal(preflight.headers.get("access-control-allow-origin"),null);
 });
 await t.test("public HTML, RSC, metadata, assets and direct filesystem probes exclude private canaries and secrets",async()=>{
  const forbidden=[canary,f.token,tokenDigest(f.token),f.password,process.env.ADORE_OPERATOR_KEY!,process.env.DATABASE_URL!];
  for(const path of ["/sq","/en",...['sq','en'].flatMap(l=>['about','services','projects','contact'].map(p=>`/${l}/${p}`)),"/sitemap.xml","/robots.txt","/icon.svg","/.env.local","/.git/config","/artifacts/wp14/test.env","/artifacts/wp15/test.env","/.private/receipts/.owner.json","/.next-wp14/server/server-reference-manifest.json","/.next-wp15/server/server-reference-manifest.json"]){const r=await get(path);const body=await r.text();for(const value of forbidden)assert(!body.includes(value),path);assert(r.status===200||r.status===404);if(path.startsWith('/sq')||path.startsWith('/en')){const rr=await fetch(new URL(path,origin),{headers:{RSC:"1"}});for(const value of forbidden)assert(!(await rr.clone().text()).includes(value));}}
  let files=0;async function scan(dir:string){for(const name of await readdir(dir)){const path=join(dir,name),stat=await lstat(path);if(stat.isDirectory())await scan(path);else if(/\.(js|css|html|rsc|map|svg|json)$/.test(name)){const data=await readFile(path);for(const value of forbidden)assert(!data.includes(Buffer.from(value)),path);files++;}}}
  await scan(`${build}/static`);await scan(`${build}/server/app/sq`);await scan(`${build}/server/app/en`);
  const publicResponse=await get("/sq"),html=await publicResponse.text(),scripts=[...html.matchAll(/src="([^\"]+\.js[^\"]*)"/g)].map(m=>m[1]);for(const path of scripts){const r=await get(path);assert.equal(r.status,200);const data=await r.text();for(const value of forbidden)assert(!data.includes(value));assert.equal((await get(path+".map")).status,404);}
  await writeFile(`${evidence}/leak-scan.json`,JSON.stringify({files,syntheticSentinels:forbidden.length,publicScriptRequests:scripts.length,leaks:0}));
 });
 await t.test("browser policy, private nonces, no-store and safe escaping survive actual HTTP rendering",async()=>{
  for(const path of ["/sq","/login","/app",`/app/clients/${xssClient.id}`]){const r=await get(path,f.token),html=await r.text();assert.equal(r.headers.get("x-frame-options"),"DENY");assert.equal(r.headers.get("x-content-type-options"),"nosniff");assert.equal(r.headers.get("cross-origin-resource-policy"),"same-origin");if(path.startsWith('/app')){const csp=r.headers.get("content-security-policy")!;assert.match(csp,/'nonce-[A-Za-z0-9+/=]+'/);assert(!csp.split(';').find(s=>s.trim().startsWith('script-src'))!.includes("'unsafe-inline'"));assert.match(r.headers.get("cache-control")!,/no-store/);}assert(!html.includes('<img src=x onerror='));}
  const a=(await get('/app',f.token)).headers.get('content-security-policy'),b=(await get('/app',f.token)).headers.get('content-security-policy');assert.notEqual(a,b);
 });
 await t.test("ZIP/PDF/XLSX require current authorization and never export authentication/storage sentinels",async()=>{
  for(const token of [undefined,expired.token,revoked.token,disabled.token]){const r=await post('/api/exports/business',{confirmation:'export-all'},token??'');assert.equal(r.status,401);}
  const r=await post('/api/exports/business',{confirmation:'export-all'});assert.equal(r.status,200);assert.match(r.headers.get('cache-control')!,/private.*no-store/);const zip=await JSZip.loadAsync(await r.arrayBuffer());let found=false;
  for(const [name,file]of Object.entries(zip.files)){assert(!name.includes('..'));if(!file.dir&&/\.(json|csv)$/.test(name)){const text=await file.async('string');found ||=text.includes(canary);for(const secret of [f.token,tokenDigest(f.token),f.password,process.env.ADORE_OPERATOR_KEY!,process.env.DATABASE_URL!])assert(!text.includes(secret));assert.doesNotMatch(text,/"(?:passwordHash|tokenHash|storageReference|authVersion)"/);}}
  assert(found);assert.equal((await get('/api/exports/business',f.token)).status,405);assert.equal((await get('/'+r.headers.get('x-export-id'))).status,404);
  for(const format of ['pdf','xlsx']){const file=await post('/api/reports/company',{format,filters:{}});assert.equal(file.status,200);assert.match(file.headers.get('cache-control')!,/private.*no-store/);}
 });

 }finally{await f.close();}
});
