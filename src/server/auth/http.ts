import { NextResponse } from "next/server";
import { LOGIN_FAILURE, sessionCookieSettings } from "./security";
import {securitySignal} from "../operations/events";

export function authJson(body: object, status = 200) {
  if(status===401||status===403)securitySignal('access.denied',status);
  else if(status===429)securitySignal('request.throttled',status);
  else if(status>=500)securitySignal('service.unavailable',status);
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
export function challengeCookieSettings(){const {name,...settings}=sessionCookieSettings();return {...settings,name:name.startsWith('__Host-')?'__Host-fitimi_pre_auth':'fitimi_pre_auth',sameSite:'strict' as const,maxAge:300};}
export function setChallengeCookie(response:NextResponse,token:string){const {name,...settings}=challengeCookieSettings();response.cookies.set(name,token,settings);}
export function clearChallengeCookie(response:NextResponse){const {name,...settings}=challengeCookieSettings();response.cookies.set(name,'',{...settings,maxAge:0,expires:new Date(0)});}

export async function limitedJson(request: Request, maxBytes = 8192): Promise<Record<string, unknown>> {
  const reader = request.body?.getReader();
  if (!reader || !request.headers.get("content-type")?.startsWith("application/json")) throw new Error("Invalid request");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > maxBytes) { await reader.cancel(); throw new Error("Request too large"); }
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid request");
  return parsed as Record<string, unknown>;
}
