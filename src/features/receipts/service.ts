import {randomUUID} from "node:crypto";
import {and,asc,count,desc,eq,or,sql} from "drizzle-orm";
import {drizzle} from "drizzle-orm/mysql2";
import type {Connection,RowDataPacket} from "mysql2/promise";
import {auditEvents,clients,contractPhases,entityVersions,paymentReceipts,payments,projects,receiptCounters,receiptVersions,users} from "@/server/db/schema";
import {safeHistorySnapshot,type HistorySnapshot} from "@/server/db/history-snapshot";
import {requireSessionUser} from "@/server/auth/sessions";
import {requireOperator,type OperatorContext} from "@/server/auth/operator";
import {referenceId,referenceObject,ReferenceError} from "@/features/references/validation";
import {escapedSearch} from "@/features/clients/validation";
import {text} from "@/features/expenses/validation";
import {cancelPayment,confirmPayment,correctPayment,type PaymentTx,type ReceiptBoundary,type ReceiptContext} from "@/features/payments/service";
import {PrivateReceiptStore,type ReceiptFault} from "./storage";
import {renderReceiptPdf} from "./pdf";

export const documentUnavailable=()=>new ReferenceError("DOCUMENT_UNAVAILABLE","The receipt document is unavailable or failed integrity checks. No new payment should be submitted; check the original operation and contact your operator.",503);
export function formatReceiptNumber(sequence:bigint,prefix=process.env.RECEIPT_NUMBER_PREFIX??"DEV"){
  if(!/^[A-Z0-9]{1,16}$/.test(prefix)||sequence<BigInt(1)||sequence>=BigInt("18446744073709551615"))throw new Error("Invalid development receipt numbering configuration.");
  return `${prefix}-${sequence.toString().padStart(8,"0")}`;
}
async function storeFor(c:Connection,fault:ReceiptFault=async()=>{}){const [rows]=await c.query<RowDataPacket[]>("SELECT CONCAT(@@server_uuid,'/',DATABASE()) AS identity");return new PrivateReceiptStore(String(rows[0].identity),fault);}
async function withStore<R>(c:Connection,fault:ReceiptFault,work:(store:PrivateReceiptStore)=>Promise<R>){
  const store=await storeFor(c,fault),lock=store.lockName();
  const [acquired]=await c.execute<RowDataPacket[]>("SELECT GET_LOCK(?,10) AS acquired",[lock]);if(Number(acquired[0].acquired)!==1)throw new Error("Receipt storage is busy. Retry the same operation key.");
  try{await store.initialize();return await work(store);}finally{await c.execute("SELECT RELEASE_LOCK(?)",[lock]).catch(()=>{});}
}
async function receiptAudit(tx:PaymentTx,context:ReceiptContext,before:typeof paymentReceipts.$inferSelect|null,after:typeof paymentReceipts.$inferSelect,snapshot?:HistorySnapshot){
  const afterSnapshot=safeHistorySnapshot({...after,...(snapshot?{paymentVersion:snapshot.paymentVersion,documentVersion:snapshot.documentVersion,storageReference:snapshot.storageReference,fileChecksum:snapshot.fileChecksum}:{paymentVersion:context.after.version})});
  await tx.insert(auditEvents).values({id:randomUUID(),actorId:context.actorId,operationId:context.operationId,entityType:"receipt",entityId:after.id,action:context.action==="confirm"?"receipt_issued":context.action==="correct"?"receipt_corrected":"receipt_cancelled",beforeSnapshot:before?safeHistorySnapshot({...before}):null,afterSnapshot});
  await tx.insert(entityVersions).values({id:randomUUID(),entityType:"receipt",entityId:after.id,version:after.version,snapshot:afterSnapshot});
}
function boundary(store:PrivateReceiptStore,fault:ReceiptFault):ReceiptBoundary{return {mode:"wp09",async apply(tx,context){
  const [before]=await tx.select().from(paymentReceipts).where(eq(paymentReceipts.paymentId,context.after.id)).for("update");
  if(context.action!=="confirm"&&!before)throw new ReferenceError("RECEIPT_LEGACY","This historical payment has no receipt identity. Automatic retroactive issuance is unavailable.",409);
  if(context.action==="confirm"&&before)throw new ReferenceError("RECEIPT_EXISTS","A receipt already exists for this payment.",409);
  let id=before?.id,number=before?.receiptNumber,documentVersion=1;
  if(before){
    if(before.status!=="issued")throw new ReferenceError("RECEIPT_STATE","Only issued receipts can be corrected or cancelled.",409);
    const [latest]=await tx.select().from(receiptVersions).where(eq(receiptVersions.receiptId,before.id)).orderBy(desc(receiptVersions.version)).limit(1);
    if(!latest)throw documentUnavailable();await store.read(latest.storageReference,latest.fileChecksum);
    if(latest.contentSnapshot.paymentId!==context.after.id||latest.contentSnapshot.version!==context.before?.version)throw new ReferenceError("RECEIPT_CONFLICT","The current receipt does not match the payment revision.",409);
    documentVersion=latest.version+1;
  }
  if(context.action==="cancel"){
    await tx.update(paymentReceipts).set({status:"void",version:before!.version+1,updatedBy:context.actorId,cancelledBy:context.actorId,cancelledAt:context.after.cancelledAt,cancellationReason:context.after.cancellationReason,updatedAt:sql`UTC_TIMESTAMP(3)`}).where(eq(paymentReceipts.id,id!));
    const [after]=await tx.select().from(paymentReceipts).where(eq(paymentReceipts.id,id!));await receiptAudit(tx,context,before,after);await fault("beforeCommit");return;
  }
  if(!before){
    await tx.insert(receiptCounters).values({scope:"company"}).onDuplicateKeyUpdate({set:{scope:sql`${receiptCounters.scope}`}});
    const [counter]=await tx.select().from(receiptCounters).where(eq(receiptCounters.scope,"company")).for("update");
    number=formatReceiptNumber(counter.nextNumber);id=randomUUID();
    await tx.update(receiptCounters).set({nextNumber:counter.nextNumber+BigInt(1),updatedAt:sql`UTC_TIMESTAMP(3)`}).where(eq(receiptCounters.scope,"company"));
  }
  const [joined]=await tx.select({clientId:clients.id,clientName:clients.name,projectName:projects.name,location:projects.location}).from(projects).innerJoin(clients,eq(projects.clientId,clients.id)).where(eq(projects.id,context.after.projectId)).limit(1);
  const [actor]=await tx.select({name:users.displayName}).from(users).where(eq(users.id,context.actorId)).limit(1);
  const active=context.allocations.filter(row=>row.deletedAt===null),phaseIds=active.map(row=>row.phaseId);
  const names=phaseIds.length?await tx.select({id:contractPhases.id,name:contractPhases.name}).from(contractPhases).where(or(...phaseIds.map(id=>eq(contractPhases.id,id)))).orderBy(asc(contractPhases.id)).limit(100):[];
  const company=process.env.RECEIPT_COMPANY_NAME?.trim()||"Company name not configured - DEVELOPMENT ONLY";
  if(!company||company.length>200||/[\u0000-\u001f\u007f-\u009f]/u.test(company))throw new Error("Configure a valid receipt company display name.");
  const issuedAt=new Date().toISOString().replace("T"," ").slice(0,23);
  const snapshot=safeHistorySnapshot({receiptId:id!,receiptNumber:number!,documentVersion,companyName:company,paymentId:context.after.id,paymentVersion:context.after.version,version:context.after.version,projectId:context.after.projectId,...joined,amount:context.after.amount,method:context.after.method,transactionDate:context.after.transactionDate,issuedAt,issuerName:actor.name,status:"issued",allocationsText:active.map(row=>`${names.find(phase=>phase.id===row.phaseId)?.name??"Phase"}: ${row.amount} EUR`).join("\n")});
  await fault("beforeRender");const bytes=await renderReceiptPdf(snapshot);await fault("afterRender");
  const stored=await store.put(bytes);await fault("beforeMetadata");
  if(before)await tx.update(paymentReceipts).set({version:before.version+1,updatedBy:context.actorId,updatedAt:sql`UTC_TIMESTAMP(3)`}).where(eq(paymentReceipts.id,id!));
  else await tx.insert(paymentReceipts).values({id:id!,paymentId:context.after.id,receiptNumber:number!,status:"issued",createdBy:context.actorId,updatedBy:context.actorId});
  await tx.insert(receiptVersions).values({id:randomUUID(),receiptId:id!,version:documentVersion,contentSnapshot:snapshot,...stored,issuedAt,issuedBy:context.actorId});
  const [after]=await tx.select().from(paymentReceipts).where(eq(paymentReceipts.id,id!));
  await receiptAudit(tx,context,before??null,after,{...snapshot,...stored});await fault("afterMetadata");await fault("beforeCommit");
}};}

/** Trusted server orchestrator; no test/fault parameter is accepted by an HTTP route. */
export async function withReceiptWorkflow<R>(c:Connection,token:string|undefined,work:(adapter:ReceiptBoundary)=>Promise<R>,fault:ReceiptFault=async()=>{}){
  await requireSessionUser(c,token);
  return withStore(c,fault,async store=>{
    try{const result=await work(boundary(store,fault));await fault("afterCommit");return result;}
    catch(error){if(store.written.length)await store.recover(c,store.written).catch(()=>{});throw error;}
  });
}
export async function confirmPaymentWithReceipt(c:Connection,token:string|undefined,value:unknown){
  const result=await withReceiptWorkflow(c,token,b=>confirmPayment(c,token,value,b));
  const data=await getPaymentReceipt(c,token,result.paymentId);if(!data||!data.documentAvailable)throw documentUnavailable();
  // A later correction must not change the original confirmation's immutable result.
  await downloadReceipt(c,token,data.receipt.id,1);
  return {...result,receiptId:data.receipt.id,receiptNumber:data.receipt.receiptNumber,documentVersion:1,documentAvailable:true};
}
export const correctPaymentWithReceipt=(c:Connection,t:string|undefined,id:string,value:unknown)=>withReceiptWorkflow(c,t,b=>correctPayment(c,t,id,value,b));
export const cancelPaymentWithReceipt=(c:Connection,t:string|undefined,id:string,value:unknown)=>withReceiptWorkflow(c,t,b=>cancelPayment(c,t,id,value,b));

function versionNumber(value:unknown){const n=typeof value==="string"&&/^\d{1,10}$/.test(value)?Number(value):value;if(typeof n!=="number"||!Number.isInteger(n)||n<1||n>4294967295)throw new ReferenceError("NOT_FOUND","Receipt version not found.",404);return n;}
export async function getReceipt(c:Connection,token:string|undefined,id:string,page=1){
  await requireSessionUser(c,token);referenceId(id);if(!Number.isInteger(page)||page<1||page>10000)throw new ReferenceError("PAGE","Invalid version page.");
  const data=await drizzle(c).transaction(async tx=>{
    const [receipt]=await tx.select().from(paymentReceipts).where(eq(paymentReceipts.id,id)).limit(1);if(!receipt)throw new ReferenceError("NOT_FOUND","Receipt not found.",404);
    const [current]=await tx.select().from(receiptVersions).where(eq(receiptVersions.receiptId,id)).orderBy(desc(receiptVersions.version)).limit(1);
    const versions=await tx.select({id:receiptVersions.id,version:receiptVersions.version,issuedAt:receiptVersions.issuedAt,issuedBy:receiptVersions.issuedBy,fileChecksum:receiptVersions.fileChecksum,contentSnapshot:receiptVersions.contentSnapshot}).from(receiptVersions).where(eq(receiptVersions.receiptId,id)).orderBy(desc(receiptVersions.version)).limit(20).offset((page-1)*20);
    const [{total}]=await tx.select({total:count()}).from(receiptVersions).where(eq(receiptVersions.receiptId,id));
    return {receipt,current:current??null,versions,total:Number(total),page};
  },{isolationLevel:"repeatable read",accessMode:"read only"});
  let documentAvailable=false;
  if(data.current){try{const store=await storeFor(c);await store.initialize();await store.read(data.current.storageReference,data.current.fileChecksum);documentAvailable=true;}catch{documentAvailable=false;}}
  const current=data.current?{version:data.current.version,issuedAt:data.current.issuedAt,contentSnapshot:data.current.contentSnapshot,fileChecksum:data.current.fileChecksum}:null;
  return {...data,current,documentAvailable};
}
export async function getPaymentReceipt(c:Connection,token:string|undefined,paymentId:string){
  await requireSessionUser(c,token);referenceId(paymentId);const [row]=await drizzle(c).select({id:paymentReceipts.id}).from(paymentReceipts).where(eq(paymentReceipts.paymentId,paymentId)).limit(1);return row?getReceipt(c,token,row.id):null;
}
export async function downloadReceipt(c:Connection,token:string|undefined,id:string,value:unknown){
  await requireSessionUser(c,token);referenceId(id);const version=versionNumber(value);
  const [row]=await drizzle(c).select({receipt:paymentReceipts,document:receiptVersions}).from(paymentReceipts).innerJoin(receiptVersions,eq(receiptVersions.receiptId,paymentReceipts.id)).where(and(eq(paymentReceipts.id,id),eq(receiptVersions.version,version))).limit(1);
  if(!row)throw new ReferenceError("NOT_FOUND","Receipt version not found.",404);
  try{const store=await storeFor(c);await store.initialize();const bytes=await store.read(row.document.storageReference,row.document.fileChecksum);return {bytes,number:row.receipt.receiptNumber,version,status:row.receipt.status};}catch{throw documentUnavailable();}
}
export async function recoverReceiptFiles(c:Connection,operator:OperatorContext,after=""){
  requireOperator(operator);return withStore(c,async()=>{},store=>store.recover(c,undefined,after));
}
export function parseReceiptQuery(value:Record<string,unknown>){
  referenceObject(value,["q","status","page"]);const q=value.q===undefined?"":text(value.q,"q",100,false),status=value.status??"all";
  if(status!=="all"&&status!=="issued"&&status!=="void"&&status!=="draft")throw new ReferenceError("STATUS","Invalid receipt status.");
  if(value.page!==undefined&&typeof value.page!=="number"&&typeof value.page!=="string")throw new ReferenceError("PAGE","Invalid page.");
  const page=value.page===undefined||value.page===""?1:Number(value.page);if(!Number.isInteger(page)||page<1||page>10000)throw new ReferenceError("PAGE","Invalid page.");
  return {q,status:status as "all"|"issued"|"void"|"draft",page};
}
export async function listReceipts(c:Connection,token:string|undefined,value:Record<string,unknown>={}){
  await requireSessionUser(c,token);const query=parseReceiptQuery(value);
  const where=and(query.status==="all"?undefined:eq(paymentReceipts.status,query.status),query.q?or(...[paymentReceipts.receiptNumber,projects.name,clients.name].map(column=>sql`${column} LIKE ${escapedSearch(query.q)} ESCAPE '='`)):undefined);
  return drizzle(c).transaction(async tx=>{
    const [{total}]=await tx.select({total:count()}).from(paymentReceipts).innerJoin(payments,eq(paymentReceipts.paymentId,payments.id)).innerJoin(projects,eq(payments.projectId,projects.id)).innerJoin(clients,eq(projects.clientId,clients.id)).where(where);
    const rows=await tx.select({receipt:paymentReceipts,projectName:projects.name,clientName:clients.name,amount:payments.amount}).from(paymentReceipts).innerJoin(payments,eq(paymentReceipts.paymentId,payments.id)).innerJoin(projects,eq(payments.projectId,projects.id)).innerJoin(clients,eq(projects.clientId,clients.id)).where(where).orderBy(desc(paymentReceipts.createdAt),desc(paymentReceipts.id)).limit(20).offset((query.page-1)*20);
    return {rows,total:Number(total),query,pageSize:20};
  },{isolationLevel:"repeatable read",accessMode:"read only"});
}
