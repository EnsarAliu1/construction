import { randomUUID } from 'node:crypto';
import type { Connection, RowDataPacket } from 'mysql2/promise';
import { securityEvent, transaction } from './store';
import { newSessionToken, tokenDigest, validSessionToken, SESSION_SECONDS, normalizeEmail } from './security';
import { admitMfa } from './rate-limit';
import { requireSessionUser } from './sessions';
import { verifyPassword, hashPassword } from './password';
import { requireOperator, type OperatorContext } from './operator';
import { acceptedStep, authenticator, newMfaSeed, newRecoveryCodes, openMfaSeed, recoveryVerifier, requireMfaKey, sealMfaSeed } from './mfa-crypto';
export const MFA_SECONDS = 300;
type State = 'enroll' | 'verify' | 'ack';
export type MfaResult = {
    ok: false;
    limited?: boolean;
} | {
    ok: true;
    state: State | 'complete';
    token?: string;
    seed?: string;
    uri?: string;
    codes?: string[];
    setupShown?: boolean;
};
const denied = (limited = false): MfaResult => ({ ok: false, limited });
const decrypt = (row: RowDataPacket, user: string) => openMfaSeed({ keyId: row.key_id, secretCipher: row.secret_cipher }, user, row.id);
async function consume(c: Connection, id: string) { await c.execute("UPDATE auth_mfa_challenges SET state='consumed',consumed_at=UTC_TIMESTAMP(3),secret_cipher=NULL,key_id=NULL,recovery_hashes=NULL,updated_at=UTC_TIMESTAMP(3) WHERE id=?", [id]); }
export async function invalidateMfaChallenges(c: Connection, user: string) { await c.execute("UPDATE auth_mfa_challenges SET state='consumed',consumed_at=UTC_TIMESTAMP(3),secret_cipher=NULL,key_id=NULL,recovery_hashes=NULL,updated_at=UTC_TIMESTAMP(3) WHERE user_id=? AND state<>'consumed'", [user]); }
/** Called only by password verification while its authoritative user lock is held. Never issues a session. */
export async function passwordChallenge(c: Connection, user: string, version: number): Promise<{
    ok: false;
    limited: false;
} | {
    ok: true;
    token: string;
    state: State;
}> {
    requireMfaKey();
    await c.execute("UPDATE auth_mfa_challenges SET state='consumed',consumed_at=UTC_TIMESTAMP(3),secret_cipher=NULL,key_id=NULL,recovery_hashes=NULL,updated_at=UTC_TIMESTAMP(3) WHERE user_id=? AND expires_at<=UTC_TIMESTAMP(3) AND state<>'consumed'", [user]);
    const [f] = await c.execute<RowDataPacket[]>('SELECT id,restore_hold FROM auth_mfa_factors WHERE user_id=?', [user]);
    if (f.length && Number(f[0].restore_hold) !== 0)
        return { ok: false, limited: false };
    const token = newSessionToken(), state = f.length ? 'verify' : 'enroll';
    await c.execute("INSERT INTO auth_mfa_challenges(id,user_id,token_hash,user_auth_version,purpose,state,expires_at) VALUES(?,?,?,?,'login',?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND))", [randomUUID(), user, tokenDigest(token), version, state, MFA_SECONDS]);
    return { ok: true, token, state };
}
async function locate(c: Connection, token: string | undefined) {
    if (!validSessionToken(token))
        return null;
    const [r] = await c.execute<RowDataPacket[]>("SELECT id,user_id FROM auth_mfa_challenges WHERE token_hash=? AND state<>'consumed' AND expires_at>UTC_TIMESTAMP(3)", [tokenDigest(token)]);
    return r[0] ?? null;
}
async function locked(c: Connection, token: string | undefined, work: (challenge: RowDataPacket, user: RowDataPacket) => Promise<MfaResult>, attempt = true): Promise<MfaResult> {
    const found = await locate(c, token);
    if (!found)
        return denied();
    if (attempt) {
        const admission = await admitMfa(c, String(found.user_id));
        if (!admission.allowed) {
            if (admission.logThrottle)
                await securityEvent(c, 'mfa_throttled', found.id, found.user_id, { status: 'rate_limited' });
            return denied(true);
        }
    }
    return transaction(c, async () => {
        const [users] = await c.execute<RowDataPacket[]>('SELECT id,email,password_hash,auth_version,status FROM users WHERE id=? FOR UPDATE', [found.user_id]);
        const [rows] = await c.execute<RowDataPacket[]>('SELECT *,expires_at>UTC_TIMESTAMP(3) AS fresh FROM auth_mfa_challenges WHERE id=? FOR UPDATE', [found.id]);
        const u = users[0], ch = rows[0];
        if (!u || !ch || u.status !== 'active' || u.auth_version !== ch.user_auth_version || Number(ch.fresh) !== 1 || ch.state === 'consumed' || (ch.attempts >= 5 && (attempt || ch.state !== 'ack')))
            return denied(ch?.attempts >= 5);
        if (ch.source_session_hash) {
            const [s] = await c.execute<RowDataPacket[]>('SELECT id FROM auth_sessions WHERE token_hash=? AND user_id=? AND user_auth_version=? AND revoked_at IS NULL AND expires_at>UTC_TIMESTAMP(3) AND assurance_version=2', [ch.source_session_hash, u.id, u.auth_version]);
            if (!s.length)
                return denied();
        }
        if (attempt)
            await c.execute('UPDATE auth_mfa_challenges SET attempts=attempts+1 WHERE id=?', [ch.id]);
        const result = await work(ch, u);
        if (!result.ok && attempt)
            await securityEvent(c, 'mfa_challenge_failed', ch.id, u.id, { status: 'rejected' });
        return result;
    });
}
async function factor(c: Connection, user: string) { const [rows] = await c.execute<RowDataPacket[]>('SELECT * FROM auth_mfa_factors WHERE user_id=? FOR UPDATE', [user]); return rows[0]; }
async function acceptFactor(c: Connection, f: RowDataPacket, user: string, code: unknown) {
    const step = acceptedStep(decrypt(f, user), code);
    if (step === null)
        return false;
    if (step <= Number(f.last_step)) {
        await securityEvent(c, 'mfa_replay_rejected', f.id, user, { status: 'replay' });
        return false;
    }
    await c.execute('UPDATE auth_mfa_factors SET last_step=?,updated_at=UTC_TIMESTAMP(3) WHERE id=?', [step, f.id]);
    return true;
}
async function fullSession(c: Connection, user: RowDataPacket, ch: RowDataPacket): Promise<MfaResult> {
    const token = newSessionToken(), id = randomUUID();
    await consume(c, ch.id);
    await c.execute('INSERT INTO auth_sessions(id,user_id,token_hash,user_auth_version,assurance_version,mfa_verified_at,expires_at) VALUES(?,?,?,?,2,UTC_TIMESTAMP(3),DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND))', [id, user.id, tokenDigest(token), user.auth_version, SESSION_SECONDS]);
    await securityEvent(c, 'login_success', id, user.id, { status: 'mfa_verified' });
    return { ok: true, state: 'complete', token };
}
export async function challengeStatus(c: Connection, token: string | undefined) { return locked(c, token, async (ch) => ({ ok: true, state: ch.state as State, ...(ch.state === 'enroll' && ch.secret_cipher ? { setupShown: true } : {}) }), false); }
export async function startEnrollment(c: Connection, token: string | undefined): Promise<MfaResult> {
    return locked(c, token, async (ch, u) => {
        if (ch.state !== 'enroll' || ch.secret_cipher)
            return denied();
        const f = await factor(c, u.id);
        if (f && Number(f.restore_hold) !== 0)
            return denied();
        if (ch.purpose === 'login' && f || ch.purpose === 'replace' && !f)
            return denied();
        const seed = newMfaSeed(), sealed = sealMfaSeed(seed, u.id, ch.id);
        await c.execute('UPDATE auth_mfa_challenges SET secret_cipher=?,key_id=? WHERE id=?', [sealed.secretCipher, sealed.keyId, ch.id]);
        return { ok: true, state: 'enroll', seed, uri: authenticator(seed, "Hapësira e punës " + String(u.id).slice(0, 8)).toString() };
    }, false);
}
export async function proveEnrollment(c: Connection, token: string | undefined, code: unknown): Promise<MfaResult> {
    return locked(c, token, async (ch, u) => {
        if (ch.state !== 'enroll' || !ch.secret_cipher)
            return denied();
        const f = await factor(c, u.id);
        if (f && Number(f.restore_hold) !== 0)
            return denied();
        if (ch.purpose === 'login' && f || ch.purpose === 'replace' && !f)
            return denied();
        const step = acceptedStep(decrypt(ch, u.id), code);
        if (step === null)
            return denied();
        const codes = newRecoveryCodes(), hashes = codes.map(v => recoveryVerifier(u.id, ch.id, v)!);
        await c.execute("UPDATE auth_mfa_challenges SET state='ack',last_step=?,recovery_hashes=? WHERE id=?", [step, JSON.stringify(hashes), ch.id]);
        await securityEvent(c, 'mfa_enrollment_proof', ch.id, u.id, { status: 'awaiting_acknowledgement' });
        return { ok: true, state: 'ack', codes };
    });
}
export async function acknowledgeCodes(c: Connection, token: string | undefined, confirmation: unknown): Promise<MfaResult> {
    return locked(c, token, async (ch, u) => {
        if (ch.state !== 'ack' || confirmation !== 'saved')
            return denied();
        const f = await factor(c, u.id);
        if (f && Number(f.restore_hold) !== 0)
            return denied();
        if (ch.purpose === 'login' && f || ch.purpose !== 'login' && !f)
            return denied();
        const hashes = typeof ch.recovery_hashes === 'string' ? JSON.parse(ch.recovery_hashes) : ch.recovery_hashes;
        if (!Array.isArray(hashes) || hashes.length !== 16 || !hashes.every((v: unknown) => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v)))
            return denied();
        if (ch.purpose !== 'codes') {
            // A missing/rotated key must never result in an enabled but unreadable factor.
            decrypt(ch, u.id);
            if (f)
                await c.execute('UPDATE auth_mfa_factors SET id=?,secret_cipher=?,key_id=?,last_step=?,updated_at=UTC_TIMESTAMP(3) WHERE user_id=?', [ch.id, ch.secret_cipher, ch.key_id, ch.last_step, u.id]);
            else
                await c.execute('INSERT INTO auth_mfa_factors(id,user_id,secret_cipher,key_id,last_step) VALUES(?,?,?,?,?)', [ch.id, u.id, ch.secret_cipher, ch.key_id, ch.last_step]);
        }
        await c.execute('UPDATE auth_mfa_recovery_codes SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)),updated_at=UTC_TIMESTAMP(3) WHERE user_id=?', [u.id]);
        const generation = ch.purpose === 'codes' ? f.id : ch.id;
        for (const verifier of hashes)
            await c.execute('INSERT INTO auth_mfa_recovery_codes(id,user_id,generation_id,verifier) VALUES(?,?,?,?)', [randomUUID(), u.id, generation, verifier]);
        await c.execute('UPDATE users SET auth_version=auth_version+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?', [u.id]);
        u.auth_version++;
        await c.execute('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)),updated_at=UTC_TIMESTAMP(3) WHERE user_id=?', [u.id]);
        await invalidateMfaChallenges(c, u.id);
        await securityEvent(c, ch.purpose === 'login' ? 'mfa_enrolled' : ch.purpose === 'replace' ? 'mfa_factor_replaced' : 'mfa_recovery_codes_generated', ch.id, u.id, { status: 'completed' });
        await securityEvent(c, 'mfa_sessions_invalidated', ch.id, u.id, { status: 'completed' });
        return fullSession(c, u, ch);
    }, false);
}
export async function verifyMfa(c: Connection, token: string | undefined, code: unknown, recovery = false): Promise<MfaResult> {
    return locked(c, token, async (ch, u) => {
        if (ch.state !== 'verify' || ch.purpose !== 'login')
            return denied();
        const f = await factor(c, u.id);
        if (f && Number(f.restore_hold) !== 0)
            return denied();
        if (!f)
            return denied();
        // Even recovery must fail closed when the active factor key is unavailable.
        decrypt(f, u.id);
        if (recovery) {
            const verifier = recoveryVerifier(u.id, f.id, code);
            if (!verifier)
                return denied();
            const [codes] = await c.execute<RowDataPacket[]>('SELECT id FROM auth_mfa_recovery_codes WHERE user_id=? AND generation_id=? AND verifier=? AND used_at IS NULL AND revoked_at IS NULL FOR UPDATE', [u.id, f.id, verifier]);
            if (!codes.length)
                return denied();
            await c.execute('UPDATE auth_mfa_recovery_codes SET used_at=UTC_TIMESTAMP(3),updated_at=UTC_TIMESTAMP(3) WHERE id=?', [codes[0].id]);
            await securityEvent(c, 'mfa_recovery_used', codes[0].id, u.id, { status: 'completed' });
        }
        else if (!await acceptFactor(c, f, u.id, code))
            return denied();
        return fullSession(c, u, ch);
    });
}
export async function beginFactorChange(c: Connection, session: string | undefined, password: unknown, code: unknown, purpose: 'replace' | 'codes'): Promise<MfaResult> {
    const actor = await requireSessionUser(c, session);
    const admission = await admitMfa(c, actor.id, 'stepup');
    if (!admission.allowed) {
        if (admission.logThrottle)
            await securityEvent(c, 'mfa_throttled', actor.id, actor.id, { status: 'rate_limited' });
        return denied(true);
    }
    const [before] = await c.execute<RowDataPacket[]>('SELECT password_hash,auth_version FROM users WHERE id=?', [actor.id]);
    const observed = before[0];
    const matches = typeof password === 'string' && Buffer.byteLength(password, 'utf8') <= 1024 && await verifyPassword(password, observed?.password_hash);
    return transaction(c, async () => {
        const [users] = await c.execute<RowDataPacket[]>('SELECT * FROM users WHERE id=? FOR UPDATE', [actor.id]);
        const u = users[0];
        await requireSessionUser(c, session);
        const f = await factor(c, actor.id);
        if (!matches || !f || u.password_hash !== observed.password_hash || u.auth_version !== observed.auth_version || !await acceptFactor(c, f, u.id, code)) {
            await securityEvent(c, 'mfa_stepup_failed', u.id, u.id, { status: 'rejected' });
            return denied();
        }
        const id = randomUUID(), token = newSessionToken();
        await invalidateMfaChallenges(c, u.id);
        const codes = purpose === 'codes' ? newRecoveryCodes() : undefined, hashes = codes?.map(v => recoveryVerifier(u.id, f.id, v)!);
        await c.execute('INSERT INTO auth_mfa_challenges(id,user_id,token_hash,user_auth_version,purpose,state,source_session_hash,recovery_hashes,expires_at) VALUES(?,?,?,?,?,?,?,?,DATE_ADD(UTC_TIMESTAMP(3),INTERVAL ? SECOND))', [id, u.id, tokenDigest(token), u.auth_version, purpose, purpose === 'codes' ? 'ack' : 'enroll', tokenDigest(session!), hashes ? JSON.stringify(hashes) : null, MFA_SECONDS]);
        return { ok: true, state: purpose === 'codes' ? 'ack' : 'enroll', token, ...(codes ? { codes } : {}) };
    });
}
export async function cancelMfa(c: Connection, token: string | undefined) {
    const found = await locate(c, token);
    if (!found)
        return;
    await transaction(c, async () => { await c.execute('SELECT id FROM users WHERE id=? FOR UPDATE', [found.user_id]); await consume(c, found.id); });
}
export async function resetMfa(c: Connection, operator: OperatorContext, email: string, input: {
    reason: string;
    identityVerified: boolean;
    confirmation: string;
    newPassword?: string;
}) {
    requireOperator(operator);
    const reasons = ['lost-authenticator-and-codes', 'suspected-factor-compromise', 'verified-device-replacement', 'verified-disaster-recovery'];
    if (input.identityVerified !== true || input.confirmation !== 'reset-mfa' || !reasons.includes(input.reason))
        throw new Error("Kërkohet identitet i verifikuar në mënyrë të pavarur, arsye e miratuar pa të dhëna të ndjeshme dhe konfirmim i qartë i rivendosjes.");
    if (input.reason === 'verified-disaster-recovery' && typeof input.newPassword !== 'string')
        throw new Error("Rikuperimi pas incidentit kërkon fjalëkalim të ri dhe regjistrim të ri MFA.");
    if (!(await admitMfa(c, tokenDigest(normalizeEmail(email)), 'operator-reset')).allowed)
        throw new Error("Rikuperimi nga operatori është përkohësisht i kufizuar.");
    const replacementHash = typeof input.newPassword === 'string' ? await hashPassword(input.newPassword) : null;
    return transaction(c, async () => {
        const [rows] = await c.execute<RowDataPacket[]>('SELECT id,password_hash FROM users WHERE email=? FOR UPDATE', [normalizeEmail(email)]);
        if (!rows.length)
            throw new Error("Llogaria është e padisponueshme.");
        const user = String(rows[0].id);
        const [factors] = await c.execute<RowDataPacket[]>('SELECT restore_hold FROM auth_mfa_factors WHERE user_id=? FOR UPDATE', [user]);
        if (factors.length && Number(factors[0].restore_hold) !== 0 && input.reason !== 'verified-disaster-recovery')
            throw new Error("Bllokimi pas rikthimit kërkon rikuperim të verifikuar nga operatori.");
        if (replacementHash && await verifyPassword(input.newPassword!, rows[0].password_hash))
            throw new Error("Përdorni fjalëkalim të ri pas rikuperimit.");
        await securityEvent(c, 'mfa_operator_reset_initiated', user, null, { description: input.reason.trim(), status: 'identity_verified' });
        if (replacementHash) {
            await c.execute('UPDATE users SET password_hash=? WHERE id=?', [replacementHash, user]);
            await securityEvent(c, 'mfa_recovery_password_rotated', user, null, { status: 'completed' });
        }
        await c.execute('DELETE FROM auth_mfa_factors WHERE user_id=?', [user]);
        await c.execute('UPDATE auth_mfa_recovery_codes SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)),updated_at=UTC_TIMESTAMP(3) WHERE user_id=?', [user]);
        await c.execute('UPDATE users SET auth_version=auth_version+1,updated_at=UTC_TIMESTAMP(3) WHERE id=?', [user]);
        await c.execute('UPDATE auth_sessions SET revoked_at=COALESCE(revoked_at,UTC_TIMESTAMP(3)),updated_at=UTC_TIMESTAMP(3) WHERE user_id=?', [user]);
        await invalidateMfaChallenges(c, user);
        await securityEvent(c, 'mfa_operator_reset_completed', user, null, { status: 'enrollment_required' });
    });
}
