import { sql } from 'drizzle-orm';
import { mysqlTable, mysqlEnum, char, varchar, int, bigint, json, index, check } from 'drizzle-orm/mysql-core';
import { id, referenceId, eventTime, timestamps, restrict } from './common';
import { users } from './identity';
// Exactly one active factor per identity. Old generation IDs survive only in audit/revoked code records.
export const authMfaFactors = mysqlTable('auth_mfa_factors', {
    id: id(), userId: referenceId('user_id').notNull().unique('mfa_factor_user_uq').references(() => users.id, restrict),
    secretCipher: varchar('secret_cipher', { length: 2048 }).notNull(), keyId: varchar('key_id', { length: 64 }).notNull(),
    restoreHold: int('restore_hold',{unsigned:true}).notNull().default(0),
    lastStep: bigint('last_step', { mode: 'number', unsigned: true }).notNull(), ...timestamps(),
}, t => [check('mfa_factor_step_ck', sql `${t.lastStep} >= 0`),check('mfa_factor_restore_hold_ck',sql `${t.restoreHold} IN (0,1)`)]);
export const authMfaChallenges = mysqlTable('auth_mfa_challenges', {
    id: id(), userId: referenceId('user_id').notNull().references(() => users.id, restrict),
    tokenHash: char('token_hash', { length: 64 }).notNull().unique('mfa_challenge_token_uq'),
    userAuthVersion: int('user_auth_version', { unsigned: true }).notNull(),
    sourceSessionHash: char('source_session_hash', { length: 64 }),
    purpose: mysqlEnum('purpose', ['login', 'replace', 'codes']).notNull(),
    state: mysqlEnum('state', ['enroll', 'verify', 'ack', 'consumed']).notNull(),
    secretCipher: varchar('secret_cipher', { length: 2048 }), keyId: varchar('key_id', { length: 64 }),
    recoveryHashes: json('recovery_hashes').$type<string[]>(), lastStep: bigint('last_step', { mode: 'number', unsigned: true }),
    attempts: int('attempts', { unsigned: true }).notNull().default(0), expiresAt: eventTime('expires_at').notNull(),
    consumedAt: eventTime('consumed_at'), ...timestamps(),
}, t => [index('mfa_challenge_user_state_idx').on(t.userId, t.state, t.expiresAt), index('mfa_challenge_expiry_idx').on(t.expiresAt),
    check('mfa_challenge_attempts_ck', sql `${t.attempts} <= 5`), check('mfa_challenge_version_ck', sql `${t.userAuthVersion} >= 1`),
    check('mfa_challenge_secret_pair_ck', sql `(${t.secretCipher} IS NULL) = (${t.keyId} IS NULL)`),
    check('mfa_challenge_consumed_ck', sql `(${t.state} = 'consumed') = (${t.consumedAt} IS NOT NULL)`),
]);
export const authMfaRecoveryCodes = mysqlTable('auth_mfa_recovery_codes', {
    id: id(), userId: referenceId('user_id').notNull().references(() => users.id, restrict),
    generationId: referenceId('generation_id').notNull(), verifier: char('verifier', { length: 64 }).notNull().unique('mfa_recovery_verifier_uq'),
    usedAt: eventTime('used_at'), revokedAt: eventTime('revoked_at'), ...timestamps(),
}, t => [index('mfa_recovery_user_generation_idx').on(t.userId, t.generationId, t.usedAt, t.revokedAt)]);
