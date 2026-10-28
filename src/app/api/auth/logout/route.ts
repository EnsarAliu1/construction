import type { NextRequest } from "next/server";
import { authJson, clearSessionCookie,clearChallengeCookie,challengeCookieSettings } from "@/server/auth/http";
import {cancelMfa} from '@/server/auth/mfa';
import { assertSameOrigin, sessionCookieSettings, validSessionToken } from "@/server/auth/security";
import { withAuthConnection } from "@/server/auth/store";
import { revokeSession } from "@/server/auth/sessions";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request.headers); } catch { return authJson({ ok: false, message: "Request rejected." }, 403); }
  const token = request.cookies.get(sessionCookieSettings().name)?.value;
  try {
    if (validSessionToken(token)) await withAuthConnection(connection => revokeSession(connection, token));
    await withAuthConnection(connection=>cancelMfa(connection,request.cookies.get(challengeCookieSettings().name)?.value));
    const response = authJson({ ok: true });
    clearSessionCookie(response);
    clearChallengeCookie(response);
    return response;
  } catch { return authJson({ ok: false, message: "Sign out is temporarily unavailable. Please retry." }, 503); }
}
