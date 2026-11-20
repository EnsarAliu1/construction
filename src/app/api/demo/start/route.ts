import type {NextRequest} from 'next/server';
import {assertSameOrigin,sessionCookieSettings} from '@/server/auth/security';
import {authJson,setSessionCookie} from '@/server/auth/http';
import {demoMode,DEMO_SECONDS} from '@/server/demo/policy';
import {startDemo} from '@/server/demo/runtime';

export const runtime='nodejs';
export async function POST(request:NextRequest){
 if(!demoMode())return authJson({ok:false},404);
 try{assertSameOrigin(request.headers);}catch{return authJson({ok:false,message:'Kërkesa u refuzua.'},403);}
 try{
  const result=await startDemo(request.cookies.get(sessionCookieSettings().name)?.value),response=authJson({ok:true,url:'/app'});
  setSessionCookie(response,result.token);
  const {name,...attributes}=sessionCookieSettings();response.cookies.set(name,result.token,{...attributes,maxAge:DEMO_SECONDS});return response;
 }catch{return authJson({ok:false,message:'Demoja është e zënë ose përkohësisht e padisponueshme. Provoni përsëri pas një minute.'},503);}
}
