import {randomBytes,randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';
import type {Connection,RowDataPacket,ResultSetHeader} from 'mysql2/promise';
import {connectTidb} from '../db/tidb';
import {grantsMatchTidbProfile,tidbGrantStatements} from '../db/tidb-privileges';
import {matchesTidbSchema} from '../db/tidb-schema';
import {AuthenticationRequired,newSessionToken,sessionCookieSettings,tokenDigest,validSessionToken} from '../auth/security';
import {demoDatabase,DEMO_SECONDS} from './policy';
import {markDemoConnection} from './connections';
import {cloudDemoEnvironment,cloudDemoUser,cloudDemoPassword,cloudDemoRuntimeEnvironment,cloudDemoInstallation,cloudDemoOwner,cloudDemoPdfDdl,CLOUD_DEMO_CONTROL} from './cloud-policy';

async function inventory(c:Connection){
 const [rows]=await c.query<RowDataPacket[]>('SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA');
 if(rows.some(row=>!['information_schema','performance_schema','metrics_schema','mysql','sys','test',CLOUD_DEMO_CONTROL].includes(String(row.name).toLowerCase())&&!/^fitimi_demo_[a-f0-9]{24}$/.test(String(row.name))))throw new Error('Non-demo database found in dedicated demo instance.');
}
async function admin(){
 const source=await connectTidb(cloudDemoEnvironment(),'operator');
 try{await inventory(source.connection);const [rows]=await source.connection.query<RowDataPacket[]>('SELECT owner_hash FROM demo_installation WHERE id=1');if(rows.length!==1||rows[0].owner_hash!==cloudDemoInstallation())throw new Error('Cloud demo ownership mismatch.');return source;}catch{await source.close();throw new Error('Cloud demo unavailable.');}
}
export async function initializeCloudDemo(){
 const env=cloudDemoEnvironment(),root=await connectTidb({...env,DB_DATABASE:'test'},'operator');
 try{
  await inventory(root.connection);
  const [existing]=await root.connection.execute<RowDataPacket[]>('SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME=?',[CLOUD_DEMO_CONTROL]);
  if(existing.length){const source=await admin();await source.close();return;}
  await root.connection.query('CREATE DATABASE construction_demo_control CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
 }finally{await root.close();}
 const source=await connectTidb(env,'operator');try{
  const c=source.connection;
  await c.query('CREATE TABLE demo_installation (id INT PRIMARY KEY,owner_hash CHAR(64) NOT NULL)');
  await c.execute('INSERT INTO demo_installation VALUES(1,?)',[cloudDemoInstallation()]);
  await c.query('CREATE TABLE demo_sessions (token_hash CHAR(64) PRIMARY KEY,database_name VARCHAR(64) NOT NULL UNIQUE,expires_at DATETIME(3) NOT NULL,requests INT UNSIGNED NOT NULL DEFAULT 0,ready BOOLEAN NOT NULL DEFAULT FALSE)');
  await c.query('CREATE TABLE demo_limits (id INT PRIMARY KEY,attempts INT NOT NULL,ends_at DATETIME(3) NOT NULL)');
 }finally{await source.close();}
}
export async function cloudVisitorConnection(database:string){
 const source=await connectTidb(cloudDemoRuntimeEnvironment(demoDatabase(database)),'application');
 try{
  const [grants]=await source.connection.query<RowDataPacket[]>('SHOW GRANTS');
  if(!grantsMatchTidbProfile(grants.map(row=>Object.values(row)[0]),database,'demo'))throw new Error('Unexpected demo SQL capabilities.');
  const [rows]=await source.connection.query<(RowDataPacket&{id:unknown;plan_sha256:unknown})[]>('SELECT id,plan_sha256 FROM construction_schema_manifest');
  if(!matchesTidbSchema(rows))throw new Error('Unreviewed demo schema.');
  markDemoConnection(source.connection);return source;
 }catch{await source.close();throw new Error('Demo workspace unavailable.');}
}
export async function cloudDemoReady(){const source=await admin();try{await source.connection.query('SELECT ready FROM demo_sessions LIMIT 0');}finally{await source.close();}}
export async function openCloudDemoConnection(){
 const token=(await cookies()).get(sessionCookieSettings().name)?.value;if(!validSessionToken(token))throw new AuthenticationRequired();
 const source=await admin();let database:string;
 try{
  const [result]=await source.connection.execute<ResultSetHeader>('UPDATE demo_sessions SET requests=requests+1 WHERE token_hash=? AND ready=FALSE AND expires_at>UTC_TIMESTAMP(3) AND requests<1500',[tokenDigest(token)]);if(result.affectedRows!==1)throw new AuthenticationRequired();
  const [rows]=await source.connection.execute<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE token_hash=? AND ready=FALSE AND expires_at>UTC_TIMESTAMP(3)',[tokenDigest(token)]);if(!rows.length)throw new AuthenticationRequired();database=demoDatabase(String(rows[0].database_name));
 }finally{await source.close();}
 return (await cloudVisitorConnection(database)).connection;
}
/** Request-driven disposal: no persistent process, filesystem, cross-tenant SQL or Blob access. */
export async function cleanupCloudDemo(){
 const source=await admin(),c=source.connection;
 try{
  const [locks]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('construction_demo_provision',0) AS ok");if(Number(locks[0].ok)!==1)return;
  try{
   const [entry]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('construction_demo_entry',0) AS ok");if(Number(entry[0].ok)!==1)return;
   try{
    const [rows]=await c.query<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE expires_at<=UTC_TIMESTAMP(3) LIMIT 4');
    for(const row of rows){
     const db=demoDatabase(String(row.database_name));
     for(const reader of [false,true]){
      const name=cloudDemoUser(db,reader);const [grants]=await c.query<RowDataPacket[]>('SHOW GRANTS FOR ?@?',[name,'%']).catch(()=>[[]]);
      const values=(grants as RowDataPacket[]).map(value=>Object.values(value)[0]);
      if(values.length&&!grantsMatchTidbProfile(values,db,reader?'reporting':'demo'))throw new Error('Refusing to remove an unowned SQL account.');
     }
     await c.query('DROP DATABASE IF EXISTS `'+db+'`');
     for(const reader of [false,true])await c.query('DROP USER IF EXISTS ?@?',[cloudDemoUser(db,reader),'%']);
     await c.execute('DELETE FROM demo_sessions WHERE database_name=?',[db]);
    }
   }finally{await c.query("SELECT RELEASE_LOCK('construction_demo_entry')");}
  }finally{await c.query("SELECT RELEASE_LOCK('construction_demo_provision')");}
 }finally{await source.close();}
}
export async function warmCloudDemo(){
 const source=await admin(),c=source.connection;let locked=false;
 try{
  const [locks]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('construction_demo_provision',0) AS ok");locked=Number(locks[0].ok)===1;if(!locked)return;
  const [count]=await c.query<RowDataPacket[]>('SELECT COUNT(*) AS n,SUM(ready) AS ready FROM demo_sessions');if(Number(count[0].n)>=20||Number(count[0].ready)>=2)return;
  const db=demoDatabase('fitimi_demo_'+randomBytes(12).toString('hex')),token=newSessionToken();
  await c.execute('INSERT INTO demo_sessions(token_hash,database_name,expires_at) VALUES(?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 MINUTE))',[tokenDigest(token),db]);
  try{
   await c.query('CREATE DATABASE `'+db+'` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');
   const setup=await connectTidb({...cloudDemoEnvironment(),DB_DATABASE:db},'operator');
   try{
    const {buildTidbSchemaPlan,installTidbSchema}=await import('../../../scripts/tidb/schema');
    await installTidbSchema(setup.connection,buildTidbSchemaPlan());
    for(const ddl of cloudDemoPdfDdl)await setup.connection.query(ddl);
    await setup.connection.execute('INSERT INTO demo_pdf_owner VALUES(1,?,?)',[cloudDemoOwner(setup.identity),setup.identity]);
    for(const reader of [false,true]){
     const name=cloudDemoUser(db,reader);await setup.connection.query('CREATE USER ?@? IDENTIFIED BY ?',[name,'%',cloudDemoPassword(db,reader)]);
     for(const grant of tidbGrantStatements(db,reader?'reporting':'demo'))await setup.connection.query(grant,[name,'%']);
    }
    const user=randomUUID();
    await setup.connection.execute("INSERT INTO users(id,display_name,email,password_hash,status) VALUES(?,?,'visitor@example.invalid','!demo-no-password','active')",[user,'Vizitori Demo']);
    await setup.connection.execute('INSERT INTO auth_sessions(id,user_id,token_hash,user_auth_version,expires_at,assurance_version) VALUES(?,?,?,1,UTC_TIMESTAMP(3),0)',[randomUUID(),user,tokenDigest(token)]);
   }finally{await setup.close();}
   // Reconnect: DDL preparation can outlast an idle control connection.
   const finish=await admin();try{await finish.connection.execute('UPDATE demo_sessions SET ready=TRUE,expires_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 365 DAY) WHERE database_name=?',[db]);}finally{await finish.close();}
  }catch(error){const failed=await admin();try{await failed.connection.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE database_name=?',[db]);}finally{await failed.close();}throw error;}
 }finally{if(locked)await c.query("SELECT RELEASE_LOCK('construction_demo_provision')").catch(()=>{});await source.close().catch(()=>{});}
}
export async function startCloudDemo(existing?:string){
 await cleanupCloudDemo();const source=await admin(),c=source.connection;let locked=false;
 try{
  if(validSessionToken(existing)){const [rows]=await c.execute<RowDataPacket[]>('SELECT token_hash FROM demo_sessions WHERE token_hash=? AND ready=FALSE AND expires_at>UTC_TIMESTAMP(3) AND requests<1500',[tokenDigest(existing)]);if(rows.length)return {token:existing};}
  const [locks]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('construction_demo_entry',1) AS ok");locked=Number(locks[0].ok)===1;if(!locked)throw new Error('Demo busy.');
  await c.query('INSERT INTO demo_limits VALUES(1,0,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 MINUTE)) ON DUPLICATE KEY UPDATE attempts=IF(ends_at<=UTC_TIMESTAMP(3),0,attempts),ends_at=IF(ends_at<=UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 1 MINUTE),ends_at)');
  const [limits]=await c.query<RowDataPacket[]>('SELECT attempts FROM demo_limits WHERE id=1');if(Number(limits[0].attempts)>=4)throw new Error('Demo rate limit.');await c.query('UPDATE demo_limits SET attempts=attempts+1 WHERE id=1');
  const [rows]=await c.query<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE ready=TRUE AND expires_at>UTC_TIMESTAMP(3) ORDER BY database_name LIMIT 1');if(!rows.length)throw new Error('Demo is preparing.');
  const db=demoDatabase(String(rows[0].database_name)),token=newSessionToken();
  const setup=await connectTidb({...cloudDemoEnvironment(),DB_DATABASE:db},'operator');
  try{await setup.connection.execute('UPDATE auth_sessions SET token_hash=?,expires_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 MINUTE),updated_at=UTC_TIMESTAMP(3) WHERE revoked_at IS NULL',[tokenDigest(token)]);}finally{await setup.close();}
  await c.execute('UPDATE demo_sessions SET token_hash=?,ready=FALSE,expires_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 30 MINUTE) WHERE database_name=?',[tokenDigest(token),db]);
  try{const visitor=await cloudVisitorConnection(db);try{const {seedDemo}=await import('./seed');await seedDemo(visitor.connection,token);}finally{await visitor.close();}}catch(error){await c.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE database_name=?',[db]);throw error;}
  return {token};
 }finally{if(locked)await c.query("SELECT RELEASE_LOCK('construction_demo_entry')");await source.close();}
}
export async function revokeCloudDemo(token:string|undefined){
 if(!validSessionToken(token))return;const source=await admin();
 try{
  const [rows]=await source.connection.execute<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE token_hash=?',[tokenDigest(token)]);
  if(rows.length){const db=demoDatabase(String(rows[0].database_name)),visitor=await connectTidb({...cloudDemoEnvironment(),DB_DATABASE:db},'operator');try{await visitor.connection.execute('UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[tokenDigest(token)]);}finally{await visitor.close();}}
  await source.connection.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[tokenDigest(token)]);
 }finally{await source.close();}
}
export {DEMO_SECONDS};
