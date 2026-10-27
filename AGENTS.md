# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-09: Receipt Issuance, Immutable PDF Versioning & Cancellation

**Project:** Fitimi Construction Management System & Corporate Website  
**Package:** WP-09  
**Version:** 1.0  
**Date:** 27.10.2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Authorization:** Local development, necessary dependencies, additive migrations, disposable MySQL and private local file-storage testing.

---

## 1. MISSION

Implement the complete local payment-and-receipt workflow by integrating real receipt creation, A4 PDF generation, immutable document versions, cancellation handling and authorized PDF access with WP-08's existing payment engine.

After this work package, users must be able to:

1. Confirm a received payment and receive a real numbered receipt.
2. Download its actual A4 PDF.
3. Correct the payment and obtain a new version of the same receipt number.
4. Access previous immutable receipt versions.
5. Cancel a payment and clearly identify its receipt as cancelled.
6. Preserve the original payment, allocation and receipt history.
7. Recover safely from interrupted requests or document-storage failures.
8. Avoid duplicate payments, duplicate receipt numbers and inconsistent payment/receipt state.

This is real implementation work.

Do not stop at a plan or mock PDF.

Receipts are operational, non-fiscal documents pending accountant/legal validation.

Do not claim fiscal certification or production release readiness.

## 2. CURRENT BASELINE

Reported WP-08 result:

- 246 passing Node test results.
- MySQL 8.4.13 tested.
- Eight Drizzle migrations, 0000 through 0007.
- 20 application tables.
- 13 original history/receipt triggers.
- Exact EUR allocation arithmetic.
- Persistent idempotency.
- Server-authorized operation-status lookup.
- Working payment registration/correction/cancellation engines.
- Final receipt-dependent operations gated.
- An existing trusted `ReceiptBoundary` integration interface.

Before changes:

- Inspect actual Git branch, HEAD and working tree.
- Read AGENTS.md and all applicable repository instructions.
- Preserve user changes.
- Inspect WP-08 services and receipt integration types.
- Inspect actual receipt tables, counters, statuses, constraints and triggers.
- Inspect audit, versioning, storage and HTTP authorization conventions.
- Inspect available reports and design materials.
- Preserve migrations 0000–0007 exactly.

Do not assume the repository is unchanged.

Follow current owner instructions about README, commits and GitHub.

Do not overwrite unavailable approved specifications with assumptions.

## 3. NON-NEGOTIABLE BUSINESS RULES

Follow D-01 through D-14, especially:

**D-03:** Receipt numbers are unique company-wide.

**D-04:** Financial views use the latest valid corrected state, while retaining complete history.

**D-09:** A correction keeps the same receipt number, generates a new immutable document version and preserves old PDFs.

**D-13:** Payment correction creates a new receipt version; cancellation changes receipt status while retaining its identity and versions.

**D-14:** Cancelled receipts remain accessible and visibly marked cancelled; cancelled payments are excluded from active income and allocations.

Additional requirements:

- Every finalized actual received payment must have a corresponding valid receipt.
- PDF format: A4.
- Currency: EUR.
- One receipt identity per payment.
- Sequential company-wide receipt numbering.
- Never reuse an issued/exposed receipt number.
- Receipt versions must be immutable.
- A payment correction must not leave the current receipt out of sync.
- Financial phase allocations remain governed by WP-08.
- Receipts are not asserted to be legally fiscal documents.

## 4. IMPORTANT SOURCE AND ACCOUNTING LIMITATIONS

The final receipt template, tax/accounting wording and exact numbering format remain subject to accountant/PM validation.

Do not invent:

- Tax registration information.
- Company address.
- Tax rate or VAT treatment.
- Fiscal device number.
- Legal certification statement.
- Official accounting approval.
- Real customer information.

For local development, implement a clearly identified, configurable NON-FISCAL operational receipt.

Use actual persisted payment, client and project information.

For missing real company information, use explicit configuration requirements or clearly marked development-only placeholders.

Do not embed imaginary company identity information into official-looking documents.

Use a deterministic, human-readable company-wide numbering policy for development, backed by a transactional database counter. Keep formatting separate from the counter identity so the exact accountant-approved format can be adopted later without renumbering already issued documents.

Document that numbering format and operational receipt layout remain release prerequisites, not approved fiscal policy.

## 5. ARCHITECTURE — REUSE WP-08

Inspect the existing trusted server-side interface:

`ReceiptBoundary { mode: "wp09", apply(tx, context) }`

The callback receives:

- Existing `PaymentTx`.
- Action: confirm, correct or cancel.
- Acting user.
- Correlation/operation ID.
- Payment before/after state.
- Allocation state, including historical allocations.
- Current relevant payment and contract information.

Integrate receipt functionality through this interface.

Do not:

- Duplicate payment registration.
- Create a second payment service.
- Start a new database transaction inside the callback.
- Commit the payment independently of receipt metadata.
- Accept a test receipt adapter from client input.
- Expose an API switch that disables receipt enforcement.

The real production-facing payment routes must use the trusted WP-09 integration.

The test-only WP-08 boundary must remain unavailable to production-facing routes.

## 6. RECEIPT IDENTITY AND NUMBERING

Reuse:

- `payment_receipts`
- `receipt_versions`
- `receipt_counters`

Inspect actual schema before designing changes.

For first-time payment confirmation:

1. Acquire locks according to WP-08.
2. Verify payment/allocations and idempotency.
3. Acquire the company-wide receipt counter only after required payment/aggregate locks.
4. Reserve or assign a unique company-wide number under a documented safe policy.
5. Create the receipt identity and first immutable version.
6. Ensure PDF bytes are durably available before acknowledging successful issuance.
7. Finish the payment/receipt transaction consistently.

Concurrency requirements:

- Two payments cannot receive the same number.
- Same idempotent operation cannot issue two receipt identities.
- A correction never receives a new receipt number.
- Cancellation never reassigns or reuses a number.
- An issued/exposed number must never be reused.
- Failed or uncertain number allocation must have an explicitly documented policy.

Do not claim gapless legal sequencing unless the approved accounting process establishes that requirement.

If sequence gaps can occur after failures, preserve an internal explanation/audit mechanism and flag accountant validation as outstanding.

## 7. IMMUTABLE RECEIPT VERSIONS

Reuse `receipt_versions`.

For each issued document version preserve:

- Receipt identity and number.
- Integer document version.
- Relevant payment identity/version.
- Project and client information.
- Payment amount and method.
- Actual payment transaction date.
- Financial allocation representation, where appropriate.
- Creation/issuance timestamp.
- Acting user.
- Content snapshot.
- Private storage reference.
- PDF SHA-256 checksum.
- Historical version metadata.

Use the actual schema and add only necessary fields.

Do not update or delete an existing issued receipt-version row.

Do not overwrite its existing PDF file.

A correction must append version N+1 and preserve every earlier version.

The current-version lookup must be consistent with WP-08's receipt verification and the chosen receipt identity model.

Use the correct document version in reads/downloads.

## 8. PDF RENDERING

Implement actual A4 PDF generation.

Use a maintained Node.js-compatible PDF library suitable for the current Next.js server runtime.

Record exact dependency versions.

Generate real PDF bytes with:

- Clear company/receipt header.
- Explicit NON-FISCAL / operational document designation appropriate to a development-stage receipt.
- Receipt number.
- Document version.
- Issuance date/time.
- Linked client.
- Project/site.
- Received amount in EUR.
- Cash or bank method.
- Actual transaction date.
- Appropriate phase allocation summary if included in the receipt design.
- Correction/version identification where relevant.
- Status where appropriate.

Use true company information only when configured/available.

Never invent company legal details.

Use an appropriate font that supports Albanian characters and avoid broken glyphs.

Verify:

- Actual PDF format and magic bytes.
- A4 page dimensions.
- Text is readable.
- Long names and content do not overflow the page.
- All required receipt fields are present.
- Checksum matches actual bytes.
- File is retrievable after issuance.

Do not substitute a static HTML preview for an issued PDF.

Do not add a watermark that could be mistaken for government fiscal certification.

## 9. PRIVATE DOCUMENT STORAGE

Use a storage abstraction that can support:

- Local private document storage for development/testing.
- Later production storage chosen after hosting proof of concept.
- Immutable version paths/keys.
- Private authorized downloads.
- Existence and checksum validation.
- Staging, finalization and cleanup.
- Failure recovery.

For WP-09, implement a safe local private storage adapter.

Storage must be outside public website assets.

Do not put receipt PDFs under `/public` or any publicly accessible static path.

Use non-guessable or opaque storage keys where appropriate.

Never trust arbitrary user-provided filesystem paths.

Avoid path traversal and overwrite vulnerabilities.

Document the configured private-storage directory and file permissions.

Do not choose or purchase production storage infrastructure.

## 10. DATABASE + FILE STORAGE CONSISTENCY

**This is a critical acceptance requirement.**

MySQL transactions cannot automatically roll back filesystem writes.

Implement a recoverable protocol that accounts for this.

The protocol must:

1. Generate and validate actual PDF content.
2. Stage it privately using a unique immutable key.
3. Make the document durable and retrievable through a safe finalization step.
4. Write the receipt metadata and checksum in the coordinated payment transaction.
5. Ensure a successful payment confirmation is never acknowledged without a durable corresponding PDF.
6. Handle database rollback after file creation.
7. Handle file failure before database commit.
8. Handle process interruption between file creation and commit.
9. Detect and safely clean up orphaned task-owned staged files.
10. Never delete an issued historical document during cleanup.

Choose and document the precise ordering for file preparation, immutable finalization and database commit.

If using a final-file-before-DB-commit protocol, orphan files after rollback must be recoverable and safely garbage-collected.

If using any other staging/finalization scheme, prove that a committed payment cannot become visible as fully issued while its PDF is missing.

Do not mark a receipt current or issued merely because a metadata row exists.

Do not treat a filesystem operation as though it were part of the SQL transaction.

Add deterministic failure-injection tests for every important interruption boundary.

Use safe recovery procedures with strong ownership checks.

## 11. RECEIPT CORRECTIONS

When an approved payment correction is confirmed:

1. Authenticate and validate the new payment and allocation state.
2. Enforce existing phase capacity and exact allocation rules.
3. Lock and version-check the payment.
4. Preserve receipt identity and number.
5. Render a new PDF from the corrected state.
6. Persist immutable version N+1 and its checksum.
7. Preserve all older version rows and PDFs.
8. Set the new version as current only when its file is durably available.
9. Commit payment, allocations, audit, idempotency state where applicable, and receipt metadata consistently.

Never modify an earlier PDF in place.

A failed PDF operation must not leave the payment changed without the corresponding current receipt version.

Do not invent a different receipt number for a correction.

Test repeated corrections with multiple versions.

## 12. RECEIPT AND PAYMENT CANCELLATION

When a payment is cancelled:

- Preserve payment and allocation identities.
- Preserve the receipt identity and number.
- Preserve every previously issued PDF version.
- Mark the receipt `void`/cancelled using the existing approved schema semantics.
- Record cancellation actor, time and reason.
- Keep the receipt accessible historically.
- Release active phase capacity through the WP-08 payment cancellation rules.
- Exclude cancelled payment from current income totals.
- Append audit and version history.

**Do not rewrite an immutable issued PDF merely to add a CANCELLED mark.**

Instead, render the cancelled status prominently in the current receipt details/download interface and, if the approved document workflow requires a separately issued cancellation document, implement that only as a distinct immutable artifact after confirming its intended semantics.

The user must not be able to mistake a cancelled receipt for a currently valid one.

Use explicit cancelled-status metadata and authorized UI indicators.

If a historical PDF itself cannot change, the download interface must clearly communicate that it is a historical, cancelled receipt document.

Do not invent fiscal voiding procedures.

## 13. PAYMENT UI INTEGRATION

Enable the existing gated payment controls only after the complete receipt integration is working.

Implement:

- Actual Confirm Payment action.
- Persistent idempotency key across uncertain submission outcomes.
- Operation-status lookup/recovery.
- Successful payment details with receipt number and working PDF download.
- Version-aware correction action.
- Receipt-version history view.
- Version-specific PDF download.
- Confirmed cancellation workflow.
- Clearly marked cancelled receipt state.
- Useful error, conflict and retry feedback.

Do not display success until durable document issuance is confirmed.

If finalization fails, the user must receive a safe error without falsely reporting payment success.

Avoid generating a second payment on a repeat click or network retry.

Use the current Operational Clarity UI foundation.

Do not redesign unrelated modules.

## 14. AUTHORIZATION

Every receipt read and download must require a live authenticated session.

Use WP-03's established guards.

Do not rely solely on the private app layout.

Downloads must:

- Authenticate.
- Validate receipt/version identifiers.
- Verify access to the requested receipt.
- Resolve storage keys server-side.
- Prevent directory traversal.
- Return appropriate private/no-store/cache-control headers.
- Avoid revealing filesystem paths.
- Stream or return the actual PDF.

Never expose raw storage credentials or unrestricted document URLs.

Keep the current model of equal business-user permissions.

Do not invent accountant/manager roles.

## 15. AUDIT AND HISTORY

Receipt issuance, correction and cancellation must be auditable.

Reuse:

- `audit_events`
- `entity_versions`
- Existing immutable history triggers.

Record:

- Actor.
- Receipt identity.
- Receipt number.
- Version.
- Payment identity/version.
- Action.
- UTC timestamp.
- Relevant before/after status.
- Storage/checksum metadata as appropriate.
- Shared correlation UUID.

Never store:

- Password hashes.
- Session tokens.
- Operator keys.
- Raw credentials.

Audit, financial mutation and receipt metadata must be coordinated in the existing SQL transaction.

PDF byte storage requires the separate recovery strategy described above.

## 16. FAILURE SCENARIOS TO HANDLE

Implement real tests for:

- PDF rendering failure.
- Storage directory unavailable.
- Partial file write.
- Failure before final file rename/finalization.
- Failure after durable file creation but before database commit.
- Database audit insertion failure.
- Database commit failure.
- Interrupted response after successful commit.
- Concurrent confirmations requesting new numbers.
- Exact idempotent retry.
- Same idempotency key with different payload.
- Concurrent corrections.
- Correction versus cancellation.
- Attempt to overwrite issued PDF bytes.
- Missing PDF during a download.
- Corrupted PDF/checksum mismatch.
- Failed cleanup/recovery path.
- Existing issued receipt with historical version.
- Cancellation while retaining old PDFs.

Never use synthetic success metadata as proof that real storage worked.

## 17. DATABASE AND MIGRATIONS

Inspect actual receipt schema first.

Add an additive migration after 0007 only if needed.

Preserve all existing migration SQL files and hashes.

Do not rewrite earlier receipt triggers.

Verify:

- Company-wide receipt-number uniqueness.
- Receipt/payment identity uniqueness.
- Version uniqueness per receipt.
- Historical version immutability.
- Appropriate receipt statuses.
- Counter concurrency.
- Audit integrity.
- Existing allocation constraints.
- All 13 original triggers.

Test against actual disposable MySQL 8.4.

Do not modify production databases.

## 18. AUTOMATED TESTS

### Issuance

- First payment generates actual numbered receipt and PDF.
- Payment and allocations are correct.
- PDF contains correct payment/receipt values.
- PDF is stored privately.
- Checksum matches.
- Receipt is downloadable only by an authorized user.

### Numbering

- Unique numbers under concurrent issuance.
- Company-wide scope.
- No number reuse.
- Same idempotent request returns original receipt.
- Failure handling and gaps documented.

### Corrections

- Same number retained.
- Version increments.
- Old PDF remains byte-identical.
- New PDF reflects corrected data.
- Current version is correct.
- Audit/version history survives.
- Failure rolls back financial state safely.

### Cancellation

- Payment/receipt status consistent.
- Cancellation visible.
- Old versions still available.
- Active income and phase capacity updated.
- Repeated cancellation rejected or handled safely.
- No fiscal certification claim.

### Storage and Recovery

- Private download authorization.
- File-system failure rollback behavior.
- Orphan staging cleanup.
- Corruption detection.
- Missing-document behavior.
- No deletion of issued files.
- Interrupted request replay.

### Regression

- Existing payment exactness/capacity and concurrency.
- WP-05 contract/phase locking.
- WP-07 expenses.
- WP-06 references.
- WP-04 clients.
- WP-03 authentication.
- Earlier migration hashes.
- All original receipt/audit triggers.
- Public bilingual website.
- TypeScript.
- ESLint.
- Build and route smoke tests.

Run browser-based visual and interaction tests when an actual browser is available.

If not, explicitly report NOT VERIFIED.

Do not claim PDF rendering was visually reviewed unless PDF pages were actually inspected.

## 19. ACCEPTANCE CRITERIA

**WP09-AC01:** The real WP-08 ReceiptBoundary is integrated.

**WP09-AC02:** Confirmed payment creates one valid company-wide numbered receipt.

**WP09-AC03:** Receipt number uniqueness is enforced under concurrent confirmations.

**WP09-AC04:** Actual A4 PDF is generated with the required operational information.

**WP09-AC05:** PDF bytes are durably stored in a private location.

**WP09-AC06:** Receipt download requires authenticated authorization.

**WP09-AC07:** Receipt PDF checksum and storage integrity are verified.

**WP09-AC08:** Correcting a payment retains the receipt number and appends version N+1.

**WP09-AC09:** Previous receipt PDFs remain immutable and accessible.

**WP09-AC10:** A failed correction does not create mismatched current payment/receipt state.

**WP09-AC11:** Cancellation preserves identities/history and marks receipt cancelled.

**WP09-AC12:** Cancelled payment is excluded from active received totals/capacity.

**WP09-AC13:** Receipt audit/history is actor-attributed and append-only.

**WP09-AC14:** Payment and receipt metadata are transactionally coordinated.

**WP09-AC15:** File/SQL failure boundaries have tested recovery behavior.

**WP09-AC16:** Idempotent confirmation/retry does not create duplicate payment or receipt.

**WP09-AC17:** Interrupted HTTP responses are safely recoverable through operation status.

**WP09-AC18:** Existing payment capacity and concurrent-writer invariants remain valid.

**WP09-AC19:** No speculative receipt PDF/number is represented as issued.

**WP09-AC20:** Fiscal/accountant validation is explicitly outstanding.

**WP09-AC21:** Previous migrations, original triggers and earlier modules pass regressions.

**WP09-AC22:** Real disposable MySQL 8.4 integration tests pass.

**WP09-AC23:** PDF rendering/storage/download are exercised with actual bytes, not mocks only.

**WP09-AC24:** TypeScript, ESLint, build and HTTP checks pass.

**WP09-AC25:** Desktop/mobile/browser interaction is verified when available; otherwise NOT VERIFIED.

**WP09-AC26:** No real client data or production infrastructure is accessed.

Classify each as PASS, FAIL or NOT VERIFIED.

A passing unit test with a fake storage adapter is not sufficient for document-durability acceptance.

## 20. VERIFICATION

Inspect package.json first.

Execute applicable:

- `npm.cmd test`
- `npm.cmd run db:check`
- `npm.cmd run db:migrate`
- `npm.cmd run test:db`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run check:routes`

Add targeted receipt/PDF/storage integration and authenticated HTTP tests.

Use:

- Disposable MySQL 8.4.
- Task-owned private temporary file storage.
- Synthetic client/project/payment data.
- Real generated PDF bytes.

Inspect PDF format, page dimensions, content and checksum.

Report actual execution evidence.

Do not disable prior checks to obtain passing status.

Fix confirmed WP-09 defects within scope.

## 21. OUT OF SCOPE

Do not implement:

- Fiscalization or certified tax receipts.
- VAT/tax calculation policy not approved by accountant.
- Online payment integration.
- Bank integration.
- Company financial report PDF/Excel.
- Full business-data export.
- Individual project financial report export.
- Payroll.
- Inventory.
- Scheduling.
- Production storage infrastructure.
- Hosting purchase.
- Production deployment.
- Real client information import.

Do not invent legal accounting validity.

## 22. REQUIRED DELIVERY REPORT

### A. Repository Baseline

Branch, HEAD, existing modifications and actual source availability.

### B. Receipt Architecture

ReceiptBoundary implementation, numbering and immutable version model.

### C. Durable Storage Protocol

File preparation, persistence, database commit, recovery and cleanup.

### D. Implemented Workflows

Issue, correct, cancel, download and retry.

### E. Database & Migrations

Actual SQL migrations, constraints, hashes and real MySQL results.

### F. Files Changed

Exact paths and purposes.

### G. Test Evidence

Commands, counts, actual PDFs tested, failure injection and fixes.

### H. Acceptance Checklist

WP09-AC01 through WP09-AC26.

### I. Security Review

Downloads, file permissions, session guards, CSRF, origin protection and secrets.

### J. Remaining Risks

Accounting validation, numbering policy, production storage/hosting, browser QA.

### K. Next Work Package

Readiness for WP-10 — Dashboard, Company Financial Reports & Full Data Export.

Do not implement WP-10 automatically.

## 23. EXECUTION

Implement WP-09 now.

Integrate real receipt issuance with the existing payment service.

Generate actual immutable A4 PDF documents.

Implement safe private storage, numbering, versioning, authorized downloads, correction and cancellation.

Test real database and file-storage failure scenarios.

Preserve all previous financial invariants, migration history and authorization.

Do not stop at a plan.

Do not deploy.

Commit/push only within the project owner's currently valid authorization.

**END OF WP-09**
