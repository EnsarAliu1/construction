import "server-only";
import {and,asc,count,getTableColumns,gt,inArray,type SQL} from "drizzle-orm";
import {drizzle} from "drizzle-orm/mysql2";
import type {AnyMySqlTable} from "drizzle-orm/mysql-core";
import type {Connection} from "mysql2/promise";
import * as schema from "@/server/db/schema";
import {requireSessionUser} from "@/server/auth/sessions";
import {limitError} from "./validation";
export type DataRow=Record<string,unknown>;
export const businessTypes=["client","project","contract","phase","payment","payment_allocation","expense","expense_category","person","vehicle","receipt","export"];
export const financeTables={clients:schema.clients,projects:schema.projects,contracts:schema.contracts,contract_phases:schema.contractPhases,payments:schema.payments,payment_allocations:schema.paymentAllocations,expenses:schema.expenses,expense_categories:schema.expenseCategories};
export const exportTables={...financeTables,persons:schema.persons,vehicles:schema.vehicles,payment_receipts:schema.paymentReceipts,receipt_versions:schema.receiptVersions,audit_events:schema.auditEvents,entity_versions:schema.entityVersions,business_users:schema.users};
export type Snapshot={generatedAt:string;data:Record<string,DataRow[]>;counts:Record<string,number>};
/** Trusted test observation point, never accepted by HTTP. All reads share one MVCC snapshot. */
export async function materialize(c:Connection,token:string|undefined,full=false,observe:(table:string)=>Promise<void>=async()=>{}):Promise<Snapshot>{
 await requireSessionUser(c,token);const start=Date.now();
 const result=await drizzle(c).transaction(async tx=>{
  const data:Snapshot["data"]={},counts:Snapshot["counts"]={};let rows=0,bytes=0;
  for(const [name,table]of Object.entries(full?exportTables:financeTables) as [string,AnyMySqlTable][]){
   const columns=getTableColumns(table);let where:SQL|undefined;
   if(name==="audit_events"||name==="entity_versions")where=inArray(columns.entityType,businessTypes);
   const [{n}]=await tx.select({n:count()}).from(table).where(where);counts[name]=Number(n);rows+=Number(n);if(rows>20000)throw limitError();
   // Credentials are not even selected into a full-export snapshot.
   const selected=name==="business_users"?{id:schema.users.id,displayName:schema.users.displayName,email:schema.users.email,status:schema.users.status,createdAt:schema.users.createdAt,updatedAt:schema.users.updatedAt,deactivatedAt:schema.users.deactivatedAt}:columns;
   data[name]=[];
   // A stable primary-key cursor avoids rescanning earlier rows on every batch.
   // Count, cursor reads and completeness checks retain the same read-only MVCC snapshot.
   let cursor:string|undefined;
   while(data[name].length<Number(n)){
    const batch=await tx.select(selected).from(table).where(and(where,cursor?gt(columns.id,cursor):undefined)).orderBy(asc(columns.id)).limit(500) as DataRow[];
    if(!batch.length)throw new Error("Kontrolli i plotësisë së gjendjes së ruajtur dështoi.");bytes+=Buffer.byteLength(JSON.stringify(batch));if(bytes>16*1024*1024||Date.now()-start>15000)throw limitError();data[name].push(...batch);cursor=String(batch.at(-1)!.id);
   }
   if(data[name].length!==counts[name])throw new Error("Numri i të dhënave nuk përputhet me gjendjen e ruajtur.");await observe(name);
  }
  return {data,counts,generatedAt:new Date().toISOString()};
 },{isolationLevel:"repeatable read",accessMode:"read only"});
 await requireSessionUser(c,token);return result;
}
