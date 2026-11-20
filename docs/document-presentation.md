# Excel and payment receipt presentation — 20 November 2026

Baseline: `main`, `b5f5c92`. The owner explicitly selected **company-configurable presentation, payment-receipt redesign only, and unchanged payment/cash logic** after the initial tax-invoice request was clarified. No tax-invoice module, new invoice counter, payment limit, business permission or database migration was introduced. No owner environment, README, historical migration or existing financial trigger was modified. No deployment or push.

## Excel

The actual ExcelJS application generator now opens on **Pasqyra ekzekutive**: company branding/logo, applied period and snapshot time, income/expenses/operational difference/outstanding cards, relative cash-flow bars, portfolio figures, the five projects with the largest period movements and internal links to the detailed sheets. All-time contract figures are explicitly distinguished from period-filtered movements; the operational difference is not described as accounting profit.

The seven established sheets remain: Përmbledhja, Pagesat, Shpenzimet, Ndarja sipas projekteve, Kategoritë, Mënyrat e pagesës and Të dhënat shpjeguese. Their names, raw values and cell positions are retained; existing `Përmbledhja!B3`/`Pagesat!F2` consumers continue to work. Headers, zebra rows, semantic alignment, sensible widths, frozen panes, filters and print layouts were improved.

Monetary source values remain **exact decimal text**, including values beyond Excel's 15-digit numeric precision. Summary display strings are also exact. No executable financial formulas or external data links are created from user data. The cash-flow bars are six-segment relative indicators, separate from the displayed exact amounts. New navigation links are internal workbook links only.

## A4 payment receipt

Newly issued PDFs use the redesigned A4 layout: company logo/identity/contact/bank information; receipt number/version, issuance date, actual payment date and payment method; client address/NUI information where already available; project/location; a proper allocation table; a highlighted received total; signature areas and page numbers.

Rows describe **payment allocations**, with unit `pagesë`, rather than inventing quantities of supplied construction work. Real quantities, supply dates, taxable supplies and tax-invoice numbering cannot be inferred from a partial-payment record. The document remains titled **DËFTESË PAGESE** and explains that it confirms payment and does not replace a tax invoice. The original requested unconditional electronic-invoice legal-validity statement is not asserted for this receipt.

Ordinary rows remain together; repeated table headers and compact document headers accompany continued pages. Exceptionally tall single descriptions continue explicitly. The last row is kept near the summary/signatures where possible. Sample normal, no-VAT and maximum-DECIMAL receipts fit one A4 page; a 60-allocation sample spans seven properly numbered pages. All rendered text stays within tested page bounds, including ë/ç and large values. Embedded Noto Sans fonts remain in use.

### Company configuration

Server/deployment configuration is documented in [.env.example](../.env.example). The actual owner `.env.local`/`.env.development.local` files were left unchanged.

Use `RECEIPT_COMPANY_NAME`, `RECEIPT_COMPANY_ADDRESS`, `RECEIPT_COMPANY_CITY`, `RECEIPT_COMPANY_NUI`, `RECEIPT_COMPANY_PHONE`, `RECEIPT_COMPANY_EMAIL`, `RECEIPT_COMPANY_BANK` and `RECEIPT_COMPANY_IBAN`. `RECEIPT_LOGO_FILE` is a PNG/JPEG basename already inside `public/logos`; traversal, remote URLs and arbitrary local-file paths are rejected. No company details are fabricated.

`RECEIPT_VAT_STATUS` is `unspecified` (default), `not-registered` or `registered`. A registered profile also requires `RECEIPT_VAT_NUMBER` and an explicit `RECEIPT_VAT_RATE` of `18`, `8` or `0`; rate 0 requires `RECEIPT_VAT_NOTE`. Unspecified/unregistered profiles do not silently calculate 18% VAT. A registered profile displays the configured VAT as included within the **existing recorded payment**. The included/added VAT helpers use BigInt cents and deterministic half-up rounding; per-row rounding cents reconcile exactly to the total. No VAT is added to a stored payment, contract capacity or ledger balance.

The current client model has NUI/address fields and no dedicated client VAT-number field. Missing client VAT data is shown as `—`; no tax identifier is invented and no client-schema expansion is hidden in this visual change. This is not a complete multi-rate invoice/tax-accounting engine. Correct tax configuration and any eventual invoice/fiscalization work require the responsible accountant's review.

Background references reviewed for the initial request: [ATK invoice-content guidance](https://www.atk-ks.org/wp-content/uploads/2021/11/ATKPermbushjaTatimoreSQ.pdf), [ATK FAQ including 2024 invoice requirements](https://www.atk-ks.org/en/pyetje/?wpfaqpage=138), [Kosovo law on information society services](https://gzk.rks-gov.net/ActDocumentDetail.aspx?ActID=2811). No claim of 100% legal validity or certified fiscalization is made. The owner's subsequent choice to keep payment logic unchanged governs this implementation, including cash payments.

### Immutable history

Presentation details are rendered **at issuance** into the protected, checksum-verified PDF. Already issued files are downloaded from the existing private store; they are never regenerated from current branding/configuration. Existing snapshot allowlists and thirteen triggers remain intact. A correction produces a new immutable PDF version, retaining the original receipt number and all earlier bytes. Cancellation preserves every PDF and releases exactly the prior financial allocation. A configuration/design change therefore applies to new receipts or explicitly corrected versions, not old original documents.

## Verification

- Full unit/domain suite: **103 PASS** (40 + 10 + 53), including new explicit company-profile validation, VAT 18/8/0 included/added, tiny/large amounts and per-line rounding reconciliation.
- TypeScript, lint and production build passed. Logo/font tracing is included for payment/report/export generation.
- Actual saved XLSX reopens with ExcelJS: eight sheets, all original exact monetary text/IDs, original raw-cell positions, frozen/print settings and no formula nodes. All eight sheets were visually reviewed using read-only HTML reconstructions of the saved cell styles/values. Native Microsoft Excel/LibreOffice was not installed; native GUI rendering is **not claimed**. The standalone spreadsheet artifact runtime was unavailable, so the existing application ExcelJS generator was retained.
- PyMuPDF rendered the actual generated PDFs; automated checks verify A4 geometry, page numbering, totals, VAT/no-VAT cases and text bounds. First/last pages and the large-value case were visually reviewed.
- Real disposable MySQL 8.4, production-mode HTTP and actual Edge checks passed: client/project/payment creation, original and corrected PDF identity, idempotent original confirmation replay, cancellation, unchanged phase balance, report PDF/XLSX/ZIP downloads, secret exclusions and **372 private-access denial requests**. The existing security lab now includes the receipt-lifecycle regression.
- The owner's MySQL container was stopped. A separate labelled, tmpfs, task-owned container used the free original port 3307 with a separate synthetic root secret. The task container/schema/users/keys were disposed; the owner container remained stopped. No owner database migration or data change occurred.

Redacted evidence: [document-presentation-verification.json](document-presentation-verification.json).

Reproduce local document samples with `npm run documents:preview`. Generated examples/previews are ignored under `artifacts/documents`. `python scripts/documents/verify_pdf.py` uses the optional local renderer installed under `artifacts/document-tools`; it is a verification tool, not an application dependency. `npm run test:documents:local` requires Docker and free ports 3307/3000 and uses only its own disposable database container. With an already running approved local MySQL, use `npm run test:security:local` instead.

Main changed files: `src/features/reporting/{documents.ts,workbook.ts}`, `src/features/receipts/{pdf.ts,company-profile.ts,tax.ts,service.ts}`, `.env.example`, `next.config.ts`, `package.json`, the reporting/receipt presentation tests and `scripts/documents/*`. Security-lab changes add the lifecycle check and permit a separate synthetic root-password file without changing owner configuration.
