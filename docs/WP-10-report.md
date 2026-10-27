# WP-10 ? delivery evidence

27 October 2026. **309 distinct Node test results passed** (parent/subtest results included; overlapping reruns not counted twice). No deployment. Browser/mobile/accessibility interaction and Excel GUI layout remain NOT VERIFIED.

## A. Repository baseline

Initial `main`, tracking `origin/main`, HEAD `5267c1093048508e6683ffbb07dad35bf2c878c1`. Only the owner's new `AGENTS.md` was initially modified; it is preserved verbatim. Inspected actual schemas, all nine migrations, authentication, projects/contracts/phases, expense/payment/receipt services, test fixtures and WP-05/07/08/09 reports. Master Prompt, original wireframes and approved design/source-content packages were not available; no inspection or design approval is claimed. Existing Operational Clarity UI is reused.

README.md is untouched (SHA-256 `915105d49441af288ecbd02a3ba423a85c12cb245ae9d8d27b3ba1694c837569`). The owner's `.env.local`, `.next` and existing manual-test MySQL container/database are preserved. Commit/push follows the owner's standing authorization; no production access/deployment.

## B. Financial definitions

Only current `payments.status=received` and `expenses.status=recorded` contribute. Cancelled records and past snapshots never become additional money. Current non-retired allocations determine phase paid/capacity. Contract value includes current active contracts on non-deleted projects; completed/suspended projects can retain active contracts. Unpaid contract amount is current value minus qualifying allocations, not guaranteed cash collection.

Money stays DECIMAL strings/BigInt cents, including sums beyond the storage range of one DECIMAL or JavaScript's safe integer range. Shared helpers compute operational income-minus-expenses; it is explicitly not statutory profit. Company-wide expenses count only at company level. Project expenses are directly linked records only.

Inclusive date filters use transaction DATE, not audit timestamps. Method filters income only; category filters expenses only. There is no project export filter. Reports describe latest corrected current state within the selected transaction-date range, not reconstructed historical accounting as-of dates.

## C. Dashboard and project summaries

`/app` and `/api/dashboard` use persisted snapshots: contract value, received income, recorded expenses, difference, unpaid contract amount, active project/status counts and recent transactions. No fabricated trends or demonstration values. Empty snapshots show zeros; inconsistent data produces an explicit unverified/operator-review state.

Existing `/app/projects/[id]` includes financial summaries without PDF/XLSX actions. Income, expenses, original phase values/paid/capacity and new summary are read in the existing single REPEATABLE READ transaction. Per-payment allocation equality, aggregate reconciliation, phase lower bounds and active contract equality are checked before the new summary is labeled verified. Existing edit/history workflows remain intact.

## D. Company report

`/app/reports`, GET/POST `/api/reports/company`: actual date/method/category filters, preview, company-wide/project breakdowns and real PDF/XLSX downloads. UI shows at most 20 detail rows per section with the complete matched count; exports include all matched rows within the explicit 1,000-transaction bound. Preview and each later download have their own labeled consistent snapshot; a later correction can change the next download.

PDF uses existing PDFKit 0.20.2, embedded Noto fonts, A4, exact summary table, transaction records, company breakdown, UTC timestamp, filters and non-fiscal wording. Actual two-page normal and three-page long Albanian samples were extracted, bounded, rendered and visually inspected on every page. A one-page actual full-export PDF guide was also inspected. PDF cursor alignment found during inspection was corrected and verified.

Added exact runtime ExcelJS **4.4.0**, JSZip **3.10.2**. XLSX has Summary, Payments, Expenses, Project breakdown, Categories, Payment methods and Metadata sheets, styled headers, widths, wrapping and frozen header panes. Money, identifiers and calendar dates deliberately use explicit text cells, preserving every cent and avoiding Excel's numeric precision limits. Counts are bounded exact integers. No executable formulas are exported. ExcelJS reopened the actual workbook; independent ZIP/XML checks confirmed exact large decimal strings, valid shared-string references and no formula nodes. Excel/LibreOffice GUI rendering is unavailable and is not claimed. Cells exceeding Excel's 32,767-character limit fail explicitly; extremely long cells can require the spreadsheet formula bar rather than full row display.

## E. Complete business export

POST `/api/exports/business` requires live authorization, same-origin JSON and explicit `confirmation=export-all`. ZIP schema `fitimi-business-export/1` includes 15 datasets in JSON and UTF-8 CSV: clients, projects, contracts, contract_phases, payments, payment_allocations, expenses, expense_categories, persons, vehicles, payment_receipts, receipt_versions, business audit_events, entity_versions and safe business_users profiles.

All active/cancelled/archived states, original IDs, relationships, exact decimals, versions and UTC timestamps remain. JSON is canonical and lossless. CSV formula-leading text receives an apostrophe; import identifiers/decimals as text in spreadsheet CSV import. Every database-referenced immutable receipt PDF in the snapshot is included under validated identity/version filenames and checked against its original checksum. Receipts are never regenerated.

Manifest records schema/time, complete flag, exact dataset counts, payload names/sizes/SHA-256 and expected entries. SHA256SUMS.txt additionally covers the manifest; it does not recursively hash itself. An actual archive was checked entry by entry, including all old receipt versions and 106 real client versions beyond UI pagination.

Excluded: password/auth-version fields (not selected), sessions/token hashes, login limits, operator/environment/database credentials, private storage references even inside audit snapshots, internal idempotency/counter state and authentication-only audit events. Safe user profiles preserve actor relationships. Business audit types are an explicit registry of the actual current modules, including prior export preparation events.

## F. Consistency and performance

Server-only materialization uses one read-only REPEATABLE READ snapshot, fixed-table registry, deterministic ID ordering, 100-row batches and count reconciliation. PDF/XLSX/ZIP generation occurs after the read transaction closes. An independent correction committed between payment/expense reads did not mix snapshot values.

Bounds: 20,000 combined source rows, 16 MiB source JSON, 15-second materialization guard, 1,000 matched company-report transactions, 300 PDF pages/16 MiB PDF, 256 receipt versions/48 MiB receipt bytes, 64 MiB ZIP payload (65 MiB final archive including ZIP overhead). Limits fail clearly instead of silently truncating a complete export. This is a bounded in-memory MVP, not an unlimited streaming export service; peak memory includes source data, document buffers and archive copies. One nonblocking database advisory export lease prevents concurrent expensive exports per database. No temporary export files or public export locations exist.

Authorization is checked before snapshotting, after materialization, during dataset/document generation and before response. A final shared actor lock/live-session recheck and audit INSERT are required before releasing bytes. Audit failure refuses the download. Events say `export_prepared`, not falsely confirmed delivery. Content-Length and manifest checksums support detection of interrupted downloads; network delivery is not asserted by the audit.

## G. Database and migrations

No migration or reporting table was necessary. Existing audit fields safely hold export ID/type/prepared status without embedding the dataset. All nine migration SQL files are byte-identical to baseline and their hashes are pinned. Latest existing 0008 SHA-256: `cd85620b9068367085e3d0590bef2b0166cc41cee09ff0b9d9f27998709e76f7`.

Only task-owned container `fitimiconstruction-mysql-wp10`, ID `0cd321f938e0e6db74088a669d38702173528168c61ce2135265b706844fa07d`, loopback `127.0.0.1:3309`, database `fitimi_test_wp10` was used. Actual server verified before migration: MySQL **8.4.13**, InnoDB, UTC +00:00. Fresh application and repeat migration succeeded. Final inspection: 9 migrations, 20 application tables, 45 FKs, 89 indexes, 37 checks, all 13 original triggers and zero active fixture accounts. No original trigger was replaced/disabled.

## H. Exact changed files

| Path | Purpose |
| --- | --- |
| `.env.example` | WP-10 disposable-test ownership label. |
| `.gitignore` | Exclude isolated WP-10 build. |
| `AGENTS.md` | Owner-provided WP-10 instructions preserved verbatim. |
| `eslint.config.mjs` | Ignore generated WP-10 build, without disabling source rules. |
| `next.config.ts` | Isolated build, runtime XLSX/ZIP packages and font tracing. |
| `package-lock.json` | Exact dependency lock. |
| `package.json` | ExcelJS 4.4.0, JSZip 3.10.2 and additional tests. |
| `src/app/(workspace)/app/projects/[id]/page.tsx` | Exact on-screen project finance summary; no export buttons. |
| `src/features/dashboard/dashboard-screen.tsx` | Replace placeholder with database-backed dashboard. |
| `src/features/projects/service.ts` | Project income/expense/phase consistency in existing repeatable-read snapshot. |
| `src/features/receipts/storage.ts` | Reject new build directory as private storage; receipt lifecycle unchanged. |
| `src/features/workspace/sections.ts` | Accurate report navigation description. |
| `src/styles/globals.css` | Responsive financial cards, columns and download actions. |
| `tests/auth/http.integration.test.ts` | Guard WP-10 outage container and isolated build manifest. |
| `tests/db/schema.test.ts` | Pin ninth pre-existing migration hash. |
| `tsconfig.json` | Generated isolated build types. |
| `src/app/(workspace)/app/reports/page.tsx` | Authenticated company-report screen. |
| `src/app/api/dashboard/route.ts` | Live-authorized current financial snapshot. |
| `src/app/api/exports/business/route.ts` | Confirmed full business ZIP export. |
| `src/app/api/reports/company/route.ts` | Company-only preview and PDF/XLSX downloads. |
| `src/features/reporting/documents.ts` | Actual A4 PDF tables and safe seven-sheet exact-text XLSX. |
| `src/features/reporting/download-controls.tsx` | Pending/error/download feedback and sensitive export confirmation. |
| `src/features/reporting/export.ts` | Company/ZIP orchestration, authorization, export audit, CSV safety and manifest. |
| `src/features/reporting/finance.ts` | Shared current-state eligibility, exact totals, breakdowns and invariants. |
| `src/features/reporting/http.ts` | Origin/body/query guards, private downloads and redacted failures. |
| `src/features/reporting/money.ts` | Shared status definitions and exact operational difference. |
| `src/features/reporting/screens.tsx` | Dashboard, company preview/filters/breakdowns and full export UI. |
| `src/features/reporting/snapshot.ts` | Server-only bounded consistent snapshots and business export registry. |
| `src/features/reporting/validation.ts` | Strict date/filter/format/resource validation. |
| `src/features/reporting/web.ts` | Independent page authorization and safe unverified/error states. |
| `tests/reporting/http.integration.test.ts` | Actual HTTP documents, consistency, security and owned DB outage. |
| `tests/reporting/reporting.integration.test.ts` | Real MySQL current-state, snapshot race, historical completeness and failure tests. |
| `tests/reporting/validation.test.ts` | Exact money, filtering, formula safety and actual document validation. |
| `docs/WP-10-report.md` | This delivery evidence. |

## I. Test evidence

All package scripts ran through `node artifacts/wp10/run.mjs <script>` with isolated environment variables; the runner executes the actual package script without replacing the owner's `.env.local`. `server-only` tests use Node's real `react-server` export condition; existing test commands/conditions are preserved and executed separately, not disabled.

| Command/script | Actual result |
| --- | --- |
| `npm.cmd test` | PASS: 7 new + 48 existing = 55 |
| `npm.cmd run test:db` | PASS: 15 new + 154 existing = 169 |
| `npm.cmd run test:reports:http` | PASS: 12 |
| `npm.cmd run test:payments:http` | PASS: 10 |
| `npm.cmd run test:receipts:http` | PASS: 9 |
| `npm.cmd run test:expenses:http` | PASS: 10 |
| `npm.cmd run test:references:http` | PASS: 19 |
| `npm.cmd run test:projects:http` | PASS: 8 |
| `npm.cmd run test:clients:http` | PASS: 8 |
| `npm.cmd run test:auth:http` | PASS: 9 |
| `npm.cmd run db:check` | PASS: journal/snapshots consistent |
| `npm.cmd run db:migrate` | PASS: fresh and repeated application |
| `npm.cmd run typecheck` | PASS: route generation/strict tsc |
| `npm.cmd run lint` | PASS: no errors/warnings after removing an unused test import |
| `npm.cmd run build` | PASS: optimized build, 23 static pages, new private routes |
| `npm.cmd run check:routes -- http://127.0.0.1:3001` | PASS: 10 public SQ/EN pages, private redirects, login/invalid routes/contact guards |
| Actual PDF/ZIP Python inspection | PASS: A4/text/bounds/Albanian/rendering/checksums; six pages visually reviewed |
| XLSX reopening and independent ZIP/XML inspection | PASS: seven sheets, exact values and safe literal cells/no formulas |
| Production trace inspection | PASS: 63 traces; fonts included, private/test/env files excluded |
| `npm.cmd audit --json` | Exit 1: six moderate advisories, described below |

Distinct total: **55 + 169 + 85 = 309**, zero final failed/skipped tests. Tests cover corrected/cancelled records, retired allocations, actual date boundaries, method/category scope, unassigned expenses, actual maximum MySQL DECIMAL into XLSX, independent MVCC race, >100 real history versions, complete manifests/original PDF checksums, corrupt-file/partial-generation/audit failure, export contention/row limit, revocation, injection, error redaction and actual owned-container outages. Regression intentionally malformed legacy fixtures produce a safe unverified summary, not invented financial totals.

## J. Acceptance

| Criterion | Result | Evidence |
| --- | --- | --- |
| WP10-AC01 | PASS | Persisted dashboard and HTTP values. |
| WP10-AC02 | PASS | Only received income. |
| WP10-AC03 | PASS | Only recorded expenses. |
| WP10-AC04 | PASS | Current corrected rows; history excluded from sums. |
| WP10-AC05 | PASS | Unassigned company costs excluded from project totals. |
| WP10-AC06 | PASS | Operational difference explicitly not statutory profit. |
| WP10-AC07 | PASS | Real project values share original consistent read transaction. |
| WP10-AC08 | PASS | No project financial export endpoint/button/filter. |
| WP10-AC09 | PASS | Inclusive actual transaction DATE filters. |
| WP10-AC10 | PASS | Actual rendered A4 company PDF. |
| WP10-AC11 | PASS | Actual valid seven-sheet XLSX. |
| WP10-AC12 | PASS | Exported details and exact summary values reconcile. |
| WP10-AC13 | PASS | BigInt arithmetic; maximum DECIMAL verified in real MySQL/XLSX. |
| WP10-AC14 | PASS | Repeatable-read materialization and independent correction test. |
| WP10-AC15 | PASS | All 15 approved business datasets/current and historical states. |
| WP10-AC16 | PASS | 100-row batches and 106 actual client versions exported. |
| WP10-AC17 | PASS | Referenced original receipt versions/checksums verified. |
| WP10-AC18 | PASS | Explicit safe profile selection and recursive secret/path exclusion. |
| WP10-AC19 | PASS | CSV escaping; explicit XLSX strings, no formula nodes. |
| WP10-AC20 | PASS | Independent service/page/API guards and post-generation rechecks. |
| WP10-AC21 | PASS | Missing files/audit/partial generation refuse complete output. |
| WP10-AC22 | PASS | Existing cards/tokens/navigation and responsive layout. |
| WP10-AC23 | PASS | Real MySQL 8.4.13 tests pass. |
| WP10-AC24 | PASS | Actual PDF/XLSX/ZIP contents inspected, not mocks. |
| WP10-AC25 | PASS | Nine pinned migrations/13 guards and earlier regressions pass. |
| WP10-AC26 | PASS | TypeScript/lint/build/routes pass. |
| WP10-AC27 | NOT VERIFIED | No connected browser; desktop/mobile/hydration/accessibility interaction not executed. |
| WP10-AC28 | PASS | Synthetic isolated environment only; no deployment/real data. |

## K. Security review

Live WP-03 authorization and equal operational rights remain. Mutation origins/hosts are checked; bodies are bounded at 8 KiB; strict filter/format/confirmation allowlists reject arbitrary project/table/path/filename input. Queries use parameterized Drizzle values and a fixed registry. Download names are fixed safe strings; responses are private/no-store, nosniff, sandboxed and have exact lengths. No unrestricted data API or public export file exists. Errors redact SQL, PII, credentials and physical paths. Source/index secret checks precede commit. The test server/container, synthetic credentials and owned test receipt store are disposed; owner environment is preserved.

## L. Known issues and release gates

Browser discovery/troubleshooting returned no available browser. Desktop/mobile interaction, hydration, keyboard/screen-reader and Excel GUI/print layout are NOT VERIFIED. PDF pages were actually rendered and visually reviewed. Extremely long spreadsheet cells retain exact text subject to documented format/resource bounds; this is not an unlimited export system.

Reports are non-fiscal. Accountant approval of accounting treatment/company identity/wording remains required; no statutory profit or fiscal certification is asserted. Existing WP-09 production private storage, Windows sudden power-loss durability and paired database/filesystem backup/restore prerequisites remain unchanged.

Dependency audit: four unchanged Drizzle/esbuild development advisories plus ExcelJS's transitive uuid advisory and its parent. The uuid advisory concerns v3/v5/v6 buffer APIs; the inspected ExcelJS call site uses v4 for conditional-formatting IDs, not application credentials. The production exporter writes workbooks only and never accepts an uploaded workbook. No unrelated forced dependency upgrade/downgrade was applied; dependency audit is not claimed clean.

## M. Next package

Ready for the owner's next website-content/premium UI instruction on this functional foundation. Approved content/assets and browser visual acceptance remain prerequisites for claiming final visual approval. That next package is not started automatically. No new migration is needed for this package; restart the local development server after pulling changes.
