# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-04: Clients Management — Full CRUD, Validation & Audit

**Project:** Fitimi Construction Management System & Corporate Website  
**Package:** WP-04  
**Version:** 1.0  
**Date:** 26.10.2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions

**Authorization:** Real local implementation, required dependencies, additive migrations, disposable MySQL database testing and local verification.

---

## 1. MISSION

Implement a complete, usable Clients Management module within the existing authenticated Next.js application.

The module must support:

- Listing clients.
- Creating clients.
- Viewing client details.
- Editing clients.
- Searching and filtering.
- Logical deletion with history preservation.
- Server-side validation.
- Authentication and authorization.
- Audit trail.
- Responsive desktop/mobile behavior.
- Automated tests against disposable MySQL 8.4.

This is a real coding task.

Do not return only a plan.

Do not implement construction projects, contracts, payments or expenses in this package.

## 2. CURRENT PROJECT BASELINE

Reported completed packages:

- WP-01: Next.js bootstrap and UI foundation.
- WP-02: MySQL/Drizzle schema foundation.
- WP-02V: MySQL 8.4 migration verification.
- WP-03: Authentication, authorization and account administration.

Technology baseline:

- Next.js 16.4.3.
- React 19.3.1.
- TypeScript 6.0.3.
- Tailwind CSS 4.3.3.
- Drizzle ORM 0.45.4.
- Drizzle Kit 0.31.11.
- mysql2 3.24.6.
- MySQL 8.4.13.
- Argon2id authentication.
- Opaque server-side sessions.

WP-03 introduced:

- Protected `/app` routes.
- `requirePageUser`.
- `requireOperationUser` / `requireSessionUser`.
- Authentication audit infrastructure.
- Database-backed sessions and rate limiting.
- New migration `0002_wp03_authentication.sql`.

Inspect the actual repository before coding.

The reported Git state may have changed. Do not assume any specific HEAD.

Preserve existing user changes, including AGENTS.md and other uncommitted files.

## 3. SOURCE OF TRUTH

Follow:

1. Approved business decisions D-01 through D-14.
2. Codex Master Project Prompt v1.1.
3. Current Technical Specification.
4. Approved UX decisions and Wireframes v2.1, when accessible.
5. Approved Operational Clarity / Visual Foundation / UI Design System, when accessible.
6. Existing repository conventions.

Do not falsely claim to have read unavailable design documents.

If exact visual references are missing, continue using the established UI foundation and report visual alignment as pending.

Do not copy financial values or client identities from screenshots.

## 4. CLIENT DATA MODEL

The system supports two kinds of clients:

**Individual**

- Personal client.
- Name.
- Contact information.
- Address.

**Business**

- Company/business client.
- Name.
- NUI where applicable.
- Contact information.
- Address.

Both may own multiple construction projects in future work packages.

Inspect the existing `clients` schema before implementing.

Reuse its fields and relations.

Do not create a second clients table.

Do not introduce a separate company-management or CRM product.

### Required business rules

- A client has a stable unique database ID.
- A client may exist without a construction project.
- A client may have multiple projects in the future.
- Business NUI is stored when provided or required by confirmed specifications.
- Do not invent Kosovo-specific NUI validation rules.
- Client deletion is logical, not physical.
- Historical references must survive logical deletion.
- Client modifications must be auditable.

Use appropriate database uniqueness rules where approved and justified.

Do not impose global unique names: two different clients may legitimately have the same name.

Do not automatically merge records based on matching names or contact details.

## 5. SCOPE — BACKEND

Implement actual server-side operations for:

### Create Client

- Validate input.
- Require an authenticated user.
- Normalize safe text fields.
- Save using Drizzle.
- Record the corresponding audit event.
- Return a safe result.

### List Clients

- Require authentication.
- Return clients with pagination or bounded result sets.
- Support search by relevant available fields.
- Support filtering by client type.
- Exclude logically deleted clients by default.
- Avoid unbounded database reads.

### Get Client

- Require authentication.
- Retrieve by stable ID.
- Distinguish not found from unauthorized access appropriately.
- Do not reveal private data through public endpoints.

### Update Client

- Require authentication.
- Validate inputs.
- Preserve stable client identity.
- Record old/new values safely.
- Prevent lost updates using an appropriate optimistic concurrency mechanism.

If version fields are not already present, evaluate whether a small additive migration is necessary.

### Logical Delete Client

- Require authentication.
- Mark the client as logically deleted.
- Record actor and timestamp.
- Retain the database identity and history.
- Prevent or safely handle deletion when active related projects exist.

For the final point, use the existing business relationships and conservative behavior. Do not silently cascade deletion to projects.

Do not implement client restoration unless already approved or supported by an existing product decision.

## 6. AUDIT REQUIREMENTS

Every create, update and logical delete must produce the necessary audit record.

For critical changes, persist the business modification and its audit event in the same database transaction.

Include:

- Entity type.
- Entity ID.
- Action.
- Acting user.
- Timestamp.
- Relevant previous/new values.
- Correlation identifier where useful.

Do not store raw session tokens, credentials or password hashes.

Avoid logging unnecessary sensitive client details in application logs.

Use existing audit tables and conventions.

Do not create duplicate audit infrastructure.

## 7. CLIENT USER INTERFACE

Replace the existing Clients placeholder page with a functioning interface.

Implement:

### Clients List

- Clear page title.
- Search input.
- Client type filter.
- Add Client action.
- Responsive client list or table.
- Loading state.
- Empty state.
- Error state.
- Safe pagination or bounded listing.

### Create Client

- Individual/business type selection.
- Appropriate fields for the selected type.
- Required-field validation.
- Clear error messages.
- Submit state.
- Success feedback and navigation.

### Client Details

- Client name and type.
- Available contact information.
- Address.
- NUI where applicable.
- Edit action.
- Appropriate representation of related projects if not yet implemented.

Do not display fake project totals as real data.

### Edit Client

- Prefilled current values.
- Save/cancel behavior.
- Server-side validation.
- Safe handling of concurrent changes.

### Logical Delete

- Deliberate confirmation.
- Appropriate authorization.
- Server-side operation.
- Audit record.
- Clear success/error feedback.

Do not render nonfunctional buttons as though they perform an operation.

## 8. UX/UI REQUIREMENTS

Maintain the existing Operational Clarity foundation.

Use reusable components and tokens already present in the project.

Do not redesign the website or unrelated app sections.

Ensure:

- Desktop usability.
- Mobile usability.
- Accessible labels.
- Visible focus states.
- Keyboard operation.
- Clear errors.
- Useful empty states.
- Long names and addresses do not break layouts.
- Search and filters remain usable on narrow screens.

If approved wireframes are accessible, match their established behavior and styling.

If not, report the limitation instead of inventing design approvals.

## 9. VALIDATION AND SECURITY

All mutations must validate input on the server.

Client-side validation may improve usability, but is not sufficient for data integrity.

Use bounded text lengths and appropriate normalization.

Prevent:

- Unauthorized data access.
- Anonymous client creation.
- Anonymous updates and deletion.
- Unsafe mass assignment.
- Injection vulnerabilities.
- Invalid client types.
- Unexpected field overwrites.
- Lost updates due to concurrent edits.

Use parameterized Drizzle queries.

Do not accept protected server fields such as record ID, created_by or deleted_at directly from ordinary form input.

Maintain CSRF/origin protection using the existing project's established safe patterns.

Business users have equal approved operational permissions.

Do not add new business roles.

## 10. DATABASE AND MIGRATIONS

Reuse the existing `clients` table.

Only introduce an additive versioned migration when necessary.

Do not rewrite migrations 0000, 0001 or 0002.

Preserve the previously verified migration hashes and trigger behavior.

If an additive migration is required:

- Generate it through the project's established migration workflow.
- Test it against fresh disposable MySQL 8.4.
- Verify old migrations remain intact.
- Confirm the resulting schema matches declarations.

Do not connect to production or real client databases.

Do not use MariaDB 10.4 as the authoritative verification engine.

## 11. TESTING

Implement meaningful automated tests.

### Database / Integration

Test:

- Create individual client.
- Create business client.
- Optional NUI.
- Valid and invalid references where relevant.
- Successful updates.
- Failed validation.
- Optimistic concurrency conflict.
- Logical deletion.
- Historical retention.
- Audit entries.
- Atomic rollback when audit persistence fails.
- Active projects or historical-reference protection as applicable.

### Authorization

Test:

- Anonymous access denied.
- Authenticated access permitted.
- Anonymous create/update/delete rejected.
- Disabled user rejected.
- Existing session rules preserved.

### UI / HTTP

Test:

- Clients route protected.
- List renders appropriate state.
- Create form input validation.
- Edit behavior.
- Delete confirmation behavior.
- Search/filter behavior.
- Relevant loading and error states.

Use browser-based interaction testing when available.

If a browser is unavailable, do not report browser verification as PASS.

HTTP tests are useful but do not substitute for full visual/interaction verification.

### Regression

Verify the following areas remain functional:

- Public website SQ/EN.
- Authentication.
- Logout.
- Session protection.
- Existing database migrations.
- Existing 13 triggers.
- App navigation.
- TypeScript.
- ESLint.
- Build.

## 12. OUT OF SCOPE

Do not implement:

- Projects CRUD.
- Contract/phase management.
- Expenses.
- Payments.
- Payment allocations.
- Receipt generation.
- Company financial reports.
- PDF/Excel exports.
- Account administration changes unrelated to Clients.
- New business roles.
- Production deployment.
- Hosting purchases.
- Real client data imports.

Do not add CRM marketing, messaging, lead tracking or unnecessary features.

## 13. VERIFICATION COMMANDS

Inspect the real `package.json` first.

Execute applicable commands including:

- `npm.cmd test`
- `npm.cmd run test:db`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run check:routes`

Also execute new client-specific tests and any applicable database migration checks.

Verify tests against disposable MySQL 8.4.

Record exact executed commands and their results.

Do not weaken previous tests to achieve a passing build.

Fix observed WP-04 defects within scope before completing the report.

## 14. ACCEPTANCE CRITERIA

**WP04-AC01:** Clients module uses the existing Drizzle/MySQL schema.

**WP04-AC02:** Authenticated users can create individual clients.

**WP04-AC03:** Authenticated users can create business clients.

**WP04-AC04:** Required fields and client types are validated server-side.

**WP04-AC05:** Clients list loads from the database.

**WP04-AC06:** Search and type filtering work correctly.

**WP04-AC07:** Client details load by stable ID.

**WP04-AC08:** Existing client information can be edited.

**WP04-AC09:** Concurrent updates cannot silently overwrite each other.

**WP04-AC10:** Logical deletion preserves client identity and history.

**WP04-AC11:** Existing related project references are not destroyed.

**WP04-AC12:** Mutations produce appropriate audit records.

**WP04-AC13:** Business changes and audit records are committed atomically.

**WP04-AC14:** Unauthenticated access and mutations are denied.

**WP04-AC15:** Disabled sessions cannot access the module.

**WP04-AC16:** UI uses the existing shared design foundation.

**WP04-AC17:** Desktop/mobile layout and accessibility are verified where tooling permits.

**WP04-AC18:** MySQL integration tests pass.

**WP04-AC19:** TypeScript, lint, build and relevant regressions pass.

**WP04-AC20:** No real client data or production infrastructure is accessed.

Classify every criterion as PASS, FAIL or NOT VERIFIED.

Provide evidence.

## 15. REQUIRED DELIVERY REPORT

Return:

### A. Repository Baseline

- Branch.
- HEAD.
- Initial working-tree state.
- Existing changes preserved.

### B. Implemented Functionality

- Actual user-facing features.
- Server-side operations.
- Validation rules.
- Audit behavior.
- Concurrency handling.

### C. Database

- Existing structures reused.
- New migrations, if any.
- Migration execution evidence.

### D. Created/Modified Files

- Exact paths and purposes.

### E. Testing

- Commands executed.
- Results.
- Test counts.
- Browser verification status.

### F. Acceptance Checklist

- WP04-AC01 through WP04-AC20.

### G. Security Review

- Server-side authorization.
- Input validation.
- Session checks.
- Audit integrity.

### H. Known Issues

- Defects.
- Missing UX resources.
- Deferred verification.

### I. Scope Confirmation

- No projects/contracts/payments implemented.
- No real client data.
- No production deployment.

### J. Next Work Package

Assess readiness for WP-05 — Construction Projects, Contracts & Phases.

Do not implement WP-05 automatically.

## 16. EXECUTION

Proceed with real WP-04 implementation in the local project.

Inspect existing files, implement the complete Clients module, verify behavior against disposable MySQL 8.4, run regression checks and return the technical report.

Do not stop at a plan.

Do not automatically commit or push unless separately authorized.

**END OF WP-04**
