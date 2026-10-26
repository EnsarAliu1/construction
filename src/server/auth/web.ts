import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { withAuthConnection } from "./store";
import { sessionUser, requireSessionUser } from "./sessions";
import { AuthenticationRequired, safeReturnPath, sessionCookieSettings, validSessionToken } from "./security";

export const currentUser = cache(async () => {
  const token = (await cookies()).get(sessionCookieSettings().name)?.value;
  if (!validSessionToken(token)) return null;
  return withAuthConnection(connection => sessionUser(connection, token));
});

/** Every page/operation uses a server guard; layouts alone are insufficient. */
export async function requirePageUser(returnTo = "/app") {
  let user;
  try { user = await currentUser(); }
  catch { redirect(`/login?unavailable=1&returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`); }
  if (!user) redirect(`/login?returnTo=${encodeURIComponent(safeReturnPath(returnTo))}`);
  return user;
}

export async function requireOperationUser() {
  const token = (await cookies()).get(sessionCookieSettings().name)?.value;
  if (!validSessionToken(token)) throw new AuthenticationRequired();
  return withAuthConnection(connection => requireSessionUser(connection, token));
}
