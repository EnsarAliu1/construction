# WP-04 — Clients Management delivery report

Verified locally on 26 October 2026. This report records implementation and execution evidence; browser appearance and interaction are not claimed as verified.

## A. Repository baseline

- Branch: `main`, tracking `origin/main`.
- Initial HEAD: `55488855d2f222df9bda48ce0d664e556a65051e` — WP-03 Authentication.
- Initial working tree: only owner-modified `AGENTS.md`; its WP-04 instructions were preserved without editing. No existing implementation changes were discarded.
- Existing Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3, Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, mysql2 3.24.6 and tsx 4.23.15 were reused. No dependencies were installed or upgraded.
- The owner explicitly authorized committing/pushing this package to `EnsarAliu1/fitimiconstruction`. No deployment was authorized or performed.

## B. Implemented functionality

Authenticated users can list, create individual/business clients, search, filter by type, paginate, view by UUID, edit, inspect actual project references/audit history and explicitly archive a client. All authenticated operational users have equal access; no new role was added.

The existing shared cards, headings, inputs, fields, buttons, badges, navigation, CSS tokens and scrolling-table foundation are reused. Client links/search/mutations provide pending feedback; forms retain failed entries, expose labeled field errors and prevent duplicate submissions while a request/navigation is pending. Error, filtered-empty, initial-empty, unknown-record, conflict and archived read-only states are implemented. CSS wraps long names/contact/address values and constrains mobile table scrolling. Actual browser rendering/hydration, keyboard and screen-reader behavior remain unverified.

Server validation requires a trimmed nonempty name and the existing `private_person`/`business` enum. Text fields enforce existing database lengths; control characters and non-text values are rejected. Whitespace is normalized, optional blanks become null, and optional email is validated/lowercased. Phone and NUI have storage bounds without invented country-specific formats. NUI remains optional, names/contact values are not unique, records are never merged automatically, and changing type does not silently erase a previously supplied NUI.

GET reads are authenticated and bounded: 20 clients/page, pages 1–10000, search at most 100 characters, five related project references and 20 recent audit events. Search covers name, email, phone, NUI, city and street; SQL wildcards are escaped as literal text. Counts come from real queries. No project CRUD, fabricated totals or financial calculations are included.

Mutations use parameterized Drizzle operations and a Drizzle transaction. The server resolves the live session, takes a shared lock on its user and rechecks authorization inside the transaction. Client update/archive locks the row and checks the submitted version; competing/stale writes receive 409 instead of overwriting changes. The user lock coordinates with existing deactivation/revocation operations. Actor IDs are never accepted from the request.

Create/update/archive write an actor-attributed `audit_events` entry and an `entity_versions` snapshot in the same transaction as the client change. Events contain entity ID/type, action, UTC timestamp, before/after snapshots and a server-generated operation/correlation UUID. Snapshots contain approved client fields/metadata and exclude credentials. Audit/history persistence errors roll back the whole operation.

Archive requires explicit confirmation and the current version. Non-archived active/suspended project associations block it. Completed project references and all client/history identities remain intact. Archived clients disappear from lists but stay readable by stable ID; edits and repeated archive operations are rejected. No physical delete or restore endpoint exists.

## C. Database and migration evidence

Reused `clients`, `users`, `projects`, `audit_events` and `entity_versions`; no replacement client table or new table was introduced.

Additive migration: `drizzle/0003_wp04_clients.sql` plus its snapshot/journal entry. It adds version (default 1, positive check), nullable created/updated/deleted actor references with RESTRICT foreign keys, their lookup indexes and a type/archive index. Nullable actors preserve legacy rows without inventing historical attribution.

The flat safe-history allowlist is explicitly extended for client contact/address, timestamps and actor metadata. Five existing JSON-schema checks are replaced with the expanded scalar-only allowlist; credential/unknown/nested fields remain rejected. Existing append-only triggers are unchanged. Migrations 0000–0002 are unchanged and their three SHA-256 values are pinned in regression tests. Migration 0003 SHA-256: `a2c5cdad7751945aa77a8eef88b94efec28eab9857c63763e0e40dc677d15797`.

Environment evidence:

| Item | Actual value |
| --- | --- |
| Docker client / Engine | 29.9.2 / 29.9.2; operational |
| Official image / queried server | `mysql:8.4` / MySQL 8.4.13 |
| Task-owned container | `fitimiconstruction-mysql-wp04` |
| Ownership label | `adore.work-package=WP-04` |
| Database / endpoint | `fitimi_test_wp04`, `127.0.0.1:3307` → container 3306 |
| Storage / session timezone | InnoDB / `+00:00` |
| Isolation | Disposable tmpfs data directory, loopback binding, synthetic credentials, binary logging disabled only on this test server for scoped trigger creation |

Before migrating, a query verified the actual version, database, engine, host/port and UTC session. `npm.cmd run db:migrate` applied all four migrations to the fresh container, then the exact command was rerun successfully. Integration tests additionally repeated application and compared the schema/journal. The integration run correctly reported an already migrated database; fresh execution occurred in the earlier actual migration CLI invocation.

Verified: **20 application tables, 22 foreign keys, 62 application indexes, 28 enforced checks, 13 original triggers and four Drizzle migration records**. Original financial/receipt/audit/history guards all passed behavior tests. MySQL DDL is not treated as automatically atomic.

## D. Created/modified files

| Exact path | Purpose |
| --- | --- |
| `AGENTS.md` | Owner-provided WP-04 instructions preserved and included with authorized delivery |
| `.env.example` | Non-secret test ownership-label configuration |
| `README.md` | Current Clients behavior, setup/testing, scope and next-package guidance |
| `docs/WP-04-report.md` | This evidence report |
| `package.json` | Clients test commands and inclusion in existing test suites |
| `drizzle/0003_wp04_clients.sql` | Additive client concurrency/actor/audit compatibility migration |
| `drizzle/meta/0003_snapshot.json` | Generated migrated-schema snapshot |
| `drizzle/meta/_journal.json` | Fourth ordered migration entry |
| `src/server/db/schema/parties.ts` | Existing client version, actor references, checks/indexes |
| `src/server/db/history-snapshot.ts` | Explicit safe client snapshot fields |
| `src/features/clients/model.ts` | Shared client DTOs, labels and storage bounds |
| `src/features/clients/validation.ts` | Server validation, IDs/versions, bounded queries and domain errors |
| `src/features/clients/service.ts` | Authenticated Drizzle reads and transactional audited mutations |
| `src/features/clients/http.ts` | Auth/origin/body guards and safe uncached HTTP errors |
| `src/features/clients/web.ts` | Page/session guards and sanitized database failures |
| `src/features/clients/client-form.tsx` | Individual/business creation/edit forms and conflict feedback |
| `src/features/clients/archive-control.tsx` | Deliberate confirmed archive workflow |
| `src/features/clients/client-link.tsx` | Inline pending navigation feedback preserving HTTP status behavior |
| `src/features/clients/search-form.tsx` | Search/type GET form with pending feedback |
| `src/app/(workspace)/app/clients/page.tsx` | Real filtered, paginated clients list |
| `src/app/(workspace)/app/clients/new/page.tsx` | Authenticated creation page |
| `src/app/(workspace)/app/clients/[id]/page.tsx` | Details, retained project references and audit snapshots |
| `src/app/(workspace)/app/clients/[id]/edit/page.tsx` | Guarded edit/read-only archived state |
| `src/app/(workspace)/app/clients/error.tsx` | Safe failure and retry interface |
| `src/app/api/clients/route.ts` | Authenticated list/create endpoints |
| `src/app/api/clients/[id]/route.ts` | Authenticated details/update/archive endpoints |
| `src/components/layout/navigation.tsx` | Active workspace section on nested client routes; public matching preserved |
| `src/components/layout/workspace-shell.tsx` | Accurate available-feature notice and package-neutral workspace badge |
| `src/styles/globals.css` | Client forms, feedback, bounded tables, details/history and responsive wrapping |
| `tests/clients/validation.test.ts` | Input, protected-field, query and wildcard tests |
| `tests/clients/fixture.ts` | Isolated synthetic accounts, sessions and cleanup helpers |
| `tests/clients/clients.integration.test.ts` | Real CRUD, actor/history, concurrency, archive/FK, legacy and rollback tests |
| `tests/clients/http.integration.test.ts` | Actual pages/endpoints, status codes, CSRF, escaping and session denial |
| `tests/db/schema.test.ts` | New migration/FKs and preservation of all three earlier migration hashes |
| `tests/db/integrity.integration.test.ts` | Four migration-record expectation; all existing behavior assertions retained |
| `tests/auth/http.integration.test.ts` | Exact owned-container outage check supports WP-04 label; default WP-03 remains |

Ignored `artifacts/wp04` diagnostic scripts/configuration are local verification aids, not tracked deliverables. Populated environment files and build artifacts are excluded from Git.

## E. Tests, defects and verification limits

| Exact executed command | Final result |
| --- | --- |
| `npm.cmd run db:generate -- --name=wp04_clients` | PASS; additive 0003 generated, 20 existing models |
| `node_modules/.bin/tsx.cmd artifacts/wp04/environment.ts` | PASS; actual disposable database identity/version/engine confirmed |
| `npm.cmd run db:migrate` | PASS; fresh application and subsequent repeat command |
| `npm.cmd run db:check` | PASS; migration journal/snapshots valid |
| `npm.cmd test` | PASS; 24 results, zero failures/skips |
| `npm.cmd run test:db` | PASS; 52 results, zero failures/skips; includes all 13 original triggers |
| `npm.cmd run test:clients:db` | PASS; 16 results, zero failures/skips, also included in `test:db` |
| `npm.cmd run test:clients:http` | PASS; eight results, zero failures/skips |
| `npm.cmd run test:auth:http` | PASS; nine results, zero failures/skips, actual guarded database pause/resume included |
| `npm.cmd run typecheck` | PASS; Next route generation and strict TypeScript |
| `npm.cmd run lint` | PASS; zero warnings/errors |
| `npm.cmd run build` | PASS; production build, dynamic authenticated client routes |
| `npm.cmd run start -- --port 3000` | PASS; loopback verification server |
| `npm.cmd run check:routes` | PASS; ten public content routes, login/private redirects, invalid routes, disabled public contact previews |

The final four principal test suites total **93 Node test results** (including parent/subtests), with no failures/skips. The separate Clients DB run overlaps `test:db` and is not added again. Authenticated workspace navigation/public checks also ran inside the auth HTTP suite.

Confirmed corrections during implementation:

1. A route-level loading boundary initially flushed HTTP 200 before authentication redirects or not-found results. It was removed and replaced with inline link/search pending feedback. The original 307/404 assertions now pass; tests were not relaxed.
2. Scoped navigation review found nested client pages lacked an active section; the existing navigation now recognizes workspace descendants. Real HTTP markup asserts the active Clients link.
3. Initial test fixtures supplied IDs to the existing email-based account lifecycle API and reused a search marker across reruns. Fixture usage/cleanup and marker isolation were corrected without changing account administration code. Task-created leftover accounts were deactivated and suites rerun.
4. Sandboxed tsx hit Windows `os.userInfo` ENOMEM before execution; tests ran under the normal authorized user. An old OneDrive build-cache entry produced EPERM on unlink; only the resolved workspace `.next` cache was removed, then builds passed. No project checks were disabled.

Browser skill setup returned **“No browser is available”**; supported recovery/discovery returned `[]`. Consequently desktop/mobile screenshots, hydration, actual pending/submit interaction, keyboard focus and assistive-technology behavior are **NOT VERIFIED**. HTTP markup/status checks establish server behavior and escaped/labeled output, not visual/interactive browser acceptance.

## F. Acceptance checklist

| Criterion | Result | Evidence |
| --- | --- | --- |
| WP04-AC01 | PASS | Existing Drizzle/MySQL clients model; additive migration, no new table |
| WP04-AC02 | PASS | Individual service and HTTP creation/persistence |
| WP04-AC03 | PASS | Business creation, optional/arbitrary NUI, duplicate names retained separately |
| WP04-AC04 | PASS | Required name/type, field bounds, email and protected-field validation tests |
| WP04-AC05 | PASS | Actual authenticated database list and rendered links |
| WP04-AC06 | PASS | Name/contact/NUI/address search, type filtering, escaped wildcard tests |
| WP04-AC07 | PASS | Stable-ID details, distinct duplicate names, unknown-ID 404 |
| WP04-AC08 | PASS | Service/HTTP edits and clearing optional values |
| WP04-AC09 | PASS | Independent concurrent connections: exactly one commit and one conflict |
| WP04-AC10 | PASS | Timestamp/actor/version retained; archived record/history readable, list excluded |
| WP04-AC11 | PASS | Open project blocking, completed project reference retained, physical FK delete rejection |
| WP04-AC12 | PASS | Actor/action/entity/UTC/correlation plus complete safe before/after snapshots |
| WP04-AC13 | PASS | Forced audit INSERT failure rolls back create/update/archive and versions |
| WP04-AC14 | PASS | Anonymous service/API denial; actual protected page 307 redirects |
| WP04-AC15 | PASS | Existing cookie denied after operator deactivation, for all reads/mutations/pages |
| WP04-AC16 | PASS | Existing components/tokens/navigation reused; active nested route markup checked |
| WP04-AC17 | NOT VERIFIED | Responsive/accessibility implementation and markup checks exist; no connected browser |
| WP04-AC18 | PASS | 52 MySQL test results, no skips, actual 8.4.13 server |
| WP04-AC19 | PASS | TypeScript, lint, build, HTTP/auth/public/navigation/migration/trigger regression checks |
| WP04-AC20 | PASS | Isolated local synthetic data, loopback services, no production access |

## G. Security review

Each page has a WP-03 server guard; each service operation independently checks the live session. APIs authenticate before validation/record lookup, require configured Origin/Host for writes, bound JSON bodies to 8192 bytes, whitelist editable fields and return no-store responses. Invalid session data cannot become an actor ID. Disabling an account coordinates with the mutation user lock and invalidates future reads/writes.

Queries bind user values through Drizzle; LIKE metacharacters are escaped. React renders text safely; HTTP tests verify stored script-like names are escaped. Raw Drizzle exceptions may contain personal values, so HTTP/page boundaries redact database failures instead of exposing/logging them. Passwords, password hashes, session tokens and operator capabilities are not copied into client audit records or DTOs.

The audit failure test creates a uniquely named INSERT rejection trigger only in this disposable database and drops that same trigger in `finally`. It never replaces/disables an original guard; the final schema again has exactly 13 triggers. Existing credential/nested-snapshot rejection and append-only tests pass after the safe-field expansion.

## H. Known issues and deferred work

- No known functional Clients defect remains in the executed checks. AC17 remains open; browser/UI acceptance is not inferred from HTTP success.
- Referenced Master Prompt, D-01–D-14 and approved wireframes/design assets were not present in the repository. Existing provisional Operational Clarity tokens/components were retained; exact approved visual alignment is not claimed.
- Future project creation/reactivation must lock/recheck its client and reject archived parents. Foreign keys preserve identity; they do not enforce this cross-module soft-delete rule. No Project mutation service is implemented here.
- Audit/project sections intentionally return bounded recent references; no project detail link or financial summary is fabricated. Historical client actors remain null where unknown, and no historical audit events are invented.
- Payment allocations, contract/phase aggregates, cancellation consistency, company receipt sequencing/idempotency and other financial transactional invariants remain for their authorized domain packages. No financial service was added.
- Production TLS/origin/proxy setup, database least privilege, operator secret handling/rotation, abuse controls and browser/security review remain release prerequisites from WP-03.

## I. Scope and resource confirmation

Only synthetic `.invalid` accounts, names, contacts and projects were used in the owned local test database. No real business data, production infrastructure, XAMPP/MariaDB, unknown container/volume or Windows virtualization settings were accessed/changed. No project/contract/phase/payment/expense CRUD, receipt/report/export service, new role, restoration flow or deployment was implemented.

The owned loopback verification server/container and generated credential files are removed after checks; audit test data is disposed of with its task-owned tmpfs database. Unknown containers and persistent volumes are preserved. Credentials/builds/local artifacts are excluded from the authorized Git commit/push.

## J. Next package

**CONDITIONAL GO for separately authorized WP-05 — Construction Projects, Contracts & Phases development.** The Clients/authentication/schema foundation passes real MySQL and HTTP tests. WP-05 must respect client archive/version locking and implement its own approved transactional domain invariants. Browser acceptance, missing approved UX resources and production prerequisites remain open. WP-05 has not been started.
