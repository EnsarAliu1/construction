import {createHmac} from 'node:crypto';

export const DEMO_SECONDS=30*60;
export const DEMO_DATABASE=/^fitimi_demo_[a-f0-9]{24}$/;
export const DEMO_LABEL='DEMO — Të dhëna fiktive';
export function demoMode(){return process.env.DEMO_MODE==='1';}
export function demoDatabase(value:string){if(!DEMO_DATABASE.test(value))throw new Error('Invalid demo database');return value;}
export function demoUsername(database:string){return `d_${demoDatabase(database).slice(12)}`;}
export function demoPassword(database:string){
 const key=process.env.DEMO_PRIVATE_KEY;
 if(!key||!/^[a-f0-9]{64}$/.test(key))throw new Error('Demo private key required');
 return createHmac('sha256',key).update(demoDatabase(database)).digest('hex');
}
export function demoEntryUrl(){
 if(demoMode())return '/administrata';
 const value=process.env.DEMO_ORIGIN;
 if(!value)return null;
 const url=new URL(value);
 if(url.username||url.password||url.search||url.hash||url.pathname!=='/'||(url.protocol!=='https:'&&!(process.env.NODE_ENV!=='production'&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname))))throw new Error('Invalid demo origin');
 if(process.env.AUTH_ORIGIN){
  const real=new URL(process.env.AUTH_ORIGIN);
  if(url.origin===real.origin||process.env.NODE_ENV==='production'&&url.hostname===real.hostname)throw new Error('Demo must use a separate application origin and production hostname');
 }
 return `${url.origin}/administrata?demo=1`;
}
/** Optional demo configuration must never prevent real users from signing in. */
export function safeDemoEntryUrl(){try{return demoEntryUrl();}catch{return null;}}
