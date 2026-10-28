import {readdirSync,lstatSync,readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,relative} from 'node:path';
export function routeInventory(){
 const result=[];
 function walk(dir){for(const name of readdirSync(dir)){const file=join(dir,name),s=lstatSync(file);if(s.isSymbolicLink())throw new Error('Linked source route refused.');if(s.isDirectory())walk(file);else if(name==='route.ts'||name==='page.tsx'){
  const source=readFileSync(file,'utf8'),parts=relative('src/app',file).replaceAll('\\','/').split('/').slice(0,-1).filter(p=>!p.startsWith('(')),path='/'+parts.join('/');
  if(path.startsWith('/api/')||path==='/app'||path.startsWith('/app/'))result.push({file:file.replaceAll('\\','/'),path,kind:name==='route.ts'?'api':'page',methods:name==='page.tsx'?['GET']:[...source.matchAll(/export\s+(?:async\s+function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g)].map(m=>m[1])});
 }} }
 walk('src/app');return result.sort((a,b)=>a.path.localeCompare(b.path));
}
if(process.argv[1]?.replaceAll('\\','/').endsWith('/inventory.mjs')){mkdirSync('docs/security',{recursive:true});writeFileSync('docs/security/endpoint-inventory.json',JSON.stringify(routeInventory(),null,2)+'\n');console.log('Wrote actual API/private-page source inventory.');}
