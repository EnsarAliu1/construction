# WP-06 — Expense Categories, Persons/Suppliers & Vehicles

Local delivery evidence, 26 October 2026. **175 Node test results passed, zero failures/skips. Actual browser visual/interaction acceptance remains NOT VERIFIED.**

## A. Repository baseline and sources

Initial branch: `main`, tracking `origin/main`. Initial HEAD: `8241409e5af1d5fa2eb149996f22ff658c82cbff` (WP-05). The only initial modification was the owner's WP-06 `AGENTS.md`; it was preserved without editing and included with the authorized delivery. No existing work was discarded. The owner's standing GitHub push authorization and instruction to continue as before apply; no deployment was authorized.

Inspected actual schema, migration metadata, WP-04/WP-05 service/validation/auth/audit patterns, shared components/navigation, scripts, tests and README. Repository reports available: `docs/WP-02V-report.md`, `docs/WP-03-report.md`, `docs/WP-04-report.md`, `docs/WP-05-report.md`. No approved Master Prompt, D-01–D-14, design/wireframe source or image assets were found in the repository. Existing Operational Clarity components/styles were reused; no new visual approval is claimed.

Existing versions were retained: Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3, Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, mysql2 3.24.6 and tsx 4.23.15. No dependencies were installed/upgraded, no lockfile change was needed and no checks were disabled.

## B. Implemented features and decisions

All three modules provide authenticated list, create, stable-ID details, edit, explicit lifecycle operations, history, bounded search/status filtering and pagination. Lists default to active records; inactive/all filters preserve historical discovery. Details remain readable when inactive and show actual expense reference counts without fabricated financial totals. There is no physical-delete endpoint.

- **Categories:** required name, existing 150-character bound, whitespace normalization, duplicate protection through the existing unique name key. Case/accent equivalence follows the existing MySQL collation; inactive names remain reserved. No record is silently merged or renamed.
- **Persons / Suppliers:** required name; optional email, phone, identification reference and address using existing fields/bounds. Email is validated/lowercased. Identification is not mandatory; no country-specific phone/ID format, business-only assumption, employee role or HR fields were introduced. Duplicate person names and contacts are allowed and keep separate UUIDs.
- **Vehicles:** existing required 100-character identifier and optional TEXT description. The pre-existing `vehicles_identifier_uq` was preserved, as required by the instruction not to weaken existing constraints. This package does not declare real-world registration numbers globally unique or introduce a national plate format: the existing identifier can be an internal reference. Making registration optional/nonunique as a separate concept requires an approved future model decision; the current constraint was not silently removed. Descriptions are not unique.

New/edited text is trimmed and repeated whitespace normalized. Plain-text inputs reject C0/C1 control characters, including line breaks; optional blanks become null. Existing VARCHAR limits and TEXT's 65535-byte UTF-8 bound are enforced. Mutations accept at most 128 KiB JSON; search is limited to 100 characters, pages 1–10000 and 20 returned rows. Details show 20 recent events while retaining all history. Valid updates are full replacements of the listed editable fields, with an explicit expected version; protected fields are rejected.

**Lifecycle:** both Deactivate and Reactivate are separate, confirmed, version-checked operations. Ordinary edits can correct inactive information but never change active status. Deactivation records actor/time and removes the record from active selectors; reactivation restores eligibility using the same identity and appends history. The current deactivation metadata becomes null on reactivation; the prior values remain in immutable before/after history. Repeating an already satisfied transition is rejected rather than generating misleading events. Unknown legacy actors/timestamps remain null.

Pages use shared cards, fields, inputs, buttons, headings, badges, focus styles, responsive grids and labeled scrolling tables. Forms include field errors, pending/duplicate-submit protection, retained entries, conflict reload, cancel and success feedback. Lifecycle controls require deliberate confirmation. New nested section routes are allowed only for the three reference kinds; other sections cannot acquire these workflows accidentally. Existing Clients/Projects static routes take precedence and passed regression tests.

Reusable `activeCategories`, `activePersons`, `activeVehicles` and `selectActiveReferences` return at most 20 searchable `{ id, label, version }` choices. Personal contact/identification fields are not included in selector output. `getReference` independently authenticates and resolves inactive historical references.

## C. Database and execution

Reused `expense_categories`, `persons`, `vehicles`, `expenses`, `users`, `audit_events` and `entity_versions`; no duplicate or new application table was created. Expense relationships and their optional person/vehicle associations remain unchanged.

Additive migration: `drizzle/0005_wp06_reference_lifecycle.sql`, its generated snapshot and sixth journal entry. Each reference table gains version (default 1), nullable created/updated/deactivated actor references and nullable deactivation time. There are actor lookup indexes, active/label indexes, positive-version checks and 0/1 active-state checks. Legacy metadata is not fabricated.

Safe history adds only four required scalar keys: `address`, `identificationReference`, `deactivatedAt`, `deactivatedBy`. Five existing JSON checks are replaced with the explicit expanded allowlist. Credential, unknown-key and nested-object rejection remain enforced. Original triggers are unchanged. Migrations 0000–0004 retain their exact hashes, now all pinned in regression tests. Migration 0005 SHA-256: `a90f76f7149e6737dcef9be33f6f00db4218fb35fd4fd83c743dbb3863b85bb4`.

Verified environment: operational Docker Engine 29.9.2; official `mysql:8.4`, actual queried **MySQL 8.4.13**, InnoDB, UTC `+00:00`, database `fitimi_test_wp06`, loopback `127.0.0.1:3307` → container 3306. Container `fitimiconstruction-mysql-wp06`, exact ID `8c1e6fddf1c30cc43eb425a147009358fb83b57fa96098e82346d2bf3c13f8dc`, label `adore.work-package=WP-06`. Synthetic credentials and disposable tmpfs storage were used; binary logging was disabled only on this test instance for scoped trigger creation.

The identity/version/engine/host/database were checked before running the actual migration command. All six migrations applied to the newly created database. The command ran again successfully; integration tests also compared repeat execution and schema/journal fingerprints. Subsequent suites correctly reported an already migrated database rather than claiming another fresh run.

Verified **20 application tables, 38 foreign keys, 81 application indexes, 35 enforced checks, 13 original triggers and six matching migration records**. Invalid active bits and zero versions were actually rejected by MySQL for all three tables. MySQL DDL is not assumed atomic; no non-disposable database was reset.

## D. Atomicity, history and future locking

Mutations independently authenticate, validate shape, then use a Drizzle/InnoDB READ COMMITTED transaction. They acquire the established shared user lock and recheck the live session, then lock only the affected reference row by primary key. The current version/status is verified under that lock. Row changes, actor metadata, audit event and immutable version snapshot commit together. Errors roll back the whole operation. Independent reference edits do not lock unrelated project/contract aggregates.

Events include actor, entity type/ID, action, UTC time, relevant before/after values, version and server-generated operation UUID. Computed display labels are not stored as extra history fields. Existing actors are never invented. Only the expected category/vehicle uniqueness violations are mapped to friendly duplicate errors; other database failures remain redacted.

Tests proved one winner/one conflict for concurrent edits and edit-versus-deactivation for every kind. A uniquely named test-only audit INSERT rejection trigger forced create/update/deactivate failures: no partial row, status, audit or version remained. It was dropped in `finally`, without replacing/disabling any original trigger. Actual expense FK rows continued to resolve all three inactive references; physical deletion attempts were rejected by the existing FKs. Reactivation and inactive corrections were also verified.

**WP-07 protocol:** authenticate/shared-lock the user first. If an expense needs client/project locks, follow WP-05's parent order before reference locks. Then lock selected category → optional person → optional vehicle in that fixed kind order (UUID order within a kind), recheck existence, active state and the selected versions, and persist the expense/audit within that same transaction. Deactivation uses the same reference row lock, so a cooperating expense writer must recheck state after waiting. Active selectors alone do not close this race; FKs preserve historical identity but do not enforce active eligibility.

Category inline creation, expense persistence and their combined transaction belong to WP-07. Do not call these transaction-owning top-level reference mutations inside an already open expense transaction; compose shared transaction-level operations in that package. No expense writer was implemented here.

## E. Exact changed files

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Owner's WP-06 instructions preserved and included |
| `.env.example` | Non-secret WP-06 outage-test ownership label option |
| `README.md` | Current features, routes and next package |
| `docs/WP-06-report.md` | This technical report |
| `package.json` | Focused reference tests and regression inclusion |
| `drizzle/0005_wp06_reference_lifecycle.sql` | Additive metadata, checks/indexes and safe-history expansion |
| `drizzle/meta/0005_snapshot.json` | Generated schema snapshot |
| `drizzle/meta/_journal.json` | Sixth ordered migration entry |
| `src/server/db/schema/parties.ts` | Existing reference tables' version/actor/lifecycle fields and constraints |
| `src/server/db/history-snapshot.ts` | Four explicit safe scalar fields |
| `src/features/references/model.ts` | Fixed module definitions, field bounds and DTOs |
| `src/features/references/validation.ts` | Editable-field, ID/version/query/control/storage validation |
| `src/features/references/service.ts` | Per-kind Drizzle operations, row locks, lifecycle, history and selectors |
| `src/features/references/http.ts` | Session/origin/body/kind guards and safe uncached responses |
| `src/features/references/web.ts` | Independent page guards, not-found handling and redacted failures |
| `src/features/references/reference-link.tsx` | Inline pending navigation feedback |
| `src/features/references/forms.tsx` | Create/edit, search/filter and confirmed lifecycle forms |
| `src/features/references/screens.tsx` | Real lists/details/history and screen composition |
| `src/app/(workspace)/app/[section]/page.tsx` | Replace only the three reference placeholders with real lists |
| `src/app/(workspace)/app/[section]/new/page.tsx` | Guarded creation for allowed reference kinds |
| `src/app/(workspace)/app/[section]/[id]/page.tsx` | Guarded historical details |
| `src/app/(workspace)/app/[section]/[id]/edit/page.tsx` | Guarded version-aware edit |
| `src/app/(workspace)/app/[section]/error.tsx` | Safe failure/retry UI |
| `src/app/api/references/[kind]/route.ts` | List/create API |
| `src/app/api/references/[kind]/[id]/route.ts` | Details/update API |
| `src/app/api/references/[kind]/[id]/lifecycle/route.ts` | Explicit confirmed status changes |
| `src/app/api/references/[kind]/active/route.ts` | Minimal active selectors |
| `src/components/layout/workspace-shell.tsx` | Accurate available-module notice |
| `tests/references/fixtures.ts` | Synthetic reference fixtures using existing account/session helpers |
| `tests/references/validation.test.ts` | Normalization, optional data, bounds/UTF-8/control and protected fields |
| `tests/references/references.integration.test.ts` | MySQL CRUD, uniqueness, lifecycle, retention, selectors, concurrency, checks and rollback |
| `tests/references/http.integration.test.ts` | Actual pages/API, statuses, field errors, CSRF, escaping, privacy and session denial |
| `tests/db/schema.test.ts` | New migration/FKs and all five previous hash assertions |
| `tests/db/integrity.integration.test.ts` | Six migration records; earlier behavior assertions retained |
| `tests/auth/http.integration.test.ts` | Support this exact WP-06 container label without weakening ID/ownership checks |

Ignored `artifacts/wp06` scripts/configuration are local verification aids, not committed deliverables. Existing CSS/tokens and dependency lockfile are unchanged.

## F. Executed checks and limitations

| Exact command | Actual result |
| --- | --- |
| `npm.cmd run db:generate -- --name=wp06_reference_lifecycle` | PASS; additive 0005 generated for 20 models |
| `node_modules/.bin/tsx.cmd artifacts/wp06/environment.ts` | PASS; actual loopback database/server/InnoDB/UTC identity |
| `npm.cmd run db:migrate` | PASS; fresh application and exact repeat command |
| `npm.cmd run db:check` | PASS; migration metadata valid |
| `npm.cmd test` | PASS; 33 results, zero failures/skips |
| `npm.cmd run test:db` | PASS; final 98 results, zero failures/skips |
| `npm.cmd run test:references:db` | PASS; final 28 results, zero failures/skips; overlaps `test:db` |
| `npm.cmd run test:references:http` | PASS; 19 results, zero failures/skips |
| `npm.cmd run test:projects:http` | PASS; eight results, zero failures/skips |
| `npm.cmd run test:clients:http` | PASS; eight results, zero failures/skips |
| `npm.cmd run test:auth:http` | PASS; nine results, zero failures/skips; actual guarded Docker pause/resume included |
| `npm.cmd run typecheck` | PASS; route types and strict TypeScript |
| `npm.cmd run lint` | PASS; zero errors/warnings |
| `npm.cmd run build` | PASS; optimized build and dynamic reference routes |
| `npm.cmd run start -- --port 3000` | PASS; loopback-only verification server |
| `npm.cmd run check:routes` | PASS; ten SQ/EN content routes, private redirects, login, invalid routes and disabled public contact previews |

Final principal suite total: **33 + 98 + 19 + 8 + 8 + 9 = 175 Node results**, including parent/subtests. Focused/earlier overlapping runs are not counted again. All 13 original triggers and earlier module tests passed. Additional HTTP fault injection verified database exceptions return generic 503 responses without SQL, submitted private values or credentials, and leave no created record. Actual 307/404 behavior and nested navigation were checked without relaxing existing assertions.

Final review tightened C1 control-character rejection, mapped duplicate errors only for the intended unique keys, and used separate connections for concurrent transaction fixtures. No functional failure remains in executed checks; no tests, compiler flags or constraints were disabled. A slow local build/test run still passed within the existing timeouts; the final full DB run passed after build-worker contention ended.

Browser skill selection returned **“No browser is available”**, and supported recovery/discovery returned `[]`. Desktop/mobile screenshots, actual field/lifecycle clicks, keyboard/screen-reader behavior and hydration are **NOT VERIFIED**. Labeled/escaped HTML, responsive component reuse and successful HTTP responses do not substitute for browser verification.

## G. Acceptance checklist

| Criterion | Result | Evidence |
| --- | --- | --- |
| WP06-AC01 | PASS | Existing tables only; additive 0005 |
| WP06-AC02 | PASS | Category service/HTTP create/list/details/update |
| WP06-AC03 | PASS | Person/supplier service/HTTP CRUD; optional contacts/ID |
| WP06-AC04 | PASS | Vehicle service/HTTP CRUD with inherited identifier constraint |
| WP06-AC05 | PASS | Server bounds/UTF-8/types/email/control/protected-field tests |
| WP06-AC06 | PASS | Literal search, filters, capped 20-row pages and selector tests |
| WP06-AC07 | PASS | Explicit lifecycle retains UUID and records actor/time/version |
| WP06-AC08 | PASS | Synthetic historical expense FK retention and deletion rejection |
| WP06-AC09 | PASS | Inactive records absent from all active selector APIs/functions |
| WP06-AC10 | PASS | Concurrent edits/edit-vs-deactivation yield one success and one conflict |
| WP06-AC11 | PASS | Atomic row/audit/version writes; forced audit failure rolls back all |
| WP06-AC12 | PASS | Actor/correlation/UTC/before/after; safe allowlist and existing protections |
| WP06-AC13 | PASS | Independent page/API/service guards; anonymous/disabled denial and CSRF |
| WP06-AC14 | PASS | Existing shared components/styles/navigation reused |
| WP06-AC15 | NOT VERIFIED | No connected browser for actual desktop/mobile/accessibility/hydration |
| WP06-AC16 | PASS | Actual isolated MySQL 8.4.13; 98 full-suite results with no skips |
| WP06-AC17 | PASS | Prior five hashes pinned; original triggers and auth/Clients/Projects regressions |
| WP06-AC18 | PASS | TypeScript, lint, build, new/prior HTTP suites and route smoke |
| WP06-AC19 | PASS | Reusable authenticated bounded minimal selectors for all three kinds |
| WP06-AC20 | PASS | No expense/payment processing service, form or endpoint added |
| WP06-AC21 | PASS | Owned synthetic local database only; no production access |

## H. Security review

Every service independently checks a live session; pages and APIs enforce their own guards. Fixed kind-to-table/column mappings avoid arbitrary table input. APIs authenticate before kind/record lookup, validate Origin/Host for mutations, bound JSON and search, whitelist editable fields and return no-store responses. Actor IDs, statuses, timestamps and assigned versions cannot be mass assigned.

Drizzle binds all user query values and LIKE metacharacters are escaped. React escapes text; real HTTP tests verified stored script-like labels. Raw SQL/bound values are not exposed or logged at API/page error boundaries. Selectors return no unnecessary contact/identification data. Authentication secrets are excluded from snapshots; expanded history checks retain credential/nested/unknown-field rejection. Legacy actors remain unknown where unrecorded. No new business roles were added.

Only task-owned uniquely named fault triggers were created/dropped for testing. Historical expenses were synthetic fixture SQL, not a shipped expense writer. Unknown containers/volumes, XAMPP/MariaDB and Windows virtualization were not modified.

## I. Open issues and cleanup

No known functional defect remains in executed checks. AC15 and exact approved visual alignment remain open. Single-line plain-text input is deliberate; legacy data containing unsupported controls must be corrected explicitly when edited, while historical reads remain available. Existing legacy whitespace spellings are not bulk-normalized or merged; new/edited values use the documented normalization rule.

The existing vehicle identifier uniqueness/requiredness and category collation were preserved. A separately approved optional/nonunique registration field or broader identity change remains a product decision rather than a silent migration change. Duplicate person names are intentionally allowed.

Future WP-07 must implement the locked active-state recheck, inline category creation and expense transaction/audit composition described above. No expense/payment transactions, financial summaries, receipts/exports, supplier payables, payroll, inventory, GPS or maintenance workflow were added. Release TLS/proxy configuration, database least privilege, secret handling and browser/security review remain outside this local package.

The owned loopback verification server, disposable tmpfs container and unchanged generated credential files are removed after checks. Unknown resources and production data remain untouched. Populated environments, build files and local artifacts are excluded from the authorized Git commit/push.

## J. Next package

**CONDITIONAL GO for separately authorized WP-07 — Expense Transactions.** Reference-data behavior, active selectors, retention, auditing and concurrency pass real MySQL/HTTP verification, and previous modules remain functional. WP-07 must adopt the transaction/locking protocol; browser and release verification remain open. WP-07 has not been started automatically.
