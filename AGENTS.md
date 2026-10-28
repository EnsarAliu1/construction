# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-15: Security Closure, Disaster Recovery, End-to-End QA & Controlled Release Readiness

**Project:** Fitimi Construction Management System & Corporate Website  
**Work Package:** WP-15  
**Version:** 1.0  
**Date:** 28 October 2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Priority:** CRITICAL — DATA CONFIDENTIALITY AND RELEASE SAFETY

**AUTHORIZED:** Local security hardening, functional verification, isolated backup/restore experiments, synthetic data, browser testing, configuration templates and release documentation.

**NOT AUTHORIZED:** Production deployment, real customer data, live infrastructure modifications, production secret rotation, purchase of services, external penetration testing or declaring independent security certification complete.

---

## 1. MISSION

Prepare Fitimi Construction for an evidence-based release decision.

The work package must:

1. Close security defects and applicable unresolved controls that can be safely addressed in the existing local application.
2. Perform full end-to-end QA of the internal application and public website.
3. Implement and test a secure backup/restore reference workflow in isolated infrastructure.
4. Verify database and immutable receipt PDF restoration together.
5. Assess deployment feasibility and minimum production infrastructure requirements.
6. Establish operational monitoring, incident-response and recovery procedures.
7. Review dependency, authentication, privacy and exfiltration risks.
8. Produce an explicit GO/NO-GO release dossier with evidence and remaining blockers.

Do not declare the system production-ready simply because tests pass.

Where production hosting, real HTTPS, accountant approval or independent specialists are required, explicitly classify the control as NOT VERIFIED or EXTERNAL DEPENDENCY.

The project owner controls the final UI/UX and motion-design work; do not redesign the application.

## 2. SECURITY BASELINE FROM WP-14

WP-14 reports:

- 372 passing regression results plus 12 browser scenarios.
- 410 private access-denial requests.
- 30 API route patterns, 38 methods and 25 private page patterns inventoried.
- Two reproduced Medium confidentiality issues corrected.
- Enforced nonce CSP on private dynamic pages.
- Actual Windows/Edge/browser tests.
- Runtime MySQL least-privilege trial.
- Four remaining moderate development-tool dependency advisories.
- No confirmed unresolved Critical/High confidentiality issue in the tested scope.
- No independent penetration test or production security certification.

Most importantly:

OWASP ASVS 5.0 Level 2 matrix:

- 56 PASS.
- 14 FAIL.
- 105 NOT VERIFIED.
- 78 NOT APPLICABLE.

Treat these findings as an actionable security backlog, not a passing certification.

Read the actual delivered WP-14 control matrix and external-audit handoff.

Preserve the actual WP-14 fixes and regression tests.

## 3. REPOSITORY & ENVIRONMENT BASELINE

Before implementation:

- Inspect actual Git branch/HEAD.
- Read AGENTS.md and current owner instructions.
- Preserve uncommitted work.
- Preserve owner .env.local and README restrictions.
- Preserve current development ports, databases, containers and private file stores.
- Inspect all source-controlled security documents and evidence.
- Review migrations 0000–0008 and all 13 integrity/history triggers.
- Verify existing Playwright/Edge and test scripts.
- Identify current dependencies and advisories.
- Verify current website/application route inventories.

Do not assume previous reports perfectly match the present repository.

Never reset or delete unrelated resources.

## 4. WORKSTREAM A — CLOSE SECURITY GAPS

Read every WP-14 ASVS FAIL entry.

For each:

- Identify the specific affected code path or policy.
- Determine whether the issue requires an application change, owner decision, production infrastructure or independent review.
- Implement a safe fix where requirements and behavior are clear.
- Add meaningful automated tests.
- Do not invent business permissions or organizational policies.
- Do not mark a control PASS without real evidence.
- Preserve remaining gaps explicitly.

Prioritize:

1. Private-data exposure and access control.
2. Authentication/session theft resistance.
3. Export and document exfiltration.
4. Secret and infrastructure isolation.
5. Monitoring and incident response.

Do not silently convert unresolved requirements into NOT APPLICABLE.

## 5. AUTHENTICATION HARDENING

Evaluate and address:

- Multi-factor authentication readiness and implementation options.
- Idle-session timeout.
- Absolute session lifetime.
- Login rate limiting.
- Credential stuffing resistance.
- Breached/common-password screening.
- Concurrent session controls.
- Secure session invalidation.
- Operator-only recovery.
- Password-change policy.
- Account disable/revocation behavior.
- Secure cookies and production HTTPS.
- Session fixation and CSRF.

### Important owner decisions

MFA requirements, idle timeout duration and session-count policy may affect the approved business workflow.

Do not unilaterally choose disruptive policies without an approved requirement.

Where no decision exists:

- Implement safe, testable supporting architecture where useful.
- Document the explicit decision needed.
- Do not claim the corresponding ASVS control has passed.

Keep the existing five equal-permission business users and operator-only account provisioning.

No public registration.

No invented administrator role in the application.

## 6. HIGH-RISK FULL EXPORT POLICY

The complete business ZIP contains extensive internal records and immutable receipt PDFs.

Review its security model beyond ordinary login.

Test:

- Authorization at every layer.
- Session revocation before delivery.
- Request confirmation.
- Anti-CSRF defenses.
- Record scope and credential exclusion.
- Secret exclusion inside historical snapshots.
- Export audit.
- Download headers.
- Browser persistence.
- Filesystem or temporary-storage exposure.
- Cross-user replay.
- Repeated-download abuse.
- Export contention.
- Sensitive dataset leakage through error reporting.

Propose stronger controls such as:

- Recent reauthentication.
- Step-up MFA.
- Per-user export limits.
- Operator notification.
- Time-limited approval.
- Enhanced audit alerts.

**Do not silently introduce an approval-only permission model that contradicts the five equal user rights.**

Clearly identify which proposals require the owner's approval.

Any confirmed unauthenticated export path is a Critical release blocker.

## 7. END-TO-END BUSINESS QA

Use synthetic users, projects, contracts, phases, expenses, payments and documents.

Exercise actual browser interactions where feasible.

Complete at least the following workflows:

### Authentication

- Login.
- Invalid password.
- Logout.
- Expired session.
- Revoked session.
- Disabled user.

### Clients

- Create individual/business.
- Edit.
- Search.
- Archive constraints.
- Audit history.

### Projects and Contracts

- Create project.
- Associate client.
- Save contract.
- Create phases.
- Edit phase amounts.
- Verify contract-phase sum.
- Reject invalid phase reduction/deletion.

### References

- Categories.
- Persons/suppliers.
- Vehicles.
- Deactivate/reactivate.
- Reject inactive new associations.

### Expenses

- Company-wide expense.
- Project expense.
- Inline category creation.
- Edit.
- Cancel.
- Verify audit and correct totals.

### Incoming Payments

- Register payment.
- Split across multiple phases.
- Verify exact allocation sum.
- Reject overcapacity.
- Correct payment.
- Cancel payment.
- Verify capacity is released.

### Receipts

- Numbered PDF issuance.
- Authorized download.
- Correction creates next immutable version.
- Old document remains unchanged.
- Cancelled status is visible.
- Repeated operation does not duplicate receipt.

### Dashboard and Reports

- Actual company totals.
- Project on-screen summaries.
- Company PDF/XLSX reports.
- Full business ZIP export.
- Exact reconciliation after corrections/cancellations.

### Public Website

- Ten SQ/EN routes.
- Navigation/language switching.
- Public/private data isolation.
- Responsive layouts.
- Contact behavior.
- SEO and noindex safeguards.

Use real Playwright browser interaction, not just HTTP status checks, for a representative complete transaction flow.

## 8. SECURITY-FOCUSED BROWSER QA

Exercise:

- Desktop and mobile viewports.
- Keyboard navigation.
- Focus and dialogs.
- Hydration.
- Console errors.
- Browser back/refresh.
- Login/logout session state.
- Uncertain network responses.
- Receipt downloads.
- Export downloads.
- CSP behavior.
- Reduced motion.
- XSS probes using harmless synthetic markers.
- Disabled-session redirects.
- Browser data persistence after logout.

Automated axe scans are useful but do not prove full WCAG conformance.

Document manual accessibility checks requiring human verification.

Do not alter the owner's final design direction.

## 9. BACKUP SYSTEM REQUIREMENTS

Approved targets:

- Daily off-site backup.
- Thirty-day retention.
- RPO <= 24 hours.
- RTO <= 48 hours.

These are targets until measured in the chosen production infrastructure.

A backup must include:

- MySQL business and authentication state.
- Required schema/migration consistency.
- Immutable numbered receipt PDFs.
- Receipt storage ownership metadata.
- Necessary configuration identifiers.
- An appropriate security-controlled restore procedure.

A customer ZIP export is not an adequate replacement for a system backup.

Do not include plaintext credentials in an unencrypted backup.

## 10. BACKUP CONFIDENTIALITY

Implement a local testable backup design using:

- Authenticated backup operator.
- Separate backup credentials/permissions.
- Encryption at rest.
- Key separation from the backup files.
- Integrity manifest/checksums.
- Access restriction.
- Safe filenames.
- Reliable retention metadata.
- No backup output in public assets.
- No secret exposure through process arguments/logs.
- Auditable backup/restore operations.

Use a modern maintained encryption method/library available in the environment.

Do not invent a custom cryptographic algorithm.

For local tests, use generated synthetic secrets.

Never include private decryption keys in the same backup artifact they protect.

Document safe key loss/recovery and key-rotation requirements.

## 11. CONSISTENT MYSQL + RECEIPT RESTORE

**This is a critical integration requirement.**

Test backup and restoration of the database and private PDF storage as one coherent recovery set.

Because these are separate persistence systems, a naive copy during an active issuance could yield mismatches.

Design and test a safe coordination protocol such as:

- Controlled application quiescence or a proven consistent backup boundary.
- Storage advisory lease coordination where appropriate.
- Consistent MySQL dump/snapshot.
- Matching immutable receipt files.
- Receipt counter state.
- Receipt identity/version metadata.
- Storage ownership binding.
- Reconciliation of referenced PDFs and SHA-256 hashes.

Do not claim atomicity across MySQL and filesystem without a justified mechanism.

The restore must preserve:

- Payment identities.
- Original receipt numbers.
- All receipt versions.
- PDF contents.
- Receipt checksums.
- Audit/version history.
- Idempotency state where relevant.
- Cancellation metadata.
- Current business totals.

Fail closed on missing or mismatched documents.

Never silently renumber receipts after a restore.

## 12. ACTUAL RESTORE DRILL

Execute a complete isolated restore rehearsal:

1. Prepare disposable MySQL and private receipt store.
2. Create actual synthetic users/projects/payments/receipts.
3. Record baseline totals and receipt checksums.
4. Produce a protected paired backup.
5. Restore into a fresh independent task-owned environment.
6. Apply any required instance/store rebinding through an explicit operator-authorized step.
7. Verify the restored database, migrations and triggers.
8. Verify original receipt PDFs by SHA-256.
9. Verify current financial totals.
10. Verify historical receipt versions.
11. Verify restored sessions cannot bypass revocation or the intended post-restore authentication policy.
12. Exercise authenticated reads and one valid post-restore payment/receipt operation.
13. Record actual elapsed backup and restore times.
14. Confirm no cross-contamination with the source environment.

Include failure-injection tests:

- Corrupt archive.
- Missing PDF.
- Wrong decryption key.
- Tampered manifest.
- Incomplete paired backup.
- Unauthorized restore attempt.
- Different server/storage identity.
- Disk-full simulation where safely feasible.

Do not claim production RPO/RTO compliance from a small disposable local drill.

## 13. PRODUCTION INFRASTRUCTURE FEASIBILITY

Review actual documented deployment requirements.

Do not assume the selected hosting tier supports everything.

Verify or explicitly mark unknown:

- Persistent Node.js/Next.js server execution.
- MySQL version and InnoDB.
- Trigger support and migration privileges.
- Binary-log restrictions during deployment.
- Private persistent writable storage.
- Directory permissions.
- File synchronization/durability guarantees.
- Process restart behavior.
- TLS certificates.
- Reverse proxy and trusted origin handling.
- Isolated MySQL network.
- Off-site backups.
- Retention and encryption.
- Scheduled jobs/operator recovery.
- Resource limits.
- Monitoring/log shipping.
- Disaster recovery feasibility.

Existing receipt storage relies on a persistent shared filesystem, not a stateless ephemeral serverless filesystem.

If the intended hosting cannot support the architecture, classify deployment as NO-GO for that host.

Do not weaken the security or durability requirements to accommodate inexpensive hosting.

Prepare a compatibility matrix without purchasing infrastructure.

## 14. DEPENDENCY AND BUILD SECURITY

Review current `npm audit`.

Track the four remaining moderate advisories.

Determine whether safe patched versions have become available.

Do not force a historical Drizzle migration tool downgrade.

Run:

- Dependency integrity checks.
- Runtime versus development dependency exposure review.
- Lockfile review.
- Build-output inspection.
- Source-map/private configuration exposure tests.
- No-secrets-in-artifacts tests.

Where updates are safe, validate them through full regression tests.

Do not claim clean audit if findings remain.

## 15. MONITORING AND INCIDENT RESPONSE

Prepare a practical operational plan for:

- Failed login bursts.
- Unexpected access denials.
- Excessive business exports.
- Receipt corruption.
- Database downtime.
- Storage availability failure.
- Failed backups.
- Backup restoration alerts.
- Unusual error rates.
- Application restarts.
- Suspected credential compromise.

Specify:

- Which events should be monitored.
- What must never be logged.
- Alert thresholds or configurable policies.
- Operator response.
- Session revocation.
- Secret rotation procedure.
- Evidence preservation.
- Business communication/escalation.
- Recovery confirmation.

Implement non-sensitive structured events or instrumentation where safe and useful.

Do not send real financial values, passwords, tokens or raw PDF content into monitoring systems.

Do not configure external alert receivers without approval.

## 16. QA OF FINANCIAL INTEGRITY AFTER RECOVERY

Test that restored data respects:

- Exact EUR decimal values.
- Contract total equals phase totals.
- Payment allocations equal payment amount.
- Phase capacity constraints.
- Correct active received amounts.
- Correct active expenses.
- Cancelled-state exclusions.
- Receipt number uniqueness.
- Receipt version immutability.
- Correct receipt counter continuation.
- Complete audit/history.
- Idempotent retry behavior.

After restore, execute real independent-connection financial race tests against the recovered environment where feasible.

No restoration process may suppress existing SQL triggers or rewrite immutable receipt history.

## 17. PERFORMANCE REGRESSION

Re-run critical WP-13 metrics where practical:

- Dashboard API.
- Company report API.
- Financial snapshots.
- Receipt download.
- Company PDF/XLSX.
- ZIP export.
- Public page browser loading.
- Selected private navigation.

Security changes must not produce severe undocumented performance regressions.

If stronger authentication, encryption or auditing causes overhead, measure it honestly.

Do not weaken security merely to recover benchmark scores.

## 18. CRITICAL RELEASE GATES

A final GO recommendation is prohibited if any of these remain:

- Confirmed unresolved Critical/High confidentiality vulnerability.
- Unverified authentication bypass on exposed sensitive routes.
- Public access to private customer records, receipts or exports.
- Unprotected production secrets.
- Publicly reachable production database without appropriate isolation.
- Unsupported or insecure production hosting.
- No verified private persistent receipt storage.
- No independently restorable encrypted backup.
- Financial/receipt integrity failures.
- Missing appropriate accountant approval for issued business documents.
- Missing qualified independent penetration test.
- Missing mandatory owner approvals on security policy.
- Missing final UI/UX and public-content signoff.
- No production-environment TLS/reverse-proxy/security verification.

A local implementation cannot alone clear production-dependent gates.

Declare **NO-GO FOR PRODUCTION** until required evidence exists.

## 19. REQUIRED TESTING

Run and preserve all established suites:

- Unit tests.
- MySQL integration.
- Security integration.
- Authentication HTTP.
- Payments/expenses/receipts HTTP.
- Reporting/export HTTP.
- Website isolation.
- Edge/Playwright website browser.
- Edge security browser.
- Payment recovery browser.
- New complete business-flow browser tests.
- New backup/restore drills.

Also run:

- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run db:check`
- Appropriate migration verification.
- Relevant route checks.
- Dependency review.

Use task-owned synthetic resources only.

Do not disable previous tests to achieve a pass.

Separate successful test outcomes from unverified production assumptions.

## 20. ACCEPTANCE CRITERIA

**WP15-AC01:** Every WP-14 ASVS FAIL is mapped to a fix, owner decision or explicit release blocker.

**WP15-AC02:** Applicable high-impact locally remediable security gaps are addressed and retested.

**WP15-AC03:** Full private-route authorization regression passes.

**WP15-AC04:** Receipt/export confidentiality and no-store rules pass.

**WP15-AC05:** Actual browser end-to-end business workflows are tested.

**WP15-AC06:** Financial accuracy and cancellation/correction behavior remain correct.

**WP15-AC07:** Immutable receipt PDFs and version histories remain valid.

**WP15-AC08:** Encrypted paired database/document backup implementation is tested locally.

**WP15-AC09:** Restore into an independent fresh environment succeeds.

**WP15-AC10:** Restored receipt PDFs match stored SHA-256 values.

**WP15-AC11:** Corrupt, missing and unauthorized restore cases fail safely.

**WP15-AC12:** Post-restore payment numbering, allocations and idempotency are valid.

**WP15-AC13:** Backup/restore elapsed time and environment are reported honestly.

**WP15-AC14:** Production RPO/RTO remain NOT VERIFIED until real infrastructure drills.

**WP15-AC15:** Target-host capability matrix identifies verified and unknown prerequisites.

**WP15-AC16:** Dependency advisories and build-secret boundaries are rechecked.

**WP15-AC17:** Monitoring, incident-response and operator recovery documentation are delivered.

**WP15-AC18:** Critical authentication and payment/receipt concurrency regressions pass.

**WP15-AC19:** All original migrations, guards and audit history remain intact.

**WP15-AC20:** TypeScript, lint, production build and existing browser tests pass.

**WP15-AC21:** Core performance regressions are assessed without compromising security.

**WP15-AC22:** No real data or production resources are modified.

**WP15-AC23:** External audit and accountant/owner approval gaps remain accurately documented.

**WP15-AC24:** A complete release GO/NO-GO evidence dossier is delivered.

**WP15-AC25:** The report does not claim production readiness while mandatory gates remain unverified.

Classify each item:

- PASS
- FAIL
- NOT VERIFIED
- BLOCKED BY EXTERNAL DECISION

Do not convert blocked production requirements into artificial PASS results.

## 21. REQUIRED DELIVERY REPORT

### A. Executive Result

Security posture and local readiness verdict.

### B. ASVS Closure Ledger

Each unresolved WP-14 item, action and remaining risk.

### C. End-to-End QA

Actual browser business scenarios, results, screenshots and failures.

### D. Backup Architecture

Encryption, keys, storage separation, paired snapshot strategy and retention.

### E. Restore Drill

Exact environments, commands, checksums, timing and evidence.

### F. Recovery Failure Scenarios

Tampered/missing/wrong-key/partial/unauthorized behavior.

### G. Infrastructure Feasibility

Target-host matrix and deployment limitations.

### H. Operational Monitoring

Alerts, logs, incident playbooks and operator actions.

### I. Dependency Security

Current advisories, patches and unresolved risks.

### J. Performance Regression

Critical before/after or baseline comparisons.

### K. Files Changed

Exact paths and purpose.

### L. Verification

Commands, distinct result counts and integrity checks.

### M. Acceptance

WP15-AC01 through WP15-AC25.

### N. Release Gate Matrix

Each production prerequisite: VERIFIED / NOT VERIFIED / BLOCKED / FAIL.

### O. Independent Audit Handoff

Outstanding security-review scope and safe evidence package.

### P. Final Recommendation

Explicit local QA readiness and separate production GO/NO-GO.

## 22. EXECUTION

Proceed with WP-15 locally now.

Prioritize security gaps and confidentiality first.

Test actual end-to-end financial workflows.

Implement and verify encrypted paired backup/restore in isolated infrastructure.

Preserve the original database/filesystem/receipt security boundaries.

Document production infrastructure feasibility and operational readiness.

Never invent positive evidence for work that depends on unavailable production services.

Do not alter the owner's visual/creative design.

Do not deploy.

Commit/push only within the owner's current explicit authorization.

**END OF WP-15**
