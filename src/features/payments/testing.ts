import type { Connection, RowDataPacket } from "mysql2/promise";
import { assertSupportedMySql, localDatabaseOptions } from "@/server/db/config";
import { requireSessionUser } from "@/server/auth/sessions";
import type { ReceiptBoundary } from "./service";
/** Never imported by routes/UI. Explicit capability for synthetic integration fixtures only. */
export async function isolatedPaymentBoundary(c:Connection,token:string|undefined):Promise<ReceiptBoundary>{
  await requireSessionUser(c,token);
  const expected=localDatabaseOptions(process.env.TEST_DATABASE_URL,"test",process.env.DATABASE_DISPOSABLE);
  if(c.config.host!==expected.host||c.config.port!==expected.port||c.config.database!==expected.database)throw new Error("Payment test capability requires the configured disposable test connection.");
  const [rows]=await c.query<RowDataPacket[]>("SELECT DATABASE() AS name,VERSION() AS version");assertSupportedMySql(String(rows[0].version));
  if(rows[0].name!==expected.database)throw new Error("Payment test database mismatch.");
  return {mode:"isolated-test",async apply(){}};
}
