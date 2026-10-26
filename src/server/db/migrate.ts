import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";
import type { Connection, RowDataPacket } from "mysql2/promise";

export async function applyMigrations(connection: Connection) {
  const [rows] = await connection.query<RowDataPacket[]>("SELECT DATABASE() AS name");
  const lock = `fitimi_migrate_${createHash("sha256").update(String(rows[0].name)).digest("hex").slice(0, 32)}`;
  const [locks] = await connection.execute<RowDataPacket[]>("SELECT GET_LOCK(?, 10) AS acquired", [lock]);
  if (Number(locks[0].acquired) !== 1) throw new Error("Could not obtain the local migration lock");
  try {
    const [journal] = await connection.query<RowDataPacket[]>("SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '__drizzle_migrations'");
    if (journal.length) {
      const expected = readMigrationFiles({ migrationsFolder: resolve("drizzle") });
      const [applied] = await connection.query<RowDataPacket[]>("SELECT hash, created_at FROM __drizzle_migrations");
      for (const entry of applied) {
        if (!expected.some(migration => migration.folderMillis === Number(entry.created_at) && migration.hash === entry.hash)) {
          throw new Error("Applied migration checksum mismatch; refusing to continue");
        }
      }
    }
    await migrate(drizzle(connection), { migrationsFolder: resolve("drizzle"), migrationsTable: "__drizzle_migrations" });
  } finally {
    await connection.execute("SELECT RELEASE_LOCK(?)", [lock]);
  }
}
