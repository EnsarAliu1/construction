import {cloudDemoMode} from './cloud-policy';
import {randomBytes,randomUUID} from 'node:crypto';
import {cookies} from 'next/headers';
import {type RowDataPacket,type ResultSetHeader} from 'mysql2/promise';
import {localDatabaseOptions,openLocalConnection} from '../db/config';
import {applyMigrations} from '../db/migrate';
import {AuthenticationRequired,newSessionToken,sessionCookieSettings,tokenDigest,validSessionToken} from '../auth/security';
import {demoDatabase,demoMode,demoPassword,demoUsername,DEMO_SECONDS} from './policy';
import {markDemoConnection} from './connections';
import {securitySignal} from '../operations/events';

function adminOptions(){
 if(!demoMode()||process.env.DATABASE_URL||process.env.ADORE_OPERATOR_KEY||process.env.MFA_ENCRYPTION_KEYS)throw new Error('Demo must run without real application credentials');
 demoPassword('fitimi_demo_000000000000000000000000');
 const options=localDatabaseOptions(process.env.DEMO_DATABASE_URL,'development','1');
 if(options.database!=='fitimi_dev_demo_control'||options.host!=='127.0.0.1'||options.port!==3308)throw new Error('Dedicated loopback demo MySQL on port 3308 required');
 return options;
}
async function admin(){
 const c=await openLocalConnection(adminOptions());
 try{
  const [schemas]=await c.query<RowDataPacket[]>('SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA');
  if(schemas.some(row=>!['information_schema','performance_schema','mysql','sys','fitimi_dev_demo_control'].includes(String(row.name))&&!/^fitimi_demo_[a-f0-9]{24}$/.test(String(row.name))))throw new Error('Non-demo databases found; demo refuses this MySQL instance');
  return c;
 }catch(error){await c.end();throw error;}
}
export async function demoReady(){
 if(cloudDemoMode())return (await import('./cloud-runtime')).cloudDemoReady();const c=await admin();try{await c.query('SELECT token_hash FROM demo_sessions LIMIT 0');}finally{await c.end();}}
export async function initializeDemo(){
 if(cloudDemoMode())return (await import('./cloud-runtime')).initializeCloudDemo();
 const c=await admin();try{
  await c.query('CREATE TABLE IF NOT EXISTS demo_sessions (token_hash CHAR(64) PRIMARY KEY, database_name VARCHAR(64) NOT NULL UNIQUE, expires_at DATETIME(3) NOT NULL, requests INT UNSIGNED NOT NULL DEFAULT 0, ready BOOLEAN NOT NULL DEFAULT FALSE)');
  const [columns]=await c.query<RowDataPacket[]>("SELECT COLUMN_NAME FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='demo_sessions' AND COLUMN_NAME='ready'");
  if(!columns.length)await c.query('ALTER TABLE demo_sessions ADD COLUMN ready BOOLEAN NOT NULL DEFAULT FALSE');
  await c.query('CREATE TABLE IF NOT EXISTS demo_limits (id INT PRIMARY KEY, attempts INT NOT NULL, ends_at DATETIME(3) NOT NULL)');
 }finally{await c.end();}
}
async function visitorConnection(database:string){
 const options=adminOptions(),c=await openLocalConnection({...options,database:demoDatabase(database),user:demoUsername(database),password:demoPassword(database)});
 markDemoConnection(c);return c;
}
export async function openDemoConnection(){
 if(cloudDemoMode())return (await import('./cloud-runtime')).openCloudDemoConnection();
 const token=(await cookies()).get(sessionCookieSettings().name)?.value;
 if(!validSessionToken(token))throw new AuthenticationRequired();
 const c=await admin();let database:string;
 try{
  const [reserved]=await c.execute<ResultSetHeader>('UPDATE demo_sessions SET requests=requests+1 WHERE token_hash=? AND ready=FALSE AND expires_at>UTC_TIMESTAMP(3) AND requests<1500',[tokenDigest(token)]);
  if(reserved.affectedRows!==1)throw new AuthenticationRequired();
  const [rows]=await c.execute<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE token_hash=? AND ready=FALSE AND expires_at>UTC_TIMESTAMP(3)',[tokenDigest(token)]);
  if(!rows.length)throw new AuthenticationRequired();database=demoDatabase(String(rows[0].database_name));
 }finally{await c.end();}
 return visitorConnection(database);
}
export async function cleanupDemo(){
 if(cloudDemoMode())return (await import('./cloud-runtime')).cleanupCloudDemo();
 const c=await admin();try{
  const [lock]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('fitimi_demo_provision',0) AS ok");if(Number(lock[0].ok)!==1)return;
  try{
   const [entry]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('fitimi_demo_entry',0) AS ok");if(Number(entry[0].ok)!==1)return;
   try{
   const [rows]=await c.query<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE expires_at<=UTC_TIMESTAMP(3)');
   for(const row of rows){
    const database=demoDatabase(String(row.database_name));
    try{
    // A failed/corrupt store must not block reclamation of every other expired visitor.
    const {removeDemoReceipts}=await import('./storage');await removeDemoReceipts(database);
    await c.query(`DROP DATABASE IF EXISTS \`${database}\``);
    await c.query('DROP USER IF EXISTS ?@?', [demoUsername(database),'%']);
    await c.execute('DELETE FROM demo_sessions WHERE database_name=?',[database]);
    }catch{securitySignal('service.unavailable',503);}
   }
   }finally{await c.query("DO RELEASE_LOCK('fitimi_demo_entry')");}
  }finally{await c.query("DO RELEASE_LOCK('fitimi_demo_provision')");}
 }finally{await c.end();}
}
export async function startDemo(existing?:string,prepare=false){
 if(cloudDemoMode())return prepare?{token:''}: (await import('./cloud-runtime')).startCloudDemo(existing);
 await cleanupDemo();
 const c=await admin();let locked=false,entryLocked=false;
 try{
  if(validSessionToken(existing)){
   const [found]=await c.execute<RowDataPacket[]>('SELECT token_hash FROM demo_sessions WHERE token_hash=? AND ready=FALSE AND expires_at>UTC_TIMESTAMP(3) AND requests<1500',[tokenDigest(existing)]);
   if(found.length)return {token:existing};
  }
  if(!prepare){
  const [entry]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('fitimi_demo_entry',1) AS ok");entryLocked=Number(entry[0].ok)===1;if(!entryLocked)throw new Error('Demo busy');
  await c.query('INSERT INTO demo_limits VALUES (1,0,UTC_TIMESTAMP(3)+INTERVAL 1 MINUTE) ON DUPLICATE KEY UPDATE attempts=IF(ends_at<=UTC_TIMESTAMP(3),0,attempts),ends_at=IF(ends_at<=UTC_TIMESTAMP(3),UTC_TIMESTAMP(3)+INTERVAL 1 MINUTE,ends_at)');
  const [limits]=await c.query<RowDataPacket[]>('SELECT attempts FROM demo_limits WHERE id=1');if(Number(limits[0].attempts)>=4)throw new Error('Demo rate limit');
  await c.query('UPDATE demo_limits SET attempts=attempts+1 WHERE id=1');
   const [prepared]=await c.query<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE ready=TRUE AND expires_at>UTC_TIMESTAMP(3) ORDER BY expires_at LIMIT 1');
   if(prepared.length){
    const database=demoDatabase(String(prepared[0].database_name)),token=newSessionToken();
    await c.query(`UPDATE \`${database}\`.auth_sessions SET token_hash=?,expires_at=UTC_TIMESTAMP(3)+INTERVAL 30 MINUTE WHERE revoked_at IS NULL`,[tokenDigest(token)]);
    await c.execute('UPDATE demo_sessions SET token_hash=?,expires_at=UTC_TIMESTAMP(3)+INTERVAL 30 MINUTE,ready=FALSE WHERE database_name=?',[tokenDigest(token),database]);
    return {token};
   }
   await c.query("DO RELEASE_LOCK('fitimi_demo_entry')");entryLocked=false;
  }
  const [locks]=await c.query<RowDataPacket[]>("SELECT GET_LOCK('fitimi_demo_provision',0) AS ok");locked=Number(locks[0].ok)===1;
  if(!locked)throw new Error('Demo busy');
  const [count]=await c.query<RowDataPacket[]>('SELECT COUNT(*) AS n,SUM(ready) AS ready FROM demo_sessions');if(Number(count[0].n)>=20||prepare&&Number(count[0].ready)>=2)throw new Error('Demo capacity');
  const database=demoDatabase(`fitimi_demo_${randomBytes(12).toString('hex')}`),token=newSessionToken();
  // Register before provisioning, so interrupted creations are also reclaimed.
  await c.execute('INSERT INTO demo_sessions (token_hash,database_name,expires_at) VALUES (?,?,UTC_TIMESTAMP(3)+INTERVAL 30 MINUTE)',[tokenDigest(token),database]);
  try{
  await c.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  await c.query('CREATE USER ?@? IDENTIFIED BY ?',[demoUsername(database),'%',demoPassword(database)]);
  await c.query(`GRANT SELECT,INSERT,UPDATE,DELETE ON \`${database}\`.* TO ?@?`,[demoUsername(database),'%']);
  const provision=await openLocalConnection({...adminOptions(),database});
  try{
   await applyMigrations(provision);
   const userId=randomUUID();
   await provision.execute("INSERT INTO users (id,display_name,email,password_hash,status) VALUES (?,?,'visitor@example.invalid','!demo-no-password','active')",[userId,'Vizitori Demo']);
   await provision.execute('INSERT INTO auth_sessions (id,user_id,token_hash,user_auth_version,expires_at,assurance_version) VALUES (?,?,?,1,UTC_TIMESTAMP(3)+INTERVAL 30 MINUTE,0)',[randomUUID(),userId,tokenDigest(token)]);
  }finally{await provision.end();}
  const visitor=await visitorConnection(database);
  try{const {seedDemo}=await import('./seed');await seedDemo(visitor,token);}catch(error){await c.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE database_name=?',[database]);throw error;}finally{await visitor.end();}
  if(prepare)await c.execute('UPDATE demo_sessions SET ready=TRUE,expires_at=UTC_TIMESTAMP(3)+INTERVAL 30 MINUTE WHERE database_name=?',[database]);
  return {token};
  }catch(error){await c.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE database_name=?',[database]).catch(()=>{});throw error;}
 }finally{if(entryLocked)await c.query("DO RELEASE_LOCK('fitimi_demo_entry')");if(locked)await c.query("DO RELEASE_LOCK('fitimi_demo_provision')");await c.end();}
}
export async function revokeDemo(token:string|undefined){
 if(cloudDemoMode())return (await import('./cloud-runtime')).revokeCloudDemo(token);
 if(!validSessionToken(token))return;
 const c=await admin();try{
  const [rows]=await c.execute<RowDataPacket[]>('SELECT database_name FROM demo_sessions WHERE token_hash=?',[tokenDigest(token)]);
  if(rows.length){const database=demoDatabase(String(rows[0].database_name));await c.query(`UPDATE \`${database}\`.auth_sessions SET revoked_at=UTC_TIMESTAMP(3) WHERE token_hash=?`,[tokenDigest(token)]);}
  await c.execute('UPDATE demo_sessions SET expires_at=UTC_TIMESTAMP(3) WHERE token_hash=?',[tokenDigest(token)]);
 }finally{await c.end();}
}
export async function warmDemo(){
 if(cloudDemoMode())return (await import('./cloud-runtime')).warmCloudDemo();
 for(let i=0;i<2;i++){try{await startDemo(undefined,true);}catch{return;}}
}
export {DEMO_SECONDS};
