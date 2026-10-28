# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-14: Security Hardening, Private Data Leak Prevention & Independent Audit Preparation

**Project:** Fitimi Construction Management System & Corporate Website  
**Package:** WP-14  
**Version:** 1.0  
**Date:** 28 October 2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Priority:** CRITICAL  
**Authorization:** Local security assessment, scoped hardening, isolated test infrastructure, dependency review, and full regression testing.

**NOT AUTHORIZED:** Production access, deployment, real customer data, destructive changes to owner resources, purchases, public penetration testing, or independent-audit certification.

---

## 1. PRIMARY MISSION

Perform a rigorous security review and implement necessary hardening of the existing Fitimi Construction application.

The owner's primary concern is **unauthorized disclosure or leakage of internal business information**.

Protected data includes:

- Clients and contact records.
- Private projects and contracts.
- Contract amounts and financial phases.
- Incoming payments and allocations.
- Expenses, suppliers and vehicles.
- Numbered receipts and immutable PDF versions.
- Financial reports and XLSX exports.
- Complete ZIP business exports.
- Audit trails and historical snapshots.
- Account, session and operator administration information.
- Database and storage credentials.
- Backups and privately stored documents.

This is not a superficial checklist task.

You must inspect actual code paths, build an attack-surface inventory, reproduce credible vulnerabilities in an isolated environment, remediate verified weaknesses and execute comprehensive security regressions.

Do not claim the application is perfectly secure.

Do not declare independent penetration testing complete; an external qualified reviewer must perform that separately.

## 2. SOURCE AND BASELINE

Inspect actual:

- Git branch and HEAD.
- Working tree and owner modifications.
- AGENTS.md.
- Next.js 16.4.3 application routes.
- React and server/client boundaries.
- Authentication/session implementation.
- Drizzle/MySQL query and transaction services.
- PDF storage and recovery infrastructure.
- Report/ZIP export logic.
- Public website and SEO routes.
- Playwright/browser tests.
- npm dependency tree.
- Existing HTTP and security tests.
- Database migrations and original triggers.

Preserve all prior migrations and business invariants.

WP-13 reportedly passed 357 regression results and improved local report/dashboard performance. Its report also identified that the application currently creates database connections per unit of work and has no connection pool.

Do not change this architecture merely for performance during WP-14.

Preserve the owner's UI/UX direction, README restrictions and local test environment.

No creative redesign.

## 3. SECURITY TARGET

Use:

- OWASP ASVS Level 2 as the application-verification target.
- OWASP Top 10 and API Security Top 10 for systematic coverage.
- Appropriate current Next.js/Node security guidance.
- Relevant secure-deployment and secret-management principles.

Build a verification matrix.

For each applicable control, record:

- Control identifier or category.
- Actual relevant code path.
- Threat being addressed.
- Evidence collected.
- Status: PASS / FAIL / NOT VERIFIED / NOT APPLICABLE.
- Remediation where necessary.
- Remaining risk.

Do not claim ASVS conformance solely from automated testing.

Do not artificially mark controls not applicable to increase passing percentages.

## 4. THREAT MODEL

Document:

### Assets

Financial data, customer records, immutable receipts, full exports, audit history, sessions, secrets, database and private storage.

### Entry points

Public routes, authenticated pages, APIs, Server Actions where present, document downloads, export endpoints, login/logout, operator CLI, deployment configuration and recovery scripts.

### Potential adversaries

- Anonymous internet attacker.
- Attacker holding a stolen or expired session.
- Authenticated user attempting unauthorized operations.
- Malicious or compromised third-party dependency.
- Person with access to leaked logs, exports or backups.
- Attacker exploiting storage or hosting misconfiguration.

### Trust boundaries

- Internet to public website.
- Browser to authenticated API.
- API to business service.
- Application to MySQL.
- Application to private filesystem.
- Export generation to downloadable bytes.
- Operator CLI to account administration.
- Production host to backup infrastructure.

Identify practical data-exfiltration paths and prioritize by business impact and exploitability.

## 5. AUTHENTICATION AND SESSION SECURITY

Inspect and test the current WP-03 implementation.

Review:

- Argon2id password handling and parameters.
- Session-token entropy.
- Token hashing at rest.
- Session expiration and revocation.
- Secure cookie flags.
- SameSite handling.
- Production HTTPS requirements.
- Login rate limiting.
- Account enumeration.
- Concurrent login behavior.
- Logout invalidation.
- Disabled-user invalidation.
- Password reset and operator recovery.
- Session fixation.
- CSRF protection.
- Origin/Host checks.
- Trusted reverse-proxy assumptions.
- Cookie and session behavior across browser environments.

Test real cookies and sessions, not only synthetic injected headers.

Check whether session tokens or sensitive cookies can appear in URLs, logs, error reports or client bundles.

Do not introduce public self-registration or reset endpoints.

The existing operator-only account-management boundary must remain operator-only.

## 6. AUTHORIZATION AND IDOR

Inventory every private route and API endpoint.

Test:

- Anonymous access.
- Invalid session.
- Expired session.
- Revoked session.
- Disabled user.
- Malformed record ID.
- Unknown record ID.
- Cross-entity ID substitution.
- Request payload field injection.
- Direct API access without loading the page.
- Alternate HTTP methods.
- Nested route manipulation.
- Unauthorized document/version downloads.
- Access to historical archived and cancelled records.
- Session revocation during a financial mutation.

All sensitive access decisions must happen on the server.

Do not rely on hidden buttons, client-side routing or navigation visibility.

**Important permission model:**

The five client users currently have equal approved operational permissions.

Do not invent project-level restrictions or new roles.

However, clearly document that any authorized user with full export access may legitimately obtain an extensive copy of business data.

Evaluate stronger export controls as a separately proposed product decision, not a silent permission change.

## 7. HIGHEST-PRIORITY EXFILTRATION REVIEW

Conduct an especially thorough review of:

### Full Business Export

- Authorization and account status.
- Session rechecks before download.
- Complete-data scope.
- Historical records and snapshots.
- Credential exclusions.
- Storage path exclusions.
- Unexpected nested sensitive fields.
- Export audit events.
- Resource limits.
- Rate limiting and abuse.
- Unauthorized replay or sharing.
- CDN/cache behavior.
- Incomplete downloads.
- Filenames and archive metadata.

### Financial PDF/XLSX Reports

- Authorization.
- Cross-user leakage.
- Caching.
- Formula injection.
- Unsafe user-controlled strings.
- Path exposure.
- Error redaction.

### Receipt PDFs

- Live session required.
- Version-level access.
- Immutable storage.
- Path traversal.
- Symlinks/junctions.
- Unsafe storage-root configuration.
- Checksum verification.
- No public static exposure.
- Missing/corrupt file handling.
- Storage recovery command authorization.

### Public Website

- No private data inside statically generated HTML.
- No leaking internal project/customer information.
- No public receipt or export paths.
- No sensitive metadata in sitemap, robots, source maps or generated build artifacts.
- No unsafe public-to-private import boundary.

Use actual synthetic canary customer information in the disposable database, then search responses, generated assets and public build outputs for unintended disclosure.

Report any confirmed leak with its exact route, condition and remediation.

## 8. SECRETS AND LOGGING

Inspect:

- Source and Git-tracked files.
- Next.js public environment variables.
- Build output and runtime traces.
- Development and production error handling.
- Structured or unstructured logs.
- Stack traces.
- Database query errors.
- PDF and ZIP metadata.
- Operator CLI arguments.
- Authentication recovery procedures.
- Generated diagnostic scripts.

Verify that secrets are not included in:

- Client-side JavaScript.
- Static HTML.
- Public source maps.
- HTTP responses.
- Downloadable exports.
- Application logs.
- Audit snapshots.
- Build artifacts committed to Git.

Do not display real secrets in the delivery report.

Use synthetic sentinel values for leak-detection tests.

If any genuine secret is discovered, do not reproduce its value; describe rotation requirements and affected surfaces.

Never perform production rotation without authorization.

## 9. DATABASE SECURITY

Inspect the current MySQL architecture.

Evaluate:

- Database network exposure.
- TLS capability.
- Application-user privilege requirements.
- Migration versus runtime privileges.
- Trigger/function creation privileges.
- Binary logging and the known MySQL trigger-creation constraint.
- Connection configuration.
- Prepared queries.
- Raw SQL safety.
- SQL injection boundaries.
- Transaction isolation.
- Error handling.
- Database backup confidentiality.
- History/financial integrity guards.

Design a least-privilege production database role.

Distinguish:

- Runtime application permissions.
- Migration/deployment permissions.
- Operator/maintenance permissions.
- Backup/restore permissions.

Do not run production GRANT or ALTER USER commands.

If changes require an additive migration, verify that old migrations remain byte-identical.

Do not disable triggers, constraints or audit controls to pass security tests.

## 10. FINANCIAL ABUSE AND BUSINESS-LOGIC SECURITY

Re-test high-risk scenarios:

- Duplicate payment confirmation.
- Reused idempotency key with different payload.
- Unauthorized operation-status lookup.
- Cross-project phase allocation.
- Phase-capacity overrun.
- Concurrent payment and contract edit.
- Incorrect receipt number reuse.
- Immutable document modification.
- Receipt correction without a corresponding payment change.
- Cancellation and correction races.
- Cancelled-payment inclusion in active income.
- Inline category creation rollback.
- Incorrect export totals.
- Audit insertion failure.
- History mutation or deletion attempts.

All financial operations must preserve established row-lock order and exact DECIMAL/BigInt arithmetic.

Do not modify financial business rules without a confirmed defect.

## 11. HTTP, BROWSER AND PLATFORM HARDENING

Review actual Next.js deployment implications, including:

- Security headers.
- Content Security Policy design.
- Trusted script/style requirements.
- Frame embedding and clickjacking protection.
- MIME sniffing.
- Referrer policy.
- HTTPS/HSTS deployment prerequisites.
- Cache-Control.
- Error and not-found responses.
- CORS.
- Cross-origin resource exposure.
- Server Actions where present.
- File download headers.
- Source map exposure.
- Static asset and build artifact leakage.

Use a CSP compatible with the current application.

Do not install a policy that silently breaks React hydration, necessary Next.js scripts, PDF downloads or the owner's future motion code.

Prefer a tested enforcement policy where safe; otherwise document a staged Report-Only rollout.

Do not claim that HSTS works correctly before actual production HTTPS/proxy configuration is tested.

## 12. DEPENDENCY AND SUPPLY-CHAIN REVIEW

Inspect the actual dependency tree and current advisories.

Previous reports identified six moderate advisories involving development tooling and ExcelJS transitive dependencies.

For every current advisory:

- Identify the affected package.
- Installed version.
- Patched available version, if any.
- Whether the vulnerable functionality is reachable.
- Production versus development scope.
- Recommended mitigation.
- Upgrade compatibility and regression risk.

Check currently published authoritative advisories where appropriate.

Do not run blind `npm audit fix --force`.

Apply a minimal, safe upgrade only when justified and supported by full regression evidence.

Record remaining accepted risks and required follow-up.

Also assess:

- Lockfile integrity.
- Unnecessary dependencies.
- Dependency scripts.
- Server-only modules being bundled client-side.
- Direct and transitive runtime package exposure.

Do not claim a clean audit if advisories remain.

## 13. SECURE CONFIGURATION

Produce a production security configuration checklist covering:

- TLS certificate and proxy.
- Environment secrets.
- Secure cookies.
- Allowed origins.
- Network isolation.
- Database least privilege.
- Private receipt storage.
- File permissions.
- Safe deployment directories.
- Backup encryption.
- Log retention and access.
- Monitoring and alerting.
- Deployment separation.
- Emergency account/session revocation.

Do not choose or purchase hosting.

Do not deploy the application.

Document which items cannot be tested locally without a real hosting environment.

## 14. BACKUP AND DISASTER-RECOVERY SECURITY

Review current design requirements:

- Daily off-site backups.
- 30-day retention.
- RPO ≤24 hours.
- RTO ≤48 hours.
- Paired database + immutable receipt document recovery.

Assess:

- Backup encryption.
- Key management.
- Access separation.
- Integrity checks.
- Retention.
- Restore authorization.
- Protection against accidental deletion/ransomware.
- Handling of receipt-storage instance binding.
- Private export and backup confidentiality.

WP-14 should deliver the security architecture and risks.

Actual hosting-specific backup/restore drills are part of WP-15.

Do not claim RPO/RTO compliance without completed restore tests.

## 15. LOCAL SECURITY TEST ENVIRONMENT

Use:

- Task-owned disposable official MySQL 8.4.
- Synthetic users and records.
- Synthetic financial data.
- Synthetic receipt PDFs.
- Private task-owned test storage.
- Local loopback Next.js server.
- Edge/Playwright where supported.

Do not access public production targets.

Do not scan unrelated networks, domains or other applications.

Do not inspect the owner's personal browser profile.

Do not modify unrelated containers or databases.

Keep tests bounded and recoverable.

Before cleanup, confirm ownership labels and actual resource identity.

Preserve the owner's `.env.local`, README and existing development resources.

## 16. REQUIRED SECURITY TESTS

Build a repeatable security test suite including:

### Authentication

- Invalid and expired sessions.
- Session revocation.
- Account deactivation.
- Session token leakage.
- Login rate limiting.
- CSRF/origin rejection.

### API Authorization

- Every private route/API anonymously.
- Malformed/foreign IDs.
- Disallowed methods.
- Unexpected fields.
- Cross-entity relationship manipulation.
- Authenticated but unauthorized operation-key lookup.

### Exfiltration

- Private-data canary leakage.
- Static asset leakage.
- PDF download without session.
- ZIP export without session.
- Unauthorized export replay.
- Metadata and error-based disclosure.
- Unexpected cache exposure.

### Input and Browser

- Stored and reflected XSS.
- Spreadsheet injection.
- Unsafe redirect.
- Clickjacking protections.
- Path traversal.
- Browser cache behavior.
- CSP compatibility.

### Financial Integrity

- Duplicate logical payment prevention.
- Financial cross-project isolation.
- Race conditions.
- Immutable receipt versions.
- Historical audit protections.

### Operational Security

- Secrets in build output.
- Dependency vulnerabilities.
- Database least-privilege assumptions.
- Storage recovery authorization.
- Backup confidentiality requirements.

Use genuine browser/network requests where required.

Do not mark a test PASS if the relevant protection was merely inspected rather than exercised; distinguish code review from dynamic verification.

## 17. REMEDIATION PRINCIPLES

For each confirmed vulnerability:

1. Capture synthetic reproduction evidence.
2. Assess severity and affected data.
3. Identify root cause.
4. Implement the smallest reliable fix.
5. Add a regression test.
6. Re-run related existing tests.
7. Document residual risk.

Prioritize confirmed leakage and authorization defects above lower-risk hardening.

Do not perform broad rewrites.

Do not reduce current security to increase performance.

Do not suppress legitimate validation errors or disable earlier test checks.

Security improvements must preserve usability and business consistency.

## 18. INDEPENDENT AUDIT HANDOFF

Prepare an external security-review package containing:

- Architecture and trust boundaries.
- Endpoint inventory.
- Authentication design.
- Permission model.
- Financial transaction controls.
- Document and export security.
- Storage and backup assumptions.
- Security test results.
- Known vulnerabilities and remediations.
- Open questions.
- Deployment prerequisites.
- Test-environment setup instructions.
- Explicit authorized scope for independent penetration testing.

Never include live secrets.

Do not claim Codex's self-review is equivalent to an independent penetration test.

Recommend a qualified external specialist review before production.

## 19. ACCEPTANCE CRITERIA

**WP14-AC01:** Complete private-data threat model documented.

**WP14-AC02:** Actual private route and endpoint inventory completed.

**WP14-AC03:** Authentication/session design reviewed and dynamically tested.

**WP14-AC04:** Anonymous/expired/disabled session access denied across sensitive endpoints.

**WP14-AC05:** Object-level authorization and ID manipulation reviewed.

**WP14-AC06:** Full export cannot be accessed without current authorization.

**WP14-AC07:** Receipt PDFs and versions cannot be downloaded anonymously.

**WP14-AC08:** Public website and assets do not expose synthetic private canary data.

**WP14-AC09:** Secrets do not appear in checked public bundles/logging/export boundaries.

**WP14-AC10:** Financial integrity and idempotency abuse tests pass.

**WP14-AC11:** PDF storage traversal/overwrite/recovery security tests pass.

**WP14-AC12:** CSRF, Origin/Host and safe request-body validation are verified.

**WP14-AC13:** Browser and HTTP security headers are assessed and hardened appropriately.

**WP14-AC14:** Dependency advisories are individually analyzed and mitigated or documented.

**WP14-AC15:** Database least-privilege roles and production TLS requirements are documented.

**WP14-AC16:** Export confidentiality and sensitive-field exclusions are tested.

**WP14-AC17:** Backup encryption/access/recovery security design is documented.

**WP14-AC18:** No confirmed unresolved Critical/High data-exposure vulnerability remains in the tested scope.

**WP14-AC19:** Prior business, financial, receipt and export regressions pass.

**WP14-AC20:** MySQL migrations, original triggers and financial locking remain intact.

**WP14-AC21:** TypeScript, lint, production build and browser checks pass.

**WP14-AC22:** External independent-audit handoff package is delivered.

**WP14-AC23:** Tests use only isolated synthetic local data and owned resources.

**WP14-AC24:** No deployment, real data or unauthorized external scanning occurs.

**WP14-AC25:** Findings clearly distinguish verified controls, assumptions, residual risk and release blockers.

Report each as PASS, FAIL or NOT VERIFIED.

Do not interpret WP14-AC18 as a guarantee that undiscovered vulnerabilities do not exist.

## 20. REQUIRED DELIVERABLES

### A. Executive Security Assessment

Overall risk posture and highest-priority findings.

### B. Threat Model

Assets, entry points, adversaries, trust boundaries and data-exfiltration scenarios.

### C. Endpoint Matrix

Every private route/API, required authentication and dynamic test outcome.

### D. Findings

Severity, root cause, evidence, fix and residual risk.

### E. Implemented Hardening

Exact changed file paths and purpose.

### F. Authentication & Authorization

Session/cookie/account and object-access test evidence.

### G. Document & Export Security

Private receipt, report, XLSX, ZIP and historical-data leak review.

### H. Database & Infrastructure

Least privilege, TLS, storage, secrets and deployment hardening.

### I. Supply Chain

Exact advisory review, fixes, reachable risks and remaining findings.

### J. Backup Security

Encryption, storage separation, retention and restore prerequisites.

### K. Tests

Commands, outcomes, genuine browser/HTTP tests and regressions.

### L. ASVS Verification Matrix

Applicable controls and evidence, without unsupported certification.

### M. Acceptance

WP14-AC01 through WP14-AC25.

### N. Independent Audit Handoff

Safe scope and instructions for a qualified external reviewer.

### O. Final Release Risk Register

Unresolved blockers, owner decisions and required WP-15 actions.

### P. Next Package

Assess readiness for WP-15 — Final QA, Backup/Restore and Controlled Release Readiness.

Do not start WP-15 automatically.

## 21. EXECUTION

Implement WP-14 locally now.

Inventory the attack surface, investigate actual data-leak risks, dynamically test security boundaries, fix confirmed vulnerabilities and provide a comprehensive evidence-based report.

Prioritize the confidentiality of the internal company system.

Preserve all existing financial, historical, receipt and authentication guarantees.

Do not alter the owner's creative UI/UX direction.

Do not claim independent security certification.

Do not deploy.

Commit/push only under the owner's current explicit authorization.

**END OF WP-14**
