/** Redacted local source/build/log sentinel scan; never prints credentials. */
import assert from 'node:assert/strict';
import {readFile,readdir,lstat,writeFile,mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {parseEnv} from 'node:util';
const root='artifacts/security-review',secrets=new Set(),findings=[];
function add(value){if(typeof value==='string'&&value.length>=16)secrets.add(value);}
for(const path of ['.env','.env.local','.env.production','.env.production.local','.env.development','.env.development.local']){
 const text=await readFile(path,'utf8').catch(error=>{if(error.code==='ENOENT')return '';throw error;});
 // A key-version identifier is public metadata, not encryption key material.
 for(const [key,value]of Object.entries(parseEnv(text)))if(key!=='MFA_ENCRYPTION_KEY_ID'&&/PASSWORD|SECRET|TOKEN|OPERATOR|DATABASE_URL|MFA_ENCRYPTION/.test(key)){
  add(value);if(key.endsWith('DATABASE_URL')&&value)try{add(decodeURIComponent(new URL(value).password));}catch{}
  if(key==='MFA_ENCRYPTION_KEYS')try{for(const key of Object.values(JSON.parse(value)))add(key);}catch{}
 }
}
add((await readFile('.private/development/mysql-root-password','utf8')).trim());
if(process.env.SECURITY_TEST_ROOT_PASSWORD_FILE)add((await readFile(process.env.SECURITY_TEST_ROOT_PASSWORD_FILE,'utf8')).trim());
for(const file of ['state.json','fixture.json']){
 const data=JSON.parse(await readFile(join(root,file),'utf8').catch(e=>{if(e.code==='ENOENT')return '{}';throw e;}));
 const walk=(value,key='')=>{if(Array.isArray(value))for(const item of value)walk(item,key);else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))walk(v,k);else if(/password|token|seed|codes|url|operator|encryption/i.test(key)){
  add(value);
  if(/url$/i.test(key)&&typeof value==='string')try{add(decodeURIComponent(new URL(value).password));}catch{}
  if(key==='MFA_ENCRYPTION_KEYS')try{for(const key of Object.values(JSON.parse(value)))add(key);}catch{}
 }};walk(data);
}
const git=spawnSync('git',['-c',`safe.directory=${process.cwd().replaceAll('\\','/')}`,'ls-files','--cached','--others','--exclude-standard','-z'],{maxBuffer:20*1024*1024,windowsHide:true});assert.equal(git.status,0);
const files=[...new Set(git.stdout.toString().split('\0').filter(Boolean))];
const check=async path=>{
 const bytes=await readFile(path);
 for(const value of secrets)if(bytes.includes(Buffer.from(value))||bytes.includes(Buffer.from(value,'utf16le'))){findings.push({path,kind:'known credential sentinel'});break;}
 if(/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{36}/.test(bytes.toString()))findings.push({path,kind:'private credential format'});
};
for(const file of files)await check(file);
let publicFiles=0,traces=0;
async function walk(dir,kind){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=join(dir,entry.name);assert(!(await lstat(path)).isSymbolicLink());
  if(entry.isDirectory())await walk(path,kind);
  else if(kind==='public'){await check(path);publicFiles++;}
  else if(entry.name.endsWith('.nft.json')){
   const trace=JSON.parse(await readFile(path,'utf8'));assert(trace.files.every(p=>!/(?:^|[\\/])(?:artifacts|\.private|\.env(?:\.|$))/.test(p)));traces++;
  }
 }
}
await walk('public','public');await walk('.next/static','public');await walk('.next/server','trace');
await check(join(root,'server.log'));
await mkdir(root,{recursive:true});await writeFile(join(root,'scan.json'),JSON.stringify({sourceFiles:files.length,publicFiles,traces,checkedSentinels:secrets.size,findings,scope:'Current Git tracked/untracked nonignored files, public assets, production browser bundles, tracing paths and local security server log. Known sentinel/credential format scan; not exhaustive historical blob or entropy analysis.'},null,2));
assert.equal(findings.length,0,'Sensitive findings: inspect redacted paths; do not print credential values.');
console.log(`PASS: ${files.length} source files, ${publicFiles} public/build files, ${traces} tracing manifests; no checked credential sentinels exposed.`);
