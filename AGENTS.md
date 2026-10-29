# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-16: Mandatory Multi-Factor Authentication, Secure Enrollment & Account Recovery

**Project:** Fitimi Construction Management System & Corporate Website  
**Package:** WP-16  
**Version:** 1.0  
**Date:** 28 October 2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Priority:** CRITICAL — AUTHENTICATION AND DATA CONFIDENTIALITY

### Explicit owner approval

The project owner has approved **mandatory MFA for all five business users**.

For WP-16, implement password + TOTP authenticator-app verification as the baseline, along with secure enrollment, single-use recovery codes and a tightly controlled operator-assisted recovery workflow.

Do not interpret this as approval for new business roles, public registration, self-service password recovery, SMS authentication, unlimited MFA resets or production deployment.

**Authorized:** Local implementation, necessary dependencies, additive migrations, disposable MySQL testing, synthetic accounts, genuine Edge/Playwright browser verification and security documentation.

**Not authorized:** Production deployment, real accounts/data, external messaging services, purchases, modifications to owner environments or security-policy changes outside this scope.

---

## 1. MISSION

Integrate mandatory MFA into the existing WP-03 authentication architecture.

Deliver an actual secure end-to-end login flow:

**Password → MFA verification → Fully authenticated session → Private application access.**

All five active business users must enroll in and use MFA.

The implementation must prevent:

- Password-only private access.
- Partially authenticated sessions entering the application.
- MFA enrollment or reset without appropriate identity verification.
- Recovery codes being reused.
- TOTP replay.
- MFA brute-force attacks.
- MFA bypass through direct API or page requests.
- Session fixation or elevation of pre-MFA credentials.
- Stolen or revoked sessions retaining access.
- MFA secrets appearing in logs, client persistence or exports.
- Operator-assisted recovery silently disabling MFA permanently.

Do not replace or duplicate the existing login architecture.

This is an implementation and security-verification work package.

## 2. REPOSITORY BASELINE

Reported completed work packages:

- WP-01–WP-11: Application and public website foundation.
- WP-13: Performance engineering.
- WP-14: Security hardening and ASVS assessment.
- WP-15: Local end-to-end QA and encrypted recovery implementation.

WP-15 reports:

- 374 passing automated results plus 25 browser workflow scenarios.
- Actual MySQL 8.4.13 integration.
- Nine existing database migrations, 0000–0008.
- Twenty-one tables in the restored environment according to its schema inspection.
- Thirteen original integrity/history triggers.
- Argon2id passwords.
- Eight-hour absolute session lifetime.
- Operator-only provisioning/reset/deactivation.
- No existing MFA implementation.
- Outstanding security controls and NO-GO for production.

Before editing:

1. Read current AGENTS.md.
2. Inspect branch, HEAD and working tree.
3. Preserve owner modifications.
4. Read existing authentication code and domain guards.
5. Inspect auth_sessions, auth_account_control, users and authentication middleware/proxy.
6. Read WP-14 ASVS matrix and WP-15 closure ledger.
7. Inspect account provisioning/reset CLI.
8. Inspect database migrations and history protection.
9. Review existing test and browser infrastructure.
10. Check actual dependency versions and existing security advisories.

Preserve README.md and .env.local if current owner instructions require this.

Do not assume historical reports are exhaustive.

## 3. CORE MFA POLICY

Implement MFA for **every active business user**.

There is no MFA-exempt business user.

Do not add an application superadmin role.

Adore's operator CLI retains its separate secure operator-control boundary.

Existing five equal business-user permissions remain unchanged.

### Required authentication factors

1. Existing password.
2. Valid enrolled TOTP authenticator.

Approved emergency recovery mechanisms:

- Single-use recovery code.
- Secure, operator-assisted factor reset following documented independent identity verification.

A recovery code substitutes for the missing TOTP factor only within a controlled recovery flow after successful password authentication. It must not grant passwordless access.

Do not implement SMS or email OTP as a fallback.

Do not enable a permanent MFA bypass.

## 4. LOGIN STATE MACHINE — CRITICAL

Model authentication states explicitly:

- Anonymous.
- Password verified but MFA pending.
- Enrollment required.
- MFA challenge pending.
- Fully authenticated.
- Revoked/expired/disabled.

The existing session and authentication design must distinguish limited pre-MFA state from a full application session.

**A password-success event must never create a full-access session before MFA completes.**

Suggested approach:

- Use a short-lived server-held pre-authentication challenge.
- Bind it to the relevant user and authentication attempt.
- Store only an opaque, high-entropy challenge identifier in an appropriately secured browser cookie.
- Persist the challenge state/hash server-side.
- Expire and consume challenges safely.
- Issue the normal full session only after successful enrolled-factor verification or approved recovery.
- Rotate session identity at authentication completion.

If an alternate architecture is safer within the existing codebase, document and prove it.

### Challenge restrictions

A pre-MFA credential may access only narrowly defined authentication endpoints, such as:

- Challenge status.
- TOTP verification.
- MFA enrollment when explicitly permitted.
- Recovery-code verification.
- Logout/cancel of incomplete login.

It must NOT access:

- `/app`.
- Private business APIs.
- Dashboard.
- Clients, projects or contracts.
- Payments and expenses.
- Receipt PDFs.
- Financial reports.
- Business ZIP export.
- Audit/history data.
- Authenticated Server Actions.
- Full account sessions or operator functions.

The private application must reject pre-MFA state even if the browser has passed password verification.

## 5. EXISTING SESSIONS AND MIGRATION

A significant security hazard is deploying MFA while existing password-only sessions remain valid.

Implement a deliberate transition policy.

When mandatory MFA enforcement is activated:

- Existing sessions must not silently remain trusted as MFA-verified.
- New or upgraded authentication assurance must be represented server-side.
- Existing sessions must be invalidated or forced through a secure reauthentication transition.
- Session cookies and existing auth_version semantics must remain consistent.
- Disabled and revoked users must remain blocked.
- No active full session may be issued from legacy password-only state.

The rollout must fail closed.

Do not merely add a new MFA UI while leaving old session checks unchanged.

For development/testing, simulate pre-migration legacy accounts and sessions and prove they cannot bypass MFA after the migration.

Do not apply any migration to the owner's manual-test or production database without current authorization.

## 6. FIRST-TIME MFA ENROLLMENT

All five users need a secure setup process.

For an active user without enrolled MFA:

1. User enters valid password.
2. Server creates a narrowly scoped, short-lived enrollment challenge.
3. Server generates a strong random TOTP seed.
4. Present the seed once via a valid authenticator provisioning URI/QR code and a manual-entry alternative.
5. User configures the authenticator application.
6. User submits a valid current TOTP code.
7. Server verifies it under strict attempt limits and freshness checks.
8. Server atomically activates the factor.
9. Generate a set of cryptographically random single-use recovery codes.
10. Display the codes only once through an authenticated, no-store response.
11. Require explicit user acknowledgement that codes have been saved.
12. Only then complete the full login or safely continue a full-session issuance flow.

Do not consider showing a QR code sufficient proof of enrollment.

Enrollment is complete only after proving possession of the TOTP secret.

If enrollment is abandoned, expired or fails:

- Do not activate an unverified factor.
- Do not issue a full application session.
- Clean up expired pending state safely.

Prevent simultaneous enrollment from creating two contradictory primary factors.

Avoid account enumeration through enrollment endpoints.

## 7. TOTP DESIGN AND VERIFICATION

Implement standards-compatible TOTP with appropriate interoperable algorithm, digits and timestep.

Prefer an audited, maintained implementation rather than inventing cryptographic primitives.

Requirements:

- Cryptographically random seed.
- Secure server-side seed storage.
- Authenticated encryption at rest, with encryption key outside the database and source control.
- Key-version identifiers for future rotation.
- Explicit issuer/account naming without exposing unnecessary company or private information.
- Strict numeric code validation.
- Narrow accepted time window.
- Constant-time comparison where applicable.
- Account-specific and challenge-specific rate limits.
- Single-use acceptance of each valid TOTP time step.
- Atomic replay prevention across concurrent requests.
- Correct behavior around valid timestep boundaries.
- No reuse of successful codes within their accepted validity period.
- No TOTP secret logging, auditing in plaintext, URL query leakage or browser storage persistence.

Database transaction coordination must prevent two simultaneous submissions of the same TOTP code from creating two valid authenticated sessions.

Do not store raw TOTP seeds in audit snapshots.

Do not treat a 6-digit code as sufficient protection without rate limiting and replay defense.

## 8. TOTP SECRET KEY MANAGEMENT

The TOTP seed is a long-lived authentication secret.

Protect it separately from the login password hash.

Implement:

- Authenticated encryption of TOTP secrets.
- Server-only access.
- Key separation from database dumps.
- Key identifiers for future rotation.
- Explicit refusal to activate MFA if the encryption key is absent or invalid.
- No permissive default encryption key.
- No automatic plaintext fallback.
- No key disclosure in exception responses or diagnostics.
- Documented operator rotation/recovery process.

A stolen database snapshot alone must not disclose plaintext TOTP seeds.

A compromised application host holding the encryption key remains a separate threat; document this residual risk.

Do not invent a production vault or assume one exists.

For isolated tests, use task-owned synthetic encryption keys outside Git.

## 9. SINGLE-USE RECOVERY CODES

Generate a fixed, documented number of high-entropy recovery codes during successful enrollment.

Use a secure random source.

Properties:

- Human-readable and reasonably transcribable.
- Sufficient entropy for offline-guessing resistance.
- Individually stored as nonreversible verifiers.
- Never stored as plaintext after initial display.
- Each code usable at most once.
- Successful consumption is atomic.
- Concurrent duplicate use has exactly one winner.
- Strict rate limits and logging without recording the code.
- Remaining unused-code count may be shown after a fully authenticated security check.
- Codes may be replaced only after appropriate step-up verification.

On use during login:

- The password must already be verified.
- The recovery challenge must be valid and user-bound.
- The code must be consumed atomically.
- A single fully authenticated session may then be issued.
- Record a security event.
- Do not expose the recovery code in URLs, browser storage or logs.

Do not implement unlimited recovery attempts.

Do not permit an expired challenge to become valid merely because the recovery code is correct.

## 10. OPERATOR-ASSISTED FACTOR RECOVERY

Users may lose their authenticator device and all recovery codes.

The current Adore operator model is a privileged recovery boundary.

Implement a narrowly scoped operator-only MFA reset operation through the existing secure CLI.

### Mandatory operator security behavior

- Require the existing operator capability.
- Require the operator to follow a documented independent identity-verification procedure.
- Record the target account and reason.
- Require deliberate explicit confirmation.
- Revoke the target user's active sessions and pending MFA challenges.
- Invalidate existing TOTP factor and recovery-code verifiers.
- Advance the appropriate authentication version.
- Force secure enrollment on next valid password login.
- Preserve audit history.
- Never reveal the old TOTP seed.
- Never issue a usable session to the operator on behalf of the user.
- Never silently leave the user permanently password-only.

Implement an auditable recovery state, not a hidden `mfaDisabled=true` escape hatch.

If the operator cannot independently verify the user's identity, the secure answer is to deny/reset later.

Do not create a public MFA reset endpoint.

Do not invent a support email or external notification channel.

Document a future second-person verification option if appropriate, but do not claim it is implemented without an approved operator process.

## 11. FACTOR CHANGE AND RE-ENROLLMENT

An authenticated user who still possesses their MFA factor may need to replace a phone.

Do not allow this based on a valid session cookie alone.

Require recent successful password verification AND current MFA challenge before factor replacement.

For replacement:

1. Authenticate and step up.
2. Generate a new pending secret.
3. Prove possession with a fresh TOTP code.
4. Atomically rotate to the new active factor.
5. Invalidate prior factor and recovery codes.
6. Issue new recovery codes.
7. Revoke or upgrade existing sessions according to a documented safe policy.
8. Record an audit/security event.

If preserving the old active factor until new confirmation, avoid a period where unverified new credentials bypass MFA.

Do not silently maintain two active factors unless the multi-factor policy explicitly supports that.

## 12. FULL-SESSION ISSUANCE

Only after successful MFA:

- Create a new opaque, high-entropy full session.
- Preserve secure HttpOnly cookie semantics.
- Bind the session to the current active user and auth_version.
- Record the MFA assurance state in trustworthy server-owned data.
- Ensure disabled-user and revocation checks still apply.
- Keep absolute session expiration.
- Prevent pre-authentication tokens from being accepted as session tokens.
- Revoke or consume the completed MFA challenge.
- Avoid session fixation and identifier reuse.

No trust decision may rely on browser-controlled `mfaPassed` fields or query parameters.

Avoid setting sensitive credentials in localStorage/sessionStorage.

## 13. API AND PAGE AUTHORIZATION

All business pages, APIs and public domain services must require FULLY AUTHENTICATED state.

Test every private API family:

- Clients.
- Projects.
- Contracts/phases.
- Categories.
- Persons/suppliers.
- Vehicles.
- Expenses.
- Payments.
- Operation recovery.
- Receipts and version downloads.
- Dashboard.
- Reports.
- Complete business export.
- Audit/history reads.

Test all sensitive HTTP methods and Server Actions.

A pre-MFA challenge must never be a business authorization credential.

Preserve existing live session checks, request-scoped authorization and response no-store policies.

Do not weaken existing CSRF Origin/Host verification.

## 14. LOGIN AND ENROLLMENT UI

Implement functional UI, without redesigning the owner-controlled visual system.

Required states:

- Enter password.
- Enter authenticator code.
- First-time MFA setup.
- QR/manual secret entry.
- Enrollment verification.
- One-time recovery-code display.
- Recovery-code login.
- Expired challenge.
- Invalid code.
- Too many attempts.
- Operator reset requires new enrollment.
- Safe retry and logout.
- Account disabled.

Use existing Operational Clarity components/tokens.

Accessibility:

- Keyboard-operable forms.
- Correct labels/autocomplete attributes.
- Visible errors and focus management.
- Mobile-friendly code inputs.
- No arbitrary short clipboard restrictions for recovery codes.
- Screen-reader status messages.
- No secrets embedded in HTML intended for public caching.

Do not introduce motion or artistic redesign; the owner handles final UI/UX personally.

## 15. AUTHENTICATION RATE LIMITING

Preserve existing login throttling.

Add strict limits for:

- TOTP verification.
- Recovery-code verification.
- Enrollment attempts.
- Factor replacement.
- Operator MFA reset attempts where appropriate.

Rate limits must be enforced server-side, persisted or otherwise coordinated appropriately for the current architecture.

Do not rely solely on a memory counter in one Node.js process.

Avoid login/OTP endpoint enumeration.

Rate-limit failures must not reveal whether a targeted account has MFA.

Use safe operational signals without logging passwords, OTPs, seeds or recovery codes.

## 16. SECURITY EVENTS AND AUDIT

Record meaningful security events for:

- MFA enrollment completed.
- MFA challenge failed or throttled.
- Recovery code used.
- New recovery codes generated.
- Factor replaced.
- Operator reset initiated/completed.
- Sessions invalidated due to factor change.
- Suspected replay attempt.

Use existing security/audit conventions where compatible.

Security event details may include:

- Actor/target IDs when appropriate.
- UTC timestamp.
- Event kind.
- Correlation ID.
- Safe outcome/status.

Never record:

- Raw passwords.
- TOTP seeds.
- OTP values.
- Recovery-code plaintext.
- QR provisioning URI.
- Session tokens.
- Encryption keys.

Preserve bounded operational logging.

## 17. DATABASE AND MIGRATIONS

Inspect actual auth schema first.

Add narrowly scoped authentication tables/columns where needed, such as:

- MFA factor records.
- Pending enrollment/challenge state.
- Encrypted secret and key ID.
- Recovery-code verifiers and consumption metadata.
- Last accepted timestep/replay protection.
- MFA audit/assurance state.

Use additive migration 0009 or the next actual available migration ID.

Do not modify migrations 0000–0008.

Do not alter or remove the existing thirteen original financial/history triggers.

Do not introduce a second user identity table.

Use database constraints for:

- Appropriate uniqueness.
- Challenge expiration/status representation.
- Recovery code identity.
- Safe one-factor active policy.
- Referential integrity and cleanup.

Use the existing MySQL 8.4 transaction conventions.

Consider concurrency, double submit, account disable and operator reset races.

The MFA schema must not contain plaintext seeds or recovery codes.

## 18. DEPENDENCIES

Use maintained and security-reviewed dependencies only where justified.

Consider current authoritative guidance from:

- OWASP Multifactor Authentication Cheat Sheet.
- NIST SP 800-63B-4.
- OWASP ASVS 5.0.
- Relevant TOTP specifications.

Document exact dependency versions and any new vulnerabilities.

Do not blindly replace the authentication stack.

Do not introduce a hosted identity provider or external service without owner approval.

Do not run `npm audit fix --force`.

## 19. ATTACK AND REGRESSION TEST MATRIX

### Login and MFA

- Correct password, no MFA: private access denied.
- Wrong password: denied.
- Correct password and wrong TOTP: denied.
- Correct password and correct TOTP: one full session issued.
- Expired pending challenge: denied.
- Challenge stolen/reused: denied according to security policy.
- Direct business API call using pre-MFA credential: denied.
- Disabled user during MFA challenge: denied.
- User sessions revoked during challenge: denied.
- MFA challenge consumed twice: only one completion.
- Existing legacy password-only session after enforcement: denied.

### Enrollment

- Valid first-time enrollment.
- TOTP proof required before activation.
- Abandoned enrollment.
- Concurrent enrollment.
- Reused enrollment code.
- Invalid or expired enrollment challenge.
- Missing encryption key fails closed.
- No secret leakage to audit/log/export.
- Recovery codes appear only at initial secure display.
- Existing full business session not created until completion.

### TOTP

- Correct code.
- Invalid code.
- Previous/future window boundaries.
- Correct code submitted twice.
- Concurrent same-timestep replay.
- Brute-force rate limiting.
- Clock-drift behavior.
- Multiple attempts cannot reset limits by requesting new challenges.

### Recovery Codes

- Valid code after password.
- Wrong/expired/reused code.
- Two concurrent uses of one code.
- Recovery without password denied.
- Recovery after factor reset denied.
- All codes consumed.
- Recovery-code regeneration after step-up.

### Factor Reset

- Operator-only authorization.
- Forged operator capability rejected.
- Operator target validation.
- Required reason and explicit confirmation.
- Old TOTP stops working.
- Old codes stop working.
- All sessions and challenges invalidated.
- Next login requires new enrollment.
- No permanent password-only access.
- Account state and audit preserved.

### Factor Replacement

- Existing MFA step-up required.
- Active session alone insufficient.
- Old secret valid until safe switch.
- Unverified replacement never activates.
- Old code invalid after switch.
- New recovery codes issued.
- Appropriate session invalidation.

### Browser and HTTP

- Actual Edge password → TOTP → full session flow.
- First-time setup.
- Logout.
- Browser refresh/back.
- Invalid MFA.
- Recovery.
- Mobile keyboard operation.
- Protected download while MFA pending.
- CSP compatibility.
- Hydration.
- Rate-limit feedback.
- No credentials in tab storage.
- No private cached page access after logout.

### Existing Regression

Retain and re-run:

- WP-03 authentication.
- WP-04 clients.
- WP-05 projects/contracts.
- WP-06 references.
- WP-07 expenses.
- WP-08 payments and idempotency.
- WP-09 receipts.
- WP-10 financial reporting/export.
- WP-11 website and public/private isolation.
- WP-13 performance checks.
- WP-14 authorization/security tests.
- WP-15 business browser and backup/restore.

Tests that previously provisioned synthetic users must now enroll those users through an explicitly guarded test fixture.

Do not weaken business authorization simply to keep legacy tests passing.

## 20. BACKUP, EXPORT AND RESTORE COMPATIBILITY

MFA changes affect the authentication and recovery data model.

Update the WP-15 paired database/receipt backup and restore tests as necessary.

Verify:

- MFA encrypted secret metadata is included in a protected system backup.
- Encryption keys remain separate from backup ciphertext.
- Restore into a fresh environment does not silently render accounts password-only.
- Restore without the required key fails closed for MFA.
- Old sessions are revoked after restoration.
- Recovery codes retain correct consumed/unused states.
- Operator-assisted factor reset works after verified restore.
- Company business ZIP does not expose MFA seeds, recovery verifiers or authentication challenge state.
- Private receipt PDF snapshots remain unchanged.
- Financial totals and receipt numbering remain correct.

Do not assume the existing business export should include authentication secrets.

Do not expose TOTP secret ciphertext as ordinary business export data.

## 21. PERFORMANCE AND UX REGRESSION

Measure relevant:

- Password verification latency.
- TOTP verification latency.
- Full session issuance.
- Login flow completion.
- Authenticated private navigation.
- Common business page loading.

The added MFA challenge must not create a large new client bundle or an unreasonable delay.

Do not compromise factor verification or rate limiting to improve performance.

Preserve the existing public SQ/EN website and motion hooks.

Do not change the owner's creative UI/UX direction.

## 22. SECURITY RELEASE GATE

WP-16 must NOT declare production readiness.

A final GO remains blocked by:

- Unverified production hosting.
- Unverified TLS/proxy and secure cookies.
- Missing production private storage and offsite backup.
- Remaining ASVS requirements.
- Independent security audit.
- MFA production enrollment/recovery operational validation.
- Owner policies for session idle timeout and export step-up.
- Accountant approval and final UI/UX/content signoff.

Successful local MFA tests close a significant authentication gap, not all remaining security gaps.

## 23. ACCEPTANCE CRITERIA

**WP16-AC01:** MFA mandatory for all five active business users.

**WP16-AC02:** Password-only login cannot access private pages/APIs.

**WP16-AC03:** Pre-MFA challenges are securely isolated and short-lived.

**WP16-AC04:** Normal full sessions are issued only after MFA or approved recovery.

**WP16-AC05:** First-time enrollment requires actual authenticator proof.

**WP16-AC06:** TOTP secrets are strongly generated and encrypted server-side.

**WP16-AC07:** Secrets and encryption keys are absent from business exports and public artifacts.

**WP16-AC08:** TOTP uses replay protection and strict rate limiting.

**WP16-AC09:** Concurrent MFA challenges cannot create invalid/replayed authentication states.

**WP16-AC10:** Recovery codes are random, single-use and securely verified.

**WP16-AC11:** Recovery-code reuse and brute-force attempts fail safely.

**WP16-AC12:** Operator-assisted MFA reset requires existing operator authorization and audit.

**WP16-AC13:** Operator reset invalidates factors, codes, sessions and pending challenges.

**WP16-AC14:** Recovery never leaves the account permanently password-only.

**WP16-AC15:** Authenticated factor replacement requires fresh step-up verification.

**WP16-AC16:** Legacy sessions cannot bypass new mandatory MFA enforcement.

**WP16-AC17:** Disabled/revoked users cannot complete pending MFA challenges.

**WP16-AC18:** Business routes and Server Actions require full authenticated state.

**WP16-AC19:** Login/enrollment/recovery UI works in genuine browser testing.

**WP16-AC20:** MFA secrets are absent from logs, history snapshots and client storage.

**WP16-AC21:** Existing private PDF, XLSX and ZIP security remains intact.

**WP16-AC22:** Backup/restore preserves MFA security and requires separate key management.

**WP16-AC23:** Existing financial, audit, locking and receipt tests pass.

**WP16-AC24:** Original migrations and all thirteen integrity triggers remain intact.

**WP16-AC25:** TypeScript, lint, build and actual HTTP/browser regressions pass.

**WP16-AC26:** No production data, infrastructure or deployment is involved.

**WP16-AC27:** ASVS MFA-related findings are updated based on actual verification, not assumptions.

**WP16-AC28:** Remaining owner/hosting/audit requirements remain classified as release blockers.

Report each criterion:

- PASS
- FAIL
- NOT VERIFIED
- BLOCKED BY EXTERNAL DECISION

Do not conflate a successful OTP login with complete MFA lifecycle security.

## 24. REQUIRED DELIVERY REPORT

### A. Repository Baseline

Actual branch, HEAD, owner changes and available source/security documentation.

### B. MFA Architecture

Login state machine, pre-auth challenges and full-session issuance.

### C. Enrollment

Seed creation, encryption, QR setup, TOTP verification and activation.

### D. Recovery

Single-use codes and operator-assisted identity/factor reset.

### E. Factor Replacement

Step-up verification, concurrency and session invalidation.

### F. Database

Additive schema, migrations, encryption-key references, constraints and replay protection.

### G. Security Testing

Real attacks, code paths, session bypass attempts, rate limiting and leak checks.

### H. Browser Evidence

Actual Edge/Playwright login, enrollment, recovery, logout and mobile flows.

### I. Existing Regression

Payments, receipts, exports, backup/restore, security and public website.

### J. Performance Impact

Measured authentication and private-page behavior.

### K. Files Changed

Exact file manifest and purpose.

### L. ASVS Closure

Precise status changes to the previously reported MFA-related controls.

### M. Acceptance Checklist

WP16-AC01 through WP16-AC28.

### N. Remaining Risks

TOTP phishing susceptibility, compromised devices, operator recovery, key management and production dependencies.

### O. Next Work Package

Identify the remaining explicit security-policy decisions and infrastructure gates.

Do not start the next package automatically.

## 25. EXECUTION INSTRUCTION

Proceed with WP-16 implementation locally.

Use the existing WP-03 authentication system.

Implement mandatory password + TOTP authentication for all active users, secure first-time enrollment, one-time recovery codes, authenticated factor replacement and operator-controlled emergency reset.

Enforce full authentication at every business service/API/page boundary.

Prevent legacy password-only sessions from bypassing the new policy.

Preserve all historical financial, receipt, audit and backup guarantees.

Run disposable MySQL, genuine browser and comprehensive security tests.

Do not modify the owner's creative UI/UX direction.

Do not deploy.

Commit/push only within the owner's current explicit authorization.

Provide a detailed evidence-based report.

**END OF WP-16**

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
