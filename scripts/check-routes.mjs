import assert from "node:assert/strict";

const base = process.argv[2] ?? "http://127.0.0.1:3000";
const publicRoutes = ["", "/about", "/services", "/projects", "/contact"];
const appRoutes = ["", "/clients", "/projects", "/payments", "/expenses", "/receipts", "/reports", "/categories", "/persons", "/vehicles", "/accounts"];
let checked = 0;
const sessionCookie = process.env.AUTH_SMOKE_COOKIE;

async function check(path, language, authenticated = false) {
  const response = await fetch(new URL(path, base), { redirect: "manual", headers: authenticated && sessionCookie ? { Cookie: sessionCookie } : {} });
  assert.equal(response.status, 200, `${path}: expected HTTP 200`);
  const html = await response.text();
  assert.match(html, new RegExp(`<html[^>]*lang="${language}"`), `${path}: document language`);
  assert.match(html, /<h1[ >]/, `${path}: page heading`);
  assert.match(html, /aria-current="page"/, `${path}: active navigation`);
  assert.doesNotMatch(html, /<title>[^<]*(?:500|Internal Server Error)/, `${path}: runtime error`);
  console.log(`PASS ${path} (200, lang=${language}, heading, active navigation)`);
  checked++;
}

const root = await fetch(new URL("/", base), { redirect: "manual" });
assert.equal(root.status, 307, "Root should redirect");
assert.equal(root.headers.get("location"), "/sq", "Default locale should be Albanian");
console.log("PASS / → /sq (307)");
for (const language of ["sq", "en"]) {
  for (const route of publicRoutes) await check(`/${language}${route}`, language);
}
async function checkProtectedRedirect(path) {
  const response = await fetch(new URL(path, base), { redirect: "manual" });
  assert.equal(response.status, 307, `${path}: anonymous access must redirect`);
  const target = new URL(response.headers.get("location"), base);
  assert.equal(target.pathname, "/login");
  assert.equal(target.searchParams.get("returnTo"), path);
  console.log(`PASS ${path} (anonymous login redirect)`);
}
for (const route of appRoutes) {
  if (sessionCookie) await check(`/app${route}`, "en", true);
  else await checkProtectedRedirect(`/app${route}`);
}
const loginPage = await fetch(new URL("/login", base));
assert.equal(loginPage.status, 200);
const loginHtml = await loginPage.text();
assert.match(loginHtml, /autoComplete="username"/i);
assert.match(loginHtml, /autoComplete="current-password"/i);
console.log("PASS /login (accessible login form)");
for (const path of ["/fr", "/sq/missing", ...(sessionCookie ? ["/app/missing"] : [])]) {
  const response = await fetch(new URL(path, base), { headers: sessionCookie ? { Cookie: sessionCookie } : {} });
  assert.equal(response.status, 404, `${path}: expected HTTP 404`);
  console.log(`PASS ${path} (404)`);
}
if (!sessionCookie) await checkProtectedRedirect("/app/missing");
for (const language of ["sq", "en"]) {
  const html = await (await fetch(new URL(`/${language}/contact`, base))).text();
  assert.match(html, /<fieldset[^>]*disabled/, "Contact form must be disabled");
  assert.match(html, /<button[^>]*disabled/, "Submission must be disabled");
}
console.log(`Verified ${checked} content routes, ${sessionCookie ? "authenticated" : "anonymous"} private-route behavior, login, invalid routes and disabled contact previews.`);
console.log("HTTP checks do not verify hydration, visual layout or menu interaction.");
