import {randomBytes} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {contentSecurityPolicy} from "./server/security/headers";
import {trustedOrigin} from './server/auth/security';

/** CSP/privacy only. Live authentication remains in every page/service, never in proxy. */
export function proxy(request:NextRequest){
 if(process.env.DEMO_MODE==='1'){
  const path=request.nextUrl.pathname;
  if(path.startsWith('/api/auth/')&&path!=='/api/auth/logout')return NextResponse.json({ok:false,message:'Ky veprim nuk është i disponueshëm në demo.'},{status:403,headers:{'Cache-Control':'no-store'}});
  if(/^\/app\/(security|accounts)(\/|$)/.test(path))return NextResponse.redirect(new URL('/app',request.url),303);
 }
 if(process.env.NODE_ENV!=='production'&&process.env.FITIMI_LOCAL_DEVELOPMENT==='1'&&!process.env.FITIMI_TEST_BUILD&&(request.method==='GET'||request.method==='HEAD')){
  const canonical=trustedOrigin();
  if(canonical.hostname==='localhost'&&request.headers.get('host')===`127.0.0.1:${canonical.port}`){const target=new URL(request.nextUrl.pathname+request.nextUrl.search,canonical);return NextResponse.redirect(target,307);}
 }
 const nonce=randomBytes(24).toString("base64"),policy=contentSecurityPolicy(process.env.NODE_ENV==="production",nonce);
 const headers=new Headers(request.headers);headers.set("Content-Security-Policy",policy);headers.set("x-nonce",nonce);
 const response=NextResponse.next({request:{headers}});
 response.headers.set("Content-Security-Policy",policy);
 response.headers.set("Cache-Control","private, no-store, max-age=0");
 return response;
}
export const config={matcher:["/app/:path*","/administrata/:path*","/api/auth/:path*","/demo"]};
