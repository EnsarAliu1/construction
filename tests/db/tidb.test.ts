import assert from 'node:assert/strict';
import test from 'node:test';
import {tidbOptions,tidbStorageIdentity,TidbConfigurationError,validateReportingGrants} from '../../src/server/db/tidb';
const fixture={DB_HOST:'gateway01.eu-central-1.prod.aws.tidbcloud.com',DB_PORT:'4000',DB_DATABASE:'construction_test',DB_USERNAME:'synthetic.runtime',DB_PASSWORD:'SYNTHETIC_TEST_PASSWORD_ONLY'};
test('TiDB Cloud options require a dedicated secure configuration and preserve financial precision',()=>{
 const options=tidbOptions(fixture,'application');
 assert.deepEqual(options.ssl,{rejectUnauthorized:true,verifyIdentity:true,minVersion:'TLSv1.2'});
 assert.equal(options.multipleStatements,false);assert.equal(options.decimalNumbers,false);assert.equal(options.bigNumberStrings,true);assert.equal(options.dateStrings,true);assert.equal(options.timezone,'Z');
});
test('untrusted endpoints, credentials, database names and root application connections fail closed without exposing values',()=>{
 for(const change of [{DB_HOST:'localhost'},{DB_HOST:'tidbcloud.com.attacker.invalid'},{DB_HOST:'user:secret@gateway.tidbcloud.com'},{DB_PORT:'3307'},{DB_DATABASE:'construction;DROP TABLE users'},{DB_PASSWORD:''},{DB_PASSWORD:'<your_password>'},{DB_USERNAME:'root'},{DB_USERNAME:'synthetic.root'}]){
  assert.throws(()=>tidbOptions({...fixture,...change},'application'),error=>error instanceof TidbConfigurationError&&!error.message.includes(fixture.DB_PASSWORD));
 }
 assert.doesNotThrow(()=>tidbOptions({...fixture,DB_USERNAME:'synthetic.root'},'operator'));
 assert.throws(()=>tidbOptions({},'application'),TidbConfigurationError);
});

test('shared Cloud gateways cannot conflate tenants; changing SQL users preserves ownership',()=>{
 const identity=(change:Partial<typeof fixture>)=>tidbStorageIdentity(tidbOptions({...fixture,...change},'operator'));
 assert.equal(identity({}),identity({DB_USERNAME:'synthetic.operator'}));
 assert.notEqual(identity({}),identity({DB_USERNAME:'other.runtime'}));
 assert.notEqual(identity({}),identity({DB_DATABASE:'different_database'}));
 assert(!identity({}).includes(fixture.DB_USERNAME));
});

const usage="GRANT USAGE ON *.* TO 'synthetic.reader'@'%'";
const read="GRANT SELECT ON `construction_test`.`clients` TO 'synthetic.reader'@'%'";
test('reporting principals allow only SELECT on explicit business tables in the bound schema',()=>{
 assert.doesNotThrow(()=>validateReportingGrants([usage,read],'construction_test'));
 for(const grants of [[],[usage],[read.replace('SELECT','SELECT, INSERT')],[read+' WITH GRANT OPTION'],[read.replace('`clients`','*')],[read.replace('`construction_test`.`clients`','*.*')],[read.replace('construction_test','other_database')],[read.replace('clients','auth_mfa_factors')],[read,"GRANT `writer_role`@`%` TO `synthetic.reader`@`%`"],[42]])assert.throws(()=>validateReportingGrants(grants,'construction_test'),TidbConfigurationError);
 assert.throws(()=>tidbOptions({...fixture,DB_USERNAME:'synthetic.root'},'reporting'),TidbConfigurationError);
});
