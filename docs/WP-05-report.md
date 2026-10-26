# WP-05 — Projects, Contracts & Financial Phases

Local delivery evidence, 26 October 2026. **124 test results passed without skips. Visual/hydration verification remains NOT VERIFIED.**

## A. Repository baseline and available sources

Initial branch: `main`, tracking `origin/main`. Initial HEAD: `3625eb5903afe922083161c1c82e8f79d7b7ce3c` (WP-04). Only `AGENTS.md` was modified initially; its owner-provided WP-05 instructions were preserved without editing and included with the authorized delivery. No existing changes were discarded.

Inspected actual schemas, migrations, services, guards, components, tests, README and `docs/WP-02V-report.md`, `docs/WP-03-report.md`, `docs/WP-04-report.md`. Referenced Master Prompt v1.1, D-01–D-14, technical specification/ADRs, UX-01–05, wireframes v2.1 and approved image assets were not present in the repository. Existing Operational Clarity components/tokens were reused; approved visual alignment is not claimed.

Existing exact dependency versions were retained: Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3, Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, mysql2 3.24.6 and tsx 4.23.15. No dependency installation, upgrade or check disabling was performed. The owner's existing GitHub push authorization and request to continue in the same way cover this delivery; no deployment was authorized.

## B. Implementation

Projects now have authenticated list/search/status/client filtering, 20-row pagination, details, create and edit workflows. Client selection searches actual active clients in bounded batches of 20. Project creation rechecks both the client's archive state and selected version while holding its row lock. Creation saves the project, initial active contract and phases together. Project edits support name, location, calendar dates, status and deliberate client reassignment, with version checks and audit. Invalid/archived target clients are rejected. No destructive or newly invented project soft-delete workflow exists.

The combined editor supports adding, naming/describing, increasing/reducing, reordering and requesting logical removal of phases, then one explicit Save. It displays the real active paid values, proposed phase total and contract-minus-phase difference. Intermediate invalid edits are not persisted, and monetary totals are never adjusted automatically. Pending removals can be undone before Save; this is not restoration of an archived database row. Stale saves retain entries and require an explicit reload.

Server validation whitelists editable fields, checks UUIDs and expected versions, name/location bounds, real YYYY-MM-DD calendar dates without timezone conversion, end/start ordering, existing status enums, exact nonnegative DECIMAL(19,2) amount strings and TEXT's UTF-8 byte limit. At most 100 active phases and 128 KiB of mutation JSON are supported. Existing clients/auth request limits remain 8192 bytes by default. Zero-valued contracts/phases and an empty zero-total phase state follow the existing nonnegative schema; no positive minimum or automatic allocation rule was invented.

Saved contract totals must exactly equal all proposed active phase values. All existing active phase identities must occur exactly once, retained or explicitly removed. Foreign/unknown/already archived phases, duplicate identities and stale phase versions are rejected. Only allocations attached to `received` payments count as active. Reductions to the exact active paid amount are valid; reductions below it and removal with active allocations are rejected. Cancelled-payment allocations remain historical references and do not consume active capacity.

One current contract identity per project remains enforced by the existing unique key. Historical projects without contracts can initialize a consistent contract. Explicit editor Save activates an existing draft; cancelled contracts remain read-only, without a new cancellation/restoration workflow. A completed project's archived historical client does not prevent a legitimate contract correction. Reactivating/reassigning the project requires a current active target client. Receipts are not regenerated or changed.

Shared headings, cards, fields, buttons, badges, navigation and tokens remain in use. Client detail references now link to actual project pages. Loading feedback is inline, so server redirects/404s are decided before streaming commits status headers. Empty/error, conflict and success states are implemented. Phase editing uses narrow-screen cards and wrapping fields instead of a horizontally inaccessible editor; visual behavior still requires browser verification.

## C. Database, migrations and concurrency

Reused `clients`, `projects`, `contracts`, `contract_phases`, `payments`, `payment_allocations`, `users`, `audit_events` and `entity_versions`. No competing tables were added.

`drizzle/0004_wp05_project_aggregates.sql` adds project version/positive check and nullable created/updated actor references; contracts gain nullable created/updated actors; phases gain nullable created/updated/deleted actors. Actor foreign keys use RESTRICT and corresponding lookup indexes. Legacy attribution remains null instead of invented. The shared safe snapshot allowlist gains only `activatedAt`, with five existing JSON checks replaced to recognize that approved scalar field. Credential/nested/unknown snapshot rejection remains enforced.

Migration 0004 SHA-256: `ad18f5a53f4e45790395d2e6db18972658d53f9fee92a33efac2f60bbccef8dc`. Migrations 0000–0003 were not edited; all four previous hashes are pinned in tests. The new snapshot/journal entry is additive. MySQL DDL is not treated as automatically atomic.

Actual environment: Docker client/Engine 29.9.2; official `mysql:8.4`, queried **MySQL 8.4.13**, InnoDB, UTC `+00:00`, database `fitimi_test_wp05`, loopback `127.0.0.1:3307` → container 3306. Container: `fitimiconstruction-mysql-wp05`, exact task ID `607091af466af140c3156a265d93524395eca4daa2549f45631f5fdce7e010e9`, ownership label `adore.work-package=WP-05`. The isolated tmpfs instance used generated synthetic credentials. Binary logging was disabled only on that test server for scoped trigger creation.

The real migration command applied all five migrations to the newly created database, then ran successfully again. Subsequent integration tests explicitly reused that migrated database and compared repeat execution/schema fingerprints. Verified **20 application tables, 29 foreign keys, 69 application indexes, 29 enforced checks, 13 original triggers and five matching migration records**.

Mutation lock protocol:

1. Authenticate, validate shape, start a Drizzle/InnoDB transaction at READ COMMITTED, shared-lock and recheck the acting user.
2. Lock relevant client rows in UUID order. Discover the current parent only as a preflight hint; after locking the project, recheck that the relationship did not change. This coordinates with WP-04's client-before-project archive order.
3. Lock project, then its contract, then active phase rows ordered by ID. Recheck project/contract/phase versions and the complete proposed identity set.
4. Read current grouped allocation totals while holding the aggregate locks; enforce capacity, removal eligibility and exact equality using BigInt cents, never floating-point comparisons.
5. Apply business changes, append actor-attributed before/after audit events and immutable entity snapshots, then commit together. One server-generated operation UUID correlates all entities in the save. Any persistence/audit failure rolls back all writes.

**Future payment prerequisite:** allocation insert/update/removal and payment cancellation/reactivation must acquire the same client → project → contract → sorted phase locks before reading capacity or changing effective paid totals. If payment/allocation row locks are also needed, take them after those parents in deterministic order. Recheck discovered parent relationships, capacity and payment/phase project ownership under the locks. A plain SUM without this serialization is insufficient. Raw SQL bypassing the protocol is not a supported business operation and can bypass cross-row service invariants. No payment service is implemented here.

READ COMMITTED ensures an editor waiting for a cooperating writer sees its latest committed allocation total. Details use a read-only REPEATABLE READ transaction so project/contract/phases/paid values come from one read snapshot. Serializing on the client is intentionally conservative; it also serializes separate projects for that client. Financial equality remains a transactional service invariant rather than a falsely claimed single-row SQL CHECK. The protocol follows MySQL's [locking reads](https://dev.mysql.com/doc/refman/8.4/en/innodb-locking-reads.html) and [isolation behavior](https://dev.mysql.com/doc/refman/8.4/en/innodb-transaction-isolation-levels.html).

## D. Exact changed files

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Owner's WP-05 instructions preserved and included |
| `.env.example` | Non-secret WP-05 test ownership-label option |
| `README.md` | Current features, routes and next package |
| `docs/WP-05-report.md` | This technical evidence report |
| `package.json` | Project test commands and inclusion in regression suites |
| `drizzle/0004_wp05_project_aggregates.sql` | Additive version/actor/safe-history migration |
| `drizzle/meta/0004_snapshot.json` | Generated schema snapshot |
| `drizzle/meta/_journal.json` | Fifth ordered migration entry |
| `src/server/db/schema/projects.ts` | Existing project/contract/phase actor/version fields and indexes |
| `src/server/db/history-snapshot.ts` | Approved activation timestamp scalar |
| `src/server/auth/http.ts` | Optional bounded-body size parameter; prior default unchanged |
| `src/features/projects/money.ts` | Exact cent conversion, formatting and editing normalization |
| `src/features/projects/validation.ts` | Whitelisted project/phase/aggregate/query validation |
| `src/features/projects/service.ts` | Authenticated reads, aggregate locks, financial invariants and atomic history |
| `src/features/projects/http.ts` | Auth/origin/body guards and safe uncached responses |
| `src/features/projects/web.ts` | Independent page guards, 404 mapping and redacted failures |
| `src/features/projects/project-link.tsx` | Inline pending navigation feedback |
| `src/features/projects/client-picker.tsx` | Bounded searchable active-client selection |
| `src/features/projects/project-form.tsx` | Project creation/edit form and initial contract setup |
| `src/features/projects/contract-editor.tsx` | Combined phase/contract editing, totals, ordering/removal and one Save |
| `src/features/projects/search-form.tsx` | Search/status/client filter form |
| `src/app/(workspace)/app/projects/page.tsx` | Real bounded projects list |
| `src/app/(workspace)/app/projects/new/page.tsx` | Guarded project/initial-contract creation |
| `src/app/(workspace)/app/projects/[id]/page.tsx` | Real project/client/contract/capacity/history details |
| `src/app/(workspace)/app/projects/[id]/edit/page.tsx` | Guarded project edit |
| `src/app/(workspace)/app/projects/[id]/contract/page.tsx` | Guarded combined contract editor |
| `src/app/(workspace)/app/projects/error.tsx` | Safe error/retry state |
| `src/app/api/projects/route.ts` | List/create API |
| `src/app/api/projects/clients/route.ts` | Authenticated active-client lookup |
| `src/app/api/projects/[id]/route.ts` | Details/update API |
| `src/app/api/projects/[id]/contract/route.ts` | Combined contract/phase save API |
| `src/app/(workspace)/app/clients/[id]/page.tsx` | Working project reference and filtered-list links |
| `src/components/layout/workspace-shell.tsx` | Accurate feature availability notice |
| `src/features/dashboard/dashboard-screen.tsx` | Accurate pending-summary copy, without claiming there are no financial records |
| `src/styles/globals.css` | Shared-token project forms/cards, amount fields and responsive wrapping |
| `tests/projects/fixtures.ts` | Synthetic projects and explicit combined payload helpers; existing auth fixture reused |
| `tests/projects/validation.test.ts` | Exact money, date/storage/UTF-8/identity/query rules |
| `tests/projects/projects.integration.test.ts` | Actual MySQL aggregate, capacity, concurrency, history and rollback scenarios |
| `tests/projects/http.integration.test.ts` | Actual pages/API validation, CSRF, status, money and session denial |
| `tests/db/schema.test.ts` | New migration/FKs; all four previous hashes pinned |
| `tests/db/integrity.integration.test.ts` | Five migration records; existing behavior assertions retained |
| `tests/auth/http.integration.test.ts` | WP-05 exact-ID/label outage verification support |

Ignored `artifacts/wp05` diagnostics and populated local configuration are verification aids, not committed files. No dependency lockfile change was needed because only package scripts changed.

## E. Executed tests and fixes

| Exact command | Actual result |
| --- | --- |
| `npm.cmd run db:generate -- --name=wp05_project_aggregates` | PASS; 0004 generated against 20 models |
| `node_modules/.bin/tsx.cmd artifacts/wp05/environment.ts` | PASS; actual loopback database/version/InnoDB/UTC identity |
| `npm.cmd run db:migrate` | PASS; fresh application, then exact command repeated |
| `npm.cmd run db:check` | PASS; journal/snapshots valid |
| `npm.cmd test` | PASS; 29 results, zero failures/skips |
| `npm.cmd run test:db` | PASS; 70 results, zero failures/skips, including all 13 original triggers |
| `npm.cmd run test:projects:db` | PASS; initial focused 17 results; final expanded project suite has 18 results within `test:db` |
| `npm.cmd run test:projects:http` | PASS; eight results, zero failures/skips |
| `npm.cmd run test:clients:http` | PASS; eight results, zero failures/skips |
| `npm.cmd run test:auth:http` | PASS; nine results, zero failures/skips, including actual guarded database outage |
| `npm.cmd run typecheck` | PASS; generated route types and strict TypeScript |
| `npm.cmd run lint` | PASS; no errors/warnings after correction |
| `npm.cmd run build` | PASS; optimized build, dynamic protected project routes |
| `npm.cmd run start -- --port 3000` | PASS; local loopback verification server |
| `npm.cmd run check:routes` | PASS; ten public SQ/EN routes, root redirect, all private redirects, login and invalid routes |

Total across the final five principal suites: **29 + 70 + 8 + 8 + 9 = 124 Node test results**, including parent/subtests; focused overlapping runs are not counted again.

Database evidence includes: active-client creation; archived/invalid/stale parents; updates/status/dates; stable pagination; historical client correction/reassignment; exact cent totals; multiple simultaneous phase edits/reorder/add/removal; exact paid lower bound and cancelled payment exclusion; foreign/duplicate/omitted/deleted phase rejection; two users editing one phase/contract; simultaneous project edits; three client archive/create races; a test-only compatible allocation-writer race; whole-operation rollback after forced audit/phase INSERT failure; retained cancelled allocation identities and byte-identical issued receipt rows; legacy initial-contract setup; independent anonymous/disabled guards.

Temporary fault triggers were uniquely named, created only in the disposable database and dropped in `finally`; no original trigger was replaced/disabled. Fixture payments/allocations/receipt rows were constructed directly for integrity verification; no payment or receipt workflow was shipped.

Confirmed implementation issues corrected before completion:

- The installed Drizzle version emitted invalid MySQL syntax combining `withConsistentSnapshot` and `read only`. Removed that combination; read-only REPEATABLE READ now establishes its consistent snapshot on the first read. Actual MySQL integration tests then passed.
- Existing TypeScript target rejected BigInt literal syntax. Used standard BigInt constructors without changing the compiler target or disabling checks.
- Typed the projects query explicitly to satisfy strict TypeScript and corrected an unescaped apostrophe in the safe error screen. Lint/checks were rerun.

Browser skill selection returned **“No browser is available”**, supported recovery discovery returned `[]`. No screenshots, real clicks/submissions, hydration, desktop/mobile layout, keyboard or screen-reader interaction were executed. HTTP asserts real labeled output, active navigation, safe escaping and 307/404/API behavior; it is not browser evidence.

## F. Acceptance

| Criterion | Result | Evidence |
| --- | --- | --- |
| WP05-AC01 | PASS | Existing tables/relationships, additive 0004 only |
| WP05-AC02 | PASS | Real project/initial aggregate service and HTTP creation |
| WP05-AC03 | PASS | Archive/version lock checks and three create/archive races |
| WP05-AC04 | PASS | Real search/status/client filters and 20-row pagination |
| WP05-AC05 | PASS | Real client/contract/phase/paid/capacity details and working links |
| WP05-AC06 | PASS | Project status/details/reassignment versions and actor history |
| WP05-AC07 | PASS | BigInt equality on every initial/combined save; rejected mismatch |
| WP05-AC08 | PASS | Transactional project/contract/phase writes, failure rollback |
| WP05-AC09 | PASS | Multiple phase values/descriptions/order changes in one save |
| WP05-AC10 | PASS | Service and HTTP rejection below active allocations |
| WP05-AC11 | PASS | Exact paid-bound reduction accepted with balanced total |
| WP05-AC12 | PASS | Paid phase removal rejected in MySQL/HTTP tests |
| WP05-AC13 | PASS | Eligible archive retains references, actors/versions/history and receipt contents |
| WP05-AC14 | PASS | One concurrent editor wins; stale versions and compatible allocation race preserve invariants |
| WP05-AC15 | PASS | Shared operation UUID, actor before/after audit and immutable versions, forced failure rollback |
| WP05-AC16 | PASS | Page/API/service guards, live session checks, anonymous/disabled denial and CSRF tests |
| WP05-AC17 | NOT VERIFIED | Shared responsive foundation implemented; actual desktop/mobile/hydration/interaction unavailable |
| WP05-AC18 | PASS | 70 real MySQL test results, zero skips, queried 8.4.13 |
| WP05-AC19 | PASS | Four prior hashes pinned, all original 13 guards and auth/Clients suites pass |
| WP05-AC20 | PASS | TypeScript, lint, build, public/private/invalid route checks |
| WP05-AC21 | PASS | No public payment/expense/receipt workflow or service; synthetic fixtures only |
| WP05-AC22 | PASS | Disposable loopback database, synthetic data, no production access |

## G. Security

Every operation reuses WP-03 live session authorization; page guards operate independently of layout visibility. Shared user locking coordinates mutations with deactivation/revocation. APIs authenticate before record lookup/validation, require configured Origin and Host on mutations, whitelist shapes/identities and enforce body bounds. Parameterized Drizzle queries and literal escaped search protect values; server-only boundaries return safe generic database failures without logging bound personal data or SQL. React escapes names/descriptions; HTTP checks script-like names. Responses are uncached and contain no auth token/password/hash/operator secret.

Money is persisted as exact decimal strings, calculated with BigInt cents and checked under parent locks. Optimistic project/contract/phase versions prevent silent overwrites. Audits and immutable versions are part of the same transaction as the domain changes. Previous receipt/audit/history guards, credential-field rejection and foreign-key retention remain intact.

## H. Risks and open verification

No functional defect remains in the executed checks. Browser acceptance and exact alignment to missing approved visual resources remain open. The editor supports 100 active phases, list pages 1–10000 and 128 KiB saves; oversized historical aggregates fail closed rather than truncating a saved financial state. Older history is retained while UI results are bounded to 20 events. No client/project/contract identity is fabricated for historical records.

Future allocation/payment-status services must obey the lock protocol above and recheck all capacity/payment aggregate invariants. The synthetic concurrent writer is test code, not that future production service. Receipt sequencing, payment idempotency/over-allocation, payment corrections and expense/report/export invariants remain deferred. Production TLS/origin/proxy configuration, database least privilege, secret/operator handling, abuse controls and release security review remain prerequisites; no production readiness is claimed.

## I. Scope and cleanup

No actual payment registration/allocation UI or service, expense recording, receipt/PDF generation, financial reporting/export, physical progress tracking, new role or project deletion workflow was introduced. No WP-06 code was started. Synthetic `.invalid` accounts and explicit synthetic fixture values were used exclusively in the task-owned database.

The task-owned loopback server, disposable tmpfs container and generated credentials are removed after verification. Unknown containers, volumes, XAMPP/MariaDB, WSL, virtualization settings and production resources are preserved. Secrets, local artifacts and builds are excluded from the authorized Git commit/push.

## J. Next package

**CONDITIONAL GO for separately authorized WP-06 — Categories, Persons/Suppliers & Vehicles.** The authenticated project/contract/phase foundation is verified against real MySQL and HTTP, including prior module regressions. Browser/visual acceptance remains open before release. WP-06 has not been implemented automatically.
