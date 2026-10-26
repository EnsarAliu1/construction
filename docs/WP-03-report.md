# WP-03 — Authentication, authorization and account administration

Date: 26 October 2026

Result: implemented and locally verified. Browser visual/interaction verification is **NOT VERIFIED** because no browser connection was available. WP-04 was not started. The owner separately requested GitHub commit/push; the final delivery message records that result.

## A. Initial repository state

- Branch `main`, HEAD `09fe783` (`feat: add WP-02 MySQL schema and integrity foundation`), tracking `origin/main`.
- Existing modifications: owner-updated `AGENTS.md`, WP-02V README/integration-test changes, untracked `.gitattributes`, `docs/WP-02V-report.md` and `tests/db/schema-inspection.ts`. All were preserved and carried forward.
- WP-03 v1.0 in the actual `AGENTS.md` was the implementation authority. No additional Master Prompt or approved design boards were available. The existing neutral Operational Clarity foundation was retained.
- Existing users, routes, Drizzle schema/runner/journal, 13 triggers, tests and installed Next.js authentication/cookie guidance were inspected before implementation.

## B. Technology decisions

Only one new runtime dependency: **@node-rs/argon2 2.2.2**, pinned in npm's lockfile. Verified environment remains Node 24.18.0/npm 11.6.1, Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.3, Drizzle ORM 0.45.4, Drizzle Kit 0.31.11 and mysql2 3.24.6.

Passwords use Argon2id, 19,456 KiB memory, two iterations, one lane and 32-byte output, with library-generated random salts. These parameters follow the [OWASP password-storage recommendation](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Unknown/malformed account hashes use a non-account timing equalizer; no known account/password is seeded.

Session orchestration is application-owned, using standard Node cryptographic primitives rather than a new cipher, KDF or JWT scheme. Tokens are 32 cryptographically random bytes encoded as base64url; only SHA-256 digests are stored in MySQL. Sessions expire absolutely after eight hours and are validated/revoked server-side.

An authentication framework was evaluated rather than silently omitted. Better Auth 1.7.13 was checked, but its [credential account model](https://www.better-auth.com/docs/authentication/email-password) stores passwords in a separate account table. That would introduce a second credential authority or relocate the already established `users.password_hash` field. This package deliberately retains the existing identity/hash model and implements a small opaque-session lifecycle around an established Argon2 library and Node crypto. It does **not** claim to use a full authentication framework; review/maintenance of the session orchestration remains a project responsibility. No custom cryptographic algorithm was implemented.

## C. Implemented features

- `/login`: responsive neutral login form, labeled email/password inputs, correct autocomplete, loading/disabled state and generic accessible errors.
- `/api/auth/login`: JSON size/type limits, normalized email, real Argon2id verification, uniform wrong/unknown/disabled-account failures, shared database rate limiting and fresh session issuance. JSON does not return tokens.
- `/api/auth/logout`: origin-validated, idempotent logout; server revocation precedes cookie clearing. Database failure returns a generic retry response rather than false success.
- `/api/auth/session`: uncached, safe identity DTO; anonymous/invalid sessions get 401, database unavailability gets 503.
- Every private page calls `requirePageUser`; operations use `requireOperationUser`/`requireSessionUser`. The layout is not the sole security boundary, and no proxy-only authorization is used.
- The workspace displays the authenticated user's name. Its working sign-out form invokes an independently protected Server Action.
- Adore account administration uses an interactive operator-only CLI: create, activate, deactivate, reset password and revoke sessions. It requires explicit `--operator` invocation and a private operator key entered without echo. Passwords are entered twice without echo; no secret command arguments or fixed credentials are accepted.
- Operator capability is an in-process, unforgeable WeakSet-issued object. Client sessions/JSON cannot manufacture it. No HTTP endpoint exposes account administration.
- All client users have the same operational permissions. The Adore operator is a separate trusted local process, not an additional business role or default user account.
- Creation and activation acquire the same durable database mutex, check the active count, and write/audit within a transaction. Six concurrent creations yielded five successes and one rejection. Two concurrent activations competing for one freed slot yielded one success and one rejection.
- Deactivation, reset and explicit revocation increment authentication version and revoke sessions transactionally. Reactivation does not revive old sessions.
- Recovery is operator-verified out-of-band replacement of the password; it does not reveal a stored password, create reset tokens or assume email delivery.

## D. Database changes

New versioned files:

- `drizzle/0002_wp03_authentication.sql`
- `drizzle/meta/0002_snapshot.json`
- Appended migration entry in `drizzle/meta/_journal.json`.

New structures:

| Structure | Purpose |
| --- | --- |
| `users.auth_version` | Positive integer for invalidating all prior authentication state |
| `auth_sessions` | User FK, unique token digest, authentication version, expiry/revocation timestamps and user/state/expiry indexes |
| `auth_account_control` | Single company mutex row for concurrency-safe account lifecycle; infrastructure seed only |
| `auth_login_limits` | Digest-keyed atomic admission counters and expiry index shared by all instances |

Verified MySQL **8.4.13**, database `fitimi_test_wp03`, container `fitimiconstruction-mysql-wp03`, `127.0.0.1:3307` → `3306`, InnoDB, UTC, task-owned tmpfs, synthetic credentials and test-only `--skip-log-bin`. Other containers, XAMPP and production systems were not changed.

The resulting schema has **20 application tables, 19 FKs, 58 application indexes, 27 enforced checks and the original 13 triggers**. Actual metadata was compared with declarations. All three journal hashes match local migration bytes, with the previous two preserved exactly:

| Migration | SHA-256 |
| --- | --- |
| 0000 | `5f972707b506644f976f71bd139f74c72f9e269bfeaba63ff3ca7165572ef16c` |
| 0001 | `21a7d78e4846ea6b53224593eca961dc92edd7bc7d48a42db8b14ed1c1ce9205` |
| 0002 | `023ff3b046a78f33ad4c7fa799804be11254f86a46f31847279d952cceb8eb9a` |

No verified WP-02 SQL was edited. Regression tests pin the original hashes while explicitly including the additive authentication migration. MySQL DDL is not represented as atomic.

## E. Created/modified files

| Exact path | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | Pinned Argon2 dependency and authentication/operator/test scripts |
| `.env.example` | Blank auth/operator and test-only container configuration names |
| `drizzle/0002_wp03_authentication.sql` | Additive authentication DDL and mutex infrastructure seed |
| `drizzle/meta/0002_snapshot.json`, `drizzle/meta/_journal.json` | New schema snapshot and appended migration metadata |
| `src/server/db/schema/auth.ts` | Session, limiter and account-control tables |
| `src/server/db/schema/identity.ts`, `src/server/db/schema/index.ts` | Authentication version and schema exports |
| `src/server/auth/password.ts` | Maintained Argon2id hashing/verification policy |
| `src/server/auth/security.ts` | Safe identity types, token primitives, cookie/origin/redirect policy and typed errors |
| `src/server/auth/store.ts` | Lazy guarded connection, safe transactions and redacted security audit writes |
| `src/server/auth/rate-limit.ts` | Transactional database admission limits |
| `src/server/auth/sessions.ts` | Current-state authorization, expiry and revocation |
| `src/server/auth/login.ts` | Real credential verification, account recheck under lock and session creation/rotation |
| `src/server/auth/operator.ts` | CLI-only operator-key verification and unforgeable capability |
| `src/server/auth/accounts.ts` | Operator lifecycle, concurrent active-account limit and atomic recovery |
| `src/server/auth/web.ts` | Next.js page/operation guards and render-pass deduplication |
| `src/server/auth/http.ts` | No-store responses, cookie management and bounded JSON parsing |
| `src/app/api/auth/login/route.ts` | Login endpoint |
| `src/app/api/auth/logout/route.ts` | Logout endpoint |
| `src/app/api/auth/session/route.ts` | Protected safe identity endpoint |
| `src/app/(auth)/layout.tsx`, `src/app/(auth)/login/page.tsx` | Login route/document and safe authenticated redirects |
| `src/components/auth/login-form.tsx` | Accessible loading/error form behavior |
| `src/components/auth/logout-button.tsx` | Working pending/error sign-out form |
| `src/app/(workspace)/app/actions.ts` | Protected logout Server Action |
| `src/app/(workspace)/app/layout.tsx` | Dynamic authenticated shell composition |
| `src/app/(workspace)/app/page.tsx`, `src/app/(workspace)/app/[section]/page.tsx` | Independent private-page authorization |
| `src/components/layout/workspace-shell.tsx` | Authenticated identity/sign-out and corrected preview notice |
| `src/features/workspace/sections.ts` | Accurate Adore-controlled account administration explanation |
| `src/styles/globals.css` | Neutral login and responsive authenticated-header styling |
| `scripts/accounts.ts` | Explicit interactive operator workflow; hidden secret/password input |
| `scripts/check-routes.mjs` | Strong anonymous redirects and optional authenticated route/heading/navigation assertions |
| `tests/auth/security.test.ts` | Password, token, cookie, origin, redirect and operator-capability unit tests |
| `tests/auth/auth.integration.test.ts` | Real login, session, recovery, audit and concurrent account-limit tests |
| `tests/auth/http.integration.test.ts` | Actual HTTP routes, cookie security, Server Action, CSRF and task-owned outage tests |
| `tests/db/schema.test.ts`, `tests/db/integrity.integration.test.ts` | Preserve old checks/hashes and extend expectations for the additive migration |
| `README.md`, `docs/WP-03-report.md` | Current setup, operator/recovery process, release prerequisites and this report |

The prior WP-02V `.gitattributes`, `tests/db/schema-inspection.ts`, report and README changes were preserved. The owner-provided `AGENTS.md` remains intact. No unrelated application refactor, financial CRUD or client business records were introduced.

## F. Verification

| Actual command/check | Final outcome |
| --- | --- |
| `npm.cmd ci` | PASS; 552 packages installed reproducibly; existing development-tool advisory chain still reports four moderate issues |
| `npm.cmd ls --depth=0` | PASS; exact direct versions, no invalid dependencies |
| `npm.cmd audit --omit=dev --json` | PASS; production vulnerabilities total 0 |
| `npm.cmd run db:generate -- --name=wp03_authentication` | PASS; new migration/snapshot, existing SQL preserved |
| `npm.cmd run db:migrate` | PASS; actual MySQL execution of all three migrations |
| `npm.cmd run db:check` | PASS; migration metadata valid |
| `npm.cmd test` | PASS; **20**, 0 failed/skipped |
| `npm.cmd run test:auth` | PASS; six targeted security tests (also included in the 20 above) |
| `npm.cmd run test:db` | PASS; **36**, 0 failed/skipped; original 25 database/trigger results plus authentication/concurrency results |
| `npm.cmd run typecheck` | PASS; route generation and strict TypeScript |
| `npm.cmd run lint` | PASS; no warnings/errors |
| `npm.cmd run build` | PASS; 15 generated static pages plus dynamic login, auth APIs and private routes |
| `npm.cmd run start -- --port 3000` | PASS; local production-build server ready |
| `npm.cmd run check:routes` | PASS; run by the HTTP suite anonymously and with a private authenticated cookie; public pages, login and all 11 private sections checked |
| `npm.cmd run test:auth:http` | PASS; **9**, 0 failed/skipped |
| `npm.cmd run accounts -- --help` | PASS; explicit operator usage printed, no secrets |
| `npm.cmd run accounts -- create` | Expected denial, exit 1; missing `--operator` rejected before any account creation |
| Actual MySQL final-state inspection | PASS; version 8.4.13, all migration hashes/13 triggers intact, zero active synthetic accounts and zero usable sessions |

The HTTP suite exercises anonymous page redirects and the protected operation/Server Action, valid authenticated navigation, identical wrong/unknown/disabled responses, actual Secure/HttpOnly/SameSite/host-only cookies, no JSON/HTML token exposure, no open redirects, denied forged Origins, absent registration/admin/reset APIs, token rotation/expiry, deactivation/reactivation, operator recovery, and idempotent logout. The actual logout Server Action revokes its session. Installed Next.js fetch-mode actions communicate redirects through `x-action-redirect`; the test asserts the required `/login;push` instruction and session invalidation rather than incorrectly requiring an ordinary document-redirect status for streamed RSC transport.

For a real outage, the HTTP test verified the exact container ID and WP-03 label, paused only that task-owned MySQL instance, confirmed protected operations/login return 503 and private pages redirect without granting access, and resumed in `finally`.

Browser setup returned `No browser is available`; discovery returned an empty list. Desktop/mobile visual layout, live keyboard/form/navigation behavior and hydration are **NOT VERIFIED**. HTTP testing is not claimed as browser testing. The full interactive hidden-terminal prompt walkthrough was not performed; its CLI help/denial paths and all underlying operator actions were exercised.

Initial validation exposed an ambient const-enum incompatibility in the Argon2 type declarations under `isolatedModules`; using the documented Argon2id algorithm value with typed options resolved it. Test assertion/typing issues and the fetch-action redirect assumption were corrected; final checks above passed without disabled rules or skipped database tests.

## G. Security review

- Sessions are opaque and server-managed, not client-supplied identity/role claims. The database stores only token digests; every operation checks live expiry, revocation, status and authentication version.
- Production cookies are Secure/HttpOnly/SameSite=Lax, `__Host-` scoped with Path=/ and no Domain. CSRF protection validates configured Origin and Host for login/logout in addition to native Server Action protections. Forwarded headers do not confer trust.
- Login issues new random tokens; deactivation, reset and revocation cannot be undone by replaying/reactivating old sessions. Interrupted login delivery can leave an unreachable session that expires; it does not reveal a token or bypass authorization.
- Account creation/activation is serialized with a durable mutex. No public registration, account creation/recovery API, browser operator dashboard or client-side administration permission exists.
- The limiter is database-backed and shared across instances, not a development-only in-memory claim: five attempts/email/15 minutes and 60 globally/minute. Hosting-specific trusted-IP/edge controls remain a release prerequisite.
- Security audit snapshots were tested to exclude passwords, hashes and tokens. User-facing/CLI errors are generic or safely redacted; failed login logging does not disclose account existence.
- A diagnostic read initially included a transient local build Server Action encryption key. The prior generated build/cache was deleted and a fresh final build created, with no explicit encryption key configured, before the successful HTTP verification. It was never added to Git. Passwords, operator keys and raw session tokens were not intentionally logged; this local build-key incident is recorded rather than omitted.
- Synthetic accounts are deactivated, sessions revoked and the task-owned database/container and temporary credentials removed after verification. Immutable audit references are not deleted in place. No real data or production system was accessed; no deployment occurred.
- User-requested source commit/push is separate from production deployment. Populated environment files, dependency/build output and test artifacts are Git-ignored; only blank environment examples and source/docs are intended for Git.

## H. Acceptance checklist

| Criterion | Status | Evidence |
| --- | --- | --- |
| WP03-AC01 | PASS | Existing Next/Drizzle/users architecture reused; build/typecheck pass |
| WP03-AC02 | PASS | Salted Argon2id verification tested with real hashes and passwords |
| WP03-AC03 | PASS | Every anonymous private route redirects; protected operation denies access |
| WP03-AC04 | PASS | Active authenticated account accesses all 11 approved private screens |
| WP03-AC05 | PASS | HTTP and actual Server Action logout revoke the active session |
| WP03-AC06 | PASS | Deactivation rejects existing sessions; reactivation does not revive them |
| WP03-AC07 | PASS | Real concurrent create/activate tests cannot exceed five active clients |
| WP03-AC08 | PASS | Explicit keyed Adore CLI; forged client capabilities rejected; lifecycle/recovery tests pass |
| WP03-AC09 | PASS | No registration endpoint; HTTP probes return 404 |
| WP03-AC10 | PASS | All ten public SQ/EN pages remain public |
| WP03-AC11 | PASS | Cookie attributes, hashed opaque storage, expiry/revocation and origin protection tested |
| WP03-AC12 | PASS | Independent server guards protect API and actual logout Server Action |
| WP03-AC13 | PASS | Shared DB limiter tested, including concurrent admission; hosting-specific additions documented |
| WP03-AC14 | PASS | Required security events exist with no sensitive snapshot values |
| WP03-AC15 | PASS | New migration executed against disposable MySQL 8.4.13 |
| WP03-AC16 | PASS | Old SQL/hashes unchanged, all original 13 trigger behaviors and relationships pass |
| WP03-AC17 | PASS | 20 offline/security, 36 database and 9 HTTP test results pass with no skips |
| WP03-AC18 | PASS | Clean install, typecheck, lint, build, migration and route regressions pass |
| WP03-AC19 | NOT VERIFIED | Responsive source/login behavior provided; no browser connected for live visual/interaction QA |
| WP03-AC20 | PASS | Synthetic local testing only; no real data, production infrastructure or deployment |

## I. Remaining risks and release prerequisites

No known functional authentication defect remained in the executed checks. Browser visual/interaction/hydration verification and a manual operator prompt walkthrough remain outstanding. The established dependency performs password cryptography, while this project owns session/authorization orchestration; production release requires security review of that code and operating procedures.

Production additionally requires approved HTTPS/origin/proxy setup, least-privilege database/runtime/migration access, operator terminal/environment-file permissions and secret handling/rotation, a verified out-of-band account recovery identity process, and hosting-specific abuse/DoS protection. Current database connection safeguards intentionally permit only explicitly disposable loopback targets; production connection policy is a later authorized decision. No production email service, self-service reset, MFA, social login or additional business role was invented.

The existing development dependency chain still reports four moderate advisories; the actual production-only audit reports zero. Prior financial aggregate/history/numbering transaction invariants remain deferred; authentication work does not implement or certify them.

## J. Next package

The tested authentication/database foundation is ready for separately authorized **WP-04 — Clients**. Future pages and operations must use the existing server guards independently of layout/navigation. Browser QA remains a verification gap and production release prerequisites remain outstanding. WP-04 was not started.
