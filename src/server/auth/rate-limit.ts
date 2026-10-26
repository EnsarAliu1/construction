import type { Connection, RowDataPacket } from "mysql2/promise";
import { tokenDigest } from "./security";
import { transaction } from "./store";

/** Database-backed admission counters shared by all application instances. */
export async function admitLogin(connection: Connection, email: string) {
  const buckets = [
    { key: tokenDigest("login:global"), limit: 60, seconds: 60 },
    { key: tokenDigest(`login:email:${email}`), limit: 5, seconds: 900 },
  ].sort((a, b) => a.key.localeCompare(b.key));
  return transaction(connection, async () => {
    let allowed = true;
    for (const bucket of buckets) {
      await connection.execute("INSERT INTO auth_login_limits (bucket_key, attempt_count, window_ends_at) VALUES (?, 1, DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND)) ON DUPLICATE KEY UPDATE attempt_count = IF(window_ends_at <= UTC_TIMESTAMP(3), 1, LEAST(attempt_count + 1, ?)), window_ends_at = IF(window_ends_at <= UTC_TIMESTAMP(3), DATE_ADD(UTC_TIMESTAMP(3), INTERVAL ? SECOND), window_ends_at)",
        [bucket.key, bucket.seconds, bucket.limit + 1, bucket.seconds]);
      const [rows] = await connection.execute<RowDataPacket[]>("SELECT attempt_count FROM auth_login_limits WHERE bucket_key = ?", [bucket.key]);
      if (Number(rows[0].attempt_count) > bucket.limit) allowed = false;
    }
    return allowed;
  });
}
