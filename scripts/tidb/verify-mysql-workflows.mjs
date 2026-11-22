import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as fs from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {spawn} from 'node:child_process';
import {createConnection} from 'mysql2/promise';

/** Existing guarded MFA fixtures require a free WP03..WP16 schema on port 3307. Never reuse one. */
async function main(){
 const password=readFileSync(process.env.TIDB_MYSQL_ROOT_PASSWORD_FILE??'.private/development/mysql-root-password','utf8').trim();
 const c=await createConnection({host:'127.0.0.1',port:3307,user:'root',password});
 const suffix=randomBytes(6).toString('hex'),username='receipt_probe_'+suffix,secret=randomBytes(32).toString('hex');
 const root=resolve('.private','mysql-receipt-probe-'+suffix);
 let database,userCreated=false,createdRoot=false;
 try{
  const [version]=await c.query('SELECT VERSION() AS version');assert.match(version[0].version,/^8\.4\./);
  for(let i=3;i<=16;i++){
   const candidate='fitimi_test_wp'+String(i).padStart(2,'0');
   try{await c.query(`CREATE DATABASE \`${candidate}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);database=candidate;break;}
   catch(error){if(error.code!=='ER_DB_CREATE_EXISTS')throw error;}
  }
  assert(database,'No free guarded test schema; existing databases were preserved.');
  await c.query('CREATE USER ?@? IDENTIFIED BY ?',[username,'%',secret]);userCreated=true;
  await c.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO ?@?`,[username,'%']);
  await fs.mkdir(root);createdRoot=true;
  const url=`mysql://${username}:${secret}@127.0.0.1:3307/${database}`;
  const env={...process.env,NODE_ENV:'test',DATABASE_URL:url,TEST_DATABASE_URL:url,DATABASE_DISPOSABLE:'1',ADORE_OPERATOR_KEY:randomBytes(32).toString('hex'),MFA_ENCRYPTION_KEY_ID:'receipt-test',MFA_ENCRYPTION_KEYS:JSON.stringify({'receipt-test':randomBytes(32).toString('base64')}),RECEIPT_STORAGE_DIR:root,RECEIPT_COMPANY_NAME:'Synthetic receipt company',RECEIPT_NUMBER_PREFIX:'DEV',CONSTRUCTION_DEMO_MODE:'0',FITIMI_LOCAL_DEVELOPMENT:'0'};
  const child=spawn(process.execPath,['--conditions=react-server','--import','tsx','--test','--test-concurrency=1','tests/auth/auth.integration.test.ts','tests/receipts/receipts.integration.test.ts','tests/reporting/reporting.integration.test.ts'],{env,stdio:'inherit',windowsHide:true});
  assert.equal(await new Promise((yes,no)=>{child.once('error',no);child.once('exit',yes);}),0,'Synthetic MySQL receipt/report workflows failed.');
  console.log(JSON.stringify({mysqlReceiptAndReportingWorkflows:true,ownerSchemasUnchanged:true}));
 }finally{
  try{if(userCreated)await c.query('DROP USER ?@?',[username,'%']);}
  finally{
   try{if(database){assert.match(database,/^fitimi_test_wp(?:0[3-9]|1[0-6])$/);await c.query(`DROP DATABASE \`${database}\``);}}
   finally{
    try{await c.end();}
    finally{if(createdRoot){assert(root.startsWith(resolve('.private')+sep)&&root.endsWith('mysql-receipt-probe-'+suffix));await fs.rm(root,{recursive:true,force:true});}}
   }
  }
 }
 console.log(JSON.stringify({temporaryObjectsRemoved:true}));
}
void main().catch(()=>{console.error('Isolated MySQL workflows failed; credentials withheld.');process.exitCode=1;});
