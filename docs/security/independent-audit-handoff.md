# Independent security-review handoff

This package is a developer self-review of the local Fitimi Construction code. A qualified external specialist must independently verify it before production. No independent test, ASVS conformance, hosting approval or release authorization is asserted.

## Architecture and trust boundaries

Next 16 App Router separates static public SQ/EN content from dynamic /app and private APIs. Public portfolio/content is curated, not a projection of private projects. CLI-only operator administration has no HTTP account-creation/reset surface. SQL session guards protect each page/service; Proxy adds CSP/privacy and does not make authorization decisions.

Browser → Next → MySQL business transactions → private instance-bound PDF store → audited PDF/XLSX/ZIP responses. Independent boundaries also include operator terminal, build/dependency chain, target host/proxy, secret provisioning and off-site paired backups. All five approved users share operational company rights; a valid user can legitimately export substantial business history. Project/customer ownership restrictions must not be invented. Confirmation operation keys are separately creator-bound.

Financial code keeps exact decimal strings/BigInt cents, canonical idempotency fingerprints, deterministic user/project/client/contract/phase lock ordering, atomic audit/history and receipt issuance. Corrections keep stable receipt identity and append immutable document versions; cancellation preserves prior bytes/history and excludes cancelled income. Existing migrations/triggers are part of the integrity boundary.

Receipt storage uses generated UUIDs, owned root markers, MySQL advisory locks, durable temporary/journal/final files, no-overwrite finalization, size/signature/SHA-256 validation and restricted filesystem permissions. Recovery requires operator capability and successful DB reference checks before deletion. Application-level checks do not defend against full OS/runtime compromise.

Reports and ZIPs require live session checks, bounded complete snapshots, no-store and audited preparation. Authentication/session/operator data and raw storage references are excluded. An export is sensitive business data; once legitimately downloaded it cannot be revoked. Export quotas/step-up/approval/watermarking require an owner product decision.

## Evidence to inspect

- [Delivery findings, tests and acceptance](../WP-14-report.md).
- [Actual route source inventory](endpoint-inventory.json) and [aggregated dynamic verification](verification-evidence.json).
- [All 253 ASVS L1/L2 controls](asvs-5.0-l2-matrix.csv), including FAIL/NOT VERIFIED; do not infer conformance from the package acceptance table.
- [Exact dependency advisory review](dependency-review.json); four moderate dev-tool advisories remain.
- Tests under tests/security and original tests/auth, clients, projects, references, expenses, payments, receipts, reporting, website and db.
- Local artifacts/wp14 retains redacted test logs, before/after synthetic reproductions, screenshots and scans. Credential/private-store artifacts are disposed after verification; regenerate them locally, never request live secrets from the owner.

## Reproduce the local assessment

Use an isolated owner-approved Windows workspace, supported Node, official disposable MySQL 8.4 and installed Edge. Review package-lock and dependency scripts before installing. Do not use a personal browser profile or a production database. The existing Windows optional-WASM dependency-tree warnings need a clean target-platform installation check during release preparation; the native tested runtime works locally.

1. Ensure original ports 3307 and 3000 are free; preserve .env.local/README and do not start/reset the owner's existing containers. Docker CLI may be selected via SECURITY_DOCKER.
2. `node scripts/security/lab.mjs setup` creates only `fitimiconstruction-mysql-wp14`, labels it WP-14, binds MySQL to 127.0.0.1:3307 and stores synthetic credentials in ignored artifacts/wp14. Wait for MySQL readiness.
3. `node scripts/security/lab.mjs run db:migrate`, then `run build` and `run start --port 3000` in a task-owned terminal. All npm scripts below use `node scripts/security/lab.mjs run <script>` so owner configuration is not rewritten.
4. Run test, test:security:db, test:security:browser, test:security:recovery and test:security:http. The latter regenerates endpoint inventory and performs the state/canary matrix. All fixture tests close/deactivate their own accounts; run fixture suites sequentially. Run test:reports:http before intentionally malformed legacy-data suites, then the other original HTTP suites and test:website:db/browser.
5. Run test:db separately. Original integration tests intentionally create inconsistent/legacy fixtures; stop the task server and use `node scripts/security/lab.mjs reset`, then run db:migrate/restart before a fresh financial HTTP matrix. Reset verifies exact ID, name, labels, loopback binding and test schema before touching anything.
6. Run typecheck, lint, build, db:check, check:routes and security:scan. Build while the task server is stopped. Stop it before `node scripts/security/lab.mjs dispose`, which validates owned resources and removes only its container/stores/fixture credentials, releasing the original ports.

For receipt F-01, the added regression is red against the baseline download implementation and green with the final session check. For financial-storage F-02, `test:security:recovery baseline` is only for a baseline build containing the old storage behavior; the default command verifies the secure final behavior. Do not interpret a baseline-mode reproduction as a passing protection.

## Proposed external-assessor scope

Obtain separate written authorization naming the assessor, commit, local/staging hosts, time window, traffic bounds and contacts. This handoff is not authorization to attack any public system.

Proposed initial target: this repository plus the disposable synthetic app at 127.0.0.1:3000 and its owned MySQL at 127.0.0.1:3307. Review documented endpoints/actions/CLI, supported private files and synthetic role/data fixtures. Use bounded requests and concurrency (initially ≤4), preserve exact financial invariants and record expected 409 conflicts. Avoid uncontrolled password/CPU/memory/disk saturation. Credentials must be generated for the assessment, not supplied from production.

Excluded: real customer data, production/staff accounts, public domains, unrelated localhost services/containers, personal browser profiles, external network scans, phishing, purchases, persistence on the host, destructive owner-resource changes and production rotation/deployment. Additional staging/hosting tests need an explicit named scope. No email/Slack/invitation has been sent on the owner's behalf.

Prioritize independent review of session boundaries, financial recovery/lock races, export exclusion/completeness, filesystem TOCTOU/permissions/instance binding, Next RSC/Server Actions/Proxy behavior, static-versus-private CSP, dependency reachability and deployment packaging. Repeat tests without relying on the developer's conclusions.

## Production database roles

The trial in tests/security/runtime-role.integration.test.ts dynamically proves the candidate runtime permissions in disposable MySQL:

| Identity | Intended permissions | Prohibitions / notes |
| --- | --- | --- |
| Web runtime | SELECT on required business/auth tables; INSERT/UPDATE on mutable business/session/rate-limit/operation/counter tables; SELECT/INSERT only on audit_events, entity_versions and receipt_versions; users SELECT only | No DELETE, DDL, GRANT, account-management UPDATE/INSERT, trigger management, FILE or administrative/global privileges. No migration role credentials in web environment. |
| Migration/deployer | Approved schema DDL/index/trigger operations and migration journal access in a controlled maintenance process | Separate short-lived credential, never web runtime. Preserve all historical hashes/triggers and explicitly review MySQL binary-log/trigger-creation requirements. Do not solve this by granting SUPER to the app. |
| Operator maintenance | Required account-control locking, user creation/update, session revocation and authentication audit writes; limited authorized recovery reads | Separate trusted CLI context/credential and secret, no public HTTP account endpoints. Revoke/export approvals remain an owner policy decision. |
| Backup / restore | Only privileges required for the selected consistent backup method; restore uses a separate elevated recovery identity | Cannot equate a business ZIP with a full backup. No runtime or operator secret sharing; no unapproved production GRANT/ALTER USER executed. |

Tables remain protected by original constraints/triggers even with authorized DML. Restrict account host/network sources rather than using the temporary fixture's broad internal host pattern in production. Verify runtime role with the actual driver/proxy/DB configuration. The current connection helper deliberately supports only explicitly disposable loopback dev/test databases; a production adapter and transport policy are a release prerequisite.

Local Docker tests use skip-log-bin to preserve the established isolated trigger/migration setup. A production DBA must review trigger definers, privileges and binary-log configuration under the chosen MySQL deployment; none was changed remotely. Backups must preserve triggers, routines/schema metadata where applicable and integrity constraints.

## Secure deployment checklist — not locally certified

- Approved TLS certificate, TLS versions/ciphers and redirect policy at the controlled reverse proxy; test secure cookies and Server Actions on the actual external HTTPS origin. Stage HSTS after validation; assess one-year/includeSubDomains requirements and do not enable preload blindly.
- One approved AUTH_ORIGIN, correct original Host forwarding, and explicit trusted-proxy/network boundaries. Do not trust arbitrary forwarded headers. Bind/restrict direct application and database ingress; do not publicly expose MySQL or debugging/dev servers.
- Approved production DB adapter/TLS verification (certificate chain/hostname), restricted identities and credential lifecycle. Never remove the disposable guard as a substitute for production design.
- Separate secret vault/provisioning for runtime, operator, deployment and backup keys; no NEXT_PUBLIC secrets, populated .env in Git, command-line passwords or secrets in logs/diagnostics. Define rotation and emergency revocation procedures before release.
- Private persistent receipt store outside public/build/source/deployment/synced shared folders; least filesystem/NTFS rights, restricted service identity and no broad uploader write access. Keep instance ownership/immutable history and do not manually overwrite PDFs.
- Exclude .git, artifacts, tests' credentials/documents, private stores and source maps from public serving/deployment assets. Build manifests containing Server Action encryption material are private. Use a clean, immutable, target-platform build and current lockfile verification.
- Production error redaction plus structured security events, access-controlled retention, central monitoring/alerting, time synchronization and abuse thresholds. Raw URLs may include record/operation IDs; classify/minimize them, never log cookies or bodies containing business data.
- Review and close/accept the ASVS gaps with the owner/external reviewer: MFA, password screening/change process, idle/concurrent session policy, self-service session visibility, stronger public script policy, authenticated abuse limits and denial/error monitoring.
- Exercise clean logout/deactivation/cached-navigation behavior on physical target browsers. Close obsolete application tabs and ensure legacy draft cleanup during rollout; past authorized downloads cannot be erased by account revocation.
- No hosting selection, purchase, production secret rotation or deployment is part of this package.

## Backup and disaster-recovery security design

Required targets: daily off-site copies, 30-day retention, RPO ≤24 hours, RTO ≤48 hours. No hosting-specific restore drill has occurred; these targets are NOT VERIFIED.

Use a coordinated consistent database backup paired with every referenced immutable PDF and the private ownership metadata. Include schema/migration history, original integrity triggers, receipt identities/versions/counters, history and necessary account/session state. Record the consistent snapshot identity, hashes, byte counts and a signed/authenticated manifest. A business ZIP deliberately excludes authentication/operational DB state and is not sufficient for full restoration.

Encrypt backups before transport/storage using an approved authenticated scheme/tool. Keep recovery keys in a separate managed security boundary with tested escrow/rotation and restricted, audited access. Off-site transport must validate TLS. Do not store unencrypted backups or their decryption keys beside public assets, web logs, artifacts or the same compromised host.

Separate backup writing, retention administration and restore authorization. Use versioning/immutable retention or equivalent protection against ransomware/deletion; backup writers should not be able to delete all prior recovery points. Define 30-day expiry and legal/privacy handling, including encrypted copies of password hashes and personal/financial history. Monitor backup completeness and missed jobs.

Restore only into an authorized isolated maintenance environment first. Verify DB migrations/triggers and every referenced PDF hash/version before making the system usable; reconcile missing/orphaned objects without deleting issued history. The store binds to MySQL server UUID/database plus its own owner identity: a replacement server must fail closed until an approved, audited rebind verifies the full restored pair. Do not edit marker metadata casually to bypass this check. Automated production rebinding is not implemented here.

Revoke restored sessions so a backup cannot resurrect previously revoked access. Rotate affected operator/runtime/backup secrets following incident scope, with owner authorization. Test recovery-key availability, least-privilege access, original receipt bytes/numbers and financial exactness. Record timed RPO/RTO results and restoration approvals in WP-15; local synthetic integrity tests cannot certify them.

## Release risk register and WP-15 gates

| Risk | State / required action |
| --- | --- |
| Production transport/adapter/host/private storage are not selected or verified | **Release blocker.** Implement and test controlled target configuration; existing DB helper stays loopback/disposable-only. |
| Password-only auth, no idle timeout/denylist, no session self-review | **Owner/external security decision.** ASVS gaps remain FAIL; define controls/mitigations before any conformity or release approval. |
| Four moderate legacy development advisories | Restrict dev tooling; plan compatible update, monitor advisories, keep it out of production serving. No clean audit claim. |
| Optional WASM dependency-tree warnings | Verify clean target-platform install/native dependencies/SBOM in isolated CI; do not infer packaging readiness from current workstation build alone. |
| Public inline bootstrap and style compatibility exceptions | Keep escaped server content and current CSP; evaluate strict static hashes/bundler or dynamic strategy without silently discarding WP-13 static performance/owner design. |
| Authorized export is an extensive business copy; sustained quotas incomplete | Owner decides step-up/approval/quota/monitoring. Do not silently change equal approved permissions. |
| Logs/abuse alerts and production key/backup lifecycle incomplete | Define retention, access, alert routing and tested emergency revoke/rotation. Current generic errors and audit integrity are useful but insufficient operational monitoring. |
| Backup/restore and instance rebind not drilled | **Release blocker.** Pair/encrypt backups and execute timed, authorized restore/financial/PDF/session tests. RPO/RTO not certified. |
| Remaining 105 unverified ASVS controls and absent-feature assumptions | Qualified independent review must validate applicability and close/accept open items; no developer self-certification. |
| Unknown vulnerabilities or compromised browser/host/dependency | Residual risk; defense in depth, least privilege, monitoring and independent review remain essential. |

WP-15 may proceed with final QA, controlled configuration and restore-readiness work. Production deployment remains unauthorized and unapproved. No WP-15 implementation was started automatically.
