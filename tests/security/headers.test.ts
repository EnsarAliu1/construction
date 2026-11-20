import assert from "node:assert/strict";
import test from "node:test";
import {browserSecurityHeaders,contentSecurityPolicy} from "../../src/server/security/headers";
test("private production CSP requires a valid nonce and does not permit inline script/eval",()=>{
 const policy=contentSecurityPolicy(true,"Y29uc3RydWN0aW9u"),script=policy.split(';').find(s=>s.includes('script-src'))!;
 assert(script.includes("'nonce-Y29uc3RydWN0aW9u'"));assert(script.includes("'strict-dynamic'"));assert(!script.includes("'unsafe-inline'"));assert(!policy.includes("'unsafe-eval'"));
 for(const value of ["bad';script-src *","\nnonce","<script>"])assert.throws(()=>contentSecurityPolicy(true,value));
});
test("static public bootstrap compatibility is explicit; framing, objects, base and forms remain restricted",()=>{
 const policy=contentSecurityPolicy(true);assert(policy.includes("script-src 'self' 'unsafe-inline'"));for(const directive of ["frame-ancestors 'none'","object-src 'none'","base-uri 'none'","form-action 'self'"])assert(policy.includes(directive));assert(browserSecurityHeaders.some(h=>h.key==='X-Frame-Options'&&h.value==='DENY'));
});
test('public and private policies block event-handler execution, frames and cross-origin opener access',()=>{
 for(const nonce of [undefined,'Y29uc3RydWN0aW9u']){
  const policy=contentSecurityPolicy(true,nonce);
  assert(policy.includes("script-src-attr 'none'"));assert(policy.includes("frame-src 'none'"));
 }
 assert(browserSecurityHeaders.some(h=>h.key==='Cross-Origin-Opener-Policy'&&h.value==='same-origin'));
 assert(browserSecurityHeaders.some(h=>h.key==='Permissions-Policy'&&h.value.includes('publickey-credentials-get=(self)')));
});
