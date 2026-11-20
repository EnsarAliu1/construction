/** Production-mode measurements in a fresh task-owned schema, never the owner's database. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,createWriteStream} from 'node:fs';
import {resolve,sep} from 'node:path';
import {randomBytes} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {createConnection} from 'mysql2/promise';
const root=resolve('artifacts/speed'),stateFile=resolve(root,'state.json'),mode=process.argv[2];
assert(['setup','measure','cleanup'].includes(mode));mkdirSync(root,{recursive:true});
const connect=()=>createConnection({host:'127.0.0.1',port:3307,user:'root',password:readFileSync('.private/development/mysql-root-password','utf8').trim()});
async function run(args,env){const p=spawn(process.execPath,args,{env:{...process.env,...env},stdio:'inherit',windowsHide:true});assert.equal(await new Promise((done,reject)=>{p.on('exit',done);p.on('error',reject);}),0,'Performance task failed');}
function scope(state){assert.equal(state.kind,'fitimi-speed/1');assert.match(state.database,/^fitimi_test_speed_[a-f0-9]{8}$/);assert.match(state.user,/^speed_[a-f0-9]{8}$/);return state;}
async function available(){try{await fetch('http://127.0.0.1:3000/administrata',{signal:AbortSignal.timeout(700)});return false;}catch{return true;}}
if(mode==='setup'){
 assert(!existsSync(stateFile),'A speed lab already exists; retain or clean it explicitly.');
 const c=await connect(),database='fitimi_test_speed_'+randomBytes(4).toString('hex'),user='speed_'+randomBytes(4).toString('hex'),password=randomBytes(32).toString('hex');
 try{
  const [identity]=await c.query('SELECT @@server_uuid AS uuid');
  const env={NODE_ENV:'production',DATABASE_URL:`mysql://${user}:${password}@127.0.0.1:3307/${database}`,TEST_DATABASE_URL:`mysql://${user}:${password}@127.0.0.1:3307/${database}`,DATABASE_DISPOSABLE:'1',AUTH_ORIGIN:'http://localhost:3000',FITIMI_LOCAL_DEVELOPMENT:'0',FITIMI_TEST_BUILD:'',ADORE_OPERATOR_KEY:randomBytes(32).toString('hex'),MFA_ENCRYPTION_KEY_ID:'speed-fixture',MFA_ENCRYPTION_KEYS:JSON.stringify({'speed-fixture':randomBytes(32).toString('base64')}),RECEIPT_STORAGE_DIR:`artifacts/speed/private-store/${database}`,RECEIPT_COMPANY_NAME:'Synthetic performance company',RECEIPT_NUMBER_PREFIX:'DEV',PUBLIC_SITE_URL:'',PUBLIC_SITE_INDEXING:'0'};
  const state={kind:'fitimi-speed/1',database,user,serverUUID:identity[0].uuid,env};
  // Persist task identity before setup, so partial setup can be cleaned safely.
  writeFileSync(stateFile,JSON.stringify(state),{flag:'wx',mode:0o600});
  await c.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  for(const host of ['127.0.0.1','%']){await c.query(`CREATE USER '${user}'@'${host}' IDENTIFIED BY ?`,[password]);await c.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${user}'@'${host}'`);}
  await run(['--conditions=react-server','--import','tsx','scripts/performance/runtime.ts','seed'],env);
  console.log('Task-owned performance database seeded; credentials withheld.');
 }finally{await c.end();}
}else{
 const state=scope(JSON.parse(readFileSync(stateFile,'utf8'))),admin=await connect();
 const [identity]=await admin.query('SELECT @@server_uuid AS uuid');assert.equal(identity[0].uuid,state.serverUUID);
 if(mode==='cleanup'){
  try{
   await admin.query(`DROP DATABASE IF EXISTS \`${state.database}\``);
   for(const host of ['127.0.0.1','%'])await admin.query(`DROP USER IF EXISTS '${state.user}'@'${host}'`);
   const target=resolve(state.env.RECEIPT_STORAGE_DIR),allowed=resolve(root,'private-store')+sep;
   assert(target.startsWith(allowed)&&target===resolve(allowed,state.database));rmSync(target,{recursive:true,force:true});
   rmSync(resolve(root,'fixture.json'),{force:true});rmSync(stateFile);
   console.log('Disposed only the verified synthetic database, test users, keys and receipt store.');
  }finally{await admin.end();}
 }else{
  await admin.end();const label=process.argv[3];assert(['baseline','optimized'].includes(label));assert(await available(),'Port 3000 is occupied; its application was preserved.');
  const log=createWriteStream(resolve(root,label+'-server.log')),server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{env:{...process.env,...state.env},stdio:['ignore','pipe','pipe'],windowsHide:true});server.stdout.pipe(log);server.stderr.pipe(log);
  try{
   let ready=false;for(let i=0;i<90;i++){assert.equal(server.exitCode,null,'Performance server exited');if(!await available()){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready);
   await run(['--conditions=react-server','--import','tsx','scripts/performance/runtime.ts',label],state.env);
  }finally{if(server.exitCode===null)execFileSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});log.end();}
 }
}
