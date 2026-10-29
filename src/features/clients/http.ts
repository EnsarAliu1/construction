import type { NextRequest } from "next/server";
import type { Connection } from "mysql2/promise";
import { authJson, limitedJson } from "@/server/auth/http";
import { AuthenticationRequired, assertSameOrigin, sessionCookieSettings, validSessionToken } from "@/server/auth/security";
import { requireSessionUser } from "@/server/auth/sessions";
import { withAuthConnection } from "@/server/auth/store";
import { ClientArchived, ClientConflict, ClientHasOpenProjects, ClientNotFound, ClientValidationError } from "./validation";

export async function clientRequest(request: NextRequest, work: (connection: Connection, token: string, body: Record<string, unknown>) => Promise<object>, mutation = false) {
  try {
    const token = request.cookies.get(sessionCookieSettings().name)?.value;
    if (!validSessionToken(token)) throw new AuthenticationRequired();
    return await withAuthConnection(async connection => {
      await requireSessionUser(connection, token);
      if (mutation) {
        try { assertSameOrigin(request.headers); } catch { return authJson({ ok: false, message: "Origjina e kërkesës u refuzua. Ringarkoni formularin dhe provoni përsëri." }, 403); }
      }
      let body: Record<string, unknown> = {};
      if (mutation) {
        try { body = await limitedJson(request); } catch { throw new ClientValidationError({ form: "Plotësoni formularin e vlefshëm të klientit brenda kufirit të lejuar." }); }
      }
      return authJson({ ok: true, ...await work(connection, token, body) }, request.method === "POST" ? 201 : 200);
    });
  } catch (error) {
    if (error instanceof AuthenticationRequired) return authJson({ ok: false, message: "Sesioni juaj ka përfunduar. Hyni përsëri." }, 401);
    if (error instanceof ClientValidationError) return authJson({ ok: false, message: error.message, fields: error.fields }, 400);
    if (error instanceof ClientNotFound) return authJson({ ok: false, message: error.message }, 404);
    if (error instanceof ClientConflict || error instanceof ClientArchived || error instanceof ClientHasOpenProjects) return authJson({ ok: false, message: error.message }, 409);
    // Drizzle errors may include bound personal data. Never serialize or log them.
    return authJson({ ok: false, message: "Të dhënat e klientëve janë përkohësisht të padisponueshme. Provoni përsëri." }, 503);
  }
}
