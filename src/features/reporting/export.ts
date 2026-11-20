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
import {demoMode,DEMO_LABEL} from '@/server/demo/policy';
export function portable(value:unknown):unknown{
 if(Array.isArray(value))return value.map(portable);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).filter(([key])=>!/(password|token|secret|operator|storagereference|authversion|databaseurl|mfa|totp|recoverycode|recoveryhash|verifier|seed|cipher|encryptionkey|keyid|challenge)/i.test(key.replace(/[_-]/g,''))).map(([key,v])=>[key,portable(v)]));return value;
}
export function csvCell(value:unknown){let text=typeof value==="object"&&value!==null?JSON.stringify(value):value===null||value===undefined?"":String(value);if(/^[\s\u0000-\u0020]*[=+@-]/u.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export async function companyReport(c:Connection,token:string|undefined,filters:unknown={}){await requireSessionUser(c,token);const f=reportFilter(filters),report=finances(await materialize(c,token),f);if(report.income.length+report.outgoing.length>1000)throw limitError();return report;}
export async function dashboard(c:Connection,token:string|undefined){await requireSessionUser(c,token);return finances(await materialize(c,token),reportFilter());}
async function exported(c:Connection,token:string|undefined,id:string,kind:string){
 const actor=await requireSessionUser(c,token);await drizzle(c).transaction(async tx=>{await tx.select({id:users.id}).from(users).where(eq(users.id,actor.id)).for("share");await requireSessionUser(c,token);await tx.insert(auditEvents).values({id:randomUUID(),actorId:actor.id,entityType:"export",entityId:id,operationId:id,action:"export_prepared",afterSnapshot:{resultType:kind,resultId:id,status:"prepared",version:1}});},{isolationLevel:"read committed"});securitySignal('export.prepared');
}
async function exclusive<T>(c:Connection,token:string|undefined,work:()=>Promise<T>){
 await requireSessionUser(c,token);const [rows]=await c.query<RowDataPacket[]>("SELECT GET_LOCK(CONCAT('fitimi_export_',LEFT(SHA2(DATABASE(),256),48)),0) AS acquired");if(Number(rows[0].acquired)!==1)throw new ReportingError("BUSY","Një eksport tjetër po kryhet. Provoni pas pak.",429);
 try{return await work();}finally{await c.query("DO RELEASE_LOCK(CONCAT('fitimi_export_',LEFT(SHA2(DATABASE(),256),48)))").catch(()=>{});}
}
export async function exportCompany(c:Connection,token:string|undefined,input:unknown){
 await requireSessionUser(c,token);const {format,filters}=companyExportInput(input);
 return exclusive(c,token,async()=>{const report=await companyReport(c,token,filters),id=randomUUID(),bytes=await(format==="pdf"?companyPdf(report):companyXlsx(report));await exported(c,token,id,`company_${format}`);return {bytes,name:`raporti-financiar-i-kompanise.${format}`,type:format==="pdf"?"application/pdf":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",snapshot:report.generatedAt,id};});
}
export async function archiveSnapshot(c:Connection,token:string|undefined,s:Snapshot,id:string,observe:(name:string)=>Promise<void>=async()=>{}){
 await requireSessionUser(c,token);const zip=new JSZip(),files:Record<string,Buffer>={},datasets:Record<string,{rows:number;json:string;csv:string}>={};let size=0;
 const add=(name:string,bytes:Buffer)=>{size+=bytes.length;if(size>64*1024*1024)throw limitError();files[name]=bytes;};
 if(demoMode())add('README-DEMO.txt',Buffer.from(`${DEMO_LABEL}\nDokumentet dhe të dhënat janë vetëm për demonstrim; nuk përfaqësojnë transaksione reale.\n`));
 for(const [name,raw]of Object.entries(s.data)){if(!Object.hasOwn(exportTables,name))throw new Error("Grup i panjohur të dhënash për eksport.");const rows=portable(raw) as Record<string,unknown>[],headers=portable(Object.fromEntries(Object.keys(getTableColumns(exportTables[name as keyof typeof exportTables])).map(key=>[key,null]))) as Record<string,unknown>,columns=Object.keys(headers).sort();const json=`data/${name}.json`,csv=`data/${name}.csv`;add(json,Buffer.from(JSON.stringify(rows)));add(csv,Buffer.from('\uFEFF'+[columns.map(csvCell).join(','),...rows.map(row=>columns.map(col=>csvCell(row[col])).join(','))].join('\r\n')));datasets[name]={rows:rows.length,json,csv};await requireSessionUser(c,token);await observe(name);}
 if(s.data.receipt_versions.length>256)throw limitError();let pdfBytes=0;
 for(const row of s.data.receipt_versions){await requireSessionUser(c,token);const pdf=await downloadReceipt(c,token,String(row.receiptId),row.version);if(checksum(pdf.bytes)!==row.fileChecksum)throw new Error("Hash-i i PDF-së nuk përputhet me gjendjen e ruajtur.");pdfBytes+=pdf.bytes.length;if(pdfBytes>48*1024*1024)throw limitError();add(`receipts/${row.receiptId}/v${row.version}.pdf`,pdf.bytes);}
 add("udhezuesi-i-eksportit.pdf",await operationalPdf("Eksporti i plotë i të dhënave të biznesit",[{heading:"Gjendja e ruajtur dhe plotësia",lines:[`Skema: fitimi-business-export/1`,`Eksporti: ${id}`,`Gjendja e ruajtur UTC: ${s.generatedAt}`,"Çdo grup të dhënash përmban regjistrimet aktive, të anuluara, të arkivuara dhe historike. JSON është formati referues pa humbje; CSV është UTF-8 dhe vlerat me prefikse të rrezikshme për tabelat paraprihen nga apostrofi.","Shumat dhe datat kalendarike mbeten tekst i saktë. Gjatë importimit të CSV-së në tabela, importojini shumat dhjetore dhe identifikuesit si tekst.","Të gjitha versionet e dëftesave të referuara nga baza përfshihen si PDF origjinale të verifikuara; asnjë dëftesë nuk rigjenerohet."]},{heading:"Numri i rreshtave sipas grupit të të dhënave",lines:Object.entries(datasets).map(([name,v])=>`${name}: ${v.rows}`)},{heading:"Përjashtimet e sigurisë",lines:["Përjashtohen sesionet e autentikimit, hash-et e fjalëkalimeve, versionet e autentikimit, kufizimet e hyrjes, kredencialet e operatorit, konfigurimi i infrastrukturës, referencat private të ruajtjes, kërkesat dhe numëruesit e brendshëm të idempotencës dhe veprimet vetëm të autentikimit.","Eksporti përmban të dhëna të ndjeshme biznesi dhe personale. Ruajeni në mënyrë të sigurt. Përgatitja e eksportit regjistrohet pas kësaj gjendjeje; ky veprim nuk përfshihet në të."]}]));
 const manifest={schema:"fitimi-business-export/1",id,generatedAt:s.generatedAt,complete:true,datasets,documents:s.data.receipt_versions.length,archiveEntries:[...Object.keys(files),"manifest.json","SHA256SUMS.txt"],files:Object.entries(files).map(([name,b])=>({name,bytes:b.length,sha256:checksum(b)})),notes:["JSON ruan vlerat origjinale të sakta; teksti CSV që mund të nisë formulë mbrohet me apostrof.","Pa sekrete autentikimi ose infrastrukture. Gjendja e dëftesës i përket çastit të eksportit; kontrolloni gjendjen aktuale në aplikacion.","Manifesti nuk llogarit hash-in e vet; SHA256SUMS.txt mbulon manifestin dhe çdo skedar tjetër, përveç vetes.","Veprimi i përgatitjes së eksportit regjistrohet pas krijimit të gjendjes së ruajtur."]};
 add("manifest.json",Buffer.from(JSON.stringify(manifest,null,2)));add("SHA256SUMS.txt",Buffer.from(Object.entries(files).map(([name,b])=>`${checksum(b)}  ${name}`).join('\n')+'\n'));
 for(const [name,bytes]of Object.entries(files))zip.file(name,bytes);const bytes=await zip.generateAsync({type:"nodebuffer",compression:"STORE"});if(bytes.length>65*1024*1024)throw limitError();await requireSessionUser(c,token);return bytes;
}
export async function exportBusiness(c:Connection,token:string|undefined,value:unknown){
 await requireSessionUser(c,token);const input=referenceObject(value,["confirmation"]);if(input.confirmation!=="export-all")throw new ReportingError("CONFIRM","Konfirmoni eksportin e plotë të të dhënave të ndjeshme të biznesit.");
 return exclusive(c,token,async()=>{const snapshot=await materialize(c,token,true),id=randomUUID(),bytes=await archiveSnapshot(c,token,snapshot,id);await exported(c,token,id,"business_zip");return {bytes,name:"te-dhenat-e-biznesit.zip",type:"application/zip",snapshot:snapshot.generatedAt,id};});
}
