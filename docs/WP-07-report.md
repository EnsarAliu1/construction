# WP-07 - Expense Transactions

Delivery evidence: 27 October 2026. **208 distinct Node test results passed, with zero final failures or skips.** Counts include Node parent/subtest results, not individual assertions. Browser visual, mobile and interactive verification is **NOT VERIFIED**.

## A. Repository baseline

- Branch `main`, tracking `origin/main`; initial HEAD `74d5b9d055abd3a4a6dbd33e8dafa72d8fd123fc` (WP-06).
- Only initial modification: the owner's new WP-07 `AGENTS.md`. Preserved without editing and included in the delivery. No other existing work was overwritten.
- Read the actual WP-07 instructions, package scripts, schema/migrations, authentication, Clients/Projects/References implementation patterns, money/history helpers, shared UI/navigation and available delivery reports. Available project documents are the repository's WP-02V through WP-06 reports and README.
- Master Prompt v1.1, D-01 through D-14 source documents, Technical Specification, approved UX-01 through UX-05/Wireframes v2.1 and original design assets are absent. Their contents/visual approval are not claimed. Reused the existing neutral Operational Clarity foundation.
- Retained Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.3, Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, mysql2 3.24.6 and tsx 4.23.15. Node 24.18.0/npm 11.6.1. No dependency installation, upgrade or lockfile change.
- The owner's standing GitHub authorization and instruction to continue as before cover commit/push. No production deployment is authorized or performed.

## B. Implementation and explicit behavior

`/app/expenses` now provides actual authenticated outgoing-payment workflows: bounded list/search/filter/pagination, registration, details/history, confirmed correction and logical cancellation. All records come from the existing database. No invented totals or business fixtures appear in the application.

Amount is a positive EUR decimal string, at most 17 whole digits/two fractional digits, canonicalized without floating-point arithmetic. Actual transaction dates are validated real calendar dates within MySQL DATE bounds, independent of UTC creation/change timestamps. Description is meaningful plain text within TEXT's 65535-byte UTF-8 limit; controls/line breaks are rejected consistently with reference forms. No future-date prohibition was invented.

Category is required; project/person/vehicle are nullable. Company-wide expenses require neither project nor client. Client display is derived through the current project relationship; no redundant client ID is accepted. Existing links are prefilled and remain selected while searches run; clearing is explicit. Full replacement mutations accept only the approved editable fields; UI submissions preserve optional links unless explicitly cleared.

New associations require active category/person/vehicle records, and an active, unarchived project with an unarchived client. Suspended/completed projects cannot receive a new expense association. This is the conservative eligibility policy; existing historical associations may be retained during corrections even after lifecycle changes, provided their current selected versions match. Switching away and subsequently attaching an inactive record is rejected. Ordinary correction does not reactivate references.

Inline category creation is available on **new expense registration**. Exactly one existing category or new category name must be supplied. It reuses the transaction-level category primitive also used by WP-06 public category creation. Both category and expense receive actor-attributed audit/version records under the **same operation UUID and transaction**. Existing unique-name collation handles case/accent equivalence; duplicates return 409, including inactive identities. No silent merge or automatic attachment occurs. Corrections select an existing category; inline creation while correcting is intentionally outside this narrow workflow.

Corrections require `confirmation: "correct"` and the expected expense version. Stable ID/creation metadata remain; updated actor/time, before/after audit and immutable entity version are appended. Cancellation requires `confirmation: "cancel"`, expected version and meaningful reason (the existing cancellation constraint requires a reason). It sets cancelled actor/time/status and appends history. Cancelled records are read-only, visible through Cancelled/All filters, and cannot be deleted or reactivated. Future active totals must use `status = 'recorded'`; an actual exact-SUM integration assertion verifies that cancelled amounts are excluded. No totals/dashboard/reporting feature was introduced.

Lists return 20 records, pages 1-10000, deterministic date/ID ordering. Search is at most 100 characters and treats SQL wildcard characters literally; it covers description, category, project, derived client, supplier and vehicle labels. Filters include inclusive actual transaction-date range, category, project, `projectId=company`, person, vehicle and recorded/cancelled/all status. Counts and rows share a read-only REPEATABLE READ transaction. Details use a consistent read transaction and show inactive references, actors, UTC event metadata, cancellation reason and the latest 20 events; older events/versions remain stored.

Reference selection reuses WP-06 bounded active endpoints (minimal ID/label/version). Project choices are bounded to 20 and authenticate independently. Historical selector scope is available for filters, including inactive references/archived projects. Filter scope never relaxes write-time eligibility.

Forms reuse existing cards, headings, fields, buttons, badges, responsive grids, focus rules and labeled scrolling tables. They provide field errors, pending/duplicate-submit protection, retained entries, conflict reload, safe sign-in feedback, success notices, keyboard-operable search/result buttons, explicit correction/cancellation confirmation and no hard-delete control. Inline navigation uses the established pending-link component. No loading boundary was added that could stream a 200 before an authorization redirect/404.

## C. Database

Reused `expenses`, `expense_categories`, `persons`, `vehicles`, `projects`, `clients`, `users`, `audit_events`, `entity_versions`. No replacement/duplicate table. Existing amount/date/status/cancellation/version fields, RESTRICT relationships and indexes remain.

Additive migration **`drizzle/0006_wp07_expenses.sql`**, generated snapshot and seventh journal entry:

- Nullable `expenses.updated_by`, RESTRICT FK to `users` and lookup index. Legacy actors are not invented.
- The flat safe-history allowlist gains only scalar `cancelledBy`, needed for the existing cancellation field. Five JSON checks are replaced with the explicit expanded schema. Unknown/credential/nested values remain rejected, tested by the existing integrity suite.
- No original trigger is disabled/replaced, no history row is rewritten, and migrations 0000-0005 remain byte-identical with all six hashes pinned by regression tests.

Migration 0006 SHA-256: `5a784ca21c0ab0c7f0878381f68a6599c3bfa52a407c70cbecf2c37688da6a7e`.

Actual disposable environment: official `mysql:8.4`, queried **MySQL 8.4.13**, InnoDB, UTC `+00:00`, database `fitimi_test_wp07`, loopback `127.0.0.1:3307`. Container `fitimiconstruction-mysql-wp07`, exact ID `9ff70b1d869ef9e99589484adc844e5dcf2b71c3a5ff05ac797b0417b30676f4`, labels `adore.work-package=WP-07`, `adore.project=fitimiconstruction`. Storage was disposable tmpfs; synthetic random credentials stayed in ignored local files. Binary logging was disabled only in this isolated instance so its scoped test user could create temporary failure-injection triggers.

All seven migrations executed against the newly created database. Repeat `db:migrate` and integration repeat/fingerprint checks passed; later suites correctly reported the already migrated schema. Verified **20 application tables, 39 foreign keys, 82 application indexes, 35 enforced checks, 13 original triggers, seven matching journal hashes**. Final check found zero active synthetic accounts. No unrelated containers/volumes or production database were used. Task-owned server/container and temporary credential files were removed after verification.

## D. Transactions, lock order and concurrency

Every public domain operation independently authenticates the live session. Mutations authenticate/validate, begin READ COMMITTED, shared-lock the actor's user row and recheck the live session. The internal transaction primitive requires an already authenticated, user-locked caller and does not start/commit a nested transaction.

For correction/cancellation, a nonlocking expense read discovers the old associations/version. Parent discovery is only a hint. The transaction locks the union of old/proposed clients in ascending UUID order, then old/proposed projects in ascending UUID order and rechecks each hinted client relationship. If the hint changed, the transaction conflicts instead of acquiring another parent out of order. This composes with WP-04 client archiving and WP-05 aggregate mutations. Reference edits do not acquire project locks, so there is no reverse dependency.

Next it locks the union of old/proposed reference rows in **category, person, vehicle** order, UUID sorted within each kind. It validates proposed identity/version and requires active status for a newly attached identity. Old associations are locked even when removed/replaced. Finally, it locks the existing expense, checks both the expected version and preflight hint version, rechecks recorded status and performs the change. No contract/phase/allocation lock is needed for outgoing expenses. Cancellation locks old relationships but allows their inactive/historical states.

Inline creation obtains project/client locks first, inserts the category at the category position (obtaining its unique-key lock), then obtains optional person/vehicle locks. Reacquiring the already held parent/category locks does not acquire a new out-of-order relationship. Category audit/version and expense changes remain in one transaction. Duplicate concurrent inline names produce exactly one winner and a defined conflict.

Atomic row, actor metadata, audit and immutable version persistence was tested with uniquely named **test-only INSERT failure triggers** on expenses, audit_events and entity_versions. Failures at expense insertion, category audit/version and expense audit/version leave neither category nor orphan category history. Audit failures roll back ordinary creates/corrections/cancellations without version/status changes. Original 13 guards remain present throughout; only each test's own added trigger is dropped in `finally`.

Real independent connections tested concurrent corrections, correction versus cancellation, opposite association swaps, all three reference deactivations versus registration, and project lifecycle change versus registration. Writes serialize or return a version/eligibility conflict; historical references remain readable. A foreign key alone is never used to infer active eligibility.

## E. Exact file manifest

36 delivered paths:

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Owner-supplied WP-07 task, preserved unchanged |
| `.env.example` | Allow documented WP-07 ownership label for guarded outage tests; no values/secrets |
| `README.md` | Current workflows, endpoints, migration, checks and scope |
| `docs/WP-07-report.md` | This required implementation/evidence report |
| `drizzle/0006_wp07_expenses.sql` | Additive actor metadata/history checks |
| `drizzle/meta/0006_snapshot.json` | Generated schema snapshot |
| `drizzle/meta/_journal.json` | Seventh ordered migration |
| `package.json` | Focused expense test commands and main-suite inclusion |
| `src/server/db/schema/finance.ts` | Expense updated actor FK/index |
| `src/server/db/history-snapshot.ts` | Scalar cancelledBy allowlist key |
| `src/features/references/service.ts` | Shared in-transaction category creation with preserved public service behavior |
| `src/features/expenses/validation.ts` | Strict shape, money/date/text, selections, confirmations, query bounds |
| `src/features/expenses/service.ts` | Authenticated domain operations, locks, snapshots, selectors and consistent reads |
| `src/features/expenses/http.ts` | Safe authenticated HTTP boundary, CSRF and bounded JSON |
| `src/features/expenses/web.ts` | Per-page auth, safe redirects/404/errors |
| `src/features/expenses/forms.tsx` | Search selectors, create/correct/cancel and filter forms |
| `src/features/expenses/screens.tsx` | Actual list/create/details/edit screens and historical display |
| `src/app/(workspace)/app/expenses/page.tsx` | Expense list route |
| `src/app/(workspace)/app/expenses/new/page.tsx` | Registration route |
| `src/app/(workspace)/app/expenses/[id]/page.tsx` | Expense details route |
| `src/app/(workspace)/app/expenses/[id]/edit/page.tsx` | Correction route |
| `src/app/(workspace)/app/expenses/error.tsx` | Safe retry/error UI |
| `src/app/api/expenses/route.ts` | List/registration endpoints |
| `src/app/api/expenses/[id]/route.ts` | Details/correction endpoints |
| `src/app/api/expenses/[id]/cancel/route.ts` | Confirmed cancellation endpoint |
| `src/app/api/expenses/projects/route.ts` | Bounded authenticated active/historical project choices |
| `src/components/layout/workspace-shell.tsx` | Accurate module availability notice |
| `src/features/workspace/sections.ts` | Expense navigation terminology/description |
| `src/styles/globals.css` | Bounded scrolling, wrapped selector results |
| `tests/expenses/fixtures.ts` | Isolated synthetic expense/reference/project fixture |
| `tests/expenses/validation.test.ts` | Five focused unit tests |
| `tests/expenses/expenses.integration.test.ts` | MySQL persistence/atomicity/concurrency/auth tests |
| `tests/expenses/http.integration.test.ts` | Actual HTTP/screens/security/error regression |
| `tests/db/schema.test.ts` | Seventh migration/FK support; pins all six previous hashes |
| `tests/db/integrity.integration.test.ts` | Seven migration expectation; all prior guards/assertions retained |
| `tests/auth/http.integration.test.ts` | Accept explicitly owned WP-07 outage container; ownership safeguards retained |

Ignored task diagnostics, generated build/cache, local credentials and node_modules are excluded from delivery. No previous migration SQL or package lockfile changed.

## F. Commands and actual results

| Exact command | Actual outcome |
| --- | --- |
| `npm.cmd run db:generate -- --name=wp07_expenses` | PASS; generated 0006/snapshot/journal |
| `npm.cmd run db:migrate` | PASS fresh seven migrations; PASS repeat |
| `npm.cmd run db:check` | PASS |
| `npm.cmd test` | PASS 38/38 |
| `npm.cmd run test:db` | PASS 116/116, includes WP-03 through WP-07 and schema/guards |
| `npm.cmd run test:expenses:db` | PASS 18/18, repeated after strengthening all-reference races/orphan-history checks; overlaps main DB count |
| `npm.cmd run typecheck` | PASS; Next route generation and strict TypeScript |
| `npm.cmd run lint` | PASS; zero warnings |
| `npm.cmd run build` | PASS; static public pages and dynamic authenticated expense routes |
| `npm.cmd run start -- --port 3000` | PASS; actual production server bound to loopback |
| `npm.cmd run test:expenses:http` | PASS 10/10 |
| `npm.cmd run test:references:http` | PASS 19/19 |
| `npm.cmd run test:projects:http` | PASS 8/8 |
| `npm.cmd run test:clients:http` | PASS 8/8 |
| `npm.cmd run test:auth:http` | PASS 9/9, including guarded real database pause/resume outage |
| `npm.cmd run check:routes` | PASS; ten SQ/EN content pages, eleven private entry redirects, login, invalid routes and disabled contact previews |
| `node_modules/.bin/tsx.cmd artifacts/wp07/inspect.ts` | PASS; real version/schema/journal, zero active synthetic accounts |

Distinct total: **38 + 116 + 10 + 19 + 8 + 8 + 9 = 208**. Focused reruns and route assertions are not counted again.

One initial unit invocation could not start under the restricted Windows tsx runtime (`uv_os_get_passwd ENOMEM`); running the same installed tools with normal user permissions passed, without changing tests/safeguards. Initial TypeScript errors in operation-ID inference/status narrowing were corrected before final checks. Initial hostile-Host HTTP test used Undici fetch, which overrides Host: a genuine native HTTP request now sends the hostile header and verifies 403 for registration/correction/cancellation. The original failure was in the test transport, and no application origin check was weakened.

Browser skill/runtime was consulted; connection selection returned `No browser is available`, troubleshooting discovery returned `[]`. No screenshots, hydration, mobile interaction or accessibility execution is claimed from HTTP checks. Labels/escaped markup/navigation/status responses were actually verified by HTTP; responsive/focus rules were inspected in source.

## G. Acceptance

| Criterion | Status | Evidence |
| --- | --- | --- |
| WP07-AC01 | PASS | Existing expense/reference tables; additive actor metadata only |
| WP07-AC02 | PASS | Company-wide exact expense integration and HTTP |
| WP07-AC03 | PASS | Active project registration and derived client tests |
| WP07-AC04 | PASS | Required category; nullable project/person/vehicle; no client input |
| WP07-AC05 | PASS | Inline new category form/service/HTTP |
| WP07-AC06 | PASS | Shared transaction/correlation; forced failures leave no category/history |
| WP07-AC07 | PASS | All inactive reference kinds rejected on new attachment |
| WP07-AC08 | PASS | Category/person/vehicle deactivation races use same record locks |
| WP07-AC09 | PASS | Search, 20-row pages and all supported filters verified |
| WP07-AC10 | PASS | Actual DATE range inclusive boundaries; creation time not used |
| WP07-AC11 | PASS | Confirmed version-checked corrections with old snapshots |
| WP07-AC12 | PASS | Stable ID/history and explicit CANCELLED details |
| WP07-AC13 | PASS | Recorded-status query and exact persisted SUM exclude cancellation |
| WP07-AC14 | PASS | Expense/category/audit/version failures fully roll back |
| WP07-AC15 | PASS | Independent-connection correction/cancellation race has one winner |
| WP07-AC16 | PASS | Positive decimal strings/BigInt; DECIMAL maximum and 0.01 tested |
| WP07-AC17 | PASS | Every page/API/public domain operation independently guards session |
| WP07-AC18 | PASS | Inactive historical relationships remain readable/cancellable |
| WP07-AC19 | PASS | Existing Operational Clarity forms/components/tokens reused |
| WP07-AC20 | NOT VERIFIED | No connected browser; visual/mobile/hydration/accessibility execution unavailable |
| WP07-AC21 | PASS | MySQL 8.4.13; 116 main DB results with no skips |
| WP07-AC22 | PASS | Previous six hashes, all 13 original guards and prior regressions pass |
| WP07-AC23 | PASS | Strict TypeScript, lint, production build and all HTTP checks pass |
| WP07-AC24 | PASS | No incoming payments/allocations/receipts/report exports introduced |
| WP07-AC25 | PASS | Owned disposable loopback MySQL, synthetic fixtures, no production access |

## H. Security review

Live sessions and active users are required at page, API and public domain service boundaries; anonymous/disabled access is denied before disclosure. Equal business-user permissions remain. Mutations recheck identity under the user lock and use existing exact configured Origin/Host validation. Request JSON is capped at 128 KiB; IDs, positive integer versions, fields, query types/lengths and date ranges are bounded/allowlisted. SQL is parameterized; literal LIKE escaping is inherited from Clients. React escapes labels/descriptions/history. There is no new Server Action, role, account management or DELETE endpoint.

Audit snapshots are flat scalar allowlists, include actual actor/version/correlation/UTC metadata and exclude credentials/session tokens. No raw SQL/Drizzle error or submitted personal value is serialized or logged by the new safe boundaries. API replies use no-store. Forced-error HTTP tests verify redaction and transaction rollback. Locally generated test credentials remain ignored and were checked against staged content before commit; no secret is committed.

## I. Open issues and constraints

- Actual browser/mobile/keyboard/hydration and accessibility execution remains open; connected browser required. This is the sole NOT VERIFIED acceptance item.
- Missing approved visual/source documents remain missing; no new visual approval is claimed.
- Conservative new-project eligibility is active/unarchived only; existing historical links can be retained. No reactivation of cancelled expenses; no inline category creation during corrections. These decisions can be extended only by an approved later workflow.
- Expense clients follow the current project's client relationship, as approved. Historical relationship changes remain audited in Projects; no independent expense-client snapshot/field was invented.
- Existing vehicle required/unique identifier and reference lifecycle semantics remain unchanged.
- Lists/details are bounded to 20 rows/events; all older history remains persisted. No export or full-history download was introduced.
- A lost HTTP response after a successful create requires checking the recorded list before retrying; idempotency is not silently claimed. The UI blocks concurrent submits while pending; a separately approved retry/idempotency policy can use the existing operation_requests infrastructure.

## J. Scope confirmation

No incoming payment registration, financial-phase allocation, receipt numbering/versioning/PDF, financial dashboard, company/project report exports, payables, payroll, inventory, banking, online payments, real data import or production deployment was implemented. Existing payment/receipt schema and regression fixtures remain unchanged. Test-only direct SQL fixtures are synthetic and confined to the disposable environment.

## K. Next package

Ready for separately authorized **WP-08 - Incoming Payments & Financial Phase Allocations**, subject to its approved instructions and remaining browser verification. Do not implement automatically.

WP-08 must retain WP-05 user/client/project/contract/sorted-phase lock ordering and recompute allocation capacity under those locks for allocation AND payment-status writers. Validate exact received payment/allocation sums and project relationships, preserve receipt/history guards, and write business rows/audit/version data atomically. Transaction-level primitives must compose inside one transaction rather than calling transaction-owning top-level services. Expense reference locks are independent of this incoming-payment aggregate; do not introduce a reverse lock dependency. Expense eligibility selectors alone never substitute for locked write-time checks.
