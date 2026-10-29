import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { Connection, RowDataPacket } from "mysql2/promise";
import { createProject, getProject, listProjects, saveContract, updateProject, chooseClients } from "../../src/features/projects/service";
import { ProjectError } from "../../src/features/projects/validation";
import { archiveClient, createClient } from "../../src/features/clients/service";
import { setAccountActive } from "../../src/server/auth/accounts";
import { AuthenticationRequired } from "../../src/server/auth/security";
import { mysqlSkip, plan, projectFixture } from "./fixtures";

test("real MySQL project/contract aggregates, allocation capacity, concurrency and history", { skip: mysqlSkip, timeout: 120_000 }, async t => {
  const f = await projectFixture(), c = f.connection;
  const fails = (code: string) => (error: unknown) => error instanceof ProjectError && error.code === code;
  async function fixtureAllocation(projectId: string, phaseId: string, amount: string, cancelled = false) {
    const payment = randomUUID();
    await c.execute("INSERT INTO payments (id,project_id,amount,transaction_date,method,status,cancelled_at,cancellation_reason) VALUES (?,?,?,'2026-01-01','cash',?,?,?)", [payment, projectId, amount, cancelled ? "cancelled" : "received", cancelled ? "2026-01-02 00:00:00.000" : null, cancelled ? "Synthetic cancellation" : null]);
    await c.execute("INSERT INTO payment_allocations (id,payment_id,phase_id,amount) VALUES (?,?,?,?)", [randomUUID(),payment,phaseId,amount]); return payment;
  }
  try {
    await t.test("creation persists project/client/contract/phases together with actor and shared correlation", async () => {
      const detail = await f.fresh(); assert.equal(detail.project.clientId, f.client.id); assert.equal(detail.contract!.status,"active"); assert.equal(detail.phaseTotal,"100.00"); assert.equal(detail.phases[0].paid,"0.00"); assert.equal(detail.phases[0].remaining,"60.00");
      assert.equal(detail.history.length,4); assert.equal(new Set(detail.history.map(event=>event.operationId)).size,1); assert.equal(detail.project.createdBy,f.userId); assert.equal(detail.contract!.createdBy,f.userId);
      assert.ok(detail.history.every(event=>event.actorName==="Synthetic Clients User"));
    });
    await t.test("archived, invalid and stale client references and unequal initial totals write nothing", async () => {
      const client = await createClient(c,f.token,f.input({name:`${f.prefix} Arkivuar`})); await archiveClient(c,f.token,client.id,1,"archive");
      for (const extra of [{clientId:client.id,clientVersion:2},{clientId:randomUUID()},{clientVersion:99}]) await assert.rejects(createProject(c,f.token,f.initial(extra)));
      const [before]=await c.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM projects"); const payload=f.initial(); payload.contract.totalValue="101.00";
      await assert.rejects(createProject(c,f.token,payload),fails("TOTAL")); const [after]=await c.query<RowDataPacket[]>("SELECT COUNT(*) AS total FROM projects"); assert.equal(after[0].total,before[0].total);
      assert.ok(!(await chooseClients(c,f.token,client.name)).some(row=>row.id===client.id));
    });
    await t.test("project edits/status/date validation and stale versions are enforced", async () => {
      const detail=await f.fresh();
      const updated=await updateProject(c,f.token,detail.project.id,{version:1,project:f.projectInput({status:"suspended",name:`${f.prefix} Pezulluar`})}); assert.equal(updated.version,2); assert.equal(updated.status,"suspended");
      await assert.rejects(updateProject(c,f.token,updated.id,{version:1,project:f.projectInput()}),fails("CONFLICT"));
      for(const extra of [{status:"other"},{startDate:"2023-02-29"},{endDate:"2025-01-01"}]) await assert.rejects(updateProject(c,f.token,updated.id,{version:2,project:f.projectInput(extra)}));
      assert.ok((await getProject(c,f.token,updated.id)).history.some(row=>row.action==="project_updated"));
    });
    await t.test("project search/status/client filtering and 20-row pagination use real records", async () => {
      const marker=`${f.prefix} Paged`;
      for(let index=0;index<21;index++) await f.fresh({name:`${marker} ${String(index).padStart(2,"0")}`,status:index===20?"completed":"active"});
      const first=await listProjects(c,f.token,{q:marker}),second=await listProjects(c,f.token,{q:marker,page:2}); assert.equal(first.total,21); assert.equal(first.rows.length,20); assert.equal(second.rows.length,1);
      assert.equal(new Set([...first.rows,...second.rows].map(row=>row.id)).size,21); assert.equal((await listProjects(c,f.token,{q:marker,status:"completed",clientId:f.client.id})).total,1);
      assert.equal((await listProjects(c,f.token,{q:marker,clientId:randomUUID()})).total,0); assert.equal((await listProjects(c,f.token,{q:f.client.name})).total>=21,true);
      assert.equal((await listProjects(c,f.token,{q:"' OR 1=1 --"})).total,0);
    });
    await t.test("completed historical relationships permit contract correction, but reactivation requires an active client", async () => {
      const old=await createClient(c,f.token,f.input({name:`${f.prefix} Historical parent`}));
      const detail=await f.fresh({clientId:old.id,clientVersion:old.version,status:"completed"});await archiveClient(c,f.token,old.id,old.version,"archive");
      const correction=plan(detail);correction.phases[0].name="Synthetic historical correction";await saveContract(c,f.token,detail.project.id,correction);
      await assert.rejects(updateProject(c,f.token,detail.project.id,{version:1,project:f.projectInput({clientId:old.id,clientVersion:2,status:"active"})}),fails("ARCHIVED_CLIENT"));
      const reassigned=await updateProject(c,f.token,detail.project.id,{version:1,project:f.projectInput({status:"active"})});assert.equal(reassigned.clientId,f.client.id);
      const saved=await getProject(c,f.token,detail.project.id);const change=saved.history.find(row=>row.action==="project_updated")!;assert.equal(change.before!.clientId,old.id);assert.equal(change.after!.clientId,f.client.id);assert.equal(saved.contract!.id,detail.contract!.id);
    });
    await t.test("combined edits increase/reduce values, descriptions and order with exact equality", async () => {
      let detail=await f.fresh(); const payload=plan(detail); payload.totalValue="120.30"; payload.phases[0].value="80.10"; payload.phases[1].value="40.20"; payload.phases[0].description="Synthetic correction"; payload.phases[0].sortOrder=1;payload.phases[1].sortOrder=0;
      await saveContract(c,f.token,detail.project.id,payload); detail=await getProject(c,f.token,detail.project.id);
      assert.equal(detail.phaseTotal,"120.30");assert.equal(detail.contract!.version,2);assert.equal(detail.phases[0].name,"Synthetic second"); assert.ok(detail.phases.some(row=>row.description==="Synthetic correction"));
      const reduce=plan(detail);reduce.phases[0].value="0.10";reduce.phases[1].value="0.20";reduce.totalValue="0.30";await saveContract(c,f.token,detail.project.id,reduce);assert.equal((await getProject(c,f.token,detail.project.id)).phaseTotal,"0.30");
    });
    await t.test("active allocations set the exact lower bound; cancelled payments are excluded", async () => {
      const detail=await f.fresh(), phase=detail.phases[0];await fixtureAllocation(detail.project.id,phase.id,"30.10");await fixtureAllocation(detail.project.id,phase.id,"9.90",true);
      const payload=plan(detail);payload.phases[0].value="30.09";payload.totalValue="70.09";await assert.rejects(saveContract(c,f.token,detail.project.id,payload),fails("CAPACITY"));
      payload.phases[0].value="30.10";payload.totalValue="70.10";await saveContract(c,f.token,detail.project.id,payload);
      const saved=await getProject(c,f.token,detail.project.id);assert.equal(saved.phases[0].paid,"30.10");assert.equal(saved.phases[0].remaining,"0.00");assert.equal(saved.phaseTotal,"70.10");
    });
    await t.test("eligible logical removal preserves cancelled allocation and issued receipt snapshots", async () => {
      const detail=await f.fresh(), first=detail.phases[0];const payment=await fixtureAllocation(detail.project.id,first.id,"10.00",true);
      const receipt=randomUUID(),version=randomUUID(); const snapshot=JSON.stringify({phaseId:first.id,value:"60.00",clientName:"Synthetic original client"});
      await c.execute("INSERT INTO payment_receipts(id,payment_id,receipt_number,status) VALUES(?,?,?,'issued')",[receipt,payment,`SYNTHETIC-${receipt}`]);
      await c.execute("INSERT INTO receipt_versions(id,receipt_id,version,content_snapshot,storage_reference,file_checksum,issued_at) VALUES(?,?,1,?,'synthetic/no-document',?,UTC_TIMESTAMP(3))",[version,receipt,snapshot,"a".repeat(64)]);
      const [before]=await c.execute<RowDataPacket[]>("SELECT * FROM receipt_versions WHERE id=?",[version]);
      const payload=plan(detail);payload.phases.shift();payload.deletedPhases=[{id:first.id,version:first.version}];payload.totalValue="40.00";await saveContract(c,f.token,detail.project.id,payload);
      const saved=await getProject(c,f.token,detail.project.id);assert.equal(saved.phases.length,1);assert.equal(saved.phaseTotal,"40.00");assert.ok(saved.history.some(row=>row.action==="phase_archived"));
      const [row]=await c.execute<RowDataPacket[]>("SELECT deleted_at,deleted_by,version FROM contract_phases WHERE id=?",[first.id]);assert.ok(row[0].deleted_at);assert.equal(row[0].deleted_by,f.userId);assert.equal(row[0].version,2);
      const [after]=await c.execute<RowDataPacket[]>("SELECT * FROM receipt_versions WHERE id=?",[version]);assert.deepEqual(after,before);
      const [links]=await c.execute<RowDataPacket[]>("SELECT phase_id FROM payment_allocations WHERE payment_id=?",[payment]);assert.equal(links[0].phase_id,first.id);
    });
    await t.test("paid removal, hidden omissions, foreign/duplicate/deleted identities and stale versions are rejected", async () => {
      const detail=await f.fresh(),foreign=await f.fresh();await fixtureAllocation(detail.project.id,detail.phases[0].id,"1.00");
      const removed=plan(detail);removed.phases.shift();removed.totalValue="40.00";removed.deletedPhases=[{id:detail.phases[0].id,version:1}];await assert.rejects(saveContract(c,f.token,detail.project.id,removed),fails("PAID_PHASE"));
      const wrong=plan(detail);wrong.phases[0].id=foreign.phases[0].id;await assert.rejects(saveContract(c,f.token,detail.project.id,wrong),fails("PHASE_SET"));
      const duplicate=plan(detail);duplicate.phases[1].id=duplicate.phases[0].id;await assert.rejects(saveContract(c,f.token,detail.project.id,duplicate),fails("DUPLICATE"));
      const stale=plan(detail);stale.phases[0].version=99;await assert.rejects(saveContract(c,f.token,detail.project.id,stale),fails("CONFLICT"));
      const omitted=plan(detail);omitted.phases.shift();omitted.totalValue="40.00";await assert.rejects(saveContract(c,f.token,detail.project.id,omitted),fails("PHASE_SET"));
      const wrongContract=plan(detail);wrongContract.contractId=foreign.contract!.id;await assert.rejects(saveContract(c,f.token,detail.project.id,wrongContract),fails("CONTRACT"));
    });
    await t.test("adding phases and deleting an unpaid phase require an explicitly balanced final total", async () => {
      const detail=await f.fresh(); const payload=plan(detail);
      const newPhase={name:"New synthetic phase",description:null,value:"0.25",sortOrder:2};
      await saveContract(c,f.token,detail.project.id,{...payload,totalValue:"100.25",phases:[...payload.phases,newPhase]});
      const current=await getProject(c,f.token,detail.project.id);assert.equal(current.phases.length,3);
      const remove=plan(current);const last=remove.phases.pop()!;remove.deletedPhases=[{id:last.id,version:last.version}];
      await assert.rejects(saveContract(c,f.token,detail.project.id,remove),fails("TOTAL"));remove.totalValue="100.00";await saveContract(c,f.token,detail.project.id,remove);
      const again=plan(await getProject(c,f.token,detail.project.id));again.deletedPhases=[{id:last.id,version:last.version+1}];await assert.rejects(saveContract(c,f.token,detail.project.id,again),fails("PHASE_SET"));
    });
    await t.test("two real users editing the same phase/contract have exactly one winner", async () => {
      const detail=await f.fresh(),other=await f.anotherUser();const a=plan(detail),b=plan(detail);a.phases[0].name="Synthetic editor A";b.phases[0].name="Synthetic editor B";
      const results=await Promise.allSettled([[f.token,a],[other.token,b]].map(([token,payload])=>f.independent(client=>saveContract(client,token as string,detail.project.id,payload))));
      assert.equal(results.filter(row=>row.status==="fulfilled").length,1);assert.ok(results.some(row=>row.status==="rejected"&&row.reason instanceof ProjectError&&row.reason.code==="CONFLICT"));const saved=await getProject(c,f.token,detail.project.id);assert.equal(saved.phaseTotal,saved.contract!.totalValue);assert.equal(saved.contract!.version,2);
    });
    await t.test("concurrent project edits cannot silently overwrite each other", async () => {
      const detail=await f.fresh();const outcomes=await Promise.allSettled(["active","completed"].map(status=>f.independent(client=>updateProject(client,f.token,detail.project.id,{version:1,project:f.projectInput({status})}))));assert.equal(outcomes.filter(row=>row.status==="fulfilled").length,1);assert.ok(outcomes.some(row=>row.status==="rejected"&&row.reason.code==="CONFLICT"));
    });
    await t.test("client archive racing project creation never leaves an active project under an archived client", async () => {
      for(let attempt=0;attempt<3;attempt++) {
        const parent=await createClient(c,f.token,f.input({name:`${f.prefix} Race ${attempt}`}));
        const results=await Promise.allSettled([f.independent(client=>createProject(client,f.token,f.initial({clientId:parent.id,clientVersion:1}))),f.independent(client=>archiveClient(client,f.token,parent.id,1,"archive"))]);assert.equal(results.filter(row=>row.status==="fulfilled").length,1);
        const [rows]=await c.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM projects p JOIN clients c ON p.client_id=c.id WHERE c.id=? AND c.deleted_at IS NOT NULL AND p.status='active' AND p.deleted_at IS NULL",[parent.id]);assert.equal(Number(rows[0].total),0);
      }
    });
    await t.test("allocation fixture and phase edits use compatible aggregate locks to prevent write skew", async () => {
      const detail=await f.fresh();const payload=plan(detail);payload.phases[0].value="20.00";payload.totalValue="60.00";
      // Test-only future-writer simulation, not a payment service or public endpoint.
      async function allocationWriter(client: Connection) {
        await client.beginTransaction();
        try {
          await client.execute("SELECT id FROM clients WHERE id=? FOR UPDATE",[detail.client.id]);await client.execute("SELECT id FROM projects WHERE id=? FOR UPDATE",[detail.project.id]);await client.execute("SELECT id FROM contracts WHERE id=? FOR UPDATE",[detail.contract!.id]);
          const [rows]=await client.execute<RowDataPacket[]>("SELECT id,value FROM contract_phases WHERE contract_id=? AND deleted_at IS NULL ORDER BY id FOR UPDATE",[detail.contract!.id]);const target=rows.find(row=>row.id===detail.phases[0].id)!;
          if(target.value==="20.00") throw new ProjectError("CAPACITY","Synthetic capacity rejected",409);
          const payment=randomUUID();await client.execute("INSERT INTO payments(id,project_id,amount,transaction_date,method) VALUES(?,?, '30.00','2026-01-01','cash')",[payment,detail.project.id]);await client.execute("INSERT INTO payment_allocations(id,payment_id,phase_id,amount) VALUES(?,?,?,'30.00')",[randomUUID(),payment,target.id]);await client.commit();
        }catch(error){await client.rollback();throw error;}
      }
      const results=await Promise.allSettled([f.independent(client=>saveContract(client,f.token,detail.project.id,payload)),f.independent(allocationWriter)]);assert.equal(results.filter(row=>row.status==="fulfilled").length,1);
      const saved=await getProject(c,f.token,detail.project.id);assert.equal(saved.phaseTotal,saved.contract!.totalValue);assert.ok(["20.00","60.00"].includes(saved.phases[0].value));assert.ok(saved.phases[0].remaining[0]!=="-");
    });
    await t.test("audit and phase persistence failures roll back the full initial/update aggregate", async () => {
      const detail=await f.fresh();
      for(const table of ["audit_events","contract_phases"] as const){
        const name=`wp05_failure_${randomUUID().replaceAll("-","")}`;
        await c.query(`CREATE TRIGGER \`${name}\` BEFORE INSERT ON ${table} FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic persistence failure'`);
        try {
          const marker=`${f.prefix} Rejected ${table}`;await assert.rejects(createProject(c,f.token,f.initial({name:marker})));assert.equal((await listProjects(c,f.token,{q:marker})).total,0);
          const payload=plan(detail);await assert.rejects(saveContract(c,f.token,detail.project.id,{...payload,totalValue:"100.01",phases:[...payload.phases,{name:"Synthetic rejected phase",value:"0.01",sortOrder:2}]}));
          const saved=await getProject(c,f.token,detail.project.id);assert.deepEqual(saved.contract,detail.contract);assert.deepEqual(saved.phases,detail.phases);assert.equal(saved.history.length,detail.history.length);
        }finally{await c.query(`DROP TRIGGER \`${name}\``);}
      }
      const [triggers]=await c.query<RowDataPacket[]>("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()");assert.equal(triggers.length,13);
    });
    await t.test("legacy projects support initial contract creation without invented prior history", async () => {
      const id=randomUUID();await c.execute("INSERT INTO projects(id,client_id,name) VALUES(?,?,?)",[id,f.client.id,`${f.prefix} Legacy`]);const detail=await getProject(c,f.token,id);assert.equal(detail.contract,null);assert.equal(detail.project.createdBy,null);
      await saveContract(c,f.token,id,{...plan(detail),totalValue:"0.00",phases:[]});assert.equal((await getProject(c,f.token,id)).contract!.totalValue,"0.00");
    });
    await t.test("anonymous/disabled reads and every mutation are denied independently", async () => {
      const detail=await f.fresh(); const operations=(token: string|undefined)=>[()=>listProjects(c,token),()=>chooseClients(c,token),()=>getProject(c,token,detail.project.id),()=>createProject(c,token,f.initial()),()=>updateProject(c,token,detail.project.id,{}),()=>saveContract(c,token,detail.project.id,plan(detail))];
      for(const operation of operations(undefined))await assert.rejects(operation(),AuthenticationRequired);
      await setAccountActive(c,f.operator,f.email,false);for(const operation of operations(f.token))await assert.rejects(operation(),AuthenticationRequired);
    });
  }finally{await f.close();}
});
