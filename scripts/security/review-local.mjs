/** Synthetic security verification in a new schema; never migrates the owner's database. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {readFileSync,writeFileSync,mkdirSync,existsSync,rmSync,createWriteStream} from 'node:fs';
import {resolve,sep} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createConnection} from 'mysql2/promise';
const root=resolve('artifacts/security-review'),stateFile=resolve(root,'state.json'),mode=process.argv[2];
assert(['setup','verify','cleanup','check'].includes(mode));mkdirSync(root,{recursive:true});
const connect=()=>createConnection({host:'127.0.0.1',port:3307,user:'root',password:readFileSync('.private/development/mysql-root-password','utf8').trim()});
async function run(args,env){const p=spawn(process.execPath,args,{env:{...process.env,...env},stdio:'inherit',windowsHide:true});assert.equal(await new Promise((done,reject)=>{p.on('exit',done);p.on('error',reject);}),0,'Security verification failed');}
function scope(s){assert.equal(s.kind,'security-review/1');assert.match(s.database,/^fitimi_test_security_[a-f0-9]{8}$/);assert.match(s.user,/^security_[a-f0-9]{8}$/);assert.match(s.runtimeUser,/^runtime_[a-f0-9]{8}$/);return s;}
async function available(){try{await fetch('http://127.0.0.1:3000/administrata',{signal:AbortSignal.timeout(700)});return false;}catch{return true;}}
if(mode==='check'){
 assert(!existsSync(stateFile),'An existing security lab was preserved; inspect or clean it explicitly.');
 try{
  await run(['scripts/security/review-local.mjs','setup'],{});
  await run(['scripts/security/review-local.mjs','verify'],{});
  await run(['scripts/security/review-scan.mjs'],{});
 }finally{if(existsSync(stateFile))await run(['scripts/security/review-local.mjs','cleanup'],{});}
}else if(mode==='setup'){
 assert(!existsSync(stateFile),'A security lab already exists; preserve or explicitly clean it.');
 const c=await connect(),suffix=randomBytes(4).toString('hex'),database='fitimi_test_security_'+suffix,user='security_'+suffix,runtimeUser='runtime_'+suffix,password=randomBytes(32).toString('hex'),runtimePassword=randomBytes(32).toString('hex');
 try{
  const [identity]=await c.query('SELECT @@server_uuid AS uuid');
  const operatorUrl=`mysql://${user}:${password}@127.0.0.1:3307/${database}`,runtimeUrl=`mysql://${runtimeUser}:${runtimePassword}@127.0.0.1:3307/${database}`;
  const env={NODE_ENV:'production',DATABASE_URL:runtimeUrl,TEST_DATABASE_URL:runtimeUrl,DATABASE_DISPOSABLE:'1',AUTH_ORIGIN:'http://localhost:3000',FITIMI_LOCAL_DEVELOPMENT:'0',FITIMI_TEST_BUILD:'',ADORE_OPERATOR_KEY:randomBytes(32).toString('hex'),MFA_ENCRYPTION_KEY_ID:'security-test',MFA_ENCRYPTION_KEYS:JSON.stringify({'security-test':randomBytes(32).toString('base64')}),RECEIPT_STORAGE_DIR:`artifacts/security-review/private-store/${database}`,RECEIPT_COMPANY_NAME:'Synthetic security company',RECEIPT_NUMBER_PREFIX:'DEV',PUBLIC_SITE_URL:'',PUBLIC_SITE_INDEXING:'0'};
  writeFileSync(stateFile,JSON.stringify({kind:'security-review/1',database,user,runtimeUser,operatorUrl,serverUUID:identity[0].uuid,env}),{flag:'wx',mode:0o600});
  await c.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);
  for(const host of ['127.0.0.1','%']){
   await c.query(`CREATE USER '${user}'@'${host}' IDENTIFIED BY ?`,[password]);await c.query(`GRANT ALL PRIVILEGES ON \`${database}\`.* TO '${user}'@'${host}'`);
   await c.query(`CREATE USER '${runtimeUser}'@'${host}' IDENTIFIED BY ?`,[runtimePassword]);
  }
  await run(['--conditions=react-server','--import','tsx','scripts/security/review.ts','seed'],{...env,DATABASE_URL:operatorUrl,TEST_DATABASE_URL:operatorUrl});
  const append=['audit_events','entity_versions','receipt_versions'];
  const mutable=['clients','projects','contracts','contract_phases','payments','payment_allocations','expenses','expense_categories','persons','vehicles','payment_receipts','receipt_counters','operation_requests','auth_sessions','auth_login_limits','auth_mfa_factors','auth_mfa_challenges','auth_mfa_recovery_codes','auth_passkeys','auth_passkey_challenges'];
  for(const host of ['127.0.0.1','%']){
   for(const table of ['users','auth_account_control'])await c.query(`GRANT SELECT ON \`${database}\`.\`${table}\` TO '${runtimeUser}'@'${host}'`);
   for(const table of append)await c.query(`GRANT SELECT,INSERT ON \`${database}\`.\`${table}\` TO '${runtimeUser}'@'${host}'`);
   for(const table of mutable)await c.query(`GRANT SELECT,INSERT,UPDATE ON \`${database}\`.\`${table}\` TO '${runtimeUser}'@'${host}'`);
   await c.query(`GRANT UPDATE(auth_version,updated_at) ON \`${database}\`.users TO '${runtimeUser}'@'${host}'`);
   await c.query(`GRANT DELETE ON \`${database}\`.auth_passkey_challenges TO '${runtimeUser}'@'${host}'`);
  }
  console.log('Synthetic security fixture ready; application uses restricted runtime grants.');
 }finally{await c.end();}
}else{
 const state=scope(JSON.parse(readFileSync(stateFile,'utf8'))),admin=await connect();
 const [identity]=await admin.query('SELECT @@server_uuid AS uuid');assert.equal(identity[0].uuid,state.serverUUID);
 if(mode==='cleanup'){
  try{
   await admin.query(`DROP DATABASE IF EXISTS \`${state.database}\``);
   for(const name of [state.user,state.runtimeUser])for(const host of ['127.0.0.1','%'])await admin.query(`DROP USER IF EXISTS '${name}'@'${host}'`);
   const target=resolve(state.env.RECEIPT_STORAGE_DIR),allowed=resolve(root,'private-store')+sep;
   assert(target.startsWith(allowed)&&target===resolve(allowed,state.database));rmSync(target,{recursive:true,force:true});
   rmSync(resolve(root,'fixture.json'),{force:true});rmSync(stateFile);console.log('Removed only task-owned security schema/users/secrets/receipt store.');
  }finally{await admin.end();}
 }else{
  await admin.end();assert(await available(),'Port 3000 is occupied; its server was preserved.');
  // Explicit empty values also prevent CLI-style env loading from importing an owner operator key.
  const log=createWriteStream(resolve(root,'server.log')),serverEnv={...process.env,...state.env,ADORE_OPERATOR_KEY:'',OPERATOR_DATABASE_URL:''};
  const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{env:serverEnv,stdio:['ignore','pipe','pipe'],windowsHide:true});server.stdout.pipe(log);server.stderr.pipe(log);
  try{
   let ready=false;for(let i=0;i<90;i++){assert.equal(server.exitCode,null,'Security server exited');if(!await available()){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready);
   await run(['--conditions=react-server','--import','tsx','scripts/security/review.ts','verify'],{...state.env,OPERATOR_DATABASE_URL:state.operatorUrl});
  }finally{if(server.exitCode===null)execFileSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});log.end();}
 }
}
