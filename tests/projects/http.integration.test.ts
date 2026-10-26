import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { projectFixture, mysqlSkip, plan } from "./fixtures";
import { getProject } from "../../src/features/projects/service";
import { setAccountActive } from "../../src/server/auth/accounts";
import { trustedOrigin } from "../../src/server/auth/security";
import { localDatabaseOptions } from "../../src/server/db/config";

test("production-build HTTP project/contract workflows and authorization", { skip:mysqlSkip,timeout:120_000 }, async t=>{
  const origin=trustedOrigin();assert.ok(["localhost","127.0.0.1","[::1]"].includes(origin.hostname));
  const app=localDatabaseOptions(process.env.DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE),db=localDatabaseOptions(process.env.TEST_DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE);assert.ok(app.host===db.host&&app.port===db.port&&app.database===db.database);
  const f=await projectFixture();const cookie=`__Host-fitimi_session=${f.token}`;
  const read=(path:string,session=cookie)=>fetch(new URL(path,origin),{redirect:"manual",headers:session?{Cookie:session}:{}});
  const write=(path:string,method:string,body:object,session=cookie,requestOrigin=origin.origin)=>fetch(new URL(path,origin),{method,redirect:"manual",headers:{Origin:requestOrigin,"Content-Type":"application/json",...(session?{Cookie:session}:{})},body:JSON.stringify(body)});
  let id="";
  try{
    await t.test("anonymous pages redirect and every read/write endpoint denies access",async()=>{
      const id=randomUUID();for(const path of ["/app/projects","/app/projects/new",`/app/projects/${id}`,`/app/projects/${id}/edit`,`/app/projects/${id}/contract`])assert.equal((await read(path,"")).status,307);
      for(const response of [await read("/api/projects",""),await read("/api/projects/clients",""),await read(`/api/projects/${id}`,""),await write("/api/projects","POST",{},""),await write(`/api/projects/${id}`,"PUT",{},""),await write(`/api/projects/${id}/contract`,"PUT",{},"")])assert.equal(response.status,401);
    });
    await t.test("create consistent aggregate and render actual labeled pages with nested navigation",async()=>{
      const response=await write("/api/projects","POST",f.initial({name:`${f.prefix} HTTP Site`}));assert.equal(response.status,201);id=(await response.json()).project.id;
      assert.ok(response.headers.get("cache-control")?.includes("no-store"));
      for(const path of ["/app/projects","/app/projects/new",`/app/projects/${id}`,`/app/projects/${id}/edit`,`/app/projects/${id}/contract`]){
        const page=await read(path);assert.equal(page.status,200);const html=await page.text();assert.match(html,/<h1/);assert.match(html,/<a\b(?=[^>]*href="\/app\/projects")(?=[^>]*aria-current="page")[^>]*>/);assert.ok(!html.includes(f.token)&&!html.includes(f.password));
        if(path.endsWith("contract")){assert.match(html,/for="contract-total"/);assert.match(html,/Save contract/);assert.match(html,/Active paid/);}
        if(path===`/app/projects/${id}`){assert.ok(html.includes(`/app/clients/${f.client.id}`));assert.match(html,/100.00/);assert.match(html,/Remaining capacity/);}
      }
    });
    await t.test("server validation, protected fields, request size and CSRF reject invalid changes",async()=>{
      for(const extra of [{name:" "},{status:"other"},{startDate:"2023-02-29"},{clientId:randomUUID()},{createdBy:randomUUID()}])assert.equal((await write("/api/projects","POST",f.initial(extra))).status,400);
      const detail=await getProject(f.connection,f.token,id),payload=plan(detail);payload.totalValue="101.00";assert.equal((await write(`/api/projects/${id}/contract`,"PUT",payload)).status,400);
      const oversized={project:f.projectInput(),contract:{totalValue:"0.00",phases:Array.from({length:100},(_,index)=>({name:`Synthetic bounded phase ${index}`,description:"x".repeat(1500),value:"0.00",sortOrder:index}))}};
      const tooLarge=await write("/api/projects","POST",oversized);assert.equal(tooLarge.status,400);assert.equal((await tooLarge.json()).code,"BODY");
      for(const [path,method,body]of [["/api/projects","POST",f.initial()],[`/api/projects/${id}`,"PUT",{project:f.projectInput(),version:1}],[`/api/projects/${id}/contract`,"PUT",plan(detail)]]as const)assert.equal((await write(path,method,body,cookie,"https://untrusted.example.invalid")).status,403);
      assert.equal((await read(`/api/projects/${randomUUID()}`)).status,404);assert.equal((await read(`/app/projects/${randomUUID()}`)).status,404);
    });
    await t.test("real list/client lookup search, status and client filters work",async()=>{
      const result=await read(`/api/projects?q=${encodeURIComponent(`${f.prefix} HTTP Site`)}&status=active&clientId=${f.client.id}`);const body=await result.json();assert.equal(body.total,1);assert.equal(body.rows[0].id,id);
      const empty=await read(`/app/projects?q=${randomUUID()}`);assert.match(await empty.text(),/No matching projects/);
      const clients=await read(`/api/projects/clients?q=${encodeURIComponent(f.client.name)}`);assert.ok((await clients.json()).rows.some((row:{id:string})=>row.id===f.client.id));
    });
    await t.test("project edit/status update and stale update preserve audit and version",async()=>{
      const response=await write(`/api/projects/${id}`,"PUT",{version:1,project:f.projectInput({status:"completed",name:`${f.prefix} <script>synthetic</script>`})});assert.equal(response.status,200);assert.equal((await response.json()).project.version,2);
      assert.equal((await write(`/api/projects/${id}`,"PUT",{version:1,project:f.projectInput()})).status,409);
      const html=await(await read(`/app/projects/${id}`)).text();assert.ok(html.includes("&lt;script&gt;synthetic&lt;/script&gt;")&&!html.includes("<script>synthetic</script>"));assert.match(html,/project updated/);
    });
    await t.test("capacity/equality and paid removal are enforced through the combined endpoint",async()=>{
      const detail=await getProject(f.connection,f.token,id),payment=randomUUID();await f.connection.execute("INSERT INTO payments(id,project_id,amount,transaction_date,method) VALUES(?,?,'30.00','2026-01-01','cash')",[payment,id]);await f.connection.execute("INSERT INTO payment_allocations(id,payment_id,phase_id,amount) VALUES(?,?,?,'30.00')",[randomUUID(),payment,detail.phases[0].id]);
      const payload=plan(detail);payload.phases[0].value="29.99";payload.totalValue="69.99";assert.equal((await write(`/api/projects/${id}/contract`,"PUT",payload)).status,409);
      payload.phases[0].value="30.00";payload.totalValue="70.00";assert.equal((await write(`/api/projects/${id}/contract`,"PUT",payload)).status,200);
      assert.equal((await write(`/api/projects/${id}/contract`,"PUT",payload)).status,409);
      const current=await getProject(f.connection,f.token,id);assert.equal(current.phaseTotal,"70.00");assert.equal(current.phases[0].paid,"30.00");assert.equal(current.phases[0].remaining,"0.00");
      const removed=plan(current);const first=removed.phases.shift()!;removed.deletedPhases=[{id:first.id,version:first.version}];removed.totalValue="40.00";assert.equal((await write(`/api/projects/${id}/contract`,"PUT",removed)).status,409);
      const eligible=plan(current);const last=eligible.phases.pop()!;eligible.deletedPhases=[{id:last.id,version:last.version}];eligible.totalValue="30.00";assert.equal((await write(`/api/projects/${id}/contract`,"PUT",eligible)).status,200);
      const retained=await read(`/api/projects/${id}`);assert.ok((await retained.json()).history.some((row:{action:string})=>row.action==="phase_archived"));
    });
    await t.test("disabled session loses pages, client lookup, reads and every mutation",async()=>{
      await setAccountActive(f.connection,f.operator,f.email,false);
      for(const path of ["/app/projects","/app/projects/new",`/app/projects/${id}`,`/app/projects/${id}/edit`,`/app/projects/${id}/contract`])assert.equal((await read(path)).status,307);
      for(const response of [await read("/api/projects"),await read("/api/projects/clients"),await read(`/api/projects/${id}`),await write("/api/projects","POST",f.initial()),await write(`/api/projects/${id}`,"PUT",{}),await write(`/api/projects/${id}/contract`,"PUT",{})])assert.equal(response.status,401);
    });
  }finally{await f.close();}
});
