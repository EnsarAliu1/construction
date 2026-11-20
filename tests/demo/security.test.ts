import assert from 'node:assert/strict';
import test from 'node:test';
import {demoDatabase,demoEntryUrl,safeDemoEntryUrl,demoPassword} from '../../src/server/demo/policy';
import {initializeDemo} from '../../src/server/demo/runtime';
import {sessionCookieSettings} from '../../src/server/auth/security';

test('demo cannot start with real credentials, ambiguous database selection or an unsafe public origin',async()=>{
 const names=['DEMO_MODE','DEMO_PRIVATE_KEY','DEMO_DATABASE_URL','DEMO_ORIGIN','DATABASE_URL','ADORE_OPERATOR_KEY','MFA_ENCRYPTION_KEYS','NODE_ENV','AUTH_ORIGIN'],before=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 try{
  Object.assign(process.env,{DEMO_MODE:'1',DEMO_PRIVATE_KEY:'a'.repeat(64),DEMO_DATABASE_URL:'mysql://root:synthetic@127.0.0.1:3308/fitimi_dev_demo_control',DATABASE_URL:'mysql://real-credentials-must-not-be-used',ADORE_OPERATOR_KEY:'',MFA_ENCRYPTION_KEYS:''});
  await assert.rejects(initializeDemo(),/without real application credentials/);
  process.env.DATABASE_URL='';process.env.DEMO_DATABASE_URL='mysql://root:synthetic@127.0.0.1:3307/fitimi_dev_demo_control';
  await assert.rejects(initializeDemo(),/Dedicated loopback demo MySQL/);
  for(const name of ['fitimi_dev_local','mysql','fitimi_demo_control','fitimi_demo_'+ 'a'.repeat(24)+';DROP DATABASE mysql','../fitimi_demo_'+ 'a'.repeat(24)])assert.throws(()=>demoDatabase(name));
  process.env.DEMO_PRIVATE_KEY='';assert.throws(()=>demoPassword('fitimi_demo_'+'a'.repeat(24)),/private key/);
  assert.equal(sessionCookieSettings(true).name,'__Host-fitimi_demo_session');process.env.DEMO_MODE='';assert.equal(sessionCookieSettings(true).name,'__Host-fitimi_session');
  Object.assign(process.env,{NODE_ENV:'production'});
  process.env.AUTH_ORIGIN='https://app.example.com';
  for(const url of ['http://demo.example.com','https://user:password@demo.example.com','https://demo.example.com/path','javascript:alert(1)','https://demo.example.com/?redirect=evil','https://app.example.com','https://app.example.com:8443']){process.env.DEMO_ORIGIN=url;assert.throws(demoEntryUrl);assert.equal(safeDemoEntryUrl(),null);}
  process.env.DEMO_ORIGIN='https://demo.example.com';assert.equal(demoEntryUrl(),'https://demo.example.com/administrata?demo=1');
 }finally{for(const name of names){if(before[name]===undefined)delete process.env[name];else process.env[name]=before[name];}}
});
