/** Remove only resources whose recorded identity, labels, mount and fixed ports all match WP-15. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,readdirSync,lstatSync,existsSync,chmodSync,unlinkSync,rmdirSync,writeFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
const base=resolve('artifacts/wp15'),docker=process.env.RELEASE_DOCKER??'docker';
const run=args=>{const r=spawnSync(docker,args,{encoding:'utf8',windowsHide:true});assert.equal(r.status,0,'Task resource verification/removal failed; details withheld.');return r.stdout;};
const records=JSON.parse(readFileSync(resolve(base,'dr-resources.json'),'utf8'));
const owned=records.map(record=>{
 assert.match(record.id,/^[a-f0-9]{64}$/);const c=JSON.parse(run(['inspect',record.id]))[0];assert.equal(c.Id,record.id);assert.match(c.Name,/^\/fitimi-wp15-dr-(source|target)-[a-f0-9]{8}$/);assert.equal(c.State.Running,false);assert.equal(c.Config.Labels['adore.work-package'],'WP-15');assert.equal(c.Config.Labels['adore.project'],'fitimiconstruction');assert.equal(c.HostConfig.PortBindings['3306/tcp'][0].HostPort,'3307');assert.equal(c.HostConfig.PortBindings['3306/tcp'][0].HostIp,'127.0.0.1');
 assert.equal(record.volume,c.Name.slice(1)+'-data');const mount=c.Mounts.find(m=>m.Destination==='/var/lib/mysql');assert.equal(mount.Type,'volume');assert.equal(mount.Name,record.volume);const v=JSON.parse(run(['volume','inspect',record.volume]))[0];assert.equal(v.Name,record.volume);assert.equal(v.Labels['adore.work-package'],'WP-15');assert.equal(v.Labels['adore.project'],'fitimiconstruction');return record;
});
// Validate every filesystem target before any mutation. No recursive deletion or computed shell commands.
const directories=[];
for(const [name,pattern]of [['keys',/^[a-f0-9]{8}\.key$/],['backups',/^[a-f0-9-]{36}\.(fitimi|part)$/]]){
 const target=resolve(base,name);assert.equal(dirname(target),base);if(!existsSync(target))continue;const stat=lstatSync(target);assert(stat.isDirectory()&&!stat.isSymbolicLink());const files=readdirSync(target).map(name=>{assert(pattern.test(name));const path=resolve(target,name);assert.equal(dirname(path),target);const s=lstatSync(path);assert(s.isFile()&&!s.isSymbolicLink());return path;});directories.push({target,files});
}
const credentials=['source-dr.env','target-dr.env','performance/fixture.json'].map(name=>resolve(base,name)).filter(existsSync);for(const path of credentials){assert(path.startsWith(base+'\\')||path.startsWith(base+'/'));assert(lstatSync(path).isFile()&&!lstatSync(path).isSymbolicLink());}
for(const record of owned){run(['rm',record.id]);run(['volume','rm',record.volume]);}
for(const {target,files}of directories){for(const file of files){chmodSync(file,0o600);unlinkSync(file);}rmdirSync(target);}
for(const file of credentials){chmodSync(file,0o600);unlinkSync(file);}
writeFileSync(resolve(base,'dr-cleanup.json'),JSON.stringify({ownedContainersRemoved:owned.length,ownedVolumesRemoved:owned.length,backupKeysRemoved:true,syntheticCredentialFilesRemoved:true,ownerResourcesModified:false},null,2));unlinkSync(resolve(base,'dr-resources.json'));console.log('Removed only recorded WP-15 DR containers/volumes, test keys and credentials. Run lab.mjs dispose separately for the regression container/private stores.');
