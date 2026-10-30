/** Fresh task-owned schema in the existing MySQL container; no new container, port or owner migrations. */
import {readFileSync,mkdirSync,createWriteStream,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {createConnection} from 'mysql2/promise';
import assert from 'node:assert/strict';
const root='artifacts/passkeys',name=`fitimi_test_passkeys_${randomBytes(4).toString('hex')}`,username=`pk_test_${randomBytes(4).toString('hex')}`,password=randomBytes(32).toString('hex');
assert(/^fitimi_test_passkeys_[0-9a-f]{8}$/.test(name));assert(/^pk_test_[0-9a-f]{8}$/.test(username));
mkdirSync(root,{recursive:true});let admin,server,created=false,account=false,wildcard=false;
async function responding(){try{await fetch('http://127.0.0.1:3000/login',{signal:AbortSignal.timeout(700)});return true;}catch{return false;}}
async function run(command,args,env){const child=spawn(command,args,{env,stdio:'inherit',windowsHide:true});const code=await new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',resolve);});assert.equal(code,0,'Task verification failed.');}
try{
 assert(!await responding(),'Port 3000 is already serving an application. Stop your own dev server before running this isolated test; it was left untouched.');
 admin=await createConnection({host:'127.0.0.1',port:3307,user:'root',password:readFileSync('.private/development/mysql-root-password','utf8').trim(),multipleStatements:false});
 await admin.query(`CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);created=true;
 await admin.query(`CREATE USER '${username}'@'127.0.0.1' IDENTIFIED BY ?`,[password]);account=true;
 await admin.query(`GRANT ALL PRIVILEGES ON \`${name}\`.* TO '${username}'@'127.0.0.1'`);
 // Docker's port-forward source can be a bridge address. The user is restricted to this fresh schema.
 await admin.query(`CREATE USER '${username}'@'%' IDENTIFIED BY ?`,[password]);wildcard=true;await admin.query(`GRANT ALL PRIVILEGES ON \`${name}\`.* TO '${username}'@'%'`);
 const url=`mysql://${username}:${password}@127.0.0.1:3307/${name}`;
 const env={...process.env,NODE_ENV:'development',DATABASE_URL:url,TEST_DATABASE_URL:url,DATABASE_DISPOSABLE:'1',AUTH_ORIGIN:'http://localhost:3000',FITIMI_TEST_BUILD:'passkeys',FITIMI_LOCAL_DEVELOPMENT:'0',ADORE_OPERATOR_KEY:randomBytes(32).toString('hex'),MFA_ENCRYPTION_KEY_ID:'passkey-test',MFA_ENCRYPTION_KEYS:JSON.stringify({'passkey-test':randomBytes(32).toString('base64')}),RECEIPT_STORAGE_DIR:`${root}/private-store`,PUBLIC_SITE_URL:'',PUBLIC_SITE_INDEXING:'0'};
 writeFileSync(`${root}/scope.json`,JSON.stringify({database:name,port:3307,appPort:3000,syntheticOnly:true}));
 await run(process.execPath,['--import','tsx','scripts/passkeys/verify.ts','prepare'],env);
 const require=createRequire(import.meta.url),log=createWriteStream(`${root}/server.log`);
 server=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3000'],{env,stdio:['ignore','pipe','pipe'],windowsHide:true});server.stdout.pipe(log);server.stderr.pipe(log);
 let ready=false;for(let i=0;i<180;i++){assert(server.exitCode===null,'Task server exited.');if(await responding()){ready=true;break;}await new Promise(r=>setTimeout(r,500));}assert(ready,'Task server did not become ready.');
 await run(process.execPath,['--import','tsx','scripts/passkeys/verify.ts'],env);
}catch(error){console.error(error instanceof assert.AssertionError?error.message:`Isolated passkey check failed (${error?.code??'verification'}); secrets withheld.`);process.exitCode=1;}
finally{
 if(server&&server.exitCode===null){execFileSync('taskkill.exe',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore',windowsHide:true});console.log('Temporary server stopped; port 3000 released.');}
 if(admin){if(created)await admin.query(`DROP DATABASE \`${name}\``);if(account){await admin.query(`DROP USER IF EXISTS '${username}'@'127.0.0.1'`);}if(wildcard)await admin.query(`DROP USER IF EXISTS '${username}'@'%'`);await admin.end();console.log('Disposed only the task-owned synthetic schema and test users. Owner database/container preserved.');}
}
