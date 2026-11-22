import {createHash,randomUUID} from "node:crypto";
// Private runtime paths are explicitly excluded from static asset tracing.
import * as fs from "node:fs/promises";
import {dirname,isAbsolute,relative,resolve,sep} from "node:path";
import type {Connection,RowDataPacket} from "mysql2/promise";
import {secureWindowsReceiptDirectory} from "./permissions";
import {demoMode} from '@/server/demo/policy';
import {demoReceiptRoot} from '@/server/demo/storage';

const UUID="[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}";
const idPattern=new RegExp(`^${UUID}$`);
export type ReceiptFault=(point:string)=>Promise<void>;
export const checksum=(bytes:Buffer)=>createHash("sha256").update(bytes).digest("hex");
export function validatePdf(bytes:Buffer){if(bytes.length<100||bytes.length>8*1024*1024||bytes.subarray(0,5).toString()!=="%PDF-"||!bytes.subarray(-1024).toString().includes("%%EOF"))throw new Error("Invalid receipt PDF bytes.");}
async function noLink(path:string){const stat=await fs.lstat(/* turbopackIgnore: true */ path);if(stat.isSymbolicLink())throw new Error("Linked receipt paths are not permitted.");return stat;}
async function syncDirectory(path:string){
  // Windows does not expose directory fsync through Node. File contents are still fsynced.
  if(process.platform==="win32")return;
  const handle=await fs.open(/* turbopackIgnore: true */ path,"r");try{await handle.sync();}finally{await handle.close();}
}
type Owner={application:"fitimi-private-receipts-v1";owner:string;database:string};
type Journal={application:"fitimi-receipt-blob-v1";owner:string;id:string;checksum:string;createdAt:string};

export interface ReceiptStore{
 readonly written:string[];
 lockName():string;
 initialize():Promise<void>;
 put(bytes:Buffer,id?:string):Promise<{storageReference:string;fileChecksum:string}>;
 read(key:string,expected:string):Promise<Buffer>;
 recover(c:Connection,only?:string[],after?:string,limit?:number):Promise<{removed:number;retained:number;cursor:string|null}>;
}
export class PrivateReceiptStore implements ReceiptStore{
  readonly root:string;
  private owner!:Owner;
  readonly written:string[]=[];
  constructor(private database:string,private fault:ReceiptFault=async()=>{}){
    this.root=demoMode()?demoReceiptRoot(database.split('/')[1]??''):resolve(/* turbopackIgnore: true */ process.env.RECEIPT_STORAGE_DIR?.trim()||".private/receipts");
    const segments=this.root.split(/[\\/]/).map(value=>value.toLowerCase());
    if(this.root===resolve(/* turbopackIgnore: true */ ".")||segments.some(part=>part==='.next'||part.startsWith('.next-')||["public",".git","node_modules"].includes(part)))throw new Error("Receipt storage must use a dedicated private directory.");
  }
  lockName(){return `fitimi_files_${checksum(Buffer.from(`${this.database}|${this.root.toLowerCase()}`)).slice(0,48)}`;}
  async initialize(){
    let parent=this.root;while(true){try{await noLink(parent);}catch(error){if(!(error&&typeof error==="object"&&"code"in error&&error.code==="ENOENT"))throw error;}const next=dirname(parent);if(next===parent)break;parent=next;}
    await fs.mkdir(/* turbopackIgnore: true */ this.root,{recursive:true,mode:0o700});
    if(!(await noLink(this.root)).isDirectory())throw new Error("Receipt directory unavailable.");
    const marker=resolve(/* turbopackIgnore: true */ this.root,".owner.json");
    try{await noLink(marker);this.owner=JSON.parse(await fs.readFile(/* turbopackIgnore: true */ marker,"utf8")) as Owner;}
    catch(error){if(!(error&&typeof error==="object"&&"code"in error&&error.code==="ENOENT"))throw error;
      if((await fs.readdir(/* turbopackIgnore: true */ this.root)).length)throw new Error("Refusing to adopt nonempty unowned storage.");
      this.owner={application:"fitimi-private-receipts-v1",owner:randomUUID(),database:this.database};
      const h=await fs.open(/* turbopackIgnore: true */ marker,"wx",0o600);try{await h.writeFile(JSON.stringify(this.owner));await h.sync();}finally{await h.close();}await syncDirectory(this.root);
    }
    if(this.owner.application!=="fitimi-private-receipts-v1"||!idPattern.test(this.owner.owner)||this.owner.database!==this.database)throw new Error("Receipt storage ownership mismatch.");
    await secureWindowsReceiptDirectory(this.root,this.owner.owner);
    if(process.platform!=="win32")await fs.chmod(/* turbopackIgnore: true */ this.root,0o700);
  }
  key(id:string){if(!idPattern.test(id))throw new Error("Invalid private document key.");return `r/${this.owner.owner}/${id}.pdf`;}
  private file(id:string,extension:"pdf"|"part"|"json"){
    if(!idPattern.test(id))throw new Error("Invalid private document key.");
    const target=resolve(/* turbopackIgnore: true */ this.root,`${id}.${extension}`),rel=relative(this.root,target);
    if(isAbsolute(rel)||rel.startsWith(`..${sep}`)||dirname(target)!==this.root)throw new Error("Invalid private path.");return target;
  }
  async put(bytes:Buffer,id:string=randomUUID()){
    validatePdf(bytes);const key=this.key(id),hash=checksum(bytes),journal:Journal={application:"fitimi-receipt-blob-v1",owner:this.owner.owner,id,checksum:hash,createdAt:new Date().toISOString()};
    const h=await fs.open(/* turbopackIgnore: true */ this.file(id,"json"),"wx",0o600);this.written.push(id);
    try{const json=JSON.stringify(journal),split=Math.floor(json.length/2);await h.writeFile(json.slice(0,split));await this.fault("partialJournal");await h.writeFile(json.slice(split));await h.sync();}finally{await h.close();}
    await syncDirectory(this.root);await this.fault("afterJournal");
    const part=this.file(id,"part"),out=await fs.open(/* turbopackIgnore: true */ part,"wx",0o600);
    try{const split=Math.floor(bytes.length/2);await out.writeFile(bytes.subarray(0,split));await this.fault("partialWrite");await out.writeFile(bytes.subarray(split));await out.sync();}finally{await out.close();}
    await this.fault("beforeFinalize");
    // Hard-link is atomic and fails if a final key already exists; rename could overwrite it.
    await fs.link(/* turbopackIgnore: true */ part,this.file(id,"pdf"));await syncDirectory(this.root);
    await fs.chmod(/* turbopackIgnore: true */ this.file(id,"pdf"),0o400);await fs.unlink(/* turbopackIgnore: true */ part);await syncDirectory(this.root);
    await this.fault("afterFinalize");await this.read(key,hash);return {storageReference:key,fileChecksum:hash};
  }
  async read(key:string,expected:string){
    const match=new RegExp(`^r/${this.owner.owner}/(${UUID})\\.pdf$`).exec(key);
    if(!match||!/^[a-f0-9]{64}$/.test(expected))throw new Error("Invalid private document reference.");
    const path=this.file(match[1],"pdf"),stat=await noLink(path);
    if(!stat.isFile()||stat.size>8*1024*1024)throw new Error("Private document unavailable.");
    const bytes=await fs.readFile(/* turbopackIgnore: true */ path);validatePdf(bytes);if(checksum(bytes)!==expected)throw new Error("Receipt checksum mismatch.");return bytes;
  }
  /** Caller holds the same database advisory lock as issuance; no time-based race heuristic. */
  async recover(c:Connection,only?:string[],after="",limit=100){
    if(after&&!idPattern.test(after))throw new Error("Invalid recovery cursor.");
    const names=only??(await fs.readdir(/* turbopackIgnore: true */ this.root)).filter(name=>new RegExp(`^${UUID}\\.json$`).test(name)).map(name=>name.slice(0,-5)).filter(id=>id>after).sort().slice(0,limit);
    let removed=0,retained=0;
    for(const id of names){
      const journalPath=this.file(id,"json");await noLink(journalPath);
      // This SELECT must succeed before any unlink. Unknown commit outcome preserves referenced files.
      const [rows]=await c.execute<RowDataPacket[]>("SELECT id FROM receipt_versions WHERE storage_reference=? LIMIT 1",[this.key(id)]);
      if(rows.length){retained++;continue;}
      let j:Journal;
      try{j=JSON.parse(await fs.readFile(/* turbopackIgnore: true */ journalPath,"utf8")) as Journal;}
      catch(error){
        if(!(error instanceof SyntaxError))throw error;
        // A crash during the first journal write cannot yet have created a PDF/part.
        // Only remove that incomplete journal when the owned key has no DB reference or blob.
        for(const extension of ["part","pdf"]as const){try{await noLink(this.file(id,extension));throw new Error("Incomplete journal has an ambiguous blob; refusing cleanup.");}catch(error){if(!(error&&typeof error==="object"&&"code"in error&&error.code==="ENOENT"))throw error;}}
        await this.fault("beforeCleanup");await fs.unlink(/* turbopackIgnore: true */ journalPath);removed++;continue;
      }
      if(j.application!=="fitimi-receipt-blob-v1"||j.owner!==this.owner.owner||j.id!==id||!/^[a-f0-9]{64}$/.test(j.checksum))throw new Error("Refusing unowned recovery entry.");
      await this.fault("beforeCleanup");
      for(const extension of ["part","pdf"]as const){const path=this.file(id,extension);try{const stat=await noLink(path);if(!stat.isFile())throw new Error("Unexpected recovery path.");await fs.chmod(/* turbopackIgnore: true */ path,0o600);await fs.unlink(/* turbopackIgnore: true */ path);}catch(error){if(!(error&&typeof error==="object"&&"code"in error&&error.code==="ENOENT"))throw error;}}
      await fs.unlink(/* turbopackIgnore: true */ journalPath);removed++;
    }
    await syncDirectory(this.root);return {removed,retained,cursor:names.at(-1)??null};
  }
}
