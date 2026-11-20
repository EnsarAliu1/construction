import "server-only";
import { drizzle } from "drizzle-orm/mysql2";
import { loadLocalEnvironment, localDatabaseOptions, openLocalConnection } from "./config";
import * as schema from "./schema";
import {demoMode} from '../demo/policy';

/** Lazy and explicitly closed: importing a page or building Next.js never connects. */
export async function connectDatabase() {
  if(!demoMode())loadLocalEnvironment();
  const client = demoMode() ? await (await import('../demo/runtime')).openDemoConnection() : await openLocalConnection(localDatabaseOptions(process.env.DATABASE_URL, "development", process.env.DATABASE_DISPOSABLE));
  return { db: drizzle({ client, schema, mode: "default" }), close: () => client.end() };
}
