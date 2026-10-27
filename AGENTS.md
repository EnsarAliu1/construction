# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-07: Expense Transactions — Registration, Corrections, Cancellation & Audit

**Project:** Fitimi Construction Management System & Corporate Website  
**Work Package:** WP-07  
**Version:** 1.0  
**Date:** 27.10.2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Authorization:** Local implementation, additive migrations when necessary, disposable MySQL tests, regression tests and corrections of confirmed WP-07 defects.

---

## 1. MISSION

Implement the actual Expense Transactions (Daljet Financiare) module in the existing authenticated construction-management application.

Users must be able to:

1. Register actual outgoing expenses in EUR.
2. Browse and search recorded expenses.
3. Filter expenses by actual transaction date, category, project and other supported associations.
4. Open an expense's details and history.
5. Correct permitted expense fields with full auditability.
6. Cancel an expense without physically destroying its history.
7. Associate an expense with an optional project, person/supplier and vehicle.
8. Create a new expense category directly from the expense form.
9. Preserve consistency under concurrent operations.
10. Use secure, validated server-side functionality.

This is a real implementation task.

Write executable code and run real tests. Do not stop at a plan.

Do not implement incoming payments, phase allocations, receipts or financial-report exports.

## 2. PROJECT BASELINE

Reported completed and tested:

- WP-01: Next.js and website/application foundation.
- WP-02 and WP-02V: MySQL/Drizzle schema and real MySQL verification.
- WP-03: Authentication, secure sessions and account administration.
- WP-04: Clients.
- WP-05: Projects, contracts and financial phases.
- WP-06: Expense categories, persons/suppliers and vehicles.

Existing technology:

- Next.js 16.4.3
- React 19.3.1
- TypeScript 6.0.3
- Tailwind CSS 4.3.3
- Drizzle ORM 0.45.4
- Drizzle Kit 0.31.11
- mysql2 3.24.6
- MySQL 8.4.13 during disposable local tests

WP-06 reportedly completed migration:

`drizzle/0005_wp06_reference_lifecycle.sql`

WP-06 reported:

- 20 application tables.
- Six migrations.
- 13 original history-protection triggers.
- 175 passing Node test results.
- No browser verification.

Inspect the actual repository state before implementation.

Read AGENTS.md and existing project instructions.

Preserve existing changes, migration history and test coverage.

Do not assume a historical commit remains HEAD.

## 3. SOURCE HIERARCHY

Respect:

1. Latest approved PM/business decisions.
2. Business decisions D-01 through D-14 and approved MVP scope.
3. Codex Master Project Prompt v1.1.
4. Technical Specification and accepted implementation decisions.
5. Approved UX-01 through UX-05 and Wireframes v2.1, where actually available.
6. Operational Clarity and UI Design System, where actually available.
7. Existing repository conventions.

Do not claim to have read missing source documents.

The existing neutral UI foundation may be reused when design references are unavailable.

If a business rule is genuinely ambiguous, adopt the least expansive, history-preserving behavior that does not contradict approved requirements, document the assumption, and escalate only a material unresolved conflict.

## 4. DEFINITIONS AND APPROVED SCOPE

An **expense** is an actual outgoing payment by the company.

It is not:

- An incoming customer payment.
- A future payable or unpaid invoice.
- A payment allocation to a contract phase.
- A physical construction-progress entry.

Currency is EUR.

Amounts must be exact monetary values, using the existing DECIMAL(19,2) representation and validated decimal-string/BigInt-cents conventions.

The actual expense date (`transaction_date`) must be distinct from the record creation timestamp (`created_at`).

An expense may belong to:

- A specific project — optional.
- A category — required when the existing approved schema requires it.
- A person/supplier/payment recipient — optional.
- A vehicle — optional.

The project client is derived from the project relationship. Do not introduce an independent, potentially inconsistent client association unless the approved schema already establishes one.

**Company-wide expenses without a project are valid.**

Never automatically distribute general expenses to projects.

## 5. INSPECT EXISTING DATA MODEL

Reuse the existing tables and relationships:

- `expenses`
- `expense_categories`
- `persons`
- `vehicles`
- `projects`
- `clients`
- `users`
- `audit_events`
- `entity_versions`

Inspect:

- Existing expense columns.
- Status/lifecycle representation.
- Existing nullable relations.
- Date representation.
- Amount constraints.
- Foreign keys and indexes.
- Available actor/version columns.
- Existing history snapshot allowlist.

Do not create a replacement expense table.

Create an additive migration only if necessary to implement the approved expense workflow safely.

Do not rewrite migrations 0000–0005 or invalidate existing migration hashes.

## 6. REQUIRED BACKEND OPERATIONS

### A. Create Expense

Implement authenticated expense registration.

Fields should follow the existing schema and approved scope:

- Amount in EUR.
- Actual transaction date.
- Category.
- Description.
- Optional project.
- Optional person/supplier.
- Optional vehicle.

Reject invalid, unknown or inactive references.

Use a single database transaction for:

- Expense creation.
- Any approved inline category creation.
- Audit event.
- Entity version snapshot.

The server determines the acting user.

No actor ID, status override, timestamps or internal financial state may be accepted from unrestricted form input.

### B. List Expenses

Implement authenticated, bounded database-backed listing.

Support:

- Pagination.
- Search by description and appropriate linked reference labels.
- Actual transaction-date range.
- Category filter.
- Project filter, including company-wide expenses.
- Supplier/person and vehicle filters when useful.
- Active/cancelled status visibility.

Use the real transaction date when filtering by date.

Do not filter financial records by `created_at` when the user selected an expense date range.

Return totals only if computed correctly from filtered, persisted data and clearly labelled.

Do not fabricate financial dashboards.

### C. Expense Details

Display:

- Stable expense ID or safe reference.
- Actual transaction date.
- Amount.
- Description.
- Category.
- Project, when linked.
- Person/supplier, when linked.
- Vehicle, when linked.
- Current status.
- Creation/correction/cancellation metadata.
- Relevant audit history.

Inactive reference entities must remain readable historically.

Do not hide an expense simply because its category, person or vehicle was later deactivated.

### D. Correct Expense

Implement an explicitly confirmed edit workflow.

Allow correction of approved editable fields.

Preserve:

- Stable expense identity.
- Previous values.
- Actor.
- Correction timestamp.
- Audit event.
- Historical entity version.

Use optimistic concurrency/version checks.

Do not silently overwrite another user's correction.

Corrections must be performed atomically with audit/history writes.

Do not generate a receipt or receipt version for expenses.

### E. Cancel Expense

Implement safe logical cancellation, using the existing schema's lifecycle conventions.

Cancellation must:

- Preserve the expense record.
- Preserve its original history.
- Record actor and timestamp.
- Append an audit event and version snapshot.
- Exclude the cancelled expense from future active outgoing totals.
- Keep the expense accessible with an explicit CANCELLED indication.
- Reject stale or otherwise invalid cancellation requests.

Do not physically delete financial expense records.

Do not treat cancellation as a negative balancing transaction unless approved business requirements explicitly demand it.

Do not implement automatic reactivation of cancelled expenses without an approved workflow.

If the existing schema cannot safely represent the cancellation semantics, introduce a minimal additive migration and explain its impact.

## 7. INLINE CATEGORY CREATION

The ability to create a new expense category directly from the expense-entry form is an approved requirement.

Provide:

- Existing active category selector.
- Clear "Create new category" action.
- Category name input.
- Server-side duplicate validation.
- Clear validation/conflict feedback.

**Critical atomicity rule:**

If the user submits a new category as part of a new expense, creation of the category and expense must be one atomic database business operation.

If expense validation or persistence fails, the new category must not remain orphaned as a side effect of that failed expense submission.

Do not call the existing top-level category creation service if it independently begins and commits its own transaction.

Instead, reuse or extract transaction-level primitives that operate inside the expense's existing transaction, maintaining the prior public category service behavior.

Create the category's audit/version entries inside that same transaction.

Respect the existing unique-name constraint and MySQL collation behavior.

If two requests race to create the same category, do not accidentally create duplicates or silently attach a category against the user's intent. Return or handle a well-defined conflict result.

## 8. LOCKING AND REFERENCE VALIDATION

Use a consistent transaction and locking protocol that composes with WP-03 through WP-06.

Recommended order:

1. Authenticate and validate request shape.
2. Start a Drizzle/InnoDB transaction.
3. Shared-lock and recheck the acting user's current session.
4. If a project is linked, lock its client and project in WP-05's established order, rechecking parent relationships and lifecycle eligibility.
5. Lock selected reference rows in this fixed order:
   - Category.
   - Optional person/supplier.
   - Optional vehicle.
6. Recheck reference identity, active status and expected version under the locks.
7. Lock the existing expense row for correction/cancellation, using a documented consistent order compatible with future financial operations.
8. Validate the final expense state.
9. Save expense and audit/version records.
10. Commit.

For update operations where associations change, inspect existing and proposed relationships and define a deterministic lock order that cannot deadlock with reference deactivation or other expense mutations.

Do not lock only the selected new references while ignoring an existing relationship whose lifecycle state matters.

Document the final locking design and test relevant concurrency cases.

Do not acquire independent nested transactions inside the already open business transaction.

A foreign key alone does not prove that a selected category/person/vehicle is active.

Future payment allocation locks remain governed by WP-05; do not implement or interfere with that workflow here.

## 9. EXACT MONEY AND DATE HANDLING

Use:

- DECIMAL(19,2) storage.
- Exact decimal-string parsing and validation.
- BigInt cents or equivalent exact integer representation for monetary calculations.
- Calendar-date semantics for actual transaction dates.
- UTC for system-event timestamps.

Do not use JavaScript floating-point math to decide monetary consistency.

Ensure amounts:

- Have at most two fractional digits.
- Fit storage bounds.
- Satisfy approved positivity constraints.
- Cannot be silently rounded by raw MySQL.
- Cannot be submitted as NaN/Infinity or malformed strings.

Use the existing currency helper patterns where applicable.

Do not invent multi-currency support.

## 10. AUDIT AND VERSION HISTORY

All expense creation, correction and cancellation must be audited.

Use the established:

- `audit_events`
- `entity_versions`

Include:

- Acting user.
- Entity identity.
- Action.
- Relevant before/after values.
- UTC timestamp.
- Version.
- Operation/correlation UUID.

Write audit/history in the same transaction as the expense mutation.

If audit insertion fails, roll back the entire operation.

Do not include:

- Session tokens.
- Password hashes.
- Operator credentials.
- Unrelated personal secrets.

Extend the existing safe snapshot allowlist only for the actual expense fields needed.

Do not disable existing immutability triggers.

Do not rewrite historical snapshots.

## 11. USER INTERFACE

Replace the Expenses placeholder with real working screens.

### Expenses List

Include:

- Title "Daljet Financiare" or terminology consistent with the approved UI.
- Add Expense action.
- Search.
- Transaction-date range.
- Category/project filters.
- Status distinction.
- Real expense list.
- EUR formatting.
- Clear empty and error states.
- Responsive presentation.

### Create Expense

Include:

- Amount.
- Actual expense date.
- Category selector.
- Inline category creation.
- Description.
- Optional project.
- Optional person/supplier.
- Optional vehicle.
- Submit/cancel controls.
- Field-level errors.
- Loading/pending feedback.

Use the existing authenticated active-reference selector services.

Use bounded search for large reference sets, not unbounded dropdown downloads.

### Expense Details

Show all persisted fields and their linked reference labels.

Provide visible correction and cancellation actions when permitted.

Display cancelled entries with clear status.

### Edit Expense

Prefill existing values.

Handle stale versions and reference lifecycle changes.

Do not silently clear optional associations.

Do not replace invalid input with a default monetary amount.

### Cancel Expense

Require deliberate confirmation.

Clearly communicate that cancellation excludes the expense from active financial totals but preserves its history.

Do not render a destructive hard-delete button.

### UX Quality

Reuse Operational Clarity components and tokens.

Provide accessible labels, keyboard focus, error feedback, responsive layouts and appropriate table scrolling.

Do not redesign unrelated website/application modules.

If real browser testing is unavailable, mark visual and interaction verification NOT VERIFIED.

## 12. SECURITY

Use the existing WP-03 server-side authorization helpers for:

- Pages.
- APIs.
- Server Actions.
- Domain services.

Do not rely on workspace layout alone.

Requirements:

- Anonymous access denied.
- Disabled user access denied.
- Existing Origin/Host validation for mutations.
- Bounded request sizes.
- Strict field whitelists.
- Safe IDs and versions.
- Parameterized queries.
- No leaking internal SQL or personal data in errors.
- Safe no-store responses.
- No unauthorized mass assignment.

Preserve equal operational permissions for the five client users.

Do not introduce new business roles.

## 13. BUSINESS BEHAVIOR FOR REPORTING

WP-07 is not the reporting package.

However, persist data so future reports can correctly calculate:

`Active outgoing expenses = SUM(non-cancelled expense amounts)`

Use actual transaction dates for reporting filters.

Keep project-linked and company-wide expenses distinguishable.

Do not automatically assign a company-wide expense to any project.

Do not label income-minus-expenses as statutory accounting profit.

Do not implement individual project report exports.

Do not implement company PDF/Excel reporting yet.

## 14. DATABASE MIGRATIONS

If a new migration is necessary, generate it after migration 0005.

Preserve all historical migration SQL bytes and hashes.

Test in isolated disposable MySQL 8.4.

Verify:

- All previous migrations.
- New expense fields/constraints/indexes.
- All 13 original history guards.
- Migration journal hashes.
- Repeat execution.
- Audit snapshot compatibility.
- Historical reference integrity.

Do not disable production-style integrity constraints merely to pass tests.

Use synthetic test data only.

No production database access is authorized.

## 15. AUTOMATED TESTS

Implement meaningful unit, MySQL integration and HTTP tests.

### Create

Test:

- Valid company-wide expense without a project.
- Valid project-linked expense.
- Optional supplier/person.
- Optional vehicle.
- Active category association.
- Rejection of inactive category/person/vehicle.
- Rejection of archived or otherwise ineligible project relationship.
- Exact amount and date persistence.
- Required-field and bounds validation.

### Inline Category

Test:

- Create category and expense atomically.
- Duplicate category name.
- Category name normalization/collation.
- Rollback when expense insertion fails after category creation.
- Rollback when category audit/history insertion fails.
- Two concurrent category creations with conflicting names.
- No category left behind after a failed combined operation.

### Read/Search

Test:

- List pagination.
- Search.
- Date-range boundaries.
- Category filter.
- Project filter.
- Company-wide expense filter.
- Correct handling of inactive linked references.
- Cancellation visibility.

### Corrections

Test:

- Successful edit with audit.
- Old values retained.
- Stale version rejected.
- Concurrent edit conflict.
- Relationship change to active eligible reference.
- Relationship change to inactive reference rejected.
- Audit failure rolls back correction.

### Cancellation

Test:

- Cancellation retains stable ID/history.
- Correct actor/time/status.
- Cancelled expenses excluded from active totals.
- Already cancelled request handled safely.
- Cancellation and edit race does not corrupt data.
- Forced audit failure rolls back cancellation.

### Security

Test:

- Anonymous reads denied.
- Anonymous writes denied.
- Disabled sessions denied.
- CSRF/Origin protections.
- SQL parameterization/escaped output.
- Sensitive errors redacted.
- Protected fields cannot be mass assigned.

### Regression

Verify:

- Authentication and sessions.
- Clients.
- Projects/contracts/phases.
- Categories/persons/vehicles lifecycle and selectors.
- Six previous migrations.
- All 13 triggers.
- Public SQ/EN website.
- Application navigation.
- TypeScript.
- ESLint.
- Build.
- Route smoke tests.

Use browser testing where available.

Do not claim browser PASS from HTTP-only tests.

## 16. OUT OF SCOPE

Do not implement:

- Incoming payments.
- Allocation of income across contract phases.
- Receipt numbering/versioning/PDFs.
- Financial dashboard.
- Company report PDF/Excel.
- Full business-data export.
- Project financial report export.
- Supplier invoices/payables.
- Payroll.
- Inventory.
- Online payments.
- Banking integrations.
- Production deployment.
- Real business data import.

Avoid adding unnecessary dependencies.

Do not refactor unrelated modules.

## 17. ACCEPTANCE CRITERIA

**WP07-AC01:** Reuses the existing expenses schema and related reference tables.

**WP07-AC02:** Authenticated users can create a company-wide expense.

**WP07-AC03:** Authenticated users can create a project-linked expense.

**WP07-AC04:** Category requiredness and all optional associations follow the approved data model.

**WP07-AC05:** New expense categories can be created inline during expense entry.

**WP07-AC06:** Inline category and expense persistence is atomic.

**WP07-AC07:** Inactive category/person/vehicle references are rejected for new associations.

**WP07-AC08:** Expense creation coordinates safely with reference deactivation.

**WP07-AC09:** Expenses are listed, searchable, filterable and paginated.

**WP07-AC10:** Transaction-date filtering uses the actual expense date.

**WP07-AC11:** Existing expenses can be corrected with version checks.

**WP07-AC12:** Cancelled expenses remain historically accessible.

**WP07-AC13:** Cancelled expenses do not contribute to active outgoing totals.

**WP07-AC14:** Expense changes and audit/version records commit atomically.

**WP07-AC15:** Concurrent corrections/cancellations cannot silently overwrite changes.

**WP07-AC16:** Exact EUR amounts are validated without floating-point errors.

**WP07-AC17:** All pages/APIs/services enforce server-side authorization.

**WP07-AC18:** Historical relationships survive deactivation/cancellation.

**WP07-AC19:** Reuses the established UI foundation and working forms.

**WP07-AC20:** Browser/mobile/accessibility verification is executed where available; otherwise honestly marked NOT VERIFIED.

**WP07-AC21:** MySQL 8.4 integration tests pass.

**WP07-AC22:** Existing migration hashes, triggers and prior module tests remain valid.

**WP07-AC23:** TypeScript, lint, build and HTTP regression checks pass.

**WP07-AC24:** No incoming payments, allocations, receipts or reporting exports are implemented.

**WP07-AC25:** No real client data or production infrastructure is accessed.

For each criterion report PASS, FAIL or NOT VERIFIED with concise evidence.

## 18. VERIFICATION

Inspect the actual package scripts first.

Execute applicable commands including:

- npm.cmd test
- npm.cmd run db:check
- npm.cmd run test:db
- npm.cmd run typecheck
- npm.cmd run lint
- npm.cmd run build
- npm.cmd run check:routes

Add dedicated WP-07 commands if appropriate.

Run the actual migrations and integration tests against disposable MySQL 8.4.

Use a safely isolated Docker container with verified ownership, loopback networking and synthetic credentials.

Do not touch unrelated containers or persistent volumes.

If the database environment is unavailable, report NOT VERIFIED rather than simulating results.

Fix confirmed WP-07 defects before the final report.

## 19. REQUIRED DELIVERY REPORT

### A. Repository Baseline

- Branch and HEAD.
- Existing modifications preserved.
- Source materials actually accessible.

### B. Implementation

- Expense create/list/details/edit/cancel.
- Inline category behavior.
- Reference selectors.
- Search and filtering.

### C. Database

- Reused tables.
- Any additive migration.
- Real migration execution.
- Actual schema/constraints.

### D. Transaction & Concurrency Review

- Lock acquisition order.
- Atomic inline category creation.
- Active-reference rechecks.
- Edit/cancellation races.
- Audit rollback evidence.

### E. File Manifest

- Exact modified/created file paths.

### F. Test Evidence

- Exact commands and results.
- Distinct test counts.
- Relevant failures and corrections.
- Browser verification status.

### G. Acceptance Checklist

- WP07-AC01 through WP07-AC25.

### H. Security Review

- Authentication.
- Authorization.
- CSRF/Origin checks.
- Input validation.
- Safe errors.
- Audit privacy.

### I. Open Issues

- Missing UX/UI sources.
- Browser verification.
- Remaining business or technical constraints.
- Prerequisites for future incoming-payment services.

### J. Scope Confirmation

- No income/payment allocations or receipts.
- No financial-report exports.
- No real data.
- No production deployment.

### K. Next Package

Assess readiness for WP-08 — Incoming Payments & Financial Phase Allocations.

Do not implement WP-08 automatically.

## 20. EXECUTION INSTRUCTION

Implement WP-07 now.

Create real, working Expense Transactions functionality using the existing authenticated Next.js/Drizzle architecture.

Perform all applicable local MySQL, security and regression tests.

Preserve previous migrations and functionality.

Return a complete technical report with real evidence.

Do not stop at a plan.

Do not commit or push unless the project owner's authorization currently covers that action.

Do not deploy.

**END OF WP-07**
