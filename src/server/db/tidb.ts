import {createHash} from 'node:crypto';
import {grantsMatchTidbProfile} from './tidb-privileges';
import {createConnection,type Connection,type ConnectionOptions,type RowDataPacket} from 'mysql2/promise';

type Environment=Record<string,string|undefined>;
export type TidbPurpose='application'|'operator'|'reporting';
const contexts=new WeakMap<Connection,{env:Environment;identity:string;purpose:TidbPurpose}>();
export class TidbConfigurationError extends Error {
 constructor(){super('TiDB configuration or secure connection validation failed; credentials withheld.');}
}

/** Separate Cloud adapter. It does not load .env files or replace the local MySQL path. */
export function tidbOptions(env:Environment,purpose:TidbPurpose):ConnectionOptions{
 const host=env.DB_HOST?.trim(),database=env.DB_DATABASE?.trim(),user=env.DB_USERNAME?.trim(),password=env.DB_PASSWORD;
 if(!host||!/^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.tidbcloud\.com$/i.test(host)||Number(env.DB_PORT)!==4000||!database||!/^[a-z][a-z0-9_]{0,63}$/i.test(database)||!user||!/^[a-z0-9_-]+\.[a-z0-9_-]+$/i.test(user)||!password||/^(?:<.*>|your_password|changeme)$/i.test(password))throw new TidbConfigurationError();
 if(!['operator','application','reporting'].includes(purpose)||purpose!=='operator'&&user.split('.').at(-1)?.toLowerCase()==='root')throw new TidbConfigurationError();
 return {host:host.toLowerCase(),port:4000,user,password,database,ssl:{rejectUnauthorized:true,verifyIdentity:true,minVersion:'TLSv1.2'},charset:'utf8mb4_0900_ai_ci',timezone:'Z',dateStrings:true,decimalNumbers:false,supportBigNumbers:true,bigNumberStrings:true,multipleStatements:false,connectTimeout:10000};
}

/** Starter gateways are shared: tenant prefix, endpoint and schema jointly bind the store. */
export function tidbStorageIdentity(options:ConnectionOptions){
 if(!options.host||!options.user||!options.database)throw new TidbConfigurationError();
 const prefix=options.user.split('.')[0];
 return 'tidb/'+createHash('sha256').update(`${options.host}:4000/${prefix}/${options.database}`).digest('hex');
}

export async function connectTidb(env:Environment,purpose:TidbPurpose){
 const options=tidbOptions(env,purpose);
 let connection:Awaited<ReturnType<typeof createConnection>>|undefined;
 try{
  connection=await createConnection(options);
  const [versions]=await connection.query<RowDataPacket[]>('SELECT VERSION() AS version');
  const version=String(versions[0]?.version??'');
  if(!/^8\.0\.\d+-TiDB-v8\.5\.\d+-serverless$/.test(version))throw new TidbConfigurationError();
  await connection.query("SET SESSION time_zone='+00:00', SESSION tidb_txn_mode='pessimistic', SESSION sql_mode='STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
  const [settings]=await connection.query<RowDataPacket[]>("SHOW GLOBAL VARIABLES LIKE 'tidb_enable_check_constraint'");
  if(settings[0]?.Value!=='ON')throw new TidbConfigurationError();
  const [session]=await connection.query<RowDataPacket[]>('SELECT @@session.time_zone AS zone,@@session.tidb_txn_mode AS mode,@@session.sql_mode AS sql_mode');
  const modes=String(session[0]?.sql_mode??'').split(',');
  if(session[0]?.zone!=='+00:00'||session[0]?.mode!=='pessimistic'||!modes.includes('STRICT_ALL_TABLES'))throw new TidbConfigurationError();
  // TiDB's @@server_uuid can be all-zero; derive stable store ownership without credentials.
  const identity=tidbStorageIdentity(options);
  const saved:Environment={};
  for(const key of ['DB_HOST','DB_PORT','DB_DATABASE','DB_USERNAME','DB_PASSWORD','DB_REPORT_USERNAME','DB_REPORT_PASSWORD'])saved[key]=env[key];
  contexts.set(connection,{env:saved,identity,purpose});
  return {connection,version,identity,close:()=>{contexts.delete(connection!);return connection!.end();}};
 }catch{
  await connection?.end().catch(()=>{});
  throw new TidbConfigurationError();
 }
}

/** Roles and unrecognized/wider capabilities are rejected, including inherited writer roles. */
export function validateReportingGrants(grants:unknown[],database:string){
 if(!grantsMatchTidbProfile(grants,database,'reporting',false))throw new TidbConfigurationError();
}
export function validateRuntimeGrants(grants:unknown[],database:string){
 if(!grantsMatchTidbProfile(grants,database,'runtime'))throw new TidbConfigurationError();
}
export function tidbConnectionPurpose(connection:Connection){return contexts.get(connection)?.purpose;}

export function isTidbConnection(connection:Connection){return contexts.has(connection);}
export function tidbConnectionIdentity(connection:Connection){return contexts.get(connection)?.identity;}

/** New physical connection: SQL permissions enforce read-only behavior on TiDB. */
export async function openTidbReportingConnection(source:Connection){
 const context=contexts.get(source);
 if(!context)throw new TidbConfigurationError();
 const env:Environment={...context.env,DB_USERNAME:context.env.DB_REPORT_USERNAME,DB_PASSWORD:context.env.DB_REPORT_PASSWORD};
 // Validate tenant binding before opening a connection to any other schema or tenant.
 if(tidbStorageIdentity(tidbOptions(env,'reporting'))!==context.identity)throw new TidbConfigurationError();
 const reader=await connectTidb(env,'reporting');
 try{
  const [rows]=await reader.connection.query<RowDataPacket[]>('SHOW GRANTS');
  validateReportingGrants(rows.map(row=>Object.values(row)[0]),String(env.DB_DATABASE));
  return reader;
 }catch{
  await reader.close().catch(()=>{});
  throw new TidbConfigurationError();
 }
}
