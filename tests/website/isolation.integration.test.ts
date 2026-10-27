import assert from "node:assert/strict";
import test from "node:test";
import {randomUUID} from "node:crypto";
import type {RowDataPacket} from "mysql2/promise";
import {paymentFixture,mysqlSkip} from "../payments/fixtures";
import {confirmPaymentWithReceipt} from "../../src/features/receipts/service";
import {trustedOrigin} from "../../src/server/auth/security";
import {dictionaries,locales,publicPages,publicPath} from "../../src/i18n/dictionaries";
test("public HTTP metadata, publishing boundary and private synthetic records",{skip:mysqlSkip,timeout:120000},async t=>{
 const f=await paymentFixture(),origin=trustedOrigin(),canary=`PRIVATE-WP11-${randomUUID()}`,d=await f.fresh({name:canary}),payment=await confirmPaymentWithReceipt(f.connection,f.token,f.confirmation(d));
 assert.ok(["127.0.0.1","localhost","[::1]"].includes(origin.hostname));
 const get=(path:string)=>fetch(new URL(path,origin),{redirect:"manual"});
 try{
 await t.test("ten public pages have complete localized metadata, safe headers and no private record payload",async()=>{for(const l of locales)for(const p of ["home",...publicPages] as const){const r=await get(publicPath(l,p)),html=await r.text();assert.equal(r.status,200);assert.match(html,new RegExp(`<html[^>]*lang="${l}"`));assert.ok(html.includes(dictionaries[l].pages[p].title));assert.ok(html.includes(`href="${process.env.PUBLIC_SITE_URL}${publicPath(l,p)}"`));assert.match(html,/hreflang="sq"/i);assert.match(html,/hreflang="en"/i);assert.match(html,/property="og:title"/);assert.match(html,/name="robots" content="noindex, nofollow"/);assert.doesNotMatch(html,/Service 01|Shërbimi 01|Placeholder content|Përmbajtje paraprake/);for(const value of [canary,d.project.id,f.client.id,payment.paymentId])assert.ok(!html.includes(value));assert.equal(r.headers.get("x-content-type-options"),"nosniff");assert.equal(r.headers.get("set-cookie"),null);}});
 await t.test("public sitemap includes only ten SQ/EN routes and staging robots deny indexing",async()=>{const map=await(await get("/sitemap.xml")).text();assert.equal((map.match(/<loc>/g)??[]).length,10);assert.doesNotMatch(map,/\/app|\/api|\/login|PRIVATE-WP11/);const robots=await(await get("/robots.txt")).text();assert.match(robots,/Disallow: \/\s/);});
 await t.test("public portfolio has no private project or invented cards",async()=>{for(const l of locales){const html=await(await get(`/${l}/projects`)).text();assert.ok(html.includes(dictionaries[l].projectEmpty));assert.ok(!html.includes(canary));assert.doesNotMatch(html,/class="site-project-grid"/);}});
 await t.test("no fake contact delivery route or enabled controls",async()=>{for(const l of locales){const html=await(await get(`/${l}/contact`)).text();assert.match(html,/<fieldset[^>]*disabled/);assert.match(html,/<button[^>]*disabled/);assert.ok(html.includes(dictionaries[l].contactNote));assert.doesNotMatch(html,/href="(?:mailto:|tel:)/);}assert.equal((await fetch(new URL("/api/contact",origin),{method:"POST",body:JSON.stringify({name:"Synthetic",message:"Not delivered"})})).status,404);});
 await t.test("private app/receipt/data paths retain independent authorization and noindex headers",async()=>{for(const path of ["/app","/app/reports"]){const r=await get(path);assert.equal(r.status,307);assert.match(r.headers.get("x-robots-tag")!,/noindex/);}for(const path of [`/api/projects/${d.project.id}`,`/api/receipts/${payment.receiptId}`,`/api/receipts/${payment.receiptId}/versions/1/pdf`,"/api/dashboard"]){const r=await get(path);assert.equal(r.status,401);assert.match(r.headers.get("x-robots-tag")!,/noindex/);}const [refs]=await f.connection.query<RowDataPacket[]>("SELECT storage_reference FROM receipt_versions WHERE receipt_id=?",[payment.receiptId]);assert.equal((await get("/"+refs[0].storage_reference)).status,404);});
 await t.test("unsupported locales, unknown routes and unapproved images do not resolve",async()=>{for(const path of ["/fr","/fr/projects","/sq/missing","/en/missing","/images/approved/missing.webp"]){const r=await get(path);assert.equal(r.status,404);}});
 }finally{await f.close();}
});
