import type {Connection,RowDataPacket} from 'mysql2/promise';
import {isTidbConnection} from '../db/tidb';

// SQL identifiers and lock clauses are fixed server constants, never caller input.
export const authUsers=(c:Connection)=>isTidbConnection(c)?'auth_users':'users';
export const authReadLock=(c:Connection)=>isTidbConnection(c)?'':'FOR UPDATE';
export function authenticationVersion(value:unknown){
 if(typeof value!=='number'&&!(typeof value==='string'&&/^\d{1,10}$/.test(value)))throw new Error('Invalid authentication generation.');
 const version=Number(value);
 if(!Number.isInteger(version)||version<1||version>4294967295)throw new Error('Invalid authentication generation.');
 return version;
}
/** TiDB expressions may expose integer results as strings; preserve the existing numeric contract. */
export async function authUserQuery(c:Connection,query:string,values:Parameters<Connection['execute']>[1]){
 const result=await c.execute<RowDataPacket[]>(query,values);
 for(const row of result[0])for(const key of ['auth_version','authVersion'])if(Object.hasOwn(row,key))row[key]=authenticationVersion(row[key]);
 return result;
}
/** Caller owns an authentication transaction; TiDB reads its view at READ COMMITTED after this lock. */
export async function lockAuthUser(c:Connection,id:string){
 if(isTidbConnection(c))await c.execute('SELECT id FROM users WHERE id=? FOR UPDATE',[id]);
}
/** Called within the existing user-first authentication transaction. No HTTP entry point. */
export async function advanceAuthVersion(c:Connection,id:string){
 if(!isTidbConnection(c)){
  await c.execute('UPDATE users SET auth_version=auth_version+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?',[id]);return;
 }
 const [base]=await c.execute<RowDataPacket[]>('SELECT auth_version FROM users WHERE id=? FOR UPDATE',[id]);
 if(!base[0])throw new Error('Authentication identity unavailable.');
 const [latest]=await c.execute<RowDataPacket[]>('SELECT auth_version FROM auth_user_versions WHERE user_id=? ORDER BY auth_version DESC LIMIT 1 FOR UPDATE',[id]);
 const current=Math.max(authenticationVersion(base[0].auth_version),latest[0]?authenticationVersion(latest[0].auth_version):1);
 if(current===4294967295)throw new Error('Authentication generation exhausted.');
 await c.execute('INSERT INTO auth_user_versions(user_id,auth_version) VALUES(?,?)',[id,current+1]);
}
