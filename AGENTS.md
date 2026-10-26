# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-05: Construction Projects, Contracts & Financial Phases

**Project:** Fitimi Construction Management System & Corporate Website  
**Package:** WP-05  
**Version:** 1.0  
**Date:** 26.10.2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Authorization:** Local implementation, additive migrations, disposable MySQL testing and necessary defect corrections.

---

## 1. MISSION

Implement a fully working Projects, Contracts and Financial Phases module in the existing authenticated Next.js application.

This package must provide real database-backed workflows for:

1. Creating construction projects linked to clients.
2. Listing, filtering and viewing projects.
3. Editing project information and status.
4. Managing a project's contract and financial phases.
5. Creating and changing phase descriptions and values.
6. Enforcing contract/phase value equality.
7. Preventing phase values from falling below active allocations.
8. Logically deleting eligible phases.
9. Preserving audited version history.
10. Preventing concurrent writes from corrupting business state.

Implement real code and automated tests.

Do not stop at a plan.

Do not implement payment registration, expense recording or receipt generation in this package.

## 2. ESTABLISHED PROJECT BASELINE

Reported completed packages:

- WP-01 — Next.js Bootstrap.
- WP-02 — Database Schema.
- WP-02V — MySQL Integrity Verification.
- WP-03 — Authentication & Authorization.
- WP-04 — Clients Management.

Existing technology:

- Next.js 16.4.3.
- React 19.3.1.
- TypeScript 6.0.3.
- Drizzle ORM 0.45.4.
- Drizzle Kit 0.31.11.
- mysql2 3.24.6.
- MySQL 8.4.13.
- Server-side sessions and authorization.
- Audit events and entity version snapshots.

WP-04 reportedly introduced migration `0003_wp04_clients.sql` and transactional client operations.

Inspect actual repository files and Git state before changing code.

Preserve AGENTS.md, previous migrations and all existing modifications.

Do not assume the last reported commit is still HEAD.

## 3. SOURCE OF TRUTH

Follow:

- Codex Master Project Prompt v1.1.
- Approved business decisions D-01 through D-14.
- Technical Specification and relevant ADRs.
- Approved UX-01 through UX-05.
- UX Wireframes v2.1 Corrections.
- Operational Clarity.
- Visual Foundation and UI Design System.
- Existing repository conventions.

Verify which source documents and image assets are actually accessible.

Do not falsely claim to have inspected unavailable documents.

If visual references are unavailable, reuse the existing interface components and report the visual-alignment limitation.

Financial rules always take priority over demonstration figures in screenshots.

## 4. DATA MODEL

Reuse the existing tables:

- `clients`
- `projects`
- `contracts`
- `contract_phases`
- `payments`
- `payment_allocations`
- `audit_events`
- `entity_versions`
- `users`

Inspect their real field definitions, constraints and relationships.

Do not create competing project or contract tables.

Use additive migrations only where necessary.

The current approved MVP workflow assumes one current contract identity per project. Do not expand into multi-contract support without a business decision.

### Project fields

Support the available approved project information:

- Stable project ID.
- Client relationship.
- Project/site name.
- Location/address information.
- Start date.
- End date, if applicable.
- Status.
- Created/updated timestamps.
- Version and actor metadata where needed.

Approved statuses:

- Active.
- Suspended.
- Completed.

Use the established database enum/string representations.

Do not create invented construction-progress percentages.

### Contract fields

- Stable contract ID.
- Project relationship.
- Contract value in EUR.
- Version.
- Relevant timestamps.
- Historical snapshots.

### Financial phase fields

- Stable phase ID.
- Contract relationship.
- Description/name.
- Financial value in EUR.
- Display order.
- Version.
- Logical deletion metadata.
- Relevant timestamps and actor references.

Phases represent monetary components of a contract.

They do not represent physical percentage completion, workforce scheduling or construction progress.

## 5. APPROVED BUSINESS INVARIANTS

### INV-01 — Contract equality

For every valid saved active contract state:

Contract total equals the sum of all active phase values.

`contract_total = SUM(active_phase_values)`

Logically deleted phases are excluded from this total.

The check is mandatory during initial creation and every contract/phase modification.

### INV-02 — Phase payment capacity

For every active phase:

`SUM(active_payment_allocations) <= phase_value`

Only allocations from active/non-cancelled payments count toward the active paid total.

### INV-03 — Allowed phase reduction

A phase value may be reduced only if:

`new_phase_value >= active_allocated_total`

A reduction exactly to the amount already paid is valid.

### INV-04 — Logical deletion eligibility

A phase may be logically deleted only when it has no active allocations.

Its historical identity and previous references must remain.

Do not physically delete historical phase rows.

### INV-05 — Contract and phases as one business operation

The contract and its phases must be changed together within one atomic transaction.

Do not permit partial saving of a changed contract when the resulting active phase values do not equal the contract total.

### INV-06 — Audited changes

Contract and phase modifications require actor-attributed audit events and historical versions.

Audit data must be committed atomically with business changes.

## 6. PROJECT MANAGEMENT OPERATIONS

Implement authenticated server-side operations for:

### Create Project

- Accept a valid existing active client.
- Recheck the client's current archive status inside the transaction.
- Coordinate with the same client locking/version rules used in WP-04.
- Create project details and an initial contract/phase state in a consistent operation when specified by the form.
- Produce appropriate audit history.
- Reject invalid or archived client references.

Do not modify client archive rules to accommodate invalid project creation.

### List Projects

- Authenticated reads.
- Bounded pagination.
- Search by relevant project/client information.
- Status filtering.
- Client filtering where useful.
- No unbounded database queries.
- Clear empty/loading/error states.

### Project Details

Display:

- Project information.
- Linked client.
- Current status.
- Contract value.
- Active financial phases.
- Current value for each phase.
- Available active paid amount and remaining phase capacity, only when calculated from real records.
- Relevant audited change history.

Since payment registration is not yet implemented, it is acceptable for active paid totals to be zero in a fresh database.

Do not fabricate payments.

### Update Project

Support approved editable project fields and status transitions.

Use version-aware updates to prevent silent overwrite.

Reject updates referring to archived clients or otherwise invalid relationships where relevant.

Audit changes.

### Project Deletion

Do not introduce destructive project deletion.

If an approved and clearly supported project soft-delete workflow already exists, preserve it.

Otherwise leave project deletion outside WP-05 and report the limitation. Do not invent cascade semantics.

## 7. CONTRACT AND PHASE WORKFLOW

Implement a usable combined contract editor.

The user must be able to:

- View current contract value.
- View all active phases.
- Add a phase.
- Edit a phase description.
- Increase a phase value.
- Decrease a phase value within approved limits.
- Reorder phases where the existing data model permits.
- Request logical deletion of an eligible phase.
- Adjust the contract value and several phases in one editing session.
- Save the entire consistent result together.

Do not require saving each intermediate field change separately.

### Combined save contract

The server receives:

- Project/contract identity.
- Expected contract version.
- Proposed total contract value.
- Proposed active phase state.
- Intended new phases.
- Intended phase modifications.
- Intended logical deletions.

Treat this payload as an explicitly validated set of changes, not unrestricted database object assignment.

Validate all identities, ownership and expected versions.

Reject attempts to include phases belonging to another project.

Reject duplicate phase identities in the submitted change set.

Reject unknown, already deleted or otherwise ineligible phase updates.

Calculate totals using exact monetary arithmetic.

Never use JavaScript floating-point comparison as the final financial equality check.

### Phase deletion and contract equality

If a phase without active allocations is logically deleted, its value no longer contributes to the contract total.

The same save operation must adjust the other active phases or the contract value so the equality still holds.

Do not automatically change the contract value behind the user's back.

If the final values do not match, reject the entire save and explain the mismatch.

## 8. ATOMICITY AND CONCURRENCY

This is a critical part of WP-05.

Implement contract/phase changes using an InnoDB transaction.

Use a consistent locking strategy suitable for future payment allocation services.

Recommended approach:

1. Authenticate the current user.
2. Validate the submitted request shape.
3. Start the database transaction.
4. Lock the relevant project/contract aggregate in a deterministic order.
5. Load and verify the expected version.
6. Lock relevant phase rows consistently.
7. Read/recalculate active payment allocations.
8. Validate phase capacity and deletion eligibility.
9. Validate the final contract/phase equality.
10. Persist all changes.
11. Append audit events and entity versions.
12. Commit everything together.

On any validation, audit or database failure, roll back the complete transaction.

Be explicit about how this locking strategy will coordinate with the later payments module.

The future payment service must acquire compatible locks before allocating capacity.

Do not rely on a plain SUM query without sufficient serialization to prevent write skew.

### Concurrent scenarios

Verify:

- Two users editing the same contract.
- Two users changing the same phase.
- Stale expected version.
- Simultaneous client archiving and project creation.
- Concurrent phase changes and relevant allocation writes using synthetic fixtures where appropriate.
- Rollback after a failed audit insertion.

The result must preserve the approved financial invariants.

## 9. HISTORICAL DATA AND VERSIONING

Use the existing audit/version infrastructure.

Record:

- Acting user.
- Target entity.
- Action type.
- Relevant old and new values.
- Timestamp.
- Correlation/operation identifier.
- Contract/phase version.

Do not overwrite historical snapshots.

Do not physically remove financial phase identities.

When phase values change, previously issued receipt documents must remain unchanged.

Do not implement receipt regeneration or payment correction here.

Avoid storing authentication secrets or unrelated sensitive data in snapshots.

If the existing snapshot allowlist requires additions for contract/phase fields, extend it safely and test against the database's historical-data constraints.

## 10. VALIDATION

Implement server-side validation for:

- Project name.
- Client reference.
- Date values and permitted date relationships.
- Approved status values.
- Contract monetary amount.
- Phase monetary values.
- Required phase descriptions.
- Phase ownership.
- Unique submitted phase IDs.
- Contract/phase equality.
- Phase capacity.
- Logical deletion eligibility.
- Expected versions.
- Bounded request sizes and field lengths.

Use the actual schema bounds.

For calendar dates, avoid unintended timezone conversion.

Reject malformed IDs and values.

Do not invent additional financial rules, such as automatically allocating contract value, adjusting phase amounts or allocating general expenses.

### Error semantics

Return safe and actionable business errors for:

- Contract total mismatch.
- Phase capacity exceeded.
- Phase has active allocations.
- Stale contract/phase version.
- Invalid client/project/contract relationship.
- Archived client.
- Invalid dates or statuses.
- Unauthorized access.
- Database unavailable.

Use established application error-handling conventions.

## 11. USER INTERFACE

Replace the current Projects placeholder with actual functioning screens.

### Projects List

Include:

- Project name.
- Client name.
- Status.
- Relevant dates.
- Contract value where available.
- Search and filters.
- Create Project action.
- Responsive layout.
- Clear empty/error states.

### Create Project

Include a working form for project details and a consistent initial contract/phase setup.

The user must not accidentally create an inconsistent contract.

### Project Details

Include:

- Project header and current status.
- Client information with a working link to the client detail.
- Start/end date and location.
- Contract summary.
- Financial phases table/list.
- Edit project action.
- Contract/phase editor access.
- Relevant history.

### Contract & Phase Editor

Include:

- Current contract value.
- Editable phase descriptions and amounts.
- Add phase.
- Remove eligible phase.
- Active paid amount displayed when backed by real data.
- Total active phase values.
- Difference between phase total and contract total.
- Clear validation feedback.
- One explicit Save action.
- Concurrent-edit conflict feedback.

Do not persist intermediate invalid financial states.

Use only real database-backed information.

Do not use decorative but nonfunctional save/delete controls.

### Mobile UX

Use existing Operational Clarity tokens and UI components.

Keep contract/phase editing usable at narrow viewport widths.

Avoid horizontal overflow that prevents access to amount fields or Save controls.

Use accessible labels and focus states.

Do not redesign unrelated modules.

## 12. AUTHORIZATION AND SECURITY

Use WP-03 server-side authentication and authorization helpers.

Each page, Server Action and API must enforce the appropriate guard independently.

Do not trust only the authenticated layout.

Use server-validated input and parameterized Drizzle queries.

Do not accept actor IDs, deleted timestamps or other protected fields from arbitrary client inputs.

Preserve existing Origin/Host validation for mutations.

Avoid leaking SQL errors or internal identifiers to unauthorized users.

Maintain equal operating permissions among client users.

Do not introduce new roles.

## 13. DATABASE CHANGES

Inspect the existing schema first.

Reuse established tables and relationships.

If additional fields, indexes or safe snapshot rules are necessary:

- Create an additive migration.
- Do not rewrite migrations 0000–0003.
- Preserve existing migration hashes.
- Use the project's established migration workflow.
- Execute against disposable MySQL 8.4.
- Re-run migrations to verify expected repeat behavior.
- Confirm all 13 original triggers remain intact.

Pay particular attention to the existing database history guards if contract/phase snapshots are expanded.

No production database is authorized.

## 14. AUTOMATED TESTING

Add unit, database integration and relevant HTTP tests.

### Projects

Test:

- Create a project with an active client.
- Reject archived client.
- Correctly link project to client.
- Update details and status.
- Reject invalid status.
- Handle date validation.
- Search, filter and pagination.
- Concurrent edits.
- Client archiving/project creation race.

### Contracts

Test:

- Create a consistent contract.
- Reject unequal contract/phase totals.
- Increase phase value while updating contract coherently.
- Decrease phase value within allowed capacity.
- Decrease phase value exactly to active paid amount.
- Reject decrease below active allocated amount.
- Reject phase belonging to another contract.
- Reject stale version.
- Roll back contract change when phase/audit persistence fails.

### Phases

Test:

- Add phase and preserve equality.
- Edit phase description.
- Reorder phase.
- Logically delete phase without active allocations.
- Reject deletion with active allocations.
- Preserve historical references.
- Exclude logically deleted phases from active contract total.
- Concurrent writes cannot break the aggregate.

For paid-allocation scenarios, construct synthetic fixture records directly in the disposable test environment without implementing real payment workflow.

Respect foreign keys and existing payment status conventions.

### Security

Test:

- Anonymous access denied.
- Active user access permitted.
- Disabled account rejected.
- Invalid relationships rejected.
- Mutations are server-authorized.
- CSRF/origin checks enforced.
- Errors do not expose private data.

### Regression

Test:

- WP-03 authentication.
- WP-04 Clients CRUD.
- Existing MySQL migration integrity.
- Existing receipt/audit triggers.
- Public SQ/EN website.
- App navigation.
- TypeScript.
- ESLint.
- Production build.

Do not weaken earlier tests to get a passing result.

Browser-based visual and interaction tests are required when a browser is accessible.

If no browser is available, explicitly mark visual/hydration acceptance NOT VERIFIED.

## 15. OUT OF SCOPE

Do not implement:

- Actual payment registration.
- Payment allocation UI or service.
- Payment confirmation.
- Expense entry.
- Receipt/PDF generation.
- Financial reporting services.
- Individual project financial report exports.
- Physical project progress tracking.
- Inventory.
- Labor scheduling.
- Invoicing.
- Online payments.
- Real client data.
- Production deployment.
- Hosting configuration.

Future payment transactions must use the same locking strategy established for phase capacity, but must not be built in this package.

## 16. ACCEPTANCE CRITERIA

**WP05-AC01:** Uses existing project, contract and phase schema.

**WP05-AC02:** Authenticated users can create projects linked to active clients.

**WP05-AC03:** Archived clients cannot receive new projects.

**WP05-AC04:** Project listing, search and filtering work.

**WP05-AC05:** Project details display real records.

**WP05-AC06:** Project edits and status changes work with audit history.

**WP05-AC07:** Contract value equals the sum of active phase values after every successful save.

**WP05-AC08:** Contract and phases are persisted atomically.

**WP05-AC09:** Multiple phase edits can be saved together.

**WP05-AC10:** Reducing a phase below active paid allocations is rejected.

**WP05-AC11:** Reducing a phase to exactly its active paid amount is accepted when the contract remains consistent.

**WP05-AC12:** A phase with active allocations cannot be logically deleted.

**WP05-AC13:** An eligible phase can be logically deleted without losing history.

**WP05-AC14:** Stale/concurrent updates do not silently overwrite data or break invariants.

**WP05-AC15:** Contract/phase modifications generate atomic audited history.

**WP05-AC16:** Authentication and server-side authorization are enforced.

**WP05-AC17:** Mobile/desktop interface follows existing UI foundation.

**WP05-AC18:** Real disposable MySQL integration tests pass.

**WP05-AC19:** Previous migrations, triggers and module tests remain valid.

**WP05-AC20:** TypeScript, lint, build and relevant route tests pass.

**WP05-AC21:** No payment/expense/receipt logic outside scope is implemented.

**WP05-AC22:** No real data or production infrastructure is accessed.

Classify every criterion as PASS, FAIL or NOT VERIFIED.

Do not substitute static checks for database-level evidence.

## 17. VERIFICATION COMMANDS

Inspect the actual package scripts before execution.

Execute applicable commands such as:

- `npm.cmd test`
- `npm.cmd run db:check`
- `npm.cmd run test:db`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run check:routes`

Add focused project/contract tests as appropriate.

Execute migration and integration tests against disposable MySQL 8.4.

Record exact commands, outcomes and test counts.

Do not claim browser interaction was verified without browser execution.

## 18. DELIVERY REPORT

Return:

### A. Repository Baseline

- Branch.
- HEAD.
- Existing modifications.
- Source documents actually accessible.

### B. Implementation Summary

- Project operations.
- Contract/phase editor.
- Validation.
- Authorization.
- History.
- Concurrency.

### C. Database

- Reused tables.
- New migrations.
- Migration results.
- Locking strategy.
- Cross-row invariant handling.

### D. Files Changed

- Exact paths and purpose.

### E. Tests

- Commands executed.
- Unit/integration/HTTP outcomes.
- Browser verification status.

### F. Acceptance

- WP05-AC01 through WP05-AC22.

### G. Security Review

- Session and operation guards.
- Transaction consistency.
- Audit behavior.
- Sensitive data/error handling.

### H. Risks

- Known defects.
- Missing visual references.
- Remaining verification gaps.
- Dependencies for future payment allocation services.

### I. Scope Confirmation

- No actual payment/expense/receipt implementation.
- No real client data.
- No production deployment.

### J. Next Package

Assess readiness for WP-06 — Categories, Persons/Suppliers & Vehicles.

Do not implement WP-06 automatically.

## 19. EXECUTION

Proceed with real WP-05 local implementation.

Inspect the existing code, reuse established patterns, implement projects/contracts/phases, enforce atomic financial invariants, run tests in disposable MySQL, fix confirmed defects and return the full technical report.

Do not stop at a plan.

Do not automatically commit or push unless separately authorized.

**END OF WP-05**
