import assert from 'node:assert/strict';
import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {spawn} from 'node:child_process';
import {createRequire} from 'node:module';
import {resolve} from 'node:path';
import {setTimeout as pause} from 'node:timers/promises';
import type {Connection,RowDataPacket} from 'mysql2/promise';
import {loadLocalEnvironment,localDatabaseOptions,openLocalConnection} from '../../src/server/db/config';
import {applyMigrations} from '../../src/server/db/migrate';
import {authenticateOperator} from '../../src/server/auth/operator';
import {createAccount} from '../../src/server/auth/accounts';

async function main(){
 const args=process.argv.slice(2);
 assert(args.length===0||(args.length===2&&args[0]==='--port'&&args[1]==='3000'),'Porti i aplikacionit duhet të mbetet 3000.');
 loadLocalEnvironment();
 // Existing explicitly configured test laboratories keep their own startup policy.
 if(!process.env.FITIMI_TEST_BUILD){
  assert(process.env.NODE_ENV!=='production','Ky profil është vetëm për zhvillim lokal.');
  assert(process.env.FITIMI_LOCAL_DEVELOPMENT==='1'&&existsSync('.private/development/profile.json'),'Ekzekutoni një herë npm run dev:setup për profilin lokal.');
  const marker=JSON.parse(readFileSync('.private/development/profile.json','utf8'));assert.equal(marker.application,'fitimi-local-development/1');
  const options=localDatabaseOptions(process.env.DATABASE_URL,'development',process.env.DATABASE_DISPOSABLE);
  assert.equal(options.host,'127.0.0.1');assert.equal(options.port,3307);assert.equal(options.database,'fitimi_dev_local');assert.equal(options.user,'fitimi_dev');
  let connection:Connection|undefined;
  console.log('Duke pritur MySQL-in lokal në portin 3307…');
  for(let attempt=0;attempt<15;attempt++){try{connection=await openLocalConnection({...options,connectTimeout:1000});break;}catch{await pause(1000);}}
  assert(connection,'MySQL nuk është gati. Nisni Docker Desktop dhe docker compose up -d; pastaj provoni npm run dev.');
  try{
   // Only this explicitly owned development schema is automatically migrated.
   await applyMigrations(connection);
   const [rows]=await connection.query<RowDataPacket[]>('SELECT COUNT(*) AS n FROM users');
   if(Number(rows[0].n)===0){
    const password=randomBytes(24).toString('base64url');
    await createAccount(connection,authenticateOperator(process.env.ADORE_OPERATOR_KEY??''),{email:'demo@example.invalid',displayName:'Përdoruesi provues',password,active:true});
    writeFileSync('.private/development/login.txt',`VETËM PËR ZHVILLIM LOKAL\nEmaili: demo@example.invalid\nFjalëkalimi: ${password}\n\nPërfundoni regjistrimin MFA në browser.\n`,{mode:0o600});
    console.log('Llogaria provuese u krijua. Të dhënat e hyrjes: .private/development/login.txt');
   }
   console.log('Baza lokale është gati. Të dhënat dhe MFA ruhen ndërmjet rinisjeve.');
  }finally{await connection.end();}
 }
 const require=createRequire(resolve('package.json')),cli=require.resolve('next/dist/bin/next');
 const child=spawn(process.execPath,[cli,'dev','--hostname','127.0.0.1','--port','3000'],{stdio:'inherit',env:process.env,windowsHide:true});
 child.on('error',()=>{console.error('Next.js nuk mund të nisej.');process.exitCode=1;});
 child.on('exit',code=>{process.exitCode=code??1;});
}
void main().catch(()=>{console.error('Nisja dështoi. Kontrolloni profilin lokal dhe docker compose up -d. Nuk u fshinë të dhëna dhe sekretet nuk shfaqen.');process.exitCode=1;});
