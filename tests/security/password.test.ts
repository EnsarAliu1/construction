import assert from "node:assert/strict";
import test from "node:test";
import {randomBytes} from "node:crypto";
import {hashPassword,verifyPassword} from "../../src/server/auth/password";
test("passwords support long Unicode/space values without truncation or normalization",async()=>{
 const password=`  ${randomBytes(64).toString('base64url')} Ëç  `,hash=await hashPassword(password);
 assert(password.length>64);assert(await verifyPassword(password,hash));assert(!await verifyPassword(password.trim(),hash));assert(!await verifyPassword(password.toUpperCase(),hash));
 assert.throws(()=>hashPassword('short'));assert.throws(()=>hashPassword('Ë'.repeat(513)));
});
