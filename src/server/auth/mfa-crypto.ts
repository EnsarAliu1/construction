import { randomBytes, createCipheriv, createDecipheriv, createHash } from 'node:crypto';
import * as OTPAuth from 'otpauth';
function keyRing() {
    const values: unknown = JSON.parse(process.env.MFA_ENCRYPTION_KEYS ?? '{}');
    if (!values || typeof values !== 'object' || Array.isArray(values))
        throw new Error('MFA key configuration unavailable.');
    const ring = new Map<string, Buffer>();
    for (const [id, value] of Object.entries(values)) {
        if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || typeof value !== 'string' || !/^[A-Za-z0-9+/]{43}=$/.test(value))
            throw new Error('MFA key configuration unavailable.');
        const bytes = Buffer.from(value, 'base64');
        if (bytes.length !== 32 || bytes.toString('base64') !== value)
            throw new Error('MFA key configuration unavailable.');
        ring.set(id, bytes);
    }
    return ring;
}
function key(id: string) { const value = keyRing().get(id); if (!value)
    throw new Error('MFA key configuration unavailable.'); return value; }
export function requireMfaKey() { const id = process.env.MFA_ENCRYPTION_KEY_ID; if (!id || !/^[A-Za-z0-9_-]{1,64}$/.test(id))
    throw new Error('MFA key configuration unavailable.'); key(id); return id; }
export function requireMfaKeyIds(ids: string[]) { if (!Array.isArray(ids) || !ids.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(id)))
    throw new Error('MFA recovery key identifiers unavailable.'); for (const id of ids)
    key(id); }
const aad = (user: string, generation: string, id: string) => Buffer.from(`fitimi-mfa/1:${user}:${generation}:${id}`);
export function sealMfaSeed(seed: string, user: string, generation: string) { const id = requireMfaKey(), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key(id), iv); cipher.setAAD(aad(user, generation, id)); const data = Buffer.concat([cipher.update(seed, 'utf8'), cipher.final()]); return { keyId: id, secretCipher: [iv, data, cipher.getAuthTag()].map(b => b.toString('base64')).join('.') }; }
export function openMfaSeed(value: {
    keyId: string;
    secretCipher: string;
}, user: string, generation: string) { const chunks = value.secretCipher.split('.').map(s => Buffer.from(s, 'base64')); if (chunks.length !== 3 || chunks[0].length !== 12 || chunks[2].length !== 16 || chunks[1].length > 128)
    throw new Error('MFA secret unavailable.'); const cipher = createDecipheriv('aes-256-gcm', key(value.keyId), chunks[0]); cipher.setAAD(aad(user, generation, value.keyId)); cipher.setAuthTag(chunks[2]); const plain = Buffer.concat([cipher.update(chunks[1]), cipher.final()]).toString('utf8'); if (!/^[A-Z2-7]{32}$/.test(plain))
    throw new Error('MFA secret unavailable.'); return plain; }
export const newMfaSeed = () => new OTPAuth.Secret({ size: 20 }).base32;
export function authenticator(seed: string, label = 'Workspace account') { return new OTPAuth.TOTP({ issuer: 'Fitimi Construction', label, algorithm: 'SHA1', digits: 6, period: 30, secret: OTPAuth.Secret.fromBase32(seed) }); }
/** RFC6238 interoperable +/- one 30s step. Replay acceptance is coordinated under the user/factor SQL lock. */
export function acceptedStep(seed: string, code: unknown, now = Date.now()) { if (typeof code !== 'string' || !/^\d{6}$/.test(code))
    return null; const delta = authenticator(seed).validate({ token: code, timestamp: now, window: 1 }); return delta === null ? null : Math.floor(now / 30000) + delta; }
export function newRecoveryCodes() { return Array.from({ length: 16 }, () => randomBytes(16).toString('hex').toUpperCase().match(/.{8}/g)!.join('-')); }
export function recoveryVerifier(user: string, generation: string, code: unknown) { if (typeof code !== 'string' || code.length > 100)
    return null; const normalized = code.replace(/[-\s]/g, '').toUpperCase(); if (!/^[0-9A-F]{32}$/.test(normalized))
    return null; return createHash('sha256').update(`fitimi-recovery/1:${user}:${generation}:${normalized}`).digest('hex'); }
