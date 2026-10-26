# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-06: Expense Categories, Persons/Suppliers & Vehicles

**Project:** Fitimi Construction Management System & Corporate Website  
**Package:** WP-06  
**Version:** 1.0  
**Date:** 26.10.2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions

**Authorization:** Local implementation, necessary additive migrations, isolated MySQL testing, regression verification and documented defect corrections.

---

## 1. MISSION

Implement three production-quality reference-data modules:

1. Expense Categories
2. Persons / Suppliers
3. Vehicles

These modules will support expense registration in WP-07.

Deliver real, authenticated, database-backed screens and operations.

This is an implementation task, not a planning-only exercise.

The modules must support the management of registered records, validated edits, safe historical retention, concurrency protection and appropriate audit trails.

Do not implement financial expense transactions in this package.

## 2. REPOSITORY BASELINE

Completed work packages reported:

- WP-01: Next.js bootstrap and UI foundation.
- WP-02: Drizzle/MySQL database schema.
- WP-02V: MySQL migration verification.
- WP-03: Authentication and authorization.
- WP-04: Clients Management.
- WP-05: Projects, Contracts & Financial Phases.

The latest report confirms:

- Next.js 16.4.3
- React 19.3.1
- TypeScript 6.0.3
- Drizzle ORM 0.45.4
- Drizzle Kit 0.31.11
- mysql2 3.24.6
- MySQL 8.4.13 for local integration testing
- Migration 0004 for WP-05
- 20 application tables
- 13 existing database triggers
- Existing authentication and business-audit infrastructure

Before coding:

1. Inspect the real Git state, branch and HEAD.
2. Read the current AGENTS.md and repository instructions.
3. Inspect the existing database schema.
4. Review WP-04 and WP-05 implementation patterns.
5. Inspect audit and entity-version utilities.
6. Inspect the shared UI components and navigation.
7. Preserve all uncommitted work.

Do not assume that previous reports describe the current working tree exactly.

Do not rewrite previously applied migrations.

## 3. APPROVED BUSINESS RULES

The relevant approved project requirements are:

- Expenses use predefined categories, persons/suppliers and vehicles where applicable.
- A category may also be created during expense registration in a later package.
- Persons and vehicles are registered entities.
- Linking a person or vehicle to an expense is optional.
- A person linked to an expense represents the supplier or payment recipient.
- Expenses may be associated with a client or project where applicable.
- Historical expense references must remain valid.
- Business users have equal operational rights.
- Changes must be auditable.
- EUR is the only currency for future expense transactions.

These three reference-data modules must not be used to invent additional business functions.

Do not introduce:

- Human resources or employee payroll.
- Vehicle GPS tracking.
- Fuel tracking as a separate module.
- Vehicle maintenance scheduling.
- Purchasing or inventory management.
- Supplier invoices/payables.
- Customer relationship management.
- Unapproved financial reporting.

## 4. DATABASE MODELS

Reuse the existing database tables:

- `expense_categories`
- `persons`
- `vehicles`
- `expenses`
- `audit_events`
- `entity_versions`
- `users`

Inspect actual field definitions before implementing.

Do not create duplicate tables.

Use existing relations and approved schema constraints.

Only add required fields or indexes through additive migrations.

### A. Expense Categories

Support:

- Stable category ID.
- Category name.
- Active/inactive status.
- Relevant timestamps.
- Actor and version metadata when required.

Use the actual database schema's limits.

Categories may be used by multiple expenses.

Historical expense references must remain intact.

### B. Persons / Suppliers

Support existing person information, such as:

- Stable ID.
- Name.
- Existing contact/identification fields where available.
- Active/inactive status.
- Relevant timestamps.
- Actor and version metadata when required.

Within the Expenses workflow, a linked person means the supplier or payment recipient.

Do not add employee-specific fields or assume every supplier is a registered business.

Do not invent mandatory personal identification requirements.

### C. Vehicles

Support existing vehicle information, such as:

- Stable ID.
- Registration/identifier where provided.
- Description.
- Active/inactive status.
- Relevant timestamps.
- Actor and version metadata when required.

Do not require vehicle ownership documents or maintenance information unless already part of the approved schema.

Do not assume vehicle registration numbers must be globally unique without an explicit business or justified data-integrity requirement.

## 5. IMPLEMENTATION PATTERN

Reuse the existing application patterns from Clients and Projects.

For each module implement:

- Authenticated list.
- Bounded search.
- Create.
- Details.
- Edit.
- Active/inactive lifecycle.
- Concurrency protection.
- Actor-attributed audit records.
- Immutable version snapshots where compatible.
- Appropriate error and empty states.

Do not implement physical deletion for records that may be referenced by historical expenses.

### Lifecycle behavior

Prefer logical deactivation over physical deletion.

When a category, person or vehicle becomes inactive:

- Keep its stable identity.
- Preserve historical references.
- Exclude it from future active-record selectors by default.
- Continue allowing authorized historical reads.
- Reject attempts to attach inactive records to newly created expenses in later packages.
- Do not silently reactivate it through an edit.

If approved requirements do not specify reactivation behavior, use a conservative explicit lifecycle operation or leave reactivation outside scope. Do not expose ambiguous functionality.

Document the exact behavior implemented.

## 6. SERVER-SIDE SERVICES

Implement separate domain services or equivalent feature modules for:

### Categories

- List categories.
- Get category.
- Create category.
- Update category.
- Deactivate category.

### Persons / Suppliers

- List persons.
- Get person.
- Create person.
- Update person.
- Deactivate person.

### Vehicles

- List vehicles.
- Get vehicle.
- Create vehicle.
- Update vehicle.
- Deactivate vehicle.

All operations must independently require a valid current user session.

Do not rely only on the authenticated workspace layout.

Use parameterized Drizzle queries.

Use bounded inputs and outputs.

Do not accept protected fields such as actor ID, timestamps, versions or status transitions through unrestricted object assignment.

## 7. VALIDATION RULES

Use the actual database field bounds.

Requirements:

- Trim and safely normalize textual inputs.
- Require meaningful names for categories and persons.
- Validate vehicle data according to the existing model.
- Reject control characters and unsupported field types.
- Validate bounded text lengths.
- Validate existing ID formats.
- Reject invalid lifecycle status transitions.
- Reject updates using stale versions.
- Normalize optional empty fields consistently.
- Prevent arbitrary field injection/mass assignment.

Do not invent country-specific phone, NUI or vehicle-registration validation formats.

### Duplicate handling

Prevent exact duplicate reference categories when a stable normalization rule can safely do so.

However, do not silently merge existing records.

Avoid unjustified uniqueness assumptions for person names or vehicle descriptions.

If duplicates are ambiguous, provide clear validation or document the design choice.

## 8. CONCURRENCY AND ATOMICITY

All create/update/deactivate operations must safely coordinate:

- Business row changes.
- Actor attribution.
- Audit event creation.
- Historical version snapshot creation.

Use database transactions.

If a version field is needed, add it through an appropriate migration.

Updates and deactivations must not silently overwrite one another.

When a write depends on the current active status:

1. Authenticate.
2. Validate input.
3. Open a database transaction.
4. Apply the established user/session lock convention.
5. Lock the affected reference-data record.
6. Recheck its current status and expected version.
7. Save the authorized change.
8. Append audit and history entries.
9. Commit atomically.

On any failure, roll back all business and audit changes.

Keep lock ordering compatible with earlier modules.

Avoid adding unnecessary locks on unrelated project/contract aggregates for independent reference-data edits.

### Future WP-07 requirement

Expense creation must lock and recheck selected category/person/vehicle states according to a documented protocol.

This prevents an expense from being created against a reference record that was concurrently deactivated.

Do not implement expense creation yet.

## 9. AUDIT AND HISTORY

Reuse:

- `audit_events`
- `entity_versions`
- Existing server-side audit conventions

For each supported mutation record:

- Actor.
- Entity type.
- Entity ID.
- Action.
- Relevant before/after values.
- UTC timestamp.
- Correlation/operation identifier.
- Version where applicable.

Do not add sensitive authentication information to audit snapshots.

Avoid inventing historic actors for existing legacy records.

If database snapshot safety checks require expansion, use an explicit field allowlist and test it.

Do not relax credential or nested-data protection.

## 10. USER INTERFACE

Replace the three existing placeholder screens with functioning pages.

Use established Operational Clarity components and design tokens.

Do not redesign unrelated sections.

### Expense Categories screen

Provide:

- Category list.
- Search.
- Create category.
- Edit category.
- Active/inactive distinction.
- Clear action feedback.
- Empty state.
- Appropriate confirmation before deactivation.

### Persons / Suppliers screen

Provide:

- Persons list.
- Search.
- Create person.
- Edit person.
- Contact information where available.
- Active/inactive distinction.
- Historical detail access.

Use the approved meaning of supplier/payment recipient.

Do not add HR terminology.

### Vehicles screen

Provide:

- Vehicle list.
- Search.
- Create vehicle.
- Edit vehicle.
- Registration/description information where available.
- Active/inactive distinction.
- Historical detail access.

### Shared UX requirements

- Responsive layout.
- Accessible labels.
- Visible focus.
- Keyboard-operable controls.
- Proper loading/pending states.
- Field-level validation errors.
- Confirmation for deactivation.
- Clear error and success messages.
- Conflict feedback for stale updates.
- No dead buttons.
- Safe handling of long names/descriptions.

Do not fabricate real suppliers, vehicles or expense totals.

If demonstration data is needed for screenshots/tests, use isolated synthetic fixtures only.

## 11. PREPARATION FOR WP-07

The reference-data modules must provide reusable server-side read functions for future expense forms.

Future WP-07 must be able to retrieve:

- Active expense categories.
- Active persons/suppliers.
- Active vehicles.

Selectors should be bounded and searchable as appropriate.

Historical expense display must still resolve inactive references.

Category creation during expense entry is an approved requirement, but the actual inline-create UX and expense-save transaction belong to WP-07.

Do not implement the expense form or persistence in WP-06.

## 12. AUTHORIZATION AND SECURITY

Apply WP-03 server-side authorization to every page and mutation.

Requirements:

- Anonymous access denied.
- Disabled users denied.
- Equal client operational permissions.
- Protected mutations.
- Existing Origin/Host validation preserved.
- No sensitive details in error responses.
- No direct exposure of SQL or credentials.
- Bounded search and request sizes.
- No unauthorized access through API routes.

Use existing safe error conventions.

Do not create additional business roles.

## 13. DATABASE MIGRATIONS

If required, add a new migration after 0004.

Do not modify migrations 0000–0004.

Preserve their exact hashes and Drizzle migration history.

Test changes on disposable MySQL 8.4.

Verify:

- New version/actor fields where introduced.
- Foreign keys.
- Indexes.
- History constraints.
- Existing 13 triggers.
- Migration repeatability.

Do not apply migrations to a production or non-disposable database.

Do not weaken existing constraints to make tests pass.

## 14. AUTOMATED TESTING

Create unit, MySQL integration and HTTP tests for the three modules.

### Categories

Test:

- Create valid category.
- Reject invalid or blank name.
- Duplicate normalization behavior.
- Search/list.
- Update.
- Deactivate.
- Historical reference preservation.
- Reject stale update.
- Audit and rollback.

### Persons

Test:

- Create valid person.
- Optional contact data.
- Search/list.
- Update.
- Deactivate.
- Duplicate-name safety.
- Historical reference preservation.
- Reject stale update.
- Audit and rollback.

### Vehicles

Test:

- Create valid vehicle.
- Optional fields as allowed by schema.
- Search/list.
- Update.
- Deactivate.
- Historical reference preservation.
- Reject stale update.
- Audit and rollback.

### Concurrency

Test:

- Two simultaneous edits of the same record.
- Edit versus deactivation.
- Audit insertion failure causes complete rollback.
- Invalid/inactive historical references remain readable.
- Future selector queries exclude inactive records.

### Authorization

Test:

- Anonymous reads/mutations denied.
- Active sessions accepted.
- Disabled sessions rejected.
- Origin/Host validation enforced.
- Unknown records handled safely.

### Regression

Preserve:

- WP-03 authentication.
- WP-04 clients.
- WP-05 projects/contracts/phases.
- All previous MySQL migrations.
- All 13 database triggers.
- Public SQ/EN website.
- App navigation.
- TypeScript.
- ESLint.
- Production build.

Browser tests should be executed if tooling is available.

If browser tooling is unavailable, report visual/interaction verification as NOT VERIFIED.

## 15. OUT OF SCOPE

Do not implement:

- Expense transactions.
- Payment transactions.
- Payment allocations.
- Contract changes.
- Receipt generation.
- PDF/Excel reports.
- Project financial summaries.
- Supplier invoices.
- Payroll.
- Inventory.
- Vehicle tracking.
- Maintenance management.
- Production deployment.
- Real client/business data import.

Do not add unrelated dependencies or refactor unrelated modules.

## 16. ACCEPTANCE CRITERIA

**WP06-AC01:** Reuses existing category, person and vehicle tables.

**WP06-AC02:** Authenticated users can create, list, view and update categories.

**WP06-AC03:** Authenticated users can create, list, view and update persons/suppliers.

**WP06-AC04:** Authenticated users can create, list, view and update vehicles.

**WP06-AC05:** Inputs are validated server-side using schema-compatible bounds.

**WP06-AC06:** Search/list operations are bounded and functional.

**WP06-AC07:** Lifecycle deactivation preserves record identities.

**WP06-AC08:** Historical references are not physically deleted.

**WP06-AC09:** Inactive records are excluded from future active selectors by default.

**WP06-AC10:** Concurrent updates cannot silently overwrite each other.

**WP06-AC11:** Mutations and audit/history are committed atomically.

**WP06-AC12:** Audit snapshots are safe and actor-attributed.

**WP06-AC13:** Unauthenticated or disabled users cannot access or modify data.

**WP06-AC14:** Existing UI components and Operational Clarity foundation are reused.

**WP06-AC15:** Desktop/mobile functionality and accessibility are verified where tooling permits.

**WP06-AC16:** MySQL integration tests pass against an isolated MySQL 8.4 environment.

**WP06-AC17:** Existing migrations, triggers and earlier modules remain functional.

**WP06-AC18:** TypeScript, ESLint, build and applicable HTTP tests pass.

**WP06-AC19:** Reusable active-reference selectors are ready for WP-07.

**WP06-AC20:** No expense or payment processing is implemented.

**WP06-AC21:** No production infrastructure or real client data is accessed.

Report PASS, FAIL or NOT VERIFIED for every criterion.

## 17. VERIFICATION COMMANDS

Inspect the actual package scripts first.

Run applicable project commands, including:

- `npm.cmd test`
- `npm.cmd run db:check`
- `npm.cmd run test:db`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run check:routes`

Add focused WP-06 tests.

Execute all database integration tests against disposable MySQL 8.4.

Record exact commands and actual outcomes.

Do not disable tests or safeguards.

## 18. REQUIRED DELIVERY REPORT

Return:

### A. Repository Baseline

- Branch and HEAD.
- Existing modifications.
- Confirmed source documents.

### B. Implemented Features

- Categories.
- Persons/suppliers.
- Vehicles.
- Search and lifecycle behavior.

### C. Database

- Existing tables reused.
- New migrations.
- Exact MySQL execution results.

### D. Atomicity and Audit

- Locking.
- Concurrency handling.
- Actor/history persistence.
- Rollback tests.

### E. Files Changed

- Exact paths and purpose.

### F. Test Results

- Exact commands.
- Test counts.
- Failures and limitations.

### G. Acceptance Checklist

- WP06-AC01 through WP06-AC21.

### H. Security Review

- Authorization.
- Input validation.
- Audit/privacy protections.

### I. Open Issues

- Browser verification.
- Missing visual documents.
- Remaining reference-data decisions.

### J. Next Package

Assess readiness for WP-07 — Expense Transactions.

Do not implement WP-07 automatically.

## 19. EXECUTION

Proceed with actual local WP-06 implementation.

Inspect the repository, reuse existing architecture, build the three reference-data modules, apply any necessary additive migrations to disposable MySQL, execute verification and return the full report.

Fix confirmed WP-06 defects within scope.

Do not begin WP-07 automatically.

Do not deploy to production.

Do not commit or push unless explicitly authorized by the project owner.

**END OF WP-06**
