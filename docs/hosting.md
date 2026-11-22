# Hosting operations

- Website and private application: https://construction-ensar.vercel.app
- Direct private login: https://construction-ensar.vercel.app/administrata
- Isolated personal demo: https://construction-demo-ensar.vercel.app/demo

## Deployment

Vercel Hobby runs Next.js on Node 24 in Frankfurt. Two MySQL-compatible TiDB Cloud Starter instances separate actual application data from fictitious demo visitors. Both instances were configured with a $0 spending limit. Private Vercel Blob stores actual receipt PDFs. No paid service or payment method was enabled; free-plan quotas still apply.

The main application uses a restricted SQL runtime account and a separate SELECT-only reporting account. Real-instance operator credentials remain local. Authentication keeps password + TOTP, recovery codes and passkeys. The deployed MFA key ring matches the original key ring; the owner confirmed successful online login after controlled account recovery.

Only the dedicated demo process has its own demo-instance provisioning credential. Its namespace pin, installation marker, allowed-schema inventory and per-visitor SQL users limit it to fictitious data. It receives no real database credential, MFA key ring or Blob token. Demo PDF chunks are private, append-only and committed in the same SQL transaction as the payment. This avoids using the actual application's Blob quota for anonymous demo documents.

Ready demo schemas are prepared ahead of time. Claiming a workspace seeds current fictional examples. A bounded Next.js `after()` callback prepares a replacement; expired visitors are reclaimed on entry. No Docker, persistent Node process, local PDF directory or frequent cron is needed online. During bursts without a ready workspace, visitors receive a retry message. Session lifetime, per-minute starts, request budgets and the twenty-workspace ceiling are retained.

Vercel builds use the standard `.next` directory. Local verification outputs remain separate. Font, logo, PDFKit and reviewed SQL migration assets are explicitly traced. `.vercelignore` excludes every `.env*`, `.private`, local database/document/backup file and generated test artifact from uploads.

Environment sources, all ignored by Git:

- `.env.main-cloud.local`: restricted production runtime, MFA key ring and private Blob configuration.
- `.env.tidb-test.local`: real-instance operator connection; never deploy it.
- `.env.demo-tidb.local`: dedicated demo-instance operator source.
- `.env.demo-cloud.local`: dedicated demo provisioning configuration.

Update an environment through `node scripts/hosting/vercel-env.mjs main` or `demo`, then redeploy the corresponding Vercel project. Environment updates affect new deployments. Never migrate by rerunning a local development launcher against production.

## Backup and migration

Encrypted backups and their metadata are in `.private/hosting-backups/`. `recovery.key` is required for decryption: keep a separate secure copy and never commit or share it. `physical-backup.json` identifies the encrypted snapshot of the cleanly stopped original MySQL volume; `owner-latest.json` identifies the encrypted logical SQL/rows/PDF/environment archive. Keep the archives and key when moving or replacing this computer.

Before migration, the logical archive was decrypted and checksum-verified, SQL was restored into a labelled temporary MySQL container, every table/row was compared, PDFs were read through the private receipt store with original checksums, and MFA factors were successfully decrypted. Only the temporary restore container/files were removed. The original MySQL volume, environment files and PDF bytes were retained.

The reviewed migration created a fresh owned TiDB database, imported every application table, mapped mutable receipt identities/current states into the append-only Cloud layout, retained all historical snapshots and original PDF keys/bytes, then verified exact logical rows and PDF hashes. Original migration metadata remains in the encrypted source backup; the Cloud schema uses its reviewed installation manifest. Do not rerun migration after online writes: its checkpoint and comparison checks intentionally refuse overwrites.

Local development keeps the retained local MySQL copy. Account/data changes made online do not automatically change that development copy. The online database is now the application's active production source.

## Operator recovery

Use an interactive terminal on the trusted operator computer, inside this repository:

```sh
npm run recover:online
npm run recover:mfa
```

The first command lists active accounts locally and accepts a new password twice without displaying it. The second follows the existing verified-identity operator procedure and requires explicit confirmation for the chosen account before replacing its MFA enrollment. It revokes old sessions/codes and requires genuine new QR/TOTP enrollment before private access. No public reset endpoint or MFA bypass was added. Neither command accepts passwords as arguments or prints secrets.

TOTP codes change every thirty seconds; login challenges expire after five minutes. A passkey created for localhost must be registered again for the public hostname after a successful MFA login. Use the security page to register the new device and remove obsolete local entries.

## Evidence

- `hosting-backup-verification.json`: encrypted backup, full restore and original PDF/MFA checks.
- `owner-migration-verification.json`: preserved rows, receipt state/history, PDF checksums and restricted roles.
- `cloud-http-verification.json`: genuine password/TOTP/recovery/WebAuthn and business browser workflows.
- `demo-cloud-verification.json`: two visitors, isolation, transactional PDFs, immutable history, exports and expiry.
- `online-demo-verification.json`: real HTTPS browser entry, protected PDFs, and deployed PDF/ZIP streams above 4.5 MiB.
- `deployment-readiness.json`: current deployment state and remaining operational items.

Actual production login was confirmed by the owner. No passwords, keys, session tokens or private document bytes are stored in these evidence files.
