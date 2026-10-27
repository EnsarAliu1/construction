# WP-08 - Incoming Payments and Financial Phase Allocations

Delivery evidence: 27 October 2026. **246 distinct Node test results passed; zero final failures/skips. Browser/mobile/hydration/accessibility execution: NOT VERIFIED.** Payment-and-receipt business release remains gated until WP-09. This report does not certify receipt issuance or fiscal validity.

## A. Repository baseline

- Initial branch `main`, tracking `origin/main`; HEAD `f6f52721c9c8387f8c5076a7989f3fdc2a657422` (WP-07).
- Only existing modification was the owner's new WP-08 `AGENTS.md`. Preserved without editing. No prior work discarded. The owner's standing commit/push authorization and latest instruction to continue as before cover GitHub delivery.
- Read actual instructions, package scripts, schema/migrations, WP-05 locks/capacity calculations, WP-07 transaction/auth/history conventions, receipt/idempotency models, money helpers, shared UI/navigation, tests and available WP-02V through WP-07 reports.
- Master Prompt v1.1, D-01 through D-14 source documents, original technical specification and approved UX/design/wireframe files remain unavailable in the repository. Their contents and visual approval are not claimed. Existing Operational Clarity UI was reused.
- **README.md was not edited**, per the owner's explicit instruction. Initial/final file SHA-256: `915105d49441af288ecbd02a3ba423a85c12cb245ae9d8d27b3ba1694c837569`. Documentation for this package is confined to this required report.
- Retained Next.js 16.4.3, React 19.3.1, TypeScript 6.0.3, Tailwind 4.3.3, Drizzle ORM 0.45.4, Drizzle Kit 0.31.11, mysql2 3.24.6 and tsx 4.23.15. Node 24.18.0/npm 11.6.1. No new dependencies, installations or lockfile change.

## B. Payment functionality

| Capability | Delivered state |
| --- | --- |
| Authenticated payment list/details/history | Fully implemented using persisted records |
| Project/phase lookup and allocation editor | Fully implemented; real bounded database values |
| Exact allocation preview, including proposed corrections | Fully implemented; locked validation, no business writes/capacity reservation |
| Idempotent payment/allocation registration engine | Implemented; final receipt-dependent action gated in UI/API |
| Versioned correction and allocation lifecycle engine | Implemented; saving gated until receipt versioning is supplied |
| Cancellation engine and capacity release | Implemented; final action gated until receipt cancellation integration |
| Owner-authorized operation-status lookup | Fully implemented; only committed operation state returned |
| Receipt PDF, storage, numbering policy and document lifecycle | Deferred to WP-09; no fake document/download |

Routes: `/app/payments`, `/new`, `/[id]`, `/[id]/edit`. The list replaces the placeholder with 20-row pages, actual transaction-date range, project, cash/bank, received/cancelled/all filters and bounded search by payment/project/client/receipt reference. Sorting is transaction date then UUID. Counts/rows share a read-only REPEATABLE READ snapshot; no invented financial totals are shown. Historical project/client references remain readable.

Registration preparation offers the active project selector, loadable contract phases, exact EUR amount/date/method, editable per-phase amounts, allocation total/difference, current remaining capacities and server validation. It explicitly states that checking neither saves a payment nor reserves capacity. The final confirmation button is disabled with a visible receipt dependency. The selector's shared required-label option ensures a payment project is required while preserving optional project selection for expenses.

Details show stable ID, project/client, actual date, method, amount, status, actor/time/version metadata, active and retired allocation identities, current receipt status and latest 30 payment/allocation audit events. Older history remains persisted. A receipt-less record is explicitly described as an incomplete payment-and-receipt workflow. Even existing receipt rows have no fabricated download link.

Correction preparation prefills current payment/allocations, fixes the project, requires deliberate confirmation for validation and uses current contract/phase versions. Final save and cancellation remain disabled and are rejected server-side. Cancelled payments are read-only. No physical delete, payment restoration, cross-project transfer, new business role or provisional payment status was introduced.

## C. Financial invariants

- Positive amounts use decimal strings, DECIMAL(19,2), BigInt cents and exact equality. The server rejects malformed input, zero/negative amounts, fractional cents, overflow, duplicate phases, missing allocations and unsupported methods. Actual calendar dates are independent of UTC audit/creation timestamps. Maximum `99999999999999999.99` payment/allocation was persisted exactly in MySQL.
- Each payment belongs to one project. All proposed phases must be active members of that project's current active contract. Project/client/contract must be active/unarchived for registration/correction. Project reassignment is explicitly rejected; no transfer workflow was invented.
- Proposed allocation sum must equal the entire payment amount. Up to 100 distinct allocations are allowed. Blank unused UI phase fields are omitted; entered amounts must be positive.
- Capacity is recalculated under aggregate locks as the sum of non-retired allocations belonging to `received` payments. Correction excludes its own payment before applying the complete proposed composition. Cancelled payments and retired allocation rows consume no active capacity.
- Removed allocations are logically retired with `deleted_at`, not deleted. Amount/identity/history remain. Adding the same phase again during a confirmed correction reuses that payment/phase allocation identity, increments its version, clears its retirement timestamp and appends history. Existing unique payment/phase constraint remains intact.
- Cancellation keeps amount, payment/allocation IDs and earlier state, records actor/reason/time, increments payment version and appends history. A repeated cancellation or stale correction is rejected. Capacity and received totals exclude the cancelled payment.
- WP-05's shared allocation calculation now excludes retired allocations. This necessary compatibility change prevents historical rows from continuing to consume phase capacity or blocking valid contract corrections. All prior contract/phase assertions remain enabled and passed.

## D. Locking and concurrency

All public domain operations authenticate independently. Mutations validate, start READ COMMITTED, shared-lock the actor's user row and recheck the live session. Account disable/session revocation follows the existing user-first convention and cannot silently bypass the in-transaction check.

Financial lock order is **user -> client -> project -> contract -> phases sorted by UUID -> payment -> allocations sorted by phase UUID -> receipt integration**. Parent discovery is a nonlocking hint; client identity is rechecked after locking the project. Hint changes conflict instead of acquiring a new parent out of order. Registration locks all current-contract phase rows before recalculating capacity; correction/cancellation lock the old/current aggregate before the payment and its rows. Cross-project transfer is rejected before a target aggregate is acquired, so the union of valid old/new parents is the same single-project aggregate.

All phases of the contract, including retired phases, are locked in UUID order (bounded to 1000 historical phase rows). All existing allocation identities are locked/read (bounded to 1000), including previously retired allocations. Proposed phases must be active; old allocations must still belong to that locked project's contract. Malformed legacy cross-project allocations are rejected rather than released/changed without their proper parent locks. Historical reads remain available for inspection.

For registration, an additional operation-key coordination lock is acquired **after user, before financial parents**. No writer acquires an operation lock after parent locks, so it does not introduce a reverse dependency. Receipt work is called only after payment/allocation locks. WP-09 must preserve this order; it must not acquire a counter/receipt lock and then enter a top-level payment service.

No automatic deadlock retry is implemented. A database deadlock/error rolls back the transaction and operation row; callers may safely retry the same logical registration key/payload after checking status. The services do not convert uncommitted work into success.

Actual independent-connection tests verified:

- Two payments competing for the same remaining phase capacity: one accepted, one capacity conflict.
- Payment versus WP-05 phase reduction: one valid outcome, no overbooking.
- Correction versus another new payment competing for capacity: one winner.
- Two corrections and correction versus cancellation: one version-safe winner.
- Simultaneous same-key confirmations: one payment and one exact replay.
- Session revocation queued ahead of the financial user lock: recheck denies the mutation with no partial payment.

## E. Persistent idempotency

Uses existing `operation_requests`, global operation type `payment_confirmation`, a lowercase UUID idempotency key, the existing binary/case-sensitive unique key and SHA-256 canonical request fingerprint. Canonical input includes sorted phase identities/versions, normalized exact amounts, project/contract versions, date and method.

Operation metadata stores server-derived `createdBy` as owner. Another active user cannot reuse that key or read its status; normal project/payment reads retain equal operational access. Exact retries return the stored original payment ID/version and `replayed: true`, rather than consuming capacity or adding another allocation/audit. Reuse with a different canonical payload returns 409. The original result remains a confirmation result even if the payment is subsequently corrected/cancelled; details expose its current state separately.

The processing row, payment, allocations, receipt callback and audit/versions share one transaction; completion metadata becomes visible only on commit. Failed validation/persistence leaves no committed operation or phantom payment. No separate durable failed state is fabricated. While an operation is uncommitted, status lookup may return not found; this is not reported as successful or proof that no request is in flight. Poll/check again or retry the same key and identical payload, which serializes on the unique key.

`GET /api/payments/operations/[key]` independently authenticates and returns only owner-authorized committed status/payment ID/version, or safe 404. A simulated lost-result test ignores the first returned response, resolves status through this persisted record and retries to the original result. No HTTP-disconnection success is inferred from a disabled button.

## F. Receipt dependency and concrete WP-09 contract

Existing payment status is only `received/cancelled`; receipt `draft` still requires a number and is a separate receipt state. It is not an approved provisional payment status. Consequently no new provisional state was invented and no receipt-less received payment can be finalized through the application routes.

**Current production-facing boundary:** `confirmPayment`, `correctPayment`, `cancelPayment` require a server-supplied `ReceiptBoundary`; none is configured by the UI/API. Valid final requests return `RECEIPT_PENDING` (409) before business writes. Body fields such as boundary/testMode/receiptNumber are rejected. Preview and reads remain useful. There is no environment flag or API accepting an injected test adapter.

**Test-only capability:** `isolatedPaymentBoundary` authenticates and verifies the configured loopback disposable `fitimi_test_*` connection, actual database and supported MySQL version. It is imported only by synthetic integration/HTTP fixtures, never routes/UI. It deliberately allows internal financial-engine testing without generating a receipt/PDF/number. It cannot mutate a payment that already has any numbered receipt row, including a draft or an issued-state fixture. These synthetic engine tests are not end-to-end payment/receipt certification.

**WP-09 implementation point:** supply `ReceiptBoundary { mode: "wp09", apply(tx, context) }` to the domain service **from trusted server code**. `PaymentTx` is the existing transaction, and `ReceiptContext` contains action (`confirm/correct/cancel`), real actor, correlation UUID, before/after payment and all current/historical allocation rows. Active allocation content is the subset with null `deletedAt`. The callback must not start/commit another transaction or call transaction-owning top-level services.

Within that same transaction, WP-09 must:

1. Create the receipt identity and immutable document version for confirmation; append a new immutable document version for correction; preserve identity and apply receipt cancellation for cancellation.
2. Use actual durable PDF bytes/storage/checksum and an approved numbering/reservation policy; do not expose speculative receipt numbers or reuse a number already issued externally after failure. WP-08 never increments a counter or assigns an application receipt number.
3. Record receipt audit/history with the supplied actor/correlation and preserve every existing receipt guard. Never update an immutable receipt-version row.
4. Make the actual document durably available and validated before resolving the callback. File staging/cleanup/recovery and reservation policy require WP-09 implementation; MySQL metadata alone is not proof of a durable PDF.
5. Throw on any failure so payment, allocation, operation and audit changes roll back together. WP-09 must handle orphan staged files/any durable number reservation safely without falsely claiming a distributed file/database transaction.

After the callback, the engine verifies receipt status (`issued` for confirmation/correction, `void` for cancellation) and an immutable version exists. For confirmation/correction, its content snapshot must match payment ID/version, amount, project, transaction date and method. Missing/stale metadata fails and rolls back. A no-op `wp09` callback is actually tested and cannot finalize a payment. Test-mode correction/cancellation against numbered draft/issued-state fixtures is rejected without changing payment version. No PDF or legal issuance is fabricated in those fixtures.

WP-09 must also enable the UI only after supplying this real adapter, retain client confirmation keys across uncertain delivery, use status lookup/replay, and integrate deliberate correction/cancellation with document versions. **Implemented but gated is distinct from business release-ready.**

## G. Database and migrations

Reused all existing payment/allocation, project/client/contract/phase, users, audit/history, receipt/counter and operation tables. No competing/new application table or business-visible payment status.

Additive migration `drizzle/0007_wp08_payment_allocations.sql`, generated snapshot and eighth journal entry:

- `payment_allocations.version` unsigned default 1 and positive-version check.
- Nullable `deleted_at`, `created_by`, `updated_by`; RESTRICT actor FKs and actor/active-phase indexes.
- Nullable `payments.updated_by`, RESTRICT actor FK and index.
- Existing allocation uniqueness, positive amounts, payment statuses, receipt guards and flat history allowlist remain. Existing allowlist already supports all required fields; no snapshot protection was relaxed. Legacy actors remain unknown/null.

Migration 0007 SHA-256: `cb0a5a2770ee7b2b107982a7ff17e7787002f9d092374732d7944c12416e94bc`. All prior migrations 0000-0006 remain byte-identical and all seven prior hashes are pinned in regression tests.

Actual environment: official `mysql:8.4`, queried MySQL **8.4.13**, InnoDB, UTC `+00:00`, database `fitimi_test_wp08`, loopback `127.0.0.1:3307`. Version/identity were checked **before** migrations. Task-owned container `fitimiconstruction-mysql-wp08`, exact ID `0a26fa98f887b70126e3cc7c120698c1cb141a0c6913a22cc699add703d67a21`, ownership labels `adore.work-package=WP-08`, `adore.project=fitimiconstruction`, disposable tmpfs storage, synthetic credentials. Binary logging disabled only in this isolated test environment to allow scoped failure-injection triggers.

All eight migrations applied to this fresh owned database. Repeat migration/schema/journal checks passed; later suites correctly identified an already migrated schema. Verified **20 application tables, 42 foreign keys, 86 application indexes, 36 enforced checks, 13 original triggers, eight matching migration hashes**. Final test cleanup disables synthetic users. Task-owned server/container and temporary credential files are removed after verification; unrelated containers/databases/volumes are untouched.

## H. Exact changed-file manifest

38 delivered paths; README.md excluded:

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Owner's WP-08 task, preserved unchanged |
| `.env.example` | Document WP-08 ownership label for guarded outage testing; no secrets |
| `package.json` | Focused payment scripts and main unit/DB-suite inclusion |
| `docs/WP-08-report.md` | Required delivery, evidence and WP-09 integration contract |
| `drizzle/0007_wp08_payment_allocations.sql` | Additive allocation history/payment actors |
| `drizzle/meta/0007_snapshot.json` | Generated schema snapshot |
| `drizzle/meta/_journal.json` | Eighth ordered migration entry |
| `src/server/db/schema/finance.ts` | Payment/allocation actor, version and retirement schema/indexes |
| `src/features/projects/service.ts` | Exclude retired allocations from WP-05 totals/capacity |
| `src/features/expenses/forms.tsx` | Shared selector required-label/empty-selection option; expense semantics retained |
| `src/features/workspace/sections.ts` | Accurate payment section description |
| `src/components/layout/workspace-shell.tsx` | Accurate preparation/receipt-dependent availability notice |
| `src/features/payments/validation.ts` | Strict money/date/method/allocation/query/version/key validation |
| `src/features/payments/service.ts` | Engine, locks, idempotency, audit, receipt contract, previews/read services |
| `src/features/payments/testing.ts` | Guarded isolated-test receipt capability, not imported by routes/UI |
| `src/features/payments/http.ts` | Auth, origin/host, body bounds, no-store and safe error boundary |
| `src/features/payments/web.ts` | Independent page authorization/redirects/404/safe errors |
| `src/features/payments/forms.tsx` | Allocation preparation/correction preview and search filters |
| `src/features/payments/screens.tsx` | Real list/details/history and explicitly gated payment controls |
| `src/app/(workspace)/app/payments/page.tsx` | Payment list |
| `src/app/(workspace)/app/payments/new/page.tsx` | Preparation editor |
| `src/app/(workspace)/app/payments/[id]/page.tsx` | Payment details/history |
| `src/app/(workspace)/app/payments/[id]/edit/page.tsx` | Correction preparation |
| `src/app/(workspace)/app/payments/error.tsx` | Safe retry/error UI |
| `src/app/api/payments/route.ts` | List and gated confirmation |
| `src/app/api/payments/preview/route.ts` | Locked, non-persisting allocation validation |
| `src/app/api/payments/[id]/route.ts` | Details and gated correction |
| `src/app/api/payments/[id]/preview/route.ts` | Locked proposed correction validation |
| `src/app/api/payments/[id]/cancel/route.ts` | Gated cancellation |
| `src/app/api/payments/projects/[id]/route.ts` | Real contract/phases/current capacities |
| `src/app/api/payments/operations/[key]/route.ts` | Owner-authorized committed operation status |
| `tests/payments/fixtures.ts` | Synthetic isolated project/payment fixtures |
| `tests/payments/validation.test.ts` | Six focused unit tests |
| `tests/payments/payments.integration.test.ts` | Exactness, capacity, concurrency, idempotency, history, rollback and receipt gate |
| `tests/payments/http.integration.test.ts` | Actual pages/APIs, previews, gates, status ownership and security |
| `tests/db/schema.test.ts` | Eighth migration/new FKs; pin all seven prior hashes |
| `tests/db/integrity.integration.test.ts` | Eight-migration expectation; prior integrity assertions retained |
| `tests/auth/http.integration.test.ts` | WP-08 owned-container label and payment error redaction during real outage |

Ignored task diagnostics/build artifacts/local credential files are excluded. No dependency lockfile, earlier migration, receipt PDF or README change is included.

## I. Verification evidence

| Exact command | Final result |
| --- | --- |
| `node_modules/.bin/tsx.cmd artifacts/wp08/environment.ts` | PASS, actual version/identity before migrations |
| `npm.cmd run db:generate -- --name=wp08_payment_allocations` | PASS, generated migration 0007/snapshot/journal |
| `npm.cmd run db:migrate` | PASS, fresh eight migrations and repeat execution |
| `npm.cmd run db:check` | PASS |
| `npm.cmd test` | PASS 44/44 |
| `npm.cmd run test:payments:db` | PASS 22/22 final focused rerun; overlaps the main DB count |
| `npm.cmd run test:db` | PASS **138/138**, including 22 payment results and all earlier modules |
| `npm.cmd run typecheck` | PASS, Next route generation and strict TypeScript |
| `npm.cmd run lint` | PASS, zero warnings |
| `npm.cmd run build` | PASS, production build and dynamic authenticated payment routes |
| `npm.cmd run start -- --port 3000` | PASS, actual production server bound to loopback |
| `npm.cmd run test:payments:http` | PASS 10/10 |
| `npm.cmd run test:expenses:http` | PASS 10/10 |
| `npm.cmd run test:references:http` | PASS 19/19 |
| `npm.cmd run test:projects:http` | PASS 8/8 |
| `npm.cmd run test:clients:http` | PASS 8/8 |
| `npm.cmd run test:auth:http` | PASS 9/9, including real guarded pause/resume and safe payment 503 |
| `npm.cmd run check:routes` | PASS, ten SQ/EN content pages, private redirects, login/invalid routes |
| `node_modules/.bin/tsx.cmd artifacts/wp08/inspect.ts` | PASS, real schema/trigger/journal counts and zero active synthetic accounts |

Distinct total: **44 + 138 + 10 + 10 + 19 + 8 + 8 + 9 = 246**. Node parent/subtest results are counted; assertions, focused reruns and route smoke checks are not counted again.

An initial focused test compared MySQL's exact COUNT string `'0'` with numeric zero; converting only that count in the assertion corrected the fixture expectation. No monetary conversion or application safeguard was weakened. A later Windows/OneDrive build failed with EPERM in generated `.next` output; only the verified workspace cache was removed with native PowerShell and the production rebuild passed. No source or migration was deleted to fix the environment.

DB failure-injection tests add uniquely named temporary INSERT triggers on audit/history, drop only their own triggers in `finally`, and verify rollback of payments/allocations/operation records and corrections/cancellations. All 13 original guards stay intact. Contract reduction after allocation retirement is exercised against real WP-05 services. The malformed historical cross-project test demonstrates safe rejection rather than attempting an out-of-order repair.

Browser runtime selection returned `No browser is available`; supported troubleshooting discovery returned `[]`. HTTP tests verify actual labels, escaped markup, active navigation, disabled receipt-dependent buttons, status codes, no-store, field validation, authorization and hostile Origin/Host behavior. They do not prove hydration, layout, mobile interaction or actual accessibility execution. Those remain NOT VERIFIED.

## J. Acceptance

PASS for engine functionality below includes its explicit receipt-dependent gate; it is not a claim of completed receipt business workflow.

| Criterion | Status | Concise evidence |
| --- | --- | --- |
| WP08-AC01 | PASS | Existing payments/payment_allocations and relationships reused |
| WP08-AC02 | PASS | One-project engine with locked contract/phase ownership |
| WP08-AC03 | PASS | Exact full allocation equality; over/under/duplicates rejected |
| WP08-AC04 | PASS | New and malformed legacy cross-project allocations rejected |
| WP08-AC05 | PASS | Locked active totals plus proposed delta enforce capacity |
| WP08-AC06 | PASS | Concurrent registration/correction capacity tests |
| WP08-AC07 | PASS | WP-05 parent/phase ordering; reduction race verified |
| WP08-AC08 | PASS | Actual calendar dates and cash/bank validated/persisted |
| WP08-AC09 | PASS | BigInt/string arithmetic; maximum DECIMAL persisted exactly |
| WP08-AC10 | PASS | Business/audit/versions/operation share transaction; forced rollback |
| WP08-AC11 | PASS | Versioned correction preserves old allocations/history; final UI/API gated |
| WP08-AC12 | PASS | Engine cancellation retains identities and releases capacity; final action gated |
| WP08-AC13 | PASS | Cancelled payments excluded from received sums and capacity |
| WP08-AC14 | PASS | Persistent unique confirmation key, original result replay |
| WP08-AC15 | PASS | Exact/conflicting/concurrent retry tests |
| WP08-AC16 | PASS | Owner-authorized persisted operation status after ignored result |
| WP08-AC17 | PASS | Independent page/API/domain guards; disabled/revoked/anonymous denied |
| WP08-AC18 | PASS | Actual list/details/phase editor/locked previews and historical data |
| WP08-AC19 | PASS | No public receipt-less finalization; explicit disabled controls/409 gate |
| WP08-AC20 | PASS | No counter issuance; original receipt identity/version guards pass |
| WP08-AC21 | PASS | Real MySQL 8.4.13 integration, financial races and idempotency |
| WP08-AC22 | PASS | All earlier module suites, seven pinned hashes and 13 guards |
| WP08-AC23 | PASS | Strict TypeScript, lint, build and all HTTP checks |
| WP08-AC24 | NOT VERIFIED | No connected browser for visual/mobile/hydration/accessibility execution |
| WP08-AC25 | PASS | Owned loopback disposable database, synthetic data, no production/deployment |
| WP08-AC26 | PASS | Concrete trusted transaction callback/context/verification contract in section F |

## K. Security and scope

All public services and routes independently check a live active session. User locks/session rechecks coordinate revocation; clients keep equal operational permissions. Strict object whitelists reject actors, status overrides, receipt numbers, test capabilities and internal fields. UUIDs/versions, 128 KiB JSON, 100-character search, page 1-10000, 20-row lists and phase/allocation bounds cap requests/results. Money/date/method validation is server-side. Optional UI states cannot bypass domain checks.

Drizzle parameterization and literal LIKE escaping are used. Existing configured Origin/Host checks protect every POST/PUT/preview. Native HTTP tests send genuinely hostile Host headers rather than relying on fetch, which can override them. React escapes persisted labels/snapshots. Safe boundaries suppress raw SQL/credentials/bound personal data and use no-store responses; the actual DB-outage test verifies safe payment 503. Snapshot allowlists, immutability triggers and legacy attribution remain protected. Temporary credentials/cookies/generated files are checked out of staged content before commit.

No PDF rendering/storage/version-file lifecycle, fiscal certification, report export, banking/import, online processing, payables, inventory, scheduling, physical-progress features, real business data or production infrastructure were used. Synthetic issued-state receipt rows are explicit guard fixtures, not generated documents or fiscal evidence. No new provisional payment status, speculative receipt number, restoration or transfer workflow was invented. README remains unchanged until the owner finishes the project.

## L. Next work package and remaining limits

Ready for separately authorized **WP-09 - Receipt Issuance, PDF Versioning and Cancellation** using section F's concrete integration point. Do not enable real received-payment confirmation until actual receipt issuance/versioning/cancellation is supplied and verified. WP-09 is not implemented automatically.

Outstanding: real browser/mobile/accessibility execution; missing approved design/source files; approved receipt numbering/reservation and actual durable PDF/storage recovery policy; enabling persistent client keys and receipt-dependent confirmation UI once integration is complete. The current package deliberately fails closed at that boundary. Historical aggregate limits are 1000 rows, editor allocations/phases 100 and recent visible events 30; older immutable history stays stored. No automatic deadlock retries are claimed. Public previews validate a moment in time and do not reserve funds/capacity.
