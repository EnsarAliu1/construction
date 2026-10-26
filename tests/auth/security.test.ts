import assert from "node:assert/strict";
import test from "node:test";
import { randomBytes } from "node:crypto";
import { hashPassword, verifyPassword } from "../../src/server/auth/password";
import { authenticateOperator, requireOperator, type OperatorContext } from "../../src/server/auth/operator";
import { assertSameOrigin, newSessionToken, normalizeEmail, safeReturnPath, sessionCookieSettings, tokenDigest, validSessionToken } from "../../src/server/auth/security";

test("Argon2id is salted, verifies passwords and rejects wrong/malformed hashes", async () => {
  const password = randomBytes(24).toString("base64url");
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.ok(first.startsWith("$argon2id$v=19$m=19456,t=2,p=1$"));
  assert.ok(first !== second && !first.includes(password));
  assert.ok(await verifyPassword(password, first));
  assert.ok(!await verifyPassword("wrong-password", first));
  assert.ok(!await verifyPassword(password, undefined));
  assert.ok(!await verifyPassword(password, "malformed"));
  assert.throws(() => hashPassword("short"));
});

test("opaque session tokens have 256 random bits and only SHA-256 digests are persisted", () => {
  const first = newSessionToken(); const second = newSessionToken();
  assert.ok(first !== second && validSessionToken(first));
  assert.equal(tokenDigest(first).length, 64);
  assert.ok(tokenDigest(first) !== first);
  for (const token of [undefined, "", "fixed", "x".repeat(500)]) assert.ok(!validSessionToken(token));
});

test("cookies are HttpOnly, SameSite, host-only and secure in production", () => {
  const production = sessionCookieSettings(true);
  assert.equal(production.name, "__Host-fitimi_session");
  assert.ok(production.secure && production.httpOnly);
  assert.equal(production.sameSite, "lax");
  assert.equal(production.path, "/");
  assert.equal(production.maxAge, 28800);
  assert.ok(!("domain" in production));
  assert.equal(sessionCookieSettings(false).secure, false);
});

test("redirects permit only simple private application paths", () => {
  assert.equal(safeReturnPath("/app/projects"), "/app/projects");
  for (const value of ["https://example.com", "//example.com", "/app/../en", "/app\\example.com", "/application", "/app/%2f%2fexample.com", "/app?redirect=https://example.com", null]) assert.equal(safeReturnPath(value), "/app");
  assert.equal(normalizeEmail("  CLIENT@EXAMPLE.INVALID  "), "client@example.invalid");
});

test("state-changing requests validate configured Origin and Host without forwarded-header trust", () => {
  const origin = "https://workspace.example.invalid";
  process.env.AUTH_ORIGIN = origin;
  assert.doesNotThrow(() => assertSameOrigin(new Headers({ origin, host: "workspace.example.invalid" })));
  for (const headers of [
    new Headers({ origin: "https://evil.example", host: "workspace.example.invalid" }),
    new Headers({ origin, host: "evil.example", "x-forwarded-host": "workspace.example.invalid" }),
    new Headers({ host: "workspace.example.invalid" }),
  ]) assert.throws(() => assertSameOrigin(headers));
});

test("operator capability cannot be forged by a client or obtained with the wrong key", () => {
  process.env.ADORE_OPERATOR_KEY = randomBytes(32).toString("hex");
  assert.throws(() => authenticateOperator("wrong-key"));
  assert.throws(() => requireOperator({ kind: "adore_operator" } as OperatorContext));
  assert.doesNotThrow(() => requireOperator(authenticateOperator(process.env.ADORE_OPERATOR_KEY!)));
});
