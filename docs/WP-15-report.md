# WP-15 — Security closure, recovery and controlled release readiness

## A. Executive result

**NO-GO FOR PRODUCTION.** Local implementation and synthetic end-to-end QA are complete; this is not an independent security certification or a hosting approval. No production system, real business data, deployment, external notification or owner browser profile was used. README.md and `.env.local` were preserved. The original MySQL/app ports remain **3307/3000**. The owner's stopped MySQL container was not used.

Inspected baseline: `main`, HEAD `ed6d807b5a53fc67bee2c611bbb84608cb28e6e7`; only the owner's replacement AGENTS.md was initially modified. Actual dependencies remain Next.js **16.4.3**, React **19.3.1**, TypeScript **6.0.3**, Drizzle ORM **0.45.4**, Drizzle Kit **0.31.11**; laboratory MySQL **8.4.13**, Node **24.18.0**, Edge **156.0.4314.50**. No dependencies were installed or upgraded in WP-15.

Delivered offline common-password screening, bounded privacy-preserving operational signals, encrypted paired SQL/PDF recovery with a real independent restore, complete browser business-flow verification, reproducible sequential fixture isolation, safe cleanup and an operational/release dossier. A measured mobile accessibility overflow was fixed with one positioning declaration. Financial services, locking/isolation, immutable document content, permissions, receipt numbering, old migrations and original triggers were not redesigned.

Committed evidence: [release evidence](release/wp15-evidence.json). Operational details and exact local reproduction: [operations and recovery runbook](release/operations-and-recovery.md). Full logs/builds/temporary credentials remain ignored locally under `artifacts/wp15`; they are not an unrestricted audit bundle.

## B. Closure ledger for every historical ASVS FAIL

The original [253-control WP-14 matrix](security/asvs-5.0-l2-matrix.csv) remains historical evidence. **One of its 14 FAIL gaps is locally remediated; 13 remain open** to implementation, policy and independent review. Partial instrumentation does not turn an ASVS control into PASS.

| Historical control | WP-15 action and evidence | Remaining decision / release disposition |
| --- | --- | --- |
| V2.4.1 | Retested login throttling, one-export lease, bounded exports and safe financial conflicts; added load observations. | OPEN: sustained authenticated read/export abuse limits remain incomplete. Owner must approve per-user thresholds/step-up without changing equal permissions. |
| V3.4.3 | Retested enforced private nonce CSP and static public boundary. | OPEN: public Next static bootstrap still permits inline scripts. Review static hash/CSP support or dynamic-rendering cost independently; no silent performance/design tradeoff. |
| V6.1.2 | Common corpus exists, but it is not a project-context policy. | BLOCKED BY EXTERNAL DECISION: approved context terms, matching rules and exception/recovery policy are missing. |
| V6.2.2 | Operator password reset and session invalidation remain tested. | BLOCKED BY EXTERNAL DECISION: approve ordinary password change versus the current operator-only workflow. No public recovery or registration added. |
| V6.2.4 | **LOCAL FIX VERIFIED:** new/reset passwords are screened against **10,001 unique** case-insensitive common entries before Argon2id. New unit test rejects a common password long enough to satisfy the existing length rule. | Exact original password bytes still go into hashing/verification; existing accounts are not forcibly locked out. Independent requirement-level review remains separate. |
| V6.2.11 | Screening architecture can carry a future approved context list. | OPEN: context enforcement is not implemented without the approved list/rules. |
| V6.2.12 | Offline common screen reduces weak choices without transmitting a password. | OPEN: this is not a comprehensive breached-password corpus/service. Select privacy-preserving source/update policy and verify coverage before any PASS. |
| V6.3.3 | Existing account/operator/revocation architecture retained. | BLOCKED BY EXTERNAL DECISION: MFA method, mandatory scope, enrollment, backup factors and operator recovery require approval; MFA is not implemented. |
| V7.1.1 | Existing absolute **8-hour** lifetime, logout, live revocation, account/auth-version checks documented and retested. | OPEN: no approved inactivity policy or full risk-based exception. |
| V7.1.2 | Multiple sessions and five equal-permission accounts remain the current behavior. | BLOCKED BY EXTERNAL DECISION: session cap, inventory and displacement behavior require approval. |
| V7.3.1 | Expired/revoked/deactivated cases retested. | BLOCKED BY EXTERNAL DECISION: idle timeout duration and unsaved-form behavior are undecided; no idle timeout is claimed. |
| V7.5.2 | Operator revocation remains functional. | OPEN: no self-service session review/termination UI. Approve scope with the session policy. |
| V16.3.2 | Common JSON 401/403/429 denials now emit bounded structured signals; login/account audit remains intact. | OPEN: sampled console signals are not a comprehensive durable authorization-denial audit; redirects and complete central collection remain unverified. |
| V16.3.4 | Added safe 5xx, receipt integrity, completed-export and backup/restore signals plus response playbooks. | OPEN: collector, retention, real alert routing/acknowledgement and complete exception coverage require selected infrastructure. |

The corpus is vendored from [SecLists](https://github.com/danielmiessler/SecLists/blob/master/Passwords/Common-Credentials/10k-most-common.txt), with its MIT license. SHA-256 of the exact local asset: `68782d6a4a19a4768d5f15dd66bd534e7a33055cc755411e33f16d18c50fdcce`. Its downloaded contents are pinned in Git; an upstream commit identifier was not independently recorded. No online password lookup or unrelated dependency was added. Missing/undersized screening assets fail new provisioning/reset closed; ordinary verification of existing hashes is unchanged.

## C. Actual end-to-end QA

The new Edge test uses a temporary context and genuine UI login/cookies. Business mutations use the rendered forms; HTTP reads independently reconcile their committed results. It is not a mock UI or direct-service substitute for browser actions.

**13 scenarios passed:** invalid then valid login; individual/business creation, edit, search and audit history; linked project/contract/phases and unequal-sum rejection; contract editing and blocked/allowed client archival; categories/suppliers/vehicles and deactivate/reactivate; stale/inactive reference rejection; project and company-wide expenses including inline category; expense correction/cancellation; overcapacity rejection and split payment; paid-phase deletion/reduction guards; payment correction/immutable version history/cancellation; released capacity reuse and exact reconciliation; actual report/export downloads; mobile/focus/overflow and logout. The script records these as 13 combined workflow scenarios, not a count of every assertion.

**Six genuine downloads:** receipt v1, corrected v2, historical v1, company PDF, company XLSX, complete ZIP. PDFs validate as PDF bytes, XLSX opens as a valid workbook ZIP, and **every complete-ZIP manifest payload checksum and document count is checked**. Original v1 SHA remains identical after correction. After cancellation/reuse the isolated company totals are income **70.00**, expenses **4.00**, difference **66.00**; the project is verified. No floating-point monetary arithmetic was introduced.

The existing **32 website tests**, **9 security browser scenarios** and **3 interrupted-payment recovery scenarios** also pass. The browser collects unexpected console/page errors; intentionally rejected 400/401/409 requests are expected negative cases. Public SQ/EN metadata, accessibility, reduced motion, no-JavaScript navigation, owner motion hooks and private nonce CSP remain covered.

Screenshots: [synthetic mobile clients](release/screenshots/business-mobile.png), [synthetic project](release/screenshots/business-project.png). Initial harness failures were corrected: wrong API wrapper lookup, lifecycle synchronization, aggregate baseline assumptions and missing server startup for the website isolation suite. A shared dirty fixture initially made complete exports correctly fail closed after intentional PDF corruption. Final execution uses a fresh schema/store between suites; no previous assertion was weakened.

The mobile failure was an actual existing implementation issue: at **390px**, absolutely positioned `.sr-only` live-status spans inside a 620px scrollable table contributed a **525px** document width. An isolated same-page candidate changed only the scroller's containing block and measured **525 → 390px**. Final production CSS `.table-scroll { position: relative; ... }` passes the 390px browser assertion; content, screen-reader status text, table scrolling, colors and typography remain intact.

## D. Backup architecture

The [runbook](release/operations-and-recovery.md) specifies the security/ownership contract. The local implementation uses a real operator context, separate dump credentials, a receipt advisory lease **plus a verified database-wide write freeze**, official MySQL dump, original immutable PDFs and an encrypted manifest. All tables, migration rows, trigger definitions and referenced documents are paired under that freeze. A PDF lease alone is not treated as SQL snapshot consistency.

The envelope uses maintained Node **AES-256-GCM**, a fresh 12-byte random nonce, separate generated 32-byte key, authenticated header and 16-byte tag. The encrypted manifest binds source/server/database, storage-owner identity, every row-set digest and PDF checksum, creation and a verified 30-day retention deadline. Exclusive partial-file write/fsync/publication prevents a partial archive from appearing complete. Restore authenticates and bounds the pair before target materialization. Read-only dump passwords travel over stdin via a temporary private container defaults file, never in host command arguments. No plaintext host SQL dump is persisted.

The reference format is deliberately **local-only and bounded**: <=20,000 total table rows, <64MiB SQL, <=128MiB archive/plaintext, <=256 PDFs, strict STORE ZIP names/central-directory limits. Production-scale streaming, remote object storage, retention execution, independent vault/key escrow, key rotation and daily offsite scheduling are **NOT VERIFIED**. Keys and ciphertext occupy separate restricted sibling directories locally, but independent physical/security domains are not claimed.

## E. Actual independent restore

Run `node scripts/release/lab.mjs run test:release:restore` with the task app stopped. Two fresh MySQL 8.4 containers use **different persistent named volumes and different server UUIDs**, switching sequentially on original port3307. They are distinct from the task regression tmpfs container and the untouched owner container. Exact synthetic identities, timings and SHA-256 values are in the committed evidence.

The fixture includes a 100.00 contract with 60/40 phases; payment10.00 corrected to12.00 with two allocations and two immutable versions; another5.00 payment cancelled; company3.00 and project2.00 expenses. The recovery snapshot reconciles income **12.00**, expenses **5.00**, difference **7.00**, outstanding **88.00**.

Restore verifies all **21 tables**, **9 migration records**, **13 original trigger bodies**, every history/cancellation/idempotency/counter row and **3 original PDF versions** before session security updates. It revokes restored sessions and increments account authorization versions; an old session fails and genuine password login succeeds. The original idempotency request replays without a new receipt, numbering continues at **DEV-00000003**, and competing40.00 payments produce **one success/one capacity conflict**. Source business rows/PDFs remain unchanged; operational backup audit events are intentional pre-freeze additions. A complete source digest captured after these events remains identical after target operations.

Elapsed backup/restore measurements include only the instrumented backup/restore operations, **not** host provisioning, key recovery, incident response or human reconciliation. They use a tiny three-PDF synthetic fixture on a warm developer machine. Exact final timings are in the evidence; **production RPO <=24h and RTO <=48h are NOT VERIFIED**.

## F. Recovery failure behavior

Nine exercised negative scenarios: corrupt ciphertext; wrong key; wrong approved source; forged operator; missing PDF; authenticated-but-tampered manifest; incomplete SQL/PDF pair; source/target identity mismatch; injected disk-full failure before publication. Invalid pairs leave the fresh database empty and are rejected before import. ENOSPC removes `.part`, restores write availability and does not publish success. Original source/owner services are not replaced.

Post-import failure is quarantined staging, not an atomic rollback of SQL plus filesystem. The final owner-binding marker is written only after digest/PDF verification, session revocation and restore audit. Do not start a failed target, rebind a runtime store or retry into a nonempty schema. Real power loss, interrupted import, storage ACL denial, offsite/vault outage and disaster-scale capacity remain target-host test requirements, not claimed passes.

## G. Infrastructure feasibility

No production host/tier/domain is selected and verified in this session.

| Capability | Local evidence | Production status |
| --- | --- | --- |
| Persistent Node runtime and native Argon2 | Windows Node24 build/login/document generation | NOT VERIFIED on chosen host/OS |
| MySQL8.4 transactions/row+named locks/13 triggers | Actual disposable MySQL8.4.13 integration and independent restore | NOT VERIFIED for hosted privileges/service tier |
| Separate migration/runtime/backup duties | Actual runtime grant trial; separate read-only dump user | NOT VERIFIED for production principals/vault |
| Durable private receipt filesystem/ACLs | Synthetic private stores and restrictive NTFS permissions | BLOCKED: no production persistent store/backup target selected |
| Paired encrypted offsite backup and retention | Local recovery works; authenticated30-day metadata | BLOCKED: offsite provider/scheduler/key escrow absent |
| TLS/proxy/Origin/Host/cookies | Loopback trust/CSRF tests; secure-cookie/browser tests | NOT VERIFIED with real HTTPS/proxy/domain |
| Supervision/resources/jobs/logging | Lab timings and safe signals; bounded exports | NOT VERIFIED: no host sizing, on-call, collector or scheduler |
| Independent recovery staging | Two actual isolated Docker volumes | NOT VERIFIED on production infrastructure |

An ephemeral-only/filesystem-free host is incompatible with the current private immutable-PDF design. Do not downgrade locks, triggers, authentication or durability to fit an unproven tier. Target native dependencies must be installed/built for that OS; a Windows build is not portable production evidence.

## H. Operational monitoring and incident response

Implemented `securitySignal` accepts only fixed event kind and optional status; it generates UTC time/random correlation itself. Common authorization/throttle/service failures, receipt integrity failures and completed exports now produce redacted signals. Tests prove a per-kind/per-process **20-per-minute** bound and exclude caller secrets/business payloads. This is partial sampled console visibility, not a durable comprehensive security audit or distributed rate limiter. Existing immutable business/export/auth audits remain unchanged.

The [runbook](release/operations-and-recovery.md) covers alert candidates, ownership, access restriction, account/session containment, backup failure, checksum failure, compromise, vault rotation, quarantined restore and safe reopening. No external collector, email/Slack notification or production threshold was configured. Alert delivery/retention/on-call acknowledgement require actual host/operator decisions. Do not send customer values, PDFs, tokens or raw errors into telemetry.

## I. Dependency security and build boundaries

Fresh registry audit: **0 runtime vulnerabilities**, **4 moderate development-tool nodes**, **0 high/critical**. Unchanged remaining chain: nested esbuild0.18.20 ([GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99)) via `@esbuild-kit/core-utils`3.3.2, `@esbuild-kit/esm-loader`2.6.5 and Drizzle Kit0.31.11. These are propagated nodes of the same advisory chain, not four independently demonstrated runtime exploits. Do not expose that legacy esbuild development server. `audit fix --force` suggests a disruptive Drizzle Kit downgrade, not an accepted safe patch. The prior ExcelJS-scoped uuid11.1.1 override remains.

`npm outdated` was reviewed without installing packages: PostCSS8.5.32 is an available unrelated patch; major Node type/ESLint/TypeScript changes were not mixed into recovery/security work. No current compatible advisory-clearing migration-tool update was established. Native/runtime compatibility and an isolated target-host clean install/SBOM still require validation.

Source/public build/log scanning now also recognizes synthetic DR credentials, backup keys and performance-fixture secrets. It examines tracked working files, public static output, top-level local logs, tracing exclusions and historical sensitive filenames; it is **not** exhaustive historical-blob/entropy or malicious-package analysis. Server Action encryption manifests remain private build artifacts, not public assets. Keys, `.env` files, DB dumps, build output, private PDF stores and backup ciphertext are excluded from Git. Exact final scan counts are recorded in the evidence.

## J. Performance regression

Local production build on the same i7-1255U/12 logical CPU/8.25GB Windows developer machine, loopback MySQL8.4.13 and temporary Edge156 contexts. Fixture: **1,001 clients/projects/contracts**, **2,002 phases**, **301 payments/allocations**, **300 expenses**, **12,013 audit rows at seed**, **11 entity versions**, **1 actual receipt version**, one supplier/vehicle. Bulk financial/history rows are explicitly synthetic fixtures; actual issuance is separately exercised by business/receipt/recovery suites.

| Warm measured path | Prior WP-13 optimized median, ms | WP-15 median / sampled tail, ms | n |
| --- | ---: | ---: | ---: |
| Exact finance calculation | 15.62 | 8.95 / 13.61 | 30 |
| Report snapshot | 109.00 | 65.57 / 79.61 | 12 |
| Full export snapshot | 326.45 | 164.38 / 177.79 | 6 |
| Dashboard API | 173.37 | 119.33 / 140.36 | 7 |
| Company PDF | 868.25 | 476.31 / 493.45 | 3 |
| Company XLSX | 261.39 | 176.85 / 192.79 | 3 |
| Complete ZIP | 750.44 | 514.19 / 529.10 | 3 |
| Four concurrent read workers | 67.16 | 53.33 / 135.84 | 32 |

The tail uses nearest-rank sample p95; with n3 it is just the largest sample, not a reliable population percentile. **This is a directional regression comparison, not an attributed WP-15 speedup**: WP-13 had one additional retained project and different process load/security baseline. No new financial optimization or cache was introduced. Export rows/audit grow during downloads. Database query plans and cumulative lock counters are preserved in the evidence; counters are not presented as attributable per-query wait times.

**60 public navigations:** ten SQ/EN pages × desktop/mobile viewports × three fresh contexts, warm server; viewport simulation only, no CPU/network throttling. Desktop pooled FCP/LCP median102ms, largest LCP488ms; mobile94ms, largest188ms; maximum measured CLS0 and JS transfer148,223bytes. Sampled long-task excess max47ms desktop/29ms mobile. These are developer-loopback lab observations, not real-user p75 Core Web Vitals; INP, slow-device and production values are **NOT VERIFIED**.

**36 private navigations:**12 routes ×3; pooled median824.28ms, max1127.27ms **including Playwright's network-idle wait**. Actual search submit860.20ms; warm public navigation128.40ms. No unexpected browser errors. Four-read-worker run:32 successful requests, zero unexpected errors; export/read contention also succeeds. Concurrent previews and idempotent retries preserve one payment identity; competing allocations preserve safe201/409. Measurement-process RSS186.78MB is **not production server RSS**.

The pre-existing [motion budget](WP-13-report.md) remains applicable; no creative animation, brand change or motion runtime was added. Local results reveal no obvious core regression, but capacity, mobile CPU/battery, HTTPS/network and durable-store latency require target-host measurement. Dashboard payload size remains a scaling concern (~848KB uncompressed for this synthetic fixture); it was not redesigned in this package.

## K. Changed files

| Exact paths | Purpose |
| --- | --- |
| `src/server/auth/password.ts` | Server-only cached offline screen for new/reset passwords. |
| `assets/security/common-passwords.txt`, `assets/security/SECLISTS-LICENSE.txt` | Pinned common corpus and upstream license. |
| `src/server/operations/events.ts` | Whitelisted, bounded, payload-free operational signals. |
| `src/server/auth/http.ts`, `src/features/receipts/service.ts`, `src/features/reporting/export.ts` | Safe denial/failure/integrity/export instrumentation; no guard relaxation. |
| `src/styles/globals.css` | Proven table-scroller containing-block fix; visual design unchanged. |
| `scripts/release/paired-backup.ts` | Operator-only bounded authenticated paired backup/restore primitives. |
| `scripts/release/restore-drill.ts` | Actual independent-volume recovery, failures, session revocation and post-restore races. |
| `scripts/release/business-browser.ts` | Real UI business mutations, immutable downloads and exact reconciliation. |
| `scripts/release/lab.mjs`, `scripts/release/verify.mjs`, `scripts/release/cleanup.mjs` | Guarded fixture lifecycle, sequential test isolation and owned resource disposal. |
| `tests/release/events.test.ts`, `tests/release/password-screen.test.ts` | New meaningful screening and bounded/privacy signal regressions. |
| `scripts/performance/measure.ts` | Explicit WP-15 database/output selection; same WP-13 measurement scenarios. |
| `scripts/security/browser.ts`, `scripts/security/browser-recovery.ts`, `scripts/security/scan.ts` | Explicit WP-15 guards/evidence and DR-secret sentinels while retaining WP-14 compatibility. |
| `tests/auth/http.integration.test.ts`, `tests/reporting/http.integration.test.ts`, `tests/security/http.integration.test.ts`, `tests/security/runtime-role.integration.test.ts` | Allow only the declared WP-15 disposable fixture/build/database alongside existing approved work packages. |
| `next.config.ts`, `src/features/receipts/storage.ts`, `playwright.config.ts`, `eslint.config.mjs`, `.gitignore`, `tsconfig.json`, `package.json` | Isolated WP-15 build/trace/storage protections, outputs, types and runnable test scripts. |
| `docs/WP-15-report.md`, `docs/release/operations-and-recovery.md`, `docs/release/wp15-evidence.json`, `docs/release/screenshots/business-mobile.png`, `docs/release/screenshots/business-project.png` | Delivery, operator procedures and redacted synthetic evidence. |
| `AGENTS.md` | Owner-supplied WP-15 instructions preserved byte-for-byte; initially modified before implementation. |

No old migration, schema/trigger definition, README, owner environment, company content or dependency lockfile was changed.

## L. Verification

All commands execute existing npm-script bodies through `node scripts/release/lab.mjs run <name>`, loading only the generated disposable environment. The checked exit status is retained; shell command tails are not used as proof of success.

| Script/check | Final outcome |
| --- | --- |
| `test` | **71 PASS**:15 website/security/release +8 reporting +48 original validation/domain results |
| `test:db` | **169 PASS**:15 reporting +154 original MySQL results |
| `test:security:db` | **2 PASS**:receipt revocation race and genuine scoped runtime-grants trial |
| Eight original HTTP suites | **85 PASS**:auth9, clients8, projects8, references19, expenses10, payments10, receipts9, reports12 |
| `test:website:db` | **7 PASS**, including live ten-page metadata/private-canary isolation |
| `test:security:http` | **8 PASS**, including410 explicit private denial requests and actual receipt/export/no-store/CSP/path probes |
| `test:website:browser` | **32 PASS**, original Edge suite; no skips/retries |
| `test:security:browser`, `test:security:recovery` | **9 +3 PASS** browser scenarios |
| `test:release:browser` | **13 PASS** business scenarios, six downloads, final zero unexpected errors |
| `test:release:restore` | PASS:independent restore, hashes/history/revocation/numbering/idempotency/race plus nine negative scenarios |
| `perf:lab seed/db/browser/races baseline` | PASS:moderate fixture, plans, API/export/contention samples,60 public/36 private navigations and financial races |
| `db:migrate`, `db:check` | PASS:fresh disposable environments; original nine migration hashes and13 triggers retained |
| `typecheck`, `lint`, `build`, `check:routes` | PASS:strict checks, final production output and public/private route smoke checks |
| `security:scan` | PASS for defined source/build/log/tracing/history-filename sentinel scope; counts in evidence |
| `npm.cmd audit --json` / `--omit=dev --json` | Reviewed:four moderate dev nodes /zero runtime; full audit exits nonzero as expected |

**374 distinct passing Node/Playwright results**, plus **25 imperative browser workflow scenarios** and **nine negative recovery scenarios**. Do not add reruns, individual HTTP requests, sub-assertions, repeated restore drills or benchmark navigations to that total. The standalone two-test release script duplicates tests already included in71 and is not added again.

## M. Acceptance

| Criterion | Result | Evidence / limit |
| --- | --- | --- |
| WP15-AC01 | PASS | All14 historical FAIL entries explicitly mapped above. |
| WP15-AC02 | NOT VERIFIED | Common-password gap closed and instrumentation tested; complete high-impact closure still needs abuse limits, approved policies and independent review. |
| WP15-AC03 | PASS | Full private route/method denial regression. |
| WP15-AC04 | PASS | Receipt/export authorization, no-store and secret/path exclusion tests. |
| WP15-AC05 | PASS | Actual UI business flow and existing security/recovery browsers. |
| WP15-AC06 | PASS | Exact totals, correction/cancellation/capacity invariants and original races. |
| WP15-AC07 | PASS | Unchanged historical PDF bytes, appended versions, checksums/history. |
| WP15-AC08 | PASS | Real encrypted paired local backup and failure tests. |
| WP15-AC09 | PASS | Independent fresh persistent volume/server identity restored. |
| WP15-AC10 | PASS | Every restored referenced PDF matches SHA-256. |
| WP15-AC11 | PASS | Nine scoped negative cases fail safely; broader OS/crash cases explicitly unverified. |
| WP15-AC12 | PASS | Receipt3 continuation, original idempotent replay and capacity conflict after restore. |
| WP15-AC13 | PASS | Measured local elapsed times, machine/fixture and exclusions recorded. |
| WP15-AC14 | NOT VERIFIED | Real daily offsite RPO and full production RTO have not been demonstrated. |
| WP15-AC15 | BLOCKED BY EXTERNAL DECISION | Local capability evidence documented; production host/tier is unavailable. |
| WP15-AC16 | PASS | Fresh audits and extended known-secret/build-trace scan; remaining advisories explicit. |
| WP15-AC17 | PASS | Operator/monitoring/recovery procedures delivered; production alert operation remains a separate gate. |
| WP15-AC18 | PASS | Original authentication/payment/receipt races, browser recovery and post-restore race. |
| WP15-AC19 | PASS | No historical migrations/guards/history rewritten;13 triggers verified. |
| WP15-AC20 | PASS | Final TypeScript/lint/build and established browser regressions. |
| WP15-AC21 | PASS | Production-build local performance/API/export/concurrency samples; no security shortcuts. |
| WP15-AC22 | PASS | Synthetic task-owned resources only; owner configuration/resources preserved. |
| WP15-AC23 | BLOCKED BY EXTERNAL DECISION | Independent reviewer, accountant, owner policy/content/UI approvals remain outstanding. |
| WP15-AC24 | PASS | This dossier provides explicit evidence-linked release gates. |
| WP15-AC25 | PASS | Explicit production NO-GO; local tests are not deployment approval. |

## N. Production release gates

| Prerequisite | Status | Required positive evidence |
| --- | --- | --- |
| Local finance/authorization/document regressions | VERIFIED locally | Recorded disposable suite results; repeat on intended target. |
| Local independent paired recovery | VERIFIED locally | Committed redacted recovery evidence; not offsite/production proof. |
| Complete high-impact ASVS closure | FAIL / OPEN | Resolve the13 remaining ledger gaps with approved policy and independent retest. |
| Production host/runtime/MySQL privilege compatibility | BLOCKED | Select host/tier and execute compatibility/security/resource checks. |
| Persistent private PDFs and durable paired backup | BLOCKED | Provision approved durable storage, independent keys/offsite copies and real scheduler. |
| Production <=24h RPO /<=48h RTO | NOT VERIFIED | Recover production-representative data from independent offsite storage under measured incident conditions. |
| Real TLS/reverse-proxy/domain/cookie behavior | NOT VERIFIED | End-to-end HTTPS, validated forwarded-host/origin behavior and secure session checks. |
| MFA/idle/concurrency/password/export policies | BLOCKED | Explicit owner decisions and tested implementation. |
| Central security logs, alerts and on-call | NOT VERIFIED | Configured private collector, retention, notification tests and responsible operator. |
| Independent security audit/signoff | BLOCKED | Approved external reviewer and remediated/retested findings. |
| Accountant/legal receipt and reporting approval | BLOCKED | Real accountant/owner validation; DEV/NON-FISCAL artifacts are not fiscal certification. |
| Final UI/UX, brand/public content/contact consent | BLOCKED | Owner signoff and approved real content/delivery configuration. |
| Production dependency/build provenance | NOT VERIFIED | Target clean install/SBOM, native compatibility and accepted remaining dev-tool risk. |
| Deployment authorization | BLOCKED | Separate explicit authorization after all mandatory gates close. |

## O. Independent audit handoff

Provide source at the final WP-15 commit, the historical ASVS matrix, this closure ledger, endpoint inventory, sanitized release evidence and reproducible fixture scripts. Use a fresh synthetic lab; never provide owner `.env.local`, keys, private builds, raw dumps or business exports as a public attachment. Commissioned reviewers need a separately approved environment/credential transfer and test scope. No external audit/pentest/notification was initiated here.

Prioritize: remaining13 gaps; full export exfiltration/step-up/abuse policy; session/MFA/recovery design; receipt final-session recheck and immutable storage; audit/log completeness versus sampling; crypto envelope/key lifecycle and crash/quarantine recovery; least-privilege grants/trigger definers on target MySQL; proxy/TLS/cookie trust; native dependency/build traces and private storage exposure. The bounded local backup format is reviewable reference code, not a production-certified disaster-recovery product.

## P. Recommendation

**Ready for controlled local owner QA and independent audit preparation. NO-GO FOR PRODUCTION.** Resolve the explicit owner/security/accounting/infrastructure gates, implement only separately approved policy changes, then run target-host security and independent offsite recovery drills. Do not begin another work package or deploy automatically.
