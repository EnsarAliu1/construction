import "server-only";
import { drizzle } from "drizzle-orm/mysql2";
import { loadLocalEnvironment, localDatabaseOptions, openLocalConnection } from "./config";
import * as schema from "./schema";

/** Lazy and explicitly closed: importing a page or building Next.js never connects. */
export async function connectDatabase() {
  loadLocalEnvironment();
  const client = await openLocalConnection(localDatabaseOptions(process.env.DATABASE_URL, "development", process.env.DATABASE_DISPOSABLE));
  return { db: drizzle({ client, schema, mode: "default" }), close: () => client.end() };
}
