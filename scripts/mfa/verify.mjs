/** Sequential disposable fixtures: deliberately corrupting tests must never share a receipt namespace. */
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {openSync,closeSync,readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {setTimeout as pause} from 'node:timers/promises';
import {createServer} from 'node:net';
const only=process.argv[2]==='--only'?process.argv[3]?.split(','):null;
const root='artifacts/wp16',resume=process.argv[2]==='--from'?process.argv[3]:null,results=(resume||only)?JSON.parse(readFileSync(`${root}/verification.json`,'utf8')).filter(r=>r.exit===0&&!['reset.log','migrate.log'].includes(r.log)&&!(only??[]).some(name=>r.command.endsWith('run '+name))):[];
let server;
function run(args,log){
 const fd=openSync(`${root}/${log}.log`,'w'),started=performance.now();
 try{const r=spawnSync(process.execPath,['scripts/mfa/lab.mjs',...args],{stdio:['ignore',fd,fd],env:process.env,windowsHide:true});results.push({command:`node scripts/mfa/lab.mjs ${args.join(' ')}`,exit:r.status,ms:performance.now()-started,log:`${log}.log`});writeFileSync(`${root}/verification.json`,JSON.stringify(results,null,2));assert.equal(r.status,0,`Verification failed: ${log}; inspect the private local log.`);}finally{closeSync(fd);}
}
async function stop(){if(server){const child=server;server=undefined;if(child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}}}
async function start(){
 const env={...process.env,...parseEnv(readFileSync(`${root}/test.env`,'utf8'))};assert.equal(env.AUTH_TEST_WORK_PACKAGE,'WP-16');assert.equal(env.AUTH_ORIGIN,'http://127.0.0.1:3000');
 const fd=openSync(`${root}/server.log`,'a');server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{env,stdio:['ignore',fd,fd],windowsHide:true});closeSync(fd);
 for(let i=0;i<100;i++){assert.equal(server.exitCode,null,'Task server exited unexpectedly.');try{if((await fetch('http://127.0.0.1:3000/sq')).status===200)return;}catch{}await pause(100);}throw new Error('Task server readiness failed.');
}
async function fresh(){await stop();run(['reset'],'reset');run(['run','db:migrate'],'migrate');}
async function main(){
 await new Promise((resolve,reject)=>{const probe=createServer();probe.once('error',reject);probe.listen(3000,'127.0.0.1',()=>probe.close(resolve));});
 const suites=['test:mfa:browser','test:mfa:http','test:security:db','test:website:db','test:release:browser','test:security:browser','test:security:recovery','test:auth:http','test:clients:http','test:projects:http','test:references:http','test:expenses:http','test:payments:http','test:receipts:http','test:reports:http','test:security:http','test:website:browser'];
 assert(!resume||suites.includes(resume));assert(!only||only.length>0&&only.every(name=>[...suites,'check:routes'].includes(name)));for(const name of only??suites.slice(resume?suites.indexOf(resume):0)){
  await fresh();if(name!=='test:security:db')await start();console.log(`Running ${name} in a fresh synthetic fixture namespace.`);run(['run',name],name.replaceAll(':','-'));
 }
 if(only){await stop();console.log('PASS: selected final production-build regression checks.');return;}
 await fresh();await start();for(const mode of ['seed','db','browser','races']){console.log(`Performance regression: ${mode}.`);run(['run','perf:lab',mode,'baseline'],`performance-${mode}`);}
 await stop();console.log('PASS: all isolated regressions and production-build performance samples.');
}
void main().catch(error=>{console.error(error.message);process.exitCode=1;}).finally(stop);
