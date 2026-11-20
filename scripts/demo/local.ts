import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {spawn,spawnSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
import {initializeDemo,cleanupDemo,warmDemo} from '../../src/server/demo/runtime';
import {stopOwnedProcess} from '../development/stop-process';

async function main(){
 assert(process.env.NODE_ENV!=='production','Local demo launcher only');
 const root='.private/demo';mkdirSync(root,{recursive:true,mode:0o700});
 for(const file of ['mysql-password','private-key'])if(!existsSync(`${root}/${file}`))writeFileSync(`${root}/${file}`,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});
 const password=readFileSync(`${root}/mysql-password`,'utf8').trim(),key=readFileSync(`${root}/private-key`,'utf8').trim();assert.match(password,/^[a-f0-9]{64}$/);assert.match(key,/^[a-f0-9]{64}$/);
 // Next also loads local env files. Explicit empty values prevent those real credentials from entering this process.
 for(const file of ['.env','.env.local','.env.development','.env.development.local'])if(existsSync(file))for(const line of readFileSync(file,'utf8').split(/\r?\n/)){const match=/^\s*([A-Z][A-Z0-9_]*)\s*=/.exec(line);if(match)process.env[match[1]]='';}
 for(const name of Object.keys(process.env))if(/^(DATABASE_|TEST_DATABASE_|ADORE_|MFA_|RECEIPT_|FITIMI_)/.test(name))process.env[name]='';
 Object.assign(process.env,{DEMO_MODE:'1',DEMO_PRIVATE_KEY:key,DEMO_DATABASE_URL:`mysql://root:${password}@127.0.0.1:3308/fitimi_dev_demo_control`,DEMO_RECEIPT_DIR:resolve(root,'receipts'),DATABASE_URL:'',TEST_DATABASE_URL:'',ADORE_OPERATOR_KEY:'',MFA_ENCRYPTION_KEYS:'',MFA_ENCRYPTION_KEY_ID:'',AUTH_ORIGIN:'http://localhost:3001',RECEIPT_COMPANY_NAME:'DEMO — Të dhëna fiktive',RECEIPT_COMPANY_ADDRESS:'Adresa fiktive e demonstrimit',RECEIPT_COMPANY_CITY:'Prishtinë',RECEIPT_VAT_STATUS:'not-registered',RECEIPT_NUMBER_PREFIX:'DEMO',PUBLIC_SITE_INDEXING:'0',FITIMI_LOCAL_DEVELOPMENT:'',FITIMI_TEST_BUILD:''});
 const compose=spawnSync('docker',['compose','-f','compose.demo.yaml','up','-d'],{stdio:'inherit',windowsHide:true});assert.equal(compose.status,0,'Demo MySQL could not start');
 let ready=false;
 for(let attempt=0;attempt<60;attempt++){try{await initializeDemo();ready=true;break;}catch{await pause(1000);}}
 assert(ready,'Demo MySQL did not become ready');await cleanupDemo();
 console.log('Duke përgatitur hapësirat demo. Nisja e parë mund të zgjasë rreth një minutë.');
 await warmDemo();
 let maintaining=false;
 const timer=setInterval(()=>{if(maintaining)return;maintaining=true;void cleanupDemo().then(warmDemo).catch(()=>console.error('Demo cleanup unavailable; expired sessions remain denied.')).finally(()=>{maintaining=false;});},15_000);timer.unref();
 const require=createRequire(resolve('package.json'));
 const child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'dev','--hostname','127.0.0.1','--port','3001'],{stdio:'inherit',env:process.env,windowsHide:true});
 console.log('Demo e izoluar: http://localhost:3001/administrata');
 const stop=()=>{clearInterval(timer);stopOwnedProcess(child);};process.on('SIGINT',stop);process.on('SIGTERM',stop);
 child.on('exit',code=>{clearInterval(timer);process.exitCode=code??0;});
}
void main().catch(()=>{console.error('Demoja nuk u nis. Kontrolloni Docker Desktop dhe portet 3001/3308. Baza reale nuk u ndryshua.');process.exitCode=1;});
