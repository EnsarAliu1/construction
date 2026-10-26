import type { NextRequest } from "next/server";
import type { Connection } from "mysql2/promise";
import { authJson, limitedJson } from "@/server/auth/http";
import { AuthenticationRequired, assertSameOrigin, sessionCookieSettings, validSessionToken } from "@/server/auth/security";
import { requireSessionUser } from "@/server/auth/sessions";
import { withAuthConnection } from "@/server/auth/store";
import { ProjectError } from "./validation";

export async function projectRequest(request: NextRequest, work: (connection: Connection, token: string, body: Record<string, unknown>) => Promise<object>, mutation = false) {
  try {
    const token = request.cookies.get(sessionCookieSettings().name)?.value;
    if (!validSessionToken(token)) throw new AuthenticationRequired();
    return await withAuthConnection(async connection => {
      await requireSessionUser(connection, token);
      let body = {};
      if (mutation) {
        try { assertSameOrigin(request.headers); } catch { return authJson({ ok: false, message: "Request origin rejected. Reload and try again." }, 403); }
        try { body = await limitedJson(request, 128 * 1024); } catch { throw new ProjectError("BODY", "Provide a valid JSON form within the 128 KiB request limit."); }
      }
      return authJson({ ok: true, ...await work(connection, token, body) }, request.method === "POST" ? 201 : 200);
    });
  } catch (error) {
    if (error instanceof AuthenticationRequired) return authJson({ ok: false, message: "Your session has ended. Sign in again." }, 401);
    if (error instanceof ProjectError) return authJson({ ok: false, code: error.code, message: error.message }, error.status);
    return authJson({ ok: false, message: "Project records are temporarily unavailable. Please try again." }, 503);
  }
}
