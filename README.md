# Construction website & management workspace

WP-01 provides the local Next.js interface foundation. WP-02 adds a MySQL schema, migrations and database safety tests. The public website has five pages in Albanian and English; the management workspace has a dashboard and ten section screens. All business screens remain empty previews.

**The `/app` area has no server-side authentication or authorization. Do not deploy this application publicly before access control is implemented.** A `noindex` directive is included for previews; it is not access control.

## Local setup

Use Node.js 24 LTS and npm (verified with Node 24.18.0 and npm 11.6.1). The project requires Node >=22 for the database scripts' native environment-file loading. The UI and production build require no environment variables, credentials, database or external services. Database commands are opt-in and described below.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The default route redirects to `/sq`. The server binds to loopback for local use. On Windows PowerShell with script execution disabled, use `npm.cmd` in place of `npm`.

```sh
npm run typecheck
npm run lint
npm run build
npm run start
```

`typecheck` first generates Next.js route types and then runs TypeScript with strict checking. ESLint runs separately from the production build, using the official Next.js flat configuration. With either the development or production server running, check all content routes:

```sh
npm run check:routes
# Optional alternative origin:
npm run check:routes -- http://127.0.0.1:3001
```

This smoke check verifies HTTP responses, document languages, headings, active navigation, the default locale redirect, invalid-route responses and disabled contact forms. Browser checks are still needed for responsive appearance, keyboard interaction and hydration.

## Routes and architecture

- `/` redirects to `/sq`.
- `/sq`, `/en`: home.
- `/{sq|en}/{about|services|projects|contact}`: the other four public pages.
- `/app`: dashboard.
- `/app/{clients|projects|payments|expenses|receipts|reports|categories|persons|vehicles|accounts}`: workspace sections.
- Unsupported locales and section slugs return 404.

App Router route groups separate entry, website and workspace layouts. Separate root layouts provide the correct server-rendered HTML language (`sq`/`en` on the website, `en` in the workspace). Transitions between these root layouts can perform a full document navigation, as intended by Next.js. Pages and layouts are server components. Only navigation and language switching use client components.

The typed dictionaries in `src/i18n/dictionaries.ts` drive both languages through shared page components. The language switcher preserves the current page. URLs use the same section slugs in both languages.

Routing composes feature screens; shared components do not import feature business logic. The server-only persistence foundation is in `src/server/db`. Its connection is lazy and explicitly closed, so importing or building pages does not access a database. No business domain service or CRUD is implemented. Add transactional business logic within the authorized future packages.

## Files

| Path | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | Scripts, exact direct dependency versions and reproducible npm resolution |
| `.gitignore` | Exclude builds, dependencies, local artifacts and secrets |
| `AGENTS.md` | Next.js-generated instructions pointing future agents to the installed framework documentation |
| `tsconfig.json` | Strict TypeScript and `@/*` alias |
| `next.config.ts` | Framework configuration and explicit workspace build root |
| `eslint.config.mjs` | Next.js Core Web Vitals and TypeScript lint rules |
| `postcss.config.mjs` | Tailwind CSS PostCSS integration |
| `src/app/(entry)/layout.tsx` | Root redirect document layout |
| `src/app/(entry)/page.tsx` | Albanian default redirect |
| `src/app/(website)/[locale]/layout.tsx` | Localized document, metadata, header and footer |
| `src/app/(website)/[locale]/page.tsx` | Localized home route |
| `src/app/(website)/[locale]/[page]/page.tsx` | Validated localized public section routes and metadata |
| `src/app/(workspace)/app/layout.tsx` | Workspace document, shell and preview metadata |
| `src/app/(workspace)/app/page.tsx` | Dashboard route |
| `src/app/(workspace)/app/[section]/page.tsx` | Validated workspace section routes and metadata |
| `src/components/ui/index.tsx` | Button, input, form field, card, badge, heading, empty state and scrolling table shell |
| `src/components/layout/navigation.tsx` | Active links, desktop navigation and accessible mobile disclosure |
| `src/components/layout/workspace-shell.tsx` | Sidebar, mobile header, preview notice and main landmark |
| `src/components/public/public-shell.tsx` | Public header, navigation and footer |
| `src/components/public/language-switcher.tsx` | Page-preserving language links |
| `src/features/dashboard/dashboard-screen.tsx` | Empty dashboard with workspace links |
| `src/features/workspace/sections.ts` | Typed screen definitions, descriptions and navigation |
| `src/features/workspace/section-screen.tsx` | Reusable workspace screen composition |
| `src/features/website/public-screen.tsx` | Shared, localized page composition and disabled contact preview |
| `src/i18n/dictionaries.ts` | Typed Albanian/English copy and public route definitions |
| `src/lib/utils.ts` | Class-name helper |
| `src/types/navigation.ts` | Shared navigation contract |
| `src/styles/tokens.css` | Provisional neutral design tokens |
| `src/styles/globals.css` | Tailwind import, component styles and responsive layout |
| `scripts/check-routes.mjs` | HTTP integration smoke check |
| `README.md` | Setup, architecture, scope and limitations |

`next-env.d.ts`, `.next/` and TypeScript incremental files are generated locally and excluded from Git.

## UI and content status

The only supplied specification was the WP-01 implementation prompt. The repository was empty. No Master Project Prompt v1.1, UX Structure v1.0, UX Review & Decision Handoff v1.1, UX Wireframes v2.1 corrections, Phase 3 Visual Direction + UI Kit Foundation, UI Kit Board, UI Showcase or UI Design System was available. There were no approved logos, photos, fonts, brand tokens or final company copy.

The provisional foundation follows the stated Operational Clarity direction: neutral surfaces, restrained borders, clear navigation, visible focus indicators, consistent headings and readable table scaffolds. Tokens are centralized for later alignment. System fonts avoid external font downloads. The text wordmark “Construction” is explicitly a working title, not an approved company identity. The schematic illustration is CSS artwork clearly labeled as not depicting a real project. Exact approved visual alignment remains pending source verification.

Desktop workspace navigation uses a sidebar. Mobile navigation uses a native button with `aria-expanded` and `aria-controls`, normal keyboard-operable links, Escape to close and return focus, outside-click dismissal and reset on route changes. It is a nonmodal disclosure, so page focus is not trapped. Tables use a labeled, focusable horizontal scrolling region. Reduced-motion preferences are respected.

## Scope and security

- No authentication, authorization or business CRUD. The WP-02 schema and migration infrastructure is present, but no database is connected to the UI.
- No real client information, financial values or simulated production records.
- No working save, payment confirmation, delete, receipt or export actions.
- Contact controls are disabled, labeled as unavailable and have no submission service.
- Company content, project descriptions, contact information and photos await approval.
- Income refers to received payments; expenses refer to outgoing payments; currency is EUR.
- Project statuses are Active, Suspended and Completed. Contract phases describe financial structure, not physical progress.
- Future reporting is company-level PDF/Excel export and on-screen project summaries. Individual project export is out of scope.
- No production deployment, production credentials, external API integrations or infrastructure changes.

## Toolchain compatibility

Exact direct versions are recorded in `package.json` and `package-lock.json`. Registry checks found newer ESLint 10 and TypeScript 7 releases, but the installed Next.js lint plugins require ESLint 9 and TypeScript <6.1. The project therefore pins the latest matching releases resolved by npm: ESLint 9.39.5 and TypeScript 6.0.3. npm marks ESLint 9 as unsupported; updating it requires a compatible Next.js plugin toolchain. No peer dependency overrides or disabled checks are used.

Setup follows the official [Next.js installation guidance](https://nextjs.org/docs/app/getting-started/installation), [Next.js ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).

## Next package

WP-03 Authentication & Authorization is not implemented. The identity table is available for that work. MySQL migration/integrity execution remains an outstanding verification gate, and the Adore administrator/client role model, account lifecycle and five-active-client-user rule still need implementation in WP-03. The UI must remain local until server-side access control is complete.

## WP-01 verification record — 26 October 2026

| Exact command | Result |
| --- | --- |
| `npm.cmd ci` | PASS: 441 packages installed; 0 vulnerabilities reported |
| `npm.cmd ls --depth=0` | PASS: clean dependency tree with exact direct versions |
| `npm.cmd run typecheck` | PASS: route types generated; strict TypeScript exited 0 |
| `npm.cmd run lint` | PASS: no errors or warnings |
| `npm.cmd run build` | PASS: optimized build; 24 generated pages including redirect and framework 404 |
| `npm.cmd run dev` | PASS: ready on loopback port 3000 |
| `npm.cmd run check:routes` | PASS: 21 content routes, root redirect, 3 invalid URLs and disabled contact previews |
| `npm.cmd run start -- --port 3001` | PASS: local production server ready |
| `npm.cmd run check:routes -- http://127.0.0.1:3001` | PASS: same HTTP checks against the production build |

Both owned local servers were stopped after verification. No production deployment occurred. Server responses were successful, and no application exceptions were observed. The development server emitted one `MaxListenersExceededWarning` while serving deliberately invalid routes; this was not observed when running the same checks against the production server. This remains a development-runtime warning; its cause has not been conclusively established. The application does not register Node server response listeners.

Browser setup returned “No browser is available” and discovery returned an empty list. Visual appearance, actual desktop/mobile menu interaction, keyboard behavior and client hydration remain **NOT VERIFIED**. HTTP integration checks are not a substitute for browser verification.

All WP01 acceptance criteria have implementation/command evidence except **WP01-AC07**, which remains **NOT VERIFIED** until desktop and mobile navigation are tested in a browser. **WP01-AC14** is satisfied by reporting unavailable sources and keeping provisional design choices explicit; exact visual alignment is not claimed. No known application defect was found by the executed checks.

## WP-02 database foundation

Baseline: clean `main` at `7c2cc551d4b6d2680bc92f96af2966945deeb1ef`. The WP-02 prompt is the available schema authority. No additional approved business specification or Master Project Prompt was present; the assumptions below are explicit.

### Technology and compatibility

Target **MySQL 8.4 LTS / InnoDB**, with `utf8mb4_0900_ai_ci` tables. The connection guard rejects MariaDB and other unverified MySQL versions. Drizzle ORM **0.45.4**, Drizzle Kit **0.31.11**, mysql2 **3.24.6**, tsx **4.23.15** and server-only **0.0.1** are pinned. Existing Next.js 16.4.3 and TypeScript 6.0.3 are retained.

Drizzle provides typed, SQL-oriented schema definitions and versioned MySQL migrations without generated clients, a separate backend or a database connection during builds. mysql2 supports exact decimal strings and calendar-date strings. Migration execution uses a single connection, as recommended in the [Drizzle MySQL documentation](https://orm.drizzle.team/docs/mysql/get-started-mysql). Stable npm releases were selected rather than the release candidates shown in newer documentation examples.

`server-only` prevents client components importing the connection entry point. The config and migration modules are infrastructure for Node scripts; they must not be imported into client components. There are no database API routes, business CRUD, sessions or connection attempts during page rendering.

### Local disposable setup

No database service was installed, started or provisioned for WP-02. Discovery found no listener on port 3306 or MySQL service. Docker Desktop exists but its engine is unavailable. `C:\xampp\mysql\bin\mysqld.exe --version` identifies **MariaDB 10.4.32**, which is not the target and was not started or connected to. Database execution therefore remains **NOT VERIFIED**.

When an authorized local MySQL 8.4 instance is available, create **new, dedicated, empty** databases using your local administration tooling:

```sql
CREATE DATABASE fitimi_dev_wp02 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE DATABASE fitimi_test_wp02 CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
```

These are manual setup instructions, not commands executed during WP-02. Use a local database account with the DDL/DML, index, reference and trigger privileges required within those disposable databases. Use neither a client database nor a database containing valuable records. No database reset/drop command is included in the scripts or tests.

Copy `.env.example` to ignored `.env.local` and fill these variables privately:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Local migration/development MySQL URL targeting `fitimi_dev_*` or `fitimi_test_*` |
| `TEST_DATABASE_URL` | Separate dedicated test database; name must start with `fitimi_test_` |
| `DATABASE_DISPOSABLE` | Explicit opt-in: set to `1` only after verifying the target is disposable |

URL structure: `mysql://<local-user>:<local-password>@127.0.0.1:3306/fitimi_dev_wp02`. Percent-encode credentials. The example file contains no credentials. Only `localhost`, `127.0.0.1` and `::1` are allowed; URL query parameters are rejected. Naming and the opt-in are safeguards, not proof that a database is disposable: verify it yourself before opting in. Node scripts load `.env.local` without overriding existing process environment variables. No `NEXT_PUBLIC_*` variable is used.

### Migration and test commands

```sh
npm run db:generate -- --name=descriptive_change_name
npm run db:check
npm test
npm run db:migrate
npm run test:db
```

On restricted Windows PowerShell, replace `npm` with `npm.cmd`. `db:generate`, `db:check` and `npm test` require no database. Kit's `check` validates migration metadata, not MySQL SQL execution. The unit/static tests check schema metadata, migration loading, local connection safety, exact money serialization and snapshot safety. Do not describe them as database constraint execution.

`db:migrate` uses `DATABASE_URL`; `test:db` uses only `TEST_DATABASE_URL`. Both require the disposable opt-in. The migration runner checks already-applied migration hashes and holds a database-specific advisory lock. It never resets a database. The integration suite refuses unknown/partial existing schemas, applies migrations to an empty test database (or verifies an already migrated dedicated test database), repeats migration application, and checks unique/FK/CHECK/trigger behavior. All synthetic fixture writes run inside a transaction and roll back, including immutable history rows. Migration DDL persists in the dedicated test database. No fixture seed is inserted by migrations.

If `TEST_DATABASE_URL` is absent, the integration suite reports an explicit **NOT VERIFIED** skip. If a URL is supplied but unavailable or unsafe, it fails. Re-running against an already migrated test database verifies repeatability, but does not repeat fresh empty-database execution; use another newly created dedicated empty test database for that evidence.

Initial migration files:

- `drizzle/0000_wp02_integrity_foundation.sql`: all 17 tables, keys, checks, indexes and explicitly declared InnoDB/character set/collation.
- `drizzle/0001_wp02_history_guards.sql`: 13 triggers preventing deletion of financial identities, mutation/deletion of issued versions and audit/history rows, and changes to a receipt's ID, payment or number.
- `drizzle/meta/0000_snapshot.json`, `drizzle/meta/0001_snapshot.json`, `drizzle/meta/_journal.json`: Drizzle schema snapshots and ordered migration journal.

Apply versioned migrations through `db:migrate`; do not use `drizzle-kit push`. Drizzle snapshots do not model the custom triggers or table engine clauses, so review future migration SQL and explicitly preserve those features. Never edit an applied migration. MySQL DDL implicitly commits; a failed migration may leave partial DDL even though its journal entry was not recorded. Inspect failure state and use a fresh disposable database rather than expecting rollback or automatic reset. The runner deliberately does not repair unknown schemas.

### Schema and relationships

| Table | Main relationship and integrity purpose |
| --- | --- |
| `users` | Unique email, password-hash field, active/inactive state and deactivation metadata; no login implementation |
| `clients` | Person/business type, optional NUI/contact/address fields and logical deletion |
| `projects` | Required client; active/suspended/completed state, calendar dates and logical deletion |
| `contracts` | Unique project FK: one stable contract identity per project; exact total and version |
| `contract_phases` | Required contract; financial value, ordering, version and logical deletion |
| `payments` | Required project; received/cancelled state, exact amount, actual date and cash/bank method |
| `payment_allocations` | Required payment and phase; unique payment/phase pair; phase/payment index supports joins and sums |
| `expenses` | Required category; optional project, person and vehicle; exact amount, actual date and cancellation/audit metadata |
| `expense_categories` | Unique name, active state; no registration CRUD yet |
| `persons` | Supplier/payment-recipient identity and optional contacts, not HR/payroll |
| `vehicles` | Unique company vehicle identifier, description and active state |
| `payment_receipts` | Unique payment FK and company-wide unique number; draft/issued/void state |
| `receipt_versions` | Receipt FK and unique receipt/version pair; immutable issued snapshot, storage reference, SHA-256 checksum and optional issuing user |
| `receipt_counters` | One `company` scope and positive next number; no actual numbering service |
| `audit_events` | Optional actor FK, entity/action/operation metadata, safe before/after snapshots and UTC recording time |
| `entity_versions` | Unique entity-type/entity-ID/version; immutable historical snapshot |
| `operation_requests` | Unique operation-type/idempotency-key scope, SHA-256 request fingerprint, processing state and safe result metadata |

Every foreign key uses `ON DELETE RESTRICT ON UPDATE RESTRICT`. Foreign key columns are indexed explicitly, through a leading unique key, or by InnoDB's FK index creation. Frequently used date/status, project, category and entity-history lookups have explicit indexes. Physical deletion of payments, expenses, contracts, phases, allocations and receipt identities is additionally blocked by triggers, even when they have no child references. Logical deletion/cancellation retains identity. Updates to live financial rows still require transactional history capture in future services.

All financial columns use `DECIMAL(19,2)` and implicit EUR currency. Drizzle/mysql2 return strings; `decimalNumbers` is disabled. `eurDecimal` validates two-digit decimal serialization without number conversion. Raw MySQL may round excess fractional precision; this helper's validation must be applied by later input/domain services. Calendar dates are `DATE` strings. System timestamps are UTC `DATETIME(3)` strings with UTC defaults, and connections set UTC/strict SQL mode/InnoDB. `updated_at` is refreshed by Drizzle's update hook; direct SQL updates must explicitly set it. Version fields support optimistic concurrency but do not automatically enforce it.

Email uniqueness uses the table's case-insensitive collation. NUI has no invented legal format/length validation or uniqueness rule; its storage limit is technical only. Idempotency keys use `utf8mb4_0900_bin` for exact, case-sensitive, non-padding comparison. Operation names are company-scoped; future services must compare fingerprints on reuse. Audit entity references and correlation IDs are polymorphic, so their existence is a domain-service responsibility; actor references are ordinary FKs.

Snapshot JSON is intentionally a flat, explicit field allowlist: SQL `JSON_SCHEMA_VALID` checks reject unknown keys and nested objects/arrays, including password-hash fields. `safeHistorySnapshot` also rejects unsafe numeric values and tells callers to use strings for money. This applies to audit, entity-history, receipt-content and operation-result JSON. Never put credentials in an allowed text field. Extend snapshot schemas deliberately when approved receipt/history formats are implemented; do not serialize complete user rows or arbitrary request bodies.

### Modeling assumptions and open decisions

- One stable contract row per project; revisions increment its version and append `entity_versions`. No multi-contract workflow is created.
- One receipt identity per payment; corrections append `receipt_versions` while keeping the same receipt number.
- The current receipt version is `MAX(version)` for that receipt, or none before issuance. This derives from the existing one-way FK and avoids circular migration constraints. Future issuance/correction must lock the receipt and commit version/status changes atomically.
- Payment and expense clients are derived through projects. No redundant `client_id` can disagree with the project's client. General company expenses require neither project nor client. Preventing reassignment of historically used client/project relationships belongs to later services.
- The database represents one company. Receipt number formatting/gap policy, contract lifecycle details and final authentication roles remain open; no implementation is fabricated.
- Five-active-client-user enforcement and Adore account administration are WP-03 application responsibilities. No account-limit trigger, roles, session or password-management logic is created here.

### Financial invariants deferred to transactional services

| Rule | Schema support and mandatory remaining work |
| --- | --- |
| INV-01 | Nonnegative totals/phase values; service must lock contract/phases and verify active phase sum equals total |
| INV-02 | Positive allocation amounts and unique pairs; service must verify the complete allocation sum equals the received payment |
| INV-03 | FK/index support; service must serialize phase-capacity checks and sum only received/noncancelled allocations |
| INV-04 | Version fields; service must lock and reject phase reduction below active allocated amounts |
| INV-05 | Physical phase deletion blocked; service must reject logical deletion with active allocations |
| INV-06 | Received/cancelled states and cancellation metadata; queries/services must exclude cancelled payments while retaining allocation history |
| INV-07 | Non-destructive FKs, deletion guards and append-only history tables; service must capture every financial change and actor/version history atomically |
| INV-08 | Unique company receipt number and single counter scope; service must lock/increment the counter atomically and handle retries |
| INV-09 | Unique immutable receipt versions and stable receipt number; service must append corrections and safely coordinate document storage/status |
| INV-10 | InnoDB and version fields; service must transact contract/phase edits together with history and concurrency checks |

Allocation phase/project membership, eligibility of logically deleted/inactive references, idempotency fingerprint comparison, locking order and authorization also require later domain services. None of these cross-row workflows is implemented or claimed tested in WP-02.

### Additional WP-02 files

| Path | Purpose |
| --- | --- |
| `.env.example` | Blank local-only configuration names and disposable opt-in |
| `drizzle.config.ts` | Offline MySQL schema/migration generation configuration |
| `src/server/db/schema/common.ts` | UUID, exact decimal, UTC, version and FK column conventions |
| `src/server/db/schema/identity.ts` | User table |
| `src/server/db/schema/parties.ts` | Clients, persons, vehicles and categories |
| `src/server/db/schema/projects.ts` | Projects, contracts and financial phases |
| `src/server/db/schema/finance.ts` | Payments, allocations and expenses |
| `src/server/db/schema/receipts.ts` | Receipt identity, immutable version and company counter tables |
| `src/server/db/schema/history.ts` | Audit/history tables and SQL snapshot validation |
| `src/server/db/schema/operations.ts` | Idempotency request table and exact key semantics |
| `src/server/db/schema/index.ts` | Public schema exports |
| `src/server/db/config.ts` | Local environment loading, connection guard and UTC/strict session setup |
| `src/server/db/client.ts` | Lazy server-only typed connection with explicit close |
| `src/server/db/migrate.ts` | Advisory-locked migration application and applied-hash validation |
| `src/server/db/money.ts` | Exact decimal-string validation |
| `src/server/db/history-snapshot.ts` | Safe snapshot field allowlist, types and validator |
| `scripts/migrate-db.ts` | Guarded local migration CLI; never resets databases |
| `tests/db/config.test.ts` | Connection safety, version compatibility and money serialization tests |
| `tests/db/schema.test.ts` | Offline entity/constraint/index/migration metadata tests |
| `tests/db/history.test.ts` | Snapshot credential and unsafe-value rejection tests |
| `tests/db/integrity.integration.test.ts` | Disposable MySQL migration/constraint/trigger tests with rollback fixtures |

The five migration/meta paths are listed above. `package.json` and `package-lock.json` add pinned dependencies and scripts; `README.md` records the schema and executable workflow. UI files, routes and WP-01 tests are unchanged.

### Known database verification and toolchain limits

No MySQL URL or disposable opt-in was supplied, so no MySQL connection or migration was executed. Static migration generation/checks are not proof that MySQL accepted the SQL, checks or triggers. Database acceptance remains pending execution against a newly created local MySQL 8.4 test database.

The stable Drizzle Kit dependency tree includes deprecated `@esbuild-kit` packages and an older esbuild development dependency. npm reports four moderate advisories in that development-tool chain ([esbuild advisory](https://github.com/advisories/GHSA-67mh-4wv8-2f99)); no esbuild development server is used here. No forced downgrade or incompatible dependency override was retained. Production dependency audit results and final command evidence are recorded in the delivery report.

### WP-02 verification record — 26 October 2026

| Exact executed command | Result and relevant output |
| --- | --- |
| `npm.cmd ci` | PASS: `added 538 packages`; four moderate development-tool advisories |
| `npm.cmd ls --depth=0` | PASS: exact dependencies resolved with no invalid direct dependency |
| `npm.cmd run db:generate -- --name=wp02_integrity_foundation` | PASS: `17 tables`; created initial SQL and snapshot |
| `npm.cmd run db:generate -- --custom --name=wp02_history_guards` | PASS: created custom SQL migration and snapshot |
| `npm.cmd run db:generate -- --name=wp02_schema_consistency` | PASS: `No schema changes, nothing to migrate` |
| `npm.cmd run db:check` | PASS: `Everything's fine`; migration metadata only |
| `npm.cmd test` | PASS: `tests 14`, `pass 14`, `fail 0`, `skipped 0` |
| `npm.cmd run test:db` | NOT VERIFIED: `pass 0`, `skipped 1`; `TEST_DATABASE_URL is absent; no MySQL database was accessed` |
| `npm.cmd run db:migrate` | NOT VERIFIED / expected safety refusal, exit 1: `Migration failed. Verify disposable local settings and migration state; no automatic reset was attempted.` No database was connected. |
| `npm.cmd run typecheck` | PASS: route types generated; strict TypeScript exited 0 |
| `npm.cmd run lint` | PASS: no errors or warnings |
| `npm.cmd run build` | PASS: compiled successfully; generated 24 pages |
| `npm.cmd run start -- --port 3000` | PASS: local production-build server ready in 181 ms |
| `npm.cmd run check:routes` | PASS: 21 content routes, default redirect, 3 invalid routes and both disabled contact previews |
| `npm.cmd audit --omit=dev --json` | PASS: production vulnerabilities total `0` |
| `git -c safe.directory=C:/Users/Admin/OneDrive/Desktop/production_projects/fitimiconstruction diff --check` | PASS: no whitespace errors |

The route checks ran against the local production build. The owned local server was stopped afterward. Drizzle/tsx initially hit the restricted Windows sandbox's `uv_os_get_passwd` error; the successful offline checks ran with approved execution permissions. This is not evidence of MySQL execution. No external/client database, real data, hosting or production service was accessed. No credentials or populated environment file was created, committed or pushed. WP-02 changes remain local and uncommitted at delivery.

| Acceptance | Status | Evidence / limit |
| --- | --- | --- |
| WP02-AC01 | PASS | Installed with existing Next.js/TypeScript; typecheck/build pass |
| WP02-AC02 | PASS | 17 models generated and checked statically |
| WP02-AC03 | PASS | Consistent keyed relationships and restrictive FKs in schema/DDL; runtime pending |
| WP02-AC04 | PASS | All monetary columns are string-mapped `DECIMAL(19,2)` |
| WP02-AC05 | PASS | Nullable expense project/person/vehicle; client derived, no association required for general expenses |
| WP02-AC06 | PASS | Project status enum contains all three approved values |
| WP02-AC07 | PASS | Non-destructive FK actions and history/deletion guards defined; runtime pending |
| WP02-AC08 | PASS | Company-wide receipt number UNIQUE constraint defined; runtime pending |
| WP02-AC09 | PASS | Receipt/version uniqueness and immutable historical relationships defined; runtime pending |
| WP02-AC10 | PASS | Company operation/key uniqueness with exact case-sensitive key collation |
| WP02-AC11 | NOT VERIFIED | Migration files exist; no disposable target MySQL 8.4 available for execution |
| WP02-AC12 | NOT VERIFIED | 14 offline tests pass; MySQL integrity suite implemented but skipped |
| WP02-AC13 | PASS | Existing route smoke checks, lint, typecheck and build all pass |
| WP02-AC14 | PASS | Local source/dependency work only; no production data, credentials, hosting or services modified |
| WP02-AC15 | PASS | INV-01 through INV-10 and additional domain obligations explicitly documented |
| WP02-AC16 | PASS | Accurate environment, setup, migration and safe test commands documented |

Schema-related PASS statuses mean the requested definitions and static checks are present; they do **not** certify database runtime enforcement. WP-02 is not fully runtime-verified until AC11 and AC12 are exercised against a new disposable local MySQL 8.4 database. WP-03 was not started.
