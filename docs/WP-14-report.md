# WP-14 security delivery — 28 October 2026

## A. Executive assessment

Two reproduced **Medium** confidentiality weaknesses were fixed: receipt bytes could outlive session revocation during filesystem verification, and interrupted payment confirmations persisted financial payloads in tab storage. Private pages now enforce nonce CSP; frame, MIME, referrer and cross-origin resource defenses were added and exercised in Edge. A scoped `uuid` update reduced npm audit from six to **four moderate development-tooling findings**.

**This is a developer security assessment, not an independent penetration test, ASVS certification, or production approval.** No confirmed unresolved Critical/High disclosure finding remains in the executed local scope. Unexamined controls, hosting, MFA/session-policy decisions, monitoring and disaster recovery remain material release risks.

Baseline: `main`, `0677430e814b5a5ebf16e59745c874539a68a91f`; only the owner's replacement AGENTS.md was initially modified. Owner instructions, README.md, .env.local, original **3307/3000** ports and the stopped WP-08 development container were preserved. No production connection, real customer record, deployment, purchase, personal browser-profile access or external target scan occurred.

Actual stack: Next 16.4.3, React 19.3.1, TypeScript 6.0.3, Node 24.18.0, Drizzle 0.45.4 / Kit 0.31.11, mysql2 3.24.6, MySQL 8.4.13, Playwright 1.64.1, Edge/Chromium 156.0.4314.50. No connection pool was introduced.

## B. Threat model

| Boundary / assets | Credible adversary and exfiltration path | Tested protection / residual risk |
| --- | --- | --- |
| Internet → public SQ/EN website | Anonymous attacker probes HTML, RSC, SEO, static chunks, source maps, .env, Git, private/build directories | Curated public content has no private-DB import; public canary/credential and direct-path probes pass. Public inline-bootstrap CSP exception remains. |
| Browser → pages/API | Anonymous, expired/revoked session, disabled account, stolen active session, forged proxy headers | Server guards and current SQL identity checks; 410 state-denial requests. A stolen still-valid session retains its approved rights until expiry/revocation. |
| Authenticated user → company records | Identifier substitution, protected-field injection, operation-key theft | Five equal operational users intentionally share company records. Owner-specific confirmation recovery denies peers; foreign/malformed IDs and DTO injection are tested. No new project roles were invented. |
| API → MySQL / history | SQL injection, capacity manipulation, idempotency abuse, compromised runtime credential | Prepared queries, exact money/locks/triggers, dynamic reduced-privilege trial. A compromised application process still has substantial legitimate business DML access. |
| Application → private filesystem | Traversal, symlinks/junctions, corrupt/overwritten receipt, unowned recovery | UUID keys, ownership binding, restricted directory permissions, immutable versions, checksums and operator recovery tests. Host compromise or privileged filesystem mutation remains outside these guarantees. |
| Export → downloadable bytes | Anonymous download/replay, forgotten sessions, secret/history/path leakage, resource exhaustion | Live checks, no-store, fixed filenames, audited preparation, recursive credential/storage-key exclusions, bounds and exclusive export lease. Authorized users may legitimately download an extensive business copy. |
| Browser recovery state | Another person or same-origin code reads old payment amounts after logout/reload | Only opaque operation keys persist now; financial request body remains in live component memory. Legacy tab drafts are redacted on updated login. Close old application tabs during release. |
| Operator CLI / supply chain / logs | Forged operator capability, leaked command arguments, dependency compromise, diagnostic disclosure | Capability boundary, hidden secret prompts, redacted failures, pinned lockfile and scans. Four dev advisories, incomplete central monitoring, OS/CI compromise remain open. |
| Production / backups | Host/storage exposure, stolen backup/key, ransomware, restored sessions becoming valid again | Architecture and required controls in the handoff. Hosting/TLS/vault/restore controls are NOT VERIFIED locally. |

Protected assets include customer contacts, projects/contracts/phases, all money movements, suppliers/vehicles, numbered receipts/versions, reports/ZIPs, history, accounts/sessions/operator credentials, DB/storage configuration and paired backups. Adversaries include anonymous callers, credential/session thieves, malicious authorized users, dependency attackers and people obtaining logs or backups.

## C. Actual endpoint matrix

[Source inventory](security/endpoint-inventory.json): **30 API route patterns / 38 declared methods**, and **25 private page source patterns**. [Verification evidence](security/verification-evidence.json) aggregates each pattern/method and denial state. Reference kinds are expanded to categories/persons/vehicles; the generic section index additionally tests accounts. Existing auth HTTP tests cover every workspace navigation destination and the actual logout Server Action.

The final dedicated matrix made **410 requests** across anonymous, malformed, expired, revoked and disabled credentials. Sensitive API operations returned 401; private page templates redirected to login with no-store. Login is intentionally public; logout may clear an anonymous cookie and returns no private record. Unsupported methods return 405; OPTIONS/Allow are framework method metadata, not business-data access. CORS did not grant an attacker origin.

Actual private API families: auth session; clients and archive/update; projects/client selector/contract; categories/persons/vehicles/detail/lifecycle/active selectors; expenses/detail/cancel/project selector; payments/detail/cancel/preview/project phases/operation recovery; receipts/detail/version PDFs; dashboard; company report PDF/XLSX; full business ZIP. Every family is represented in the inventory and tests. Account creation/reset/activation remain CLI-only; no registration/reset/admin API was added.

Additional tests cover unknown/malformed IDs, client ID substituted for project ID, payment ID substituted for receipt ID, nonexistent PDF versions, peer operation-key lookup, mass assignment, oversized bodies, hostile Origin, RSC and spoofed middleware/proxy headers. No tested header bypassed service authorization. This is deterministic coverage, not exhaustive input fuzzing or a public penetration test.

## D. Findings and remediations

| ID / severity | Reproduction and root cause | Fix / verified result | Residual risk |
| --- | --- | --- | --- |
| F-01 Medium: receipt revocation race | Real synthetic session was revoked immediately after checksum/file read. Original `downloadReceipt` still returned bytes; regression failed with missing expected AuthenticationRequired. Initial authorization was before potentially slow filesystem work. | Final live session check after file verification and before returning bytes, outside the document-error catch. Same regression passes; authorization failure remains 401 rather than disguised corruption. | Revocation cannot recall bytes already delivered or eliminate the interval after the last check/network send. |
| F-02 Medium: financial tab-storage persistence | Real browser interrupted a confirmation. Original sessionStorage entry contained `payment` including amount/allocation/project identities and survived page changes. This required a previously authorized tab or same-origin/physical-browser access. | Persist only the original UUID idempotency key; keep request body in component memory. Completed confirmations recover by authenticated status. An uncommitted reload explicitly requires re-entry with the retained key. Legacy financial drafts are redacted on updated login. Three browser scenarios pass and each produces one logical payment. | A user who loses the tab/key entirely must consult existing records/operator before re-registering. Already-downloaded data and compromised browser/OS are not remotely erasable. |
| H-01: missing browser defense layers | Baseline configuration lacked explicit frame/CSP/resource policies. This was source/config review, not a claimed reproduced full-data theft. | Enforced per-response nonce/strict-dynamic script policy on dynamic private pages/login; tested untrusted parser script is blocked while real login/logout/forms hydrate. Global frame DENY, nosniff, CORP and permissions policy; private no-referrer and no-store. | Static public Next bootstrap still permits inline scripts; styles remain inline-compatible. No full strict global CSP claim. |
| H-02: vulnerable uuid dependency | ExcelJS 4.4.0 depended on uuid 8.3.2; reviewed advisory affects buffer-based v3/v5/v6. Observed ExcelJS path uses v4, so that exploit path was not demonstrated. | Exact parent-scoped override to CommonJS-compatible uuid 11.1.1; unit/document/HTTP PDF/XLSX/ZIP regressions pass. | Future ExcelJS changes must revalidate the override. Four unrelated development advisories remain. |

No financial SQL rules, transaction isolation, lock order, trigger, receipt number or immutable issued PDF was changed. Recovery preflight never reserves capacity or bypasses authoritative transaction validation. A pending key with a different already-committed payload still conflicts on the server.

## E. Changed paths

| Path | Purpose |
| --- | --- |
| `src/features/receipts/service.ts` | Final authorization recheck before private PDF bytes leave the service. |
| `src/features/payments/recovery-key.ts`, `forms.tsx` | Key-only persistence, live in-memory retry and authenticated reload/status recovery; no financial tab-storage payload. |
| `src/components/auth/login-form.tsx` | Redacts legacy payment drafts without discarding recovery identities. |
| `src/server/security/headers.ts`, `src/proxy.ts`, `next.config.ts` | Tested security headers, private nonce forwarding, private privacy policy; proxy is not an auth decision layer. |
| `src/features/receipts/storage.ts` | Also rejects `.next-wp14` as receipt storage. |
| `package.json`, `package-lock.json` | Reviewed uuid override; repeatable security scripts and five security unit cases in npm test. |
| `scripts/security/{lab.mjs,inventory.mjs,scan.ts,browser.ts,browser-recovery.ts}` | Ownership-guarded setup/reset/disposal, actual route inventory, redacted scans, real-cookie/XSS/CSP and interrupted-payment workflows. |
| `tests/security/{headers.test.ts,password.test.ts,recovery-key.test.ts,download-race.integration.test.ts,runtime-role.integration.test.ts,http.integration.test.ts}` | Security regressions and controlled runtime-grant trial. |
| `tests/auth/http.integration.test.ts`, `tests/reporting/http.integration.test.ts` | Explicit WP-14 task/build/database allowlist for existing real outage tests. |
| `.gitignore`, `eslint.config.mjs`, `tsconfig.json`, `playwright.config.ts` | Isolated `.next-wp14` and evidence; retain original browser tests and OneDrive-safe staging. |
| `docs/WP-14-report.md`, `docs/security/*` | Evidence, control matrix, findings, audit handoff and release risks. |
| `AGENTS.md` | Owner's supplied instructions retained unchanged. |

## F. Authentication and authorization

Argon2id uses 19,456 KiB, two iterations, one lane and 32-byte output. Passwords remain exact strings, permit 64+ characters/Unicode/spaces and are bounded to 1,024 UTF-8 bytes; minimum is 12 characters. No password normalization or composition rule was added. Generic login failures and SQL-backed global/per-email admission limits remain. Account/password/operator functions have no public registration/reset boundary.

Sessions use 256-bit random opaque tokens; SQL stores SHA-256 digests and checks expiry, revocation, active user and auth_version. Production cookies are __Host-prefixed, Secure, HttpOnly, SameSite=Lax, path /, with no Domain. Actual Edge login, cookie-authenticated API, logout Server Action, expiry, deactivation and back navigation were exercised without injecting a Cookie header. Browser cookie tests use the loopback secure-context exception, not a claimed production TLS test.

Equal active client users can view company data, including peers' business records and exports. Confirmation recovery keys remain creator-bound. Operator capabilities are process-issued WeakSet identities; passing a client-forged object/key fails. Real reset/deactivation/revocation regressions remain. Request-local React auth caching was not converted into shared authorization caching.

Known gaps: no MFA, inactivity timeout, common/breached-password screening, self-service session inventory or ordinary user password-change flow. Concurrent sessions have no cap. These are explicitly failed/open ASVS controls and product/security decisions, not silently introduced new permissions. Password-manager integration itself is NOT VERIFIED.

## G. Documents, exports and canary boundaries

Synthetic canaries and credential sentinels were checked in ten public pages, RSC responses, sitemap/robots/icon, requested JS/maps and direct .env/Git/private/build/artifact paths. **75 generated/public files** and nine public script responses contained no tested private canary or credential; source-map probes returned 404. This tests selected exact values, not every possible encoding/covert channel.

Receipt version downloads require live auth; corrupt/missing files fail closed. UUID keys, root ownership, symlink/junction rejection, exclusive creation, fsync/checksums, immutable history and operator-only recovery remain covered by original receipt regressions. No direct public PDF/store path was created.

Report and full ZIP requests require current authorization and same-origin mutation headers; preparation is audited, files use safe attachment/MIME/sandbox/no-store headers. Full ZIP has exact JSON, escaped CSV, verified original receipt bytes and checksums. Password/session/operator fields and nested storage references are excluded. There is no public export replay URL; X-Export-ID is an audit identity, not a download credential. PDF/XLSX formula/string/error regressions pass.

The existing 20,000-row/16-MiB source, 1,000 matched report transactions, 256 receipt versions, 48-MiB receipt and 64-MiB payload bounds remain. Missing/corrupt PDFs or exceeded bounds reject the complete export; no truncation. The global export lease prevents overlapping generation, but does not impose a sustained per-user download quota. Stronger export approval, step-up, watermarking or quota is a proposed owner decision. Revocation cannot revoke copies already legitimately downloaded.

## H. Database and infrastructure

Local schema remains nine byte-unchanged migrations, **20 tables, 45 foreign keys, 89 indexes, 37 checks and 13 original named integrity/history triggers**. All current authentication/financial read-write paths still create/close connections per unit of work. No pool or weaker isolation/locking was introduced.

A task-owned runtime MySQL user was dynamically granted SELECT plus narrowly scoped INSERT/UPDATE, with users read-only and audit/entity/receipt versions append-only. It successfully listed clients, issued a real payment/receipt and generated a complete ZIP. DDL, DELETE, user UPDATE and audit/history mutation were denied by table privileges; the temporary user was dropped. This validates a candidate role, not production GRANT execution. The current local fixture/migration credential remains deliberately separate from that trial.

Runtime, migration, operator-maintenance and backup privilege designs, production TLS/proxy/private-storage/secret controls and recovery binding are in [the audit handoff](security/independent-audit-handoff.md). Current DB helper deliberately accepts only explicitly disposable loopback dev/test databases. A production connection/deployment path and TLS certificate validation must be designed and verified; do not merely remove that guard or point it at production.

Source/build/log scans check known owner/test credential values without reporting them, public files and tracing manifests; Git history filename inspection found no tracked populated .env files. The scanner is not exhaustive historical blob/entropy analysis or malicious-package detection. Server Action encryption manifests are private build artifacts and must remain confidential; HTTP probes cannot fetch them and build directories stay Git-ignored. No genuine secret was discovered in the checked exposure surfaces; no production rotation was performed.

## I. Supply chain

[Exact advisory evidence](security/dependency-review.json), checked 28 October 2026. npm audit reports **0 Critical / 0 High / 4 Moderate** after remediation; this is not a clean audit.

| Package / installed version | Advisory or relationship | Reachability and disposition |
| --- | --- | --- |
| uuid 8.3.2 → **11.1.1** | [GHSA-w5hq-g745-h8pq](https://github.com/advisories/GHSA-w5hq-g745-h8pq) | Runtime ExcelJS transitive dependency; affected buffer APIs not observed in the v4-only path. Scoped override removes this finding and ExcelJS's propagated finding; document regressions pass. No ESM-only major switch. |
| esbuild **0.18.20** | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99), fixed in 0.25.0+ | Legacy dev-tool nested dependency. Its vulnerable development-server CORS behavior is not invoked by this app's production server or the inspected migration/check loader. Do not run/expose that esbuild serve mode. Retain pending a compatible tooling update; an attempted scoped resolution remained invalid and was reverted rather than shipping an invalid dependency tree. |
| @esbuild-kit/core-utils **3.3.2** | Propagates the nested esbuild finding | Dev-only loader utility; same mitigation. No audited patched wrapper offered. |
| @esbuild-kit/esm-loader **2.6.5** | Propagates core-utils | Dev-only legacy loader; same mitigation. |
| drizzle-kit **0.31.11** | Propagates esm-loader | Dev-only migration/generation tooling. npm proposes old 0.18.1 as a major change; not applied because historical migration compatibility takes priority over an inappropriate forced downgrade. |

Direct Drizzle Kit esbuild 0.25.12 and tsx esbuild 0.28.2 are distinct from the vulnerable nested copy. The only installed dependency change is the pinned ExcelJS-scoped uuid override, using `npm install --ignore-scripts`; no lifecycle scripts or audit-fix-force were run. Lockfile v3 integrity/registry metadata was reviewed. Existing optional WASM missing/extraneous warnings mean `npm ls --all` is not clean on this Windows installation; supported native runtime/build/test paths pass. An isolated clean install/SBOM on the chosen production target is still required. Do not describe this as supply-chain certification.

## J. Backup security

The required daily off-site backup, 30-day retention, RPO ≤24 h and RTO ≤48 h are targets, **NOT VERIFIED compliance**. The handoff specifies encryption with separately managed keys, access separation, immutable/versioned retention, paired database/PDF snapshots, checksums, authorized restore, instance-binding validation and revocation of restored sessions. A business ZIP is not a substitute for a complete authenticated database/storage backup. Hosting-specific backup/restore drills belong to WP-15.

## K. Verification results

All tests use labeled task-owned `fitimi_test_wp14`, synthetic accounts/financial records and private task storage; original resources were not reset. Source-controlled `scripts/security/lab.mjs` supports guarded setup/run/reset/dispose and fixed original ports. No global/personal Edge profile was used.

| Command | Final result |
| --- | --- |
| `npm.cmd test` | PASS: 13 website/security + 8 reporting + 48 original = **69** |
| `npm.cmd run db:check` | PASS |
| `npm.cmd run db:migrate` | PASS on fresh disposable schema and repeated application |
| `npm.cmd run test:db` | PASS: 15 reporting + 154 original = **169** |
| `npm.cmd run test:security:db` | PASS: **2**, receipt revocation race and actual least-privilege runtime grant trial |
| `npm.cmd run test:security:http` | PASS: **8** results, including 410 explicit denial requests and canary/exports/header probes |
| Eight original `test:*:http` suites | PASS: reports 12, payments 10, receipts 9, expenses 10, references 19, projects 8, clients 8, auth 9 = **85** |
| `npm.cmd run test:website:db` | PASS: **7** public/private isolation results |
| `npm.cmd run test:website:browser` | PASS: **32** original Edge tests, zero retries/skips; includes hydration, axe, desktop/mobile/no-JS/SQ/EN/reduced motion |
| `npm.cmd run test:security:browser` | PASS: **9** genuine browser/cookie scenarios |
| `npm.cmd run test:security:recovery` | PASS: **3** real interrupted/reloaded confirmation/storage scenarios |
| `npm.cmd run typecheck`, `lint`, `build`, `check:routes` | PASS; 26 public/static pages preserved, dynamic private pages and Proxy built |
| `npm.cmd run security:scan` | PASS for defined credential/build/log surfaces; full historical blob scan not claimed |

**372 passing Node/Playwright regression results**, counting Node parents/subtests consistently with previous packages, plus **12 browser workflow scenarios**. Do not add reruns or the 410 internal HTTP requests again to that result count. Baseline receipt race was intentionally red before the fix; final regression is green. Baseline tab-persistence reproduction is saved separately from final secure recovery evidence. A first CSP probe used a DevTools-created script (a trusted execution context); the final security check correctly uses parser-injected response content under the original response policy.

Logs/evidence are ignored under artifacts/wp14. Redacted public summaries are in docs/security. Screenshots contain only synthetic/local UI; current login and original twenty public route screenshots are retained as local evidence. No complete WCAG, every-browser, production TLS or load/DoS certification is claimed.

## L. ASVS verification matrix

Target: [OWASP ASVS 5.0.0 Level 2](https://asvs.owasp.org/downloads/), using all **253 L1/L2 identifiers** from the official stable CSV. [The delivered matrix](security/asvs-5.0-l2-matrix.csv) records method, code/boundary, threat, evidence/gap and residual risk per control. It records **56 PASS, 14 FAIL, 105 NOT VERIFIED and 78 NOT APPLICABLE**; no passing percentage or conformance claim is made. Non-applicable entries correspond to absent features/protocols such as OAuth/JWT, GraphQL, WebRTC, file uploads and out-of-band OTP; absence of MFA itself is explicitly FAIL, not hidden as N/A.

Coverage also uses [OWASP Top 10:2025](https://top10.owasp.org/2025/0x00_2025-Introduction/) and [API Security Top 10:2023](https://api-security.owasp.org/editions/2023/en/0x11-t10/): access/identity, configuration, supply chain, cryptography, injection, design/resource use, data integrity, logging and exception handling. Documented limits include absent MFA/idle timeout/password denylist/self-service session review, incomplete global strict CSP/abuse logging and unverified hosting crypto/monitoring. These findings must remain visible during independent review.

Implementation references: [Next CSP guidance](https://nextjs.org/docs/app/guides/content-security-policy) for dynamic nonce pages versus static bootstrap constraints; [Node security guidance](https://nodejs.org/learn/getting-started/security-best-practices) for dependency/environment boundaries. No external source was treated as an instruction to deploy or scan another system.

## M. Acceptance

| Criterion | Result | Evidence / qualification |
| --- | --- | --- |
| WP14-AC01 | PASS | Assets, adversaries, entry points, boundaries and exfiltration threats above and in handoff. |
| WP14-AC02 | PASS | Actual 30 API / 25 page pattern inventory and per-method denial outcomes. |
| WP14-AC03 | PASS | Source review plus real cookie login/logout/expiry/deactivation and original auth suites. |
| WP14-AC04 | PASS | 410 state-denial requests across implemented private methods/page templates. |
| WP14-AC05 | PASS | Equal approved company access, foreign/malformed IDs, protected DTOs and creator-bound recovery tested. |
| WP14-AC06 | PASS | Full ZIP denied without current session; recheck and audit/export tests. |
| WP14-AC07 | PASS | Every receipt version route tested without valid auth; original document suites. |
| WP14-AC08 | PASS | Exact private canaries absent from checked public HTML/RSC/SEO/assets/build files. |
| WP14-AC09 | PASS | Defined source/public-build/log/export sentinel scans; explicit nonexhaustive scope. |
| WP14-AC10 | PASS | Exact-money/idempotency/cross-project/race/rollback suites and actual recovery workflows. |
| WP14-AC11 | PASS | Original storage traversal/junction/overwrite/corruption/recovery tests; final PDF revocation regression. |
| WP14-AC12 | PASS | Origin/Host, request-body/DTO and genuine cookie/Server Action checks. |
| WP14-AC13 | PASS | Actual enforced private nonce CSP, parser-script/frame browser tests and HTTP headers; public policy exception documented. |
| WP14-AC14 | PASS | Each initial/current advisory analyzed, uuid fixed, four development findings disclosed. |
| WP14-AC15 | PASS | Role separation/TLS requirements documented; reduced-privilege role dynamically exercised locally. Production TLS remains NOT VERIFIED. |
| WP14-AC16 | PASS | Actual ZIP/PDF/XLSX authorization, current-session, secret/path exclusion and formula tests. |
| WP14-AC17 | PASS | Paired encrypted backup/access/retention/restore architecture delivered; no RPO/RTO claim. |
| WP14-AC18 | PASS | No confirmed unresolved Critical/High disclosure finding in executed scope after fixes. Not a guarantee against undiscovered vulnerabilities or closure of ASVS gaps. |
| WP14-AC19 | PASS | All original business/finance/receipt/export Node/HTTP/browser regressions pass. |
| WP14-AC20 | PASS | Nine historical migrations unchanged; exact 13 original trigger names and locking verified. |
| WP14-AC21 | PASS | Final TypeScript, zero-warning lint, production build and browser checks. |
| WP14-AC22 | PASS | Separate external-review handoff, bounded proposed scope and test setup delivered. |
| WP14-AC23 | PASS | Only synthetic task-owned local DB/accounts/documents/browser contexts. |
| WP14-AC24 | PASS | No deployment, real customer data or external target scanning. |
| WP14-AC25 | PASS | Verified controls, code-review findings, unverified items and release gates distinguished throughout. |

These are work-package delivery criteria, not an assertion that the 253 ASVS controls all pass.

## N–P. Independent handoff, release risks and next package

[Independent audit handoff and release register](security/independent-audit-handoff.md) contains architecture, permission/financial/document controls, production-role/secret/storage/proxy checklist, backup security, setup, allowed local scope and WP-15 prerequisites.

Ready to enter WP-15 **for controlled QA/restore and release-readiness work**, not ready for production deployment or security certification. Require owner/external decisions on the known ASVS gaps, target-host configuration and a qualified independent review. No WP-15 task was started. README remains frozen.
