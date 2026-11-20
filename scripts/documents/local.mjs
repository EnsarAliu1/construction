/** Own ephemeral MySQL container, only when the owner's 3307 service is stopped. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,readFileSync,rmSync,rmdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {spawn,execFileSync} from 'node:child_process';
import {createConnection} from 'mysql2/promise';
import {createServer} from 'node:net';
const suffix=randomBytes(4).toString('hex'),name='construction-documents-'+suffix,root=resolve('artifacts/documents','local-db-'+suffix),password=randomBytes(32).toString('hex');
const docker=(args)=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,maxBuffer:1024*1024});
let id,createdRoot=false;
try{
 await new Promise((yes,no)=>{const probe=createServer();probe.once('error',no);probe.listen(3307,'127.0.0.1',()=>probe.close(yes));});
 mkdirSync(resolve('artifacts/documents'),{recursive:true});mkdirSync(root);createdRoot=true;writeFileSync(resolve(root,'root-password'),password,{flag:'wx',mode:0o600});writeFileSync(resolve(root,'mysql.env'),`MYSQL_ROOT_PASSWORD=${password}\n`,{flag:'wx',mode:0o600});
 id=docker(['run','--detach','--name',name,'--label','adore.project=fitimiconstruction','--label','adore.task=documents-2026-11-20','--publish','127.0.0.1:3307:3306','--tmpfs','/var/lib/mysql:rw,size=536870912','--env-file',resolve(root,'mysql.env'),'mysql:8.4','--skip-log-bin']).trim();assert.match(id,/^[a-f0-9]{64}$/);
 console.log('Started only a new task-owned disposable MySQL; the owner container remains stopped.');
 let ready=false;for(let i=0;i<100;i++){try{const c=await createConnection({host:'127.0.0.1',port:3307,user:'root',password,connectTimeout:700});const [rows]=await c.query('SELECT VERSION() AS version');assert.match(rows[0].version,/^8\.4\./);await c.end();ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}assert(ready,'Disposable MySQL did not become ready.');
 const child=spawn(process.execPath,['scripts/security/review-local.mjs','check'],{env:{...process.env,SECURITY_TEST_ROOT_PASSWORD_FILE:resolve(root,'root-password')},stdio:'inherit',windowsHide:true});
 assert.equal(await new Promise((yes,no)=>{child.on('exit',yes);child.on('error',no);}),0,'Document lifecycle/security verification failed.');
 writeFileSync('artifacts/documents/mysql-verification.json',JSON.stringify({syntheticOnly:true,ownerContainerStarted:false,ownerDatabaseTouched:false,taskContainer:name,port:3307,verified:true},null,2));
}finally{
 if(id){const own=JSON.parse(docker(['inspect',id]))[0];assert.equal(own.Id,id);assert.equal(own.Name,'/'+name);assert.equal(own.Config.Labels['adore.task'],'documents-2026-11-20');assert.equal(own.HostConfig.PortBindings['3306/tcp'][0].HostIp,'127.0.0.1');assert.equal(own.HostConfig.PortBindings['3306/tcp'][0].HostPort,'3307');docker(['rm','-f',id]);console.log('Disposed only the verified document-test container.');}
 if(createdRoot){
  const allowed=resolve('artifacts/documents')+sep;assert(root.startsWith(allowed)&&root.endsWith('local-db-'+suffix));
  for(const file of ['mysql.env','root-password']){const target=resolve(root,file);if(file==='root-password')try{assert.equal(readFileSync(target,'utf8'),password);}catch(error){if(error.code!=='ENOENT')throw error;}rmSync(target,{force:true});}
  rmdirSync(root);
 }
}
