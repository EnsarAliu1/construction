import {sql} from 'drizzle-orm';
import {mysqlTable,mysqlEnum,varchar,char,bigint,int,json,index,check} from 'drizzle-orm/mysql-core';
import {id,referenceId,eventTime,timestamps,restrict} from './common';
import {users} from './identity';

export const authPasskeys=mysqlTable('auth_passkeys',{
 id:id(),userId:referenceId('user_id').notNull().references(()=>users.id,restrict),
 credentialId:varchar('credential_id',{length:1400}).notNull(),credentialHash:char('credential_hash',{length:64}).notNull().unique('passkey_credential_hash_uq'),
 publicKey:varchar('public_key',{length:2048}).notNull(),counter:bigint('counter',{mode:'number',unsigned:true}).notNull(),
 transports:json('transports').$type<string[]>().notNull(),deviceType:mysqlEnum('device_type',['singleDevice','multiDevice']).notNull(),
 backedUp:int('backed_up',{unsigned:true}).notNull(),userAuthVersion:int('user_auth_version',{unsigned:true}).notNull(),
 label:varchar('label',{length:80}).notNull(),lastUsedAt:eventTime('last_used_at'),revokedAt:eventTime('revoked_at'),...timestamps(),
},t=>[index('passkey_user_state_idx').on(t.userId,t.revokedAt),check('passkey_backed_up_ck',sql`${t.backedUp} IN (0,1)`),check('passkey_version_ck',sql`${t.userAuthVersion} >= 1`)]);

export const authPasskeyChallenges=mysqlTable('auth_passkey_challenges',{
 id:id(),userId:referenceId('user_id').references(()=>users.id,restrict),sourceSessionHash:char('source_session_hash',{length:64}),
 purpose:mysqlEnum('purpose',['register','authenticate']).notNull(),tokenHash:char('token_hash',{length:64}).notNull().unique('passkey_challenge_token_uq'),
 challengeHash:char('challenge_hash',{length:64}).notNull(),eligibleKeys:json('eligible_keys').$type<{id:string;version:number}[]>().notNull(),
 userAuthVersion:int('user_auth_version',{unsigned:true}),attempts:int('attempts',{unsigned:true}).notNull().default(0),
 expiresAt:eventTime('expires_at').notNull(),consumedAt:eventTime('consumed_at'),...timestamps(),
},t=>[index('passkey_challenge_expiry_idx').on(t.expiresAt),check('passkey_challenge_attempts_ck',sql`${t.attempts} <= 5`),check('passkey_challenge_binding_ck',sql`(${t.purpose} = 'register' AND ${t.userId} IS NOT NULL AND ${t.sourceSessionHash} IS NOT NULL AND ${t.userAuthVersion} IS NOT NULL) OR (${t.purpose} = 'authenticate' AND ${t.userId} IS NULL AND ${t.sourceSessionHash} IS NULL AND ${t.userAuthVersion} IS NULL)`)]);
