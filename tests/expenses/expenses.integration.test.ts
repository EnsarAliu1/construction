import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2/promise";
import { createExpense, correctExpense, cancelExpense, getExpense, listExpenses, chooseExpenseProjects } from "../../src/features/expenses/service";
import { createReference, changeReferenceLifecycle, getReference } from "../../src/features/references/service";
import { updateProject } from "../../src/features/projects/service";
import { setAccountActive } from "../../src/server/auth/accounts";
import { AuthenticationRequired } from "../../src/server/auth/security";
import { ExpenseError } from "../../src/features/expenses/validation";
import { expenseFixture, mysqlSkip } from "./fixtures";

const code=(value:string)=>(error:unknown)=>error instanceof ExpenseError&&error.code===value;
test("MySQL actual expenses: exact persistence, atomic category, lifecycle, races and authorization",{skip:mysqlSkip,timeout:120_000},async t=>{
  const f=await expenseFixture(),c=f.connection;
  const create=(extra:Record<string,unknown>={})=>createExpense(c,f.token,f.expenseInput(extra));
  const correction=(expense:unknown,version=1)=>({version,confirmation:"correct",expense});
  const cancellation=(version=1)=>({version,confirmation:"cancel",reason:"Synthetic duplicate payment correction"});
  const deactivate=(kind:"categories"|"persons"|"vehicles",row:{id:string;version:number})=>changeReferenceLifecycle(c,f.token,kind,row.id,{version:row.version,action:"deactivate",confirmation:"deactivate"});
  try{
    await t.test("company-wide expense stores exact EUR/date, actors and immutable version 1",async()=>{
      const row=await create({amount:"99999999999999999.99"});assert.equal(row.amount,"99999999999999999.99");assert.equal(row.transactionDate,"2024-02-29");assert.equal(row.projectId,null);assert.equal(row.createdBy,f.userId);assert.equal(row.updatedBy,f.userId);assert.equal(row.status,"recorded");
      const data=await getExpense(c,f.token,row.id);assert.equal(data.history.length,1);assert.equal(data.history[0].after?.amount,row.amount);assert.equal(data.history[0].actorName,"Synthetic Clients User");
      const [versions]=await c.execute<RowDataPacket[]>("SELECT snapshot FROM entity_versions WHERE entity_type='expense' AND entity_id=?",[row.id]);assert.equal(versions.length,1);assert.equal(versions[0].snapshot.transactionDate,"2024-02-29");
    });
    await t.test("project, derived client, optional recipient and vehicle resolve correctly",async()=>{
      const project=await f.fresh(),person=await createReference(c,f.token,"persons",{name:`${f.prefix}-recipient`}),vehicle=await createReference(c,f.token,"vehicles",{identifier:`${f.prefix}-vehicle`});
      const row=await create({project:f.selection(project.project),person:f.selection(person),vehicle:f.selection(vehicle)}),data=await getExpense(c,f.token,row.id);
      assert.equal(data.project?.id,project.project.id);assert.equal(data.client?.id,f.client.id);assert.equal(data.person?.id,person.id);assert.equal(data.vehicle?.id,vehicle.id);
      assert.ok((await chooseExpenseProjects(c,f.token,f.prefix)).some(choice=>choice.id===project.project.id));
      for(const [field,id]of [["projectId",project.project.id],["categoryId",f.category.id],["personId",person.id],["vehicleId",vehicle.id]])assert.ok((await listExpenses(c,f.token,{[field]:id})).rows.some(item=>item.record.id===row.id));
      for(const kind of ["persons","vehicles"]as const)await deactivate(kind,kind==="persons"?person:vehicle);
      const historical=await getExpense(c,f.token,row.id);assert.equal(historical.person?.isActive,false);assert.equal(historical.vehicle?.isActive,false);
      const retained=f.expenseInput({project:f.selection(project.project),person:f.selection(historical.person!),vehicle:f.selection(historical.vehicle!),description:"Synthetic historical association corrected"});
      assert.equal((await correctExpense(c,f.token,row.id,correction(retained))).personId,person.id);
    });
    await t.test("new inactive category/person/vehicle, unknown records and stale selections rejected",async()=>{
      for(const [kind,field,input]of [["categories","category",{name:`${f.prefix}-${randomUUID()}`}],["persons","person",{name:`${f.prefix}-${randomUUID()}`}],["vehicles","vehicle",{identifier:`${f.prefix}-${randomUUID()}`}]]as const){const row=await createReference(c,f.token,kind,input),inactive=await deactivate(kind,row);await assert.rejects(create({[field]:f.selection(inactive)}),code("INACTIVE"));await assert.rejects(create({[field]:f.selection(row)}),code("CONFLICT"));await assert.rejects(create({[field]:{id:randomUUID(),version:1}}),code("REFERENCE"));}
    });
    await t.test("completed/suspended/archived project or archived client cannot receive new associations",async()=>{
      for(const status of ["completed","suspended"]){const detail=await f.fresh({status});await assert.rejects(create({project:f.selection(detail.project)}),code("PROJECT"));assert.ok(!(await chooseExpenseProjects(c,f.token,detail.project.name)).some(row=>row.id===detail.project.id));}
      const archived=await f.fresh();await c.execute("UPDATE projects SET deleted_at=UTC_TIMESTAMP(3) WHERE id=?",[archived.project.id]);await assert.rejects(create({project:f.selection(archived.project)}),code("PROJECT"));
      const detail=await f.fresh();await c.execute("UPDATE clients SET deleted_at=UTC_TIMESTAMP(3) WHERE id=?",[f.client.id]);try{await assert.rejects(create({project:f.selection(detail.project)}),code("PROJECT"));}finally{await c.execute("UPDATE clients SET deleted_at=NULL WHERE id=?",[f.client.id]);}
    });
    await t.test("inline category and expense share one correlation and atomic snapshots",async()=>{
      const name=`${f.prefix}-Inline ${randomUUID()}`,row=await create({category:null,newCategoryName:`  ${name.replace("Inline","Inline   ")}  `}),category=await getReference(c,f.token,"categories",row.categoryId);assert.equal(category.record.label,name);
      const [events]=await c.execute<RowDataPacket[]>("SELECT operation_id FROM audit_events WHERE entity_id IN (?,?)",[row.id,row.categoryId]);assert.equal(events.length,2);assert.equal(events[0].operation_id,events[1].operation_id);
      await assert.rejects(create({category:null,newCategoryName:name.toUpperCase()}),code("DUPLICATE"));
      const accented=`${f.prefix}-café-${randomUUID()}`;await create({category:null,newCategoryName:accented});await assert.rejects(create({category:null,newCategoryName:accented.replace("é","e")}),code("DUPLICATE"));
    });
    await t.test("two concurrent same-name inline categories yield one expense and one defined conflict",async()=>{
      const name=`${f.prefix}-inline-race-${randomUUID()}`,outcomes=await Promise.allSettled([name,name.toUpperCase()].map(newCategoryName=>f.independent(conn=>createExpense(conn,f.token,f.expenseInput({category:null,newCategoryName})))));
      assert.equal(outcomes.filter(row=>row.status==="fulfilled").length,1);assert.ok(outcomes.some(row=>row.status==="rejected"&&row.reason.code==="DUPLICATE"));
      const [rows]=await c.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM expense_categories WHERE name=?",[name]);assert.equal(Number(rows[0].total),1);
    });
    await t.test("actual transaction dates, inclusive boundaries, escaped label search and pagination",async()=>{
      const marker=`${f.prefix}-paged-%_=`,ids=[];for(let i=0;i<21;i++)ids.push((await create({description:`${marker}-${i}`,transactionDate:i===0?"2024-03-01":"2024-02-29"})).id);
      const first=await listExpenses(c,f.token,{q:marker}),second=await listExpenses(c,f.token,{q:marker,page:2});assert.equal(first.total,21);assert.equal(first.rows.length,20);assert.equal(second.rows.length,1);assert.equal(new Set([...first.rows,...second.rows].map(row=>row.record.id)).size,21);
      assert.equal((await listExpenses(c,f.token,{q:marker,from:"2024-02-29",to:"2024-02-29"})).total,20);assert.equal((await listExpenses(c,f.token,{q:marker,from:"2024-03-01",to:"2024-03-01"})).total,1);assert.equal((await listExpenses(c,f.token,{q:marker,from:"2025-01-01"})).total,0);
      assert.equal((await listExpenses(c,f.token,{q:"' OR 1=1 --"})).total,0);assert.ok((await listExpenses(c,f.token,{q:f.category.label})).total>=21);assert.ok((await listExpenses(c,f.token,{projectId:"company",q:marker})).rows.every(row=>row.record.projectId===null));
    });
    await t.test("correction preserves old values/identity; stale version and inactive replacement rejected",async()=>{
      const row=await create(),input=f.expenseInput({amount:"0.01",transactionDate:"2000-01-01"}),edited=await correctExpense(c,f.token,row.id,correction(input));assert.equal(edited.id,row.id);assert.equal(edited.version,2);assert.equal(edited.amount,"0.01");
      const data=await getExpense(c,f.token,row.id);assert.equal(data.history[0].before?.amount,"123.45");assert.equal(data.history[0].after?.amount,"0.01");await assert.rejects(correctExpense(c,f.token,row.id,correction(input)),code("CONFLICT"));
      const replacement=await createReference(c,f.token,"categories",{name:`${f.prefix}-replacement-${randomUUID()}`});const changed=await correctExpense(c,f.token,row.id,correction({...input,category:f.selection(replacement)},2));assert.equal(changed.categoryId,replacement.id);
      const inactive=await deactivate("categories",replacement);await assert.rejects(create({category:f.selection(inactive)}),code("INACTIVE"));
      const historical=await correctExpense(c,f.token,row.id,correction({...input,category:f.selection(inactive)},3));assert.equal(historical.version,4);
      const other=await create();await assert.rejects(correctExpense(c,f.token,other.id,correction({...input,category:f.selection(inactive)})),code("INACTIVE"));
    });
    await t.test("two simultaneous corrections have one winner and retain both versions",async()=>{
      const row=await create(),outcomes=await Promise.allSettled(["1.11","2.22"].map(amount=>f.independent(conn=>correctExpense(conn,f.token,row.id,correction(f.expenseInput({amount}))))));assert.equal(outcomes.filter(row=>row.status==="fulfilled").length,1);assert.ok(outcomes.some(row=>row.status==="rejected"&&row.reason.code==="CONFLICT"));assert.equal((await getExpense(c,f.token,row.id)).history.length,2);
    });
    await t.test("opposite association changes acquire old/new records deterministically without deadlock",async()=>{
      const p1=await f.fresh(),p2=await f.fresh(),cat=await createReference(c,f.token,"categories",{name:`${f.prefix}-swap-${randomUUID()}`});
      const left=await create({project:f.selection(p1.project)}),right=await create({category:f.selection(cat),project:f.selection(p2.project)});
      const outcomes=await Promise.all([f.independent(conn=>correctExpense(conn,f.token,left.id,correction(f.expenseInput({category:f.selection(cat),project:f.selection(p2.project)})))),f.independent(conn=>correctExpense(conn,f.token,right.id,correction(f.expenseInput({project:f.selection(p1.project)}))))]);assert.ok(outcomes.every(row=>row.version===2));
    });
    await t.test("reference deactivation and expense creation serialize and recheck locked state",async()=>{
      for(const [kind,field,input]of [["categories","category",{name:`${f.prefix}-${randomUUID()}`}],["persons","person",{name:`${f.prefix}-${randomUUID()}`}],["vehicles","vehicle",{identifier:`${f.prefix}-${randomUUID()}`}]]as const){
        const row=await createReference(c,f.token,kind,input);
        const outcomes=await Promise.allSettled([f.independent(conn=>createExpense(conn,f.token,f.expenseInput({[field]:f.selection(row)}))),f.independent(conn=>changeReferenceLifecycle(conn,f.token,kind,row.id,{version:1,action:"deactivate",confirmation:"deactivate"}))]);
        assert.equal(outcomes[1].status,"fulfilled");if(outcomes[0].status==="fulfilled"){const detail=await getExpense(c,f.token,outcomes[0].value.id);assert.equal(detail[field]?.isActive,false);}else assert.equal(outcomes[0].reason.code,"CONFLICT");
        const current=(await getReference(c,f.token,kind,row.id)).record;await assert.rejects(create({[field]:f.selection(current)}),code("INACTIVE"));
      }
    });
    await t.test("project lifecycle change races expense creation through compatible parent locks",async()=>{
      const detail=await f.fresh(),outcomes=await Promise.allSettled([f.independent(conn=>createExpense(conn,f.token,f.expenseInput({project:f.selection(detail.project)}))),f.independent(conn=>updateProject(conn,f.token,detail.project.id,{version:1,project:f.projectInput({name:detail.project.name,status:"completed"})}))]);assert.equal(outcomes[1].status,"fulfilled");if(outcomes[0].status==="rejected")assert.equal(outcomes[0].reason.code,"CONFLICT");else assert.equal((await getExpense(c,f.token,outcomes[0].value.id)).project?.status,"completed");
    });
    await t.test("cancellation retains identity/history and is excluded from recorded sums and selectors",async()=>{
      const marker=`${f.prefix}-sum-${randomUUID()}`,a=await create({amount:"0.10",description:marker}),b=await create({amount:"0.20",description:marker});
      const cancelled=await cancelExpense(c,f.token,b.id,cancellation());assert.equal(cancelled.id,b.id);assert.equal(cancelled.status,"cancelled");assert.equal(cancelled.cancelledBy,f.userId);assert.ok(cancelled.cancelledAt);assert.equal(cancelled.version,2);
      const [sum]=await c.execute<RowDataPacket[]>("SELECT SUM(amount) AS total FROM expenses WHERE description=? AND status='recorded'",[marker]);assert.equal(sum[0].total,"0.10");assert.deepEqual((await listExpenses(c,f.token,{q:marker})).rows.map(row=>row.record.id),[a.id]);assert.equal((await listExpenses(c,f.token,{q:marker,status:"all"})).total,2);assert.equal((await listExpenses(c,f.token,{q:marker,status:"cancelled"})).rows[0].record.id,b.id);
      assert.equal((await getExpense(c,f.token,b.id)).history.length,2);await assert.rejects(cancelExpense(c,f.token,b.id,cancellation(2)),code("CANCELLED"));await assert.rejects(correctExpense(c,f.token,b.id,correction(f.expenseInput(),2)),code("CANCELLED"));await assert.rejects(c.execute("DELETE FROM expenses WHERE id=?",[b.id]));
    });
    await t.test("edit versus cancellation race has exactly one winner and no silent overwrite",async()=>{
      const row=await create(),outcomes=await Promise.allSettled([f.independent(conn=>correctExpense(conn,f.token,row.id,correction(f.expenseInput()))),f.independent(conn=>cancelExpense(conn,f.token,row.id,cancellation()))]);assert.equal(outcomes.filter(row=>row.status==="fulfilled").length,1);assert.ok(outcomes.some(row=>row.status==="rejected"&&row.reason.code==="CONFLICT"));assert.equal((await getExpense(c,f.token,row.id)).record.version,2);
    });
    await t.test("expense insertion and category/expense audit/version failures roll back every affected row",async()=>{
      const trigger=`wp07_failure_${randomUUID().replaceAll("-","")}`,row=await create(),marker=`${f.prefix}-rollback-${randomUUID()}`;
      async function failOn(table:"expenses"|"audit_events"|"entity_versions",condition:string,work:()=>Promise<void>){await c.query(`CREATE TRIGGER \`${trigger}\` BEFORE INSERT ON ${table} FOR EACH ROW BEGIN IF ${condition} THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='Synthetic private failure'; END IF; END`);try{await work();}finally{await c.query(`DROP TRIGGER \`${trigger}\``);}}
      async function noInline(name:string){await assert.rejects(create({category:null,newCategoryName:name}));const [rows]=await c.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM expense_categories WHERE name=?",[name]);assert.equal(Number(rows[0].total),0);for(const [table,column]of [["audit_events","after_snapshot"],["entity_versions","snapshot"]]){const [history]=await c.execute<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM ${table} WHERE entity_type='expense_category' AND JSON_UNQUOTE(JSON_EXTRACT(${column}, '$.name'))=?`,[name]);assert.equal(Number(history[0].total),0);}}
      await failOn("expenses","TRUE",()=>noInline(`${marker}-expense`));
      for(const table of ["audit_events","entity_versions"]as const)for(const entity of ["expense_category","expense"])await failOn(table,`NEW.entity_type='${entity}'`,()=>noInline(`${marker}-${table}-${entity}`));
      await failOn("audit_events","NEW.entity_type='expense'",async()=>{await assert.rejects(correctExpense(c,f.token,row.id,correction(f.expenseInput({amount:"9.99"}))));await assert.rejects(cancelExpense(c,f.token,row.id,cancellation()));await assert.rejects(create());});
      const after=await getExpense(c,f.token,row.id);assert.equal(after.record.version,1);assert.equal(after.record.amount,row.amount);assert.equal(after.record.status,"recorded");assert.equal(after.history.length,1);
      const [versions]=await c.execute<RowDataPacket[]>("SELECT COUNT(*) AS total FROM entity_versions WHERE entity_type='expense' AND entity_id=?",[row.id]);assert.equal(Number(versions[0].total),1);
    });
    await t.test("inactive historical references remain readable and cancellation works without reactivation",async()=>{
      const category=await createReference(c,f.token,"categories",{name:`${f.prefix}-history-${randomUUID()}`}),row=await create({category:f.selection(category)});await deactivate("categories",category);assert.equal((await getExpense(c,f.token,row.id)).category.isActive,false);assert.equal((await cancelExpense(c,f.token,row.id,cancellation())).status,"cancelled");
    });
    await t.test("unknown records are safe and every domain operation authenticates independently",async()=>{
      await assert.rejects(getExpense(c,f.token,randomUUID()),code("NOT_FOUND"));await assert.rejects(cancelExpense(c,f.token,randomUUID(),cancellation()),code("NOT_FOUND"));
      const row=await create(),second=await f.anotherUser();assert.equal((await createExpense(c,second.token,f.expenseInput())).createdBy,second.id);
      for(const token of [undefined,f.token]){if(token)await setAccountActive(c,f.operator,f.email,false);for(const work of [()=>createExpense(c,token,f.expenseInput()),()=>listExpenses(c,token),()=>getExpense(c,token,row.id),()=>correctExpense(c,token,row.id,correction(f.expenseInput())),()=>cancelExpense(c,token,row.id,cancellation()),()=>chooseExpenseProjects(c,token)])await assert.rejects(work(),AuthenticationRequired);}
    });
  }finally{await f.close();}
});
