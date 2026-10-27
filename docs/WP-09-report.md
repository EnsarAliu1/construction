# WP-09 delivery report ? 2026-10-27

## A. Repository baseline

Implemented the current on-disk **WP-09** in `AGENTS.md`, following completed WP-08. Initial branch `main`, HEAD `16cc911aa3f592154954bc0d6562b56fc3b41709`, tracking `origin/main`. The only initial tracked modification was the owner's WP-09 `AGENTS.md`; its contents were not edited. Accessible sources included the actual application, schema, migrations, financial/authentication services, tests and prior repository reports. No unavailable external specification was assumed to have been inspected.

Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3, Drizzle ORM 0.45.4, Drizzle Kit 0.31.11 and mysql2 3.24.6 remain in place. Added exact PDFKit **0.20.2** and development types **0.17.7**. Official Noto Sans regular/bold fonts and their SIL OFL license are included.

The owner's `.env.local`, `.next`, existing manual-test container and database were preserved. `README.md` is unchanged: SHA-256 `915105d49441af288ecbd02a3ba423a85c12cb245ae9d8d27b3ba1694c837569`. Commit/push is covered by the owner's standing GitHub instructions. No deployment is performed.

## B. Receipt architecture

All production-facing payment mutations now use the real trusted WP-08 `ReceiptBoundary {mode:"wp09", apply(tx,context)}`. The callback uses the **existing payment transaction**, without a nested transaction or separate payment commit. The original adapter-free domain entry point still fails closed; HTTP callers cannot provide adapters or fault hooks.

The existing `payment_receipts`, `receipt_versions` and `receipt_counters` are reused. Each confirmation creates one identity and immutable PDF version 1. Corrections retain the number and append document N+1. Cancellation sets the existing `void` status, records actor/reason/time and keeps every prior document byte-identical. Payment revision, receipt optimistic revision and document version are separate values.

Numbering uses a locked unsigned BigInt company counter after the financial aggregate/payment locks. Formatting is separate: development default `DEV-00000001`, configurable uppercase alphanumeric prefix, minimum eight sequence digits, no yearly reset. SQL uniqueness remains authoritative. Issued/exposed numbers never return to the pool. An uncommitted, unexposed allocation rolls back with the counter and its private orphan is recoverable; a committed operation with a lost response retains its number and is recovered by the original key. There is no legal gapless-sequencing claim. Prefix changes do not reset the counter or renumber history.

Cooperative order: storage advisory lease, acting user/live session, client, project, contract, UUID-ordered phases, payment/allocations, receipt and company counter as applicable. The lease is acquired **before** financial locks. WP-05 never requests that lease, so no reverse lock dependency is added. Financial services retain READ COMMITTED and version checks. The coarse shared local-store lease deliberately serializes receipt writers/recovery; SQL aggregate locks still protect capacity against concurrent contract edits and other payment writers.

## C. Durable storage protocol

1. Authenticate, acquire the database advisory storage lease and validate the dedicated private root. Its exclusive ownership marker binds both MySQL **server UUID and database name**, plus a random store owner. A different instance cannot adopt the directory. Existing symlinks/junctions and nonempty unowned roots are rejected.
2. Inside the financial transaction, render actual A4 PDF bytes from scalar database snapshots. Persist an exclusive ownership journal, then an exclusive `.part`; fsync the journal/file contents.
3. Create the immutable final key through an atomic exclusive hard link, not an overwriting rename. Flush supported directories, make the PDF read-only, remove the partial file and reread/verify PDF structure and SHA-256.
4. Only then write receipt identity/version, payment/allocation changes, operation result and actor-attributed audit/entity-version records in the **same SQL transaction**. Acknowledge issuance only after commit and verified document availability.
5. On failure, query database references before any deletion. A lost COMMIT acknowledgement preserves referenced files. If SQL is unavailable, leave owned journals/files for later recovery instead of guessing.
6. Operator recovery takes the same lease, processes at most 100 journals per batch, preserves every referenced key and removes only owned unreferenced partial/final blobs. An incomplete initial journal is removable only with no database reference and no blob; ambiguous entries fail closed. No age heuristic races active writers.

Default storage is `.private/receipts`, never `public`, build output or unrestricted URLs. Blank optional root configuration uses that default. POSIX permissions are root 0700/journal 0600/final PDF 0400. On Windows, chmod alone is insufficient, so explicit NTFS permissions remove inherited workspace grants and allow only the application account, SYSTEM and administrators. Actual test-store ACLs confirmed those three principals with no inherited entries. Files remain application-immutable rather than certified WORM objects.

Windows Node cannot fsync directories; file contents are synced and process/interruption recovery is tested, but sudden host power loss/NTFS volume durability is **not certified**. Production storage/hosting and paired database/filesystem backup/restore must be validated before real use. Rebinding a restored store to another server instance is an explicit operator responsibility, never automatic adoption.

Operator command: `npm.cmd run receipts:recover -- --operator [last-cursor]`. The key is entered invisibly in an interactive terminal. The authenticated recovery service is exercised by integration tests; interactive terminal usability is not independently certified here.

## D. Implemented workflows

- Confirm: exact payment and phase allocations create a real numbered, privately stored non-fiscal receipt. Success requires verified bytes, not a fabricated link.
- Correct: explicit confirmation and the existing optimistic payment version; same receipt number, new immutable snapshot/PDF, old identities/history retained. Missing/inconsistent legacy documents block mutation safely.
- Cancel: explicit confirmation/reason/version; payment capacity/income is released atomically with receipt cancellation. No PDF is rewritten. UI, download filename and `X-Receipt-Status` clearly label every retained version cancelled/historical.
- Download: independent live authentication, validated identity/version, private key resolution, actual checksum verification and attachment/private-no-store/nosniff/sandbox headers. Missing/corrupt bytes return a redacted 503.
- Retry: database-backed canonical operation fingerprint and actor ownership remain authoritative. Exact retries return the original payment/receipt and **original document version 1 even after subsequent corrections**; no extra document or number. Operation status includes actual current availability. Different payloads or unauthorized key reuse fail safely.
- UI: real receipt list/search/status/pagination, payment receipt panel, history/version downloads, active confirmation/correction/cancellation, pending/error/conflict states. Pending confirmation key plus original payload are saved per user in sessionStorage before transmission and recovered through operation status or the same request key. This survives refresh/network failure within the tab; closing the tab can lose that local recovery state, so the persisted payment list/status must be checked before creating another logical operation.

Documents explicitly say **NON-FISCAL**. Company display name is server configuration; absent/blank configuration produces a clear DEVELOPMENT ONLY placeholder. No tax IDs, fiscal certification, signatures or legal company facts are invented. Accountant/PM approval of wording, layout and numbering remains outstanding.

## E. Database and migrations

Used only task-owned `fitimiconstruction-mysql-wp09`, exact container `51e5e6617579883e8dbb88deefcec4a67338bdad2ed27e198bfb5eb71e7a8863`, `127.0.0.1:3308`, `fitimi_test_wp09`, actual **MySQL 8.4.13 / InnoDB / UTC +00:00**. Version/target were checked before migration. Initial migration application used the fresh disposable environment; repeated application succeeded without changes. The later integrity suite correctly reported an already migrated schema rather than claiming its own fresh execution.

`0008_wp09_receipt_issuance.sql` adds receipt optimistic version, nullable legacy-compatible actor/cancellation columns, three actor FKs/indexes and a positive-version check. Five existing JSON checks are expanded only for `companyName`, `documentVersion`, `paymentVersion`, `allocationsText`. No prior migration, competing payment table or original trigger is rewritten. Final inspection: **9 migrations, 20 application tables, 45 FKs, 89 indexes, 37 checks, 13 original triggers**, zero active synthetic users after fixture cleanup.

SHA-256 (all previous eight are pinned in tests and byte-identical to baseline):

| Migration | SHA-256 |
| --- | --- |
| 0000 | `5f972707b506644f976f71bd139f74c72f9e269bfeaba63ff3ca7165572ef16c` |
| 0001 | `21a7d78e4846ea6b53224593eca961dc92edd7bc7d48a42db8b14ed1c1ce9205` |
| 0002 | `023ff3b046a78f33ad4c7fa799804be11254f86a46f31847279d952cceb8eb9a` |
| 0003 | `a2c5cdad7751945aa77a8eef88b94efec28eab9857c63763e0e40dc677d15797` |
| 0004 | `ad18f5a53f4e45790395d2e6db18972658d53f9fee92a33efac2f60bbccef8dc` |
| 0005 | `a90f76f7149e6737dcef9be33f6f00db4218fb35fd4fd83c743dbb3863b85bb4` |
| 0006 | `5a784ca21c0ab0c7f0878381f68a6599c3bfa52a407c70cbecf2c37688da6a7e` |
| 0007 | `cb0a5a2770ee7b2b107982a7ff17e7787002f9d092374732d7944c12416e94bc` |
| 0008 | `cd85620b9068367085e3d0590bef2b0166cc41cee09ff0b9d9f27998709e76f7` |

Original guards retained and exercised: audit_events_no_delete/no_update, entity_versions_no_delete/no_update, contracts_no_delete, contract_phases_no_delete, expenses_no_delete, payments_no_delete, payment_allocations_no_delete, payment_receipts_identity_guard/no_delete, receipt_versions_no_delete/no_update.

## F. Files changed

| Exact path | Purpose |
| --- | --- |
| `.env.example` | Server-only private storage/company/development numbering configuration; WP-09 outage-test ownership label. |
| `.gitignore` | Exclude private document storage and isolated WP-09 builds. |
| `AGENTS.md` | Owner-provided WP-09 task instructions; preserved verbatim. |
| `drizzle/meta/_journal.json` | Register additive migration 0008. |
| `eslint.config.mjs` | Exclude generated isolated build output; retain all source lint rules. |
| `next.config.ts` | External PDFKit, embedded font tracing, private/env tracing exclusions and isolated test build. |
| `package-lock.json` | Exact dependency lock, including PDFKit and type declarations. |
| `package.json` | PDFKit 0.20.2, @types/pdfkit 0.17.7, receipt tests and operator recovery script. |
| `src/app/api/payments/[id]/cancel/route.ts` | Compose payment cancellation with receipt cancellation. |
| `src/app/api/payments/[id]/route.ts` | Compose correction with immutable receipt regeneration. |
| `src/app/api/payments/operations/[key]/route.ts` | Authenticated operation recovery with actual document availability. |
| `src/app/api/payments/route.ts` | Production-facing confirmation uses real receipt issuance. |
| `src/components/layout/workspace-shell.tsx` | Update truthful receipt availability in navigation. |
| `src/features/payments/forms.tsx` | Enable confirmation/correction, per-user pending-key recovery and explicit confirmation. |
| `src/features/payments/screens.tsx` | Receipt details/download integration and safe cancellation controls. |
| `src/features/payments/service.ts` | Expose truthful preview availability while retaining default fail-closed domain boundary. |
| `src/features/workspace/sections.ts` | Replace stale receipt/confirmation placeholder descriptions. |
| `src/server/db/history-snapshot.ts` | Whitelist four additional scalar receipt snapshot fields. |
| `src/server/db/schema/receipts.ts` | Receipt optimistic version and nullable legacy-compatible actor/cancellation fields. |
| `tests/auth/http.integration.test.ts` | Guard WP-09 outage container; read isolated build action manifest. |
| `tests/db/integrity.integration.test.ts` | Nine-migration regression and counter uniqueness checks compatible with existing issued receipts. |
| `tests/db/schema.test.ts` | Pin all eight prior migration hashes and validate additive receipt schema. |
| `tests/payments/http.integration.test.ts` | Actual confirmation/correction/cancellation receipts and existing HTTP/security regressions. |
| `tests/payments/payments.integration.test.ts` | Retain internal receipt gate tests; verify counter remains unchanged by gated requests. |
| `tsconfig.json` | Include generated isolated build route types. |
| `assets/fonts/NotoSans-Bold.ttf` | Official unmodified embedded Noto Sans bold font. |
| `assets/fonts/NotoSans-Regular.ttf` | Official unmodified embedded Noto Sans regular font. |
| `assets/fonts/OFL.txt` | Noto font redistribution license and copyright notices. |
| `drizzle/0008_wp09_receipt_issuance.sql` | Add receipt lifecycle metadata and expand existing scalar JSON checks. |
| `drizzle/meta/0008_snapshot.json` | Generated additive schema snapshot. |
| `scripts/receipts-recover.ts` | Hidden-key authenticated, bounded operator orphan recovery CLI. |
| `src/app/(workspace)/app/receipts/[id]/page.tsx` | Authenticated receipt/version details route. |
| `src/app/(workspace)/app/receipts/error.tsx` | Safe recoverable receipt-page error state. |
| `src/app/(workspace)/app/receipts/page.tsx` | Authenticated persisted receipt list route. |
| `src/app/api/receipts/[id]/route.ts` | Protected receipt/version metadata API. |
| `src/app/api/receipts/[id]/versions/[version]/pdf/route.ts` | Authenticated private version-specific PDF download with cancellation headers. |
| `src/app/api/receipts/route.ts` | Protected bounded receipt list/search/status API. |
| `src/features/receipts/cancel-control.tsx` | Confirmed version-aware cancellation UI. |
| `src/features/receipts/http.ts` | No-store receipt responses and safe authentication/domain/database error mapping. |
| `src/features/receipts/pdf.ts` | Actual embedded-font A4 non-fiscal operational PDF rendering. |
| `src/features/receipts/permissions.ts` | Fail-closed Windows NTFS DACL restriction to the process account/SYSTEM/administrators. |
| `src/features/receipts/screens.tsx` | Receipt list, cancellation indicators, immutable version history and real downloads. |
| `src/features/receipts/service.ts` | Real ReceiptBoundary, transactional numbering/history, retries and live-authorized reads. |
| `src/features/receipts/storage.ts` | Instance-bound private ownership, exclusive durable files, checksums and safe orphan recovery. |
| `tests/receipts/http.integration.test.ts` | Real production HTTP receipt creation/versioning/cancellation/download/security tests. |
| `tests/receipts/pdf.test.ts` | Actual PDF/A4/font/multipage, strict numbering and private configuration validation. |
| `tests/receipts/receipts.integration.test.ts` | Real MySQL/file failure, commit uncertainty, concurrency, identity and recovery tests. |
| `docs/WP-09-report.md` | This technical delivery report and acceptance evidence. |

## G. Test evidence

All test commands below used a task-owned ignored environment, without replacing the owner's `.env.local`. Exact runner: `node artifacts/wp09/run.mjs <script> [argument]`, which executes the corresponding package script with the isolated environment. Thus `node artifacts/wp09/run.mjs test:db` executes the actual `package.json` test:db command, not a replacement implementation. Production server: `node artifacts/wp09/run.mjs start --port 3001`; isolated output `.next-wp09` preserves the owner's development build.

| Package script / command | Actual result |
| --- | --- |
| `npm.cmd test` via runner | PASS ? 48 results, 0 failed/skipped |
| `npm.cmd run db:check` via runner | PASS ? ?Everything's fine? |
| `npm.cmd run db:migrate` via runner | PASS ? applied; repeat application succeeded |
| `npm.cmd run test:db` via runner | PASS ? 154 results, 0 failed/skipped |
| `npm.cmd run test:receipts:db` via runner | PASS ? 16 focused results, including final instance/ownership checks |
| `npm.cmd run test:receipts:http` via runner | PASS ? 9 results, real production server/PDF bytes |
| `npm.cmd run test:payments:http` via runner | PASS ? 10 results |
| `npm.cmd run test:expenses:http` via runner | PASS ? 10 results |
| `npm.cmd run test:references:http` via runner | PASS ? 19 results |
| `npm.cmd run test:projects:http` via runner | PASS ? 8 results |
| `npm.cmd run test:clients:http` via runner | PASS ? 8 results |
| `npm.cmd run test:auth:http` via runner | PASS ? 9 results, including guarded real database outage |
| `npm.cmd run typecheck` via runner | PASS ? route generation and tsc |
| `npm.cmd run lint` via runner | PASS ? zero warnings |
| `npm.cmd run build` via runner | PASS ? optimized production build, 20 static pages; no private-path tracing warning |
| `npm.cmd run check:routes -- http://127.0.0.1:3001` via runner | PASS ? 10 SQ/EN content routes, redirects/login/invalid routes/contact guards |
| `python artifacts/wp09/inspect-pdf.py` | PASS ? actual normal 1-page and long 6-page A4 PDFs, text/bounds/rendering |
| Final schema inspection | PASS ? version/schema/9 hashes/13 guards/zero active fixture accounts |
| Production trace inspection | PASS ? 59 traces, both fonts included; private/test/environment files excluded |
| `npm.cmd audit --json` | Exit 1 ? four existing moderate development-tool advisories, unchanged from baseline |

**275 distinct automated test results passed**: 48 unit + 154 database + 73 HTTP. Focused/repeated runs are not added twice. Database and HTTP suites exercised independent connections, not mocked persistence. Final receipt-specific reruns cover the last storage configuration/instance-binding changes.

Failure coverage includes before/after rendering, partial journal, partial PDF write, exclusive finalization, metadata/audit INSERT failure, before COMMIT, real driver COMMIT failure, committed-but-lost acknowledgement, interrupted response, and cleanup failure. Rollback leaves no phantom payment/request; uncertain committed operations retain their files. Recovery preserves issued history. Actual unavailable paths, junctions, foreign store ownership, overwrite/traversal attempts, missing/corrupt bytes and authenticated/disabled/anonymous access were exercised.

Concurrent tests verify unique company numbers, one exact-retry result, correction/correction and correction/cancellation winners. Prior WP-08 independent-connection payment/capacity and payment-versus-phase-reduction races also pass. No previous test was disabled. An initial counter-integrity fixture assumed an empty counter despite existing receipts; it was corrected to retain the uniqueness assertion without that assumption, then all 154 results passed.

PDF inspection covered Albanian ?/?, long names, 100 allocation lines, correction notice and all seven rendered pages. A footer-induced extra page was found and fixed; normal output is one A4 page with an assertion. Final rerenders were pixel-identical to reviewed pages. UI browser discovery and troubleshooting returned no connected browsers. **Browser interaction, mobile layout, hydration, keyboard/menu and full accessibility acceptance are NOT VERIFIED**; HTTP markup checks do not substitute for those tests.

## H. Acceptance checklist

| Criterion | Result | Evidence |
| --- | --- | --- |
| WP09-AC01 | PASS | Real existing ReceiptBoundary used by all payment mutation routes. |
| WP09-AC02 | PASS | One numbered non-fiscal operational receipt and real version 1 per confirmation. |
| WP09-AC03 | PASS | Independent concurrent confirmations have distinct consecutive company numbers. |
| WP09-AC04 | PASS | Actual A4/embedded-font PDF with payment/client/project/allocations/issuer fields. |
| WP09-AC05 | PASS | Synced private local PDF, exclusive final key; host power-loss certification remains outstanding. |
| WP09-AC06 | PASS | Live authentication independently enforced on download and metadata. |
| WP09-AC07 | PASS | SHA-256 verified; corrupt/missing files fail safely. |
| WP09-AC08 | PASS | Correction keeps number and appends N+1. |
| WP09-AC09 | PASS | Earlier PDFs remain byte-identical and authorized downloads work. |
| WP09-AC10 | PASS | Correction/audit/file failures preserve matching previous states. |
| WP09-AC11 | PASS | Cancellation retains identities, actor/reason/time/history and marks void. |
| WP09-AC12 | PASS | Cancelled payments release active totals/capacity. |
| WP09-AC13 | PASS | Shared actor/correlation and append-only audit/version records. |
| WP09-AC14 | PASS | Payment/allocation/receipt/operation metadata commit in one SQL transaction. |
| WP09-AC15 | PASS | File/SQL/COMMIT/cleanup failures and safe orphan recovery exercised. |
| WP09-AC16 | PASS | Exact and simultaneous retries create one payment/receipt/document. |
| WP09-AC17 | PASS | Interrupted outcome resolved by owner-bound operation status and original key. |
| WP09-AC18 | PASS | WP-05/WP-08 capacity, phase-reduction and correction races retain invariants. |
| WP09-AC19 | PASS | No speculative document/number exposed as issued before commit. |
| WP09-AC20 | PASS | NON-FISCAL labeling and accountant/PM prerequisites explicit. |
| WP09-AC21 | PASS | Eight previous migration hashes, all 13 guards and earlier module regressions pass. |
| WP09-AC22 | PASS | Real disposable MySQL 8.4.13 integration tests pass. |
| WP09-AC23 | PASS | Actual generated/stored/downloaded/rendered bytes, not mocks only. |
| WP09-AC24 | PASS | TypeScript, ESLint, production build and HTTP/route checks pass. |
| WP09-AC25 | NOT VERIFIED | No connected browser; interactive desktop/mobile/hydration/accessibility QA remains. |
| WP09-AC26 | PASS | Synthetic task-owned database/files only; no production/data import/deployment. |

## I. Security review

Equal operational rights are preserved; no new business roles. Pages, APIs and domain services recheck live sessions. Financial transactions retain acting-user/session locks, strict whitelists, bounded bodies/queries, exact BigInt EUR amounts, DATE semantics, version checks and parameterized SQL. Existing Origin/Host mutation checks remain in place. Unknown records and database/file failures are redacted. No client-provided storage reference, receipt number, document bytes, adapter or fault switch is trusted.

Receipts are never in public assets or unrestricted URLs. Windows ACLs, POSIX permissions, immutable random keys, ownership/instance checks, traversal/junction rejection, PDF/SHA checks and private download headers are in place. File keys/checksums occur only in authorized metadata/history, never credentials. The Git index is checked for populated local/test environment secrets before commit. No real client data or production infrastructure is accessed.

The task production server, exact owned MySQL container, synthetic credential files and owned private test store are disposed after evidence collection. The owner's existing container/environment/build are preserved. Ignored synthetic PDF QA samples and logs may remain as evidence.

## J. Remaining risks

- Accountant/PM approval of operational template, exact numbering and tax/accounting treatment is still required. This package supplies no fiscal certification.
- Production persistent storage, Windows power-loss behavior, backup/restore pairing, retention, access configuration and hosting performance require validation. Use a dedicated private location outside public/shared/synced deployment folders. The current adapter is a single shared persistent-filesystem implementation, not an object-store/ephemeral-serverless solution.
- Interactive browser/mobile/hydration and full accessibility QA remain unverified. Pending browser recovery state is tab-scoped as described above.
- `npm audit` reports four unchanged moderate development advisories in Drizzle Kit's esbuild loader chain (`drizzle-kit`, `@esbuild-kit/esm-loader`, `@esbuild-kit/core-utils`, nested `esbuild`). No unrelated forced downgrade/upgrade was applied.

## K. Next work package

Ready for **WP-10 local development** on the verified payment/receipt foundation, with the limitations above explicit. WP-10 is not started. This is not a production release certification.

For the owner's separate local test environment, first start its MySQL, then run `npm.cmd run db:migrate` and restart the development server. That environment was not migrated/reset by this task. Optional company/private-root/prefix settings are described in `.env.example`.
