import {resetMfa} from '../../src/server/auth/mfa';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createInterface} from 'node:readline/promises';
import {stdin,stdout} from 'node:process';
import type {RowDataPacket} from 'mysql2/promise';
import {connectTidb} from '../../src/server/db/tidb';
import {authenticateOperator} from '../../src/server/auth/operator';
import {resetAccountPassword} from '../../src/server/auth/accounts';
async function secret(prompt:string){
 if(!stdin.isTTY||!stdin.setRawMode)throw new Error('Trusted interactive operator terminal required.');
 stdout.write(prompt);stdin.setRawMode(true);stdin.resume();
 return new Promise<string>((resolve,reject)=>{let value='';const done=(error?:Error)=>{stdin.off('data',read);stdin.setRawMode(false);stdin.pause();stdout.write('\n');if(error)reject(error);else resolve(value);};const read=(chunk:Buffer)=>{for(const c of chunk.toString('utf8')){if(c.codePointAt(0)===3){done(new Error('Cancelled.'));return;}if(c.codePointAt(0)===13||c.codePointAt(0)===10){done();return;}if(c.codePointAt(0)===127||c.codePointAt(0)===8)value=value.slice(0,-1);else if(c>=' ')value+=c;}};stdin.on('data',read);});
}
async function main(){
 if(process.argv.includes('--help')){console.log('npm run recover:online | npm run recover:mfa\nLocal trusted operator terminal only. Select your existing account, then enter a new password twice (hidden, at least 12 characters). Existing MFA remains required. No passwords or operator keys are printed or accepted as arguments.');return;}
 assert(stdin.isTTY&&stdout.isTTY,'Use your own interactive terminal.');
 const profile=parseEnv(readFileSync('.env.main-cloud.local','utf8')),admin=parseEnv(readFileSync('.env.tidb-test.local','utf8')),owner={...parseEnv(readFileSync('.env.local','utf8')),...parseEnv(readFileSync('.env.development.local','utf8'))};
 assert(/^construction_live_[a-f0-9]{12}$/.test(profile.DB_DATABASE??''));assert.equal(admin.DB_USERNAME?.split('.')[0],profile.DB_USERNAME?.split('.')[0]);assert.equal(admin.DB_HOST,profile.DB_HOST);assert(owner.ADORE_OPERATOR_KEY);
 process.env.ADORE_OPERATOR_KEY=owner.ADORE_OPERATOR_KEY;
 const operator=authenticateOperator(owner.ADORE_OPERATOR_KEY),source=await connectTidb({...admin,DB_DATABASE:profile.DB_DATABASE},'operator');
 try{
  const [accounts]=await source.connection.query<RowDataPacket[]>("SELECT id,email,display_name FROM users WHERE status='active' ORDER BY created_at,id");assert(accounts.length>0&&accounts.length<=5);
  await source.close();
  stdout.write('\nLlogarite aktive (vetem ne terminalin tend):\n');for(const [i,account]of accounts.entries())stdout.write(`${i+1}. ${account.display_name} <${account.email}>\n`);
  const prompt=createInterface({input:stdin,output:stdout});const choice=Number(await prompt.question('Zgjidh numrin e llogarise: '));assert(Number.isInteger(choice)&&choice>=1&&choice<=accounts.length);
  if(process.argv.includes('--mfa')){
   const email=String(accounts[choice-1].email);
   const verified=(await prompt.question('A eshte verifikuar identiteti i pronarit te kesaj llogarie nga operatori i autorizuar? [p/J]: ')).trim().toLowerCase()==='p';
   const confirmation=await prompt.question('Per riregjistrim te autentikatorit, shkruaj reset-mfa '+email+': ');prompt.close();
   assert(verified&&confirmation==='reset-mfa '+email,'Explicit verified operator confirmation required.');
   const writer=await connectTidb({...admin,DB_DATABASE:profile.DB_DATABASE},'operator');
   try{await resetMfa(writer.connection,operator,email,{reason:'verified-device-replacement',identityVerified:verified,confirmation:'reset-mfa'});}finally{await writer.close();}
   stdout.write('\nRiregjistrimi MFA u autorizua dhe u regjistrua ne historik.\nHyr me emailin dhe fjalekalimin e ri ne site. Shfaq konfigurimin, skano QR-ne me autentikatorin, verifiko kodin e ri dhe ruaj kodet e rikuperimit.\n');return;
  }
  prompt.close();
  const password=await secret('Fjalekalimi i ri (minimum 12 karaktere, nuk shfaqet): '),confirmation=await secret('Konfirmo fjalekalimin (nuk shfaqet): ');assert.equal(password,confirmation,'Passwords do not match.');
  const writer=await connectTidb({...admin,DB_DATABASE:profile.DB_DATABASE},'operator');
  try{await resetAccountPassword(writer.connection,operator,String(accounts[choice-1].email),password);}finally{await writer.close();}
  stdout.write('\nFjalekalimi u ndryshua. MFA mbetet aktiv dhe sesionet e vjetra u mbyllen.\nHap https://construction-ensar.vercel.app/administrata dhe perdor emailin e zgjedhur, fjalekalimin e ri dhe kodin e autentikatorit.\n');
 }finally{await source.close().catch(()=>{});}
}
void main().catch(()=>{console.error('Rikuperimi nuk perfundoi. Perdor terminalin tend, nje llogari te vlefshme dhe fjalekalim te forte me te pakten 12 karaktere. Sekretet nuk shfaqen.');process.exitCode=1;});
