import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { loadLocalEnvironment, localDatabaseOptions, openLocalConnection } from "../../src/server/db/config";
import { createAccount, resetAccountPassword, setAccountActive } from "../../src/server/auth/accounts";
import { authenticateOperator } from "../../src/server/auth/operator";
import { tokenDigest, trustedOrigin } from "../../src/server/auth/security";

loadLocalEnvironment();

test("HTTP authentication, private routes, cookies, server actions and outage denial", {
  timeout: 120_000,
  skip: !process.env.TEST_DATABASE_URL ? "NOT VERIFIED: disposable MySQL is not configured" : false,
}, async t => {
  const options = localDatabaseOptions(process.env.TEST_DATABASE_URL, "test", process.env.DATABASE_DISPOSABLE);
  const appOptions = localDatabaseOptions(process.env.DATABASE_URL, "test", process.env.DATABASE_DISPOSABLE);
  assert.ok(options.host === appOptions.host && options.port === appOptions.port && options.database === appOptions.database, "HTTP tests require the app to target this same isolated test database");
  const origin = trustedOrigin();
  assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname), "HTTP tests only target loopback");
  const connection = await openLocalConnection(options);
  const operator = authenticateOperator(process.env.ADORE_OPERATOR_KEY ?? "");
  const email = `${randomUUID()}@example.invalid`;
  let password = randomBytes(24).toString("base64url");
  let cookie = "";
  let oldCookie = "";
  const id = await createAccount(connection, operator, { email, password, displayName: "Synthetic HTTP User" });
  const actionManifest = JSON.parse(readFileSync(`${process.env.FITIMI_TEST_BUILD === "wp13" ? ".next-wp13" : process.env.FITIMI_TEST_BUILD === "wp11" ? ".next-wp11" : process.env.FITIMI_TEST_BUILD === "wp10" ? ".next-wp10" : process.env.FITIMI_TEST_BUILD === "wp09" ? ".next-wp09" : ".next"}/server/server-reference-manifest.json`, "utf8"));
  const actionEntry = Object.entries(actionManifest.node as Record<string, { exportedName?: string }>).find(([, action]) => action.exportedName === "logoutAction");
  assert.ok(actionEntry, "Build the application before testing its actual protected server action");
  const actionId = actionEntry[0];
  const privatePaths = ["", "/clients", "/projects", "/payments", "/expenses", "/receipts", "/reports", "/categories", "/persons", "/vehicles", "/accounts"];
  const request = (path: string, init: RequestInit = {}) => fetch(new URL(path, origin), { ...init, redirect: "manual" });
  async function post(path: string, body: object = {}, session = cookie, requestOrigin = origin.origin) {
    return request(path, { method: "POST", headers: { Origin: requestOrigin, "Content-Type": "application/json", ...(session ? { Cookie: session } : {}) }, body: JSON.stringify(body) });
  }
  async function clearLimiter() {
    for (const key of [tokenDigest("login:global"), tokenDigest(`login:email:${email}`)]) await connection.execute("UPDATE auth_login_limits SET window_ends_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE bucket_key = ?", [key]);
  }
  async function assertActionLoginRedirect(response: Response) {
    // Fetch-mode Server Actions can stream the redirect's RSC payload with 200.
    // Require its explicit redirect instruction and deny any sensitive payload.
    assert.ok([200, 303].includes(response.status));
    assert.equal(response.headers.get("x-action-redirect"), "/login;push");
    const payload = await response.text();
    assert.ok(!payload.includes(password) && (!cookie || !payload.includes(cookie.split("=")[1])));
  }
  async function signIn(returnTo: string = "/app/projects") {
    await clearLimiter();
    const response = await post("/api/auth/login", { email, password, returnTo });
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.ok(body.ok && !Object.hasOwn(body, "token") && !Object.hasOwn(body, "passwordHash"));
    const setCookie = response.headers.get("set-cookie") ?? "";
    assert.ok(/HttpOnly/i.test(setCookie) && /SameSite=Lax/i.test(setCookie) && /Secure/i.test(setCookie));
    assert.ok(setCookie.startsWith("__Host-fitimi_session=") && /Path=\//.test(setCookie) && !/Domain=/i.test(setCookie));
    cookie = setCookie.split(";")[0];
    assert.equal(body.returnTo, returnTo.startsWith("https:") ? "/app" : returnTo);
    return response;
  }
  try {
    await t.test("anonymous private pages redirect to login and the protected operation returns 401", async () => {
      for (const suffix of privatePaths) {
        const response = await request(`/app${suffix}`);
        assert.equal(response.status, 307);
        assert.equal(new URL(response.headers.get("location")!, origin).pathname, "/login");
      }
      assert.equal((await request("/api/auth/session")).status, 401);
      const action = await request("/app", { method: "POST", headers: { Origin: origin.origin, "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8" }, body: "[]" });
      await assertActionLoginRedirect(action);
    });

    await t.test("public SQ/EN pages, login and anonymous route regression remain available", async () => {
      for (const locale of ["sq", "en"]) for (const path of ["", "/about", "/services", "/projects", "/contact"]) assert.equal((await request(`/${locale}${path}`)).status, 200);
      assert.equal((await request("/login")).status, 200);
      const result = spawnSync(process.execPath, ["scripts/check-routes.mjs", origin.origin], { encoding: "utf8", timeout: 30_000, env: { ...process.env, AUTH_SMOKE_COOKIE: "" } });
      assert.equal(result.status, 0, "Anonymous route smoke test failed");
    });

    await t.test("wrong/unknown/disabled credentials return identical generic messages", async () => {
      await clearLimiter();
      const wrong = await post("/api/auth/login", { email, password: "incorrect-password" }, "");
      const unknown = await post("/api/auth/login", { email: `${randomUUID()}@example.invalid`, password }, "");
      await setAccountActive(connection, operator, email, false);
      const disabled = await post("/api/auth/login", { email, password }, "");
      assert.equal(wrong.status, 401); assert.equal(unknown.status, 401); assert.equal(disabled.status, 401);
      const messages = [await wrong.text(), await unknown.text(), await disabled.text()];
      assert.ok(messages.every(message => message === messages[0] && !message.includes(email)));
      await setAccountActive(connection, operator, email, true);
    });

    await t.test("correct login uses safe cookies, avoids redirects/tokens in JSON and opens every private page", async () => {
      await signIn("https://evil.example");
      for (const suffix of privatePaths) {
        const response = await request(`/app${suffix}`, { headers: { Cookie: cookie } });
        assert.equal(response.status, 200);
        const html = await response.text();
        assert.ok(html.includes("Synthetic HTTP User") && !html.includes(password) && !html.includes(cookie.split("=")[1]) && !html.includes("$argon2id$"));
      }
      const identity = await request("/api/auth/session", { headers: { Cookie: cookie } });
      assert.equal(identity.status, 200);
      const body = await identity.json(); assert.equal(body.user.id, id);
      assert.ok(!Object.hasOwn(body.user, "passwordHash") && !Object.hasOwn(body.user, "token"));
      const result = spawnSync(process.execPath, ["scripts/check-routes.mjs", origin.origin], { encoding: "utf8", timeout: 30_000, env: { ...process.env, AUTH_SMOKE_COOKIE: cookie } });
      assert.equal(result.status, 0, "Authenticated route smoke test failed");
    });

    await t.test("origin protection rejects forged login/logout and there is no registration/admin API", async () => {
      assert.equal((await post("/api/auth/login", { email, password }, "", "https://evil.example")).status, 403);
      assert.equal((await post("/api/auth/logout", {}, cookie, "https://evil.example")).status, 403);
      for (const path of ["/api/auth/register", "/api/auth/sign-up/email", "/api/auth/accounts", "/api/auth/reset-password"]) assert.equal((await post(path)).status, 404);
      assert.equal((await request("/api/auth/session", { headers: { Cookie: cookie } })).status, 200);
    });

    await t.test("rotation, expiration, deactivation and operator recovery reject previous cookies", async () => {
      oldCookie = cookie;
      await signIn();
      assert.ok(cookie !== oldCookie);
      assert.equal((await request("/api/auth/session", { headers: { Cookie: oldCookie } })).status, 401);
      await connection.execute("UPDATE auth_sessions SET expires_at = DATE_SUB(UTC_TIMESTAMP(3), INTERVAL 1 SECOND) WHERE token_hash = ?", [tokenDigest(cookie.split("=")[1])]);
      assert.equal((await request("/api/auth/session", { headers: { Cookie: cookie } })).status, 401);
      await signIn();
      await setAccountActive(connection, operator, email, false);
      assert.equal((await request("/api/auth/session", { headers: { Cookie: cookie } })).status, 401);
      await setAccountActive(connection, operator, email, true);
      assert.equal((await request("/api/auth/session", { headers: { Cookie: cookie } })).status, 401);
      await signIn(); oldCookie = cookie;
      password = randomBytes(24).toString("base64url");
      await resetAccountPassword(connection, operator, email, password);
      assert.equal((await request("/api/auth/session", { headers: { Cookie: oldCookie } })).status, 401);
      await signIn();
    });

    await t.test("actual protected logout server action revokes the cookie and repeated HTTP logout is safe", async () => {
      oldCookie = cookie;
      const action = await request("/app", { method: "POST", headers: { Origin: origin.origin, Cookie: cookie, "Next-Action": actionId, "Content-Type": "text/plain;charset=UTF-8" }, body: "[]" });
      await assertActionLoginRedirect(action);
      assert.equal((await request("/api/auth/session", { headers: { Cookie: oldCookie } })).status, 401);
      assert.equal((await post("/api/auth/logout", {}, oldCookie)).status, 200);
      assert.equal((await post("/api/auth/logout", {}, "")).status, 200);
      await signIn(); oldCookie = cookie;
      assert.equal((await post("/api/auth/logout")).status, 200);
      assert.equal((await request("/api/auth/session", { headers: { Cookie: oldCookie } })).status, 401);
    });

    await t.test("a real database outage denies protected operations and login", async () => {
      const containerId = process.env.AUTH_TEST_CONTAINER_ID;
      assert.ok(containerId && /^[a-f0-9]{64}$/.test(containerId), "Supply the exact task-owned disposable container ID for outage verification");
      const inspected = spawnSync("docker", ["inspect", containerId], { encoding: "utf8", timeout: 10_000 });
      assert.equal(inspected.status, 0);
      const container = JSON.parse(inspected.stdout)[0];
      const expectedPackage = process.env.AUTH_TEST_WORK_PACKAGE ?? "WP-03";
      assert.ok(["WP-03", "WP-04", "WP-05", "WP-06", "WP-07", "WP-08", "WP-09", "WP-10", "WP-11", "WP-13"].includes(expectedPackage), "Only an explicitly supported test work package is permitted");
      assert.ok(container.Id === containerId && container.Config.Labels["adore.work-package"] === expectedPackage, "Only the exact task-owned test container may be paused");
      await signIn();
      const paused = spawnSync("docker", ["pause", containerId], { encoding: "utf8", timeout: 10_000 });
      assert.equal(paused.status, 0);
      try {
        const denied = await request("/api/auth/session", { headers: { Cookie: cookie }, signal: AbortSignal.timeout(15_000) });
        assert.equal(denied.status, 503);
        const paymentsDenied = await request("/api/payments", { headers: { Cookie: cookie }, signal: AbortSignal.timeout(15_000) });
        assert.equal(paymentsDenied.status, 503);
        const paymentsError = await paymentsDenied.text();
        assert.ok(!paymentsError.includes(password) && !paymentsError.includes(process.env.DATABASE_URL!) && !paymentsError.includes("SELECT "));
        const unavailable = await post("/api/auth/login", { email, password });
        assert.equal(unavailable.status, 503);
        const page = await request("/app", { headers: { Cookie: cookie }, signal: AbortSignal.timeout(15_000) });
        assert.equal(page.status, 307);
        assert.ok(page.headers.get("location")?.includes("unavailable=1"));
      } finally {
        const resumed = spawnSync("docker", ["unpause", containerId], { encoding: "utf8", timeout: 10_000 });
        assert.equal(resumed.status, 0, "Resume the task-owned database even after a failed outage assertion");
      }
    });
  } finally {
    await setAccountActive(connection, operator, email, false);
    await connection.end();
  }
});
