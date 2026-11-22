import {after} from 'next/server';
import {cloudDemoMode} from '@/server/demo/cloud-policy';
import {warmDemo} from '@/server/demo/runtime';
export const maxDuration=300;
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
 }catch(error){const cause=error&&typeof error==='object'&&'cause' in error?error.cause:error;const code=cause&&typeof cause==='object'&&'code' in cause?String(cause.code):undefined;const path=cause&&typeof cause==='object'&&'path' in cause?String(cause.path):'';console.error(JSON.stringify({event:'demo.start.failed',code:code&&/^[A-Z_0-9]{1,80}$/.test(code)?code:undefined,asset:/\.(?:ttf|afm|png|json|sql)$/.test(path)?path.split(/[\\/]/).at(-1):undefined}));return authJson({ok:false,message:'Demoja është e zënë ose përkohësisht e padisponueshme. Provoni përsëri pas një minute.'},503);}finally{if(cloudDemoMode())after(async()=>{await warmDemo().catch(error=>{console.error(JSON.stringify({event:'demo.warm.failed',code:error&&typeof error==='object'&&'code' in error?String(error.code):undefined}));});});}
}
