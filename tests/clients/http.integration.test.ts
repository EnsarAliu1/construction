import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { clientFixture, mysqlSkip } from "./fixture";
import { localDatabaseOptions } from "../../src/server/db/config";
import { setAccountActive } from "../../src/server/auth/accounts";
import { trustedOrigin } from "../../src/server/auth/security";

test("real HTTP Clients pages, validation, search, conflicts, archive and session denial", { skip: mysqlSkip, timeout: 120_000 }, async t => {
  const origin = trustedOrigin();
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(origin.hostname), "HTTP tests only target loopback");
  const testOptions = localDatabaseOptions(process.env.TEST_DATABASE_URL, "test", process.env.DATABASE_DISPOSABLE);
  const appOptions = localDatabaseOptions(process.env.DATABASE_URL, "test", process.env.DATABASE_DISPOSABLE);
  assert.ok(testOptions.host === appOptions.host && testOptions.port === appOptions.port && testOptions.database === appOptions.database, "The app must use this same disposable test database");
  const f = await clientFixture();
  const cookie = `__Host-fitimi_session=${f.token}`;
  const request = (path: string, init: RequestInit = {}) => fetch(new URL(path, origin), { ...init, redirect: "manual" });
  const read = (path: string, session = cookie) => request(path, { headers: session ? { Cookie: session } : {} });
  const write = (path: string, method: string, body: object, session = cookie, requestOrigin = origin.origin) => request(path, { method, headers: { Origin: requestOrigin, "Content-Type": "application/json", ...(session ? { Cookie: session } : {}) }, body: JSON.stringify(body) });
  let id = "";
  let version = 1;
  const name = `${f.prefix} HTTP Individual`;
  try {
    await t.test("all Clients pages and endpoints deny anonymous access before data lookup", async () => {
      const unknownId = randomUUID();
      for (const path of ["/app/clients", "/app/clients/new", `/app/clients/${unknownId}`, `/app/clients/${unknownId}/edit`]) {
        const response = await read(path, ""); assert.equal(response.status, 307); assert.equal(new URL(response.headers.get("location")!, origin).pathname, "/login");
      }
      for (const response of [await read("/api/clients", ""), await read(`/api/clients/${unknownId}`, ""), await write("/api/clients", "POST", {}, ""), await write(`/api/clients/${unknownId}`, "PUT", {}, ""), await write(`/api/clients/${unknownId}`, "DELETE", {}, "")]) assert.equal(response.status, 401);
    });
    await t.test("create individual and business clients; real form labels, values and stable-ID links render", async () => {
      const created = await write("/api/clients", "POST", f.input({ name, email: "synthetic-http@example.invalid" })); assert.equal(created.status, 201);
      const body = await created.json(); id = body.client.id; version = body.client.version;
      assert.ok(created.headers.get("cache-control")?.includes("no-store"));
      const company = await write("/api/clients", "POST", f.input({ type: "business", name: `${f.prefix} HTTP Business`, nui: "optional synthetic NUI" })); assert.equal(company.status, 201);
      const business = await company.json();
      for (const path of ["/app/clients", "/app/clients/new", `/app/clients/${id}`, `/app/clients/${id}/edit`, `/app/clients/${business.client.id}/edit`]) {
        const response = await read(path); assert.equal(response.status, 200); const html = await response.text();
        assert.match(html, /<h1/); assert.ok(!html.includes(f.password) && !html.includes(f.token));
        assert.match(html, /<a\b(?=[^>]*href="\/app\/clients")(?=[^>]*aria-current="page")[^>]*>/);
        if (path.endsWith("/edit") || path.endsWith("/new")) { assert.match(html, /for="client-name"/); assert.match(html, /name="name"/); assert.match(html, /Client type \(required\)/); }
        if (path.includes(business.client.id)) assert.match(html, /optional synthetic NUI/);
      }
      const list = await read(`/app/clients?q=${encodeURIComponent(name)}`); assert.match(await list.text(), new RegExp(`/app/clients/${id}`));
    });
    await t.test("server-side validation, protected-field rejection, size limits and CSRF work on real requests", async () => {
      for (const extra of [{ name: " " }, { type: "other" }, { email: "invalid" }, { createdBy: randomUUID() }, { deletedAt: "2026-01-01" }, { password: f.password }]) {
        const response = await write("/api/clients", "POST", f.input(extra)); assert.equal(response.status, 400);
        const body = await response.json(); assert.ok(body.fields && !JSON.stringify(body).includes(f.password));
      }
      assert.equal((await write("/api/clients", "POST", f.input({ name: "x".repeat(9000) }))).status, 400);
      for (const [path, method, payload] of [["/api/clients", "POST", f.input()], [`/api/clients/${id}`, "PUT", { ...f.input(), version }], [`/api/clients/${id}`, "DELETE", { version, confirmation: "archive" }]] as const) assert.equal((await write(path, method, payload, cookie, "https://untrusted.example.invalid")).status, 403);
      assert.equal((await read(`/api/clients?page=-1`)).status, 400);
    });
    await t.test("search/type filters, empty state and unknown stable IDs use real database results", async () => {
      const response = await read(`/api/clients?q=${encodeURIComponent(name)}&type=private_person`); assert.equal(response.status, 200); const body = await response.json(); assert.equal(body.total, 1); assert.equal(body.rows[0].id, id);
      const excluded = await read(`/api/clients?q=${encodeURIComponent(name)}&type=business`); assert.equal((await excluded.json()).total, 0);
      const empty = await read(`/app/clients?q=${randomUUID()}`); assert.equal(empty.status, 200); assert.match(await empty.text(), /No matching clients/);
      assert.equal((await read(`/api/clients/${randomUUID()}`)).status, 404); assert.equal((await read(`/app/clients/${randomUUID()}`)).status, 404);
    });
    await t.test("real HTTP edits succeed, escape stored markup and reject stale writes", async () => {
      const editedName = `${f.prefix} <script>synthetic</script>`;
      const edit = await write(`/api/clients/${id}`, "PUT", { ...f.input({ name: editedName, phone: "+000 synthetic HTTP" }), version }); assert.equal(edit.status, 200); const body = await edit.json(); version = body.client.version; assert.equal(version, 2);
      const page = await read(`/app/clients/${id}`); const html = await page.text(); assert.ok(html.includes("&lt;script&gt;synthetic&lt;/script&gt;") && !html.includes("<script>synthetic</script>")); assert.match(html, /Audit history/);
      assert.equal((await write(`/api/clients/${id}`, "PUT", { ...f.input(), version: 1 })).status, 409);
      assert.equal((await write(`/api/clients/${id}`, "DELETE", { version: 1, confirmation: "archive" })).status, 409);
      const detail = await read(`/api/clients/${id}`); assert.equal((await detail.json()).client.name, editedName);
    });
    await t.test("active project safety and explicit archive confirmation are enforced through HTTP", async () => {
      const projectId = randomUUID();
      await f.connection.execute("INSERT INTO projects (id, client_id, name, status) VALUES (?, ?, 'Synthetic HTTP project', 'active')", [projectId, id]);
      assert.equal((await write(`/api/clients/${id}`, "DELETE", { version, confirmation: "archive" })).status, 409);
      const blocked = await read(`/app/clients/${id}`); assert.match(await blocked.text(), /cannot be archived/);
      await f.connection.execute("UPDATE projects SET status='completed' WHERE id=?", [projectId]);
      assert.equal((await write(`/api/clients/${id}`, "DELETE", { version })).status, 400);
      const archived = await write(`/api/clients/${id}`, "DELETE", { version, confirmation: "archive" }); assert.equal(archived.status, 200); const body = await archived.json(); assert.ok(body.client.deletedAt); version = body.client.version;
      const detail = await read(`/api/clients/${id}`); const retained = await detail.json(); assert.equal(retained.relatedProjects[0].id, projectId); assert.equal(retained.history.length, 3);
      const list = await read(`/api/clients?q=${encodeURIComponent(f.prefix)}`); assert.ok(!(await list.json()).rows.some((row: { id: string }) => row.id === id));
      const edit = await read(`/app/clients/${id}/edit`); assert.match(await edit.text(), /Archived clients are read-only/);
      assert.equal((await write(`/api/clients/${id}`, "PUT", { ...f.input(), version })).status, 409);
    });
    await t.test("deactivated sessions lose page, API read and mutation access immediately", async () => {
      await setAccountActive(f.connection, f.operator, f.email, false);
      for (const path of ["/app/clients", "/app/clients/new", `/app/clients/${id}`, `/app/clients/${id}/edit`]) assert.equal((await read(path)).status, 307);
      for (const response of [await read("/api/clients"), await read(`/api/clients/${id}`), await write("/api/clients", "POST", f.input()), await write(`/api/clients/${id}`, "PUT", { ...f.input(), version }), await write(`/api/clients/${id}`, "DELETE", { version, confirmation: "archive" })]) assert.equal(response.status, 401);
    });
  } finally { await f.close(); }
});
