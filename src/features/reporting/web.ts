import "server-only";
import {cookies} from "next/headers";
import {redirect} from "next/navigation";
import type {Connection} from "mysql2/promise";
import {requirePageUser} from "@/server/auth/web";
import {AuthenticationRequired,sessionCookieSettings} from "@/server/auth/security";
import {withAuthConnection} from "@/server/auth/store";
import {ReferenceError} from "@/features/references/validation";
export async function reportingPage<T>(path:string,work:(c:Connection,t:string|undefined)=>Promise<T>){
 await requirePageUser(path);const token=(await cookies()).get(sessionCookieSettings().name)?.value;
 try{return {data:await withAuthConnection(c=>work(c,token)),error:null};}catch(error){if(error instanceof AuthenticationRequired)redirect(`/login?returnTo=${encodeURIComponent(path)}`);return {data:null,error:error instanceof ReferenceError?error.message:"Financial data is temporarily unavailable. Retry or contact your operator."};}
}
