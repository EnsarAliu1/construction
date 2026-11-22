import assert from 'node:assert/strict';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import type {RowDataPacket} from 'mysql2/promise';
import {getTableConfig} from 'drizzle-orm/mysql-core';
import * as schema from '../../src/server/db/schema';
import {connectTidb,validateRuntimeGrants,validateReportingGrants} from '../../src/server/db/tidb';
import {tidbGrantStatements,tidbActivationBlockers} from '../../src/server/db/tidb-privileges';
import {buildTidbSchemaPlan,installTidbSchema} from './schema';
import {advanceAuthVersion,authUserQuery} from '../../src/server/auth/user-version';
import {transaction} from '../../src/server/auth/store';
import {listPasskeys,beginPasskeyRegistration} from '../../src/server/auth/passkeys';
import {createAccount,resetAccountPassword,revokeAccountSessions,setAccountActive} from '../../src/server/auth/accounts';
import {authenticateOperator} from '../../src/server/auth/operator';
import {login} from '../../src/server/auth/login';
import {startEnrollment,proveEnrollment,acknowledgeCodes,verifyMfa,resetMfa} from '../../src/server/auth/mfa';
import {authenticator} from '../../src/server/auth/mfa-crypto';
import {sessionUser} from '../../src/server/auth/sessions';
import {normalizeSqlType} from '../../tests/db/schema-inspection';

let stage='operator_connection';
const denied=(error:unknown)=>error instanceof Error&&/privilege|denied/i.test(error.message);
const violated=(error:unknown)=>error instanceof Error&&/check constraint|constraint.*violat/i.test(error.message);
/** Entire adapted schema and grants in one disposable Cloud database. No production .env is loaded. */
async function main(){
 const env=parseEnv(readFileSync('.env.tidb-test.local','utf8')),plan=buildTidbSchemaPlan();
 const owner=await connectTidb(env,'operator');
 const database='construction_schema_probe_'+randomBytes(6).toString('hex');
 const prefix=String(env.DB_USERNAME).split('.')[0];
 const accounts:{name:string;password:string}[]=[];
 const clients:Awaited<ReturnType<typeof connectTidb>>[]=[];
 const environmentKeys=['ADORE_OPERATOR_KEY','MFA_ENCRYPTION_KEY_ID','MFA_ENCRYPTION_KEYS','AUTH_ORIGIN'] as const;
 const prior=Object.fromEntries(environmentKeys.map(key=>[key,process.env[key]]));
 let created=false;
 let result:Record<string,unknown>|undefined;
 try{
  stage='schema_installation';
  await owner.connection.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`);created=true;
  const setup=await connectTidb({...env,DB_DATABASE:database},'operator');clients.push(setup);
  await installTidbSchema(setup.connection,plan);
  await assert.rejects(installTidbSchema(setup.connection,plan),/new empty database/);
  stage='schema_metadata';
  const [objects]=await setup.connection.query<RowDataPacket[]>('SELECT TABLE_NAME AS name,TABLE_TYPE AS kind FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  assert.deepEqual(objects.filter(o=>o.kind==='BASE TABLE').map(o=>o.name).sort(),[...plan.physicalTables,'construction_schema_manifest'].sort());
  assert.deepEqual(objects.filter(o=>o.kind==='VIEW').map(o=>o.name).sort(),[...plan.views].sort());
  const [columns]=await setup.connection.query<RowDataPacket[]>('SELECT TABLE_NAME AS table_name,COLUMN_NAME AS name,COLUMN_TYPE AS type,IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE()');
  const [foreignKeys]=await setup.connection.query<RowDataPacket[]>("SELECT k.TABLE_NAME AS table_name,k.COLUMN_NAME AS column_name,k.REFERENCED_TABLE_NAME AS parent,k.REFERENCED_COLUMN_NAME AS parent_column,r.DELETE_RULE AS delete_rule,r.UPDATE_RULE AS update_rule FROM information_schema.KEY_COLUMN_USAGE k JOIN information_schema.REFERENTIAL_CONSTRAINTS r ON r.CONSTRAINT_SCHEMA=k.CONSTRAINT_SCHEMA AND r.CONSTRAINT_NAME=k.CONSTRAINT_NAME AND r.TABLE_NAME=k.TABLE_NAME WHERE k.TABLE_SCHEMA=DATABASE()");
  const [indexes]=await setup.connection.query<RowDataPacket[]>('SELECT TABLE_NAME AS table_name,INDEX_NAME AS name,NON_UNIQUE AS non_unique,COLUMN_NAME AS column_name,SEQ_IN_INDEX AS position FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE()');
  let verifiedColumns=0,verifiedForeignKeys=0;
  for(const table of Object.values(schema).map(getTableConfig)){
   if(['payment_receipts','receipt_versions','receipt_counters'].includes(table.name))continue;
   const actual=columns.filter(c=>c.table_name===table.name);assert.equal(actual.length,table.columns.length);
   for(const column of table.columns){
    const found=actual.find(c=>c.name===column.name);assert(found);
    assert.equal(normalizeSqlType(found.type),normalizeSqlType(column.getSQLType()));assert.equal(found.nullable,column.notNull?'NO':'YES');verifiedColumns++;
    if(column.primary||column.isUnique)assert(indexes.some(i=>i.table_name===table.name&&i.column_name===column.name&&Number(i.non_unique)===0));
   }
   for(const fk of table.foreignKeys){
    const reference=fk.reference();
    for(const [i,column] of reference.columns.entries()){
     assert(foreignKeys.some(f=>f.table_name===table.name&&f.column_name===column.name&&f.parent===getTableConfig(reference.foreignTable).name&&f.parent_column===reference.foreignColumns[i].name&&f.delete_rule==='RESTRICT'&&f.update_rule==='RESTRICT'));verifiedForeignKeys++;
    }
   }
  }
  const [views]=await setup.connection.query<RowDataPacket[]>("SELECT SECURITY_TYPE AS security_type FROM information_schema.VIEWS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME='payment_receipts'");
  assert.equal(views[0].security_type,'INVOKER');
  stage='sql_profiles';
  for(const profile of ['runtime','reporting'] as const){
   const account={name:prefix+'.'+(profile==='runtime'?'a_':'r_')+randomBytes(4).toString('hex'),password:randomBytes(32).toString('hex')};
   await owner.connection.query('CREATE USER ?@? IDENTIFIED BY ?',[account.name,'%',account.password]);accounts.push(account);
   for(const statement of tidbGrantStatements(database,profile))await setup.connection.query(statement,[account.name,'%']);
  }
  const runtime=await connectTidb({...env,DB_DATABASE:database,DB_USERNAME:accounts[0].name,DB_PASSWORD:accounts[0].password},'application');clients.push(runtime);
  const reader=await connectTidb({...env,DB_DATABASE:database,DB_USERNAME:accounts[1].name,DB_PASSWORD:accounts[1].password},'reporting');clients.push(reader);
  const [runtimeGrants]=await runtime.connection.query<RowDataPacket[]>('SHOW GRANTS');validateRuntimeGrants(runtimeGrants.map(row=>Object.values(row)[0]),database);
  const [readerGrants]=await reader.connection.query<RowDataPacket[]>('SHOW GRANTS');validateReportingGrants(readerGrants.map(row=>Object.values(row)[0]),database);
  let deniedOperations=0;
  const no=async(statement:string)=>{await assert.rejects(runtime.connection.query(statement),denied);deniedOperations++;};
  for(const table of ['audit_events','entity_versions','receipt_versions','payment_receipt_identities','payment_receipt_states']){
   await no(`UPDATE \`${table}\` SET id=id WHERE 1=0`);await no(`DELETE FROM \`${table}\` WHERE 1=0`);
  }
  for(const table of ['payments','expenses','contracts','contract_phases','payment_allocations']){
   await no(`DELETE FROM \`${table}\` WHERE 1=0`);
   await runtime.connection.query(`UPDATE \`${table}\` SET version=version WHERE 1=0`);
  }
  for(const statement of ['UPDATE users SET auth_version=auth_version+1 WHERE 1=0','UPDATE users SET password_hash=password_hash WHERE 1=0','UPDATE users SET status=status WHERE 1=0','INSERT INTO users SELECT * FROM users WHERE 1=0','DELETE FROM users WHERE 1=0','UPDATE auth_account_control SET scope=scope','ALTER TABLE payments ADD COLUMN forbidden INT','SELECT * FROM construction_compat_probe.receipt_probe'])await no(statement);
  await runtime.connection.query('DELETE FROM auth_passkey_challenges WHERE expires_at<UTC_TIMESTAMP(3)');
  await no('UPDATE auth_user_versions SET auth_version=auth_version WHERE 1=0');await no('DELETE FROM auth_user_versions WHERE 1=0');
  for(const statement of ['SELECT * FROM auth_users','SELECT * FROM auth_user_versions','SELECT * FROM auth_mfa_factors','SELECT * FROM auth_sessions','UPDATE payments SET amount=amount WHERE 1=0','SELECT * FROM construction_compat_probe.receipt_probe'])await assert.rejects(reader.connection.query(statement),denied);
  stage='checks_and_view';
  await runtime.connection.query("INSERT INTO receipt_counters(scope,next_number) VALUES('company',1)");
  await assert.rejects(runtime.connection.query("UPDATE receipt_counters SET next_number=0 WHERE scope='company'"),violated);
  await assert.rejects(runtime.connection.execute("INSERT INTO audit_events(id,entity_type,entity_id,action,after_snapshot) VALUES(?,?,?,? ,?)",[randomUUID(),'client',randomUUID(),'test',JSON.stringify({passwordHash:'synthetic'})]),violated);
  for(const table of plan.views)await (table==='auth_users'?runtime:reader).connection.query(`SELECT * FROM \`${table}\` LIMIT 1`);
  console.log(JSON.stringify({schemaAndSqlProfilesVerified:true,mfaVerificationStarting:true}));
  stage='mfa_enrollment';
  process.env.ADORE_OPERATOR_KEY=randomBytes(32).toString('hex');process.env.MFA_ENCRYPTION_KEY_ID='tidb-probe';process.env.MFA_ENCRYPTION_KEYS=JSON.stringify({'tidb-probe':randomBytes(32).toString('base64')});process.env.AUTH_ORIGIN='https://example.invalid';
  const operator=authenticateOperator(process.env.ADORE_OPERATOR_KEY),password=randomBytes(32).toString('hex'),email=randomUUID()+'@example.invalid';
  const user=await createAccount(setup.connection,operator,{email,displayName:'Synthetic schema user',password,active:true});
  const begin=async(connection=runtime.connection)=>{const value=await login(connection,email,password);assert(value.ok);if(!value.ok)throw new Error('Synthetic password challenge failed.');return value;};
  const clearLimits=()=>setup.connection.query('UPDATE auth_login_limits SET window_ends_at=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 SECOND)');
  const challenge=await begin();assert.equal(await sessionUser(runtime.connection,challenge.token),null);
  const enrollment=await startEnrollment(runtime.connection,challenge.token);assert(enrollment.ok&&enrollment.seed);
  if(!enrollment.seed)throw new Error('Synthetic enrollment unavailable.');
  const proof=await proveEnrollment(runtime.connection,challenge.token,authenticator(enrollment.seed).generate());assert(proof.ok&&proof.codes);
  const enrolled=await acknowledgeCodes(runtime.connection,challenge.token,'saved');assert(enrolled.ok&&enrolled.token);
  assert.equal((await sessionUser(runtime.connection,enrolled.token))?.id,user);
  const [generation]=await authUserQuery(runtime.connection,'SELECT auth_version FROM auth_users WHERE id=?',[user]);assert.equal(generation[0].auth_version,2);
  stage='mfa_totp_and_replay';
  const next=await begin(),code=authenticator(enrollment.seed).generate({timestamp:Date.now()+30000});
  const verified=await verifyMfa(runtime.connection,next.token,code);assert(verified.ok&&verified.token);
  const replay=await begin();assert.equal((await verifyMfa(runtime.connection,replay.token,code)).ok,false);
  assert.deepEqual(await listPasskeys(runtime.connection,verified.token),[]);
  assert((await beginPasskeyRegistration(runtime.connection,verified.token)).token);
  stage='mfa_recovery_concurrency';
  await clearLimits();
  const peer=await connectTidb({...env,DB_DATABASE:database,DB_USERNAME:accounts[0].name,DB_PASSWORD:accounts[0].password},'application');clients.push(peer);
  const [one,two]=await Promise.all([begin(),begin(peer.connection)]);
  const outcomes=await Promise.all([verifyMfa(runtime.connection,one.token,proof.codes[0],true),verifyMfa(peer.connection,two.token,proof.codes[0],true)]);
  assert.equal(outcomes.filter(value=>value.ok).length,1,'recovery code must be single-use across physical connections');
  stage='mfa_generation_concurrency';
  const [beforeGeneration]=await authUserQuery(runtime.connection,'SELECT auth_version FROM auth_users WHERE id=?',[user]);
  await Promise.all([runtime.connection,peer.connection].map(connection=>transaction(connection,()=>advanceAuthVersion(connection,user))));
  const [afterGeneration]=await authUserQuery(runtime.connection,'SELECT auth_version FROM auth_users WHERE id=?',[user]);
  assert.equal(afterGeneration[0].auth_version,beforeGeneration[0].auth_version+2);
  // Generation comparison must reject old sessions even without their revoked_at being updated.
  assert.equal(await sessionUser(runtime.connection,enrolled.token),null);assert.equal(await sessionUser(runtime.connection,verified.token),null);
  assert.equal((await verifyMfa(runtime.connection,replay.token,proof.codes[1],true)).ok,false);
  stage='mfa_operator_recovery';
  await clearLimits();
  const pending=await begin();
  await revokeAccountSessions(setup.connection,operator,email);
  assert.equal((await verifyMfa(runtime.connection,pending.token,proof.codes[1],true)).ok,false);
  await resetMfa(setup.connection,operator,email,{identityVerified:true,confirmation:'reset-mfa',reason:'verified-device-replacement'});
  await clearLimits();
  const renewed=await begin();assert.equal(renewed.state,'enroll');
  const renewedSetup=await startEnrollment(runtime.connection,renewed.token);assert(renewedSetup.ok&&renewedSetup.seed);
  const renewedProof=await proveEnrollment(runtime.connection,renewed.token,authenticator(renewedSetup.seed).generate());assert(renewedProof.ok&&renewedProof.codes);
  const renewedSession=await acknowledgeCodes(runtime.connection,renewed.token,'saved');assert(renewedSession.ok&&renewedSession.token);
  assert.equal((await sessionUser(runtime.connection,renewedSession.token))?.id,user);
  await setAccountActive(setup.connection,operator,email,false);assert.equal(await sessionUser(runtime.connection,renewedSession.token),null);
  await setAccountActive(setup.connection,operator,email,true);
  const replacement=randomBytes(32).toString('hex');await resetAccountPassword(setup.connection,operator,email,replacement);
  await clearLimits();assert.equal((await login(runtime.connection,email,password)).ok,false);
  const changed=await login(runtime.connection,email,replacement);assert(changed.ok);
  if(!changed.ok)throw new Error('Synthetic replacement password challenge failed.');
  const final=await verifyMfa(runtime.connection,changed.token,renewedProof.codes[0],true);assert(final.ok&&final.token);
  assert.equal((await sessionUser(runtime.connection,final.token))?.id,user);
  stage='mfa_history_immutability';
  await assert.rejects(runtime.connection.execute('UPDATE users SET password_hash=? WHERE id=?',['synthetic-denied',user]),denied);
  await assert.rejects(runtime.connection.query('DELETE FROM auth_user_versions'),denied);
  await assert.rejects(runtime.connection.query('UPDATE auth_user_versions SET auth_version=1'),denied);
  result={schemaFingerprint:plan.fingerprint,sourceMigrations:plan.sources.length,ddlStatements:plan.statements.length,physicalApplicationTables:plan.physicalTables.length,views:plan.views.length,verifiedColumns,verifiedForeignKeys,deniedRuntimeOperations:deniedOperations,reportingIsolation:true,enforcedChecks:true,refusesNonemptySchema:true,mfaLoginVerified:true,totpReplayDenied:true,recoverySingleUse:true,concurrentGenerations:true,operatorRecoveryVerified:true,passwordResetAndDeactivationVerified:true,passkeyOptionsVerified:true,activationAllowed:false,blockers:tidbActivationBlockers,syntheticOnly:true};
 }finally{
  for(const key of environmentKeys){if(prior[key]===undefined)delete process.env[key];else process.env[key]=prior[key];}
  const closed=await Promise.allSettled(clients.map(client=>client.close()));
  try{
   const dropped=await Promise.allSettled(accounts.map(account=>owner.connection.query('DROP USER ?@?',[account.name,'%'])));
   assert(dropped.every(item=>item.status==='fulfilled'),'Temporary SQL user cleanup failed.');
  }finally{
   try{assert.match(database,/^construction_schema_probe_[a-f0-9]{12}$/);if(created)await owner.connection.query(`DROP DATABASE \`${database}\``);}
   finally{await owner.close();}
  }
  assert(closed.every(item=>item.status==='fulfilled'),'Temporary connections did not close cleanly.');
 }
 assert(result);
 writeFileSync('docs/tidb-schema-verification.json',JSON.stringify({...result,temporaryObjectsRemoved:true},null,2)+'\n');
 console.log(JSON.stringify({...result,temporaryObjectsRemoved:true}));
}
void main().catch(error=>{console.error(JSON.stringify({failedStage:stage,errorType:error instanceof Error?error.name:'unknown',code:/^[A-Z_0-9]+$/.test(String(error?.code))?error.code:undefined,location:error instanceof Error?error.stack?.match(/verify-schema\.ts:\d+:\d+/)?.[0]:undefined,credentialsWithheld:true}));process.exitCode=1;});
