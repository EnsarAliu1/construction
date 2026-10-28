# WP-16 — Mandatory MFA, enrollment and recovery

Date: 28 October 2026. **Local implementation verified; NO-GO FOR PRODUCTION.** This delivers mandatory authentication enforcement and its lifecycle, not security certification or a production rollout. The owner's manual database and `.env.local` were not migrated/configured. They need a separately authorized 0009/0010 migration and private MFA key provisioning before manual application login can use this release.

Evidence: [sanitized results](security/wp16-evidence.json), [operator/key/recovery runbook](security/mfa-operations.md), [dated ASVS delta](security/wp16-asvs-delta.csv). Private logs/builds/archives remain ignored local artifacts; no secrets or SQL dumps belong in the handoff.

## A. Repository baseline

Started on `main`, HEAD `f7bef8d7ccd4073f8e1fb11a4cc596c9c4f0ecdf`, after WP-15. Only the owner's `AGENTS.md` was initially modified; its exact bytes were preserved. The on-disk instruction is WP-16, superseding the earlier pasted WP-15 request. Existing WP-03–15 code, ASVS matrix, external-audit handoff, paired-backup implementation, nine original migrations and thirteen integrity/history triggers were reviewed. The historical 253-control matrix remains unchanged.

Next.js 16.4.3 / React 19.3.1, MySQL 8.4.13, Windows Node 24.18.0 and genuine Edge 156.0.4314.50 were used. Original ports remain app3000/MySQL3307. Only task-owned disposable resources were started/reset. The owner's `fitimiconstruction-mysql-wp08` remained stopped. README and `.env.local` hashes were checked against the starting fingerprints; protected-file results and cleanup evidence are recorded in the handoff. No production/customer data or deployment was involved.

## B. MFA architecture

The existing Argon2id/password/login-limiter/operator infrastructure remains. Successful password verification now creates only a five-minute opaque pre-authentication challenge. It cannot create a full session. Enrollment-required, factor-verification, acknowledgement, consumed and expired states are authoritative in MySQL. A challenge captures user auth_version and, for replacement/regeneration, the originating full-session digest. Browser input cannot select assurance, account identity, server time or operator authority.

The normal session table is separate from challenges. Full access requires assurance_version2, a verification timestamp, a live non-held factor, an active user, matching auth_version, unexpired session and no revocation. Existing business services, route handlers, private pages and Server Actions use that full guard. Token substitution between challenge/session cookies fails. Successful completion generates an independent random full-session identity; HTTP returns no token in JSON. Production cookie/header rules, bounded JSON, exact Origin/Host checks, private no-store and nonce CSP are retained.

All five business users have equal rights. There is no public registration, application administrator role, SMS/email factor or public recovery endpoint. The only new application surfaces are `/login/mfa`, `/app/security` and `/api/auth/mfa`.

## C. Enrollment

OTPAuth 9.5.2 supplies RFC-compatible TOTP; qrcode-generator 2.0.4 renders QR locally on the server. New transitive @noble/hashes 2.4.0 coexists with PDFKit's 1.8.0. Dependencies were pinned exactly and installed with lifecycle scripts disabled. Existing package engine minimum is Node 22; the tested runtime is 24.18.0. No external QR service, CDN or authenticator account was introduced.

A 160-bit CSPRNG seed is encrypted with Node AES-256-GCM, random96-bit IV,128-bit tag and AAD binding user, generation and key ID. The server-only keyring is explicit, strictly parsed and separate from SQL/backups; unavailable/wrong keys do not produce a plaintext or recovery-code bypass. RFC6238 vectors, tampering, wrong keys and cross-binding failures are tested.

The QR/manual secret is displayed once after password proof. A real current code must succeed before 16 recovery codes are generated and displayed once. Until saved-code acknowledgement commits, there is no active new factor/full session. Activation, recovery-verifier insertion, auth-version increment, old-session/challenge invalidation and fresh session issuance commit together. Simultaneous enrollment has one winner. Abandonment/expiry never activates an unproved seed; refresh cannot retrieve a previously displayed secret. Expired pending ciphertext is scrubbed on the next successful password-stage cleanup; a scheduled production janitor is not provisioned.

## D. Recovery

Each of 16 codes has128 random bits. Only user/generation-scoped SHA-256 verifiers are stored. Code consumption and session creation share the locked transaction; independent-connection races have one winner. A code needs the correct password, a valid current challenge and a decryptable active factor; it cannot bootstrap an account or replace authenticator step-up. Consumed/revoked history remains. Exhaustion, reuse, wrong generation, logout, account disable and interrupted/expired flows fail safely.

`accounts -- --operator reset-mfa` requires the existing issued operator capability, target lookup, structured non-sensitive reason, independent-identity attestation and exact target confirmation. Fabricated capability objects are rejected. Reset is SQL-rate-limited and audited; it revokes factors, all recovery sets, full sessions and pending challenges, advances auth_version and forces fresh enrollment. It never issues a full session or reveals the old seed. Actual human identity proofing and trusted password delivery remain operational validation items; a CLI checkbox does not prove identity.

Recovery from an older backup needs stronger treatment than simply preserving unused-code rows. A code consumed, or factor/password retired, after the recovery point could otherwise return. Restore therefore holds every restored factor, revokes restored unused codes and invalidates all restored sessions/challenges. Only verified-disaster-recovery operator reset can clear a hold, with a **different fresh password** and proved new MFA enrollment. Other reset reasons cannot release a hold. The drill deliberately spends a source code after snapshot and proves its restored unused row is revoked, the old password is replaced, and normal login cannot evade operator recovery.

## E. Factor replacement

The existing account-security page requires a full live session plus fresh password/current TOTP before authenticator replacement or code regeneration. Replacement does not delete the working old factor before new seed possession and acknowledgement. Completion atomically rotates the primary generation, code set, sessions and auth_version. A revoked source session blocks its pending change. Old codes/factors cannot authenticate afterward. Code-only recovery is not accepted as this step-up. No new unequal export permissions, idle-session policy or session-count limit was imposed.

## F. Database

| File/model | Change and invariant |
| --- | --- |
| `0009_wp16_mandatory_mfa.sql` | Three authentication tables; full-session assurance/timestamp columns and paired checks; explicit legacy-session revocation and auth-version transition. |
| `0010_wp16_restore_mfa_hold.sql` | Factor restore_hold default0 with0/1 constraint; recovery quarantine checked by full/challenge guards. |
| `auth_mfa_factors` | One factor/user unique FK; encrypted seed/key ID; persisted monotonic accepted step; restore hold. |
| `auth_mfa_challenges` | Unique token digest, user/version binding, five-minute expiry, purpose/state constraints, bounded attempts, pending encrypted setup and generation-scoped verifier hashes. |
| `auth_mfa_recovery_codes` | Unique verifier, user FK, generation binding, used/revoked timestamps and lookup indexes; historical generations retained. |
| `auth_sessions` | Legacy assurance0 cannot pass the guard; only completed MFA emits assurance2 plus verification timestamp. |

User→challenge→factor locks and conditional updates prevent replay/recovery/replacement races. Limits are shared SQL state: MFA60 global/minute, ten proofs/account/15minutes, five/challenge; step-up separate; operator reset three/target/15minutes. Password limits remain five/email/15minutes and60 global/minute. New challenges/workers do not reset account budgets. Threshold-crossing audit is bounded; repeated rejected metadata/setup requests do not amplify verification audits.

The migration test actually applies the original nine migrations, inserts a legacy password-only session, then applies0009/0010 and proves denial. Eleven migrations and thirteen original triggers are present. Original SQL hashes are pinned and unchanged. No old migration, trigger or immutable history was rewritten. Runtime credentials were retested with minimal MFA-table mutation and only column-level user auth_version/updated_at updates; password/status/DDL/history changes remain denied. The migration/restore operator retains its separate stronger capability.

## G. Security testing

Final framework total: **401 passing, zero failed/skipped**; plus **38 separately executed imperative Edge scenarios**. Nested framework results are counted as the framework reports them; reruns, individual requests, performance navigation and failure injections are not added to this total.

| Command/suite | Distinct results |
| --- | ---: |
| `npm.cmd test` |74 |
| `npm.cmd run test:db` |169 |
| `npm.cmd run test:mfa:db` |16 |
| `npm.cmd run test:security:db` |2 |
| Existing auth/clients/projects/references/expenses/payments/receipts/reports HTTP |85 |
| `test:website:db` |7 |
| `test:security:http` |8 |
| `test:mfa:http` |8 |
| `test:website:browser` |32 |

The security route inventory contains the new surfaces.425 anonymous/revoked/disabled denial requests pass; an additional170 explicit pending/disguised-challenge business denial requests pass. These are requests, not extra test results. The actual compiled logout Server Action rejects pre-auth state. Full legacy, expired, revoked and held sessions fail. SQL expiry values are numerically checked; an initial driver-string truthiness bug was corrected and expiry retested.

HTTP tests exercise Origin/Host/unknown-action rejection, full-cookie attributes, challenge consumption/cancel, restore hold, secret-free business ZIP and no-store responses. New historical-export redaction removes MFA/TOTP/seed/verifier/cipher/key/challenge fields recursively with separator normalization, retaining receipt/business values. Its regression first exposed a missed pending-recovery-hash field; that omission was fixed before the final passing run. Current database snapshot constraints already reject unknown credential fields; export filtering is an additional boundary, not a substitute for those constraints. Arbitrary secrets deliberately pasted into allowed free-text business descriptions cannot be semantically identified by this filter.

Final `typecheck`, `lint`, `build`, `db:check` and route checks pass. The complete existing matrix ran after schema/guard changes; final-build MFA browser/HTTP and reporting HTTP were repeated after the narrowly scoped recovery-password/export-filter edits. No prior assertion or suite was disabled. Fixtures enroll through real MFA services/browser forms under explicit disposable loopback/database/port guards; they do not mint trusted production sessions directly.

`npm audit --omit=dev --json` reports zero runtime advisories. Full audit retains four moderate development dependency nodes: esbuild, @esbuild-kit/core-utils, @esbuild-kit/esm-loader and drizzle-kit. There are no reported High/Critical findings, but this is not a clean full audit. No forced historical Drizzle downgrade was performed. Exact new versions/lockfile resolutions and `npm ls --all --json` integrity results are recorded; package auditing does not prove absence of malicious code. The first full-tree check failed on stale WASM entries: invalidating npm's generated hidden cache and quarantining only its two confirmed extraneous packages resolved the errors. The source lock retains only the declared MFA additions. The native Windows build was repeated afterward; no active dependency was removed.

Source/build/log scanning covers staged working files, public chunks, known owner/test credential and binary-key sentinels, tracing exclusions and historical sensitive filenames. Public output retains the separate website isolation scan. Counts/scope are in the evidence; this is not exhaustive historical-blob, encoded-data or malicious-package analysis. Private Next Server Action encryption manifests are not public bundles and were never copied into the report.

## H. Browser evidence

Genuine Windows Edge/Playwright:13 MFA scenarios,13 complete business scenarios,9 security scenarios and3 interrupted-payment recovery scenarios; website Playwright adds32 framework-counted results. MFA covers password-only denial, abandoned/invalid enrollment, actual QR/manual setup and acknowledgement, TOTP/replay, single-use recovery, factor/code rotation, operator reset, expiry, throttle, disable, mobile keyboard/focus and secret-free browser storage. No unexpected console/hydration/CSP errors were accepted.

The existing business browser creates/edits/searches clients, project/contract/phases, references, expenses, split/corrected/cancelled payments, immutable receipt versions, financial totals and downloads. It runs with the mandatory MFA fixture. Website tests preserve ten SQ/EN routes, navigation/language switching, mobile layouts, contact/SEO/noindex and private-data isolation. Existing financial retry storage remains opaque-key-only.

Sanitized screenshots show [mobile security/keyboard focus](security/wp16-evidence/mfa-security-mobile.png) and [logged-out state](security/wp16-evidence/mfa-logged-out.png). They contain no QR, seed, codes, password or token. Physical-device QR scanning, a real user's authenticator, screen-reader assessment, manual accessibility conformance and the interactive trusted operator's human identity procedure remain **NOT VERIFIED**.

## I. Existing regression and protected recovery

Existing financial precision, allocation/capacity, cancellation/correction, audit, row-locking, idempotency, immutable receipt and export tests pass. Original private-file guards and persistent-store ownership rules remain.

The `fitimi-paired/2` protected recovery set includes all 24 tables (23 application plus migration metadata),11 migrations,13 triggers, encrypted MFA state and three original PDF versions. The manifest records required MFA key IDs; those keys and the archive AES-GCM key remain separate. The adapter validates required key availability before importing and proves restored ciphertext can decrypt afterward. Controlled quiescence, a storage lease and verified MySQL read-only boundary pair the dump with immutable PDFs; there is no claim of filesystem/SQL atomicity during arbitrary live writes.

An independent new server UUID/private store restores the exact database/document digest before explicit store rebinding/authentication invalidation. All three PDF SHA-256 hashes match; consumed/unused timestamps are preserved before intentional unused-code revocation. Verified operator reset, fresh password and new proved enrollment then allow authenticated financial reads. Baseline income12.00, expenses5.00, difference7.00 and outstanding88.00 remain exact. Idempotent retry retains the original receipt; the next is `DEV-00000003`. Two independent40.00 payment attempts produce one success/one capacity conflict, with income53.00. Source state is unchanged relative to the explicitly recorded post-snapshot source activity.

Final measured backup: **1.207s**; protected restore: **4.449s**; encrypted archive 185590 bytes. These handler timings exclude fresh-container startup, human proofing and the full operational recovery window. Exact original PDF hashes and environment identities are in the sanitized evidence. Daily offsite execution,30-day real retention and production RPO<=24h/RTO<=48h remain **NOT VERIFIED**.

Ten failure injections reject: corrupt archive, wrong archive key, wrong source identity, unauthorized operator, missing PDF, tampered manifest, incomplete pair, unapproved same server/identity, missing separate MFA key and simulated ENOSPC before publication. The disk-full test injects the error; it does not fill the owner's disk. Failed post-import staging is quarantined; restore does not promise atomic rollback of an already imported target. Source stays isolated/offline while target recovery is exercised. Guarded cleanup removes only recorded task resources and generated synthetic credentials/keys.

## J. Performance impact

Ten fresh real-service authentication samples, median/sample maximum in milliseconds:

| Operation | Median | Sample maximum |
| --- | ---: | ---: |
| Argon2 verification |22.02 |34.65 |
| Password→challenge |39.88 |61.79 |
| Enrollment proof+acknowledgement |65.13 |98.27 |
| TOTP+full-session transaction |21.96 |28.81 |
| Authoritative full-session guard |1.84 |2.59 |
| TOTP primitive only |0.227 |0.311 |

Session insertion was not benchmarked separately; it is included in the authoritative TOTP transaction. User interaction/phone setup dominates real completion time and was not assigned a service-latency SLA. No new OTP/QR library is shipped in the MFA client; QR generation is server-side. The existing foundation/motion hooks were retained.

The original moderate1,001-project performance fixture was also exercised, including60 public and36 private browser navigations and real concurrent financial requests. Directional medians versus WP-15: dashboard119.33→219.23ms, company PDF476.31→805.01ms, XLSX176.85→259.00ms and ZIP514.19→1099.95ms. **These samples are materially slower; they are not presented as a clean performance pass.** Host load/cache and newly repeated authoritative checks are confounders; this is not a controlled attribution experiment. The approximately848KB dashboard response remains a scaling concern. Security checks were not cached away or relaxed. Final auth-only timings are substantially faster than earlier same-day samples, further illustrating host variance.

Core measurements precede the last defense-in-depth historical-export key filter and isolated disaster-reset password requirement; final affected HTTP/build tests passed afterward. Exact final-host export budgets remain **NOT VERIFIED**. Production capacity, p75/INP, throttled physical mobile, durable storage/network latency and sustained abuse need target-host validation before GO. Local navigation uses network-idle waits, so its time includes that wait. No production performance guarantee is inferred.

## K. Files changed

The exact [file manifest](security/wp16-files.json) records each path/purpose, including the preserved owner AGENTS file. Main additions are MFA crypto/state services, schema/migrations0009–0010, the MFA API/forms/pages, guarded fixtures and genuine browser/HTTP/SQL tests, recovery quarantine/key compatibility, operational documentation and sanitized evidence. Existing login/logout/full-session services were integrated rather than replaced. README, owner `.env.local`, original migrations and visual direction were preserved.

## L. ASVS closure

The [dated delta](security/wp16-asvs-delta.csv) overlays the unchanged historical matrix. Local application evidence changes V6.3.3 from FAIL to PASS; V6.1.3, V6.3.4 and V6.4.3 from NOT VERIFIED to local PASS. Newly applicable V6.5.1–4 are locally PASS. V6.4.4 remains NOT VERIFIED because human identity proofing was not demonstrated.

V6.5.5 is now applicable and **FAIL**: a30-second period with ±one-step tolerance can accept an unused value over90 seconds. Do not confuse period with maximum acceptance lifetime. V6.2.4 remains **FAIL**: only 10 distinct entries of the existing 10,001-word corpus satisfy the current minimum12-character policy; the earlier blocklist improvement did not establish3,000 eligible matches. Neither issue is hidden by reclassification or a conformance claim. Other historical controls require their own existing evidence/backlog and were not globally recertified. These interpretations use the [official ASVS5 authentication controls](https://raw.githubusercontent.com/OWASP/ASVS/v5.0.0/5.0/en/0x15-V6-Authentication.md).

## M. Acceptance checklist

PASS below means the implemented local boundary and synthetic evidence, **not** production activation or external approval.

| Criterion | Status | Evidence/limit |
| --- | --- | --- |
| WP16-AC01 |PASS | All five synthetic active users require MFA; real-user rollout not performed. |
| WP16-AC02 |PASS | Pending/disguised tokens denied on business inventory. |
| WP16-AC03 |PASS | Separate hashed challenge, five-minute TTL, bounded attempts, version binding. |
| WP16-AC04 |PASS | Fresh full identity only after completed proof/recovery/acknowledgement. |
| WP16-AC05 |PASS | Genuine OTP proof; abandoned/invalid setup cannot activate. |
| WP16-AC06 |PASS | CSPRNG160-bit seed; AES256GCM/AAD; explicit separate keys. |
| WP16-AC07 |PASS | Actual ZIP exclusion and public/build known-secret scans; production vault not verified. |
| WP16-AC08 |PASS | SQL replay and shared attempt guards; strict ASVS lifetime gap separately FAIL. |
| WP16-AC09 |PASS | Independent-connection enrollment/TOTP/recovery/rotation races. |
| WP16-AC10 |PASS |16×128-bit single-use scoped verifiers. |
| WP16-AC11 |PASS | Reuse/brute force, exhaustion and concurrent use rejected. |
| WP16-AC12 |PASS | Issued operator capability, target/reason/attestation/confirmation and audit. Human identity process not verified. |
| WP16-AC13 |PASS | Factor/codes/sessions/challenges revoked; auth_version advanced. |
| WP16-AC14 |PASS | Reset/restore requires proved enrollment; no password-only full fallback. |
| WP16-AC15 |PASS | Fresh password/current TOTP plus new seed proof for replacement. |
| WP16-AC16 |PASS | Actual nine→eleven-migration legacy-session transition and denial. |
| WP16-AC17 |PASS | Active/version/expiry/source-session rechecks on pending completion. |
| WP16-AC18 |PASS | Full API/page/service guards and compiled Server Action denial. |
| WP16-AC19 |PASS |13 genuine MFA browser scenarios; physical phone check not verified. |
| WP16-AC20 |PASS | Audits, public artifacts, browser persistence and known-secret log scans. |
| WP16-AC21 |PASS | Private PDFs/XLSX/ZIP/no-store and existing financial regression. |
| WP16-AC22 |PASS | Separate-key encrypted restore, stale-state hold, fresh password/enrollment. Production DR not verified. |
| WP16-AC23 |PASS | Existing169 DB results, HTTP/business/recovery browsers and restored race. |
| WP16-AC24 |PASS | Original nine SQL hashes unchanged; thirteen triggers preserved. |
| WP16-AC25 |PASS | Final TypeScript/lint/build/metadata/routes and relevant browser/HTTP reruns. |
| WP16-AC26 |PASS | Synthetic local resources only; no production/deployment. |
| WP16-AC27 |PASS | Dated, scoped delta retains literal failures and human proofing unknown. |
| WP16-AC28 |PASS | Production prerequisites below remain explicit blockers. |

## N. Remaining risks and release gates

| Gate/risk | Production status |
| --- | --- |
| Qualified independent penetration/security assessment |BLOCKED; not performed. |
| Actual hosting Node/MySQL/trigger/private durable storage compatibility |NOT VERIFIED; prior feasibility prerequisites still apply. |
| Real TLS, trusted proxy/origins, Secure cookie and restart behavior |NOT VERIFIED. |
| Vault/key custody, escrow/rotation and offsite paired backup/RPO/RTO |NOT VERIFIED. |
| Real five-user enrollment, authenticator interoperability, operator identity/password handoff |NOT VERIFIED. |
| Strict TOTP lifetime and policy-eligible password corpus |FAIL as documented; resolve/review before GO. |
| Idle timeout, concurrent-session policy and high-risk export step-up/alerts |BLOCKED BY EXTERNAL DECISION. |
| Accountant approval, final owner UI/content/motion signoff |BLOCKED BY EXTERNAL DECISION. |
| Target-host capacity and slower local report/export observations |NOT VERIFIED; performance investigation/measurement required. |

TOTP can be phished/relayed; it is not hardware-backed or phishing resistant. A compromised phone/browser/server, copied factor seed, stolen recovery-code store or dishonest operator remains material. An attacker with a stolen password can race initial enrollment after provisioning/reset; secure identity verification and controlled recovery are essential. No external notification service was configured. Key rotation currently supports explicit IDs and retained old keys, not a separately validated bulk rewrap/vault automation. Live clock synchronization, private backup retention and operational monitoring/identity procedures remain infrastructure/operator responsibilities.

## O. Next work package

Obtain explicit owner decisions for clock-skew/lifetime, idle/session/export step-up and recovery/notification operations; remediate the eligible-password corpus and remaining ASVS backlog; validate a compatible private-storage host, vault/offsite recovery and target-host performance; perform independent security review and accountant/owner signoffs. Authorize the manual-environment MFA migration/key rollout separately when desired. **No next package or deployment was started. Production recommendation remains NO-GO.**
