import "server-only";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Connection } from "mysql2/promise";
import { AuthenticationRequired, sessionCookieSettings } from "@/server/auth/security";
import { requirePageUser } from "@/server/auth/web";
import { withAuthConnection } from "@/server/auth/store";
import { PaymentError } from "./validation";
export async function paymentPageData<T>(path: string, work: (c: Connection, token: string | undefined) => Promise<T>) {
  await requirePageUser(path); const token = (await cookies()).get(sessionCookieSettings().name)?.value;
  try { return await withAuthConnection(c => work(c,token)); }
  catch(error) {
    if (error instanceof AuthenticationRequired) redirect(`/login?returnTo=${encodeURIComponent(path)}`);
    if (error instanceof PaymentError && error.status === 404) notFound();
    throw new Error("Pagesat janë përkohësisht të padisponueshme. Provoni përsëri.");
  }
}
