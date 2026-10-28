# WP-13 delivery — 28 October 2026

## A. Baseline and measurement conditions

Started on `main` at `9f6586c987a90a5fe81c4222abd684836c466136`. The owner's replacement `AGENTS.md` was the sole initial modification; its contents were preserved. README.md and .env.local were not edited. No WP-12 creative work or WP-14 audit was performed.

Actual stack: Next 16.4.3, React 19.3.1, TypeScript 6.0.3, Drizzle 0.45.4, mysql2 3.24.6; Node 24.18.0; MySQL 8.4.13; Playwright 1.64.1 and installed Edge/Chromium **156.0.4314.50**. No dependency installation or lockfile change.

Windows, Intel i7-1255U, 12 logical CPUs, approximately 7.68 GiB visible RAM. Isolated production build `.next-wp13`; disposable, labeled Docker MySQL with tmpfs; synthetic `fitimi_test_wp13` only. At the owner's request, final test services use the original **3307 MySQL / 3000 application** ports. The initial temporary 3312 mapping was removed; .env.local retained its original database and ports. The owner's stopped WP-08 container was not used, reset or removed.

The timing fixture contained 1,002 clients/projects/contracts, 2,004 phases, 301 received payments/allocations, 300 expenses, 12,000 bulk synthetic audit entries plus service-generated history, one real synthetic receipt PDF and category/person/vehicle references. One setup-only client/project remained in both timing passes. The later clean recreation contains 1,001 projects; its concurrency results are separate. Downloads append a small number of export audit events, so full-history sizes grow slightly between timing passes.

Samples: pure finance 30, finance snapshot 12, full snapshot 6, each GET API 7, each document format 3. Each public route: 3 fresh browser contexts × 2 viewports, 60 navigations per pass. Twelve private routes × 3 = 36 per pass. All use loopback production mode. Public contexts are cold browser caches on an already running server; these are not process-cold or real-user measurements. Desktop 1440×1000, mobile viewport 390×844, reduced motion, no CPU/network throttling.

Raw ignored evidence: `artifacts/wp13/{baseline,optimized}-{db,browser,finance}.json`; committed selected measurements and full query plans: [wp13-measurements.json](performance/wp13-measurements.json). Windows scheduling/cache variability remains; part of the optimized database run overlapped lint startup. Results demonstrate local improvements, not a production SLA. Nearest-rank p95 for small n is approximately the maximum, not a reliable field percentile.

## B. Measured bottlenecks

1. `finances()` repeatedly scanned every contract, phase, payment and expense for every project, including another scan for filtered breakdowns. Median CPU calculation: 49.88 ms.
2. Snapshot batching used 100-row OFFSET queries. A late history batch scanned approximately 12,000 primary-index rows to return 100. Median full materialization: 965.34 ms.
3. Financial endpoints materialize a complete bounded company snapshot: dashboard payload remains approximately 848 KB with this fixture. Per-request connection/session initialization and PDF rendering remain meaningful costs.

Public content was already statically generated with modest JavaScript, zero observed CLS and no median long-task blocking. No evidence justified a public component rewrite, aesthetic change, speculative memoization or new animation dependency.

## C. Implemented changes

| File | Purpose / tradeoff |
| --- | --- |
| `src/features/reporting/finance.ts` | Snapshot-local maps for contracts, active phases, categories and exact BigInt grouped sums. Removes repeated cross-project scans; preserves output order, all-date project balances, filtered company totals and every consistency check. Adds linear transient indexing memory. No shared cache or mutation validation change. |
| `src/features/reporting/snapshot.ts` | Read-only repeatable-read primary-key cursor batches of 500, replacing 100-row OFFSET batches. Retains counts, ordering, completeness, authorization before/after, 20,000 rows / 16 MiB / 15-second bounds and credential exclusions. Larger individual batches trade transient memory for fewer queries. |
| `tests/reporting/validation.test.ts` | Verifies filtered breakdowns versus all-date balances, archived projects, other categories and cancelled expenses. |
| `tests/reporting/reporting.integration.test.ts` | Strengthens history/export verification from 106 to 506 versions, crossing the new batch boundary. |
| `scripts/performance/measure.ts` | Guarded synthetic seed, database/API/document/browser measurement and bounded financial concurrency scenarios. |
| `scripts/performance/lab.mjs` | Reproducible task-owned Docker setup and environment overlay; owner ports remain fixed. Refuses replacement of an existing lab. |
| `scripts/performance/summarize.mjs` | Produces the committed before/after summary without fixture passwords/session tokens. |
| `playwright.config.ts` | Stages byte-identical browser specs in an ignored local directory using lstat. OneDrive incorrectly advertised hydrated files as symlinks to Dirent and Playwright otherwise found zero tests. Removes stale staged specs; all 32 original cases remain. WP-13 results have a separate output directory. |
| `next.config.ts`, `.gitignore`, `eslint.config.mjs`, `tsconfig.json` | Isolated `.next-wp13` output and tooling support; original .next preserved. |
| `src/features/receipts/storage.ts` | Forbids the additional test build directory as private receipt storage; receipt lifecycle and PDF bytes unchanged. |
| `tests/auth/http.integration.test.ts`, `tests/reporting/http.integration.test.ts` | Explicit WP-13 build/owned-container/3307 allowlist for existing real outage tests. |
| `package.json` | Adds `perf:lab`; no new dependency. |
| `AGENTS.md` | Owner-supplied WP-13 instructions retained. |

## D. Comparable before/after results

Milliseconds, medians; changes are `(after / before - 1) × 100`.

| Scenario | Before | After | Change |
| --- | ---: | ---: | ---: |
| Pure exact finance, n=30 | 49.88 | 15.62 | −68.7% |
| Finance snapshot, n=12 | 192.78 | 109.00 | −43.5% |
| Full snapshot, n=6 | 965.34 | 326.45 | −66.2% |
| Dashboard API, n=7 | 544.31 | 173.37 | −68.1% |
| Company report API, n=7 | 443.26 | 188.75 | −57.4% |
| Receipt PDF retrieval + verification, n=7 | 49.56 | 45.49 | −8.2% |
| Company PDF, n=3 | 795.45 | 868.25 | +9.2% |
| Company XLSX, n=3 | 494.66 | 261.39 | −47.2% |
| Full ZIP, n=3 | 1456.43 | 750.44 | −48.5% |
| Mixed reads, 32 requests, concurrency 4, elapsed | 3765.47 | 1518.45 | −59.7% |

No PDF-generation improvement is claimed. Expense API median also increased 53.46→59.82 ms; payment listing was essentially unchanged 54.79→55.00 ms. Client/project-list fluctuations do not establish improvements because those implementations were unchanged. All values, raw extrema, sizes and small-sample tails are in the JSON.

Full financial output before/after is deeply equal except generation timestamp, including all 1,002 projects and 2,004 phases. Income `310.00`, expenses `90.00`, difference `220.00`, contract value `100200.00`, outstanding `99890.00`. No monetary approximation.

## E. Database performance and resources

EXPLAIN ANALYZE covered history offset/cursor, clients, project lookup, allocation capacity, expenses, payments and entity history. Existing PRIMARY, project/client, payment-status/date and audit-entity indexes are used. The diagnostic cursor query includes a one-time OFFSET subquery to obtain its comparison ID; the inner primary-key range returns 100 rows, whereas the old offset scan reads ~12,000. Production obtains its cursor from the previous batch and has no such subquery.

No index or migration was warranted. No index write/storage cost was added. All nine historical migration files/hashes remain unchanged. Original 13 integrity/history triggers, foreign keys, checks and lock ordering remain intact.

The application opens/closes a configured connection for each unit of work; it has **no connection pool**. Pool utilization is therefore not applicable. Database status samples after read benchmarks: one connected inspection connection, two reported running threads, zero row-lock waits/time and zero disk temporary tables. These are samples, not peak connection instrumentation.

After write races: seven cumulative row-lock waits, 589 ms cumulative wait time; expected serialization, not suppressed. No unexpected HTTP errors/timeouts were observed in the bounded scenarios. No general deadlock-free guarantee is made.

One optimized container sample: CPU 1.53%, memory 747.3 MiB / 3.665 GiB Docker limit. Benchmark-process end RSS increased ~176.5→346.3 MiB, heap used ~64.1→66.9 MiB; this includes measurement buffers/GC and is not application-server peak memory. No memory improvement is claimed. Peak server/DB CPU/memory under sustained load is **NOT VERIFIED**. The 500-row batch and maps require monitoring on real hosting; source/export bounds remain unchanged.

## F. Browser evidence

| Local public metric | Desktop before→after | Mobile before→after |
| --- | --- | --- |
| LCP median | 108→136 ms | 136→140 ms |
| FCP median | 108→136 ms | 136→140 ms |
| Maximum observed CLS | 0→0 | 0→0 |
| Median long-task excess above 50 ms | 0→0 ms | 0→0 ms |
| Median JavaScript transfer | 148,223→148,223 bytes | 148,223→148,223 bytes |

One baseline desktop paint sample was unavailable; paint medians use 29 valid samples there and 30 elsewhere. Public changes fall within workstation variation; no public loading improvement is claimed. Delivered chunk-file total was approximately 712 KB uncompressed across all app chunks, distinct from per-page network JavaScript. Public imagery is the existing inline architectural SVG; no new raster/font request or layout dimensions were introduced.

Private settled-navigation medians: dashboard 1148→901 ms, reports 1161→950 ms, project detail 848→715 ms, contract editor 800→738 ms. Clients ~783→783 ms, projects ~751→751 ms, expenses 784→1026 ms and payments 749→767 ms. Networkidle adds a fixed settlement wait; these are not exact time-to-useful-data or INP measurements. Real filter submit 836→906 ms and single warm public click 165→294 ms did not improve. Form submit correctness is separately covered by HTTP/domain tests; not every mutation UI has a measured latency budget.

Both measurement passes: no captured console/page/hydration errors or overflow. Later original browser regression: **32 passed**, including ten direct pages at two widths, axe scans, SQ/EN switching, keyboard/menu behavior, reduced motion, text resize, no-JavaScript fallback and responsive breakpoints. Temporary Edge contexts only; no personal browser-profile/default changes.

Screenshots: `artifacts/wp13/{baseline,optimized}-public.png` and twenty public regression screenshots in `artifacts/wp11/screenshots`. Representative optimized SQ About screenshot visually inspected. No pixel-identical screenshot claim; public design/component/CSS sources and motion hooks were not changed. Field LCP/CLS p75, field INP, true process-cold distributions, Lighthouse mobile throttling and production device performance are **NOT VERIFIED**.

## G. Concurrent activity

Before/after: 32 mixed dashboard/client/project/expense GETs at concurrency four, zero unexpected errors. Read p95 539→208 ms; all requests retain no-store. ZIP generation overlapped four reads: ZIP 2077→820 ms and dashboard 468→214 ms. Small bounded tests, not a saturation/load-capacity certification.

Separate recreated fixture: eight simultaneous allocation previews; four retries of the same confirmation produced one payment/receipt identity; two 40-EUR confirmations competing for remaining phase capacity produced one 201 and one expected 409. Post-race exact project financial validation passed. Existing database regressions additionally cover edits competing with payments, reference deactivation/expense races, concurrent receipt revisions, audit failures and session revocation. They are correctness races, not full throughput profiles for every combination. Multi-user throughput, sustained export contention, isolated PDF-render/checksum CPU and peak resource distributions remain **NOT VERIFIED**.

## H. Performance budgets for owner-directed motion

These are proposed engineering budgets, not approved artistic choices or production guarantees:

- Keep critical transferred JS ≤175 KiB at the measured public baseline (~145 KiB). Add at most 10 KiB critical motion bootstrap; defer the main motion payload, initially targeting ≤35 KiB compressed per loaded scene. Re-measure on target mobile hardware before expanding.
- Keep initial page transfer around ≤250 KiB before approved photography. Add images only with responsive dimensions/formats, explicit geometry and agreed LCP treatment; do not lazy-load an actual LCP hero image.
- Preserve real-user targets LCP ≤2.5 s, INP ≤200 ms, CLS ≤0.1. No field data currently certifies them. Local iteration gates: no new CLS and no added >50-ms initialization task; break up work.
- Preserve existing server-rendered headings, links, scene captions and motion hooks. Lazy-load optional enhancements after critical content/visibility; essential content must never wait for animation.
- Prefer CSS/SVG for modest architectural details; Canvas for many decorative particles after profiling. WebGL requires a separately justified budget, static/mobile fallback and owner approval; no 3D engine was added.
- Animate transform/opacity where appropriate, profile paint costs, avoid read/write layout loops. Use requestAnimationFrame and passive scroll inputs; read geometry in batches, avoid per-event state updates. Target ≤4 ms animation work/frame inside a 16.7-ms 60-Hz frame budget on an agreed device.
- Pause offscreen/hidden scenes; disconnect observers, cancel frame callbacks and remove listeners on unmount. Avoid retaining textures/large canvases. Bound pixel ratio and quality on mobile; reduced motion renders the static scene without continuous work. Assess memory/battery on physical devices.
- Initial private lab guardrails at this fixture: dashboard/report API median ≤250 ms, finance snapshot ≤150 ms, full snapshot ≤500 ms, full ZIP ≤1.2 s. These are local regression budgets; receipt issuance/PDF rendering needs a separate budget because storage/font work remains serialized and variable.

## I. Caching and security policy

Public SQ/EN routes remain statically generated from approved curated content, with Next's static asset caching and unchanged metadata/canonical/hreflang. No private source enters static generation. Public updates require the existing build/publish lifecycle.

Private reads retain live session/account checks and existing no-store responses; receipts/reports/ZIP remain private/no-store, checksum-verified and audited. No new shared CDN/application cache, cached authorization decision, stale capacity source or raw private-storage URL was introduced. Request-local grouping is discarded after each snapshot. Financial mutations revalidate inside the unchanged authoritative transactions.

Origin/Host/CSRF, login limiting, account deactivation, session revocation, same-key idempotency, exact DECIMAL/BigInt money, receipt numbering/immutability, corruption failure, limit failure and export secret exclusions remain covered by existing regressions. This work does not replace WP-14.

## J. Automated verification

Commands run with the isolated environment overlay (`node scripts/performance/lab.mjs run <script>`); no owner .env.local change:

| Command | Result |
| --- | --- |
| `npm.cmd test` | PASS: 8 website + 8 reporting + 48 existing = 64 |
| `npm.cmd run db:check` | PASS |
| `npm.cmd run db:migrate` | PASS on fresh disposable MySQL and repeated application |
| `npm.cmd run test:db` | PASS: 15 reporting + 154 existing = 169 |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS, zero warnings |
| `npm.cmd run build` | PASS, 26 static pages plus dynamic private/API routes |
| `npm.cmd run test:website:browser` | PASS: 32, no retries/skips |
| `test:reports:http`, `test:payments:http`, `test:receipts:http`, `test:expenses:http`, `test:references:http`, `test:projects:http`, `test:clients:http`, `test:auth:http` | PASS: 12 + 10 + 9 + 10 + 19 + 8 + 8 + 9 = 85 |
| `test:website:db` | PASS: 7 public/private isolation cases |
| `npm.cmd run check:routes` | PASS: ten public pages, login, anonymous private redirects, invalid routes/contact state |

**357 passing regression results**: 64 unit/document + 169 database + 85 authenticated HTTP + 7 website isolation + 32 browser. Node totals include parent/subtest results, following the existing reporting convention. No skipped/disabled tests or duplicate reruns added to the total. Final schema evidence: 20 business/auth tables, 45 foreign keys, 89 indexes, 37 checks, 13 original named triggers, nine migrations, zero active synthetic accounts after tests.

Exact additional commands: `perf:lab seed`, `perf:lab db baseline`, `perf:lab browser baseline`, `perf:lab db optimized`, `perf:lab browser optimized`, `perf:lab races optimized`; `node scripts/performance/summarize.mjs`. Browser measurements total 192 navigations, separate from regression test counts.

Reproduction: stop the development server and ensure original ports 3307/3000 are free; do not repoint the owner database. Set `PERF_DOCKER` to the installed Docker CLI if absent from PATH, run `node scripts/performance/lab.mjs setup`, wait for MySQL readiness, then `run db:migrate`, `run perf:lab seed`, `run build` and `run start --port 3000`. In another terminal run the measurement commands. For the original baseline, use the two reporting source files from commit `9f6586c` in a separate checkout with this same harness/test-only configuration; preserve/restore optimized source and rebuild/restart between passes. Keep one fixture and matching browser/machine settings for comparison. Do not run CPU-heavy checks during timing. Do not repeat baseline after `races`, because it intentionally changes data. Dispose only the saved exact WP-13 container ID after inspecting its labels/bindings, and its dedicated owned private-store files. Keep owner .env.local unchanged.

Docker was interrupted after both timing passes; its tmpfs database was recreated for concurrency/regression testing. Measurement JSON survived. Initial browser cookie injection failed; the final private browser measurement used a live synthetic session header restricted to loopback, while original HTTP tests verify real cookies/login. OneDrive discovery failure was corrected without reducing test coverage.

## K. Acceptance

Final classification follows verified results, including the limits above. No production metric or comprehensive browser/security certification is inferred from these checks.

| Criterion | Result | Evidence |
| --- | --- | --- |
| WP13-AC01 | PASS | Recorded original production-build browser/database/API measurements. |
| WP13-AC02 | PASS | All ten public routes, desktop/mobile, three runs per combination. |
| WP13-AC03 | PASS | Twelve authenticated routes plus API, filter and export timings with synthetic sessions. |
| WP13-AC04 | PASS | EXPLAIN ANALYZE and snapshot/finance microbenchmarks identify repeated scans. |
| WP13-AC05 | PASS | Same financial fixture, build mode, machine and harness before/after; workstation-noise limits disclosed. |
| WP13-AC06 | PASS | Original bilingual navigation, metadata and public isolation regressions. |
| WP13-AC07 | PASS | No design/CSS/public composition changes; existing motion hooks retained. |
| WP13-AC08 | PASS | No financial mutation/locking changes; exact-output equality and financial races pass. |
| WP13-AC09 | PASS | Receipt DB/HTTP/PDF integrity, uniqueness, immutable revision and corruption tests. |
| WP13-AC10 | PASS | Existing no-store/private semantics and download headers verified. |
| WP13-AC11 | PASS | Every before/after financial field equal; exact maximum-money regressions pass. |
| WP13-AC12 | PASS | PDF/XLSX/ZIP completeness, checksums, limits and authorization regressions pass. |
| WP13-AC13 | PASS | Moderate synthetic fixture, read concurrency, previews, idempotent retries and capacity race executed. |
| WP13-AC14 | PASS | Existing anonymous/disabled-session/origin/export/private-document regressions pass; no new cache or public data path. |
| WP13-AC15 | PASS | Fresh disposable migration and 169 database results; old migrations untouched. |
| WP13-AC16 | PASS | Exact 13 original trigger names inspected; history/immutability tests pass. |
| WP13-AC17 | PASS | TypeScript, lint, production build and prior module suites pass. |
| WP13-AC18 | PASS | 32 real Edge regressions plus both measured navigation passes; no captured hydration errors. |
| WP13-AC19 | PASS | Explicit motion, loading, frame, memory/mobile and reduced-motion budgets above. |
| WP13-AC20 | PASS | No redesign, production deployment or real customer records; owner files preserved. |
| WP13-AC21 | PASS | PDF/memory/large-snapshot/search/connection and measurement gaps explicitly reported. |
| WP13-AC22 | PASS | Lab versus field clearly separated; INP and field p75 explicitly NOT VERIFIED. |

## L. Remaining risks

Complete company snapshots remain bounded but scale with total business data. Dashboard/report JSON is large; a future endpoint-specific projection/aggregation needs its own consistency and compatibility review. Leading-wildcard search cannot generally seek a conventional name index. Connection setup is still per request; a pool requires separate lifecycle, session-reset and deactivation safety testing. PDF font/layout work and serialized receipt storage remain costs; company PDF did not improve. Larger cursor batches can increase transient memory; RSS improvement was not demonstrated. Sustained multi-user saturation/peak memory/physical-mobile/field INP are unverified.

Approved company content/photography/contact delivery/domain, production hosting/persistent private storage, paired database/PDF backups and accountant validation remain release gates. No real business records, production infrastructure, deployment or purchase were involved.

## M. Next package

Ready for WP-14 security hardening and independent-audit preparation with explicit performance evidence and unchanged financial/auth boundaries. WP-14 was not started. Owner controls all subsequent visual/motion decisions. README.md remains frozen.
