import { createHash, randomBytes } from "node:crypto";

export const SESSION_SECONDS = 8 * 60 * 60;
export const LOGIN_FAILURE = "Hyrja dështoi. Kontrolloni të dhënat ose provoni më vonë.";
export type AuthenticatedUser = { id: string; displayName: string; email: string };
export class AuthenticationRequired extends Error { constructor() { super("Kërkohet autentikim"); } }
export class OperatorRequired extends Error { constructor() { super("Kërkohet autorizimi i operatorit Adore"); } }
export class ActiveAccountLimit extends Error { constructor() { super("Lejohen deri në pesë llogari aktive përdoruesish"); } }

export function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
export function validEmail(email: string) { return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email); }
export function tokenDigest(token: string) { return createHash("sha256").update(token).digest("hex"); }
export function newSessionToken() { return randomBytes(32).toString("base64url"); }
export function validSessionToken(token: string | undefined): token is string { return Boolean(token && /^[A-Za-z0-9_-]{43}$/.test(token)); }
export function safeReturnPath(value: unknown) {
  return typeof value === "string" && /^\/app(?:\/[a-z0-9-]+)*$/.test(value) ? value : "/app";
}

export function sessionCookieSettings(production = process.env.NODE_ENV === "production") {
  return {
    name: production ? "__Host-fitimi_session" : "fitimi_session",
    httpOnly: true as const, secure: production, sameSite: "lax" as const,
    path: "/", maxAge: SESSION_SECONDS,
  };
}

export function trustedOrigin() {
  const value = process.env.AUTH_ORIGIN ?? "http://127.0.0.1:3000";
  const url = new URL(value);
  const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.username || url.password || url.search || url.hash || url.pathname !== "/" || (url.protocol !== "https:" && !(url.protocol === "http:" && loopback))) {
    throw new Error("AUTH_ORIGIN must be an HTTPS origin or a local loopback HTTP origin");
  }
  return url;
}

export function assertSameOrigin(headers: Headers) {
  const origin = trustedOrigin();
  if (headers.get("origin") !== origin.origin || headers.get("host") !== origin.host) throw new Error("Origjina e kërkesës u refuzua");
}
