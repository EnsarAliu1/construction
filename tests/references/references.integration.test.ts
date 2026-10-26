import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import type { RowDataPacket } from "mysql2/promise";
import { referenceKinds, referenceDefinitions, type ReferenceKind } from "../../src/features/references/model";
import { createReference, updateReference, changeReferenceLifecycle, getReference, listReferences, selectActiveReferences, activeCategories, activePersons, activeVehicles } from "../../src/features/references/service";
import { ReferenceError } from "../../src/features/references/validation";
import { AuthenticationRequired } from "../../src/server/auth/security";
import { setAccountActive } from "../../src/server/auth/accounts";
import { referenceFixture, mysqlSkip } from "./fixtures";

test("MySQL categories/persons/vehicles lifecycle, retention, concurrency and atomic history",{skip:mysqlSkip,timeout:120_000},async t=>{
  const f=await referenceFixture(),c=f.connection;
  const lifecycle=(kind:ReferenceKind,id:string,version:number,action="deactivate")=>changeReferenceLifecycle(c,f.token,kind,id,{version,action,confirmation:action});
  const code=(value:string)=>(error:unknown)=>error instanceof ReferenceError&&error.code===value;
  try{
    for(const kind of referenceKinds){
      await t.test(`${kind}: real create/get/list/search and actor/version snapshots`,async()=>{
        const input=f.referenceInput(kind),row=await createReference(c,f.token,kind,input);assert.equal(row.version,1);assert.equal(row.isActive,true);assert.equal(row.createdBy,f.userId);
        const detail=await getReference(c,f.token,kind,row.id);assert.equal(detail.history.length,1);assert.equal(detail.history[0].before,null);assert.equal(detail.history[0].actorName,"Synthetic Clients User");assert.equal(detail.expenseReferences,0);
        assert.equal((await listReferences(c,f.token,kind,{q:row.label})).rows[0].id,row.id);
        const [events]=await c.execute<RowDataPacket[]>("SELECT actor_id,operation_id,after_snapshot FROM audit_events WHERE entity_type=? AND entity_id=?",[referenceDefinitions[kind].entity,row.id]);assert.equal(events[0].actor_id,f.userId);assert.ok(events[0].operation_id);assert.equal(events[0].after_snapshot.version,1);assert.ok(!Object.hasOwn(events[0].after_snapshot,"label"));
      });
      await t.test(`${kind}: required validation and protected input produce no writes`,async()=>{
        const bad={...f.referenceInput(kind),[kind==="vehicles"?"identifier":"name"]:" "};await assert.rejects(createReference(c,f.token,kind,bad),code("VALIDATION"));
        for(const key of ["createdBy","isActive","deactivatedAt","version"])await assert.rejects(createReference(c,f.token,kind,{...f.referenceInput(kind),[key]:true}),code("FIELDS"));
      });
      await t.test(`${kind}: safe duplicates follow existing identity rules without merging`,async()=>{
        const row=await createReference(c,f.token,kind,f.referenceInput(kind));const input=f.referenceInput(kind,row.label.toUpperCase());
        if(kind==="persons"){const duplicate=await createReference(c,f.token,kind,input);assert.ok(duplicate.id!==row.id);}else{await assert.rejects(createReference(c,f.token,kind,input),code("DUPLICATE"));await lifecycle(kind,row.id,1);await assert.rejects(createReference(c,f.token,kind,input),code("DUPLICATE"));}
      });
      await t.test(`${kind}: update, deactivate, inactive correction and explicit reactivation`,async()=>{
        let row=await createReference(c,f.token,kind,f.referenceInput(kind));const input=f.referenceInput(kind,`${row.label}-edited`);
        row=await updateReference(c,f.token,kind,row.id,{version:1,record:input});assert.equal(row.version,2);assert.equal(row.updatedBy,f.userId);
        await assert.rejects(changeReferenceLifecycle(c,f.token,kind,row.id,{version:2,action:"deactivate"}),code("CONFIRMATION"));
        row=await lifecycle(kind,row.id,2);assert.equal(row.isActive,false);assert.ok(row.deactivatedAt);assert.equal(row.deactivatedBy,f.userId);
        assert.equal((await selectActiveReferences(c,f.token,kind,row.label)).length,0);assert.equal((await listReferences(c,f.token,kind,{q:row.label,status:"inactive"})).total,1);
        await assert.rejects(lifecycle(kind,row.id,3),code("LIFECYCLE"));await assert.rejects(updateReference(c,f.token,kind,row.id,{version:2,record:input}),code("CONFLICT"));
        row=await updateReference(c,f.token,kind,row.id,{version:3,record:input});assert.equal(row.isActive,false);
        row=await lifecycle(kind,row.id,4,"reactivate");assert.equal(row.isActive,true);assert.equal(row.deactivatedAt,null);assert.equal(row.deactivatedBy,null);
        const detail=await getReference(c,f.token,kind,row.id);assert.equal(detail.history.length,5);assert.ok(detail.history.some(event=>event.action==="reference_reactivated"));
      });
      await t.test(`${kind}: two real concurrent edits have one winner and one conflict`,async()=>{
        const row=await createReference(c,f.token,kind,f.referenceInput(kind));const outcomes=await Promise.allSettled(["A","B"].map(suffix=>f.independent(client=>updateReference(client,f.token,kind,row.id,{version:1,record:f.referenceInput(kind,`${row.label}-${suffix}`)}))));assert.equal(outcomes.filter(row=>row.status==="fulfilled").length,1);assert.ok(outcomes.some(row=>row.status==="rejected"&&row.reason.code==="CONFLICT"));assert.equal((await getReference(c,f.token,kind,row.id)).record.version,2);
      });
      await t.test(`${kind}: edit versus deactivation is version-safe`,async()=>{
        const row=await createReference(c,f.token,kind,f.referenceInput(kind));const outcomes=await Promise.allSettled([f.independent(client=>updateReference(client,f.token,kind,row.id,{version:1,record:f.referenceInput(kind,`${row.label}-race`)})),f.independent(client=>changeReferenceLifecycle(client,f.token,kind,row.id,{version:1,action:"deactivate",confirmation:"deactivate"}))]);assert.equal(outcomes.filter(row=>row.status==="fulfilled").length,1);assert.ok(outcomes.some(row=>row.status==="rejected"&&row.reason.code==="CONFLICT"));assert.equal((await getReference(c,f.token,kind,row.id)).history.length,2);
      });
      await t.test(`${kind}: 20-row pages and literal wildcard search are bounded`,async()=>{
        const marker=`${f.prefix}-${kind}-paged`;
        for(let index=0;index<21;index++)await createReference(c,f.token,kind,f.referenceInput(kind,`${marker}-${String(index).padStart(2,"0")}`));
        const first=await listReferences(c,f.token,kind,{q:marker}),second=await listReferences(c,f.token,kind,{q:marker,page:2});assert.equal(first.total,21);assert.equal(first.rows.length,20);assert.equal(second.rows.length,1);assert.equal(new Set([...first.rows,...second.rows].map(row=>row.id)).size,21);
        const selector=await selectActiveReferences(c,f.token,kind,marker);assert.equal(selector.length,20);assert.deepEqual(Object.keys(selector[0]).sort(),["id","label","version"]);
        const literal=await createReference(c,f.token,kind,f.referenceInput(kind,`${f.prefix}-${kind}-%_=`));assert.equal((await listReferences(c,f.token,kind,{q:literal.label})).total,1);assert.equal((await listReferences(c,f.token,kind,{q:"' OR 1=1 --"})).total,0);
      });
    }
    await t.test("MySQL enforces valid active bits and positive versions for every reference table",async()=>{
      for(const kind of referenceKinds){const row=await createReference(c,f.token,kind,f.referenceInput(kind)),table=kind==="categories"?"expense_categories":kind;for(const assignment of ["is_active=2","version=0"])await assert.rejects(c.execute(`UPDATE ${table} SET ${assignment} WHERE id=?`,[row.id]),(error:unknown)=>Boolean(error&&typeof error==="object"&&"errno"in error&&error.errno===3819));const retained=await getReference(c,f.token,kind,row.id);assert.equal(retained.record.version,1);assert.equal(retained.record.isActive,true);}
    });
    await t.test("deactivation preserves all three historical expense foreign keys and inactive reads",async()=>{
      const category=await createReference(c,f.token,"categories",f.referenceInput("categories")),person=await createReference(c,f.token,"persons",f.referenceInput("persons")),vehicle=await createReference(c,f.token,"vehicles",f.referenceInput("vehicles")),expense=randomUUID();
      // Synthetic fixture only: no expense creation service is implemented.
      await c.execute("INSERT INTO expenses(id,amount,transaction_date,category_id,description,person_id,vehicle_id) VALUES(?,'1.00','2026-01-01',?,'Synthetic historical expense',?,?)",[expense,category.id,person.id,vehicle.id]);
      for(const [kind,row]of [["categories",category],["persons",person],["vehicles",vehicle]]as const){await lifecycle(kind,row.id,1);const detail=await getReference(c,f.token,kind,row.id);assert.equal(detail.expenseReferences,1);assert.equal(detail.record.isActive,false);const table=kind==="categories"?"expense_categories":kind;await assert.rejects(c.execute(`DELETE FROM ${table} WHERE id=?`,[row.id]),(error:unknown)=>Boolean(error&&typeof error==="object"&&"errno"in error&&error.errno===1451));}
      const [rows]=await c.execute<RowDataPacket[]>("SELECT category_id,person_id,vehicle_id FROM expenses WHERE id=?",[expense]);assert.deepEqual([rows[0].category_id,rows[0].person_id,rows[0].vehicle_id],[category.id,person.id,vehicle.id]);
      assert.ok(!(await activeCategories(c,f.token,category.label)).some(row=>row.id===category.id));assert.ok(!(await activePersons(c,f.token,person.label)).some(row=>row.id===person.id));assert.ok(!(await activeVehicles(c,f.token,vehicle.label)).some(row=>row.id===vehicle.id));
    });
    await t.test("audit INSERT failure rolls back creates, edits, deactivations and history for each module",async()=>{
      const records=await Promise.all(referenceKinds.map(kind=>f.independent(client=>createReference(client,f.token,kind,f.referenceInput(kind)))));
      const trigger=`wp06_audit_failure_${randomUUID().replaceAll("-","")}`;await c.query(`CREATE TRIGGER \`${trigger}\` BEFORE INSERT ON audit_events FOR EACH ROW BEGIN IF NEW.entity_type IN ('expense_category','person','vehicle') THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic audit persistence failure'; END IF; END`);
      try{for(let index=0;index<referenceKinds.length;index++){const kind=referenceKinds[index],row=records[index],marker=`${f.prefix}-${kind}-rollback`;await assert.rejects(createReference(c,f.token,kind,f.referenceInput(kind,marker)));assert.equal((await listReferences(c,f.token,kind,{q:marker})).total,0);await assert.rejects(updateReference(c,f.token,kind,row.id,{version:1,record:f.referenceInput(kind,`${row.label}-rejected`)}));await assert.rejects(lifecycle(kind,row.id,1));const detail=await getReference(c,f.token,kind,row.id);assert.deepEqual(detail.record,row);assert.equal(detail.history.length,1);const [versions]=await c.execute<RowDataPacket[]>("SELECT version FROM entity_versions WHERE entity_type=? AND entity_id=?",[referenceDefinitions[kind].entity,row.id]);assert.deepEqual(versions.map(row=>row.version),[1]);}}finally{await c.query(`DROP TRIGGER \`${trigger}\``);}
      const [triggers]=await c.query<RowDataPacket[]>("SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA=DATABASE()");assert.equal(triggers.length,13);
    });
    await t.test("legacy attribution remains unknown and inactive status survives ordinary corrections",async()=>{
      for(const kind of referenceKinds){const id=randomUUID(),table=kind==="categories"?"expense_categories":kind,column=kind==="vehicles"?"identifier":"name";await c.execute(`INSERT INTO ${table}(id,${column},is_active) VALUES(?,?,0)`,[id,`${f.prefix}-${kind}-legacy`]);const before=await getReference(c,f.token,kind,id);assert.equal(before.record.createdBy,null);assert.equal(before.record.deactivatedAt,null);assert.equal(before.history.length,0);const corrected=await updateReference(c,f.token,kind,id,{version:1,record:f.referenceInput(kind,`${f.prefix}-${kind}-legacy-corrected`)});assert.equal(corrected.createdBy,null);assert.equal(corrected.isActive,false);}
    });
    await t.test("another active user has equal rights; unknown IDs and invalid status cannot bypass validation",async()=>{
      const other=await f.anotherUser();for(const kind of referenceKinds){const row=await createReference(c,f.token,kind,f.referenceInput(kind));const corrected=await updateReference(c,other.token,kind,row.id,{version:1,record:f.referenceInput(kind,`${row.label}-other`)});assert.equal(corrected.updatedBy,other.id);await assert.rejects(getReference(c,f.token,kind,randomUUID()),code("NOT_FOUND"));await assert.rejects(listReferences(c,f.token,kind,{status:"deleted"}),code("STATUS"));}
    });
    await t.test("anonymous and disabled sessions cannot read, select or mutate any module",async()=>{
      const rows=await Promise.all(referenceKinds.map(kind=>f.independent(client=>createReference(client,f.token,kind,f.referenceInput(kind)))));
      const operations=(token:string|undefined)=>referenceKinds.flatMap((kind,index)=>[()=>listReferences(c,token,kind),()=>selectActiveReferences(c,token,kind),()=>getReference(c,token,kind,rows[index].id),()=>createReference(c,token,kind,{}),()=>updateReference(c,token,kind,rows[index].id,{}),()=>changeReferenceLifecycle(c,token,kind,rows[index].id,{})]);
      for(const operation of operations(undefined))await assert.rejects(operation(),AuthenticationRequired);await setAccountActive(c,f.operator,f.email,false);for(const operation of operations(f.token))await assert.rejects(operation(),AuthenticationRequired);
    });
  }finally{await f.close();}
});
