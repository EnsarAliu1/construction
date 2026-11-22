import {drizzle} from 'drizzle-orm/mysql2';
import type {Connection} from 'mysql2/promise';
import {isTidbConnection,openTidbReportingConnection} from './tidb';

type Database=ReturnType<typeof drizzle>;
export type ReadSnapshotTransaction=Parameters<Parameters<Database['transaction']>[0]>[0];

/** MySQL retains READ ONLY. TiDB uses a separately verified SELECT-only principal. */
export async function withReadSnapshot<T>(source:Connection,work:(tx:ReadSnapshotTransaction)=>Promise<T>):Promise<T>{
 if(!isTidbConnection(source))return drizzle(source).transaction(work,{isolationLevel:'repeatable read',accessMode:'read only'});
 const reader=await openTidbReportingConnection(source);
 try{return await drizzle(reader.connection).transaction(work,{isolationLevel:'repeatable read'});}
 finally{await reader.close();}
}
