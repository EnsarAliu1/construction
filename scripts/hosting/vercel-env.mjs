import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {spawnSync} from 'node:child_process';
const kind=process.argv[2];assert(['main','demo'].includes(kind));
const project=kind==='main'?'prj_mWFgOavPRyrTsOlxrlgm72ZNUgCP':'prj_B2lG0fmqgzjfAiIF0TQ3KaYNqgqH';
const source=parseEnv(readFileSync(kind==='main'?'.env.main-cloud.local':'.env.demo-cloud.local','utf8'));
if(kind==='main'){assert(source.DATABASE_PROVIDER==='tidb'&&!source.DB_USERNAME.endsWith('.root'));assert(!source.ADORE_OPERATOR_KEY);}
else{assert(!source.DATABASE_URL&&!source.MFA_ENCRYPTION_KEYS&&!source.DB_PASSWORD&&!source.BLOB_READ_WRITE_TOKEN);source.AUTH_ORIGIN='https://construction-demo-ensar.vercel.app';source.PUBLIC_SITE_URL=source.AUTH_ORIGIN;}
let count=0;for(const [key,value]of Object.entries(source).filter(([,v])=>v!=='')){
 const file='.private/vercel-env-request-'+kind+'.json';writeFileSync(file,JSON.stringify({key,value,type:'encrypted',target:['production','preview']}),{flag:'wx',mode:0o600});
 try{const r=spawnSync('cmd.exe',['/d','/s','/c',`npx --yes vercel@latest api /v10/projects/${project}/env?upsert=true -X POST --input ${file} --scope ensaraliu --non-interactive`],{encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024});assert.equal(r.status,0,'Vercel environment write failed; sensitive response withheld.');count++;}finally{unlinkSync(file);}
}
console.log(JSON.stringify({environmentConfigured:kind,count,secretsWithheld:true}));
