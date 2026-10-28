import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import test from 'node:test';
import * as OTPAuth from 'otpauth';
import { acceptedStep, newMfaSeed, sealMfaSeed, openMfaSeed, newRecoveryCodes, recoveryVerifier, requireMfaKey } from '../../src/server/auth/mfa-crypto';
test('RFC6238 vectors, strict numeric input, narrow drift boundaries and cryptographic seed size', () => {
    const secret = OTPAuth.Secret.fromUTF8('12345678901234567890');
    for (const [seconds, expected] of [[59, '94287082'], [1111111109, '07081804'], [1111111111, '14050471'], [1234567890, '89005924'], [2000000000, '69279037']] as const)
        assert.equal(new OTPAuth.TOTP({ secret, algorithm: 'SHA1', digits: 8, period: 30 }).generate({ timestamp: seconds * 1000 }), expected);
    const seed = newMfaSeed(), now = 1234567890000, otp = new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(seed), digits: 6, period: 30 });
    assert.match(seed, /^[A-Z2-7]{32}$/);
    for (const delta of [-1, 0, 1])
        assert.equal(acceptedStep(seed, otp.generate({ timestamp: now + delta * 30000 }), now), Math.floor(now / 30000) + delta);
    assert.equal(acceptedStep(seed, otp.generate({ timestamp: now - 60000 }), now), null);
    for (const code of ['12345', '1234567', ' 123456', 'abcdef', 123456, null])
        assert.equal(acceptedStep(seed, code, now), null);
});
test('MFA seed encryption is randomized, user/generation/key-bound and fails closed without an explicit key', () => {
    const old = process.env.MFA_ENCRYPTION_KEYS, id = process.env.MFA_ENCRYPTION_KEY_ID;
    try {
        delete process.env.MFA_ENCRYPTION_KEYS;
        delete process.env.MFA_ENCRYPTION_KEY_ID;
        assert.throws(requireMfaKey);
        process.env.MFA_ENCRYPTION_KEY_ID = 'test';
        process.env.MFA_ENCRYPTION_KEYS = JSON.stringify({ test: randomBytes(32).toString('base64') });
        const seed = newMfaSeed(), one = sealMfaSeed(seed, 'user', 'generation'), two = sealMfaSeed(seed, 'user', 'generation');
        assert.notEqual(one.secretCipher, two.secretCipher);
        assert(!one.secretCipher.includes(seed));
        assert.equal(openMfaSeed(one, 'user', 'generation'), seed);
        assert.throws(() => openMfaSeed(one, 'other', 'generation'));
        assert.throws(() => openMfaSeed(one, 'user', 'other'));
        assert.throws(() => openMfaSeed({ ...one, secretCipher: one.secretCipher.slice(0, -4) + 'AAAA' }, 'user', 'generation'));
        process.env.MFA_ENCRYPTION_KEYS = JSON.stringify({ test: randomBytes(32).toString('base64') });
        assert.throws(() => openMfaSeed(one, 'user', 'generation'));
        delete process.env.MFA_ENCRYPTION_KEYS;
        assert.throws(() => openMfaSeed(one, 'user', 'generation'));
    }
    finally {
        if (old === undefined)
            delete process.env.MFA_ENCRYPTION_KEYS;
        else
            process.env.MFA_ENCRYPTION_KEYS = old;
        if (id === undefined)
            delete process.env.MFA_ENCRYPTION_KEY_ID;
        else
            process.env.MFA_ENCRYPTION_KEY_ID = id;
    }
});
test('sixteen random 128-bit recovery codes have scoped irreversible verifiers and transcription-safe normalization', () => {
    const codes = newRecoveryCodes();
    assert.equal(codes.length, 16);
    assert.equal(new Set(codes).size, 16);
    for (const code of codes) {
        assert.match(code, /^(?:[0-9A-F]{8}-){3}[0-9A-F]{8}$/);
        const hash = recoveryVerifier('u', 'g', code)!;
        assert.match(hash, /^[a-f0-9]{64}$/);
        assert.notEqual(hash, code);
        assert.equal(hash, recoveryVerifier('u', 'g', code.toLowerCase().replaceAll('-', ' ')));
        assert.notEqual(hash, recoveryVerifier('v', 'g', code));
    }
    assert.equal(recoveryVerifier('u', 'g', 'guess'), null);
});
