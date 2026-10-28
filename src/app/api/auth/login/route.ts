import type { NextRequest } from "next/server";
import { authJson, limitedJson, loginFailure, setChallengeCookie,clearSessionCookie } from "@/server/auth/http";
import { assertSameOrigin, safeReturnPath, sessionCookieSettings } from "@/server/auth/security";
import { withAuthConnection } from "@/server/auth/store";
import { login } from "@/server/auth/login";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  try { assertSameOrigin(request.headers); } catch { return loginFailure(403); }
  let body;
  try { body = await limitedJson(request); } catch { return loginFailure(400); }
  if (typeof body.email !== "string" || typeof body.password !== "string" || body.email.length > 254 || Buffer.byteLength(body.password, "utf8") > 1024) return loginFailure();
  try {
    const result = await withAuthConnection(connection => login(connection, body.email as string, body.password as string, request.cookies.get(sessionCookieSettings().name)?.value));
    if (!result.ok) return loginFailure(result.limited ? 429 : 401);
    const response = authJson({ ok: true, state:result.state, returnTo: `/login/mfa?returnTo=${encodeURIComponent(safeReturnPath(body.returnTo))}` });
    clearSessionCookie(response);
    setChallengeCookie(response, result.token);
    return response;
  } catch { return loginFailure(503); }
}
