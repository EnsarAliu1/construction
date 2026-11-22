import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,existsSync,writeFileSync,mkdirSync} from 'node:fs';
import * as fs from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {parseEnv} from 'node:util';
import {execFileSync,spawnSync} from 'node:child_process';
import {setTimeout as pause} from 'node:timers/promises';
import {createServer} from 'node:net';
import {createConnection,type Connection,type RowDataPacket} from 'mysql2/promise';
import JSZip from 'jszip';
import {localDatabaseOptions,openLocalConnection} from '../../src/server/db/config';
import {PrivateReceiptStore,checksum} from '../../src/features/receipts/storage';
import {encryptBackup,decryptBackup} from '../release/paired-backup';
import {openMfaSeed} from '../../src/server/auth/mfa-crypto';
let stage='configuration';
type Cell={kind:'bytes'|'json'|'scalar';value:unknown};
export type BackupTable={columns:{name:string;type:string}[];rows:Record<string,Cell>[]};
export async function readTables(c:Connection){
 const [names]=await c.query<RowDataPacket[]>("SELECT TABLE_NAME AS name FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE='BASE TABLE' ORDER BY TABLE_NAME");const tables:Record<string,BackupTable>={};let total=0;
 for(const entry of names){const name=String(entry.name);assert(/^[a-z0-9_]+$/.test(name));const [columns]=await c.execute<RowDataPacket[]>('SELECT COLUMN_NAME AS name,DATA_TYPE AS type FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? ORDER BY ORDINAL_POSITION',[name]);const [rows]=await c.query<RowDataPacket[]>('SELECT * FROM `'+name+'`');
  total+=rows.length;assert(total<=20000,'No truncated backup permitted.');
  const encoded=rows.map(row=>Object.fromEntries(columns.map(column=>{const value=row[column.name],kind=Buffer.isBuffer(value)?'bytes':column.type==='json'?'json':'scalar';return [column.name,{kind,value:kind==='bytes'?value.toString('base64'):value}];}))) as BackupTable['rows'];encoded.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b),'en'));
  tables[name]={columns:columns.map(c=>({name:String(c.name),type:String(c.type)})),rows:encoded};
 }
 return tables;
}
async function main(){
 const envFiles:Record<string,string>={},env:Record<string,string>={};for(const name of ['.env.local','.env.development.local'])if(existsSync(name)){envFiles[name]=readFileSync(name,'utf8');Object.assign(env,parseEnv(envFiles[name]));}
 assert(env.DATABASE_URL&&env.DATABASE_DISPOSABLE==='1');const options=localDatabaseOptions(env.DATABASE_URL,'development','1');assert.equal(options.database,'fitimi_dev_local');assert.equal(options.port,3307);
 const rootPassword=readFileSync('.private/development/mysql-root-password','utf8').trim(),source=await openLocalConnection({...options,user:'root',password:rootPassword});
 const storageRoot=resolve(env.RECEIPT_STORAGE_DIR||'.private/receipts');Object.assign(process.env,{DEMO_MODE:'0',RECEIPT_STORAGE_DIR:storageRoot,MFA_ENCRYPTION_KEYS:env.MFA_ENCRYPTION_KEYS??'',MFA_ENCRYPTION_KEY_ID:env.MFA_ENCRYPTION_KEY_ID??''});
 const root='.private/hosting-backups';mkdirSync(root,{recursive:true,mode:0o700});const key=readFileSync(root+'/recovery.key');assert.equal(key.length,32);
 let tables:Record<string,BackupTable>,sourceIdentity:string,locked=false,storeLock='';const zip=new JSZip();
 try{
  stage='source_snapshot';const [identity]=await source.query<RowDataPacket[]>('SELECT CONCAT(@@server_uuid,\'/\',DATABASE()) AS identity');sourceIdentity=String(identity[0].identity);const store=new PrivateReceiptStore(sourceIdentity);storeLock=store.lockName();const [lease]=await source.execute<RowDataPacket[]>('SELECT GET_LOCK(?,10) AS ok',[storeLock]);assert.equal(Number(lease[0].ok),1);
  await source.query('FLUSH TABLES WITH READ LOCK');locked=true;tables=await readTables(source);
  const dumped=spawnSync('docker',['exec','-i','fitimiconstruction-mysql','sh','-c','IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mysqldump --user=root --single-transaction --routines --events --triggers --hex-blob --set-gtid-purged=OFF --column-statistics=0 --no-tablespaces --databases fitimi_dev_local'],{input:rootPassword+'\n',maxBuffer:128*1024*1024,windowsHide:true});assert.equal(dumped.status,0,'Sensitive dump error withheld.');zip.file('database.sql',dumped.stdout);
  async function files(path:string,relative=''){
   for(const name of await fs.readdir(path)){const absolute=resolve(path,name),part=relative?relative+'/'+name:name;const stat=await fs.lstat(absolute);assert(!stat.isSymbolicLink());if(stat.isDirectory())await files(absolute,part);else{assert(stat.isFile());zip.file('receipts/'+part,await fs.readFile(absolute));}}
  }
  if(existsSync(storageRoot))await files(storageRoot);else assert.equal(tables.receipt_versions.rows.length,0);
  zip.file('rows.json',JSON.stringify(tables));zip.file('environment.json',JSON.stringify(envFiles));
  if(tables.receipt_versions.rows.length)await store.initialize();
  for(const row of tables.receipt_versions.rows){const bytes=await store.read(String(row.storage_reference.value),String(row.file_checksum.value));assert.equal(checksum(bytes),row.file_checksum.value);}
 }finally{if(locked)await source.query('UNLOCK TABLES');if(storeLock)await source.execute('SELECT RELEASE_LOCK(?)',[storeLock]);await source.end();}
 stage='encrypt_and_verify';
 const manifest={format:'construction-owner-backup/1',sourceIdentity,createdAt:new Date().toISOString(),sourceDatabase:'fitimi_dev_local',files:[] as {name:string;sha256:string}[]};
 for(const [name,file]of Object.entries(zip.files))if(!file.dir)manifest.files.push({name,sha256:checksum(await file.async('nodebuffer'))});zip.file('manifest.json',JSON.stringify(manifest));
 const output=root+'/owner-'+Date.now()+'.enc',encrypted=encryptBackup(await zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'}),key);writeFileSync(output,encrypted,{flag:'wx',mode:0o600});const restored=await JSZip.loadAsync(decryptBackup(readFileSync(output),key),{checkCRC32:true});for(const file of manifest.files)assert.equal(checksum(await restored.file(file.name)!.async('nodebuffer')),file.sha256);
 writeFileSync(root+'/owner-latest.json',JSON.stringify({file:output,sha256:checksum(encrypted),tableCount:Object.keys(tables).length,documentCount:tables.receipt_versions.rows.length},null,2));console.log(JSON.stringify({ownerBackupEncrypted:true,allFilesVerified:true,tables:Object.keys(tables).length,documents:tables.receipt_versions.rows.length}));
 stage='restore_drill';const tag=randomBytes(6).toString('hex'),name='construction-owner-restore-'+tag,password=randomBytes(32).toString('hex'),temporary=resolve('.private','hosting-restore-'+tag);await fs.mkdir(temporary,{mode:0o700});const envFile=resolve(temporary,'mysql.env');await fs.writeFile(envFile,'MYSQL_ROOT_PASSWORD='+password+'\n',{flag:'wx',mode:0o600});
 const docker=(args:string[])=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});let container:string|undefined,c:Connection|undefined;
 try{
  await new Promise<void>((yes,no)=>{const probe=createServer();probe.once('error',no);probe.listen(3311,'127.0.0.1',()=>probe.close(()=>yes()));});
  const sourceMeta=JSON.parse(docker(['inspect','fitimiconstruction-mysql']))[0];container=docker(['run','--detach','--name',name,'--label','construction.owner.restore='+tag,'--publish','127.0.0.1:3311:3306','--tmpfs','/var/lib/mysql:rw,size=536870912','--env-file',envFile,sourceMeta.Image,'--skip-log-bin']).trim();assert(/^[a-f0-9]{64}$/.test(container));
  for(let i=0;i<90;i++){try{c=await createConnection({host:'127.0.0.1',port:3311,user:'root',password,timezone:'Z',dateStrings:true,decimalNumbers:false,supportBigNumbers:true,bigNumberStrings:true});break;}catch{await pause(500);}}assert(c);
  const sql=await restored.file('database.sql')!.async('nodebuffer'),imported=spawnSync('docker',['exec','-i',container,'sh','-c','IFS= read -r MYSQL_PWD; export MYSQL_PWD; exec mysql --user=root --binary-mode --default-character-set=utf8mb4'],{input:Buffer.concat([Buffer.from(password+'\n'),sql]),maxBuffer:128*1024*1024,windowsHide:true});assert.equal(imported.status,0,'Sensitive restore error withheld.');
  await c.query('USE fitimi_dev_local');await c.query("SET SESSION time_zone='+00:00'");assert.deepEqual(await readTables(c),tables);
  const pdfRoot=resolve(temporary,'receipts');await fs.mkdir(pdfRoot);for(const [path,file]of Object.entries(restored.files))if(path.startsWith('receipts/')&&!file.dir){const relative=path.slice(9);assert(!relative.split('/').includes('..'));const dest=resolve(pdfRoot,relative);assert(dest.startsWith(pdfRoot+sep));await fs.mkdir(resolve(dest,'..'),{recursive:true});await fs.writeFile(dest,await file.async('nodebuffer'));}
  const [targetIdentity]=await c.query<RowDataPacket[]>('SELECT CONCAT(@@server_uuid,\'/\',DATABASE()) AS identity');const rebound=String(targetIdentity[0].identity);
  if(tables.receipt_versions.rows.length){const markerPath=resolve(pdfRoot,'.owner.json'),marker=JSON.parse(await fs.readFile(markerPath,'utf8'));marker.database=rebound;await fs.writeFile(markerPath,JSON.stringify(marker));process.env.RECEIPT_STORAGE_DIR=pdfRoot;const store=new PrivateReceiptStore(rebound);await store.initialize();for(const row of tables.receipt_versions.rows)assert.equal(checksum(await store.read(String(row.storage_reference.value),String(row.file_checksum.value))),row.file_checksum.value);}
  const [factors]=await c.query<RowDataPacket[]>('SELECT id,user_id,key_id,secret_cipher FROM auth_mfa_factors');for(const factor of factors)assert(/^[A-Z2-7]{32}$/.test(openMfaSeed({keyId:factor.key_id,secretCipher:factor.secret_cipher},factor.user_id,factor.id)));
  const proof={encryptedOwnerBackup:true,authenticatedDecryption:true,completeSqlRestore:true,allTablesAndRowsIdentical:true,originalPdfChecksumsVerified:true,mfaKeysVerified:true,sourceDatabaseUnchanged:true,restoreFixtureRemoved:true};writeFileSync('docs/hosting-backup-verification.json',JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
 }finally{
  await c?.end().catch(()=>{});if(container){const record=JSON.parse(docker(['inspect',container]))[0];assert.equal(record.Id,container);assert.equal(record.Config.Labels['construction.owner.restore'],tag);docker(['rm','-f',container]);}
  assert(temporary.startsWith(resolve('.private')+sep)&&temporary.endsWith(tag));await fs.rm(temporary,{recursive:true});
 }
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/owner-backup.ts'))void main().catch(error=>{console.error(JSON.stringify({ownerBackupVerified:false,stage,errorType:error?.name,code:error?.code,location:error?.stack?.match(/owner-backup\.ts:\d+:\d+/g),credentialsWithheld:true}));process.exitCode=1;});
