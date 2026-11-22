import {eq} from 'drizzle-orm';
import type {Connection} from 'mysql2/promise';
import type {ReadSnapshotTransaction} from './read-snapshot';
import {users} from './schema';
import {isTidbConnection} from './tidb';
/** TiDB does not enforce FOR SHARE: acquire the supported physical row lock instead. */
export async function lockBusinessUser(tx:ReadSnapshotTransaction,c:Connection,id:string){
 await tx.select({id:users.id}).from(users).where(eq(users.id,id)).for(isTidbConnection(c)?'update':'share');
}
