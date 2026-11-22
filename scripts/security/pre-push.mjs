/** Read-only credential check. Reports paths/categories only, never secret values. */
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,lstatSync,realpathSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';

const root=realpathSync(fileURLToPath(new URL('../../',import.meta.url)));
assert.equal(realpathSync(process.cwd()),root,'Run from the repository root.');
function git(args,input){
 const result=spawnSync('git',['-c',`safe.directory=${root.replaceAll('\\','/')}`,...args],{input,maxBuffer:128*1024*1024,windowsHide:true});
 assert.equal(result.status,0,'Git inspection failed; output withheld.');return result.stdout;
}
const secrets=new Set(),findings=new Set();
function add(value){if(typeof value==='string'&&value.length>=8)secrets.add(value);}
function collect(value,key=''){
 if(Array.isArray(value)){for(const child of value)collect(child,key);return;}
 if(value&&typeof value==='object'){for(const [name,child]of Object.entries(value))collect(child,name);return;}
 if(/(?:KEY_ID|STORE_ID|PUBLIC_KEY|USERNAME|DATABASE_PROVIDER)$/i.test(key))return;
 if(/password|secret|token|operator|encryption|private.?key|(?:^|_)key$/i.test(key))add(value);
 if(/(?:DATABASE_URL|^url$)/i.test(key)&&typeof value==='string'){
  try{const password=decodeURIComponent(new URL(value).password);if(password){add(value);add(password);}}catch{}
 }
 if(key==='MFA_ENCRYPTION_KEYS'&&typeof value==='string'){try{for(const item of Object.values(JSON.parse(value)))add(item);}catch{}}
}
for(const name of readdirSync(root))if(/^\.env(?:\.|$)/.test(name)&&name!=='.env.example')collect(parseEnv(readFileSync(name,'utf8')));
function privateSentinels(directory){
 if(!existsSync(directory))return;
 for(const name of readdirSync(directory)){
  const path=join(directory,name),stat=lstatSync(path);assert(!stat.isSymbolicLink(),'Linked private sentinel path refused.');
  // Receipt stores contain documents, not credential sources, and can have stricter ACLs.
  if(stat.isDirectory()){if(!/^(?:receipts|receipt-store|profiles|downloads)$/i.test(name))privateSentinels(path);}
  else if(name.endsWith('.json')&&stat.size<=2*1024*1024){try{collect(JSON.parse(readFileSync(path,'utf8')));}catch{}}
  else if(/\.key$/.test(name)&&stat.size===32){const bytes=readFileSync(path);add(bytes.toString('hex'));add(bytes.toString('base64'));}
  else if(/password|operator|token|secret/i.test(name)&&stat.size<4096)add(readFileSync(path,'utf8').trim());
 }
}
privateSentinels('.private');
const sentinels=[...secrets].flatMap(value=>[Buffer.from(value),Buffer.from(value,'utf16le')]);
const protectedPath=path=>/(?:^|\/)(?:\.private|\.vercel|artifacts|backups?)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|\.(?:key|pem|p12|pfx|dump|har)$|\.sql\.gz$/i.test(path)&&!/(?:^|\/)\.env\.example$/.test(path);
function check(bytes,label){
 if(sentinels.some(value=>bytes.includes(value)))findings.add(`${label}: known local credential`);
 const text=bytes.toString('utf8');
 if(/-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{36,}\b|\bgithub_pat_[A-Za-z0-9_]{40,}\b|\bvercel_blob_rw_[A-Za-z0-9]+_[A-Za-z0-9]+\b/.test(text))findings.add(`${label}: private credential format`);
}
const files=[...new Set(git(['ls-files','--cached','--others','--exclude-standard','-z']).toString().split('\0').filter(Boolean))];
let current=0;
for(const path of files){
 if(protectedPath(path))findings.add(`${path}: protected file eligible for Git`);
 if(existsSync(path)){assert(!lstatSync(path).isSymbolicLink(),'Linked Git candidate refused.');check(readFileSync(path),path);current++;}
}
// Inspect every reachable historical blob, including files deleted from today's tree.
const objectPaths=new Map();
for(const line of git(['rev-list','--objects','--all']).toString().trim().split(/\r?\n/)){
 const index=line.indexOf(' ');if(index<0)continue;
 const id=line.slice(0,index),path=line.slice(index+1);objectPaths.set(id,path);
 if(protectedPath(path))findings.add(`${path}: protected historical path`);
}
const ids=[...objectPaths.keys()],info=git(['cat-file','--batch-check'],ids.join('\n')+'\n').toString().trim().split(/\r?\n/);
const blobs=info.map(line=>line.split(' ')).filter(([,type])=>type==='blob').map(([id,,size])=>({id,size:Number(size)}));
let history=0;
for(let i=0;i<blobs.length;i+=32){
 const batch=blobs.slice(i,i+32),bytes=git(['cat-file','--batch'],batch.map(item=>item.id).join('\n')+'\n');let offset=0;
 for(const item of batch){
  const end=bytes.indexOf(10,offset);assert(end>=0);offset=end+1;
  assert(offset+item.size<=bytes.length);check(bytes.subarray(offset,offset+item.size),`history:${item.id.slice(0,10)}:${objectPaths.get(item.id)}`);
  offset+=item.size+1;history++;
 }
}
console.log(JSON.stringify({currentFiles:current,historicalBlobs:history,knownLocalCredentials:secrets.size,findings:[...findings],scope:'Current Git candidates and reachable Git history; known local credentials and selected private-key/token formats. This is not a complete security audit.'},null,2));
if(findings.size)process.exitCode=1;
