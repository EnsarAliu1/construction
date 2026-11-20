import {randomUUID} from 'node:crypto';
import type {Connection,RowDataPacket} from 'mysql2/promise';
import {generateRegistrationOptions,verifyRegistrationResponse,generateAuthenticationOptions,verifyAuthenticationResponse,type RegistrationResponseJSON,type AuthenticationResponseJSON,type AuthenticatorTransport} from '@simplewebauthn/server';
import {transaction,securityEvent} from './store';
import {requireSessionUser} from './sessions';
import {trustedOrigin,newSessionToken,tokenDigest,validSessionToken,SESSION_SECONDS,AuthenticationRequired} from './security';

const TTL=120,RECENT=300,MAX_KEYS=8;
export class PasskeyRejected extends Error{constructor(public reason:'rejected'|'limited'|'recent'='rejected'){super('Verifikimi i pajisjes dështoi.');}}
export function passkeyRelyingParty(){const origin=trustedOrigin();if(/^\d+\.\d+\.\d+\.\d+$/.test(origin.hostname)||origin.hostname.includes(':'))throw new PasskeyRejected();return {origin:origin.origin,rpID:origin.hostname};}
function parsed<T>(value:unknown):T{return typeof value==='string'?JSON.parse(value) as T:value as T;}
function responseId(value:unknown):string{
 if(!value||typeof value!=='object'||!('id'in value)||typeof value.id!=='string'||!('rawId'in value)||value.rawId!==value.id||!(/^[A-Za-z0-9_-]{16,1400}$/).test(value.id))throw new PasskeyRejected();return value.id;
}
async function limit(c:Connection,kind:string,subject?:string){
 const buckets=[{key:tokenDigest(`passkey:${kind}:global`),n:60,seconds:60},...(subject?[{key:tokenDigest(`passkey:${kind}:${subject}`),n:10,seconds:900}]:[])].sort((a,b)=>a.key.localeCompare(b.key));
 const allowed=await transaction(c,async()=>{let ok=true;for(const b of buckets){await c.execute('INSERT INTO auth_login_limits(bucket_key,attempt_count,window_ends_at) VALUES(?,1,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND)) ON DUPLICATE KEY UPDATE attempt_count=IF(window_ends_at<=UTC_TIMESTAMP(3),1,LEAST(attempt_count+1,?)),window_ends_at=IF(window_ends_at<=UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND),window_ends_at)',[b.key,b.seconds,b.n+1,b.seconds]);const [r]=await c.execute<RowDataPacket[]>('SELECT attempt_count FROM auth_login_limits WHERE bucket_key=?',[b.key]);if(Number(r[0].attempt_count)>b.n)ok=false;}return ok;});
 if(!allowed)throw new PasskeyRejected('limited');
}
async function userLock(c:Connection,id:string){const [rows]=await c.execute<RowDataPacket[]>('SELECT * FROM users WHERE id=? FOR UPDATE',[id]);const [factors]=await c.execute<RowDataPacket[]>('SELECT restore_hold FROM auth_mfa_factors WHERE user_id=? FOR UPDATE',[id]);const u=rows[0];if(!u||u.status!=='active'||!factors[0]||Number(factors[0].restore_hold)!==0)throw new PasskeyRejected();return u;}
async function recentSession(c:Connection,token:string|undefined,user:string){
 if(!validSessionToken(token))throw new AuthenticationRequired();
 const [r]=await c.execute<RowDataPacket[]>('SELECT id,user_auth_version,mfa_verified_at>=DATE_SUB(UTC_TIMESTAMP(3),INTERVAL ? SECOND) AS recent FROM auth_sessions WHERE token_hash=? AND user_id=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(3) AND assurance_version=2 FOR UPDATE',[RECENT,tokenDigest(token),user]);
 if(!r[0])throw new AuthenticationRequired();if(Number(r[0].recent)!==1)throw new PasskeyRejected('recent');return r[0];
}
export async function listPasskeys(c:Connection,token:string|undefined){const user=await requireSessionUser(c,token);const [rows]=await c.execute<RowDataPacket[]>('SELECT p.id,p.label,p.created_at,p.last_used_at,p.device_type,p.backed_up FROM auth_passkeys p JOIN users u ON u.id=p.user_id WHERE p.user_id=? AND p.revoked_at IS NULL AND p.user_auth_version=u.auth_version ORDER BY p.created_at',[user.id]);return rows;}
async function saveChallenge(c:Connection,purpose:'register'|'authenticate',challenge:string,eligibleKeys:{id:string;version:number}[],user?:RowDataPacket,session?:string){
 const token=newSessionToken();
 // Bounded cleanup, including consumed challenges; no credential material or tokens enter audit.
 await c.query('DELETE FROM auth_passkey_challenges WHERE expires_at<DATE_SUB(UTC_TIMESTAMP(3),INTERVAL 1 DAY) LIMIT 100');
 await c.execute('INSERT INTO auth_passkey_challenges(id,user_id,source_session_hash,purpose,token_hash,challenge_hash,eligible_keys,user_auth_version,expires_at) VALUES(?,?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND))',[randomUUID(),user?.id??null,session?tokenDigest(session):null,purpose,tokenDigest(token),tokenDigest(challenge),JSON.stringify(eligibleKeys),user?.auth_version??null,TTL]);return token;
}
export async function beginPasskeyRegistration(c:Connection,session:string|undefined){
 const user=await requireSessionUser(c,session);await limit(c,'register',user.id);const rp=passkeyRelyingParty();
 return transaction(c,async()=>{const u=await userLock(c,user.id);await requireSessionUser(c,session);await recentSession(c,session,user.id);
  const [keys]=await c.execute<RowDataPacket[]>('SELECT credential_id FROM auth_passkeys WHERE user_id=? AND revoked_at IS NULL AND user_auth_version=?',[user.id,u.auth_version]);if(keys.length>=MAX_KEYS)throw new PasskeyRejected();
  const options=await generateRegistrationOptions({rpName:'Construction',rpID:rp.rpID,userID:new TextEncoder().encode(user.id),userName:u.email,userDisplayName:u.display_name,attestationType:'none',timeout:60000,authenticatorSelection:{residentKey:'required',userVerification:'required',authenticatorAttachment:'platform'},supportedAlgorithmIDs:[-7,-257],excludeCredentials:keys.map(k=>({id:k.credential_id}))});
  return {options,token:await saveChallenge(c,'register',options.challenge,[],u,session)};
 });
}
async function challenge(c:Connection,token:string|undefined,purpose:string,lock=false){
 if(!validSessionToken(token))throw new PasskeyRejected();
 const [rows]=await c.execute<RowDataPacket[]>(`SELECT *,expires_at>UTC_TIMESTAMP(3) AS fresh FROM auth_passkey_challenges WHERE token_hash=? AND purpose=?${lock?' FOR UPDATE':''}`,[tokenDigest(token),purpose]);
 const ch=rows[0];if(!ch||Number(ch.fresh)!==1||ch.consumed_at||Number(ch.attempts)>=5)throw new PasskeyRejected();return ch;
}
async function consumed(c:Connection,id:string){await c.execute('UPDATE auth_passkey_challenges SET consumed_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?',[id]);}
async function failed(c:Connection,ch:RowDataPacket,user?:string){await c.execute('UPDATE auth_passkey_challenges SET attempts=attempts+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?',[ch.id]);await securityEvent(c,'passkey_verification_failed',ch.id,user??null,{status:'rejected'});return {ok:false as const};}
export async function finishPasskeyRegistration(c:Connection,session:string|undefined,token:string|undefined,response:unknown,label:unknown){
 const user=await requireSessionUser(c,session),id=responseId(response),rp=passkeyRelyingParty();
 if(typeof label!=='string'||!label.trim()||label.trim().length>80||/[\p{C}]/u.test(label))throw new PasskeyRejected();
 await limit(c,'register-verify',user.id);
 return transaction(c,async()=>{const u=await userLock(c,user.id);await requireSessionUser(c,session);await recentSession(c,session,user.id);const ch=await challenge(c,token,'register',true);
  if(ch.user_id!==user.id||ch.source_session_hash!==tokenDigest(session!)||ch.user_auth_version!==u.auth_version)throw new PasskeyRejected();
  const [keys]=await c.execute<RowDataPacket[]>('SELECT id FROM auth_passkeys WHERE user_id=? AND revoked_at IS NULL AND user_auth_version=?',[user.id,u.auth_version]);if(keys.length>=MAX_KEYS)throw new PasskeyRejected();
  let verified;try{verified=await verifyRegistrationResponse({response:response as RegistrationResponseJSON,expectedChallenge:value=>tokenDigest(value)===ch.challenge_hash,expectedOrigin:rp.origin,expectedRPID:rp.rpID,requireUserVerification:true,supportedAlgorithmIDs:[-7,-257]});}catch{return failed(c,ch,user.id);}
  if(!verified.verified||!verified.registrationInfo.userVerified||verified.registrationInfo.credential.id!==id)return failed(c,ch,user.id);
  const info=verified.registrationInfo,key=info.credential,pkId=randomUUID();
  const [existing]=await c.execute<RowDataPacket[]>('SELECT id FROM auth_passkeys WHERE credential_hash=?',[tokenDigest(id)]);if(existing.length)return failed(c,ch,user.id);
  const transports=(key.transports??[]).filter(t=>['ble','hybrid','internal','nfc','usb','smart-card'].includes(t));
  await c.execute('INSERT INTO auth_passkeys(id,user_id,credential_id,credential_hash,public_key,counter,transports,device_type,backed_up,user_auth_version,label) VALUES(?,?,?,?,?,?,?,?,?,?,?)',[pkId,user.id,id,tokenDigest(id),Buffer.from(key.publicKey).toString('base64url'),key.counter,JSON.stringify(transports),info.credentialDeviceType,info.credentialBackedUp?1:0,u.auth_version,label.trim()]);
  await consumed(c,ch.id);await securityEvent(c,'passkey_registered',pkId,user.id,{status:'user_verified'});return {ok:true as const};
 });
}
export async function beginPasskeyAuthentication(c:Connection){
 const rp=passkeyRelyingParty();await limit(c,'options');
 const [keys]=await c.query<RowDataPacket[]>('SELECT p.id,p.user_auth_version AS version FROM auth_passkeys p JOIN users u ON u.id=p.user_id JOIN auth_mfa_factors f ON f.user_id=u.id WHERE p.revoked_at IS NULL AND p.user_auth_version=u.auth_version AND u.status=\'active\' AND f.restore_hold=0');
 const options=await generateAuthenticationOptions({rpID:rp.rpID,userVerification:'required',timeout:60000});
 options.hints=['client-device'];
 return {options,token:await saveChallenge(c,'authenticate',options.challenge,keys.map(k=>({id:String(k.id),version:Number(k.version)})))};
}
export async function finishPasskeyAuthentication(c:Connection,token:string|undefined,response:unknown,previousSession?:string){
 const id=responseId(response),rp=passkeyRelyingParty();await limit(c,'verify',tokenDigest(id));
 await challenge(c,token,'authenticate');const [found]=await c.execute<RowDataPacket[]>('SELECT user_id FROM auth_passkeys WHERE credential_hash=?',[tokenDigest(id)]);if(!found[0])throw new PasskeyRejected();
 return transaction(c,async()=>{const u=await userLock(c,found[0].user_id),ch=await challenge(c,token,'authenticate',true);
  const [keys]=await c.execute<RowDataPacket[]>('SELECT * FROM auth_passkeys WHERE credential_hash=? AND user_id=? FOR UPDATE',[tokenDigest(id),u.id]);const pk=keys[0];
  const eligible=parsed<{id:string;version:number}[]>(ch.eligible_keys);
  if(!pk||pk.revoked_at||pk.user_auth_version!==u.auth_version||!eligible.some(k=>k.id===pk.id&&k.version===u.auth_version))throw new PasskeyRejected();
  const credential=response as AuthenticationResponseJSON;
  if(credential.response?.userHandle!==Buffer.from(String(u.id)).toString('base64url'))return failed(c,ch,u.id);
  let verified;try{verified=await verifyAuthenticationResponse({response:credential,expectedChallenge:value=>tokenDigest(value)===ch.challenge_hash,expectedOrigin:rp.origin,expectedRPID:rp.rpID,requireUserVerification:true,credential:{id:pk.credential_id,publicKey:new Uint8Array(Buffer.from(pk.public_key,'base64url')),counter:Number(pk.counter),transports:parsed<AuthenticatorTransport[]>(pk.transports)}});}catch{return failed(c,ch,u.id);}
  if(!verified.verified||!verified.authenticationInfo.userVerified)return failed(c,ch,u.id);
  await consumed(c,ch.id);await c.execute('UPDATE auth_passkeys SET counter=?,last_used_at=UTC_TIMESTAMP(3),backed_up=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?',[verified.authenticationInfo.newCounter,verified.authenticationInfo.credentialBackedUp?1:0,pk.id]);
  if(validSessionToken(previousSession))await c.execute('UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE token_hash=? AND user_id=? AND revoked_at IS NULL',[tokenDigest(previousSession),u.id]);
  const fullToken=newSessionToken(),sessionId=randomUUID();await c.execute('INSERT INTO auth_sessions(id,user_id,passkey_id,token_hash,user_auth_version,assurance_version,mfa_verified_at,expires_at) VALUES(?,?,?,?,?,2,UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND))',[sessionId,u.id,pk.id,tokenDigest(fullToken),u.auth_version,SESSION_SECONDS]);
  await securityEvent(c,'passkey_login_success',sessionId,u.id,{status:'user_verified'});return {ok:true as const,token:fullToken};
 });
}
export async function removePasskey(c:Connection,session:string|undefined,id:unknown){
 const user=await requireSessionUser(c,session);if(typeof id!=='string'||!(/^[a-f0-9-]{36}$/i).test(id))throw new PasskeyRejected();await limit(c,'remove',user.id);
 return transaction(c,async()=>{await userLock(c,user.id);await requireSessionUser(c,session);await recentSession(c,session,user.id);
  const [keys]=await c.execute<RowDataPacket[]>('SELECT id FROM auth_passkeys WHERE id=? AND user_id=? AND revoked_at IS NULL FOR UPDATE',[id,user.id]);if(!keys.length)throw new PasskeyRejected();
  await c.execute('UPDATE auth_passkeys SET revoked_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?',[id]);
  await c.execute('UPDATE auth_sessions SET revoked_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE passkey_id=? AND revoked_at IS NULL',[id]);
  await securityEvent(c,'passkey_revoked',id,user.id,{status:'sessions_revoked'});return {ok:true as const};
 });
}
