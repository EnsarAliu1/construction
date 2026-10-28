# Mandatory MFA operation and recovery — WP-16

**Local reference implementation. NO-GO FOR PRODUCTION.** Owner-approved policy: every active business user needs a password plus an enrolled authenticator or a single-use recovery code. All five retain equal business permissions. Operator provisioning/recovery remains separate; no application administrator, public registration, SMS, email OTP or public factor-reset endpoint was added.

## Configuration and enrollment

Two server-only settings are required, with no fallback:

| Setting | Contract |
| --- | --- |
| `MFA_ENCRYPTION_KEY_ID` | Current key identifier, 1–64 ASCII letters/digits/underscore/hyphen. |
| `MFA_ENCRYPTION_KEYS` | JSON object of key identifier → canonical base64 encoding of a cryptographically generated 32-byte AES key. |

Generate keys in an approved secret store and inject them through private host configuration. Never use an example, test key, password-derived key, database column, public environment variable, source control, synced workspace or the encrypted-backup artifact as the production key store. The laboratory generates synthetic keys without printing them; its keyring is separate from its archive encryption keys and SQL data. `.env.example` contains blank placeholders. **Owner `.env.local` and manual-test database were not changed.**

Before an authorized manual-environment rollout: preserve a verified recovery set; provision a new private keyring; authorize and apply migrations0009/0010 through the existing migration guard; verify original migration hashes/triggers; arrange controlled first enrollment for all five users. Existing password-only cookies will stop working. Until the schema and keys exist, authentication fails closed. Do not apply migrations to the owner's manual database merely to make local startup succeed.

Password verification creates a five-minute, user/auth-version-bound server challenge, whose browser representation is only a random HttpOnly cookie. It grants no business access. First enrollment generates a 160-bit seed, displays a locally generated QR/manual key once, verifies a six-digit authenticator code, then displays16 recovery codes once. Acknowledging their secure storage is required before activation and full-session issuance. Seed/codes are not stored in browser local/session storage, URLs or audit snapshots.

Use a trusted authenticator with SHA-1, six digits and30-second periods. This is RFC6238 interoperability, not phishing resistance or NIST certification. An actual physical-phone QR/app interoperability exercise remains a human validation item; automated tests use genuine browser forms and RFC-tested OTP generation.

The verifier accepts current ±one step and advances a persisted monotonic accepted-step counter. A used step cannot be accepted again, even on another challenge/worker. A future accepted step can temporarily make a displayed older code unusable; wait for the next eligible code. **A never-used code may fall within the acceptance window for up to90 seconds.** This differs from a literal30-second maximum lifetime in ASVS6.5.5; do not mark that control passed. Production clock synchronization, stricter-window policy and independent interpretation/validation remain release gates.

## Authentication and replacement

| Flow | Required proof / result |
| --- | --- |
| Normal sign-in | Correct password, then valid unused-step enrolled TOTP. |
| Emergency code sign-in | Correct password, valid unexpired challenge and one unused recovery code of the current factor generation. |
| First enrollment | Password challenge, new seed possession and recovery-code acknowledgement. |
| Replace authenticator | Full live session **plus fresh password/current TOTP**, new seed possession, new recovery-code acknowledgement. Old factor remains until the switch. |
| Regenerate recovery codes | Full live session **plus fresh password/current TOTP**, then acknowledge the single displayed replacement set. |
| Operator factor recovery | Genuine operator capability, independently verified identity, approved reason and explicit target confirmation; no session is issued by reset. User must enroll anew. |

Replacement/regeneration revoke prior sessions and pending challenges, advance auth_version, revoke old recovery sets, and issue one fresh full session after acknowledgement. A replacement challenge is bound to its source full session; revoking that source blocks completion. Recovery codes do not substitute for the current authenticator in factor-replacement step-up. A lost device plus lost codes requires operator recovery.

Recovery codes contain128 random bits each, rendered as four8-hex-character groups. Case, spaces and hyphens are normalized only for these codes. SHA-256 verifiers bind user and factor generation; plaintext is never retained after its one display. Consumed/revoked rows remain for security history. Code use, consumption and full-session issuance commit atomically. A lost response may consume a code without delivering a usable cookie: refresh/restart safely and use another code; never undo consumption or reuse the spent value.

Abandoned/unconfirmed enrollment never activates a factor. Expired challenges fail closed; expired pending secret fields are scrubbed during the next successful password-stage cleanup, and reset/revocation scrubs pending state immediately. No production background cleanup scheduler has been provisioned. Refresh never retrieves a previously displayed seed or code set; cancel/restart enrollment or step up again if it was not saved.

## Limits and privacy

MySQL counters coordinate processes/restarts. Five password attempts per email/15 minutes and60 globally/minute remain. TOTP, recovery and enrollment proofs share ten attempts per account/15 minutes and five per challenge; a fresh password challenge cannot reset the account budget. Step-up has its own ten-attempt account bucket. Operator reset permits three admitted requests per target/15 minutes. MFA shares a60/minute global admission bucket. Invalid attempts cannot extend a window indefinitely.

Metadata reads do not spend the OTP budget; setup generation occurs once and acknowledgement consumes the proof-bearing challenge once. Failure audits cover admitted verification attempts, and throttle audits occur only at a threshold crossing, preventing repeated denied requests from amplifying the database audit indefinitely. Existing sampled operational logs remain bounded per process. No raw passwords, OTPs, seeds, URI/QR contents, recovery codes, session tokens or encryption keys are logged.

Full sessions have new random identities, server-owned assurance_version2, verification timestamps, live active-factor/restore-hold checks, current auth_version and the existing8-hour absolute expiration. The internal value2 is **not** a NIST AAL2 certification. Production cookies use host-only Secure/HttpOnly attributes; the challenge uses SameSite=Strict and the full cookie keeps SameSite=Lax. State-changing authentication requests preserve exact Origin/Host validation. New authentication routes/pages are no-store; private pages retain nonce CSP. Genuine production HTTPS/proxy/cookie validation is still missing.

## Operator-assisted reset

Use a trusted interactive operator console:

```powershell
npm.cmd run accounts -- --operator reset-mfa
```

The existing operator key is prompted without echo; it is never accepted as an argument. Enter the target email, an approved non-sensitive reason, independently verified identity acknowledgement, and the exact requested target-confirmation phrase. Allowed reasons are `lost-authenticator-and-codes`, `suspected-factor-compromise`, `verified-device-replacement`, and `verified-disaster-recovery`. Arbitrary notes/credentials cannot enter the reason audit field.

The operator must verify identity using an owner-approved independent procedure and existing trusted records/channel, not merely possession of a session, an email, a caller-supplied phone number or business details. If uncertain, deny and escalate. Preserve the actual identity evidence in the restricted operational record; do not paste it or credentials into application logs/chat. A yes/no CLI attestation is **not automated identity verification**. Human proofing, secure password handoff, operator accountability and an optional second-person approval process require owner operational validation before release.

For suspected password compromise, rotate the password through the approved operator procedure before controlled reenrollment. Keep the account recovery window controlled: a stolen password during bootstrap can race legitimate enrollment. There is no automatic external notification channel. Reset invalidates the old factor, every recovery set, all full sessions and every pending challenge, advances auth_version and audits the target/reason/outcome. It reveals no old seed and does not impersonate the user.

## Disaster recovery and stale authentication state

The paired SQL/PDF archive is now `fitimi-paired/2`; it captures the encrypted MFA tables and required key **identifiers**, never the keys. The reference adapter is restricted to declared local WP-15/WP-16 disposable databases; it is not a production backup service. Current snapshots require the eleven-migration schema. Historical pre-MFA archives must remain offline and need a separately reviewed migration/recovery adapter; never infer MFA assurance for old sessions.

An older snapshot can contain recovery codes or factors that were used/retired after that snapshot. Therefore a restored factor is placed in **restore_hold**, all restored unused recovery codes are revoked, all sessions/challenges are invalidated and auth versions advance. Existing consumed/unused history and exact snapshot digests are verified **before** these deliberate security transitions. Normal login, recovery and even unrevoked full cookies cannot pass a hold.

Release each held account only through independently verified operator recovery with reason `verified-disaster-recovery`. This path requires a **different fresh password** (secret prompt), invalidates archived factor/code material and forces proved new enrollment. Other reasons cannot clear a hold. No user-controlled field or ordinary full session can clear it. The drill deliberately consumes a recovery code on the source **after** the recovery point, then proves its restored unused record remains revoked and cannot revive. It also proves the archived password is replaced before access resumes.

Keep the original source offline during a real cutover; never run source/restore clones as independent live verifiers of the same credentials. Validate financial totals, original PDF hashes, receipt sequence/idempotency and independent-connection races before reopening. Missing keys fail restore/MFA closed; do not bypass authentication or forge a storage ownership marker. Failed post-import staging remains quarantined. Daily offsite backup,30-day executed retention, RPO<=24h and RTO<=48h remain **NOT VERIFIED** on actual infrastructure.

For encryption-key rotation, retain old key IDs while any active/inactive factor or retained recovery point needs them. Adding a new current key controls new encryption; it does not automatically rewrap existing factors. An audited offline rewrap/vault procedure and escrow drill remain production work. Key loss requires approved operator recovery; there is no plaintext fallback. A compromised host holding the key remains a separate threat.

## Local reproduction and remaining gates

Use `scripts/mfa/lab.mjs` for synthetic keys, MySQL3307 and app3000. Run unit, `test:mfa:db`, original `test:db`, typecheck/lint/build, then `scripts/mfa/verify.mjs` for sequential fresh HTTP/browser/performance fixtures. Stop its app before `test:release:restore`; run `perf:mfa` for ten isolated service measurements. Retain redacted evidence, run the source/build/log scan, then guarded `scripts/mfa/cleanup.mjs` and `scripts/mfa/lab.mjs dispose`. No owner container/profile/environment or README is reset.

Production remains blocked by hosting/TLS/private durable storage, separate vault/key escrow and offsite recovery, real five-user enrollment/recovery validation, independent security audit, remaining ASVS gaps, idle/session/export-step-up decisions, and accountant/owner UI/content signoff. Manual accessibility/screen-reader and physical-phone checks remain outstanding. No external notification, real data or deployment is authorized by these instructions.

Technical references: [RFC6238](https://www.rfc-editor.org/rfc/rfc6238), [OTPAuth source](https://github.com/hectorm/otpauth), [OWASP MFA guidance](https://cheatsheetseries.owasp.org/cheatsheets/Multifactor_Authentication_Cheat_Sheet.html), [NIST authentication guidance](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/), [ASVS5 authentication controls](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x15-V6-Authentication.md). These sources inform design; no certification is implied.
