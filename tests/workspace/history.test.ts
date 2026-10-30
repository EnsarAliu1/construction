import test from 'node:test';
import assert from 'node:assert/strict';
import {parseHistoryQuery} from '../../src/features/workspace/history-query';
import {workspaceNavigation} from '../../src/features/workspace/sections';
test('activity filters bound pagination, whitelist entity types and reject malformed identifiers',()=>{
 assert.deepEqual(parseHistoryQuery({}),{type:'all',entityId:'',page:1});
 assert.equal(parseHistoryQuery({type:'authentication',page:'1000'}).page,1000);
 for(const input of [{type:'users'},{page:'1001'},{page:'0'},{page:'1 OR 1=1'},{type:['client']},{entityId:'../../private'},{entityId:"' OR 1=1"},{page:['1']}])assert.throws(()=>parseHistoryQuery(input));
 assert.equal(parseHistoryQuery({type:'client',entityId:'12345678-1234-1234-1234-123456789abc'}).type,'client');
});
test('workspace menu preserves every existing section and includes dedicated activity and security destinations',()=>{
 assert.equal(new Set(workspaceNavigation.map(item=>item.href)).size,workspaceNavigation.length);
 for(const route of ['clients','projects','payments','expenses','receipts','reports','categories','persons','vehicles','accounts','history','security'])assert(workspaceNavigation.some(item=>item.href===`/app/${route}`));
});
