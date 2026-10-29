/** Separate synthetic schema: never reset/stop the existing demo container or database. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync,mkdirSync,unlinkSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {parseEnv} from 'node:util';
import {spawnSync,spawn} from 'node:child_process';
import {resolve,delimiter} from 'node:path';
import {createConnection} from 'mysql2/promise';
const root='artifacts/sq',file=`${root}/test.env`,docker=process.env.RELEASE_DOCKER??'docker';
mkdirSync(root,{recursive:true});
const run=(args,input)=>{const r=spawnSync(docker,args,{input,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Synthetic database operation failed; private details withheld.');return r.stdout;};
function owner(){const env=parseEnv(readFileSync(file,'utf8')),id=env.AUTH_TEST_CONTAINER_ID;assert.match(id,/^[a-f0-9]{64}$/);const c=JSON.parse(run(['inspect',id]))[0];assert.equal(c.Name,'/fitimiconstruction-mysql-sq');assert.equal(c.Config.Labels['adore.work-package'],'SQ');assert.equal(c.Config.Labels['adore.project'],'fitimiconstruction');assert.equal(c.State.Running,true);assert.equal(c.HostConfig.PortBindings['3306/tcp'][0].HostPort,'3307');assert.equal(c.HostConfig.PortBindings['3306/tcp'][0].HostIp,'127.0.0.1');assert.equal(c.HostConfig.Tmpfs['/var/lib/mysql'],'rw,size=1073741824');return id;}
const [mode,script,...args]=process.argv.slice(2);
if(mode==='setup'){
 assert(!existsSync(file),'A prior localization laboratory must be disposed explicitly.');assert.equal(run(['ps','-a','--filter','name=^/fitimiconstruction-mysql-sq$','--format','{{.ID}}']).trim(),'');const user='fitimi_sq_'+randomBytes(4).toString('hex'),password=randomBytes(32).toString('hex');
 writeFileSync(`${root}/mysql.env`,`MYSQL_ROOT_PASSWORD=${randomBytes(32).toString('hex')}\nMYSQL_USER=${user}\nMYSQL_PASSWORD=${password}\nMYSQL_DATABASE=fitimi_test_sq\n`,{flag:'wx',mode:0o600});
 const id=run(['run','--detach','--name','fitimiconstruction-mysql-sq','--label','adore.work-package=SQ','--label','adore.project=fitimiconstruction','--publish','127.0.0.1:3307:3306','--tmpfs','/var/lib/mysql:rw,size=1073741824','--env-file',`${root}/mysql.env`,'mysql:8.4','--skip-log-bin']).trim();assert.match(id,/^[a-f0-9]{64}$/);
 const url=`mysql://${user}:${password}@127.0.0.1:3307/fitimi_test_sq`;
 writeFileSync(file,`DATABASE_URL=${url}\nTEST_DATABASE_URL=${url}\nDATABASE_DISPOSABLE=1\nAUTH_LOCALIZATION_TEST=1\nAUTH_TEST_WORK_PACKAGE=WP-16\nAUTH_TEST_CONTAINER_ID=${id}\nAUTH_ORIGIN=http://127.0.0.1:3000\nFITIMI_TEST_BUILD=sq\nADORE_OPERATOR_KEY=${randomBytes(32).toString('hex')}\nMFA_ENCRYPTION_KEY_ID=sq-test-v1\nMFA_ENCRYPTION_KEYS=${JSON.stringify({'sq-test-v1':randomBytes(32).toString('base64')})}\nRECEIPT_STORAGE_DIR=artifacts/sq/private-store\nRECEIPT_COMPANY_NAME=Kompania provuese\nPUBLIC_SITE_URL=https://fitimi.example.invalid\nPUBLIC_SITE_INDEXING=0\n`,{flag:'wx',mode:0o600});console.log('Created only fitimi_test_sq and its synthetic operator/keyring; demo schema and port unchanged.');
}else if(mode==='run'){
 const env=parseEnv(readFileSync(file,'utf8')),url=new URL(env.DATABASE_URL);assert.equal(url.pathname,'/fitimi_test_sq');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'3307');assert.equal(env.DATABASE_DISPOSABLE,'1');assert.equal(env.AUTH_LOCALIZATION_TEST,'1');
 const scripts=JSON.parse(readFileSync('package.json','utf8')).scripts;assert(Object.hasOwn(scripts,script));assert(args.every(a=>/^[a-zA-Z0-9_./:=@-]+$/.test(a)));
 const childEnv={...process.env,...env};for(const k of Object.keys(childEnv))if(k.toLowerCase()==='path')delete childEnv[k];childEnv.PATH=resolve('node_modules/.bin')+delimiter+(process.env.Path??process.env.PATH??'');
 const child=spawn(process.env.ComSpec??'cmd.exe',['/d','/s','/c',`${scripts[script]} ${args.join(' ')}`],{stdio:'inherit',windowsHide:true,env:childEnv});child.on('exit',code=>{process.exitCode=code??1;});
}else if(mode==='reset'){
 owner();const env=parseEnv(readFileSync(file,'utf8')),url=new URL(env.DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'3307');assert.equal(url.pathname,'/fitimi_test_sq');assert.equal(env.AUTH_LOCALIZATION_TEST,'1');
 const c=await createConnection(env.DATABASE_URL);try{await c.query('DROP DATABASE fitimi_test_sq');await c.query('CREATE DATABASE fitimi_test_sq CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci');}finally{await c.end();}
 writeFileSync(file,readFileSync(file,'utf8').replace(/^RECEIPT_STORAGE_DIR=.*$/m,`RECEIPT_STORAGE_DIR=artifacts/sq/private-store-${randomBytes(8).toString('hex')}`));console.log('Reset only verified fitimi_test_sq; owner/demo resources unchanged.');
}else if(mode==='dispose'){
 const env=parseEnv(readFileSync(file,'utf8')),url=new URL(env.DATABASE_URL),id=owner();assert.equal(env.AUTH_TEST_CONTAINER_ID,id);assert.equal(url.pathname,'/fitimi_test_sq');assert.match(url.username,/^fitimi_sq_[a-f0-9]{8}$/);
 run(['rm','-f',id]);unlinkSync(file);unlinkSync(`${root}/mysql.env`);console.log('Removed only the verified localization container/config; retained owner resources and isolated evidence.');
}else throw new Error('Use setup, run <script>, or dispose.');
