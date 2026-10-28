# Local recovery evidence and production operator requirements

WP-15, 2026-10-28. **NO-GO FOR PRODUCTION.** This runbook describes a tested synthetic laboratory and the unverified operational work required on a selected host. These scripts deliberately refuse production databases. Never substitute a business database URL or remove their guards.

## Reproduce the local verification

Use Windows, the existing Node dependencies, Docker Desktop, MySQL `mysql:8.4` and installed Microsoft Edge. No personal browser profile is used. Only loopback **3307/3000** is allowed. Stop before setup if either port belongs to another service; do not change ports or stop an owner service. Preserve `.env.local` and README.md.

```powershell
$env:RELEASE_DOCKER = 'C:/Users/Admin/AppData/Local/Programs/DockerDesktop/resources/bin/docker.exe'
node scripts/release/lab.mjs setup
# Wait for the newly created MySQL service to become ready.
node scripts/release/lab.mjs run db:migrate
node scripts/release/lab.mjs run test
node scripts/release/lab.mjs run test:db
node scripts/release/lab.mjs run build
node scripts/release/verify.mjs
# verify.mjs has stopped its own Next server before this next command.
node scripts/release/lab.mjs run test:release:restore
node scripts/release/lab.mjs run typecheck
node scripts/release/lab.mjs run lint
node scripts/release/lab.mjs run db:check
node scripts/release/lab.mjs run check:routes
node scripts/release/lab.mjs run security:scan
# Preserve only redacted evidence; inspect every source before sharing.
node scripts/release/cleanup.mjs
node scripts/release/lab.mjs dispose
```

The verification driver resets only the guarded disposable schema and chooses a new private receipt namespace **between suites**. Several original integrity tests deliberately corrupt fixture PDFs or relationships: their leftovers must not be reused as the dataset for complete exports, financial dashboard checks or another suite. The driver runs fixtures sequentially and starts/stops only its own Node process. Each command's real exit status and elapsed time is recorded. A failure stops the driver; inspect its private log before continuing. `test:db` remains a separate established 169-result suite.

`test:release:restore` temporarily switches the original 3307 binding between three task containers, never runs two databases on new ports, and retains the original regression container. Its two independent persistent volumes are synthetic recovery evidence, not production storage. The stopped owner container is never involved. Cleanup validates exact recorded IDs, labels, names, mounts and ports before removing anything. An unexpected identity or unowned directory stops cleanup; investigate rather than bypassing the guard.

## Paired backup contract

`scripts/release/paired-backup.ts` requires an issued operator context; it has no web route. An ephemeral SELECT/SHOW VIEW/TRIGGER account creates the SQL dump; a separate local administrative connection freezes writes. Neither root nor backup passwords are command-line arguments. The operator key, MySQL credentials, archive encryption key and encrypted archive are separate files/principals conceptually; local tests use distinct private sibling directories under one Windows account. **Independent production principals, vault, key escrow and offsite storage are not verified.**

1. Stop every application writer, scheduled mutation and receipt recovery worker. Acquire the existing receipt-store advisory lease and verify source database identity and storage owner marker.
2. Append `backup_started`, then enable and assert MySQL `super_read_only`. Holding a PDF lease alone does not freeze expenses, account administration or other SQL writes. The tested adapter uses a whole-server freeze exclusively on its own local MySQL container.
3. Capture all tables, nine migration records and the original 13 trigger definitions. Refuse unreviewed stored routines/events. Use official `mysqldump --single-transaction --triggers --hex-blob --no-tablespaces`; collect every database-referenced original PDF and verify SHA-256. No issued PDF is regenerated.
4. Seal SQL, original PDFs and their manifest with Node AES-256-GCM: random 96-bit nonce, 256-bit generated key, authenticated format header, 128-bit tag. The encrypted manifest contains source/storage identity, UTC creation, exact 30-day retention deadline, row counts/hashes and document references/checksums. It is a versioned application envelope using the maintained crypto implementation, not a new encryption primitive or independent cryptographic certification.
5. Write an exclusive bounded `.part`, fsync, publish by exclusive hardlink, remove `.part`; never overwrite an existing archive. Release the write freeze and lease in `finally`, including failures. No plaintext host dump is written. SQL/PDF plaintext necessarily exists briefly in bounded process memory.

Reference limits: <=20,000 total table rows (including authentication/history), checked before row materialization; bounded SQL dump collected before digest materialization; SQL <64 MiB; total archive/plaintext <=128 MiB; <=256 document versions; ZIP central-directory bounds and allowed names enforced before extraction; STORE-only ZIPs, no ZIP64/compressed bombs. Reject over-limit backups instead of truncating. This memory-bound format is tested for the local fixture, not yet sized for production history. A host must support private permissions, atomic exclusive file operations, fsync and durable persistent volumes. Windows tests apply restrictive NTFS directory ACLs. No backup files are web-served or committed.

Thirty-day retention is **authenticated metadata**, not a configured production deletion scheduler. Before operating, approve retention/legal holds, immutable/offsite copies and lifecycle policy; do not delete the only verified recovery point. Key rotation must retain access to every retained archive's original key. Test escrow recovery separately. A lost key is unrecoverable without escrow. Daily offsite paired backups and alerts are required for the proposed **RPO <=24h**, with a measured full recovery **RTO <=48h**; both remain **NOT VERIFIED**.

## Controlled restore

1. Designate an operator and incident lead; independently approve the source identity/recovery point. Preserve the failed system and evidence. Stop application traffic; never import over the original database or copy over an existing private store.
2. Provision a fresh isolated MySQL 8.4 instance with its own server UUID and empty schema, plus a new empty private receipt directory. The source must be a different identity. Do not expose restored staging to users.
3. Authenticate/decrypt the entire pair before creating the target store or importing SQL. Reject wrong keys, altered ciphertext/header/tag, invalid retention metadata, wrong source approval, incomplete pairs, duplicate/traversal entries, missing documents and checksum mismatches.
4. Import the unchanged dump and immutable PDF bytes. Compare **all table counts/hashes** and every original trigger body **before security changes**. Verify every restored receipt reference and checksum against the manifest.
5. Revoke every restored session and increment every account's authorization version. Preserve historical session rows, financial/audit/history rows, idempotency requests and receipt counters. Append `restore_completed`. Write the new database binding marker **last**, preserving the original storage-owner UUID and original references only through this approved restore path. General runtime rebinding remains prohibited.
6. Test genuine password login, old-cookie rejection, exact dashboard/project totals, historical PDFs, cancelled/corrected records, original idempotent replay, next receipt number and competing allocations. Obtain independent operational/accounting approval before enabling access.

If import or verification fails after target SQL/PDF materialization, the new staging environment is **quarantined**, not atomically rolled back. It lacks the final ownership marker; never start the app against it or manually forge a marker. Record the incident, preserve diagnostic evidence, and recreate only the proven task target. Do not retry into a partly populated schema. Production target disposal requires its own approved ownership procedure.

The tested disk-full case injects ENOSPC during writing before publication: the partial file is removed, writes are thawed and no successful archive is announced. It does not prove every OS/filesystem/power-loss failure mode. Run target-host tests for ACL denial, process death, unavailable object storage, full disks, interrupted SQL import, key-service outage and crash recovery before release.

## Monitoring and response

Current safe instrumentation emits only a fixed event kind, UTC time, random event correlation ID and optional HTTP status. No actor, URL, record identifier, email, financial amount, request body, token, password, PDF bytes, storage path or exception text is accepted. It covers common JSON 401/403/429/5xx responses, receipt integrity/storage failures, completed exports and local backup/restore outcomes. The database retains existing authentication/account/financial/export audits.

Console output is **not a durable security audit**. Each process emits at most 20 events of each kind per minute; later events are suppressed. It is sampled flood protection, not a complete request counter or global rate limiter. Private page redirects and every framework failure are not comprehensively logged. Correlation IDs identify individual signals, not an end-to-end request trace. No remote telemetry, notification, user data or external message was sent.

Before release, select a redacted centralized collector, restricted operator access, retention, clock synchronization, tamper-resistant audit destination, on-call owner and notification channel. Configure outside these scripts, then verify real delivery and acknowledgement. Recommended triggers for owner approval:

| Signal | Proposed response; thresholds are not an active production policy |
| --- | --- |
| Any receipt integrity failure | Preserve original PDF/database pair; pause affected document delivery; investigate private storage and checksums. Do not regenerate or reissue payment blindly. |
| Backup/restore failure, missed daily backup or recovery-point age >24h | Notify recovery operator; preserve last verified encrypted pair; verify key availability and independent offsite copy. |
| Sustained 401/403/429 or abnormal export volume | Investigate account/session abuse using protected audit trails; apply approved throttling or operator account disable. Sampled console totals alone are insufficient. |
| Repeated 5xx/DB pool failures/lock waits | Check process memory, disk, MySQL health and existing lock ordering; retain safe conflicts. Never disable financial locks to restore throughput. |
| Disk/receipt volume nearly full, cert nearing expiry, worker restart loop | Alert before saturation; repair durable storage/TLS/process supervision under a controlled change. |

Incident sequence: assign incident lead, isolate access through the host controls, preserve logs and paired evidence, revoke compromised accounts/sessions using the existing operator tool, rotate exposed credentials through the approved vault, determine affected documents/exports, restore only into independent staging, reconcile finance and obtain approval before reopening. Do not post sensitive exports to tickets or chat. If the operator credential is suspected compromised, remove its host access and replace it out of band; there is no public registration/recovery endpoint or invented application administrator role.

Owner decisions remain required for MFA/enrolment/recovery, inactivity duration and unsaved-form behavior, concurrent-session limit/inventory, ordinary password changes versus operator-only reset, broader breached/context password screening, and export step-up/notification/rate thresholds. Five equal-permission business users remain the approved model. Proposed controls must not silently create different user rights.

## Production capability gate

A selected host must demonstrate persistent Node runtime/native Argon2 support; supported MySQL 8.4 with the required transactions, named/row locks, triggers and separate migration/runtime/backup roles; durable private filesystem and correct OS ACLs; bounded exports; authenticated paired offsite backup with separate vault and restore staging; TLS/reverse proxy preserving validated Origin/Host; one approved public origin/secure cookies; process supervision/resource sizing; approved backup scheduler and central alerting. A filesystem-free or ephemeral-only runtime is incompatible with the current immutable private-PDF storage design. No host/tier has yet been approved or tested. Do not weaken durability, access checks, isolation or trigger permissions to fit a cheaper host.

Sources for the primitives: [Node crypto authenticated encryption](https://nodejs.org/docs/latest-v24.x/api/crypto.html), [MySQL 8.4 mysqldump](https://dev.mysql.com/doc/refman/8.4/en/mysqldump.html). The offline screening corpus is [SecLists common credentials](https://github.com/danielmiessler/SecLists/blob/master/Passwords/Common-Credentials/10k-most-common.txt), vendored with its MIT license and its exact local checksum in the release evidence. A common-password corpus is not comprehensive breached-password coverage.
