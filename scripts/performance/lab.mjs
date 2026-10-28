/** Explicit disposable laboratory, retaining the owner's original 3307/3000 ports. */
import assert from 'node:assert/strict';
import {randomBytes,createHash} from 'node:crypto';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {spawnSync,spawn} from 'node:child_process';
import {resolve,delimiter} from 'node:path';
import {parseEnv} from 'node:util';
const root='artifacts/wp13',name='fitimiconstruction-mysql-wp13';
const docker=process.env.PERF_DOCKER??'docker';
const run=(args)=>{const r=spawnSync(docker,args,{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Docker laboratory command failed; details withheld.');return r.stdout;};
const [mode,...args]=process.argv.slice(2);
mkdirSync(root,{recursive:true});
if(mode==='setup'){
 assert(!existsSync(`${root}/test.env`),'Existing laboratory must be explicitly disposed before setup.');
 assert.equal(run(['ps','-a','--filter',`name=^/${name}$`,'--format','{{.ID}}']).trim(),'');
 for(const file of ['README.md','.env.local'])if(existsSync(file))writeFileSync(`${root}/${file.replaceAll('.','_')}-hash.txt`,createHash('sha256').update(readFileSync(file)).digest('hex'));
 const password=randomBytes(32).toString('hex'),rootPassword=randomBytes(32).toString('hex');
 writeFileSync(`${root}/mysql.env`,`MYSQL_ROOT_PASSWORD=${rootPassword}\nMYSQL_DATABASE=fitimi_test_wp13\nMYSQL_USER=fitimi_website_test\nMYSQL_PASSWORD=${password}\n`);
 const id=run(['run','--detach','--name',name,'--label','adore.work-package=WP-13','--label','adore.project=fitimiconstruction','--publish','127.0.0.1:3307:3306','--tmpfs','/var/lib/mysql:rw,size=1073741824','--env-file',`${root}/mysql.env`,'mysql:8.4','--skip-log-bin']).trim();assert.match(id,/^[a-f0-9]{64}$/);
 writeFileSync(`${root}/container-id.txt`,id);
 const url=`mysql://fitimi_website_test:${password}@127.0.0.1:3307/fitimi_test_wp13`;
 writeFileSync(`${root}/test.env`,`DATABASE_URL=${url}\nTEST_DATABASE_URL=${url}\nDATABASE_DISPOSABLE=1\nADORE_OPERATOR_KEY=${randomBytes(32).toString('hex')}\nAUTH_ORIGIN=http://127.0.0.1:3000\nAUTH_TEST_CONTAINER_ID=${id}\nAUTH_TEST_WORK_PACKAGE=WP-13\nFITIMI_TEST_BUILD=wp13\nRECEIPT_STORAGE_DIR=${root}/private-store-${randomBytes(8).toString('hex')}\nRECEIPT_COMPANY_NAME=Synthetic Company TEST ONLY\nPUBLIC_SITE_URL=https://fitimi.example.invalid\nPUBLIC_SITE_INDEXING=0\n`);
 console.log('Created task-owned disposable MySQL on original port 3307. Wait for MySQL readiness, then run db:migrate. No owner configuration changed.');
}else if(mode==='run'){
 const env=parseEnv(readFileSync(`${root}/test.env`,'utf8'));
 const url=new URL(env.DATABASE_URL);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'3307');assert.equal(url.pathname,'/fitimi_test_wp13');assert.equal(env.AUTH_ORIGIN,'http://127.0.0.1:3000');
 const scripts=JSON.parse(readFileSync('package.json','utf8')).scripts;
 const [script,...tail]=args;assert(Object.hasOwn(scripts,script));assert(tail.every(x=>/^[a-zA-Z0-9_./:=@-]+$/.test(x)));
 const childEnv={...process.env,...env};for(const key of Object.keys(childEnv))if(key.toLowerCase()==='path')delete childEnv[key];childEnv.PATH=resolve('node_modules/.bin')+delimiter+(process.env.Path??process.env.PATH??'');
 const child=spawn(process.env.ComSpec??'cmd.exe',['/d','/s','/c',`${scripts[script]} ${tail.join(' ')}`],{stdio:'inherit',windowsHide:true,env:childEnv});child.on('exit',code=>{process.exitCode=code??1;});
}else throw new Error('Use setup or run <package-script> [safe arguments]. Disposal is explicit: verify the saved container ID and WP-13 label before removing only that container and its owned private-store files.');
