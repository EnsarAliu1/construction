import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {sql} from 'drizzle-orm';
import {mysqlTable,int} from 'drizzle-orm/mysql-core';
import {createConnection} from 'mysql2/promise';
import {openLocalConnection} from '../../src/server/db/config';
import {withReadSnapshot} from '../../src/server/db/read-snapshot';

/** Only a new generated schema on local MySQL; no application environment or owner schema is loaded. */
async function main(){
 const password=readFileSync('.private/development/mysql-root-password','utf8').trim();
 const options={host:'127.0.0.1',port:3307,user:'root',password,dateStrings:true,decimalNumbers:false};
 const owner=await createConnection(options);
 const database='fitimi_test_snapshot_'+randomBytes(6).toString('hex');
 let created=false;
 let source:Awaited<ReturnType<typeof openLocalConnection>>|undefined;
 const clients=mysqlTable('clients',{id:int('id'),status:int('status')});
 try{
  await owner.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);created=true;
  await owner.query(`CREATE TABLE \`${database}\`.clients (id INT PRIMARY KEY,status INT NOT NULL)`);
  await owner.query(`INSERT INTO \`${database}\`.clients VALUES (1,0)`);
  source=await openLocalConnection({...options,database});
  await withReadSnapshot(source,async tx=>{
   assert.equal((await tx.select().from(clients))[0].status,0);
   await owner.query(`UPDATE \`${database}\`.clients SET status=1 WHERE id=1`);
   assert.equal((await tx.select().from(clients))[0].status,0);
  });
  for(const statement of ['INSERT INTO clients VALUES (2,2)','UPDATE clients SET status=9 WHERE id=1','DELETE FROM clients WHERE id=1']){
   await assert.rejects(withReadSnapshot(source,async tx=>{await tx.execute(sql.raw(statement));}),error=>{
    let current=error;
    while(current instanceof Error){if('code' in current&&current.code==='ER_CANT_EXECUTE_IN_READ_ONLY_TRANSACTION')return true;current=current.cause;}
    return false;
   });
  }
  console.log(JSON.stringify({mysqlReadOnlyRetained:true,consistentSnapshot:true,deniedWrites:3,syntheticOnly:true}));
 }finally{
  try{await source?.end();}
  finally{
   try{
    assert.match(database,/^fitimi_test_snapshot_[a-f0-9]{12}$/);
    if(created)await owner.query(`DROP DATABASE \`${database}\``);
   }finally{await owner.end();}
  }
 }
 console.log(JSON.stringify({temporaryObjectsRemoved:true,ownerDataUnchanged:true}));
}
void main().catch(()=>{console.error('Local snapshot verification failed; credentials and database error details withheld.');process.exitCode=1;});
