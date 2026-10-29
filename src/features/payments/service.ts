import { createHash, randomUUID } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import type { Connection } from "mysql2/promise";
import { auditEvents, clients, contracts, contractPhases, entityVersions, operationRequests, paymentAllocations, paymentReceipts, payments, projects, receiptVersions, users } from "@/server/db/schema";
import { requireSessionUser } from "@/server/auth/sessions";
import { safeHistorySnapshot } from "@/server/db/history-snapshot";
import { cents, decimal } from "@/features/projects/money";
import { escapedSearch } from "@/features/clients/validation";
import { referenceId } from "@/features/references/validation";
import { PaymentError, parseCancellation, parseConfirmation, parseCorrection, parsePayment, parsePaymentQuery, operationKey, type PaymentInput } from "./validation";

type Db=MySql2Database<Record<string,never>>;
export type PaymentTx=Parameters<Parameters<Db["transaction"]>[0]>[0];
type Payment=typeof payments.$inferSelect;
type Allocation=typeof paymentAllocations.$inferSelect;
export type ReceiptContext={action:"confirm"|"correct"|"cancel";actorId:string;operationId:string;before:Payment|null;after:Payment;allocations:Allocation[]};
/** Server-only composition contract, never accepted from HTTP payloads. WP-09 owns implementation. */
export type ReceiptBoundary={mode:"wp09"|"isolated-test";apply:(tx:PaymentTx,context:ReceiptContext)=>Promise<void>};
export const receiptPending=()=>new PaymentError("RECEIPT_PENDING","Konfirmimi përfundimtar dhe ndryshimet kërkojnë lëshimin e dëftesës. Kjo kërkesë nuk ka përfunduar asnjë pagesë ose dëftesë.",409);
const conflict=()=>new PaymentError("CONFLICT","Pagesa, projekti, kontrata ose faza është ndryshuar. Ringarkoni para konfirmimit.",409);
const OPERATION="payment_confirmation";

async function mutation<P,R>(c:Connection,token:string|undefined,parse:()=>P,work:(tx:PaymentTx,input:P,actor:string,operation:string)=>Promise<R>){
  const user=await requireSessionUser(c,token),input=parse();
  return drizzle(c).transaction(async tx=>{
    await tx.select({id:users.id}).from(users).where(eq(users.id,user.id)).for("share");
    const actor=await requireSessionUser(c,token);
    return work(tx,input,actor.id,randomUUID());
  },{isolationLevel:"read committed"});
}
async function record(tx:PaymentTx,actorId:string,operationId:string,entityType:string,action:string,before:object|null,after:{id:string;version:number}){
  const snapshot=safeHistorySnapshot({...after});
  await tx.insert(auditEvents).values({id:randomUUID(),actorId,operationId,entityType,entityId:after.id,action,beforeSnapshot:before?safeHistorySnapshot({...before}):null,afterSnapshot:snapshot});
  await tx.insert(entityVersions).values({id:randomUUID(),entityType,entityId:after.id,version:after.version,snapshot});
}
async function find(db:Pick<Db,"select">,id:string,lock=false){
  const query=db.select().from(payments).where(eq(payments.id,id)).limit(1);const [row]=await(lock?query.for("update"):query);
  if(!row)throw new PaymentError("NOT_FOUND","Pagesa nuk u gjet.",404);return row;
}
/** All writes share WP-05 user -> client -> project -> contract -> sorted phases -> payment/allocation order. */
async function aggregate(tx:PaymentTx,projectId:string,input:PaymentInput|null,eligible:boolean){
  const [hint]=await tx.select().from(projects).where(eq(projects.id,projectId)).limit(1);
  if(!hint)throw new PaymentError("PROJECT","Projekti nuk u gjet.",404);
  const [client]=await tx.select().from(clients).where(eq(clients.id,hint.clientId)).for("update");
  const [project]=await tx.select().from(projects).where(eq(projects.id,projectId)).for("update");
  if(!project||project.clientId!==hint.clientId)throw conflict();
  const [contract]=await tx.select().from(contracts).where(eq(contracts.projectId,projectId)).for("update");
  if(!contract)throw new PaymentError("CONTRACT","Ky projekt nuk ka kontratë.",409);
  if(eligible&&(!client||client.deletedAt||project.deletedAt||project.status!=="active"||contract.status!=="active"))throw new PaymentError("ELIGIBILITY","Zgjidhni projekt, klient dhe kontratë aktive.",409);
  if(input&&(input.projectId!==project.id||input.projectVersion!==project.version||input.contractId!==contract.id||input.contractVersion!==contract.version))throw conflict();
  const phases=await tx.select().from(contractPhases).where(eq(contractPhases.contractId,contract.id)).orderBy(asc(contractPhases.id)).limit(1001).for("update");
  if(phases.length>1000)throw new PaymentError("PHASE_LIMIT","Këto të dhëna historike tejkalojnë kufirin e fazave të mbështetura.",409);
  if(input)for(const selected of input.allocations){const phase=phases.find(row=>row.id===selected.phaseId);if(!phase||phase.deletedAt)throw new PaymentError("PHASE","Zgjidhni faza aktive të kontratës aktuale të projektit.",409);if(phase.version!==selected.phaseVersion)throw conflict();}
  return {project,client,contract,phases};
}
async function capacity(tx:PaymentTx,input:PaymentInput,phases:Awaited<ReturnType<typeof aggregate>>["phases"],exclude?:string){
  const ids=input.allocations.map(row=>row.phaseId);
  const totals=await tx.select({phaseId:paymentAllocations.phaseId,paid:sql<string>`SUM(${paymentAllocations.amount})`,invalid:sql<number>`SUM(CASE WHEN ${payments.projectId} <> ${input.projectId} THEN 1 ELSE 0 END)`}).from(paymentAllocations).innerJoin(payments,eq(payments.id,paymentAllocations.paymentId)).where(and(inArray(paymentAllocations.phaseId,ids),isNull(paymentAllocations.deletedAt),eq(payments.status,"received"),exclude?ne(payments.id,exclude):undefined)).groupBy(paymentAllocations.phaseId).limit(100);
  if(totals.some(row=>Number(row.invalid)>0))throw new PaymentError("RELATIONSHIP","Ndarjet e ruajtura kanë lidhje të pavlefshme me projektin.",409);
  for(const selected of input.allocations){const phase=phases.find(row=>row.id===selected.phaseId)!,used=totals.find(row=>row.phaseId===selected.phaseId)?.paid??"0.00";if(cents(used)+cents(selected.amount)>cents(phase.value))throw new PaymentError("CAPACITY",`Ndarja tejkalon kapacitetin e mbetur të ${phase.name}.`,409,{allocations:"Ringarkoni kapacitetet e fazave dhe përshtatni ndarjet."});}
}
async function allocations(tx:PaymentTx,id:string,lock=false){const query=tx.select().from(paymentAllocations).where(eq(paymentAllocations.paymentId,id)).orderBy(asc(paymentAllocations.phaseId)).limit(1001);const rows=await(lock?query.for("update"):query);if(rows.length>1000)throw new PaymentError("ALLOCATION_LIMIT","Kjo pagesë historike tejkalon kufirin e ndarjeve të mbështetura.",409);return rows;}
function validateOld(locked:Awaited<ReturnType<typeof aggregate>>,rows:Allocation[]){
  if(rows.some(row=>!locked.phases.some(phase=>phase.id===row.phaseId)))throw new PaymentError("RELATIONSHIP","Ndarjet e ruajtura nuk i përkasin kontratës së këtij projekti. Zgjidhni lidhjen historike para ndryshimit.",409);
}
async function receipt(tx:PaymentTx,boundary:ReceiptBoundary,context:ReceiptContext){
  const [existing]=await tx.select().from(paymentReceipts).where(eq(paymentReceipts.paymentId,context.after.id)).for("update");
  if(boundary.mode==="isolated-test"){
    // A test capability can never change an already numbered receipt, even a draft.
    if(existing)throw receiptPending();await boundary.apply(tx,context);return;
  }
  await boundary.apply(tx,context);
  const [issued]=await tx.select().from(paymentReceipts).where(eq(paymentReceipts.paymentId,context.after.id)).limit(1);
  if(!issued||issued.status!==(context.action==="cancel"?"void":"issued"))throw receiptPending();
  const [version]=await tx.select().from(receiptVersions).where(eq(receiptVersions.receiptId,issued.id)).orderBy(desc(receiptVersions.version)).limit(1);
  if(!version)throw receiptPending();
  if(context.action!=="cancel"){
    const s=version.contentSnapshot,p=context.after;
    if(s.paymentId!==p.id||s.version!==p.version||s.amount!==p.amount||s.projectId!==p.projectId||s.transactionDate!==p.transactionDate||s.method!==p.method)throw receiptPending();
  }
}
function requireBoundary(boundary?:ReceiptBoundary):ReceiptBoundary{if(!boundary)throw receiptPending();return boundary;}

export async function confirmPayment(c:Connection,token:string|undefined,value:unknown,boundary?:ReceiptBoundary){
  return mutation(c,token,()=>parseConfirmation(value),async(tx,{key,payment:input},actor,operation)=>{
    const adapter=requireBoundary(boundary),fingerprint=createHash("sha256").update(JSON.stringify(input)).digest("hex"),candidate=randomUUID();
    // Per-operation coordination precedes parent locks; no path acquires operation locks in reverse.
    await tx.insert(operationRequests).values({id:candidate,operationType:OPERATION,idempotencyKey:key,requestFingerprint:fingerprint,resultMetadata:{createdBy:actor}}).onDuplicateKeyUpdate({set:{id:sql`${operationRequests.id}`}});
    const [op]=await tx.select().from(operationRequests).where(and(eq(operationRequests.operationType,OPERATION),eq(operationRequests.idempotencyKey,key))).for("update");
    if(op.resultMetadata?.createdBy!==actor)throw new PaymentError("OPERATION_OWNER","Veprimi nuk u gjet.",404);
    if(op.requestFingerprint!==fingerprint)throw new PaymentError("IDEMPOTENCY_CONFLICT","Ky çelës konfirmimi është përdorur me vlera të tjera pagese.",409);
    if(op.status==="completed"&&typeof op.resultMetadata?.resultId==="string")return {paymentId:op.resultMetadata.resultId,version:op.resultMetadata.version,replayed:true};
    if(op.id!==candidate)throw new PaymentError("OPERATION_PENDING","Ky veprim nuk ka përfunduar. Kontrolloni gjendjen para se të provoni përsëri.",409);
    const locked=await aggregate(tx,input.projectId,input,true);await capacity(tx,input,locked.phases);
    const id=randomUUID();await tx.insert(payments).values({id,projectId:input.projectId,amount:input.amount,transactionDate:input.transactionDate,method:input.method,createdBy:actor,updatedBy:actor});
    for(const selected of input.allocations){const allocationId=randomUUID();await tx.insert(paymentAllocations).values({id:allocationId,paymentId:id,phaseId:selected.phaseId,amount:selected.amount,createdBy:actor,updatedBy:actor});const [after]=await tx.select().from(paymentAllocations).where(eq(paymentAllocations.id,allocationId));await record(tx,actor,operation,"payment_allocation","allocation_created",null,after);}
    const after=await find(tx,id),current=await allocations(tx,id);await record(tx,actor,operation,"payment","payment_received",null,after);
    await receipt(tx,adapter,{action:"confirm",actorId:actor,operationId:operation,before:null,after,allocations:current});
    await tx.update(operationRequests).set({status:"completed",resultMetadata:{createdBy:actor,resultId:id,resultType:"payment",version:1},updatedAt:sql`UTC_TIMESTAMP(3)`}).where(eq(operationRequests.id,op.id));
    return {paymentId:id,version:1,replayed:false};
  });
}
export async function correctPayment(c:Connection,token:string|undefined,id:string,value:unknown,boundary?:ReceiptBoundary){
  return mutation(c,token,()=>{referenceId(id);return parseCorrection(value);},async(tx,{version,payment:input},actor,operation)=>{
    const adapter=requireBoundary(boundary),hint=await find(tx,id);
    if(input.projectId!==hint.projectId)throw new PaymentError("TRANSFER","Kalimi i pagesave ndërmjet projekteve nuk mbështetet.",409);
    const locked=await aggregate(tx,hint.projectId,input,true),before=await find(tx,id,true),old=await allocations(tx,id,true);
    if(before.projectId!==hint.projectId||before.version!==hint.version||before.version!==version)throw conflict();
    validateOld(locked,old);
    if(before.status!=="received")throw new PaymentError("CANCELLED","Pagesat e anuluara mund vetëm të shikohen.",409);
    await capacity(tx,input,locked.phases,id);
    for(const row of old){const selected=input.allocations.find(item=>item.phaseId===row.phaseId);if(!selected&&row.deletedAt)continue;
      if(selected&&row.deletedAt===null&&selected.amount===row.amount)continue;
      await tx.update(paymentAllocations).set({amount:selected?.amount??row.amount,deletedAt:selected?null:sql`UTC_TIMESTAMP(3)`,version:row.version+1,updatedBy:actor,updatedAt:sql`UTC_TIMESTAMP(3)`}).where(eq(paymentAllocations.id,row.id));const [after]=await tx.select().from(paymentAllocations).where(eq(paymentAllocations.id,row.id));await record(tx,actor,operation,"payment_allocation",selected?"allocation_corrected":"allocation_retired",row,after);
    }
    for(const selected of input.allocations.filter(item=>!old.some(row=>row.phaseId===item.phaseId))){const allocationId=randomUUID();await tx.insert(paymentAllocations).values({id:allocationId,paymentId:id,phaseId:selected.phaseId,amount:selected.amount,createdBy:actor,updatedBy:actor});const [after]=await tx.select().from(paymentAllocations).where(eq(paymentAllocations.id,allocationId));await record(tx,actor,operation,"payment_allocation","allocation_created",null,after);}
    await tx.update(payments).set({amount:input.amount,transactionDate:input.transactionDate,method:input.method,version:before.version+1,updatedBy:actor,updatedAt:sql`UTC_TIMESTAMP(3)`}).where(eq(payments.id,id));
    const after=await find(tx,id);await record(tx,actor,operation,"payment","payment_corrected",before,after);await receipt(tx,adapter,{action:"correct",actorId:actor,operationId:operation,before,after,allocations:await allocations(tx,id)});return after;
  });
}
export async function cancelPayment(c:Connection,token:string|undefined,id:string,value:unknown,boundary?:ReceiptBoundary){
  return mutation(c,token,()=>{referenceId(id);return parseCancellation(value);},async(tx,input,actor,operation)=>{
    const adapter=requireBoundary(boundary),hint=await find(tx,id),locked=await aggregate(tx,hint.projectId,null,false);const before=await find(tx,id,true),current=await allocations(tx,id,true);
    validateOld(locked,current);
    if(before.projectId!==hint.projectId||before.version!==hint.version||before.version!==input.version)throw conflict();if(before.status!=="received")throw new PaymentError("CANCELLED","Kjo pagesë është anuluar më parë.",409);
    await tx.update(payments).set({status:"cancelled",cancelledAt:sql`UTC_TIMESTAMP(3)`,cancelledBy:actor,cancellationReason:input.reason,updatedBy:actor,version:before.version+1,updatedAt:sql`UTC_TIMESTAMP(3)`}).where(eq(payments.id,id));
    const after=await find(tx,id);await record(tx,actor,operation,"payment","payment_cancelled",before,after);await receipt(tx,adapter,{action:"cancel",actorId:actor,operationId:operation,before,after,allocations:current});return after;
  });
}
export async function paymentOperationStatus(c:Connection,token:string|undefined,key:string){
  const user=await requireSessionUser(c,token);operationKey(key);const [op]=await drizzle(c).select().from(operationRequests).where(and(eq(operationRequests.operationType,OPERATION),eq(operationRequests.idempotencyKey,key))).limit(1);
  if(!op||op.resultMetadata?.createdBy!==user.id)throw new PaymentError("NOT_FOUND","Veprimi nuk u gjet.",404);
  return {status:op.status,paymentId:op.status==="completed"?op.resultMetadata?.resultId:null,version:op.resultMetadata?.version??null};
}
export async function previewPayment(c:Connection,token:string|undefined,value:unknown){
  return mutation(c,token,()=>parsePayment(value),async(tx,input)=>{const locked=await aggregate(tx,input.projectId,input,true);await capacity(tx,input,locked.phases);return {valid:true,amount:input.amount,allocationTotal:input.amount,receiptReady:false,confirmationAvailable:true,message:"Ndarjet janë të vlefshme tani. Nuk është ruajtur pagesë. Konfirmoni për ta ruajtur dhe për të lëshuar dëftesën JO-FISKALE."};});
}
export async function previewPaymentCorrection(c:Connection,token:string|undefined,id:string,value:unknown){
  return mutation(c,token,()=>{referenceId(id);return parseCorrection(value);},async(tx,{version,payment:input})=>{
    const hint=await find(tx,id);if(input.projectId!==hint.projectId)throw new PaymentError("TRANSFER","Kalimi i pagesave ndërmjet projekteve nuk mbështetet.",409);
    const locked=await aggregate(tx,hint.projectId,input,true),current=await find(tx,id,true);validateOld(locked,await allocations(tx,id,true));
    if(current.version!==version||current.version!==hint.version||current.projectId!==hint.projectId)throw conflict();
    if(current.status!=="received")throw new PaymentError("CANCELLED","Pagesat e anuluara mund vetëm të shikohen.",409);
    await capacity(tx,input,locked.phases,id);return {valid:true,receiptReady:false,confirmationAvailable:true,message:"Ndarjet e korrigjuara janë të vlefshme tani. Ruani korrigjimin e konfirmuar për të shtuar version të ri PDF të dëftesës."};
  });
}
export async function paymentProject(c:Connection,token:string|undefined,id:string){
  await requireSessionUser(c,token);referenceId(id);
  return drizzle(c).transaction(async tx=>{
    const [project]=await tx.select({project:projects,clientName:clients.name,clientDeleted:clients.deletedAt}).from(projects).innerJoin(clients,eq(projects.clientId,clients.id)).where(eq(projects.id,id)).limit(1);
    if(!project)throw new PaymentError("NOT_FOUND","Projekti nuk u gjet.",404);
    const [contract]=await tx.select().from(contracts).where(eq(contracts.projectId,id)).limit(1);
    if(!contract)throw new PaymentError("CONTRACT","Nuk ka kontratë të disponueshme.",409);
    const phases=await tx.select().from(contractPhases).where(and(eq(contractPhases.contractId,contract.id),isNull(contractPhases.deletedAt))).orderBy(asc(contractPhases.sortOrder),asc(contractPhases.id)).limit(101);
    if(phases.length>100)throw new PaymentError("PHASE_LIMIT","Kontrata tejkalon kufirin e fazave të mbështetura nga formulari.",409);
    const totals=await tx.select({phaseId:paymentAllocations.phaseId,paid:sql<string>`SUM(${paymentAllocations.amount})`}).from(paymentAllocations).innerJoin(payments,eq(payments.id,paymentAllocations.paymentId)).where(and(eq(payments.projectId,id),eq(payments.status,"received"),isNull(paymentAllocations.deletedAt))).groupBy(paymentAllocations.phaseId).limit(1000);
    return {project:project.project,clientName:project.clientName,contract,eligible:!project.clientDeleted&&!project.project.deletedAt&&project.project.status==="active"&&contract.status==="active",phases:phases.map(phase=>{const paid=totals.find(row=>row.phaseId===phase.id)?.paid??"0.00";return {...phase,paid,remaining:decimal(cents(phase.value)-cents(paid))};})};
  },{isolationLevel:"repeatable read",accessMode:"read only"});
}
export async function getPayment(c:Connection,token:string|undefined,id:string){
  await requireSessionUser(c,token);referenceId(id);
  return drizzle(c).transaction(async tx=>{
    const [data]=await tx.select({payment:payments,projectName:projects.name,clientName:clients.name,receipt:paymentReceipts}).from(payments).innerJoin(projects,eq(payments.projectId,projects.id)).innerJoin(clients,eq(projects.clientId,clients.id)).leftJoin(paymentReceipts,eq(paymentReceipts.paymentId,payments.id)).where(eq(payments.id,id)).limit(1);
    if(!data)throw new PaymentError("NOT_FOUND","Pagesa nuk u gjet.",404);
    const rows=await tx.select({allocation:paymentAllocations,phaseName:contractPhases.name}).from(paymentAllocations).innerJoin(contractPhases,eq(paymentAllocations.phaseId,contractPhases.id)).where(eq(paymentAllocations.paymentId,id)).orderBy(asc(paymentAllocations.phaseId)).limit(1001);
    if(rows.length>1000)throw new PaymentError("ALLOCATION_LIMIT","Ndarjet historike tejkalojnë kufirin e mbështetur të shfaqjes.",409);
    const allocationIds=tx.select({id:paymentAllocations.id}).from(paymentAllocations).where(eq(paymentAllocations.paymentId,id));
    const history=await tx.select({id:auditEvents.id,action:auditEvents.action,entityType:auditEvents.entityType,actorName:users.displayName,recordedAt:auditEvents.recordedAt,before:auditEvents.beforeSnapshot,after:auditEvents.afterSnapshot}).from(auditEvents).leftJoin(users,eq(users.id,auditEvents.actorId)).where(or(and(eq(auditEvents.entityType,"payment"),eq(auditEvents.entityId,id)),and(eq(auditEvents.entityType,"payment_allocation"),inArray(auditEvents.entityId,allocationIds)))).orderBy(desc(auditEvents.recordedAt),desc(auditEvents.id)).limit(30);
    return {...data,allocations:rows,history};
  },{isolationLevel:"repeatable read",accessMode:"read only"});
}
export async function listPayments(c:Connection,token:string|undefined,value:Record<string,unknown>={}){
  await requireSessionUser(c,token);const query=parsePaymentQuery(value);
  const where=and(query.status==="all"?undefined:eq(payments.status,query.status),query.method==="all"?undefined:eq(payments.method,query.method),query.projectId?eq(payments.projectId,query.projectId):undefined,query.from?gte(payments.transactionDate,query.from):undefined,query.to?lte(payments.transactionDate,query.to):undefined,query.q?or(...[payments.id,projects.name,clients.name,paymentReceipts.receiptNumber].map(column=>sql`${column} LIKE ${escapedSearch(query.q)} ESCAPE '='`)):undefined);
  return drizzle(c).transaction(async tx=>{
    const [{total}]=await tx.select({total:count()}).from(payments).innerJoin(projects,eq(payments.projectId,projects.id)).innerJoin(clients,eq(projects.clientId,clients.id)).leftJoin(paymentReceipts,eq(paymentReceipts.paymentId,payments.id)).where(where);
    const rows=await tx.select({payment:payments,projectName:projects.name,clientName:clients.name,receiptStatus:paymentReceipts.status}).from(payments).innerJoin(projects,eq(payments.projectId,projects.id)).innerJoin(clients,eq(projects.clientId,clients.id)).leftJoin(paymentReceipts,eq(paymentReceipts.paymentId,payments.id)).where(where).orderBy(desc(payments.transactionDate),desc(payments.id)).limit(20).offset((query.page-1)*20);
    return {rows,total:Number(total),pageSize:20,query};
  },{isolationLevel:"repeatable read",accessMode:"read only"});
}
export type PaymentDetails=Awaited<ReturnType<typeof getPayment>>;
export type PaymentProject=Awaited<ReturnType<typeof paymentProject>>;
