import type {RowDataPacket} from 'mysql2/promise';
import {loadLocalEnvironment,localDatabaseOptions,openLocalConnection} from './config';
import {demoMode} from '../demo/policy';
import {connectTidb,tidbOptions,tidbStorageIdentity,TidbConfigurationError,validateRuntimeGrants} from './tidb';
import {matchesTidbSchema} from './tidb-schema';

type Environment=Record<string,string|undefined>;
export function applicationDatabaseProvider(env:Environment){
 const provider=env.DATABASE_PROVIDER?.trim()||'local-mysql';
 if(!['local-mysql','tidb','tidb-demo'].includes(provider)||env.VERCEL==='1'&&provider==='local-mysql'||env.DEMO_MODE==='1'&&provider==='tidb'||provider==='tidb-demo'&&env.DEMO_MODE!=='1')throw new Error('Unsupported application database configuration.');
 return provider as 'local-mysql'|'tidb'|'tidb-demo';
}

/** Explicit Cloud opt-in; main development and isolated local demo retain their original path. */
export async function openApplicationConnection(){
 if(!process.env.DATABASE_PROVIDER&&!demoMode())loadLocalEnvironment();
 const provider=applicationDatabaseProvider(process.env);
 if(demoMode()){
  const connection=await (await import('../demo/runtime')).openDemoConnection();
  return {connection,close:()=>connection.end()};
 }
 if(provider==='local-mysql'){
  loadLocalEnvironment();
  const connection=await openLocalConnection(localDatabaseOptions(process.env.DATABASE_URL,'development',process.env.DATABASE_DISPOSABLE));
  return {connection,close:()=>connection.end()};
 }
 // Validate the reporting tenant before making any application connection.
 const runtime=tidbOptions(process.env,'application');
 const reporting=tidbOptions({...process.env,DB_USERNAME:process.env.DB_REPORT_USERNAME,DB_PASSWORD:process.env.DB_REPORT_PASSWORD},'reporting');
 if(tidbStorageIdentity(runtime)!==tidbStorageIdentity(reporting))throw new TidbConfigurationError();
 const source=await connectTidb(process.env,'application');
 try{
  const [grants]=await source.connection.query<RowDataPacket[]>('SHOW GRANTS');
  validateRuntimeGrants(grants.map(row=>Object.values(row)[0]),String(runtime.database));
  const [manifest]=await source.connection.query<(RowDataPacket&{id:unknown;plan_sha256:unknown})[]>('SELECT id,plan_sha256 FROM construction_schema_manifest');
  if(!matchesTidbSchema(manifest))throw new TidbConfigurationError();
  return {connection:source.connection,close:source.close};
 }catch{
  await source.close().catch(()=>{});
  throw new TidbConfigurationError();
 }
}
