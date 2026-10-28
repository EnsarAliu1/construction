import {randomBytes} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {contentSecurityPolicy} from "./server/security/headers";

/** CSP/privacy only. Live authentication remains in every page/service, never in proxy. */
export function proxy(request:NextRequest){
 const nonce=randomBytes(24).toString("base64"),policy=contentSecurityPolicy(process.env.NODE_ENV==="production",nonce);
 const headers=new Headers(request.headers);headers.set("Content-Security-Policy",policy);headers.set("x-nonce",nonce);
 const response=NextResponse.next({request:{headers}});
 response.headers.set("Content-Security-Policy",policy);
 response.headers.set("Cache-Control","private, no-store, max-age=0");
 return response;
}
export const config={matcher:["/app/:path*","/login"]};
