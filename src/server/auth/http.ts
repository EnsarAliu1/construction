import { NextResponse } from "next/server";
import { LOGIN_FAILURE, sessionCookieSettings } from "./security";

export function authJson(body: object, status = 200) {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", "Pragma": "no-cache" } });
}
export function loginFailure(status = 401) { return authJson({ ok: false, message: LOGIN_FAILURE }, status); }
export function setSessionCookie(response: NextResponse, token: string) {
  const { name, ...settings } = sessionCookieSettings();
  response.cookies.set(name, token, settings);
}
export function clearSessionCookie(response: NextResponse) {
  const { name, ...settings } = sessionCookieSettings();
  response.cookies.set(name, "", { ...settings, maxAge: 0, expires: new Date(0) });
}

export async function limitedJson(request: Request): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader || !request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid request");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 8192) { await reader.cancel(); throw new Error("Request too large"); }
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid request");
  return parsed as Record<string, unknown>;
}
