import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {sql} from 'drizzle-orm';
import {mysqlTable,int} from 'drizzle-orm/mysql-core';
import type {RowDataPacket} from 'mysql2/promise';
import {connectTidb,TidbConfigurationError} from '../../src/server/db/tidb';
import {withReadSnapshot} from '../../src/server/db/read-snapshot';

/** Disposable synthetic Cloud objects only. Never load the application's local .env files. */
const clients=mysqlTable('clients',{id:int('id'),status:int('status')});
let stage='operator_connection';
async function main(){
 const env=parseEnv(readFileSync('.env.tidb-test.local','utf8'));
 const owner=await connectTidb(env,'operator');
 const database='construction_read_probe_'+randomBytes(6).toString('hex');
 const username=String(env.DB_USERNAME).split('.')[0]+'.r_'+randomBytes(4).toString('hex');
 const password=randomBytes(32).toString('hex');
 let databaseCreated=false,userCreated=false;
 let source:Awaited<ReturnType<typeof connectTidb>>|undefined;
 try{
  stage='create_database';
  await owner.connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);databaseCreated=true;
  await owner.connection.query(`CREATE TABLE \`${database}\`.clients (id INT PRIMARY KEY,status INT NOT NULL)`);
  await owner.connection.query(`INSERT INTO \`${database}\`.clients VALUES (1,0)`);
  stage='create_reader';
  await owner.connection.query('CREATE USER ?@? IDENTIFIED BY ?',[username,'%',password]);userCreated=true;
  await owner.connection.query(`GRANT SELECT ON \`${database}\`.clients TO ?@?`,[username,'%']);
  stage='source_connection';
  source=await connectTidb({...env,DB_DATABASE:database,DB_REPORT_USERNAME:username,DB_REPORT_PASSWORD:password},'operator');
  const c=source.connection;
  stage='snapshot';
  await withReadSnapshot(c,async tx=>{
   const [first]=await tx.select().from(clients);
   assert.equal(first.status,0);
   await c.query('UPDATE clients SET status=1 WHERE id=1');
   const [second]=await tx.select().from(clients);
   assert.equal(second.status,0,'all report reads must retain one MVCC snapshot');
  });
  stage='denied_writes';
  let denied=0;
  for(const statement of ['INSERT INTO clients VALUES (2,2)','UPDATE clients SET status=9 WHERE id=1','DELETE FROM clients WHERE id=1','ALTER TABLE clients ADD COLUMN forbidden INT']){
   await assert.rejects(withReadSnapshot(c,async tx=>{await tx.execute(sql.raw(statement));}),error=>{
    const messages:string[]=[];let current=error;
    while(current instanceof Error){messages.push(current.message);current=current.cause;}
    return /privilege|denied/i.test(messages.join(' '));
   });denied++;
  }
  const [remaining]=await c.query<RowDataPacket[]>('SELECT id,status FROM clients');
  assert.deepEqual(remaining.map(row=>[row.id,row.status]),[[1,1]]);
  stage='unsafe_grants';
  await owner.connection.query(`GRANT UPDATE ON \`${database}\`.clients TO ?@?`,[username,'%']);
  let invoked=false;
  await assert.rejects(withReadSnapshot(c,async()=>{invoked=true;}),TidbConfigurationError);
  assert.equal(invoked,false,'unsafe reporting grants must fail before business queries');
  console.log(JSON.stringify({reportingAdapter:true,consistentSnapshot:true,deniedWrites:denied,unsafeGrantsRejected:true,syntheticOnly:true}));
 }finally{
  try{await source?.close();}
  finally{try{
   if(userCreated)await owner.connection.query('DROP USER ?@?',[username,'%']);
  }finally{
   try{
    assert.match(database,/^construction_read_probe_[a-f0-9]{12}$/);
    if(databaseCreated)await owner.connection.query(`DROP DATABASE \`${database}\``);
   }finally{await owner.close();}
  }}
 }
 console.log(JSON.stringify({temporaryObjectsRemoved:true,applicationProviderUnchanged:true}));
}
void main().catch(error=>{console.error(JSON.stringify({failedStage:stage,errorType:error instanceof Error?error.name:'unknown',code:/^[A-Z_0-9]+$/.test(String(error?.code))?error.code:undefined,credentialsWithheld:true}));process.exitCode=1;});
