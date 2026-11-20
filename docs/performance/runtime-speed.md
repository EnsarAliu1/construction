# Application speed verification — 20 November 2026

Baseline: `main`, `eb13ebd`. The working tree was clean. This change preserves the existing visual system, public pages, MFA/passkeys, live session checks, business validation, exact decimal arithmetic and financial history. No dependency, migration, README or owner environment changes. No production access or deployment.

## Changes

- `src/features/reporting/finance.ts`: prepare snapshot indexes, allocation validation and all-time project/phase balances once for related reports. `finances()` remains compatible; `financeReports()` lets the dashboard calculate all-time and monthly projections from that same preparation. No private data is cached between calls or requests.
- `src/features/dashboard/overview.ts`: use related projections and reuse fixed business-timezone formatters.
- `src/lib/presentation.ts`: reuse the timestamp formatter instead of constructing an ICU formatter for every row. Inputs, timezone, date-only handling and output remain unchanged.
- `src/lib/money-format.ts` and six reporting/project/payment/expense consumers: separate exact EUR display from dashboard/finance implementation. Production tree shaking already handled this well; no bundle reduction is claimed.
- `src/server/db/config.ts`: initialize the same three MySQL session variables in one `SET` statement instead of three round trips. Version checks, connection isolation, strict SQL modes, UTC, InnoDB, timeout and disabled multi-statement execution remain intact. MySQL supports multiple assignments in a single [SET statement](https://dev.mysql.com/doc/refman/8.4/en/set-variable.html).
- `tests/reporting/validation.test.ts`: add regression coverage for related filters, amounts beyond safe Number precision, snapshot immutability/freshness and corruption outside the selected period.
- `scripts/performance/runtime-local.mjs` and `runtime.ts`: reproducible, explicitly isolated production/MySQL/Edge measurement and financial-equivalence verification.

## Measurements

Full sanitized evidence: [runtime-speed.json](runtime-speed.json). All values below are sample medians in milliseconds. Same task-owned database and fixture before/after: 1,001 projects, 5,907 financial snapshot rows, balanced contracts/phases/allocations, synthetic enrolled MFA account and one real generated receipt. Original thirteen triggers verified. Browser: actual Edge 157.0.4341.60.

| Operation | Before | After | Change |
| --- | ---: | ---: | ---: |
| Format 1,000 timestamps | 118.62 | 11.98 | 89.9% lower |
| Dashboard page, full HTTP body | 195.85 | 169.95 | 13.2% lower |
| Projects page, full HTTP body | 80.90 | 63.42 | 21.6% lower |
| Clients page, full HTTP body | 76.92 | 57.61 | 25.1% lower |
| Dashboard API | 181.47 | 162.80 | 10.3% lower |
| Projects API | 35.53 | 29.80 | 16.1% lower |
| Payments API | 39.59 | 30.63 | 22.6% lower |
| Company report API | 194.47 | 141.48 | 27.3% lower |
| Dashboard pure computation | 19.83 | 19.70 | Essentially unchanged |
| Connection initialization | 9.27 | 9.07 | Essentially unchanged |
| Financial snapshot | 77.93 | 97.84 | 25.5% higher |

CPU samples: 30; timestamps: 8 × 1,000; snapshot/connection: 10; each HTTP route: 7; each Edge navigation: 4, after a warmup. Measurements are sequential runs on the same Windows workstation, without network/CPU throttling. They include scheduling, database and cache variability. Reduced round trips are structural; measured page improvements cannot all be attributed to them.

Full Edge navigation medians were dashboard 705 → 715 ms, projects 465 → 537 ms, clients 445 → 475 ms, reports 704 → 671 ms. There is **no demonstrated general browser-navigation speedup** in these small samples. Total generated JavaScript gzip was essentially unchanged (337,594 → 337,685 bytes). No universal speed multiplier or production percentile is claimed.

## Correctness and verification

The optimized dashboard was deep-compared against the entire saved baseline output, including all-time/monthly reports, every project and phase, totals, categories, methods, recent transactions and labels. Only snapshot generation timestamps were excluded. It matched exactly. This is a comparison against the original implementation, separate from the unit tests.

The real MySQL measurement also asserts UTC, InnoDB, the exact strict SQL-mode set and `multipleStatements=false`. Every measured private response must succeed with `no-store`; Edge navigation must reach the requested page without login redirects or browser runtime errors.

Reproduction (port 3000 must be free; existing local MySQL on 3307):

```powershell
node scripts/performance/runtime-local.mjs setup
# Build the baseline checkout before measuring baseline.
node scripts/performance/runtime-local.mjs measure baseline
# Apply the changes, rebuild production, then:
node scripts/performance/runtime-local.mjs measure optimized
node scripts/performance/runtime-local.mjs cleanup
```

The runner refuses occupied app ports and validates database/user patterns plus MySQL server UUID before reuse/cleanup. It creates a random disposable schema and restricted database user, generates synthetic keys and completes genuine password/TOTP enrollment. Keys and tokens stay in ignored task files until cleanup, never in this report. Cleanup removes only the validated task schema/users/receipt directory and credentials; sanitized measurements remain.

Completed checks:

- Existing unit suite: 92 passing results, followed by the expanded financial suite (10 passing, including two new regressions), for 94 distinct passing results.
- TypeScript, ESLint with zero warnings, production build and `git diff --check`: passed. Lint needed the normal account because the sandbox could not traverse the existing private receipt directory.
- 51 real Edge/MySQL workflow/security scenarios: workspace 8, dashboard 5, management 9, polish 10, passkeys 19. Covered exact monthly/all-time totals, creation/editing, balanced contracts, payments and protected receipt PDFs, expenses, searching/filtering, actual PDF/XLSX report downloads, modal back/forward and unsaved changes, mobile/desktop light/dark accessibility, private-route denial, MFA enrollment, challenge isolation, replay/concurrent-submit protection and session/account revocation. The passkey authenticator was virtual CTAP2; no physical biometric/PIN claim.
- Full original-versus-optimized financial output comparison and real MySQL session invariants: passed.
- Both task-owned test schemas/users were disposed; performance keys/tokens/receipt directory removed. Owner database, migrations and original integrity triggers were preserved.

The separate historical `test:db`, restore drill and full WP-16 audit matrix were not rerun; this is a scoped performance regression verification, not a new authentication release gate. The installed Next.js 16.4.3 emits an existing security advisory; a successful retry of its build is not a security clearance. A dependency-security upgrade is separate from this performance change. No commit, push or deployment was performed.
