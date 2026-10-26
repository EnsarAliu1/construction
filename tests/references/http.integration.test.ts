import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { referenceKinds, type ReferenceKind } from "../../src/features/references/model";
import { localDatabaseOptions } from "../../src/server/db/config";
import { trustedOrigin } from "../../src/server/auth/security";
import { setAccountActive } from "../../src/server/auth/accounts";
import { mysqlSkip, referenceFixture } from "./fixtures";

test("real HTTP reference-data pages, lifecycle, validation and privacy",{skip:mysqlSkip,timeout:120_000},async t=>{
  const origin=trustedOrigin();assert.ok(["localhost","127.0.0.1","[::1]"].includes(origin.hostname));
  const app=localDatabaseOptions(process.env.DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE),db=localDatabaseOptions(process.env.TEST_DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE);assert.ok(app.host===db.host&&app.port===db.port&&app.database===db.database);
  const f=await referenceFixture(),cookie=`__Host-fitimi_session=${f.token}`,ids=new Map<ReferenceKind,string>();
  const read=(path:string,session=cookie)=>fetch(new URL(path,origin),{redirect:"manual",headers:session?{Cookie:session}:{}});
  const write=(path:string,method:string,body:object,session=cookie,requestOrigin=origin.origin)=>fetch(new URL(path,origin),{method,redirect:"manual",headers:{Origin:requestOrigin,"Content-Type":"application/json",...(session?{Cookie:session}:{})},body:JSON.stringify(body)});
  try{
    for(const kind of referenceKinds){
      const api=`/api/references/${kind}`,path=`/app/${kind}`,field=kind==="vehicles"?"identifier":"name";
      await t.test(`${kind}: anonymous pages and every endpoint deny access`,async()=>{
        const id=randomUUID();for(const page of [path,`${path}/new`,`${path}/${id}`,`${path}/${id}/edit`])assert.equal((await read(page,"")).status,307);
        for(const response of [await read(api,""),await read(`${api}/active`,""),await read(`${api}/${id}`,""),await write(api,"POST",{},""),await write(`${api}/${id}`,"PUT",{},""),await write(`${api}/${id}/lifecycle`,"POST",{},"")])assert.equal(response.status,401);
      });
      let label=`${f.prefix}-${kind}-HTTP`,version=1;
      await t.test(`${kind}: create and render actual list/details/create/edit forms`,async()=>{
        const response=await write(api,"POST",f.referenceInput(kind,label));assert.equal(response.status,201);assert.ok(response.headers.get("cache-control")?.includes("no-store"));const body=await response.json();ids.set(kind,body.record.id);
        const id=ids.get(kind)!;for(const page of [path,`${path}/new`,`${path}/${id}`,`${path}/${id}/edit`]){const result=await read(page);assert.equal(result.status,200);const html=await result.text();assert.match(html,/<h1/);assert.ok(!html.includes(f.token)&&!html.includes(f.password));assert.match(html,new RegExp(`<a\\b(?=[^>]*href="${path}")(?=[^>]*aria-current="page")[^>]*>`));if(page.endsWith("/new")||page.endsWith("/edit")){assert.ok(html.includes(`for="reference-${field}"`));assert.ok(html.includes(`name="${field}"`));}}
      });
      await t.test(`${kind}: field errors, duplicate policy, protected fields and body limits`,async()=>{
        const blank=await write(api,"POST",f.referenceInput(kind," "));assert.equal(blank.status,400);assert.ok((await blank.json()).fields[field]);
        for(const key of ["createdBy","isActive","deactivatedAt","version","password"]){const response=await write(api,"POST",{...f.referenceInput(kind),[key]:f.password});assert.equal(response.status,400);assert.ok(!(await response.text()).includes(f.password));}
        const duplicate=await write(api,"POST",f.referenceInput(kind,label.toUpperCase()));assert.equal(duplicate.status,kind==="persons"?201:409);
        const huge=await write(api,"POST",f.referenceInput(kind," ".repeat(132000)+"Synthetic normalized name"));assert.equal(huge.status,400);assert.equal((await huge.json()).code,"BODY");
        assert.equal((await read(`${api}?page=-1`)).status,400);assert.equal((await read(`${api}/${randomUUID()}`)).status,404);assert.equal((await read(`${path}/${randomUUID()}`)).status,404);
      });
      await t.test(`${kind}: edits escape text, retain history and reject stale versions/forged origins`,async()=>{
        const id=ids.get(kind)!;label=`${f.prefix}-${kind}-<script>reference</script>`;
        const response=await write(`${api}/${id}`,"PUT",{version,record:f.referenceInput(kind,label)});assert.equal(response.status,200);version=(await response.json()).record.version;assert.equal(version,2);
        assert.equal((await write(`${api}/${id}`,"PUT",{version:1,record:f.referenceInput(kind,label)})).status,409);
        const html=await(await read(`${path}/${id}`)).text();assert.ok(html.includes("&lt;script&gt;reference&lt;/script&gt;")&&!html.includes("<script>reference</script>"));assert.match(html,/Audit history/);
        for(const [endpoint,method,payload]of [[api,"POST",f.referenceInput(kind)],[`${api}/${id}`,"PUT",{version,record:f.referenceInput(kind,label)}],[`${api}/${id}/lifecycle`,"POST",{version,action:"deactivate",confirmation:"deactivate"}]]as const)assert.equal((await write(endpoint,method,payload,cookie,"https://untrusted.example.invalid")).status,403);
      });
      await t.test(`${kind}: explicit lifecycle, inactive correction and minimal active selectors`,async()=>{
        const id=ids.get(kind)!;assert.equal((await write(`${api}/${id}/lifecycle`,"POST",{version,action:"deactivate"})).status,400);
        const deactivated=await write(`${api}/${id}/lifecycle`,"POST",{version,action:"deactivate",confirmation:"deactivate"});assert.equal(deactivated.status,200);let body=await deactivated.json();version=body.record.version;assert.equal(body.record.isActive,false);
        const selected=await read(`${api}/active?q=${encodeURIComponent(label)}`);assert.ok(!(await selected.json()).rows.some((row:{id:string})=>row.id===id));
        const inactive=await read(`${api}?status=inactive&q=${encodeURIComponent(label)}`);assert.ok((await inactive.json()).rows.some((row:{id:string})=>row.id===id));
        const page=await read(`${path}/${id}/edit`);assert.match(await page.text(),/Editing its information does not reactivate/);
        const correction=await write(`${api}/${id}`,"PUT",{version,record:f.referenceInput(kind,label)});assert.equal(correction.status,200);body=await correction.json();version=body.record.version;assert.equal(body.record.isActive,false);
        const reactivated=await write(`${api}/${id}/lifecycle`,"POST",{version,action:"reactivate",confirmation:"reactivate"});assert.equal(reactivated.status,200);body=await reactivated.json();version=body.record.version;assert.equal(body.record.isActive,true);
        const active=await read(`${api}/active?q=${encodeURIComponent(label)}`);const match=(await active.json()).rows.find((row:{id:string})=>row.id===id);assert.ok(match);assert.deepEqual(Object.keys(match).sort(),["id","label","version"]);
        const history=await read(`${api}/${id}`);assert.equal((await history.json()).history.length,5);
      });
    }
    await t.test("unknown kinds/sections cannot expose another module or accept arbitrary table names",async()=>{
      assert.equal((await read("/api/references/users")).status,404);assert.equal((await read("/app/accounts/new")).status,404);assert.equal((await read("/api/references/users","")).status,401);
    });
    await t.test("database audit failures return redacted errors and leave no business record",async()=>{
      const trigger=`wp06_http_failure_${randomUUID().replaceAll("-","")}`;await f.connection.query(`CREATE TRIGGER \`${trigger}\` BEFORE INSERT ON audit_events FOR EACH ROW BEGIN IF NEW.entity_type IN ('expense_category','person','vehicle') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic private SQL detail'; END IF; END`);
      try{for(const kind of referenceKinds){const label=`${f.prefix}-${kind}-private-failure`,response=await write(`/api/references/${kind}`,"POST",f.referenceInput(kind,label));assert.equal(response.status,503);const body=await response.text();assert.ok(!body.includes(label)&&!body.includes("Synthetic private SQL")&&!body.includes("INSERT INTO")&&!body.includes(f.password));const result=await read(`/api/references/${kind}?q=${encodeURIComponent(label)}`);assert.equal((await result.json()).total,0);}}finally{await f.connection.query(`DROP TRIGGER \`${trigger}\``);}
    });
    await t.test("disabled sessions lose all pages, historical reads, selectors and mutation access",async()=>{
      await setAccountActive(f.connection,f.operator,f.email,false);
      for(const kind of referenceKinds){const id=ids.get(kind)!,api=`/api/references/${kind}`,path=`/app/${kind}`;for(const page of [path,`${path}/new`,`${path}/${id}`,`${path}/${id}/edit`])assert.equal((await read(page)).status,307);for(const response of [await read(api),await read(`${api}/active`),await read(`${api}/${id}`),await write(api,"POST",{}),await write(`${api}/${id}`,"PUT",{}),await write(`${api}/${id}/lifecycle`,"POST",{})])assert.equal(response.status,401);}
    });
  }finally{await f.close();}
});
