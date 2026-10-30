import assert from 'node:assert/strict';
import test from 'node:test';
import {trustedOrigin,assertSameOrigin} from '../../src/server/auth/security';
import {passkeyRelyingParty} from '../../src/server/auth/passkeys';
import {NextRequest} from 'next/server';
import {proxy} from '../../src/proxy';
test('passkeys use a valid configured RP domain; the local owner profile canonicalizes to localhost without accepting cross-origin POSTs',()=>{
 const keys=['AUTH_ORIGIN','FITIMI_LOCAL_DEVELOPMENT','FITIMI_TEST_BUILD','NODE_ENV'] as const,before=Object.fromEntries(keys.map(k=>[k,process.env[k]]));
 try{
  Object.assign(process.env,{NODE_ENV:'development'});process.env.FITIMI_LOCAL_DEVELOPMENT='1';delete process.env.FITIMI_TEST_BUILD;process.env.AUTH_ORIGIN='http://127.0.0.1:3000';
  assert.equal(trustedOrigin().origin,'http://localhost:3000');assert.deepEqual(passkeyRelyingParty(),{origin:'http://localhost:3000',rpID:'localhost'});
  assert.doesNotThrow(()=>assertSameOrigin(new Headers({origin:'http://localhost:3000',host:'localhost:3000'})));
  const redirected=proxy(new NextRequest('http://127.0.0.1:3000/administrata?returnTo=%2Fapp%2Fsecurity',{headers:{host:'127.0.0.1:3000','x-forwarded-host':'attacker.invalid'}}));
  assert.equal(redirected.status,307);assert.equal(redirected.headers.get('location'),'http://localhost:3000/administrata?returnTo=%2Fapp%2Fsecurity');
  assert.throws(()=>assertSameOrigin(new Headers({origin:'http://127.0.0.1:3000',host:'localhost:3000'})));
  assert.throws(()=>assertSameOrigin(new Headers({origin:'http://localhost:3000',host:'attacker.invalid','x-forwarded-host':'localhost:3000'})));
  process.env.FITIMI_TEST_BUILD='isolated';assert.equal(trustedOrigin().origin,'http://127.0.0.1:3000');assert.throws(()=>passkeyRelyingParty());
  Object.assign(process.env,{NODE_ENV:'production'});process.env.AUTH_ORIGIN='https://workspace.example.invalid';assert.deepEqual(passkeyRelyingParty(),{origin:'https://workspace.example.invalid',rpID:'workspace.example.invalid'});
 }finally{for(const k of keys)if(before[k]===undefined)delete process.env[k];else Object.assign(process.env,{[k]:before[k]});}
});
