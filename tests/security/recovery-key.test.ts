import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import {readRecoveryKey,retainRecoveryKey,redactLegacyRecoveryDrafts} from "../../src/features/payments/recovery-key";
function storage():Storage{const data=new Map<string,string>();return {get length(){return data.size;},clear(){data.clear();},getItem:key=>data.get(key)??null,key:i=>[...data.keys()][i]??null,removeItem:key=>{data.delete(key);},setItem:(key,value)=>{data.set(key,value);}};}
test("legacy financial drafts are redacted across accounts without losing recovery identities",()=>{
 const s=storage(),a=randomUUID(),b=randomUUID(),first='fitimi.payment.pending.'+randomUUID(),second='fitimi.payment.pending.'+randomUUID();
 s.setItem(first,JSON.stringify({idempotencyKey:a,payment:{amount:'99999999999999999.99',allocations:[{phaseId:randomUUID(),amount:'1.00'}]}}));s.setItem(second,JSON.stringify({idempotencyKey:b,payment:{projectName:'PRIVATE-CANARY'}}));s.setItem('unrelated','leave unchanged');
 redactLegacyRecoveryDrafts(s);assert.deepEqual(JSON.parse(s.getItem(first)!),{idempotencyKey:a});assert.deepEqual(JSON.parse(s.getItem(second)!),{idempotencyKey:b});assert.equal(s.getItem('unrelated'),'leave unchanged');assert(!JSON.stringify([s.getItem(first),s.getItem(second)]).includes('amount'));
});
test("only valid opaque recovery identities persist; malformed drafts never become a payment request",()=>{
 const s=storage(),key='fitimi.payment.pending.'+randomUUID(),id=randomUUID();retainRecoveryKey(s,key,id);assert.deepEqual(readRecoveryKey(s,key),{idempotencyKey:id});
 for(const bad of ['not-json','null','{"idempotencyKey":"../private.pdf","payment":{"amount":"1.00"}}']){s.setItem(key,bad);assert.equal(readRecoveryKey(s,key),null);assert.equal(s.getItem(key),null);}
 assert.throws(()=>retainRecoveryKey(s,key,'invalid'));assert.equal(s.getItem(key),null);
});
