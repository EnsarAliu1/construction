import { loadLocalEnvironment, localDatabaseOptions, openLocalConnection } from "../src/server/db/config";
import { applyMigrations } from "../src/server/db/migrate";

async function main() {
  loadLocalEnvironment();
  const options = localDatabaseOptions(process.env.DATABASE_URL, "development", process.env.DATABASE_DISPOSABLE);
  const client = await openLocalConnection(options);
  try {
    await applyMigrations(client);
    console.log("Local disposable MySQL migrations applied successfully.");
  } finally { await client.end(); }
}

main().catch(() => {
  // SQL errors can contain fixture or connection values. Keep console output safe.
  console.error("Migration failed. Verify disposable local settings and migration state; no automatic reset was attempted.");
  process.exitCode = 1;
});
