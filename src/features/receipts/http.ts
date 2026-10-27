import type {NextRequest} from "next/server";
import {authJson} from "@/server/auth/http";
import {AuthenticationRequired,sessionCookieSettings,validSessionToken} from "@/server/auth/security";
import {withAuthConnection} from "@/server/auth/store";
import {ReferenceError} from "@/features/references/validation";
import {downloadReceipt} from "./service";
export async function receiptDownloadRequest(request:NextRequest,id:string,version:string){
  try{
    const token=request.cookies.get(sessionCookieSettings().name)?.value;if(!validSessionToken(token))throw new AuthenticationRequired();
    const data=await withAuthConnection(c=>downloadReceipt(c,token,id,version));
    const cancelled=data.status==="void",number=data.number.replace(/[^A-Za-z0-9_-]/g,"_").slice(0,64);
    return new Response(Uint8Array.from(data.bytes),{headers:{"Content-Type":"application/pdf","Content-Disposition":`attachment; filename="${cancelled?"CANCELLED-HISTORICAL-":""}${number}-v${data.version}.pdf"`,"Content-Length":String(data.bytes.length),"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Content-Security-Policy":"sandbox","X-Receipt-Status":cancelled?"cancelled":data.status,"X-Receipt-Version":String(data.version),"X-Receipt-Document-Type":"non-fiscal"}});
  }catch(error){
    if(error instanceof AuthenticationRequired)return authJson({ok:false,message:"Your session has ended. Sign in again."},401);
    if(error instanceof ReferenceError)return authJson({ok:false,code:error.code,message:error.message},error.status);
    return authJson({ok:false,message:"Receipt document temporarily unavailable."},503);
  }
}
