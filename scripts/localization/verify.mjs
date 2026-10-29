import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync,openSync,closeSync,writeFileSync,existsSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {setTimeout as pause} from 'node:timers/promises';
import {createServer} from 'node:net';
const root='artifacts/sq',resume=process.argv.includes('--browser-only')||process.argv.includes('--from'),results=resume&&existsSync(`${root}/verification.json`)?JSON.parse(readFileSync(`${root}/verification.json`,'utf8')).filter(r=>r.exit===0&&r.args[0]==='run'&&!['db:migrate'].includes(r.args[1])):[];let server;
function run(args,name){const fd=openSync(`${root}/${name}.log`,'w');try{const r=spawnSync(process.execPath,['scripts/localization/lab.mjs',...args],{env:process.env,stdio:['ignore',fd,fd],windowsHide:true});results.push({args,exit:r.status,log:`${name}.log`});writeFileSync(`${root}/verification.json`,JSON.stringify(results,null,2));assert.equal(r.status,0,`Inspect private local ${name}.log; no sensitive output printed.`);}finally{closeSync(fd);}}
async function stop(){if(server){const child=server;server=undefined;if(child.exitCode===null){const done=new Promise(resolve=>child.once('exit',resolve));child.kill();await done;}}}
async function start(){const env={...process.env,...parseEnv(readFileSync(`${root}/test.env`,'utf8'))};assert.equal(env.FITIMI_TEST_BUILD,'sq');const fd=openSync(`${root}/server.log`,'a');server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','127.0.0.1','--port','3000'],{env,stdio:['ignore',fd,fd],windowsHide:true});closeSync(fd);for(let i=0;i<100;i++){assert.equal(server.exitCode,null);try{if((await fetch('http://127.0.0.1:3000/sq')).status===200)return;}catch{}await pause(100);}throw Error('Server readiness failed.');}
async function fresh(){await stop();run(['reset'],'reset');run(['run','db:migrate'],'migrate');}
async function main(){await new Promise((resolve,reject)=>{const p=createServer();p.once('error',reject);p.listen(3000,'127.0.0.1',()=>p.close(resolve));});
 if(!resume){await fresh();run(['run','test:db'],'database');}
 const suites=['test:mfa:browser','test:mfa:http','test:release:browser','test:reports:http','test:security:browser','test:security:recovery','test:website:browser','check:routes'];const from=process.argv.includes('--from')?process.argv[process.argv.indexOf('--from')+1]:suites[0];assert(suites.includes(from));for(const script of suites.slice(suites.indexOf(from))){await fresh();await start();console.log(`Verifying ${script} with Albanian UI and fresh isolated records.`);run(['run',script],script.replaceAll(':','-'));}
 console.log('PASS: isolated Albanian financial, MFA, export and public/private browser regressions.');
}
void main().catch(e=>{console.error(e.message);process.exitCode=1;}).finally(stop);
