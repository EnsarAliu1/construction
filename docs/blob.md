# Private receipt storage on Vercel Blob

The private `construction-pdfs` store in Frankfurt (`fra1`) is connected only to the `construction` Hobby project in Production/Preview. **The main application still runs locally; no deployment or migration of real data/PDFs has occurred.** The Blob provider was exercised through real services and a loopback production HTTP server with genuine browser MFA/passkeys, disposable TiDB databases and isolated Blob owners.

## Provider selection and credentials

`RECEIPT_STORAGE_PROVIDER=vercel-blob` explicitly selects the adapter for verified TiDB connections. It requires server-only `BLOB_STORE_ID` and `BLOB_READ_WRITE_TOKEN`; the token must belong to the configured store. Alternate Blob API endpoints are rejected. Missing/invalid configuration fails before the payment transaction starts. Filesystem remains the local default, and existing local/demo storage behavior is retained. Filesystem persistence is refused on Vercel to prevent accidental use of ephemeral disk; the separate serverless visitor-demo design remains a deployment gate.

The ignored `.env.blob-test.local` is used only by explicit verification scripts. The application's `.env.local` was not overwritten. Test credentials are never printed or committed. The SDK is pinned to `2.9.0`; a scoped Zod `4.6.7` override fixes its transitive advisory without a force-upgrade.

## Immutable documents and ownership

New Cloud owners are derived deterministically from the verified database identity and Blob store. A private immutable owner marker binds the UUID, store and database. A mismatched marker, nonempty unowned prefix or foreign reference is refused. Every PDF uses `r/<owner-uuid>/<file-uuid>.pdf`, keeping the existing storage-reference shape. Writes disable overwriting; reads require the correct owner, an authenticated origin fetch, bounded complete PDF bytes and the expected SHA-256 checksum.

For a reviewed migration, `RECEIPT_BLOB_OWNER` can retain the original local `.owner.json` UUID so old receipt references and immutable history need no rewriting. Ownership must be registered before copying documents; the running application never adopts an unowned nonempty prefix. Restoring to a different database identity requires an explicit reviewed ownership/restore procedure. No migration or adoption tool has run on real files.

## Durable intent and recovery

A complete immutable private intent journal is persisted before each PDF upload. Issuance and recovery hold the same database advisory lock, scoped to the database/store/owner. Recovery verifies that its connection owns that lock and belongs to the marker's database. Every candidate is checked against `receipt_versions` outside the failed business transaction; failed/unknown database reads prevent deletion.

Referenced PDFs are always retained. Unreferenced PDFs are deleted only after owner, journal, PDF checksum and ETag validation. Journals remain after orphan cleanup: if an in-flight upload completes late after connection loss, the same durable intent makes the orphan discoverable on the next sweep. There is no age-based heuristic, global deletion or automatic cron cleanup. Each operator sweep is bounded and uses an owner-bound `b1.` pagination cursor. Local filesystem recovery keeps its original UUID cursor.

Retained journals add a small amount of private storage and API usage. Hobby quotas still apply; no paid plan was enabled. Back up owner markers and journals together with all PDF objects when implementing the final restore procedure.

## Existing behavior and download transport

The existing payment transaction still controls numbering, allocations, receipt audit, corrections, cancellation and idempotency. A correction creates a new PDF version; cancellation keeps all historical bytes. The final live-session check remains after Blob/checksum work and before releasing the download.

Verified bytes use chunked response streams on Vercel, preserving the existing 8 MiB receipt limit and bounded larger archives without the buffered-response limit. Local responses retain Content-Length. Private cache/no-store, attachment and security headers are preserved; Blob URLs and tokens are not returned to the browser. Actual deployed transport/browser verification is still required.

TiDB business reads now share the verified SELECT-only snapshot adapter. Business mutation guards use a supported physical user-row lock on TiDB instead of unsupported FOR SHARE; MySQL retains its existing lock behavior. Client mutations use READ COMMITTED on TiDB so the post-lock session check sees operator revocations committed while waiting.

## Evidence and checks

- `npm run test:blob`: owner/store boundaries, historical key preservation and complete private streamed bytes above 4.5 MB.
- `npm run test:blob:connection`: isolated private upload/read, checksum, overwrite denial, anonymous denial and exact-object cleanup. Evidence: `docs/blob-connection-verification.json`.
- `npm run test:blob:receipts`: real MFA and receipt/payment service functions on a fresh TiDB schema; issue/correct/cancel, original PDFs, rollback recovery, lost-response retry, concurrent idempotency, scope/checksum guards, required recovery lease, revoked download denial and operator recovery. Evidence: `docs/blob-receipts-verification.json`.
- `npm run test:blob:recovery`: a failed SQL reference read preserves the orphan PDF; a deliberately simulated late upload completion remains recoverable; referenced PDFs survive. Evidence: `docs/blob-recovery-verification.json`.
- `npm run test:blob:local`: starts only its own disposable MySQL when port 3307 is free, runs existing authentication/MFA/receipt/report workflows and removes only its own test container/schema/private files. Owner containers stay unchanged. If the owner's service is already running, use the existing isolated-schema workflow command instead.

All live proofs use generated synthetic namespaces and explicitly dispose only their own fixture objects after verification. Application recovery never deletes referenced PDFs; test-fixture disposal is a separate, narrowly scoped operation. Cloud HTTP/browser checks passed: `docs/cloud-http-verification.json` records genuine payment/receipt history, private streamed downloads, PDF/XLSX/ZIP downloads and session revocation. All six downloaded files were validated; ZIP entries were checked against their manifest hashes. Visitor-demo provisioning, backup/restore, real-data migration and actual public Vercel transport checks remain pending.

References: [private Blob](https://vercel.com/docs/vercel-blob/private-storage), [SDK](https://vercel.com/docs/vercel-blob/using-blob-sdk), [streaming response limits](https://vercel.com/kb/guide/how-to-bypass-vercel-body-size-limit-serverless-functions), [TiDB advisory locks](https://docs.pingcap.com/tidbcloud/locking-functions/), and [Hobby quotas](https://vercel.com/docs/vercel-blob/usage-and-pricing).

## Live deployment

Actual receipt data now uses the private Blob adapter on the production deployment. All eight original PDF byte checksums and legacy keys were preserved. Deployed Vercel PDF and complete ZIP responses above 4.5 MiB were validated through the separate fictitious demo; the main project uses the same private streaming response helper. The demo stores its fictitious PDFs in its own TiDB instance and has no access to the actual Blob token. See `online-demo-verification.json`, `owner-migration-verification.json` and [hosting operations](hosting.md).
