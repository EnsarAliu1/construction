import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { request as httpRequest } from "node:http";
import type { RowDataPacket } from "mysql2/promise";
import { localDatabaseOptions } from "../../src/server/db/config";
import { trustedOrigin } from "../../src/server/auth/security";
import { setAccountActive } from "../../src/server/auth/accounts";
import { expenseFixture, mysqlSkip } from "./fixtures";

test("real expense HTTP pages, registration, correction, cancellation and security",{skip:mysqlSkip,timeout:120_000},async t=>{
  const origin=trustedOrigin();assert.ok(["localhost","127.0.0.1","[::1]"].includes(origin.hostname));
  const app=localDatabaseOptions(process.env.DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE),db=localDatabaseOptions(process.env.TEST_DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE);assert.ok(app.host===db.host&&app.port===db.port&&app.database===db.database);
  const f=await expenseFixture(),cookie=`__Host-fitimi_session=${f.token}`,api="/api/expenses",path="/app/expenses";let id="",version=1;
  const read=(url:string,session=cookie)=>fetch(new URL(url,origin),{redirect:"manual",headers:session?{Cookie:session}:{}});
  const write=(url:string,method:string,body:object,session=cookie,requestOrigin=origin.origin,host=origin.host)=>fetch(new URL(url,origin),{method,redirect:"manual",headers:{Origin:requestOrigin,Host:host,"Content-Type":"application/json",...(session?{Cookie:session}:{})},body:JSON.stringify(body)});
  // Undici fetch overrides Host; native HTTP sends the hostile header on the wire.
  const forgedHost=(url:string,method:string,body:object)=>new Promise<number>((resolve,reject)=>{const request=httpRequest(new URL(url,origin),{method,headers:{Host:"untrusted.example.invalid",Origin:origin.origin,Cookie:cookie,"Content-Type":"application/json"}},response=>{response.resume();response.on("end",()=>resolve(response.statusCode!));});request.on("error",reject);request.end(JSON.stringify(body));});
  try{
    await t.test("anonymous users are denied all screens and service endpoints",async()=>{
      const id=randomUUID();for(const page of [path,`${path}/new`,`${path}/${id}`,`${path}/${id}/edit`])assert.equal((await read(page,"")).status,307);
      for(const response of [await read(api,""),await read(`${api}/projects`,""),await read(`${api}/${id}`,""),await write(api,"POST",{},""),await write(`${api}/${id}`,"PUT",{},""),await write(`${api}/${id}/cancel`,"POST",{},"")])assert.equal(response.status,401);
    });
    await t.test("register exact company-wide expense and render working guarded screens",async()=>{
      const response=await write(api,"POST",f.expenseInput({amount:"99999999999999999.99",description:`${f.prefix}-<script>expense</script>`}));assert.equal(response.status,201);assert.ok(response.headers.get("cache-control")?.includes("no-store"));const body=await response.json();id=body.record.id;assert.equal(body.record.amount,"99999999999999999.99");assert.equal(body.record.projectId,null);
      for(const page of [path,`${path}/new`,`${path}/${id}`,`${path}/${id}/edit`]){const response=await read(page);assert.equal(response.status,200);const html=await response.text();assert.match(html,/<h1/);assert.match(html,/<a\b(?=[^>]*href="\/app\/expenses")(?=[^>]*aria-current="page")[^>]*>/);assert.ok(!html.includes(f.password)&&!html.includes(f.token));if(page.endsWith("/new")||page.endsWith("/edit")){for(const field of ["amount","transactionDate","description","category","project","person","vehicle"])assert.ok(html.includes(`for="expense-${field}"`));assert.match(html,/Company-wide|company-wide/);}if(page===`${path}/${id}`){assert.ok(html.includes("&lt;script&gt;expense&lt;/script&gt;")&&!html.includes("<script>expense</script>"));assert.match(html,/Audit history/);}}
    });
    await t.test("server field validation, protected fields, request bounds, origins and hosts enforced",async()=>{
      const invalid=await write(api,"POST",f.expenseInput({amount:"1.001"}));assert.equal(invalid.status,400);assert.ok((await invalid.json()).fields.amount);
      for(const field of ["createdBy","cancelledBy","version","status","clientId","currency","password"]){const result=await write(api,"POST",{...f.expenseInput(),[field]:f.password});assert.equal(result.status,400);assert.ok(!(await result.text()).includes(f.password));}
      assert.equal((await write(api,"POST",f.expenseInput({description:" ".repeat(132000)+"Synthetic"}))).status,400);
      for(const [url,method,body]of [[api,"POST",f.expenseInput()],[`${api}/${id}`,"PUT",{version,confirmation:"correct",expense:f.expenseInput()}],[`${api}/${id}/cancel`,"POST",{version,confirmation:"cancel",reason:"Synthetic"}]]as const){assert.equal((await write(url,method,body,cookie,"https://untrusted.example.invalid")).status,403);assert.equal(await forgedHost(url,method,body),403);}
      assert.equal((await read(`${api}?q=${"a".repeat(101)}`)).status,400);assert.equal((await read(`${api}?from=2024-02-30`)).status,400);
    });
    await t.test("inline category creates atomically, gives duplicate conflict and exposes no internal fields",async()=>{
      const name=`${f.prefix}-HTTP-inline`,response=await write(api,"POST",f.expenseInput({category:null,newCategoryName:name}));assert.equal(response.status,201);const row=(await response.json()).record;assert.ok(row.categoryId);assert.equal((await write(api,"POST",f.expenseInput({category:null,newCategoryName:name.toUpperCase()}))).status,409);
      const project=await f.fresh(),result=await write(api,"POST",f.expenseInput({project:f.selection(project.project)}));assert.equal(result.status,201);
      const choices=await read(`${api}/projects?q=${encodeURIComponent(f.prefix)}`);assert.equal(choices.status,200);const body=await choices.json();assert.ok(body.rows.length<=20);assert.deepEqual(Object.keys(body.rows[0]).sort(),["id","label","version"]);
    });
    await t.test("date/category/company-wide filters return stored records with bounded pages",async()=>{
      const result=await read(`${api}?categoryId=${f.category.id}&projectId=company&from=2024-02-29&to=2024-02-29&q=${encodeURIComponent(f.prefix)}`);assert.equal(result.status,200);const body=await result.json();assert.ok(body.rows.some((row:{record:{id:string}})=>row.record.id===id));assert.ok(body.rows.length<=20);assert.equal(body.pageSize,20);
      assert.equal((await read(`${path}?categoryId=${f.category.id}&projectId=company&from=2024-02-29`)).status,200);
      const invalid=await read(`${path}?from=2025-02-30`);assert.equal(invalid.status,200);assert.match(await invalid.text(),/Clear filters/);
    });
    await t.test("confirmed correction keeps links and history, rejects stale or missing confirmation",async()=>{
      const expense=f.expenseInput({amount:"0.10",description:"Synthetic corrected outgoing payment"});assert.equal((await write(`${api}/${id}`,"PUT",{version,expense})).status,400);
      const response=await write(`${api}/${id}`,"PUT",{version,confirmation:"correct",expense});assert.equal(response.status,200);version=(await response.json()).record.version;assert.equal(version,2);
      assert.equal((await write(`${api}/${id}`,"PUT",{version:1,confirmation:"correct",expense})).status,409);
      const data=await(await read(`${api}/${id}`)).json();assert.equal(data.history.length,2);assert.equal(data.history[0].before.amount,"99999999999999999.99");assert.equal(data.record.categoryId,f.category.id);
    });
    await t.test("database failures are redacted and failed inline expense leaves no category/audit",async()=>{
      const trigger=`wp07_http_failure_${randomUUID().replaceAll("-","")}`,name=`${f.prefix}-http-private-rollback`;
      await f.connection.query(`CREATE TRIGGER \`${trigger}\` BEFORE INSERT ON audit_events FOR EACH ROW BEGIN IF NEW.entity_type='expense' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic private SQL'; END IF; END`);
      try{const response=await write(api,"POST",f.expenseInput({category:null,newCategoryName:name}));assert.equal(response.status,503);const body=await response.text();for(const secret of [name,f.password,"Synthetic private SQL","INSERT INTO"])assert.ok(!body.includes(secret));const [rows]=await f.connection.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM expense_categories WHERE name=?",[name]);assert.equal(Number(rows[0].total),0);
        for(const [url,method,payload]of [[`${api}/${id}`,"PUT",{version,confirmation:"correct",expense:f.expenseInput()}],[`${api}/${id}/cancel`,"POST",{version,confirmation:"cancel",reason:"Synthetic"}]]as const)assert.equal((await write(url,method,payload)).status,503);
        assert.equal((await(await read(`${api}/${id}`)).json()).record.version,version);
      }finally{await f.connection.query(`DROP TRIGGER \`${trigger}\``);}
    });
    await t.test("cancellation is confirmed, visible historically and read-only with no DELETE workflow",async()=>{
      assert.equal((await write(`${api}/${id}/cancel`,"POST",{version,reason:"Synthetic"})).status,400);
      const response=await write(`${api}/${id}/cancel`,"POST",{version,confirmation:"cancel",reason:"Synthetic duplicate recorded payment"});assert.equal(response.status,200);version=(await response.json()).record.version;assert.equal(version,3);
      const body=await(await read(`${api}/${id}`)).json();assert.equal(body.record.status,"cancelled");assert.equal(body.history.length,3);assert.equal(body.record.cancelledBy,f.userId);assert.ok(body.record.cancelledAt);
      assert.equal((await write(`${api}/${id}/cancel`,"POST",{version,confirmation:"cancel",reason:"Synthetic"})).status,409);assert.equal((await write(`${api}/${id}`,"PUT",{version,confirmation:"correct",expense:f.expenseInput()})).status,409);
      const html=await(await read(`${path}/${id}`)).text();assert.match(html,/CANCELLED/);assert.ok(!html.includes(">Correct expense<"));assert.match(await(await read(`${path}/${id}/edit`)).text(),/read-only/);
      assert.equal((await write(`${api}/${id}`,"DELETE",{})).status,405);assert.ok(!(await(await read(api)).json()).rows.some((row:{record:{id:string}})=>row.record.id===id));assert.ok((await(await read(`${api}?status=cancelled&q=${encodeURIComponent(f.prefix)}`)).json()).rows.some((row:{record:{id:string}})=>row.record.id===id));
    });
    await t.test("unknown records return safe 404 and disabled users lose every expense operation",async()=>{
      const unknown=randomUUID();assert.equal((await read(`${api}/${unknown}`)).status,404);assert.equal((await read(`${path}/${unknown}`)).status,404);assert.equal((await read(`${path}/${unknown}/edit`)).status,404);
      await setAccountActive(f.connection,f.operator,f.email,false);
      for(const page of [path,`${path}/new`,`${path}/${id}`,`${path}/${id}/edit`])assert.equal((await read(page)).status,307);
      for(const response of [await read(api),await read(`${api}/projects`),await read(`${api}/${id}`),await write(api,"POST",f.expenseInput()),await write(`${api}/${id}`,"PUT",{}),await write(`${api}/${id}/cancel`,"POST",{})])assert.equal(response.status,401);
    });
  }finally{await f.close();}
});
