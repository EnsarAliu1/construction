import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync,writeFileSync} from 'node:fs';
import {parseEnv} from 'node:util';
import {createConnection,type RowDataPacket} from 'mysql2/promise';
import {tidbOptions} from '../../src/server/db/tidb';

let stage='configuration';
/** Read-only prerequisite probe; no DDL, grants, data writes or global settings. */
async function main(){
 const mainEnvironmentHash=createHash('sha256').update(readFileSync('.env.local')).digest('hex');
 const env=parseEnv(readFileSync('.env.demo-tidb.local','utf8'));
 const real=parseEnv(readFileSync('.env.tidb-test.local','utf8'));
 const options=tidbOptions(env,'operator'),realOptions=tidbOptions(real,'operator');
 // Starter gateways are shared. A different database name alone is not isolation.
 stage='separate_instance_namespace';
 assert.notEqual(String(options.user).split('.')[0].toLowerCase(),String(realOptions.user).split('.')[0].toLowerCase(),'Demo requires a different TiDB instance namespace.');
 stage='tls_connection';
 const connection=await createConnection(options);
 let evidence:Record<string,unknown>|undefined;
 try{
  const [versions]=await connection.query<RowDataPacket[]>('SELECT VERSION() AS version');
  const version=String(versions[0]?.version??'');
  stage='engine_version';
  assert(/^8\.0\.\d+-TiDB-v8\.5\.\d+-serverless$/.test(version),'The demo engine requires a compatibility review.');
  const [settings]=await connection.query<RowDataPacket[]>("SHOW GLOBAL VARIABLES LIKE 'tidb_enable_check_constraint'");
  const checkConstraints=settings[0]?.Value==='ON';
  const [schemas]=await connection.query<RowDataPacket[]>('SELECT SCHEMA_NAME AS name FROM information_schema.SCHEMATA');
  const system=new Set(['information_schema','performance_schema','mysql','sys','metrics_schema','test']);
  const customSchemaCount=schemas.filter(row=>!system.has(String(row.name).toLowerCase())).length;
  const [tables]=await connection.query<RowDataPacket[]>('SELECT COUNT(*) AS count FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE()');
  const configuredDatabaseEmpty=Number(tables[0].count)===0;
  stage='schema_inventory';
  assert.equal(customSchemaCount,0,'Unexpected existing schemas require inspection before demo preparation.');
  stage='empty_database';
  assert(configuredDatabaseEmpty,'The configured demo database is not empty.');
  stage='owner_environment';
  assert.equal(createHash('sha256').update(readFileSync('.env.local')).digest('hex'),mainEnvironmentHash);
  evidence={connected:true,version,tlsCertificateAndHostnameVerified:true,separateInstanceNamespace:true,onlyDefaultSchemas:true,configuredDatabaseEmpty,checkConstraintsEnabled:checkConstraints,readOnlyProbe:true,mainEnvironmentUnchanged:true,realDataMigrated:false,readyForDemoPreparation:checkConstraints};
 }finally{await connection.end();}
 assert(evidence);
 writeFileSync('docs/demo-tidb-connection-verification.json',JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify(evidence));
}
void main().catch(error=>{
 const code=error&&typeof error==='object'&&'code' in error&&/^[A-Z_0-9]{1,80}$/.test(String(error.code))?String(error.code):undefined;
 console.error(JSON.stringify({demoConnectionVerified:false,stage,errorType:error instanceof Error?error.name:'unknown',code,credentialsWithheld:true}));
 process.exitCode=1;
});
