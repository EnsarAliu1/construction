/** Generated workspace files only. Never touches source, dependencies, .env, .private or Docker. */
import assert from 'node:assert/strict';
import {existsSync,lstatSync,readdirSync,readFileSync,realpathSync} from 'node:fs';
import {rm} from 'node:fs/promises';
import {resolve,dirname,join,sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createServer} from 'node:net';

const workspace=realpathSync(fileURLToPath(new URL('../',import.meta.url)));
assert.equal(realpathSync(process.cwd()),workspace,'Run cleanup from this project root.');
assert(process.argv.slice(2).every(value=>value==='--dry-run'),'Only --dry-run is supported.');
const dryRun=process.argv.includes('--dry-run');
const allowed=['artifacts','.next','.next-demo','.next-cloud','.next-demo-cloud','.next-passkeys','.next-sq','.next-wp09','.next-wp10','.next-wp11','.next-wp13','.next-wp14','.next-wp15','.next-wp16','test-results','playwright-report','coverage','out','tsconfig.tsbuildinfo'];
const totals={files:0,bytes:0};
const generatedLinks=[];
function inspect(path,inArtifacts){
 const stat=lstatSync(path);
 if(stat.isSymbolicLink()){
  // Generated build links may point to the old workspace after a rename.
  // Inspect no target; unlink only the link inside an allowed build directory.
  assert(!inArtifacts&&allowed.some(name=>name.startsWith('.next')&&path.startsWith(resolve(workspace,name)+sep)),'Unrecognized linked cleanup path: preserved.');
  generatedLinks.push(path);totals.files++;return;
 }
 if(stat.isDirectory()){for(const name of readdirSync(path))inspect(join(path,name),inArtifacts);}
 else{
  if(inArtifacts&&path.endsWith('.owner.json')){
   const owner=JSON.parse(readFileSync(path,'utf8')),database=String(owner.database??'').split('/').at(-1);
   assert.equal(owner.application,'fitimi-private-receipts-v1','Unrecognized private store: preserved.');
   assert(/^fitimi_test_[a-z0-9_]+$/.test(database??''),'Non-test receipt data in artifacts: preserved.');
  }
  totals.files++;totals.bytes+=stat.size;
 }
}
async function assertPortFree(host,port){
 await new Promise((yes,no)=>{const probe=createServer();probe.once('error',error=>{if(host==='::1'&&error.code==='EADDRNOTAVAIL')yes();else no(new Error(`Port ${port} is active/unavailable. Stop the application/demo/test server before cleanup.`));});probe.listen(port,host,()=>probe.close(yes));});
}
async function main(){
 for(const name of ['security-review/state.json','speed/state.json','wp15/dr-resources.json','wp16/dr-resources.json'])assert(!existsSync(resolve(workspace,'artifacts',name)),'An unfinished test laboratory was preserved. Use its own cleanup first.');
 const targets=allowed.map(name=>({name,path:resolve(workspace,name)})).filter(item=>existsSync(item.path));
 for(const target of targets){
  assert.equal(dirname(target.path),workspace);assert.equal(realpathSync(target.path),target.path,'Cleanup target resolves outside its expected location.');
  inspect(target.path,target.name==='artifacts');
 }
 console.log(`${dryRun?'Would remove':'Removing'} ${totals.files} generated files (${(totals.bytes/1e9).toFixed(2)} GB): ${targets.map(t=>t.name).join(', ')}`);
 if(dryRun)return;
 for(const port of [3000,3001,3100,3110]){await assertPortFree('127.0.0.1',port);await assertPortFree('::1',port);}
 // Remove Next's generated junctions themselves before recursing; never follow into dependencies.
 for(const link of generatedLinks)await rm(link,{recursive:false,force:true});
 for(const target of targets){
  if(target.name==='artifacts'){
   // Keep the empty parent directory; all descendants were inspected above.
   for(const name of readdirSync(target.path))await rm(join(target.path,name),{recursive:true,force:true,maxRetries:3,retryDelay:150});
  }else await rm(target.path,{recursive:lstatSync(target.path).isDirectory(),force:true,maxRetries:3,retryDelay:150});
 }
 console.log('Cleanup complete. Source, tests, migrations, .env, .private, node_modules and databases preserved.');
}
void main().catch(error=>{console.error(error instanceof Error?error.message:'Cleanup failed; protected paths preserved.');process.exitCode=1;});
