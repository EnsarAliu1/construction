import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Connection } from "mysql2/promise";
import { AuthenticationRequired, sessionCookieSettings } from "@/server/auth/security";
import { withAuthConnection } from "@/server/auth/store";
import { requirePageUser } from "@/server/auth/web";
import { ProjectError } from "./validation";

export async function projectPageData<T>(path: string, work: (connection: Connection, token: string | undefined) => Promise<T>) {
  await requirePageUser(path); const token = (await cookies()).get(sessionCookieSettings().name)?.value;
  try { return await withAuthConnection(connection => work(connection, token)); }
  catch (error) {
    if (error instanceof AuthenticationRequired) redirect(`/login?returnTo=${encodeURIComponent(path)}`);
    if (error instanceof ProjectError && ["ID", "NOT_FOUND"].includes(error.code)) notFound();
    throw new Error("Projektet janë përkohësisht të padisponueshme. Provoni përsëri.");
  }
}
