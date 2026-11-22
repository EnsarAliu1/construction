import "server-only";
import {drizzle} from 'drizzle-orm/mysql2';
import {openApplicationConnection} from './application';
import * as schema from './schema';

/** Lazy and explicitly closed: importing a page or building Next.js never connects. */
export async function connectDatabase(){
 const source=await openApplicationConnection();
 return {db:drizzle({client:source.connection,schema,mode:'default'}),close:source.close};
}
