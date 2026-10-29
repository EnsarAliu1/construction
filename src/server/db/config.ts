import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { createConnection, type Connection, type ConnectionOptions, type RowDataPacket } from "mysql2/promise";

export function loadLocalEnvironment() {
  // Match Next's priority outside Next (CLI/migrations), preserving explicit process values.
  const mode=process.env.NODE_ENV??"development";
  for(const file of [`.env.${mode}.local`,...(mode==="test"?[]:[".env.local"]),`.env.${mode}`,".env"]){
    if(existsSync(file))loadEnvFile(file);
  }
}

export function localDatabaseOptions(value: string | undefined, purpose: "development" | "test", disposable: string | undefined): ConnectionOptions {
  if (disposable !== "1") throw new Error("Set DATABASE_DISPOSABLE=1 only for an explicitly disposable local database");
  if (!value) throw new Error(purpose === "test" ? "TEST_DATABASE_URL is required" : "DATABASE_URL is required");
  let url: URL;
  try { url = new URL(value); } catch { throw new Error("Invalid database URL (value withheld)"); }
  if (url.protocol !== "mysql:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || url.search || url.hash) {
    throw new Error("Only direct loopback MySQL URLs without query parameters are allowed");
  }
  const database = url.pathname.slice(1);
  const pattern = purpose === "test" ? /^fitimi_test_[a-z0-9_]+$/ : /^fitimi_(dev|test)_[a-z0-9_]+$/;
  if (!pattern.test(database) || database.length > 64 || !url.username) {
    throw new Error("Use a named disposable fitimi_dev_* or fitimi_test_* database; tests require fitimi_test_*");
  }
  try {
    return {
      host: url.hostname === "[::1]" ? "::1" : url.hostname,
      port: url.port ? Number(url.port) : 3306,
      user: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password),
      database,
      charset: "utf8mb4_0900_ai_ci",
      timezone: "Z",
      dateStrings: true,
      decimalNumbers: false,
      supportBigNumbers: true,
      bigNumberStrings: true,
      multipleStatements: false,
      connectTimeout: 5_000,
    };
  } catch {
    throw new Error("Invalid database connection settings (values withheld)");
  }
}

export function assertSupportedMySql(version: string) {
  if (!/^8\.4\./.test(version) || /mariadb/i.test(version)) {
    throw new Error("This package targets MySQL 8.4 LTS; other database engines/versions are not verified");
  }
}

export async function openLocalConnection(options: ConnectionOptions): Promise<Connection> {
  let connection: Connection | undefined;
  try {
    connection = await createConnection(options);
    const [rows] = await connection.query<RowDataPacket[]>("SELECT VERSION() AS version");
    assertSupportedMySql(String(rows[0].version));
    await connection.query("SET SESSION time_zone = '+00:00'");
    await connection.query("SET SESSION default_storage_engine = 'InnoDB'");
    await connection.query("SET SESSION sql_mode = 'STRICT_ALL_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'");
    return connection;
  } catch (error) {
    await connection?.end();
    // Connection exceptions can contain host/user details. Never echo their payloads.
    const code = error && typeof error === "object" && "code" in error ? String(error.code) : "CONFIGURATION";
    throw new Error(`Local MySQL connection/session initialization failed (${code}); verify MySQL 8.4 and local settings`);
  }
}
