/** Sequential disposable fixtures: deliberately corrupting tests must never share a receipt namespace. */
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {openSync,closeSync,readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {setTimeout as pause} from 'node:timers/promises';
import {createServer} from 'node:net';
const root='artifacts/wp15',results=[];
let server;
function run(args,log){
 const fd=openSync(`${root}/${log}.log`,'w'),started=performance.now();
 try{const r=spawnSync(process.execPath,['scripts/release/lab.mjs',...args],{stdio:['ignore',fd,fd],env:process.env,windowsHide:true});results.push({command:`node scripts/release/lab.mjs ${args.join(' ')}`,exit:r.status,ms:performance.now()-started,log:`${log}.log`});writeFileSync(`${root}/verification.json`,JSON.stringify(results,null,2));assert.equal(r.status,0,`Verification failed: ${log}; inspect the private local log.`);}finally{closeSync(fd);}
}
async function stop(){if(server){const child=server;server=undefined;if(child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}}}
async function start(){
 const env={...process.env,...parseEnv(readFileSync(`${root}/test.env`,'utf8'))};assert.equal(env.AUTH_TEST_WORK_PACKAGE,'WP-15');assert.equal(env.AUTH_ORIGIN,'http://127.0.0.1:3000');
 const fd=openSync(`${root}/server.log`,'a');server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{env,stdio:['ignore',fd,fd],windowsHide:true});closeSync(fd);
 for(let i=0;i<100;i++){assert.equal(server.exitCode,null,'Task server exited unexpectedly.');try{if((await fetch('http://127.0.0.1:3000/sq')).status===200)return;}catch{}await pause(100);}throw new Error('Task server readiness failed.');
}
async function fresh(){await stop();run(['reset'],'reset');run(['run','db:migrate'],'migrate');}
async function main(){
 await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(3000,'127.0.0.1',()=>probe.close(resolve));});
 for(const name of ['test:security:db','test:website:db','test:release:browser','test:security:browser','test:security:recovery','test:auth:http','test:clients:http','test:projects:http','test:references:http','test:expenses:http','test:payments:http','test:receipts:http','test:reports:http','test:security:http','test:website:browser']){
  await fresh();if(name!=='test:security:db')await start();console.log(`Running ${name} in a fresh synthetic fixture namespace.`);run(['run',name],name.replaceAll(':','-'));
 }
 await fresh();await start();for(const mode of ['seed','db','browser','races']){console.log(`Performance regression: ${mode}.`);run(['run','perf:lab',mode,'baseline'],`performance-${mode}`);}
 await stop();console.log('PASS: all isolated regressions and production-build performance samples.');
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(stop);
