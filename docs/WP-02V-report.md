# WP-02V — MySQL migration and integrity verification

**Date:** 26 October 2026

**Result:** completed; **GO** for WP-03 implementation. No WP-03 work or deployment was performed.

## A. Initial repository state

- Working directory: `C:\Users\Admin\OneDrive\Desktop\production_projects\fitimiconstruction`.
- Branch: `main`, tracking `origin/main`.
- HEAD: `09fe783` — `feat: add WP-02 MySQL schema and integrity foundation`.
- Initial working-tree modification: the owner's `AGENTS.md` containing WP-02V v1.1. It was preserved.
- WP-02 was already committed, rather than uncommitted as the prompt's historical baseline suggested. Existing schema, migration runner, SQL files, metadata, safety tests and integration tests were reviewed before database execution.
- No dependency/package changes were needed. Next.js 16.4.3, TypeScript 6.0.3, Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, mysql2 3.24.6 and tsx 4.23.15 were retained.

## B. Docker and MySQL environment

| Item | Verified value |
| --- | --- |
| Docker CLI | 29.9.2, build `a82e528` |
| Docker Engine | Operational; server version 29.9.2 |
| Container name | `fitimiconstruction-mysql-test` |
| Official image | `mysql:8.4` |
| Pulled digest | `sha256:76f0358884cb92d9a086d24e5671c38048d3fef40f2588703d73eb55392d6b69` |
| Actual server query | MySQL **8.4.13**, `MySQL Community Server - GPL` |
| Database | `fitimi_test_wp02v` |
| Port mapping | `127.0.0.1:3307` → container `3306` |
| Authentication | Successful as the synthetic schema-scoped `fitimi_verifier` user |
| Storage engine | InnoDB supported/default; all 18 tables including the journal use InnoDB |
| System-event session timezone | `+00:00` |
| Final verification binary logging | Disabled in this disposable server only, via `--skip-log-bin`; queried `@@log_bin = 0` |
| Data storage | Task-owned tmpfs `/var/lib/mysql`; no production mounts or named volumes requested |
| Final lifecycle | Task-owned container and temporary credentials removed after successful verification |

Initial checks found the proposed container name and host port free. Existing unrelated containers `fastcommerce_postgres` and `ontrack-adminer` remained stopped and untouched. Docker Desktop/WSL/virtualization settings and XAMPP/MariaDB were not modified.

The database name deliberately follows the existing `fitimi_test_*` safety guard. Both URL variables pointed exclusively to the same isolated test database; no development/client database was used. Passwords were generated privately and passed through ignored local files, never command-line credential literals or Git.

## C. Migration results

Existing migration files were executed without rewriting their SQL:

1. `drizzle/0000_wp02_integrity_foundation.sql`
2. `drizzle/0001_wp02_history_guards.sql`

### Confirmed initial failure and partial state

The first `npm.cmd run db:migrate` exited 1. Read-only inspection showed the first migration had committed: 17 application tables, 18 FKs, 24 CHECK constraints, no triggers, and one journal record. Capturing the driver cause identified:

```text
Failing statement: CREATE TRIGGER receipt_versions_no_update BEFORE UPDATE ON receipt_versions ...
code: ER_BINLOG_CREATE_ROUTINE_NEED_SUPER
errno: 1419
SQLSTATE: HY000
You do not have the SUPER privilege and binary logging is enabled ...
```

This was a test-server privilege/configuration issue. MySQL's default binary logging imposes additional trigger-creation requirements beyond schema-level TRIGGER privileges. Only the exact container created by this package was removed after its ID and ownership label were checked. It was recreated with `mysql:8.4 --skip-log-bin`, then both migrations were retested from an empty database. No shared database was reset; no production logging settings were changed. [MySQL documents these binary logging requirements](https://dev.mysql.com/doc/refman/8.4/en/replication-options-binary-log.html).

### Successful execution and repeatability

- `npm.cmd run db:migrate`: PASS from an authenticated, verified empty MySQL 8.4.13 database; output `Local disposable MySQL migrations applied successfully.`
- Repeated `npm.cmd run db:migrate`: PASS, no schema recreation or journal changes.
- A second fresh task-owned instance ran the expanded `npm.cmd run test:db` from an empty database: both migrations and immediate repeat application passed.
- Two further executions of `npm.cmd run db:migrate` passed after that fresh suite.

Actual inventory:

| Object | Verified count/details |
| --- | --- |
| Application tables | 17 |
| Drizzle journal table | 1, separate from application count |
| Foreign keys | 18; referenced tables/columns and `RESTRICT` update/delete actions match declarations |
| Application indexes | 51, including primary, unique, declared lookup and automatically supplied FK indexes |
| Total indexes | 53, including two journal indexes |
| CHECK constraints | 24, all marked ENFORCED |
| Triggers | 13; correct names, tables, BEFORE timing and events |
| Journal rows | 2, ordered and matching local SQL hashes |

All declared columns were compared with real server types and nullability; monetary precision/scale, required primary/unique/lookup indexes and exact idempotency-key collation were checked. The permanent test also compares complete metadata fingerprints before/after repeat migration. Independent inventory snapshots and journal rows remained identical, with fingerprint:

```text
98a9938209929daa606d3d59f690041de649b699ac504c96b1df4c421d5c4b08
```

Applied SQL hashes:

| Migration | SHA-256 |
| --- | --- |
| 0000 | `5f972707b506644f976f71bd139f74c72f9e269bfeaba63ff3ca7165572ef16c` |
| 0001 | `21a7d78e4846ea6b53224593eca961dc92edd7bc7d48a42db8b14ed1c1ce9205` |

MySQL DDL implicitly committed before the initial trigger error; it was not treated as atomic or rolled back automatically.

## D. Database tests

The final fresh-database integration run reported:

```text
Applying migrations to the empty dedicated disposable test database.
Verified 17 tables, 18 foreign keys, 51 application indexes, 24 enforced checks and 13 triggers.
tests 25
pass 25
fail 0
cancelled 0
skipped 0
```

Coverage includes rejected orphan client/project/contract/phase/payment/allocation references; restrictive parent deletion; optional expense associations; valid/invalid project statuses; unique emails, single-contract cardinality, receipt numbers/versions and idempotency scopes; case-sensitive idempotency keys; positive amounts and strict overflow/negative-value rejection; safe JSON snapshots; cancellation/logical-deletion identity retention; and append-only audit/version history.

Exact money was verified both through mysql2 and Drizzle: `100.10` and a calendar date mapped as strings, and `9007199254740993.01` round-tripped without floating-point conversion. The latter exceeds JavaScript safe integer precision. Excess fractional-scale rounding by raw MySQL remains an input-validation responsibility, as previously documented.

### All 13 trigger behavior results

For every rejection below, the test asserted actual `ER_SIGNAL_EXCEPTION`, errno **1644**, SQLSTATE **45000**. Those were the expected and actual results in every row.

| Trigger | Table / event | Intended purpose and executed scenario | Expected / actual | Status |
| --- | --- | --- | --- | --- |
| `receipt_versions_no_update` | receipt_versions / BEFORE UPDATE | Preserve issued content; attempted storage-reference overwrite | 1644 / 1644 | PASS |
| `receipt_versions_no_delete` | receipt_versions / BEFORE DELETE | Preserve issued history; attempted version deletion | 1644 / 1644 | PASS |
| `audit_events_no_update` | audit_events / BEFORE UPDATE | Preserve audit history; attempted entity-type rewrite | 1644 / 1644 | PASS |
| `audit_events_no_delete` | audit_events / BEFORE DELETE | Preserve audit history; attempted row deletion | 1644 / 1644 | PASS |
| `entity_versions_no_update` | entity_versions / BEFORE UPDATE | Preserve snapshots; attempted entity-type rewrite | 1644 / 1644 | PASS |
| `entity_versions_no_delete` | entity_versions / BEFORE DELETE | Preserve snapshots; attempted row deletion | 1644 / 1644 | PASS |
| `payments_no_delete` | payments / BEFORE DELETE | Retain received/cancelled identity; attempted cancelled-payment deletion | 1644 / 1644 | PASS |
| `expenses_no_delete` | expenses / BEFORE DELETE | Retain outgoing-payment identity; attempted cancelled-expense deletion | 1644 / 1644 | PASS |
| `contracts_no_delete` | contracts / BEFORE DELETE | Retain contract identity; attempted contract deletion | 1644 / 1644 | PASS |
| `contract_phases_no_delete` | contract_phases / BEFORE DELETE | Preserve phase history; attempted physical deletion | 1644 / 1644 | PASS |
| `payment_allocations_no_delete` | payment_allocations / BEFORE DELETE | Preserve allocation history; attempted allocation deletion | 1644 / 1644 | PASS |
| `payment_receipts_no_delete` | payment_receipts / BEFORE DELETE | Retain receipt/number identity; attempted receipt deletion | 1644 / 1644 | PASS |
| `payment_receipts_identity_guard` | payment_receipts / BEFORE UPDATE | Preserve identity; independently attempted number, payment and ID changes | 1644 each / 1644 each | PASS |

Allowed operations also succeeded: proper payment and expense cancellation metadata, logical deletion of an unallocated phase, phase-description correction, contract lifecycle/version update, appending a second receipt version while retaining version 1, and receipt status update without changing identity. These are isolated database capability tests, not implemented domain workflows or proof of aggregate financial invariants.

### Ordinary InnoDB transactions

- Commit: a synthetic client and related project were committed and observed through a separate authenticated connection, preserving their FK relationship. Only those known synthetic nonfinancial rows were subsequently deleted.
- Rollback after error: valid client/project inserts followed by an invalid project FK produced errno 1452; explicit rollback left neither preceding row persisted.
- All other fixture writes ran in a transaction and rolled back, including immutable historical records. Final independent counts found every application table empty and only the two migration journal rows present.

### Exact project regression commands

| Command | Final result / relevant output |
| --- | --- |
| `npm.cmd test` | PASS: 14 tests, 0 failed, 0 skipped |
| `npm.cmd run db:check` | PASS: `Everything's fine` |
| `npm.cmd run test:db` | PASS: 25 test results, including all 13 named triggers; 0 failed/cancelled/skipped; fresh execution confirmed |
| `npm.cmd run db:migrate` | PASS: successful actual CLI execution and repeated no-op executions; initial resolved 1419 failure is documented above |
| `npm.cmd run typecheck` | PASS: route types generated; strict TypeScript exited 0 |
| `npm.cmd run lint` | PASS: no errors/warnings |
| `npm.cmd run build` | PASS: compiled successfully; 24 generated pages |
| `npm.cmd run start -- --port 3000` | PASS: local production-build server ready in 210 ms |
| `npm.cmd run check:routes` | PASS: 21 content routes, `/` redirect, 3 invalid routes and both disabled contact previews |

The HTTP smoke checks cover both public languages and every workspace section. No UI source changed. Browser visual/hydration testing was not performed; the earlier WP-01 browser-verification limitation is not claimed resolved by HTTP checks.

## E. Defects, corrections and changed files

1. **Confirmed environment issue:** default binary logging prevented the scoped migration user creating triggers (1419). Corrected only the disposable container startup configuration; successful empty-database and repeat runs verified the result. No migration SQL or approved business rule changed.
2. **Confirmed reproducibility risk:** `core.autocrlf=true` and no SQL line-ending attributes allowed Windows checkout conversion to change Drizzle's raw SQL hashes. Direct LF/CRLF hash comparison demonstrated different hashes for both files. Added an LF policy, verified `git check-attr ...` reports `text: set`, `eol: lf`, and confirmed `git diff --exit-code -- drizzle` remains clean. Current migration bytes/hashes were preserved.
3. **Verification coverage gap:** original tests grouped trigger checks and did not explicitly prove successful commit visibility or rollback after an error. Added named trigger subtests, complete metadata comparison, Drizzle decimal mapping and transaction tests. An intermediate new-test run was stopped due to nested-test scheduling using the parent context; that test-context issue was corrected, bounded by a 30-second suite timeout, and the final fresh run passed without cancellation or skips.

| Source path | Change/purpose |
| --- | --- |
| `.gitattributes` | Pin migration SQL to LF for stable byte hashes |
| `tests/db/integrity.integration.test.ts` | Expand real MySQL verification and individually named trigger/transaction checks |
| `tests/db/schema-inspection.ts` | Compare real columns, PKs, unique/lookup indexes, FKs, enforced checks and trigger metadata against declared schema; compare repeat fingerprints |
| `README.md` | Update verification status and document safe, reproducible Docker testing and its binary-log privilege requirement |
| `docs/WP-02V-report.md` | This evidence report |

The owner's pre-existing `AGENTS.md` modification was preserved, not authored or replaced by this work. Temporary scripts and nonsecret inventory evidence remain under ignored `artifacts/wp02v/`; populated environment files were deleted. Package files, schema definitions, migration SQL, migration journal/snapshots and application UI were not changed. No commit or push was made.

Repository-wide `git diff --check` flags the owner's pre-existing Markdown hard-break spaces in `AGENTS.md`; those were preserved. The work-package changes to tracked files pass the scoped whitespace check.

## F. WP02V acceptance checklist

| Criterion | Status | Evidence |
| --- | --- | --- |
| WP02V-AC01 | PASS | Docker CLI/Engine 29.9.2 operational; existing-container inventory inspected |
| WP02V-AC02 | PASS | Isolated official image; authenticated query confirmed actual MySQL 8.4.13 and intended database/port |
| WP02V-AC03 | PASS | Both actual migrations executed from empty; CLI and fresh integration runs passed |
| WP02V-AC04 | PASS | 17 application tables, types, keys, 51 app indexes and 24 enforced checks inspected against declarations |
| WP02V-AC05 | PASS | All 13 triggers exist with correct metadata and individually passed behavior tests |
| WP02V-AC06 | PASS | Two correct hashes in journal; repeated migration preserves journal and schema fingerprints |
| WP02V-AC07 | PASS | Actual FK and uniqueness rejection tests passed |
| WP02V-AC08 | PASS | Exact decimal strings, cents, large values and Drizzle/mysql2 mapping verified |
| WP02V-AC09 | PASS | Committed writes visible to a second connection; rollback after FK error leaves no partial writes |
| WP02V-AC10 | PASS | All 21 route regressions and additional HTTP checks pass; no UI source changed |
| WP02V-AC11 | PASS | Strict TypeScript, ESLint, build, 14 static tests and 25 database test results pass |
| WP02V-AC12 | PASS | Synthetic local test data only; no production/client access or infrastructure changes |
| WP02V-AC13 | PASS | Environmental and test/reproducibility issues addressed; actual fresh/repeat and regression checks pass |
| WP02V-AC14 | PASS | Transactional financial invariants remain explicitly deferred below and in README |

## G. Security and scope

- No real client/business information or production database was accessed.
- No Docker installation, WSL/virtualization changes, reboot, hosting or deployment occurred.
- No XAMPP/MariaDB operation or change to unrelated containers/volumes occurred.
- Container removal was limited to exact IDs created in this run, each checked against the package ownership label. DDL/data loss was confined to those disposable tmpfs test databases.
- The owned local application server was stopped; the final test container and unchanged task-owned credential files were removed.
- Git ignored the populated `.env.local` and temporary Docker env file. No credentials were printed, committed or pushed.
- No WP-03, CRUD, payment service, allocation service, receipt generation or reporting implementation was introduced.

## H. Remaining risks and deferred invariants

The database foundation is verified; no unresolved schema or migration SQL defect was found. A future binary-logged server still needs an approved migration privilege/configuration decision. The byte-hash line-ending policy must accompany future migration commits.

INV-01/02/03 (aggregate sums/capacity), INV-04/05 (reduction/logical-deletion eligibility), INV-06 (cancelled-payment treatment in domain totals), INV-07 (automatic atomic history capture), INV-08/09 (atomic numbering/correction/storage workflows) and INV-10 (contract/phase atomic domain edits) remain service-layer obligations. Current UNIQUE/FK/CHECK/trigger and transaction tests do not implement or certify those workflows. Phase/project membership checks, inactive-reference eligibility, optimistic concurrency, idempotency fingerprint handling, authorization and the five-active-client-user limit also remain for later packages.

The UI remains an unauthenticated development preview. HTTP regression success does not certify client hydration or visual accessibility.

## I. WP-03 readiness decision

**GO** — the prior MySQL execution blocker is resolved. Both migrations, all 13 trigger protections, declared constraints, exact money mapping, migration repeatability and ordinary transaction behavior have real MySQL 8.4.13 evidence, with project regression checks passing. Proceed with the separately authorized WP-03 Authentication & Authorization package when requested. WP-03 was not started here.
