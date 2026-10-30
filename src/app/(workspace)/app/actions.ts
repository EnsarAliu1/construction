"use server";

import {challengeCookieSettings} from "@/server/auth/http";
import {cancelMfa} from "@/server/auth/mfa";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { assertSameOrigin, AuthenticationRequired, sessionCookieSettings } from "@/server/auth/security";
import { withAuthConnection } from "@/server/auth/store";
import { requireSessionUser, revokeSession } from "@/server/auth/sessions";

export async function logoutAction() {
  try { assertSameOrigin(await headers()); }
  catch { return { message: "Kërkesa u refuzua." }; }
  const store = await cookies();
  const settings = sessionCookieSettings();
  const token = store.get(settings.name)?.value;
  let anonymous = false;
  try {
    await withAuthConnection(async connection => {
      await requireSessionUser(connection, token);
      await revokeSession(connection, token);
      await cancelMfa(connection,store.get(challengeCookieSettings().name)?.value);
    });
  } catch (error) {
    if (error instanceof AuthenticationRequired) anonymous = true;
    else return { message: "Dalja është përkohësisht e padisponueshme. Provoni përsëri." };
  }
  if (!anonymous) {
    const { name, ...attributes } = settings;
    store.set(name, "", { ...attributes, maxAge: 0, expires: new Date(0) });
  }
  const {name:pendingName,...pendingAttributes}=challengeCookieSettings();store.set(pendingName,"",{...pendingAttributes,maxAge:0,expires:new Date(0)});
  redirect("/administrata");
}
