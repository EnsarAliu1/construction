import assert from 'node:assert/strict';
import {existsSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
const directory='.private/development',profile=`${directory}/profile.json`,env='.env.development.local';
const required=[env,`${directory}/mysql-password`,`${directory}/mysql-root-password`,profile];
if(required.every(existsSync)){
 const marker=JSON.parse(readFileSync(profile,'utf8'));assert.equal(marker.application,'fitimi-local-development/1');
 console.log('Profili lokal ekziston. Çelësat, fjalëkalimet dhe të dhënat mbeten të pandryshuara.');
}else{
 assert(!required.some(existsSync),'Profili është i paplotë. Nuk u mbishkrua konfigurimi ekzistues.');
 mkdirSync(directory,{recursive:true,mode:0o700});
 const password=randomBytes(32).toString('hex');
 writeFileSync(`${directory}/mysql-password`,password,{flag:'wx',mode:0o600});
 writeFileSync(`${directory}/mysql-root-password`,randomBytes(32).toString('hex'),{flag:'wx',mode:0o600});
 writeFileSync(env,`# Vetëm zhvillim lokal me të dhëna provuese; mos e publikoni.\nFITIMI_LOCAL_DEVELOPMENT=1\nDATABASE_URL=mysql://fitimi_dev:${password}@127.0.0.1:3307/fitimi_dev_local\nDATABASE_DISPOSABLE=1\nTEST_DATABASE_URL=\nAUTH_ORIGIN=http://127.0.0.1:3000\nADORE_OPERATOR_KEY=${randomBytes(32).toString('hex')}\nMFA_ENCRYPTION_KEY_ID=local-development-v1\nMFA_ENCRYPTION_KEYS=${JSON.stringify({'local-development-v1':randomBytes(32).toString('base64')})}\nRECEIPT_STORAGE_DIR=.private/development/receipts\nRECEIPT_COMPANY_NAME=Kompania provuese\nRECEIPT_NUMBER_PREFIX=DEV\nPUBLIC_SITE_URL=\nPUBLIC_SITE_INDEXING=0\n`,{flag:'wx',mode:0o600});
 writeFileSync(profile,JSON.stringify({application:'fitimi-local-development/1',database:'fitimi_dev_local',container:'fitimiconstruction-mysql',mysqlPort:3307,appPort:3000},null,2)+'\n',{flag:'wx',mode:0o600});
 console.log('Profili lokal u krijua. Nisni docker compose up -d dhe pastaj npm run dev. Sekretet nuk shfaqen dhe nuk ruhen në Git.');
}
