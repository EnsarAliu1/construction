/** A task-owned disposable MySQL container; never starts or modifies the owner's containers. */
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {mkdirSync,writeFileSync,rmSync,rmdirSync} from 'node:fs';
import {resolve,sep} from 'node:path';
import {execFileSync,spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {createConnection} from 'mysql2/promise';
const suffix=randomBytes(6).toString('hex'),name='construction-blob-test-'+suffix,root=resolve('.private','blob-mysql-test-'+suffix),password=randomBytes(32).toString('hex');
const docker=args=>execFileSync('docker',args,{encoding:'utf8',windowsHide:true,maxBuffer:1048576});
let id,created=false;
try{
 await new Promise((yes,no)=>{const port=createServer();port.once('error',no);port.listen(3307,'127.0.0.1',()=>port.close(yes));});
 mkdirSync(root);created=true;writeFileSync(resolve(root,'mysql.env'),'MYSQL_ROOT_PASSWORD='+password+'\n',{flag:'wx',mode:0o600});writeFileSync(resolve(root,'password'),password,{flag:'wx',mode:0o600});
 id=docker(['run','--detach','--name',name,'--label','construction.blob.test='+suffix,'--publish','127.0.0.1:3307:3306','--tmpfs','/var/lib/mysql:rw,size=536870912','--env-file',resolve(root,'mysql.env'),'mysql:8.4','--skip-log-bin']).trim();assert.match(id,/^[a-f0-9]{64}$/);
 let ready=false;
 for(let i=0;i<100;i++){
  let c;try{c=await createConnection({host:'127.0.0.1',port:3307,user:'root',password,connectTimeout:700});ready=true;break;}catch{await new Promise(done=>setTimeout(done,500));}finally{await c?.end().catch(()=>{});}
 }
 assert(ready,'Disposable MySQL did not become ready.');
 console.log(JSON.stringify({taskOwnedMysqlReady:true,ownerContainersUnchanged:true}));
 const child=spawn(process.execPath,['scripts/tidb/verify-mysql-workflows.mjs'],{env:{...process.env,TIDB_MYSQL_ROOT_PASSWORD_FILE:resolve(root,'password')},stdio:'inherit',windowsHide:true});
 assert.equal(await new Promise((yes,no)=>{child.once('error',no);child.once('exit',yes);}),0,'Local receipt/report regression failed.');
}finally{
 try{
  if(id){const container=JSON.parse(docker(['inspect',id]))[0];assert.equal(container.Id,id);assert.equal(container.Name,'/'+name);assert.equal(container.Config.Labels['construction.blob.test'],suffix);docker(['rm','-f',id]);}
 }finally{
  if(created){assert(root.startsWith(resolve('.private')+sep)&&root.endsWith('blob-mysql-test-'+suffix));for(const file of ['mysql.env','password'])rmSync(resolve(root,file),{force:true});rmdirSync(root);}
 }
}
console.log(JSON.stringify({disposableMysqlRemoved:true,ownerContainersUnchanged:true}));
