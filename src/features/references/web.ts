import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Connection } from "mysql2/promise";
import { AuthenticationRequired, sessionCookieSettings } from "@/server/auth/security";
import { requirePageUser } from "@/server/auth/web";
import { withAuthConnection } from "@/server/auth/store";
import { isReferenceKind, type ReferenceKind } from "./model";
import { ReferenceError } from "./validation";
export async function referencePageData<T>(path: string, value: string, work: (c: Connection, token: string | undefined, kind: ReferenceKind) => Promise<T>) {
  await requirePageUser(path);
  if (!isReferenceKind(value)) notFound();
  const token = (await cookies()).get(sessionCookieSettings().name)?.value;
  try { return await withAuthConnection(c => work(c, token, value)); }
  catch (error) {
    if (error instanceof AuthenticationRequired) redirect(`/login?returnTo=${encodeURIComponent(path)}`);
    if (error instanceof ReferenceError && error.status === 404) notFound();
    throw new Error("Reference records are temporarily unavailable. Please retry.");
  }
}
