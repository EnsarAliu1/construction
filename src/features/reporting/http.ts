import {privateDownload} from "@/server/download";
import "server-only";
import type {NextRequest} from "next/server";
import type {Connection} from "mysql2/promise";
import {authJson,limitedJson} from "@/server/auth/http";
import {assertSameOrigin,AuthenticationRequired,sessionCookieSettings} from "@/server/auth/security";
import {requireSessionUser} from "@/server/auth/sessions";
import {withAuthConnection} from "@/server/auth/store";
import {ReferenceError} from "@/features/references/validation";
import type {exportCompany} from "./export";
export function query(request:NextRequest){const p=request.nextUrl.searchParams;if(new Set(p.keys()).size!==p.size)throw new ReferenceError("FILTERS","Filtrat e përsëritur nuk mbështeten.");return Object.fromEntries(p);}
type Download=Awaited<ReturnType<typeof exportCompany>>;
export async function reportingRequest(request:NextRequest,work:(c:Connection,token:string|undefined,body:unknown)=>Promise<object|Download>,mutation=false){
 try{const token=request.cookies.get(sessionCookieSettings().name)?.value;return await withAuthConnection(async c=>{await requireSessionUser(c,token);let body:unknown={};if(mutation){try{assertSameOrigin(request.headers);}catch{return authJson({ok:false,message:"Origjina e kërkesës u refuzua."},403);}try{body=await limitedJson(request,8192);}catch{return authJson({ok:false,message:"Dërgoni të dhëna JSON të vlefshme brenda kufirit 8 KiB."},400);}}
  const result=await work(c,token,body);await requireSessionUser(c,token);
  if("bytes"in result){const file=result as Download;return privateDownload(file.bytes,{"Content-Type":file.type,"Content-Length":String(file.bytes.length),"Content-Disposition":`attachment; filename="${file.name}"`,"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox","X-Export-Snapshot":file.snapshot,"X-Export-ID":file.id});}
  return authJson({ok:true,...result});
 });}catch(error){if(error instanceof AuthenticationRequired)return authJson({ok:false,message:"Hyni për të parë ose eksportuar të dhënat e kompanisë."},401);if(error instanceof ReferenceError)return authJson({ok:false,code:error.code,message:error.message},error.status);return authJson({ok:false,message:"Të dhënat e kompanisë janë përkohësisht të padisponueshme. Nuk u krijua eksport i plotë. Provoni përsëri ose kontaktoni operatorin."},503);}
}
