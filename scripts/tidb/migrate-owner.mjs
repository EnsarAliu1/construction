import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import JSZip from 'jszip';
import {connectTidb,validateRuntimeGrants,validateReportingGrants} from '../../src/server/db/tidb.ts';
import {tidbGrantStatements} from '../../src/server/db/tidb-privileges.ts';
import {buildTidbSchemaPlan,installTidbSchema} from './schema.ts';
import {tidbExpectedSchema} from '../../src/server/db/tidb-schema.ts';
import {readTables} from './owner-backup.ts';
import {decryptBackup} from '../release/paired-backup.ts';
import {BlobReceiptStore,receiptBlobConfiguration} from '../../src/features/receipts/blob-storage.ts';
import {checksum} from '../../src/features/receipts/storage.ts';
import {openLocalConnection,localDatabaseOptions} from '../../src/server/db/config.ts';
const cell=(value)=>({kind:'scalar',value}),value=c=>c.kind==='bytes'?Buffer.from(c.value,'base64'):c.kind==='json'&&c.value!==null?JSON.stringify(c.value):c.value;
const canonical=v=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
const normalized=rows=>rows.map(row=>JSON.stringify(canonical(row))).sort();
let stage='backup';
async function main(){
 const root='.private/hosting-backups',backup=JSON.parse(readFileSync(root+'/owner-latest.json','utf8')),bytes=readFileSync(backup.file);assert.equal(checksum(bytes),backup.sha256);
 assert(JSON.parse(readFileSync('docs/hosting-backup-verification.json','utf8')).completeSqlRestore);
 const zip=await JSZip.loadAsync(decryptBackup(bytes,readFileSync(root+'/recovery.key')),{checkCRC32:true}),manifest=JSON.parse(await zip.file('manifest.json').async('string'));
 for(const file of manifest.files)assert.equal(checksum(await zip.file(file.name).async('nodebuffer')),file.sha256);
 const tables=JSON.parse(await zip.file('rows.json').async('string')),environmentFiles=JSON.parse(await zip.file('environment.json').async('string'));let original={};for(const file of ['.env.local','.env.development.local'])if(environmentFiles[file])Object.assign(original,parseEnv(environmentFiles[file]));
 const operator=parseEnv(readFileSync('.env.tidb-test.local','utf8')),blob=receiptBlobConfiguration(parseEnv(readFileSync('.env.blob-test.local','utf8')));assert.equal(blob.storeId,'store_cAT7G8bhHU7JqsfA');
 const plan=buildTidbSchemaPlan();assert.equal(plan.fingerprint,tidbExpectedSchema.fingerprint);
 const checkpoint=root+'/migration-target.json';let state;
 if(existsSync(checkpoint)){state=JSON.parse(readFileSync(checkpoint,'utf8'));assert.equal(state.backupSha256,backup.sha256);}else{state={format:'construction-owner-migration/1',backupSha256:backup.sha256,database:'construction_live_'+randomBytes(6).toString('hex'),stage:'new',accounts:[]};writeFileSync(checkpoint,JSON.stringify(state),{flag:'wx',mode:0o600});}
 const persist=()=>writeFileSync(checkpoint,JSON.stringify(state),{mode:0o600});assert(/^construction_live_[a-f0-9]{12}$/.test(state.database));
 stage='schema';
 if(state.stage==='new'){
  const admin=await connectTidb(operator,'operator');try{await admin.connection.query('CREATE DATABASE `'+state.database+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');state.stage='created';persist();}finally{await admin.close();}
 }
 if(state.stage==='created'){
  const setup=await connectTidb({...operator,DB_DATABASE:state.database},'operator');try{await installTidbSchema(setup.connection,plan);state.stage='schema';persist();}finally{await setup.close();}
 }
 const target=await connectTidb({...operator,DB_DATABASE:state.database},'operator');let local,locked=false;
 try{
  const definitions=await readTables(target.connection),mapped={};
  for(const [name,table]of Object.entries(tables)){
   if(name==='__drizzle_migrations'||name==='payment_receipts')continue;
   assert(definitions[name],'Unexpected source table; no silent omission.');mapped[name]=table;
  }
  const identities=[],states=[];for(const row of tables.payment_receipts.rows){
   identities.push(Object.fromEntries(['id','payment_id','receipt_number','created_by','created_at'].map(k=>[k,row[k]])));
   states.push(Object.fromEntries(definitions.payment_receipt_states.columns.map(column=>[column.name,column.name==='id'?row.id:column.name==='receipt_id'?row.id:row[column.name]])));
  }
  mapped.payment_receipt_identities={columns:definitions.payment_receipt_identities.columns,rows:identities};mapped.payment_receipt_states={columns:definitions.payment_receipt_states.columns,rows:states};
  for(const [name,table]of Object.entries(mapped))assert.deepEqual(table.columns.map(c=>c.name).sort(),definitions[name].columns.map(c=>c.name).sort());
  for(const name of plan.physicalTables)assert(name==='auth_user_versions'||mapped[name],'Missing source table for target.');
  const marker=JSON.parse(await zip.file('receipts/.owner.json').async('string'));assert.equal(marker.application,'fitimi-private-receipts-v1');assert.equal(marker.database,manifest.sourceIdentity);
  const store=new BlobReceiptStore(target.identity,{...blob,owner:marker.owner});await store.initialize();
  stage='source_freeze';
  local=await openLocalConnection({...localDatabaseOptions(original.DATABASE_URL,'development','1'),user:'root',password:readFileSync('.private/development/mysql-root-password','utf8').trim()});
  await local.query('FLUSH TABLES WITH READ LOCK');locked=true;const current=await readTables(local);for(const [name,table]of Object.entries(tables))assert.deepEqual(normalized(current[name].rows),normalized(table.rows),'Source changed after backup.');
  stage='original_pdf_upload';
  for(const row of tables.receipt_versions.rows){
   const key=String(row.storage_reference.value),match=/^r\/([a-f0-9-]{36})\/([a-f0-9-]{36})\.pdf$/.exec(key);assert(match&&match[1]===marker.owner);const originalPdf=await zip.file('receipts/'+match[2]+'.pdf').async('nodebuffer');assert.equal(checksum(originalPdf),row.file_checksum.value);
   let uploaded=false;try{uploaded=checksum(await store.read(key,String(row.file_checksum.value)))===row.file_checksum.value;}catch{}
   if(!uploaded){const put=await store.put(originalPdf,match[2]);assert.equal(put.storageReference,key);assert.equal(put.fileChecksum,row.file_checksum.value);}
  }
  console.log(JSON.stringify({originalPdfsUploaded:true,documents:tables.receipt_versions.rows.length,originalChecksumsPreserved:true}));
  stage='sql_import';
  const [edges]=await target.connection.query('SELECT TABLE_NAME AS child,REFERENCED_TABLE_NAME AS parent FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND REFERENCED_TABLE_SCHEMA=DATABASE()');
  const ordered=[],pending=new Set(Object.keys(mapped));while(pending.size){const ready=[...pending].filter(table=>!edges.some(e=>e.child===table&&pending.has(e.parent)));assert(ready.length,'Unexpected cyclic source schema.');for(const table of ready){ordered.push(table);pending.delete(table);}}
  if(state.stage==='schema'){
   for(const [name,table]of Object.entries(definitions))if(!['construction_schema_manifest','auth_account_control'].includes(name))assert.equal(table.rows.length,0,'Refusing to overwrite target rows.');
   await target.connection.beginTransaction();try{
    await target.connection.query('DELETE FROM auth_account_control');
    for(const tableName of ordered){const table=mapped[tableName],columns=table.columns.map(c=>c.name);for(let offset=0;offset<table.rows.length;offset+=25){const rows=table.rows.slice(offset,offset+25);for(const row of rows)for(const name of columns)assert(row[name]);const sql='INSERT INTO `'+tableName+'` ('+columns.map(c=>'`'+c+'`').join(',')+') VALUES '+rows.map(()=> '('+columns.map(()=>'?').join(',')+')').join(',');await target.connection.execute(sql,rows.flatMap(row=>columns.map(name=>value(row[name]))));}}
    await target.connection.commit();state.stage='imported';persist();
   }catch(error){await target.connection.rollback();throw error;}
  }
  stage='verify_import';const result=await readTables(target.connection);
  for(const [name,table]of Object.entries(mapped))assert.deepEqual(normalized(result[name].rows),normalized(table.rows),'Target data mismatch.');
  const [receipts]=await target.connection.query('SELECT * FROM payment_receipts');const receiptColumns=tables.payment_receipts.columns;const receiptRows=receipts.map(row=>Object.fromEntries(receiptColumns.map(c=>[c.name,cell(row[c.name])])));assert.deepEqual(normalized(receiptRows),normalized(tables.payment_receipts.rows));
  for(const row of tables.receipt_versions.rows)assert.equal(checksum(await store.read(String(row.storage_reference.value),String(row.file_checksum.value))),row.file_checksum.value);
  state.stage='verified';state.receiptOwner=marker.owner;persist();
  console.log(JSON.stringify({sourceRowsPreserved:true,receiptCompatibilityViewMatches:true,originalPdfHistoryVerified:true}));
 }finally{if(locked)await local.query('UNLOCK TABLES');await local?.end();await target.close();}
 stage='runtime_accounts';
 const admin=await connectTidb({...operator,DB_DATABASE:state.database},'operator');
 try{
  for(const profile of ['runtime','reporting']){
   if(state.accounts.some(a=>a.profile===profile))continue;
   const account={profile,name:operator.DB_USERNAME.split('.')[0]+'.'+(profile==='runtime'?'a_':'r_')+randomBytes(4).toString('hex'),password:randomBytes(32).toString('hex')};
   await admin.connection.query('CREATE USER ?@? IDENTIFIED BY ?',[account.name,'%',account.password]);state.accounts.push(account);persist();
   for(const query of tidbGrantStatements(state.database,profile))await admin.connection.query(query,[account.name,'%']);
  }
 }finally{await admin.close();}
 for(const account of state.accounts){const source=await connectTidb({...operator,DB_DATABASE:state.database,DB_USERNAME:account.name,DB_PASSWORD:account.password},account.profile==='runtime'?'application':'reporting');try{const [rows]=await source.connection.query('SHOW GRANTS');(account.profile==='runtime'?validateRuntimeGrants:validateReportingGrants)(rows.map(row=>Object.values(row)[0]),state.database);}finally{await source.close();}}
 const runtime=state.accounts.find(a=>a.profile==='runtime'),reader=state.accounts.find(a=>a.profile==='reporting');
 const env={DATABASE_PROVIDER:'tidb',DB_HOST:operator.DB_HOST,DB_PORT:operator.DB_PORT,DB_DATABASE:state.database,DB_USERNAME:runtime.name,DB_PASSWORD:runtime.password,DB_REPORT_USERNAME:reader.name,DB_REPORT_PASSWORD:reader.password,RECEIPT_STORAGE_PROVIDER:'vercel-blob',BLOB_STORE_ID:blob.storeId,BLOB_READ_WRITE_TOKEN:blob.token,RECEIPT_BLOB_OWNER:state.receiptOwner,MFA_ENCRYPTION_KEYS:original.MFA_ENCRYPTION_KEYS,MFA_ENCRYPTION_KEY_ID:original.MFA_ENCRYPTION_KEY_ID,AUTH_ORIGIN:'https://construction-ensar.vercel.app',DEMO_ORIGIN:'https://construction-demo-ensar.vercel.app',PUBLIC_SITE_URL:'https://construction-ensar.vercel.app',PUBLIC_SITE_INDEXING:'0',DEMO_MODE:'0',NEXT_TELEMETRY_DISABLED:'1'};
 for(const [key,v]of Object.entries(original))if(key.startsWith('RECEIPT_')&&!['RECEIPT_STORAGE_DIR','RECEIPT_STORAGE_PROVIDER','RECEIPT_BLOB_OWNER'].includes(key))env[key]=v;
 assert(env.MFA_ENCRYPTION_KEYS&&env.MFA_ENCRYPTION_KEY_ID);writeFileSync('.env.main-cloud.local',Object.entries(env).filter(([,v])=>v!==undefined&&v!=='').map(([key,v])=>key+'='+(!String(v).includes("'")?"'"+v+"'":JSON.stringify(v))).join('\n')+'\n',{mode:0o600});
 writeFileSync('docs/owner-migration-verification.json',JSON.stringify({backupAndRestoreVerified:true,allApplicationRowsPreserved:true,historicalReceiptViewPreserved:true,originalPdfsAndChecksumsPreserved:true,documents:tables.receipt_versions.rows.length,authenticationAndMfaRecordsPreserved:true,runtimeGrantsRestricted:true,operatorCredentialsNotInDeployment:true,sourceDataUnchanged:true,sourceEnvironmentUnchanged:true,cloudConfigurationPrepared:true},null,2)+'\n');
 console.log(JSON.stringify({ownerMigrationVerified:true,restrictedRuntimeReady:true,originalDataRetained:true,secretsWithheld:true}));
}
void main().catch(error=>{console.error(JSON.stringify({ownerMigrationVerified:false,stage,type:error?.name,code:error?.code,location:error?.stack?.match(/migrate-owner\.mjs:\d+:\d+/g),credentialsWithheld:true}));process.exitCode=1;});
