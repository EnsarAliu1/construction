# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-10: Financial Dashboard, Company Reports & Full Data Export

**Project:** Fitimi Construction Management System & Corporate Website  
**Work Package:** WP-10  
**Version:** 1.0  
**Date:** 27 October 2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Authorization:** Local implementation, justified dependencies, additive migrations, isolated MySQL 8.4 testing, PDF/XLSX/CSV generation and regression verification.

---

## 1. MISSION

Implement real financial visibility and data portability on top of the existing database-backed modules.

Deliver:

1. A functional company dashboard.
2. Company-wide financial summaries.
3. On-screen financial summaries for individual projects.
4. Company-wide financial reports with PDF and Excel export.
5. Filterable financial reporting by approved dimensions.
6. Complete customer/business data export, including history and audit records.
7. Secure authorization, exact money calculations and consistent historical accounting of current active business states.
8. Meaningful real MySQL, document and HTTP tests.

This is real implementation work, not planning only.

Do not fabricate financial data or claim fiscal/accounting certification.

## 2. VERIFIED REPORTED BASELINE

Previous work packages WP-01 through WP-09 have been implemented locally.

WP-09 reports:

- 275 distinct automated test results passing.
- MySQL 8.4.13.
- Nine migrations, numbered 0000–0008.
- 20 application tables.
- 13 original integrity/history triggers.
- Receipt PDFs rendered with PDFKit 0.20.2.
- Immutable receipt PDF versions stored privately.
- Working payment confirmation, correction and cancellation.
- Existing exact monetary arithmetic, idempotency and audit.
- Browser visual/interaction verification NOT VERIFIED.

Before coding:

- Inspect actual branch, HEAD and working tree.
- Read AGENTS.md and applicable repository instructions.
- Preserve owner changes and existing manual test environments.
- Review every relevant existing service, database query, schema and migration.
- Read WP-05, WP-07, WP-08 and WP-09 reports and existing test patterns.
- Verify which approved source/design materials are actually accessible.
- Do not assume missing Master Prompt or wireframes have been inspected.
- Do not modify README.md if the owner's current instructions prohibit it.
- Follow current Git commit/push instructions; never deploy.

Do not rewrite earlier migrations.

## 3. APPROVED BUSINESS SCOPE

The financial system records:

- Incoming payments linked to projects and contract phases.
- Actual expenses that may be project-linked or company-wide.
- Project contract totals and phase values.
- Historical corrections, cancellations and audit entries.
- Immutable receipt document versions.

Only EUR is supported.

Financial difference is calculated as:

`Active received income - Active recorded expenses`

It may be labeled "Diferenca hyrje–dalje" or an equivalent approved operational term.

**It is NOT statutory accounting profit.**

Never label it legal/accounting profit, taxable income or an accountant-certified balance.

### Reporting limits

The company-level financial report can be exported to:

- PDF.
- XLSX.

Individual project financial summaries are available **on screen only**.

**Do not provide project-specific financial report PDF or XLSX exports in the MVP.**

The complete customer data export is a separate data-portability feature and may contain project data in CSV/XLSX and appropriate PDF/document form, including audit/history, as already approved. It must not be presented as an individual project financial report.

## 4. FINANCIAL DEFINITIONS

### Active income

Include only qualifying payments whose current status is `received`.

Use the latest corrected payment state.

Exclude cancelled payments from active income.

For project and phase breakdowns, use only current non-retired allocations belonging to qualifying received payments.

Do not add historical allocation versions as though they were new money.

### Active expenses

Include only qualifying expenses whose current status is `recorded`.

Use the latest corrected expense state.

Exclude cancelled expenses from active outgoing totals.

### Company-wide expenses

A recorded expense without a project contributes to the company total, but not to an individual project's costs.

Do not distribute company-wide expenses across projects automatically.

### Contract value

Use current active contract and phase state according to the existing business rules.

Clearly distinguish contract value from actual cash received.

Unpaid contract balance is not actual cash income.

### Actual transaction dates

Date-range filters for payments and expenses must use their actual transaction dates, not creation timestamps or audit timestamps.

### Historical audit

Audit records and immutable snapshots show what changed.

They must not be summed as additional income or additional expense.

Current operational reports reflect the latest active state, while all history remains accessible through the appropriate audit/export functionality.

## 5. FINANCIAL QUERY ARCHITECTURE

Build reusable server-only reporting services.

Do not copy financial formulas independently into multiple UI components or document generators.

Use a single shared definition of eligible payment, allocation and expense states.

Prefer database-side aggregates or bounded, consistent queries as appropriate.

All monetary calculation paths must preserve DECIMAL(19,2) precision.

Use decimal strings, BigInt cents or an equivalent exact decimal representation.

Do not convert financial DECIMAL values to JavaScript floating-point numbers for summation or equality.

### Read consistency

Dashboard cards, report totals and exported detail rows must not disagree because different queries see different transaction snapshots.

Use an appropriate consistent MySQL read transaction or documented snapshot/materialization strategy.

Do not hold long-lived database transactions open while generating potentially slow PDF or XLSX bytes.

If a full export requires materialization, establish a consistent, bounded snapshot and document the memory/storage tradeoff.

Report-generation filters and totals must derive from the same snapshot and eligibility rules.

## 6. COMPANY DASHBOARD

Replace the placeholder dashboard with real data.

Include appropriate high-level metrics:

- Current total contract value.
- Total active received income.
- Total active recorded expenses.
- Operational income-minus-expense difference.
- Outstanding contract amount where its calculation is unambiguous.
- Active project count.
- Relevant financial and project-status breakdowns.
- Recent actual payments and expenses where useful.

Never equate the contract's unpaid portion with guaranteed future cash collection.

Provide meaningful loading, empty, zero-data and failure states.

Visual charts may be included only when based on real values and clearly labeled.

No fake KPI trends, growth percentages or invented comparisons.

For filters that mix different financial concepts, label the calculation scope precisely.

## 7. PROJECT FINANCIAL SUMMARIES

Provide on-screen summaries in the existing project details interface, including:

- Current contract value.
- Active received payments for that project.
- Active recorded expenses directly linked to that project.
- Operational difference between those two amounts.
- Phase values.
- Phase paid totals.
- Remaining phase capacity.
- Contract remaining amount according to approved interpretation.

Preserve WP-05's exact aggregate and phase-capacity semantics.

A company-wide expense must not appear inside a project expense total.

Do not duplicate business logic.

**Do not add project financial PDF/XLSX buttons or endpoints.**

Avoid showing a financial summary for invalid/historically inconsistent records as if it were verified. Fail safely or label any detected inconsistency.

## 8. COMPANY FINANCIAL REPORT

Implement authenticated company-wide reporting.

Support:

- Start date.
- End date.
- Cash/bank payment method where applicable.
- Expense category filter where useful.
- Project dimension in company-level breakdowns where appropriate.
- Clear inclusion/exclusion of cancelled records.
- Total active income.
- Total active expenses.
- Operational difference.
- Appropriate payment and expense detail sections.
- Company-wide vs project-linked expense distinction.

The report must cover the company as a whole, including qualifying records with or without a linked project.

If a project selection is offered as an analytical filter, it must not silently become a separately generated "individual project financial report." Preserve the approved company-report-only export policy.

Show a preview or accurate report summary before export.

Use meaningful headings and date-range labels.

For any historical comparison, clearly distinguish transaction-date filtering from "state as of date" reconstruction. Do not invent full point-in-time accounting if it has not been approved.

## 9. PDF COMPANY REPORT EXPORT

Generate a real company-level financial report PDF.

Requirements:

- Readable A4 or appropriate documented report page format.
- Company identity only from real/configured data.
- Explicit report creation timestamp.
- Selected report period.
- EUR formatting.
- Exact income/expense/difference totals.
- Clear section headings and tables.
- Correct handling of long content and pagination.
- Albanian character rendering.
- No clipping, overflow or blank trailing pages.
- Non-fiscal/operational report wording where needed.
- No unsupported official tax/accounting assertions.

Reuse the installed PDF tooling where appropriate.

Do not modify receipt rendering/versioning behavior unnecessarily.

A generated financial report is not itself a numbered payment receipt.

Document export authorization must be enforced server-side.

## 10. XLSX COMPANY REPORT EXPORT

Generate an actual valid XLSX workbook.

Include:

- Summary sheet.
- Incoming payments detail sheet.
- Expenses detail sheet.
- Relevant company-level breakdowns.
- Report filters and generation metadata.
- Accurate date and monetary representations.
- Useful column widths, headers, freeze panes and number formats.

Avoid floating-point-derived financial totals.

If spreadsheet cells contain numeric values, guarantee that their serialization does not silently change monetary values. Test exact output and clearly document any XLSX numeric precision limitations.

For identifiers and values that could be interpreted as formulas, use explicit safe text cells.

Prevent spreadsheet formula injection from user-entered names, descriptions, addresses and other text.

Do not let exported data become executable formulas.

## 11. COMPLETE BUSINESS DATA EXPORT

Implement a separate, authenticated full customer/business data export capability.

Scope includes the customer's complete relevant business information, such as:

- Clients.
- Projects.
- Contracts.
- Contract phases.
- Payments.
- Payment allocations.
- Expenses.
- Expense categories.
- Persons/suppliers.
- Vehicles.
- Receipt metadata.
- Receipt version metadata.
- Audit events.
- Entity version history.
- Relevant stable IDs, relationships and timestamps.

Preserve:

- Historical/cancelled states.
- Logical deletion metadata.
- Original entity identifiers.
- Version values.
- Event timestamps.
- Relationship identifiers.
- Exact financial decimal values.

Use appropriately structured CSV and/or XLSX datasets plus suitable PDF documentation or manifest, in accordance with the approved full-export requirement.

**Do not export authentication secrets.**

Explicitly exclude:

- Password hashes.
- Raw session tokens or session token digests.
- Operator credentials.
- Login limiter secrets/state.
- Environment variables.
- Private storage filesystem paths.
- Unnecessary internal security metadata.
- Database connection strings.

Receipts themselves remain accessible as authorized immutable PDF files. If including receipt PDF documents in a complete export, package their actual bytes safely and verify checksums; do not substitute fake metadata as though it contained the documents.

Choose and document an appropriate bounded export packaging strategy, such as a private ZIP bundle containing structured datasets, real receipt PDFs and a manifest/checksum file.

Avoid arbitrary filesystem enumeration.

All included documents must originate from authorized, database-referenced storage keys.

### Completeness

A full export must not silently omit older audit events or historical versions because an ordinary UI list caps results at 20 or 30.

Implement safe batching or pagination internally.

Detect and report partial or failed exports.

Record the export schema version and generation timestamp.

Use stable filenames and formats that permit data portability.

Avoid excessive memory use with large datasets.

## 12. EXPORT SECURITY

Every export action must require a live authenticated business user.

Use server-side authorization.

Implement:

- No-store/private download headers.
- Appropriate content types.
- Safe attachment filenames.
- No public static export paths.
- Bounded resource use.
- Safe temporary-file handling.
- Cleanup of incomplete generated exports.
- Authorization rechecks for long-running generation where feasible.
- Audit events indicating export execution without embedding exported sensitive data.

Do not accept arbitrary table names or filesystem paths from browser input.

Protect against:

- Path traversal.
- CSV/XLSX formula injection.
- Unauthorized export access.
- Unbounded memory consumption.
- Partial downloads mislabeled as complete.
- Accidentally publishing customer data.

Do not expose the raw financial or audit database through an unguarded API.

Consider how concurrent edits, corrections and cancellations affect the chosen export snapshot.

## 13. FILTERING AND REPORT VALIDATION

Validate:

- Valid actual calendar dates.
- Start/end ordering.
- Allowed filter types and values.
- Bounded search lengths.
- Bounded HTTP request sizes.
- Appropriate report-size/resource limits.
- Exact monetary values.
- Supported PDF/XLSX formats.
- Stable pagination.

Use parameterized Drizzle queries.

For report details, always reconcile displayed totals to the exported rows under the selected filter scope.

For full exports, establish a reliable completeness/manifest check.

Fail closed when data is inconsistent or the database is unavailable.

Return safe, understandable errors.

## 14. AUDIT AND HISTORY

Report generation must not rewrite existing financial history.

Use current audit facilities to record appropriate export events, without storing the exported dataset inside audit snapshots.

If an audit event is required to authorize/finalize an export, define a safe failure policy.

Do not mutate receipt version rows or financial records to create a report.

Never regenerate old immutable receipt PDFs as part of reporting.

The latest active state determines ordinary financial views.

Audit/history export preserves past corrections for traceability.

## 15. UI/UX

Implement actual dashboard and company reporting screens using the existing Operational Clarity design foundation.

Provide:

- Financial KPI cards.
- Clear transaction-date filters.
- Real trend/breakdown views where justified.
- Company report preview.
- PDF and XLSX download actions.
- Export progress/pending/error states.
- Separate complete-data-export action.
- Clear warnings about sensitive export data.
- Responsive mobile summaries.
- Accessible labels and focus behavior.
- Good empty states and hierarchy.

Do not implement the final premium motion-design overhaul in this package.

Prioritize correct numbers, clear navigation and functional workflows.

Do not fabricate demonstration figures.

Browser tests should be executed if a real connected browser is available; otherwise mark browser behavior NOT VERIFIED.

## 16. DATABASE & MIGRATIONS

Inspect existing schema and audit capability before introducing new structures.

Do not create unnecessary reporting tables or duplicate financial ledgers.

If export-job tracking or audit metadata genuinely requires a new table, use a narrowly scoped additive migration after 0008.

Preserve all prior migration SQL, hashes, immutable version history and 13 existing triggers.

Apply any required migrations on disposable MySQL 8.4.

Verify repeat migration execution, indexes and foreign keys.

Do not modify production data or use real customer records.

## 17. AUTOMATED TESTS

### Financial Aggregates

Test:

- Exact income sum from received payments.
- Cancelled payments excluded.
- Corrected payment contributes only its current amount.
- Retired allocations excluded from current phase totals.
- Exact expense sum from recorded expenses.
- Cancelled expense excluded.
- Corrected expense contributes current amount only.
- Company-wide expense counted in company totals.
- Company-wide expense excluded from each project total.
- Correct project/client associations.
- No double counting of history.
- Actual transaction-date range boundaries.
- Cash/bank and category filters.
- Decimal precision, including large valid EUR values.
- Empty database and zero-data results.

### Reports

Test:

- Company report totals match underlying filtered data.
- PDF is valid and readable.
- XLSX opens as a valid workbook.
- Detail rows reconcile to summary totals.
- Long values render safely.
- Special Albanian characters.
- Formula-injection protection.
- Cancelled/corrected records follow approved active-state policy.
- No individual project report export endpoint exists.

### Full Export

Test:

- Every approved business table included.
- Older audit/history rows beyond UI pagination are included.
- Stable IDs and relationships preserved.
- Cancelled and archived records included.
- No password hashes/session secrets/operator keys.
- Real included receipt PDFs match stored checksums.
- Manifest/checksum correctness.
- Data-export pagination or batching completeness.
- Partial export fails clearly.
- Unauthorized export denied.
- Sensitive temporary files cleaned up.

### Security

Test:

- Anonymous dashboard/report/export access denied.
- Disabled session denied.
- Safe Origin/Host protection on export-starting mutations where applicable.
- SQL/PII error redaction.
- No-store headers.
- No public export URLs.
- Malicious filenames and spreadsheet cell values.
- Database outage handling.

### Regression

Preserve:

- WP-03 authentication.
- WP-04 clients.
- WP-05 projects/contracts/phases.
- WP-06 reference data.
- WP-07 expenses.
- WP-08 payment allocations and idempotency.
- WP-09 receipts and immutable PDFs.
- All prior migration hashes and 13 triggers.
- Public SQ/EN pages.
- Private navigation.
- TypeScript, ESLint and build.

Do not weaken previous tests.

## 18. ACCEPTANCE CRITERIA

**WP10-AC01:** Dashboard uses real persisted business data.

**WP10-AC02:** Active income excludes cancelled payments.

**WP10-AC03:** Active expenses exclude cancelled expenses.

**WP10-AC04:** Corrected records contribute only their latest active values.

**WP10-AC05:** Company-wide expenses are not automatically assigned to projects.

**WP10-AC06:** Company income-minus-expenses is not misrepresented as statutory profit.

**WP10-AC07:** Project summaries are viewable on screen using real exact values.

**WP10-AC08:** No individual project financial PDF/XLSX report export is provided.

**WP10-AC09:** Company report filters and totals use correct transaction-date semantics.

**WP10-AC10:** Company PDF report is generated with actual correct data.

**WP10-AC11:** Company XLSX report is generated with actual correct data.

**WP10-AC12:** PDF/XLSX detail sections reconcile with their summaries.

**WP10-AC13:** Financial arithmetic retains exact EUR cents.

**WP10-AC14:** Report queries use consistent data snapshots.

**WP10-AC15:** Complete business-data export includes required active and historical data.

**WP10-AC16:** Export is not limited by ordinary UI history pagination.

**WP10-AC17:** Real referenced receipt PDFs are handled safely in complete export.

**WP10-AC18:** Full export excludes authentication and infrastructure secrets.

**WP10-AC19:** CSV/XLSX formula injection is prevented.

**WP10-AC20:** Export access and downloads are independently authorized.

**WP10-AC21:** Export failures and partial outputs are handled safely.

**WP10-AC22:** Dashboard/reports/exports use existing UI foundation.

**WP10-AC23:** Real MySQL integration tests pass.

**WP10-AC24:** Real PDF/XLSX/export content is verified, not only mocked.

**WP10-AC25:** Previous migrations, triggers and module regressions pass.

**WP10-AC26:** TypeScript, lint, build and HTTP route checks pass.

**WP10-AC27:** Browser/mobile/accessibility verification runs where available; otherwise NOT VERIFIED.

**WP10-AC28:** No production database, real client data or deployment is involved.

Report PASS, FAIL or NOT VERIFIED for every criterion.

## 19. VERIFICATION

Inspect package scripts before running commands.

Execute appropriate:

- `npm.cmd test`
- `npm.cmd run db:check`
- `npm.cmd run db:migrate`
- `npm.cmd run test:db`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run check:routes`

Add focused financial-report, PDF, XLSX and complete-export integration/HTTP tests.

Use synthetic records, disposable MySQL 8.4 and task-owned private output directories.

Preserve the owner's separate local development environment.

Record actual commands, test results and relevant file integrity evidence.

Do not pretend PDF/XLSX inspection occurred if it was not executed.

Do not deploy.

## 20. REQUIRED DELIVERY REPORT

### A. Repository Baseline

Branch, HEAD, preserved user modifications and accessible source specifications.

### B. Financial Definitions

Exact current-state eligibility, date filters, contract totals and project/company allocation rules.

### C. Dashboard and Project Summaries

Routes, calculations, UI and actual data sources.

### D. Company Report

PDF/XLSX layout, filters and reconciliation evidence.

### E. Full Data Export

Included entities/history/PDFs, structure, batching and security exclusions.

### F. Consistency & Performance

Snapshot strategy, query bounds, large-export behavior and resource limitations.

### G. Database & Migrations

Any additive migration and actual verification.

### H. Files Changed

Exact paths/purpose.

### I. Test Evidence

Commands, counts, rendered documents, spreadsheet validation, error/recovery tests.

### J. Acceptance Checklist

WP10-AC01 through WP10-AC28.

### K. Security Review

Authorization, PII protection, export isolation, spreadsheet safety, secret exclusion.

### L. Known Issues and Release Gates

Browser QA, accountant approval, production storage/backup compatibility and anything not verified.

### M. Next Package

Assess readiness for the next website-content and premium UI/UX implementation phase.

Do not start the next package automatically.

## 21. EXECUTION

Implement WP-10 locally now.

Build the real dashboard, project-level on-screen summaries, company-wide financial report PDF/XLSX and full authorized business-data export.

Use existing persisted financial services, exact-money rules and private receipt storage.

Preserve prior migration history, audit guarantees and security boundaries.

Verify all new capabilities with real MySQL and actual generated documents.

Do not stop at a plan.

Do not deploy or access real customer data.

Commit/push only under the project's current explicit owner authorization.

**END OF WP-10**
