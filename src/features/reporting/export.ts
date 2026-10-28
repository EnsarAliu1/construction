import "server-only";
import {randomUUID} from "node:crypto";
import JSZip from "jszip";
import {eq,getTableColumns} from "drizzle-orm";
import {drizzle} from "drizzle-orm/mysql2";
import type {Connection,RowDataPacket} from "mysql2/promise";
import {auditEvents,users} from "@/server/db/schema";
import {requireSessionUser} from "@/server/auth/sessions";
import {referenceObject} from "@/features/references/validation";
import {checksum} from "@/features/receipts/storage";
import {downloadReceipt} from "@/features/receipts/service";
import {materialize,exportTables,type Snapshot} from "./snapshot";
import {finances} from "./finance";
import {companyExportInput,reportFilter,ReportingError,limitError} from "./validation";
import {companyPdf,companyXlsx,operationalPdf} from "./documents";
import {securitySignal} from "@/server/operations/events";
export function portable(value:unknown):unknown{
 if(Array.isArray(value))return value.map(portable);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([key])=>!/(password|token|secret|operator|storageReference|authVersion|databaseUrl)/i.test(key)).map(([key,v])=>[key,portable(v)]));return value;
}
export function csvCell(value:unknown){let text=typeof value==="object"&&value!==null?JSON.stringify(value):value===null||value===undefined?"":String(value);if(/^[\s\u0000-\u0020]*[=+@-]/u.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export async function companyReport(c:Connection,token:string|undefined,filters:unknown={}){await requireSessionUser(c,token);const f=reportFilter(filters),report=finances(await materialize(c,token),f);if(report.income.length+report.outgoing.length>1000)throw limitError();return report;}
export async function dashboard(c:Connection,token:string|undefined){await requireSessionUser(c,token);return finances(await materialize(c,token),reportFilter());}
async function exported(c:Connection,token:string|undefined,id:string,kind:string){
 const actor=await requireSessionUser(c,token);await drizzle(c).transaction(async tx=>{await tx.select({id:users.id}).from(users).where(eq(users.id,actor.id)).for("share");await requireSessionUser(c,token);await tx.insert(auditEvents).values({id:randomUUID(),actorId:actor.id,entityType:"export",entityId:id,operationId:id,action:"export_prepared",afterSnapshot:{resultType:kind,resultId:id,status:"prepared",version:1}});},{isolationLevel:"read committed"});securitySignal('export.prepared');
}
async function exclusive<T>(c:Connection,token:string|undefined,work:()=>Promise<T>){
 await requireSessionUser(c,token);const [rows]=await c.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT('fitimi_export_',LEFT(SHA2(DATABASE(),256),48)),0) AS acquired");if(Number(rows[0].acquired)!==1)throw new ReportingError("BUSY","Another export is running. Retry shortly.",429);
 try{return await work();}finally{await c.query("DO RELEASE_LOCK(CONCAT('fitimi_export_',LEFT(SHA2(DATABASE(),256),48)))").catch(()=>{});}
}
export async function exportCompany(c:Connection,token:string|undefined,input:unknown){
 await requireSessionUser(c,token);const {format,filters}=companyExportInput(input);
 return exclusive(c,token,async()=>{const report=await companyReport(c,token,filters),id=randomUUID(),bytes=await(format==="pdf"?companyPdf(report):companyXlsx(report));await exported(c,token,id,`company_${format}`);return {bytes,name:`company-financial-report.${format}`,type:format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",snapshot:report.generatedAt,id};});
}
export async function archiveSnapshot(c:Connection,token:string|undefined,s:Snapshot,id:string,observe:(name:string)=>Promise<void>=async()=>{}){
 await requireSessionUser(c,token);const zip=new JSZip(),files:Record<string,Buffer>={},datasets:Record<string,{rows:number;json:string;csv:string}>={};let size=0;
 const add=(name:string,bytes:Buffer)=>{size+=bytes.length;if(size>64*1024*1024)throw limitError();files[name]=bytes;};
 for(const [name,raw]of Object.entries(s.data)){if(!Object.hasOwn(exportTables,name))throw new Error("Unknown export dataset.");const rows=portable(raw) as Record<string,unknown>[],headers=portable(Object.fromEntries(Object.keys(getTableColumns(exportTables[name as keyof typeof exportTables])).map(key=>[key,null]))) as Record<string,unknown>,columns=Object.keys(headers).sort();const json=`data/${name}.json`,csv=`data/${name}.csv`;add(json,Buffer.from(JSON.stringify(rows)));add(csv,Buffer.from('\uFEFF'+[columns.map(csvCell).join(','),...rows.map(row=>columns.map(col=>csvCell(row[col])).join(','))].join('\r\n')));datasets[name]={rows:rows.length,json,csv};await requireSessionUser(c,token);await observe(name);}
 if(s.data.receipt_versions.length>256)throw limitError();let pdfBytes=0;
 for(const row of s.data.receipt_versions){await requireSessionUser(c,token);const pdf=await downloadReceipt(c,token,String(row.receiptId),row.version);if(checksum(pdf.bytes)!==row.fileChecksum)throw new Error("Snapshot PDF checksum mismatch.");pdfBytes+=pdf.bytes.length;if(pdfBytes>48*1024*1024)throw limitError();add(`receipts/${row.receiptId}/v${row.version}.pdf`,pdf.bytes);}
 add("export-guide.pdf",await operationalPdf("Complete business data export",[{heading:"Snapshot and completeness",lines:[`Schema: fitimi-business-export/1`,`Export: ${id}`,`Snapshot UTC: ${s.generatedAt}`,"Every included dataset retains active, cancelled, archived and historical records. JSON is the canonical lossless dataset; CSV is UTF-8 with dangerous spreadsheet-leading values prefixed by an apostrophe.","Money and calendar dates remain exact strings. Import decimal amounts and identifiers as text when using spreadsheet CSV import.","All database-referenced receipt versions in this snapshot are included as their original verified PDF bytes; no receipt is regenerated."]},{heading:"Dataset row counts",lines:Object.entries(datasets).map(([name,v])=>`${name}: ${v.rows}`)},{heading:"Security exclusions",lines:["Authentication sessions/digests, password hashes, auth version, login limits, operator credentials, infrastructure/environment values, raw private storage references, internal idempotency requests/counters and authentication-only audit events are excluded.","This export contains sensitive business and personal data. Store it securely. Export preparation is audited after this snapshot; this operation's own audit event is therefore not inside the snapshot."]}]));
 const manifest={schema:"fitimi-business-export/1",id,generatedAt:s.generatedAt,complete:true,datasets,documents:s.data.receipt_versions.length,archiveEntries:[...Object.keys(files),"manifest.json","SHA256SUMS.txt"],files:Object.entries(files).map(([name,b])=>({name,bytes:b.length,sha256:checksum(b)})),notes:["JSON preserves exact original values; CSV formula-leading text is apostrophe-escaped.","No authentication or infrastructure secrets. Receipt status is the exported snapshot state; consult current application status.","Manifest does not hash itself; SHA256SUMS.txt covers the manifest and every payload, excluding itself.","Export-prepared audit is appended after snapshot materialization."]};
 add("manifest.json",Buffer.from(JSON.stringify(manifest,null,2)));add("SHA256SUMS.txt",Buffer.from(Object.entries(files).map(([name,b])=>`${checksum(b)}  ${name}`).join('\n')+'\n'));
 for(const [name,bytes]of Object.entries(files))zip.file(name,bytes);const bytes=await zip.generateAsync({type:"nodebuffer",compression:"STORE"});if(bytes.length>65*1024*1024)throw limitError();await requireSessionUser(c,token);return bytes;
}
export async function exportBusiness(c:Connection,token:string|undefined,value:unknown){
 await requireSessionUser(c,token);const input=referenceObject(value,["confirmation"]);if(input.confirmation!=="export-all")throw new ReportingError("CONFIRM","Confirm the sensitive complete business export.");
 return exclusive(c,token,async()=>{const snapshot=await materialize(c,token,true),id=randomUUID(),bytes=await archiveSnapshot(c,token,snapshot,id);await exported(c,token,id,"business_zip");return {bytes,name:"complete-business-data.zip",type:"application/zip",snapshot:snapshot.generatedAt,id};});
}
