# Device-verified quick login

Owner-approved extension on 2026-10-30. This adds WebAuthn passkeys to the existing authentication system; it does not replace MFA with a shared or permanent application PIN.

## User flow

1. Start the existing local database with `docker compose up -d`, then run `npm run dev`.
2. Open `http://localhost:3000/administrata`. The local owner profile redirects `127.0.0.1:3000/administrata` and private-page links to this domain. The former `/login` and `/login/mfa` pages return 404; all sign-in, MFA, logout and reauthentication links use `/administrata`. Changing the URL is an organizational measure, not an additional authentication factor. Port 3000 and database port 3307 are unchanged.
3. Initially sign in with the existing password and TOTP/recovery flow. Account provisioning remains operator-only.
4. Within five minutes, open **Siguria e llogarisë**, name the passkey and choose **Aktivizo hyrjen me pajisje**. Confirm the operating-system prompt.
5. Subsequently choose **Hyr shpejt**. A discoverable credential identifies the account, without entering email/password again. The operating system requires its PIN or biometric verification.

The app cannot read, set, change or force the device PIN. Windows Hello uses the computer's verification; a phone uses its own verification. Changing the device PIN happens in operating-system settings. Browser/OS credential pickers may offer biometric verification or a synced credential instead. The application requires verified user presence/verification in the signed WebAuthn result, rather than trusting a browser boolean.

Passkeys can synchronize through the user's credential provider. Settings lists registered credentials, not an inventory of uniquely identifiable physical phones. Revoking one credential invalidates it across all devices where that same credential is synchronized. New devices without a usable passkey can use the existing password + TOTP/recovery flow to enroll.

## Server security

- `@simplewebauthn/server` **14.0.3** performs attestation/assertion verification; `@simplewebauthn/browser` **14.0.0** performs browser serialization. Registration is restricted to platform, discoverable credentials and ES256/RS256, with user verification required both in options and server verification. Sign-in also requires user verification. Attestation is `none`; no hardware provenance/AAL3 claim is made.
- Only a fully authenticated, currently active account can register a credential. Enrollment is bound to the original session hash and authentication version, and requires verification within the previous five minutes. Public registration and enrollment from password-only/pending credentials remain unavailable.
- Anonymous authentication options disclose no account or credential list. A two-minute, server-held challenge is bound to an opaque HttpOnly/SameSite cookie. Only hashes of its token and challenge are stored. An eligible-credential/version snapshot prevents operator revocation during a pending ceremony from being bypassed.
- Strict configured Origin/Host checks remain mandatory on POST. Signed client origin, RP ID, challenge, user handle, signature and UV flag are verified. Production requires a stable HTTPS `AUTH_ORIGIN`; IP RP IDs are rejected. Credential registration is origin/RP-specific: local passkeys cannot be moved to a different production domain.
- SQL-backed per-operation global admission limits (60/minute), per-credential/account limits (10/15 minutes) and five failed attempts per challenge persist across processes and replacement challenges. User → challenge → credential locking serializes authentication. A challenge is consumed atomically with session issuance. WebAuthn counters are updated under lock; legitimate synchronized credentials with zero counters remain supported by the verifier.
- Successful UV-backed authentication issues a new existing eight-hour absolute session with server-owned assurance, timestamp, authentication version and a credential reference. Existing password-only sessions remain invalid. Live page/API/domain guards also check the referenced credential's revocation and version.
- Settings removal requires recent authentication, deliberate confirmation, and ownership. It revokes all sessions issued with that credential. Removing the last passkey retains the existing password + TOTP/recovery fallback.
- Operator password reset, session revocation, deactivation and MFA reset advance authentication versions and invalidate earlier passkeys. MFA factor replacement also invalidates prior versions. A restore hold blocks both existing passkey sessions and new sign-ins.
- PINs, biometrics and device private keys never reach the server. The database contains credential public keys, public credential IDs, counters and management metadata. Security audit events contain only safe IDs/status. The welcome-toast browser hint remains cosmetic and cannot authorize requests.

## Database, backup and runtime scope

Additive migration `0011_device_passkeys.sql` adds two authentication tables and an optional `auth_sessions.passkey_id` foreign key. Existing migrations 0000–0010 and all thirteen financial/history triggers are unchanged. Apply through the guarded existing migration mechanism. The owner starts the manual app; implementation testing does not migrate the owner's database.

Protected paired system backup enumerates all tables and therefore includes passkey metadata and challenges. Restore now explicitly revokes passkeys and consumes challenges alongside existing session revocation, authentication-version advancement and MFA restore holds. Recovery requires the original controlled operator procedure and fresh enrollment. Business ZIP generation still uses explicit business datasets and excludes authentication tables. The full paired backup/restore drill and runtime-role database suite were not rerun for this change; their updated paths require independent regression before release.

Runtime permissions need SELECT/INSERT/UPDATE on `auth_passkeys` and `auth_passkey_challenges`, plus DELETE on the latter for bounded expired-challenge cleanup. Existing restrictions on financial/history deletion and operator capabilities remain unchanged.

## Verification and limits

- `npm run test:passkeys:local`: **19 scenarios PASS**, using genuine Edge 156 WebAuthn ceremonies with a virtual CTAP2 platform authenticator and actual MySQL 8.4. A fresh randomly named `fitimi_test_passkeys_*` schema and restricted task users are created in the existing container on 3307, then disposed. The temporary app uses 3000 and is stopped in `finally`.
- Coverage includes actual password/TOTP bootstrap, credential enrollment, discoverable login, welcome toast/logout, pending-state isolation, CSRF, absent UV, invalid signature, wrong/expired/reused challenges, concurrent double submit, per-challenge/persisted throttling, account disable, restore hold, old-session enrollment refusal, registration session binding, settings removal and operator revocation.
- Browser evidence and screenshots are under ignored `artifacts/passkeys/`. Synthetic fixture credentials are never committed. The committed summary is `passkeys-verification.json`.
- Physical Windows/Android/iOS PIN/biometric prompts: **NOT VERIFIED**. Virtual-authenticator tests verify cryptographic protocol behavior, not real hardware prompts or provider sync/recovery.
- No production accounts, production data, deployment, hosted identity provider or messaging services are involved. README.md, .env.local and owner credentials remain unchanged.
- `npm audit`: four moderate advisories remain in the existing Drizzle/esbuild development toolchain; none are attributed to the new SimpleWebAuthn packages. No forced audit fix was run.

Production remains **NO-GO** pending real-device enrollment/recovery testing, stable HTTPS/RP configuration, hosting/proxy/cookie validation, private storage/backup validation, policy decisions and independent security review. Synchronized credential-provider compromise, stolen unlocked devices, active application-host compromise and the five-minute recent-session window remain relevant risks.

References: [SimpleWebAuthn server](https://simplewebauthn.dev/docs/packages/server), [passkey user verification](https://simplewebauthn.dev/docs/advanced/passkeys/), [NIST authenticator requirements](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/).
