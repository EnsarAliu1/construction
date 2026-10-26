"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertSameOrigin, AuthenticationRequired, sessionCookieSettings } from "@/server/auth/security";
import { withAuthConnection } from "@/server/auth/store";
import { requireSessionUser, revokeSession } from "@/server/auth/sessions";

export async function logoutAction() {
  try { assertSameOrigin(await headers()); }
  catch { return { message: "Request rejected." }; }
  const store = await cookies();
  const settings = sessionCookieSettings();
  const token = store.get(settings.name)?.value;
  let anonymous = false;
  try {
    await withAuthConnection(async connection => {
      await requireSessionUser(connection, token);
      await revokeSession(connection, token);
    });
  } catch (error) {
    if (error instanceof AuthenticationRequired) anonymous = true;
    else return { message: "Sign out is temporarily unavailable. Please retry." };
  }
  if (!anonymous) {
    const { name, ...attributes } = settings;
    store.set(name, "", { ...attributes, maxAge: 0, expires: new Date(0) });
  }
  redirect("/login");
}
