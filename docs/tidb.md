# TiDB backend preparation

**The application still uses local MySQL. No real business data or original PDF has been migrated.** Cloud schema, account and storage proofs use generated synthetic resources that are removed afterward. Original MySQL migrations and owner environment files are unchanged.

## Connection and privileges

The tested Cloud engine is `8.0.11-TiDB-v8.5.3-serverless`. The separate connector verifies the TLS certificate/hostname, requires TLS 1.2+, UTC, pessimistic transactions, strict SQL mode and enabled CHECK constraints. Decimal and large integer values remain exact strings; multi-statement queries are disabled. Storage ownership binds endpoint, tenant prefix and schema, rather than TiDB's placeholder server UUID.

Application/reporting purposes reject root accounts. This minimum guard does not replace auditing grants: `validateRuntimeGrants` checks the complete runtime profile, while reporting snapshots check their SELECT-only principal before executing business queries. Grants are table-specific and profiles reject roles, wildcard scope, grant options and broader privileges. Operator credentials remain separate from runtime/reporting credentials.

Runtime users can append audit, document, receipt-state and authentication-generation history, but cannot update/delete it. Financial DELETE and schema DDL are denied. The `users` and account-control tables stay SELECT-only; passwords, account activation and provisioning remain operator actions. Only expired passkey challenge cleanup needs runtime DELETE.

## Schema plan

`npm run tidb:schema-plan` writes `docs/tidb-schema-plan.json` locally without connecting to any database. Twelve original migration sources are bound to reviewed SHA-256 checksums, with CRLF normalized to LF. Changed source or journal order fails before execution. The plan replaces thirteen unsupported trigger statements with restricted capabilities and the Cloud receipt layout; UTC defaults become `CURRENT_TIMESTAMP(3)` on UTC connections.

Schema version `construction-tidb-schema/2` has 227 DDL statements, 27 physical application tables, two compatibility views and a separate installation manifest. Existing constraints, FK relationships, MFA/passkey tables and safe JSON checks are retained. The installer requires a registered operator connection to an empty schema with `utf8mb4_0900_ai_ci`; it refuses nonempty schemas. TiDB DDL auto-commits, so failed disposable installations are discarded rather than retried over existing objects. No general-purpose migration/repair command is activated for owner data.

## Read snapshots

TiDB does not enforce `START TRANSACTION READ ONLY` on the tested engine. No noop behavior is enabled. MySQL retains the original read-only repeatable-read transaction. Registered TiDB connections open a separate SQL SELECT-only reporting connection, verify the same tenant/schema and audit grants, then read one consistent MVCC snapshot. Report authorization stays on the original application connection and is checked before and after materialization.

Reporting credentials are server-only `DB_REPORT_USERNAME` and `DB_REPORT_PASSWORD`. Reporting queries select public user fields and never export authentication secrets. The SQL profile currently grants table SELECT on `users`, because column grants are unsupported; the export projection excludes password fields. The reporting principal cannot read MFA/session tables, `auth_users` or `auth_user_versions`.

## Receipt history

`payment_receipt_identities` preserves ID, payment binding and unique receipt number. Corrections/cancellation append `payment_receipt_states`. The read-only `SQL SECURITY INVOKER` view `payment_receipts` projects the current row into the existing shape consumed by screens, payments and reports. Document revisions reference the physical identity and retain original snapshots, private references and checksums.

The persistence adapter locks physical identities. Corrections append state and PDF revision inside the existing payment transaction; cancellation appends a void state and retains all earlier PDFs. Full Cloud business snapshots include the two physical identity/state datasets; the local MySQL dataset list is unchanged. Filesystem storage remains the default local implementation. The private Blob adapter is available behind an explicit provider setting; see `docs/blob.md` for ownership, recovery and verified Cloud service behavior.

## Authentication generations and MFA

Column-level UPDATE grants did not authorize the intended write on this Cloud version. MFA now appends a generation to `auth_user_versions`; it does not need UPDATE on `users`. The `auth_users` INVOKER view resolves the latest generation against the imported user's base generation. Older inserted generations cannot lower the effective version. Runtime UPDATE/DELETE of history is denied.

Password login, MFA, session verification and passkey eligibility use the effective generation. Operator activation, password reset and MFA recovery advance that same generation inside their existing transactions. MySQL keeps its existing user-row update. Generation values are validated exact unsigned 32-bit integers; driver expression strings are normalized only for authentication fields.

Cloud authentication transactions use READ COMMITTED and explicitly lock the physical user before reading the derived view. This ensures a transaction waiting on an operator change observes the new generation after obtaining the lock. The existing user-first lock order, TOTP replay checks, recovery-code single use and session revocation remain enforced. No enrollment bypass or alternate login flow was introduced.

## Verification commands

- `npm run test:tidb`: connector, grant-policy, source-integrity and Windows/Linux fingerprint checks.
- `npm run test:tidb:connection`: synthetic SELECT/transaction and exact decimal proof using the ignored `.env.tidb-test.local`.
- `npm run test:tidb:reporting`: disposable Cloud reader, MVCC consistency, SQL write denial and rejection of an accidentally writable reader.
- `npm run test:tidb:receipts`: actual repository functions and privately stored PDFs in a fresh Cloud schema; issue/correct/cancel, concurrency, checksums, rollback/orphan recovery, immutable history and reporting view.
- `npm run test:tidb:schema`: full fresh schema and capability profiles; metadata, CHECK constraints, account-admin denials, real password/TOTP enrollment/login, replay denial, concurrent recovery-code use, concurrent generation increments, operator recovery, password reset, deactivation and passkey options. This is a server-service integration proof, not completed browser WebAuthn/HTTP testing. Sanitized evidence is written only after temporary SQL objects are removed.
- `npm run test:tidb:mysql-regression`: new local schema, MVCC consistency and real MySQL read-only enforcement.
- `npm run test:tidb:mysql-workflows`: existing authentication/MFA, receipt and reporting integrations on a new free WP03..WP16 schema required by the guarded fixtures. Existing schemas are never reused. Generated SQL users, schema and private directory are removed.

No command prints credentials or loads the application's environment into the Cloud test configuration. The local regression commands use the existing local root-password file without outputting its contents.

## Remaining activation gates

Full Cloud HTTP/browser verification passed on a disposable database: see `docs/cloud-http-verification.json`. Existing data is still local. Before real migration, complete isolated serverless visitor-demo provisioning, verified backup/restore and reviewed migration preserving authentication generations and all original PDF versions. Public Vercel transport/HTTPS checks remain part of deployment. No paid service was activated.

References: [MySQL compatibility](https://docs.pingcap.com/tidbcloud/mysql-compatibility/), [privilege management](https://docs.pingcap.com/tidbcloud/privilege-management/), [views](https://docs.pingcap.com/tidbcloud/sql-statement-create-view/), [pessimistic transactions](https://docs.pingcap.com/tidbcloud/pessimistic-transaction/) and [system variables](https://docs.pingcap.com/tidbcloud/system-variables/).

## Explicit application provider

The shared application connection factory supports `DATABASE_PROVIDER=tidb` only when a restricted runtime SQL account, same-tenant reporting credentials and the exact reviewed schema manifest are present. It audits all runtime grants and the manifest on every new connection, closes failed connections and refuses operator/root credentials. The runtime has SELECT-only access to the manifest; it cannot alter the deployment proof or install migrations. `connectDatabase()` and authentication HTTP handlers share this factory.

`DATABASE_PROVIDER=local-mysql` remains the default outside Vercel. The owner's environment is unchanged. Vercel without a Cloud provider fails closed. TiDB combined with the existing local visitor-demo mode is explicitly refused until the separate serverless demo adapter is implemented.

### Disposable HTTP/browser verification

Build the isolated `.next-cloud` output with `FITIMI_TEST_BUILD=cloud` before `npm run test:tidb:http`. The harness reads only ignored test credential files, provisions a new synthetic schema and restricted runtime/reporting principals, and starts a separate loopback production server. Operator credentials are never sent to that HTTP server. It uses a fresh headless Edge profile and a virtual CTAP2 authenticator; this does not verify a physical device's PIN/biometric prompt.

The harness checks rejected configuration/grants, password/MFA/recovery, passkey registration/login, business forms, corrections/cancellations, protected historical PDFs and browser PDF/XLSX/ZIP downloads. Vercel's streaming response branch is exercised locally; actual deployed Vercel transport remains a deployment check. Test evidence contains no credentials. Only this generated fixture's SQL and Blob resources are disposed afterwards. A test failure may retain safe diagnostics and synthetic screenshots under ignored `artifacts/cloud-http`.

The completed browser proof covers 13 business scenarios, 9 authentication/storage checks and 6 real downloads, including a checksum-verified historical PDF and the complete ZIP. A fresh SQL connection is opened for final inspection, operator revocation and disposal, so a long browser run cannot rely on an expired idle probe connection. All generated SQL accounts, schemas and private Blob prefixes were removed; the owner environment hash was unchanged. The 42 MySQL authentication/receipt/report integration checks also passed with only a task-owned temporary container.

## Completed production activation

The main project now selects the restricted TiDB runtime and private Blob provider. The original 26-table MySQL backup passed a full isolated restore; all eight original PDFs were migrated with identical references/checksums. The owner confirmed the actual production login. The dedicated serverless demo, real-data migration, HTTPS deployment and large streamed-download checks are complete. Earlier integration reports above remain historical evidence. `docs/deployment-readiness.json` and `docs/hosting.md` record the current live state; the retained local development configuration is unchanged.
