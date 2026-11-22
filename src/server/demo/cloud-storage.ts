import {randomUUID} from 'node:crypto';
import type {Connection,RowDataPacket} from 'mysql2/promise';
import {checksum,validatePdf,type ReceiptStore,type ReceiptFault} from '@/features/receipts/storage';
import {tidbConnectionIdentity} from '../db/tidb';
import {isDemoConnection} from './connections';
import {cloudDemoMode,cloudDemoOwner} from './cloud-policy';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
/** Fictitious demo PDFs share the financial SQL transaction; real PDFs remain in private Blob. */
export class CloudDemoReceiptStore implements ReceiptStore {
 readonly written:string[]=[];readonly owner:string;private readonly identity:string;
 constructor(private c:Connection,private fault:ReceiptFault=async()=>{}){
  const identity=tidbConnectionIdentity(c);if(!cloudDemoMode()||!isDemoConnection(c)||!identity)throw new Error('Isolated Cloud demo storage required.');
  this.identity=identity;this.owner=cloudDemoOwner(identity);
 }
 lockName(){return 'fitimi_demo_files_'+checksum(Buffer.from(this.identity)).slice(0,44);}
 async initialize(){const [rows]=await this.c.query<RowDataPacket[]>('SELECT owner_id,database_identity FROM demo_pdf_owner WHERE id=1');if(rows.length!==1||rows[0].owner_id!==this.owner||rows[0].database_identity!==this.identity)throw new Error('Demo PDF ownership mismatch.');}
 private id(key:string){const prefix='r/'+this.owner+'/';if(!key.startsWith(prefix)||!key.endsWith('.pdf'))throw new Error('Invalid demo PDF key.');const id=key.slice(prefix.length,-4);if(!uuid.test(id))throw new Error('Invalid demo PDF identifier.');return id;}
 async put(bytes:Buffer,id=randomUUID()){
  validatePdf(bytes);if(!uuid.test(id))throw new Error('Invalid demo PDF identifier.');const sha256=checksum(bytes),chunks=Math.ceil(bytes.length/(512*1024));
  await this.fault('beforeJournal');
  await this.c.execute('INSERT INTO demo_pdf_files(id,sha256,byte_length,chunks) VALUES(?,?,?,?)',[id,sha256,bytes.length,chunks]);
  this.written.push(id);await this.fault('afterJournal');
  for(let part=0;part<chunks;part++)await this.c.execute('INSERT INTO demo_pdf_chunks(file_id,part,bytes) VALUES(?,?,?)',[id,part,bytes.subarray(part*512*1024,(part+1)*512*1024)]);
  await this.fault('beforeFinalize');await this.fault('afterFinalize');
  return {storageReference:'r/'+this.owner+'/'+id+'.pdf',fileChecksum:sha256};
 }
 async read(key:string,expected:string){
  const id=this.id(key);if(!/^[a-f0-9]{64}$/.test(expected))throw new Error('Invalid demo PDF digest.');
  const [files]=await this.c.execute<RowDataPacket[]>('SELECT sha256,byte_length,chunks FROM demo_pdf_files WHERE id=?',[id]);const file=files[0];
  if(!file||file.sha256!==expected||file.byte_length>8*1024*1024||file.chunks>16)throw new Error('Demo PDF unavailable.');
  const [parts]=await this.c.execute<RowDataPacket[]>('SELECT part,bytes FROM demo_pdf_chunks WHERE file_id=? ORDER BY part',[id]);
  if(parts.length!==file.chunks||parts.some((p,i)=>Number(p.part)!==i||!Buffer.isBuffer(p.bytes)))throw new Error('Incomplete demo PDF.');
  const bytes=Buffer.concat(parts.map(p=>p.bytes as Buffer));validatePdf(bytes);
  if(bytes.length!==file.byte_length||checksum(bytes)!==expected)throw new Error('Demo PDF integrity check failed.');return bytes;
 }
 async recover(c:Connection){
  if(c!==this.c)throw new Error('Demo recovery connection mismatch.');
  const [locks]=await c.execute<RowDataPacket[]>('SELECT IS_USED_LOCK(?) AS owner,CONNECTION_ID() AS current',[this.lockName()]);if(String(locks[0]?.owner)!==String(locks[0]?.current))throw new Error('Demo storage lease required.');
  // SQL rollback also rolls back PDF bytes. Expired visitor databases are disposed as a whole.
  const [rows]=await c.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM demo_pdf_files');return {removed:0,retained:Number(rows[0].n),cursor:null};
 }
}
