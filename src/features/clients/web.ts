import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Connection } from "mysql2/promise";
import { AuthenticationRequired, sessionCookieSettings } from "@/server/auth/security";
import { withAuthConnection } from "@/server/auth/store";
import { requirePageUser } from "@/server/auth/web";
import { ClientNotFound } from "./validation";

export async function clientPageData<T>(returnTo: string, work: (connection: Connection, token: string | undefined) => Promise<T>) {
  await requirePageUser(returnTo);
  const token = (await cookies()).get(sessionCookieSettings().name)?.value;
  try { return await withAuthConnection(connection => work(connection, token)); }
  catch (error) {
    if (error instanceof AuthenticationRequired) redirect(`/login?returnTo=${encodeURIComponent(returnTo)}`);
    if (error instanceof ClientNotFound) notFound();
    // Keep raw database exceptions, including search parameters, out of RSC logs.
    throw new Error("Client records are temporarily unavailable. Please retry.");
  }
}
