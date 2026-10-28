# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-13: Performance Engineering, Measurement & Optimization

**Project:** Fitimi Construction Management System & Corporate Website  
**Package:** WP-13  
**Version:** 1.0  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Status:** Authorized for local implementation and verification  
**Deployment:** NOT AUTHORIZED

---

## 1. MISSION

Optimize the real performance of Fitimi Construction across its public bilingual website and authenticated construction-management application.

The project owner will personally direct the premium UI/UX, visual identity and motion-design work.

**Do not perform a creative redesign.**

Your responsibilities are:

1. Establish real performance baselines.
2. Identify measured bottlenecks.
3. Improve website loading and responsiveness.
4. Improve authenticated application responsiveness.
5. Optimize database queries and critical financial read paths.
6. Reduce unnecessary client-side JavaScript and rendering.
7. Improve performance under realistic concurrent activity.
8. Preserve authentication, financial integrity, receipts, history and data privacy.
9. Deliver reproducible before/after benchmarks.
10. Document performance budgets for the owner's upcoming visual and animation work.

This is an implementation and engineering package.

Do not return only performance advice.

## 2. PROJECT BASELINE

Reported completed packages:

- WP-01 through WP-10: Main application and financial functionality.
- WP-11: Corporate website foundation, bilingual content architecture and real browser tests.

WP-11 reports:

- Next.js 16.4.3.
- React 19.3.1.
- TypeScript 6.0.3.
- Drizzle ORM 0.45.4.
- MySQL 8.4.13.
- 9 database migrations.
- 13 original integrity/history triggers.
- 356 passing automated test results.
- 32 actual Microsoft Edge/Playwright browser tests.
- Working SQ/EN public routes.
- Authenticated business modules.
- Actual PDF receipt generation and private storage.
- Financial PDF/XLSX reports and complete ZIP export.

Verify the actual repository state rather than trusting historical figures.

Before implementation:

- Read AGENTS.md.
- Inspect Git branch, HEAD and working tree.
- Preserve existing owner files and configuration.
- Review current package scripts.
- Review Next.js route and component structure.
- Inspect database queries and indexes.
- Inspect existing Playwright tests.
- Review previous delivery reports.
- Check current source and dependency versions.

Preserve README.md if the owner's current instructions prohibit editing it.

Do not modify old migrations in place.

## 3. OWNER'S UI/UX AUTHORITY

The owner personally controls:

- Final website visual direction.
- Typography and brand identity.
- Motion language.
- Building/brick/crane/truck animation concepts.
- Page compositions.
- Internal application visual polish.
- Interaction and animation approval.

You may improve implementation efficiency without changing the intended design.

Do not:

- Redesign pages.
- Change brand colors.
- Replace typography for aesthetic reasons.
- Remove visual sections because they could become animated later.
- Implement cinematic animations.
- Add visual effects unrelated to measured performance.
- Invent company content.
- Alter navigation semantics without demonstrated necessity.

Preserve existing WP-11 motion hooks and server-rendered content.

If a performance optimization conflicts with future premium motion design, document the tradeoff and provide a technical recommendation. Do not make the creative decision yourself.

## 4. MEASUREMENT-FIRST RULE

No unsupported claims such as:

- "The app is 10x faster."
- "Instant loading."
- "Lighthouse 100."
- "All pages load in under one second."

First measure the actual baseline.

Measure again after changes under comparable conditions.

Distinguish:

- Local laboratory measurements.
- Browser interaction measurements.
- Database microbenchmarks.
- API latency measurements.
- Production user experience, which cannot yet be confirmed.

Record test environment, sample sizes, machine/browser conditions and measurement limitations.

Do not present synthetic benchmarks as real-user production metrics.

## 5. TARGET PERFORMANCE METRICS

Use the following as targets, not guaranteed results.

### Public website

Core Web Vitals targets at the 75th percentile of real-user measurements when available:

- LCP ≤ 2.5 seconds.
- INP ≤ 200 milliseconds.
- CLS ≤ 0.1.

For local lab evaluation, use appropriate Lighthouse/Playwright measurements and clearly distinguish those from field p75 data.

Evaluate:

- First Contentful Paint.
- Largest Contentful Paint.
- Layout shifts.
- Main-thread blocking.
- JavaScript size.
- Image loading.
- Font loading.
- Navigation timing.
- Mobile simulation.

### Private application

Measure:

- Authenticated page navigation.
- Dashboard time to useful data.
- Clients/projects/expenses/payments listing.
- Search and filter responsiveness.
- Contract/phase editor responsiveness.
- Form loading and submit feedback.
- Receipt PDF downloads.
- Company report generation.
- Full business export.

Define realistic performance budgets from actual baselines.

Financial correctness and data security always take priority over shaving milliseconds.

## 6. BROWSER PERFORMANCE ENVIRONMENT

WP-11 successfully used local Microsoft Edge with Playwright.

Reuse the approved browser-testing setup.

Preserve the owner's browser profile and settings.

Use:

- A temporary Playwright profile.
- Reproducible viewport sizes.
- Representative desktop and mobile configurations.
- A controlled production build.
- Local loopback services.
- Explicit synthetic fixtures for authenticated paths.

Measure multiple runs per scenario.

Record median and a useful tail-latency metric where sample sizes justify it.

Separate cold-start measurements from warm-navigation measurements.

Do not mix development-mode measurements with production-build measurements without labeling the difference.

Collect console, network and hydration errors.

Avoid screenshots containing private or real customer data.

## 7. PUBLIC WEBSITE OPTIMIZATION

Audit all ten SQ/EN public pages.

Optimize:

- Server rendering/static generation.
- Unnecessary client components.
- JavaScript bundle size.
- Shared dependencies.
- Route prefetching behavior.
- Font loading.
- Image loading and dimensions.
- CSS delivery.
- Above-the-fold content.
- Layout stability.
- Responsive navigation performance.
- Reduced-motion fallback efficiency.
- Hydration and event listeners.

Keep the public content fully understandable without animation.

Do not remove metadata, canonical/hreflang, language switching, accessibility or security protections.

Do not add a heavy client-side framework where a lightweight solution is sufficient.

## 8. AUTHENTICATED APPLICATION PERFORMANCE

Profile the existing business modules:

- Dashboard.
- Clients.
- Projects.
- Contract/phase editor.
- Expense categories.
- Persons/suppliers.
- Vehicles.
- Expenses.
- Payments.
- Receipts.
- Reports and exports.

Investigate:

- Unnecessary rerenders.
- Oversized client components.
- Repeated server fetches.
- Duplicate queries.
- Excessive sequential requests.
- Search typing behavior.
- List pagination.
- Selector responsiveness.
- Large financial forms.
- Expensive serialization.
- Slow loading and error boundaries.

Use React/Next.js-compatible optimizations when justified.

Do not introduce speculative memoization everywhere.

Do not move sensitive database state into public client bundles.

Keep forms correct under slow network, stale data, concurrent writes and session expiration.

## 9. DATABASE QUERY PERFORMANCE

Use MySQL 8.4 with representative synthetic data.

Inspect and benchmark relevant queries:

- Dashboard summaries.
- Project financial aggregates.
- Active allocation capacity.
- Client/project searches.
- Expense searches and filters.
- Payment and receipt lists.
- Audit/history reads.
- Company report snapshots.
- Full export batching.

Use appropriate:

- EXPLAIN / EXPLAIN ANALYZE where safe.
- Actual row counts.
- Query latency.
- Index inspection.
- Connection-pool measurements.
- Query-plan analysis.

Avoid creating indexes blindly.

Any new index must have a demonstrated query benefit and an analysis of write/storage cost.

If a database index or schema adjustment is warranted:

- Generate an additive migration after the existing latest migration.
- Preserve all historical migration hashes.
- Verify on a fresh disposable database.
- Test expected query behavior and regression.

Do not change transaction isolation, foreign keys, triggers, versioning or locking solely to improve benchmark numbers.

## 10. FINANCIAL TRANSACTION SAFETY

The following invariants must remain untouched:

- Exact DECIMAL/BigInt EUR arithmetic.
- Contract total equals active phase values.
- Active allocation capacity cannot be exceeded.
- Payment allocations sum exactly to the payment.
- Shared deterministic financial lock ordering.
- Idempotent payment confirmation.
- No duplicate receipts.
- Immutable receipt versions.
- Cancellation history preservation.
- Full audit trails.
- Correct active income/expense totals.

Do not cache mutable financial capacity as an authorization or validation source.

Do not replace locking reads with stale cached values.

A fast stale preview may be allowed when transparently identified as a preview, but final mutations must always revalidate inside the authoritative transaction.

Performance work must not relax SQL consistency or financial guards.

## 11. CACHING AND DATA PRIVACY

Develop a documented caching policy.

### Public website

Use safe static/server caching where appropriate.

### Authenticated application

Preserve privacy:

- No shared CDN caching of customer data.
- No public caching of receipts.
- No public caching of audit records.
- No public caching of financial reports.
- No cross-user leakage.
- Appropriate private/no-store responses.
- Correct session invalidation.
- No cached authorization decisions that survive deactivation.

Do not cache raw receipt storage URLs or private filesystem paths in client state.

Never optimize performance by weakening authentication checks.

## 12. PDF AND EXPORT PERFORMANCE

Benchmark:

- Receipt PDF rendering.
- Receipt document retrieval.
- Private checksum verification.
- Company financial PDF generation.
- XLSX generation.
- Full ZIP data export.
- Export materialization and memory use.

Do not change the immutable receipt content of previously issued documents.

Do not skip checksum validation merely to accelerate downloads.

Avoid loading unbounded customer records into memory.

Maintain current explicit export limits unless a measured, safely tested change is justified.

If an export fails its limits, return a clear failure rather than a silently truncated download.

Keep authentication and export audit controls operational.

Production persistent storage and paired database/PDF backup remain separate release prerequisites.

## 13. LOAD AND CONCURRENCY TESTS

Use disposable MySQL and synthetic data only.

Design representative scenarios:

- Multiple users reading the dashboard.
- Concurrent project/client searches.
- Concurrent payment allocation previews.
- Concurrent valid payment confirmations.
- Contract-phase edits competing with payments.
- Expense creation and reference deactivation.
- Receipt PDF downloads.
- Report generation while reads continue.
- Full export resource contention.

Observe:

- Request latency.
- Error rates.
- Database connection utilization.
- Lock waits.
- CPU/memory use.
- Timeouts.
- Deadlocks.
- Document generation load.

Avoid excessively destructive or uncontrolled stress testing.

Do not load-test production or unrelated local services.

Financial races must preserve all existing invariants.

Do not suppress safe conflicts/409 responses merely to improve throughput statistics.

## 14. REALISTIC TEST DATA

Create synthetic datasets large enough to reveal query and rendering bottlenecks.

Include representative:

- Clients and businesses.
- Projects and contracts.
- Contract phases.
- Payments and allocations.
- Expenses.
- Categories/persons/vehicles.
- Receipt versions.
- Audit/history rows.

Do not invent real Fitimi Construction business data.

Do not add synthetic production dashboard content.

Keep fixtures isolated and removable.

Test both:

- Small/empty datasets.
- Moderate realistic datasets approaching existing pagination/export limits.

Record dataset sizes explicitly.

## 15. PERFORMANCE BUDGET FOR FUTURE ANIMATIONS

Prepare a technical budget to help the project owner build premium motion.

Provide recommendations for:

- Maximum reasonable animation JavaScript overhead.
- Appropriate SVG/CSS/Canvas/WebGL tradeoffs.
- Motion loading after critical content.
- GPU/compositing-friendly properties.
- Avoiding forced synchronous layout.
- Offscreen animation pausing.
- Reduced-motion support.
- Mobile quality tiers.
- Scroll listener design.
- Event cleanup.
- Memory and battery considerations.

Do not pick final artistic concepts or implement the owner-controlled motion package.

Recommend graceful enhancement rather than turning the website into a heavy animation runtime.

The owner must be able to introduce premium animations without breaking accessible content or the target loading budget.

## 16. CODE CHANGES

Make only evidence-backed changes.

For each meaningful optimization document:

1. Baseline measurement.
2. Diagnosed bottleneck.
3. Source change.
4. New measurement.
5. Regression impact.
6. Relevant tradeoffs.

Preserve existing behavior and public/private boundaries.

Prefer focused changes over broad rewrites.

Do not install dependencies unless their measurable value justifies their operational cost.

Do not introduce an additional caching server or external infrastructure without authorization.

## 17. SECURITY PRESERVATION

Performance work must preserve:

- Live authorization and account deactivation.
- Authentication rate limiting.
- Session revocation.
- CSRF/Origin/Host validation.
- Financial row locks.
- Exact amounts.
- Audit integrity.
- Receipt immutability.
- Private PDF storage/downloads.
- Safe exports.
- Input validation.
- No-store privacy.
- Database least-privilege assumptions.

No benchmark result justifies bypassing these protections.

Run relevant security regressions after optimizations.

Do not claim this package replaces the dedicated WP-14 security audit.

## 18. TESTING

Run applicable project checks:

- `npm.cmd test`
- `npm.cmd run db:check`
- `npm.cmd run db:migrate` against disposable MySQL.
- `npm.cmd run test:db`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run check:routes`
- `npm.cmd run test:website:browser`

Run existing authenticated HTTP tests and add measured performance/browser tests where justified.

Capture:

- Baseline and optimized browser measurements.
- Database query plans.
- Representative server/API latency.
- Memory and bundle size.
- Load-test results.
- All regression results.

Do not weaken prior tests.

Use reproducible local tooling.

If a metric is not measured, mark it NOT VERIFIED.

## 19. ACCEPTANCE CRITERIA

**WP13-AC01:** Actual baseline performance evidence is recorded.

**WP13-AC02:** Public website performance is measured in real browser tests.

**WP13-AC03:** Authenticated application performance is measured with synthetic sessions/data.

**WP13-AC04:** Relevant database query bottlenecks are profiled.

**WP13-AC05:** Improvements are supported by comparable before/after measurements.

**WP13-AC06:** Public SQ/EN navigation and SEO remain intact.

**WP13-AC07:** Existing UI appearance and owner motion hooks are preserved.

**WP13-AC08:** Financial transaction semantics and locks are unchanged or rigorously proven equivalent.

**WP13-AC09:** Receipt numbering, immutability and checksum validation remain correct.

**WP13-AC10:** Authenticated/private responses preserve safe caching rules.

**WP13-AC11:** Dashboard and project financial values remain exact.

**WP13-AC12:** PDF/XLSX/ZIP exports remain complete and secure within documented bounds.

**WP13-AC13:** Realistic synthetic data and concurrent-request tests are executed.

**WP13-AC14:** Performance optimizations introduce no unauthorized access or data leakage.

**WP13-AC15:** Database migrations and integrity tests pass.

**WP13-AC16:** All original 13 triggers remain intact.

**WP13-AC17:** TypeScript, lint, production build and prior module regressions pass.

**WP13-AC18:** Real Edge/Playwright navigation, hydration and browser tests pass.

**WP13-AC19:** Future premium-motion performance guidelines are documented.

**WP13-AC20:** No creative redesign, production deployment or real business data is involved.

**WP13-AC21:** Remaining bottlenecks and performance risks are accurately reported.

**WP13-AC22:** Before/after results distinguish lab measurements from production Core Web Vitals.

Report PASS, FAIL or NOT VERIFIED for each criterion.

Do not award a PASS solely because code compiles.

## 20. DELIVERABLES

### A. Initial Baseline

Environment, browser, device settings, dataset sizes and original performance metrics.

### B. Diagnosed Bottlenecks

Measured page, API, database and export issues.

### C. Implemented Optimizations

Exact file changes and reasons.

### D. Before/After Results

Comparable measurements and honest improvement calculations.

### E. Database Performance

Query plans, indexes, lock waits and data sizes.

### F. Browser Performance

Public and authenticated routes, hydration, responsiveness and resource use.

### G. Load Testing

Concurrency, throughput, errors and financial integrity.

### H. Motion Performance Handoff

Technical budgets and constraints for the owner's custom UI/UX work.

### I. Security & Privacy Regression

No-cache/session/authorization/receipt/export protection results.

### J. Automated Verification

Commands, actual output and test counts.

### K. Acceptance

WP13-AC01 through WP13-AC22.

### L. Remaining Risks

Unresolved slow paths, production-hosting uncertainty and future validation needs.

### M. Next Package Readiness

Assess readiness for WP-14 — Security Hardening & Independent Security Audit Preparation.

Do not implement WP-14 automatically.

## 21. EXECUTION

Proceed with WP-13 implementation locally.

Measure first.

Fix proven performance bottlenecks.

Preserve all existing financial and security guarantees.

Run production-build browser tests and realistic synthetic MySQL benchmarks.

Provide concrete before/after evidence.

Keep the project owner's visual/UI/UX direction untouched.

Do not begin WP-14 automatically.

Do not deploy.

Commit/push only under the owner's current explicit authorization.

**END OF WP-13**
