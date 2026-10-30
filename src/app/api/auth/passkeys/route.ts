import {NextResponse,type NextRequest} from 'next/server';
import {authJson,limitedJson,setSessionCookie,clearSessionCookie,clearChallengeCookie} from '@/server/auth/http';
import {assertSameOrigin,safeReturnPath,AuthenticationRequired,sessionCookieSettings} from '@/server/auth/security';
import {withAuthConnection} from '@/server/auth/store';
import {sessionUser} from '@/server/auth/sessions';
import {beginPasskeyRegistration,finishPasskeyRegistration,beginPasskeyAuthentication,finishPasskeyAuthentication,listPasskeys,removePasskey,PasskeyRejected} from '@/server/auth/passkeys';

export const runtime='nodejs';
function cookieSettings(){const base=sessionCookieSettings();return {...base,name:base.secure?'__Host-fitimi_passkey':'fitimi_passkey',sameSite:'strict' as const,maxAge:120};}
function challengeToken(r:NextRequest){return r.cookies.get(cookieSettings().name)?.value;}
function setPending(response:NextResponse,token:string){const {name,...settings}=cookieSettings();response.cookies.set(name,token,settings);}
function clearPending(response:NextResponse){const {name,...settings}=cookieSettings();response.cookies.set(name,'',{...settings,maxAge:0});}
function failure(error:unknown){
 if(error instanceof AuthenticationRequired)return authJson({ok:false,message:'Përfundoni hyrjen për të menaxhuar pajisjet.'},401);
 if(error instanceof PasskeyRejected){const recent=error.reason==='recent',limited=error.reason==='limited';return authJson({ok:false,reauthenticate:recent,message:recent?'Për siguri, dilni dhe hyni sërish para se të shtoni ose hiqni një passkey.':limited?'Shumë përpjekje. Prisni para se të provoni sërish.':'Verifikimi i pajisjes dështoi ose skadoi. Provoni sërish ose përdorni hyrjen me fjalëkalim.'},limited?429:401);}
 return authJson({ok:false,message:'Hyrja me pajisje është përkohësisht e padisponueshme. Përdorni hyrjen me fjalëkalim.'},503);
}
export async function GET(r:NextRequest){try{return authJson({ok:true,keys:await withAuthConnection(c=>listPasskeys(c,r.cookies.get(sessionCookieSettings().name)?.value))});}catch(error){return failure(error);}}
export async function POST(r:NextRequest){
 try{assertSameOrigin(r.headers);}catch{return authJson({ok:false,message:'Kërkesa u refuzua. Hapeni hyrjen në adresën e konfiguruar të aplikacionit.'},403);}
 let body:Record<string,unknown>;try{body=await limitedJson(r,32768);if(Object.keys(body).some(k=>!['action','response','label','id','returnTo'].includes(k)))throw new Error();}catch{return authJson({ok:false,message:'Kërkesë e pavlefshme.'},400);}
 const session=r.cookies.get(sessionCookieSettings().name)?.value;
 try{
  if(body.action==='authentication-options'||body.action==='registration-options'){
   const value=body.action==='registration-options'?await withAuthConnection(c=>beginPasskeyRegistration(c,session)):await withAuthConnection(c=>beginPasskeyAuthentication(c));
   const response=authJson({ok:true,options:value.options});setPending(response,value.token);return response;
  }
  if(body.action==='authenticate'){
   const result=await withAuthConnection(c=>finishPasskeyAuthentication(c,challengeToken(r),body.response,session));
   if(!result.ok)throw new PasskeyRejected();const response=authJson({ok:true,returnTo:safeReturnPath(body.returnTo)});setSessionCookie(response,result.token);clearPending(response);clearChallengeCookie(response);return response;
  }
  if(body.action==='register'){
   const result=await withAuthConnection(c=>finishPasskeyRegistration(c,session,challengeToken(r),body.response,body.label));if(!result.ok)throw new PasskeyRejected();const response=authJson(result);clearPending(response);return response;
  }
  if(body.action==='remove'){
   const active=await withAuthConnection(async c=>{await removePasskey(c,session,body.id);return Boolean(await sessionUser(c,session));});
   const response=authJson({ok:true,needsLogin:!active});if(!active)clearSessionCookie(response);return response;
  }
  return authJson({ok:false,message:'Verifikimi nuk u përfundua.'},401);
 }catch(error){return failure(error);}
}
