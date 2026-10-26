# ADORE TECH SOLUTIONS — CODEX IMPLEMENTATION PROMPT

## WP-03: Authentication, Authorization & Account Administration

**Project:** Fitimi Construction Management System & Corporate Website  
**Package:** WP-03  
**Version:** 1.0  
**Date:** 26.10.2026  
**Developer:** Codex  
**Technical Lead:** Adore Tech Solutions  
**Authorization:** Local implementation, dependencies, migrations and disposable database testing.

---

## 1. MISSION

Implement real, secure authentication and server-side authorization for the existing Next.js application.

WP-01 created the public website and private application shell.

WP-02 and WP-02V established and verified the MySQL/Drizzle database foundation.

Your task is to replace the unsecured `/app` development preview with a protected application area.

Implement working authentication, secure sessions, access control, account lifecycle support and automated tests.

This is a real implementation task, not a planning exercise.

Do not implement business CRUD or financial operations.

## 2. VERIFIED PROJECT BASELINE

Reported baseline:

- Next.js 16.4.3
- React 19.3.1
- TypeScript 6.0.3
- Tailwind CSS 4.3.3
- Drizzle ORM 0.45.4
- Drizzle Kit 0.31.11
- mysql2 3.24.6
- MySQL 8.4.13 verified in WP-02V
- 17 application tables
- 13 verified database triggers
- 25 passing MySQL integration tests
- 14 passing static tests

Latest reported Git HEAD before WP-02V was `09fe783`.

WP-02V introduced uncommitted changes to tests, `.gitattributes`, README and technical documentation.

The project owner's `AGENTS.md` also contained existing changes.

**Before implementation:**

1. Inspect the actual Git state.
2. Review AGENTS.md and repository instructions.
3. Preserve all existing work.
4. Inspect the real users schema.
5. Review current route groups and layouts.
6. Inspect database connection and migration tooling.
7. Verify the availability of approved specifications.

Do not assume the repository is unchanged.

Do not overwrite unrelated modifications.

## 3. AUTHORIZATION BOUNDARIES

Authorized:

- Local source-code implementation.
- Necessary authentication dependencies.
- New versioned migration files.
- Applying migrations to an isolated disposable MySQL database.
- Synthetic test accounts.
- Local unit, integration and browser tests.
- Necessary documentation changes.

Not authorized:

- Production deployment.
- Production database access.
- Real client accounts or information.
- Hosting purchases or remote infrastructure changes.
- Destructive changes to persistent databases.
- Automatic Git commit or push without separate instruction.
- Financial CRUD, payment confirmation or PDF generation.

## 4. REQUIRED AUTHENTICATION MODEL

Implement:

- Individual email/password login.
- Secure password verification.
- Server-managed sessions.
- Logout.
- Session revocation.
- Disabled-user rejection.
- Protected application routes.
- Generic authentication failure messages.
- No public registration.

Each client user has equal operational permissions.

Maximum five active client accounts.

Adore is responsible for:

- Account creation.
- Account deactivation.
- Account recovery/password reset.

Do not expose open self-registration.

Do not allow ordinary client users to create additional accounts merely because they have equal operational rights.

The distinction between Adore account administration and client operational permissions is mandatory.

## 5. AUTHENTICATION TECHNOLOGY

Inspect the current project and select a maintained authentication approach compatible with Next.js 16, TypeScript and Drizzle/MySQL.

Prefer an established library if it fits the actual requirements.

Do not implement custom cryptography.

Use an established password-hashing algorithm such as Argon2id or another modern, justified alternative.

Never store plaintext passwords or reversible password encryption.

Use cryptographically secure session identifiers.

Session tokens must not appear in URLs.

If a library requires additional database tables or migration files, add only the necessary structures.

Explain the selected library, versions and architectural reasons in the final report.

## 6. DATABASE REQUIREMENTS

Reuse the existing `users` table where possible.

Do not create a competing identity table without a compelling reason.

Add the minimum necessary persistence for server-side sessions and account recovery state.

Use new versioned migrations.

**Do not modify the previously verified WP-02 SQL migrations in place.**

Preserve:

- Previous migration journal and hashes.
- Existing foreign keys.
- Financial triggers.
- Audit and history tables.
- Existing business data relationships.

Account-related migration design must consider:

- Session expiration.
- Session revocation.
- User deactivation.
- Unique email identity.
- Case-insensitive email normalization.
- Active-account limit.
- Safe handling of password reset state.
- Existing schema compatibility.

For the five-active-account limit, ensure creation and activation are concurrency-safe. A simple frontend count check is insufficient.

## 7. AD ORE ACCOUNT ADMINISTRATION

Implement a secure local administrative workflow appropriate for Adore's operational responsibility.

Because no browser-based Adore administration interface has been approved, do not invent a public or client-facing account-management dashboard.

A protected operator-only CLI is acceptable for this package, provided that it:

- Uses the existing database configuration safely.
- Requires explicit operator action.
- Creates users with securely hashed passwords.
- Prevents duplicate emails.
- Enforces the maximum of five active client accounts.
- Supports account deactivation.
- Supports password reset/recovery without exposing plaintext stored passwords.
- Can revoke active sessions.
- Does not embed credentials or fixed passwords in source code.
- Does not print sensitive tokens or passwords unnecessarily.

Use synthetic accounts for development tests.

Do not create a default production admin account.

Do not seed publicly known credentials.

If the chosen recovery mechanism involves reset tokens, ensure secure token generation, expiration, single use and hashed token storage.

Do not assume an email delivery service exists. A production email integration is outside WP-03.

Document the operational process and its remaining production prerequisites.

## 8. LOGIN AND LOGOUT UI

Create a responsive login screen consistent with the current UI foundation.

Use the approved Operational Clarity design materials if available.

If exact visual references are missing, maintain the existing neutral design system and document the pending visual alignment.

Login screen requirements:

- Email field.
- Password field.
- Submit button.
- Loading state.
- Generic invalid-credentials message.
- Keyboard accessibility.
- Appropriate error handling.
- Responsive layout.

Do not reveal whether a particular email exists.

Use the current application's language and terminology conventions where appropriate.

Implement a working logout action.

Show the authenticated user's name or email in the private application shell.

Avoid unnecessary profile-management features.

## 9. PROTECT PRIVATE ROUTES

The public SQ/EN website must remain accessible without login.

The `/app` area must require authentication.

Expected behavior:

- Anonymous visitors cannot access private pages.
- Unauthenticated requests are redirected to login where appropriate.
- Private server operations reject unauthenticated requests.
- Expired sessions are rejected.
- Revoked sessions are rejected.
- Disabled users lose access.
- A logged-out session cannot be reused.

Use server-side authentication checks as the security boundary.

A Next.js middleware/proxy redirect alone is not sufficient authorization for sensitive server operations.

Implement reusable authorization helpers suitable for later modules.

Use the appropriate Next.js 16 runtime conventions.

## 10. SESSION SECURITY

Use secure session handling.

Requirements:

- HttpOnly cookies.
- SameSite protection.
- Secure cookies in HTTPS production environments.
- Appropriate session expiration.
- Server-side revocation.
- Session invalidation after deactivation.
- Session rotation when required by the chosen approach.
- No sensitive tokens in browser localStorage.
- No credentials embedded in client-side code.

Consider CSRF protections appropriate to the selected authentication approach.

Validate Origin/Host for state-changing actions where necessary.

Avoid open redirects after login.

Prevent session-fixation vulnerabilities.

Do not disclose session tokens or password hashes in logs.

## 11. LOGIN ABUSE PROTECTION

Implement proportionate protection against repeated authentication attempts.

Requirements:

- Generic errors.
- Reasonable rate limiting or equivalent mitigation.
- No user-enumeration messages.
- No unlimited brute-force attempts.
- Appropriate event logging without secrets.

For any in-memory limiter, explicitly document that it does not provide reliable distributed or multi-instance protection.

Do not pretend a development-only limiter is production-ready.

Do not introduce Redis or a new remote service without authorization.

If a robust production rate-limiting strategy depends on the final hosting environment, document that as a release prerequisite.

## 12. AUTHORIZATION MODEL

Use a simple authorization model:

**Client operational user**

- Has equal access to approved business modules.
- Cannot administer account creation, recovery or activation through ordinary client UI.

**Adore operator**

- Controls account lifecycle through a separate protected administrative process.

Do not invent additional business roles such as accountant, supervisor, manager or employee.

Do not rely on hidden navigation items as authorization.

Design reusable guards for future operations involving clients, projects, expenses, payments, documents and reports.

Business-module CRUD authorization will be integrated by later packages.

## 13. AUDIT AND LOGGING

Record appropriate security-relevant events, such as:

- Successful login.
- Failed login attempts, with safe/redacted information.
- Logout or session revocation where useful.
- Account creation.
- Account deactivation.
- Account reactivation, if supported.
- Password reset.
- Security-sensitive account changes.

Use the existing audit infrastructure where compatible.

Never store password values, password hashes, raw reset tokens or session tokens in audit snapshots.

Use safe correlation identifiers for diagnosing failures.

Do not implement financial audit workflows in WP-03.

## 14. ERROR AND INTERRUPTION HANDLING

Ensure the following situations are handled safely:

- Incorrect credentials.
- Nonexistent account.
- Disabled account.
- Expired session.
- Revoked session.
- Database temporarily unavailable.
- Multiple concurrent login attempts.
- Repeated logout request.
- Interrupted login response.
- Password reset token expiration, if applicable.

Database failures must not bypass authorization.

Fail closed: when session validity cannot be established, deny protected access.

Return understandable error messages without exposing internals.

## 15. TESTING REQUIREMENTS

Implement automated tests for:

### Authentication

- Correct credentials.
- Incorrect credentials.
- Unknown email.
- Disabled account.
- Password hash verification.
- Password-reset behavior where implemented.

### Sessions

- Session creation.
- Session expiration.
- Logout and revocation.
- Disabled-user invalidation.
- Reuse of an invalidated session.

### Authorization

- Anonymous `/app` access denied.
- Authenticated `/app` access permitted.
- Public SQ/EN website remains public.
- Protected server action rejects anonymous requests.
- Unauthorized account-administration attempt rejected.

### Account limits

- Five active client accounts permitted.
- Sixth active account rejected.
- Deactivation frees an active slot.
- Concurrent activation/creation cannot exceed the limit.

### Security

- No open redirect.
- No sensitive token exposure.
- Safe cookies.
- Generic failed-login responses.
- Brute-force mitigation behavior.

Use disposable MySQL 8.4 for integration tests.

Do not use MariaDB 10.4 as proof of MySQL 8.4 behavior.

Include a safe cleanup procedure for synthetic test data and containers owned by the work package.

## 16. REGRESSION TESTS

Verify that WP-03 does not break WP-01 and WP-02.

Run applicable project commands, including:

- `npm.cmd test`
- `npm.cmd run db:check`
- `npm.cmd run test:db`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`
- `npm.cmd run check:routes`

Inspect the actual package scripts first.

Because `/app` becomes protected, update route smoke tests to distinguish expected login redirects/unauthorized responses from public-page success.

Do not weaken existing route tests just to make them pass.

Ensure all existing migration and trigger tests remain valid.

Execute browser-based login/navigation verification if the environment supports it; otherwise report NOT VERIFIED.

## 17. OUT OF SCOPE

Do not implement:

- Client CRUD.
- Project or contract CRUD.
- Expense entry.
- Payment confirmation.
- Payment allocations.
- Receipt generation.
- Financial reports.
- PDF/Excel export.
- Public registration.
- Social login.
- MFA unless separately approved.
- Complex roles and permissions.
- Real email delivery integrations.
- Production deployment.
- Hosting infrastructure changes.

Do not replace existing UI pages unnecessarily.

## 18. ACCEPTANCE CRITERIA

**WP03-AC01:** Authentication integrates with the existing Next.js/Drizzle architecture.

**WP03-AC02:** Real password verification works with securely stored hashes.

**WP03-AC03:** Anonymous users cannot access `/app`.

**WP03-AC04:** Authenticated active users can access approved private pages.

**WP03-AC05:** Logout revokes the active session.

**WP03-AC06:** Disabled accounts lose access, including existing sessions.

**WP03-AC07:** Maximum five active client accounts is enforced, including concurrent operations.

**WP03-AC08:** Account creation, deactivation and recovery are controlled by Adore.

**WP03-AC09:** No public registration endpoint exists.

**WP03-AC10:** Public SQ/EN pages remain available.

**WP03-AC11:** Sessions and cookies follow the specified security requirements.

**WP03-AC12:** Unauthorized server-side operations are rejected.

**WP03-AC13:** Login abuse protection is implemented or remaining production dependency is explicitly identified.

**WP03-AC14:** Security events are logged without secrets.

**WP03-AC15:** Database migrations execute successfully against disposable MySQL 8.4.

**WP03-AC16:** Existing WP-02 migration history and triggers remain intact.

**WP03-AC17:** Automated authentication and authorization tests pass.

**WP03-AC18:** Typecheck, lint, build and applicable regressions pass.

**WP03-AC19:** Responsive login UI and authenticated navigation are verified where tooling permits.

**WP03-AC20:** No real client data, production infrastructure or deployment is involved.

Mark each as PASS, FAIL or NOT VERIFIED.

## 19. REQUIRED DELIVERY REPORT

Return:

### A. Initial Repository State

Branch, commit and working-tree changes.

### B. Technology Decisions

Authentication library, password hashing, sessions and justification.

### C. Implemented Features

Login, logout, guards, account administration and recovery.

### D. Database Changes

New migrations, tables and indexes.

### E. Created/Modified Files

Exact paths and purpose.

### F. Verification

Actual commands, outputs and test results.

### G. Security Review

Cookies, session invalidation, rate limits, secrets and authorization.

### H. Acceptance Checklist

WP03-AC01 through WP03-AC20.

### I. Remaining Risks

Known defects, limitations and production prerequisites.

### J. Next Package

Readiness for WP-04 — Clients.

## 20. EXECUTION

Proceed with real local WP-03 implementation.

Preserve WP-02V changes and prior migration history.

Use only synthetic local accounts and disposable databases.

Implement authentication and authorization, execute applicable tests and report actual results.

Do not start WP-04 automatically.

Do not commit or push without explicit instruction.

**END OF WP-03**
