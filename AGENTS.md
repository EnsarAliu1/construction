# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-08: Incoming Payments & Financial Phase Allocations

**Project:** Fitimi Construction Management System & Corporate Website  
**Package:** WP-08  
**Version:** 1.0  
**Date:** 27.10.2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Authorization:** Local code development, additive migrations, disposable database testing and verified WP-08 defect corrections.

---

## 1. MISSION

Implement the core incoming-payment and contract-phase allocation functionality using the existing authenticated Next.js, Drizzle and MySQL architecture.

This is one of the project's highest-risk financial work packages.

The implementation must guarantee that:

- Each actual incoming payment belongs to exactly one project.
- A payment may be allocated across one or more financial phases of that same project.
- Active allocation amounts sum exactly to the payment amount.
- Active allocations never exceed a phase's current value.
- Concurrent writers cannot overbook phase capacity.
- Payment confirmation is idempotent.
- Payment corrections and cancellations preserve complete history.
- Cancelled payments do not contribute to active received totals or phase capacity.
- All financial mutations are atomic and auditable.

Implement working application code and meaningful database/integration tests.

Do not stop at an architecture document.

Do not implement PDF generation or complete receipt document lifecycle in this package.

## 2. CRITICAL RECEIPT DEPENDENCY

Approved business requirement: every actual received payment generates a receipt.

The full A4 receipt PDF, immutable PDF version storage and fiscal/accounting validation belong to WP-09.

Do not misrepresent an incoming-payment entry without its receipt document as a fully completed, release-ready business workflow.

For WP-08:

1. Inspect the existing `payments`, `payment_receipts`, `receipt_versions`, `receipt_counters` and `operation_requests` structures.
2. Establish and test the exact transactional boundary needed by WP-09 to integrate receipt issuance.
3. Implement durable payment/allocation services without inventing fiscal validity.
4. If an approved existing status can safely represent a provisional, unissued payment, use it only with explicit labeling and keep it excluded from active received totals/capacity until final issuance.
5. Do not invent a new business-visible payment status or finalize a new receipt workflow without supporting approval.
6. If no safe provisional state exists, keep the receipt-dependent final-confirmation workflow internal/test-only or explicitly gated in the development UI until WP-09 supplies the missing receipt issuance step.
7. Never issue a receipt number speculatively and then reuse it after failure.
8. Document precisely which finalization operation WP-09 must compose with payment confirmation.

The payment domain engine must be real and testable. However, a visually functional confirmation button must not falsely imply that a downloadable receipt has already been issued.

Do not silently weaken the receipt requirement merely because WP-09 has not been implemented.

## 3. EXISTING PROJECT BASELINE

Reported completed work:

- WP-01: Next.js bootstrap, public website and application shell.
- WP-02/02V: MySQL/Drizzle database integrity.
- WP-03: Authentication and authorization.
- WP-04: Clients Management.
- WP-05: Projects, Contracts & Financial Phases.
- WP-06: Categories, Persons/Suppliers & Vehicles.
- WP-07: Expense Transactions.

Reported technology:

- Next.js 16.4.3.
- React 19.3.1.
- TypeScript 6.0.3.
- Drizzle ORM 0.45.4.
- Drizzle Kit 0.31.11.
- mysql2 3.24.6.
- MySQL 8.4.13 in disposable tests.

WP-07 introduced migration `0006_wp07_expenses.sql`.

Before implementation:

- Verify actual Git branch, HEAD and working-tree state.
- Read AGENTS.md and existing repository instructions.
- Inspect actual schema, migration history and financial service conventions.
- Review WP-05 contract/phase locking.
- Review WP-07 transactions and audit patterns.
- Inspect receipt and idempotency schema even though PDF issuance is deferred.
- Preserve existing changes and migration hashes.

Do not assume any historical report fully describes the present repository.

## 4. REQUIRED BUSINESS DEFINITIONS

A payment represents actual money received from a client.

Only EUR is supported.

Payment methods:

- Cash.
- Bank transfer.

The method represents how the money was received.

Do not introduce online payments, bank account synchronization or bank statement import.

A payment belongs to one project.

All allocations from that payment must refer to financial phases belonging to that exact same project's current contract.

A payment may be split among multiple phases.

Financial phases are contract-value components, not physical construction progress percentages.

Actual transaction date is separate from creation/audit timestamps.

Cancelled payments are excluded from active received totals.

## 5. APPROVED FINANCIAL INVARIANTS

### PAY-INV-01 — Exact allocation equality

For a finalized active payment:

`SUM(active allocation amounts for payment) = payment amount`

Do not accept:

- Underallocation.
- Overallocation.
- Negative allocation.
- Duplicate phase allocation that bypasses uniqueness.
- Silent rounding or fractional-cent residue.

### PAY-INV-02 — Same-project allocation

Every allocation phase must belong to the payment's project.

Do not rely only on valid foreign keys.

Verify ownership within the transaction.

### PAY-INV-03 — Phase capacity

For every active phase:

`SUM(allocations belonging to active received payments) <= phase value`

Do not count allocations from cancelled payments.

### PAY-INV-04 — Atomic payment registration

A payment and all its allocations must be committed as one business operation, together with required audit/version records.

No partial successful payments.

### PAY-INV-05 — Idempotency

Repeated confirmation of the same logical request must not create duplicate payments or allocations.

Use persistent database-backed idempotency handling.

### PAY-INV-06 — Concurrency

Two users must not simultaneously consume the same phase capacity beyond its allowed value.

### PAY-INV-07 — Corrections

Changing an active payment's amount, date, method, project eligibility or allocation composition must preserve previous values and enforce all affected phase capacity checks.

Do not silently transfer a payment between projects; use only an explicitly approved workflow. If no approved transfer exists, reject project reassignment and document it.

### PAY-INV-08 — Cancellation

Cancellation preserves payment/allocation identities and history while releasing active phase capacity.

A second cancellation attempt must not silently create a new cancellation event.

### PAY-INV-09 — Contract/phase compatibility

Payment and allocation writes must coordinate with the same parent locks as WP-05's contract editor.

### PAY-INV-10 — Receipts

Final receipt issuance and its immutable document history must be integrated before real business usage. A database payment alone is not sufficient evidence that the receipt requirement has been completed.

## 6. DATA MODEL

Reuse the existing tables:

- `projects`
- `clients`
- `contracts`
- `contract_phases`
- `payments`
- `payment_allocations`
- `operation_requests`
- `payment_receipts`
- `receipt_versions`
- `receipt_counters`
- `audit_events`
- `entity_versions`
- `users`

Inspect actual columns, indexes, statuses, lifecycle conventions and constraints before implementation.

Do not create competing payment or allocation tables.

Use additive migrations only if necessary.

Do not rewrite migrations 0000–0006.

Preserve all original history and receipt protection triggers.

## 7. INCOMING PAYMENT OPERATIONS

Implement authenticated domain operations for:

### A. Payment List

Provide:

- Bounded pagination.
- Search by appropriate project/client/payment references.
- Transaction-date range.
- Project filter.
- Cash/bank method filter.
- Current payment status.
- Real persisted amount.
- Clear cancellation status.

Do not show invented financial totals.

### B. Payment Details

Display:

- Stable payment identity.
- Linked project and client.
- Actual received date.
- Amount in EUR.
- Payment method.
- All allocation phase names and amounts.
- Current status.
- Audit/history entries.
- Receipt availability and actual issuance status.

Do not show a fake downloadable receipt.

### C. Payment Registration

Implement:

- Active project selector.
- Actual transaction date.
- Amount in EUR.
- Cash/bank method.
- Available financial phases for selected project.
- Editable allocation amounts.
- Calculated allocation total.
- Difference versus payment amount.
- Server-side validation.
- Clear success/failure feedback.

Use only actual database values.

Do not accept allocations for another project.

The final active/received confirmation remains subject to the receipt dependency in section 2.

### D. Payment Correction

Implement an explicitly confirmed correction workflow for the payment's approved editable fields and allocations.

A correction must:

- Preserve payment identity.
- Preserve earlier allocation/history evidence.
- Validate all affected phase capacities.
- Recompute the allocation total.
- Use the existing optimistic version.
- Write audit/version snapshots atomically.

A correction to a payment with an already issued receipt must not bypass WP-09's mandatory receipt-version regeneration.

Until the document workflow is integrated, prevent finalizing any correction that would leave an issued receipt inconsistent with the payment.

### E. Payment Cancellation

Implement a confirmed logical cancellation workflow.

Cancellation must:

- Preserve original payment and allocation references.
- Preserve the historical received amount and previous state.
- Record actor, reason and timestamp.
- Append audit/version history.
- Exclude the payment from active income totals.
- Exclude its allocations from phase capacity usage.
- Preserve existing receipt identities.
- Hand off receipt cancellation state to WP-09.

Do not physically delete financial records.

Do not implement unapproved payment reactivation or restoration.

## 8. EXACT MONEY HANDLING

Reuse WP-05's established BigInt-cent monetary helpers or an equally exact shared implementation.

Use `DECIMAL(19,2)` for storage.

Validate:

- Strict decimal strings.
- Positive payment amount.
- Positive allocation amounts.
- At most two decimal places.
- Maximum database-supported monetary range.
- Exact allocation sum.
- No JavaScript floating-point equality checks.

Perform arithmetic with exact cents or equivalent exact integer representation.

Never silently round malformed inputs.

Calendar transaction dates must use correct DATE semantics, independent of UTC creation timestamps.

## 9. LOCKING — MANDATORY WP-05 COMPATIBILITY

This is a critical requirement.

WP-05 established the following cooperative lock order:

1. Acting user.
2. Client.
3. Project.
4. Contract.
5. Contract phases ordered by UUID.
6. Payment and allocation rows when applicable.

Implement the same protocol.

For registration:

1. Authenticate and validate request shape.
2. Enter one READ COMMITTED InnoDB transaction.
3. Lock/recheck the acting user and live session.
4. Lock the relevant client.
5. Lock project.
6. Lock contract.
7. Lock all relevant phase rows in deterministic UUID order.
8. Recheck project/client/contract relationships and active eligibility.
9. Recalculate active allocation totals while holding the aggregate locks.
10. Enforce equality, same-project membership and capacity.
11. Persist business rows and audit/version records.
12. Commit atomically.

For correction/cancellation:

- Preflight-discover existing relationships without treating them as trusted.
- Acquire the union of old/new relevant parent locks in deterministic order.
- Recheck discovered parent identities after locking.
- Lock affected phases in deterministic order.
- Lock existing payment/allocation rows after parent locks.
- Recompute capacities with the pending change applied.
- Reject stale versions and invalid status transitions.

Avoid reverse locking order with WP-05.

Do not depend on an unprotected SUM query for concurrency safety.

Document any deadlock retries and ensure they do not duplicate writes or consume an idempotency key incorrectly.

## 10. PERSISTENT IDEMPOTENCY

Use the existing `operation_requests` table where compatible.

For payment registration/finalization:

- Require a client-generated or server-issued unique idempotency key appropriate to the API.
- Bind the key to a canonical request fingerprint.
- Persist the request lifecycle.
- Return the original result for an exact safe retry.
- Reject reuse of the same key with a different payload.
- Handle simultaneous requests with the same key.
- Handle an interrupted HTTP response after a committed operation.
- Ensure the key cannot be used by another authenticated user to retrieve private results without authorization.

Do not rely only on a disabled submit button.

Implement or expose a safe way to query operation status after uncertain delivery.

The idempotency record and payment operation must remain transactionally consistent.

Do not call an uncommitted operation successful.

Include real independent-connection race tests.

## 11. AUDIT AND HISTORY

Use existing:

- `audit_events`
- `entity_versions`

Record:

- Actor.
- Payment/allocation entity IDs.
- Action.
- UTC timestamp.
- Before/after representations.
- Monetary values as exact strings.
- Correlation/operation ID.
- Entity version.

All necessary business rows and audit/version records must commit together.

Do not overwrite previous history.

Do not hard-delete allocations to represent corrections.

If an allocation must become inactive, use the existing model's supported lifecycle or a narrowly scoped additive migration. Do not invent irreversible deletion behavior.

Verify compatibility with the current immutable history triggers.

## 12. STATUS AND REPORTING SEMANTICS

Only active received payments count as income.

Cancelled payments are excluded.

Provisional, failed or otherwise unissued operations must not be presented as completed active income.

Phase active paid amount is derived from qualifying current payment/allocation state.

Contract-phase totals must remain consistent.

Do not label income-minus-expenses as statutory profit.

Do not implement company report PDF/Excel in WP-08.

Do not implement project-specific financial report export.

## 13. PAYMENT UI

Replace the existing Payments/Income placeholder with a working interface appropriate to the actual implemented backend capabilities.

Provide:

- Payment list.
- Payment registration interface.
- Project and phase selection.
- Allocation editor.
- Exact allocation totals.
- Remaining phase capacity information.
- Payment details.
- History.
- Correction and cancellation controls where safe and permitted.
- Clear pending, conflict, empty and error states.
- Correct receipt-unavailable or not-yet-issued message.

No button may claim that a payment and its required receipt were fully issued if the receipt document workflow has not been implemented.

If final active confirmation cannot yet satisfy the receipt invariant, gate that action and make the dependency visible.

Keep the underlying domain functionality testable and ready for WP-09 composition.

Use existing Operational Clarity tokens and components.

Implement accessible labels and responsive forms.

Do not redesign unrelated modules.

## 14. AUTHORIZATION & SECURITY

Reuse WP-03 authentication and authorization.

Every page, API and domain service must independently enforce live authorization.

Use:

- Server-side validation.
- Origin/Host checks on mutations.
- Parameterized Drizzle queries.
- Bounded request sizes.
- Whitelisted editable fields.
- Version checks.
- Safe error mapping.
- No-store responses.
- No sensitive data in logs.

Five client users retain equal operational rights.

Do not introduce new business roles.

No production or real client data access is authorized.

## 15. MIGRATIONS

Create an additive migration only when required.

Verify real schema fields before generating SQL.

Do not modify any prior migration SQL.

Pin previous migration hashes.

Test on disposable MySQL 8.4.

Verify:

- Existing schema.
- All 13 history/receipt guards.
- New constraints/indexes.
- Migration repeatability.
- Idempotency uniqueness.
- Historical allocation references.
- Correct amount/status semantics.

If receipt or payment statuses cannot represent the safe WP-08/WP-09 boundary without changing approved business semantics, document the issue explicitly rather than quietly inventing a final state.

## 16. AUTOMATED TESTING

### Payment Validation

Test:

- Positive exact EUR amount.
- Cash/bank methods.
- Valid date.
- Required fields.
- Malformed amount rejection.
- Decimal overflow rejection.
- Zero/negative allocation rejection.
- Duplicate phase allocation.
- Wrong-project phase rejection.
- Exact allocation equality.

### Phase Capacity

Test:

- Allocation to a phase with capacity.
- Allocation exactly equal to remaining capacity.
- Rejection above capacity.
- Concurrent payments competing for remaining capacity.
- Concurrent payment and contract-phase reduction.
- Cancelled payment exclusion.
- Correction that moves an allocation between phases.

### Persistence & Audit

Test:

- Atomic payment/allocation save.
- Audit/version rows.
- Forced failure rollback.
- Immutable historical identity.
- Exact transaction-date preservation.
- Cancellation releases active capacity while preserving history.

### Idempotency

Test:

- First confirmation request.
- Exact retry returns original result.
- Same key with different payload rejected.
- Two simultaneous identical requests.
- Interrupted response followed by status lookup.
- Rejected operation does not create phantom payment.
- Unauthorized reuse of an operation key denied.

### Receipt Boundary

Test:

- No released/finalized receipt claim without actual issuance.
- Payment/receipt consistency requirements are enforced at integration boundaries.
- Receipt documents are not fabricated.
- Existing receipt version protection remains unchanged.
- Future WP-09 finalization hook/contract is clearly specified and testable.

### Security

Test:

- Anonymous denial.
- Disabled-user denial.
- Forged IDs and wrong-project relationships.
- Origin/Host protection.
- Protected-field injection rejection.
- Safe database error handling.
- Session revocation during a financial mutation.

### Regression

Preserve:

- Authentication.
- Clients.
- Projects/contracts/phases.
- Categories/suppliers/vehicles.
- Expenses.
- Historical migration hashes.
- All existing triggers.
- Public SQ/EN website.
- App navigation.
- TypeScript.
- ESLint.
- Build.

Run browser tests if a browser is actually available.

Otherwise report visual/hydration acceptance as NOT VERIFIED.

## 17. OUT OF SCOPE

Do not implement:

- A4 receipt PDF rendering.
- PDF storage and version file lifecycle.
- Fiscal receipts or fiscal certification.
- Company PDF/Excel report export.
- Full dataset export.
- Banking integration.
- Online payment processing.
- Supplier payables.
- Inventory.
- Scheduling.
- Physical construction progress.
- Production deployment.
- Real business data imports.

Do not invent new financial business rules or receipt legality claims.

## 18. ACCEPTANCE CRITERIA

**WP08-AC01:** Existing payment/allocation structures are reused.

**WP08-AC02:** Payment domain service supports one-project payment allocation.

**WP08-AC03:** Exact payment/allocation sum is enforced.

**WP08-AC04:** Cross-project allocations are rejected.

**WP08-AC05:** Active phase capacity cannot be exceeded.

**WP08-AC06:** Concurrent writers cannot overbook phase capacity.

**WP08-AC07:** Payment/contract-phase operations share compatible locking.

**WP08-AC08:** Actual transaction dates and cash/bank methods are validated.

**WP08-AC09:** EUR monetary arithmetic is exact.

**WP08-AC10:** Payment mutations and audit/history commit atomically.

**WP08-AC11:** Corrections preserve identity, old values and financial invariants.

**WP08-AC12:** Cancellation retains history and releases active phase capacity.

**WP08-AC13:** Cancelled payments are excluded from active received totals.

**WP08-AC14:** Idempotency prevents duplicate logical confirmation.

**WP08-AC15:** Exact retries, conflicting payloads and concurrent retries behave safely.

**WP08-AC16:** Operation status can be checked safely after uncertain delivery.

**WP08-AC17:** Payment APIs/services have independent server-side authorization.

**WP08-AC18:** Payment list, details and allocation UI use real database-backed state.

**WP08-AC19:** Final receipt-dependent actions are not misrepresented as ready before WP-09.

**WP08-AC20:** Receipt numbering/version guards remain intact.

**WP08-AC21:** MySQL 8.4 integration and concurrency tests pass.

**WP08-AC22:** Previous module/migration/trigger regressions pass.

**WP08-AC23:** TypeScript, ESLint, production build and HTTP checks pass.

**WP08-AC24:** Browser/mobile/accessibility tests are executed where possible; otherwise NOT VERIFIED.

**WP08-AC25:** No real data, production changes or deployment occur.

**WP08-AC26:** A concrete WP-09 receipt integration contract is documented.

Report each criterion as PASS, FAIL or NOT VERIFIED.

Clearly distinguish:

- Fully implemented.
- Implemented but gated.
- Deferred until WP-09.
- Not verified.

Do not claim end-to-end payment/receipt readiness from payment-only tests.

## 19. VERIFICATION

Inspect actual package scripts first.

Run applicable:

- `npm.cmd test`
- `npm.cmd run db:check`
- `npm.cmd run db:migrate`
- `npm.cmd run test:db`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run check:routes`

Add focused payment unit, integration and HTTP tests.

Use an isolated, task-owned disposable MySQL 8.4 environment.

Do not destroy other containers, databases or volumes.

Verify actual server version before migrations.

Record exact commands and actual outputs.

Do not disable previous tests to obtain a passing result.

## 20. REQUIRED DELIVERY REPORT

### A. Repository Baseline

Branch, HEAD, modifications and sources actually accessible.

### B. Payment Functionality

List, details, registration, allocation editor, correction and cancellation.

### C. Financial Invariants

Exact sums, project membership, capacity and status handling.

### D. Locking & Concurrency

Detailed lock order and actual concurrent-test outcomes.

### E. Idempotency

Key scope, request fingerprint, retries, conflict handling and operation status.

### F. Receipt Dependency

Exactly what is implemented, gated and deferred until WP-09.

### G. Database & Migrations

Files, constraints, hashes and real MySQL execution.

### H. Files Changed

Exact paths and purposes.

### I. Test Evidence

Commands, counts, failures, fixes, browser limitations.

### J. Acceptance Checklist

WP08-AC01 through WP08-AC26.

### K. Security and Scope

Authorization, validation, audit, safe data handling and confirmation of no production access.

### L. Next Work Package

Readiness for WP-09 — Receipt Issuance, PDF Versioning & Cancellation.

Do not implement WP-09 automatically.

## 21. EXECUTION

Implement WP-08 financial domain functionality and its authenticated UI in the existing local application.

Preserve all previous migrations, tests and business rules.

Enforce exact allocations, capacity, transaction safety and persistent idempotency.

Respect the approved requirement that actual received payments require receipts; do not falsely certify an incomplete end-to-end workflow.

Test thoroughly against disposable MySQL 8.4.

Return a complete evidence-based report.

Do not start WP-09 automatically.

Do not deploy to production.

Commit/push only if the current project owner's authorization explicitly covers it.

**END OF WP-08**
