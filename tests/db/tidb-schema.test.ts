import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join,sep} from 'node:path';
import test from 'node:test';
import baseline from '../../scripts/tidb/migration-baseline.json';
import {buildTidbSchemaPlan} from '../../scripts/tidb/schema';
import {grantsMatchTidbProfile,tidbGrantStatements,tidbPrivilegeProfile,tidbActivationBlockers} from '../../src/server/db/tidb-privileges';

test('schema plan binds all reviewed sources and substitutes trigger protections without DDL on owner databases',()=>{
 const plan=buildTidbSchemaPlan();assert.equal(plan.sources.length,12);assert.equal(plan.adaptations.omittedTriggers,13);
 assert.equal(plan.views[0],'payment_receipts');assert(!plan.physicalTables.includes('payment_receipts'));
 assert(plan.physicalTables.includes('auth_mfa_factors'));assert(plan.physicalTables.includes('auth_passkeys'));
 for(const statement of plan.statements)assert.doesNotMatch(statement.sql,/CREATE TRIGGER|DEFAULT \(UTC_TIMESTAMP\(3\)\)/i);
 assert(plan.statements.some(s=>/SQL SECURITY INVOKER VIEW payment_receipts/.test(s.sql)));
 assert(plan.statements.some(s=>/REFERENCES payment_receipt_identities/.test(s.sql)));
 assert.equal(buildTidbSchemaPlan().fingerprint,plan.fingerprint);
});
test('changed migration sources and unexpected journal entries fail before SQL execution',()=>{
 const root=mkdtempSync(join(tmpdir(),'construction-tidb-plan-'));
 try{
  mkdirSync(join(root,'drizzle/meta'),{recursive:true});
  const original=readFileSync('drizzle/meta/_journal.json','utf8');
  writeFileSync(join(root,'drizzle/meta/_journal.json'),original);
  writeFileSync(join(root,'drizzle/0000_wp02_integrity_foundation.sql'),'CREATE TABLE injected (id INT)');
  assert.throws(()=>buildTidbSchemaPlan(root),/checksum changed/);
  const journal=JSON.parse(original);journal.entries.push({tag:'unreviewed'});
  writeFileSync(join(root,'drizzle/meta/_journal.json'),JSON.stringify(journal));
  assert.throws(()=>buildTidbSchemaPlan(root),/Unreviewed migration journal/);
 }finally{assert(root.startsWith(resolve(tmpdir())+sep)&&root.split(sep).at(-1)?.startsWith('construction-tidb-plan-'));rmSync(root,{recursive:true,force:true});}
});
test('runtime SQL privileges protect account administration, immutable history and financial deletion',()=>{
 const policy=tidbPrivilegeProfile('runtime');
 assert.deepEqual(policy.users,['SELECT']);assert.deepEqual(policy.auth_account_control,['SELECT']);
 for(const table of ['audit_events','entity_versions','receipt_versions','payment_receipt_identities','payment_receipt_states'])assert.deepEqual(policy[table],['SELECT','INSERT']);
 for(const table of ['payments','expenses','contracts','contract_phases','payment_allocations'])assert(!policy[table].includes('DELETE'));
 assert(policy.auth_passkey_challenges.includes('DELETE'));
 const grants=tidbGrantStatements('synthetic_schema','runtime').map(s=>s.replace('?@?',"'synthetic.runtime'@'%'"));
 assert(grantsMatchTidbProfile(grants,'synthetic_schema','runtime'));
 for(const extra of ["GRANT UPDATE ON `synthetic_schema`.`users` TO 'synthetic.runtime'@'%'","GRANT ALL PRIVILEGES ON `synthetic_schema`.* TO 'synthetic.runtime'@'%'","GRANT `writer`@`%` TO `synthetic.runtime`@`%`",grants[0]+' WITH GRANT OPTION'])assert(!grantsMatchTidbProfile([...grants,extra],'synthetic_schema','runtime'));
 assert(!grantsMatchTidbProfile(grants.slice(1),'synthetic_schema','runtime'));
 assert.throws(()=>tidbGrantStatements('schema; DROP DATABASE users','runtime'));
 assert(tidbActivationBlockers.includes('verified_backup_and_restore_pending'));assert(tidbActivationBlockers.includes('serverless_isolated_visitor_demo_pending'));
 assert.deepEqual(policy.auth_user_versions,['SELECT','INSERT']);
 assert.deepEqual(policy.auth_users,['SELECT']);
});

test('reviewed migration fingerprints are stable across Windows and Linux line endings',()=>{
 const root=mkdtempSync(join(tmpdir(),'construction-tidb-plan-'));
 try{
  mkdirSync(join(root,'drizzle/meta'),{recursive:true});
  writeFileSync(join(root,'drizzle/meta/_journal.json'),readFileSync('drizzle/meta/_journal.json'));
  const expected=buildTidbSchemaPlan().fingerprint;
  for(const endings of ['\n','\r\n']){
   for(const migration of baseline){
    const content=readFileSync('drizzle/'+migration.tag+'.sql','utf8').replaceAll('\r\n','\n').replaceAll('\n',endings);
    writeFileSync(join(root,'drizzle',migration.tag+'.sql'),content);
   }
   assert.equal(buildTidbSchemaPlan(root).fingerprint,expected);
  }
 }finally{assert(root.startsWith(resolve(tmpdir())+sep)&&root.split(sep).at(-1)?.startsWith('construction-tidb-plan-'));rmSync(root,{recursive:true,force:true});}
});

import {tidbExpectedSchema,matchesTidbSchema} from '../../src/server/db/tidb-schema';
import {applicationDatabaseProvider} from '../../src/server/db/application';
test('Cloud activation is explicit and bound to the reviewed complete schema',()=>{
 const plan=buildTidbSchemaPlan();assert.equal(plan.version,tidbExpectedSchema.version);assert.equal(plan.fingerprint,tidbExpectedSchema.fingerprint);
 assert(matchesTidbSchema([{id:plan.version,plan_sha256:plan.fingerprint}]));
 for(const rows of [[],[{id:plan.version,plan_sha256:'0'.repeat(64)}],[{id:'old',plan_sha256:plan.fingerprint}],[{id:plan.version,plan_sha256:plan.fingerprint},{id:plan.version,plan_sha256:plan.fingerprint}]])assert(!matchesTidbSchema(rows));
 assert.equal(applicationDatabaseProvider({}),'local-mysql');assert.equal(applicationDatabaseProvider({DATABASE_PROVIDER:'tidb'}),'tidb');
 for(const env of [{DATABASE_PROVIDER:'unknown'},{VERCEL:'1'},{DATABASE_PROVIDER:'tidb',DEMO_MODE:'1'}])assert.throws(()=>applicationDatabaseProvider(env));
});
