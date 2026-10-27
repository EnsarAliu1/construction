# WP-11 ? Corporate website delivery

27 October 2026. The bilingual website foundation is implemented. **356 distinct automated results pass**, including **32 real Edge browser tests**. This is not a production deployment, final brand/content approval or full accessibility certification.

## A. Repository baseline

Initial branch `main`, tracking `origin/main`, HEAD `049e02e343a8c9763bf22bdc3e6b0f99a7dfcd7f`. Only the owner's new WP-11 AGENTS.md was modified initially; preserved verbatim. Inspected actual public routes/components, dictionaries, shared/public/private layouts, tokens, metadata, contact behavior, existing tests and prior repository delivery evidence. Original Master Prompt, approved wireframes, photography and official branding/copy packages were not in the repository. Available visual assets were existing fonts; no authentic portfolio photography was available.

README.md remains unchanged: SHA-256 `915105d49441af288ecbd02a3ba423a85c12cb245ae9d8d27b3ba1694c837569`. Owner `.env.local`, `.next`, manual test container/database and personal browser profile remain untouched. Commit/push follows standing owner authorization; no deployment.

## B. Website architecture

Ten statically generated pages: `/sq`, `/en`, and `/sq|en/about`, `/services`, `/projects`, `/contact`. Root still redirects to `/sq`; unsupported languages/routes return 404. The language switch retains the current page in both directions. Document lang, title/description, Open Graph, canonical and hreflang are localized.

Public content is server-rendered. Only lightweight navigation/language behavior needs client JavaScript. Native mobile details/summary navigation still works with JavaScript disabled, as do real locale links and essential content. The public content registry has no database dependency or public/private project mapping. Real internal projects and receipts remain behind the existing authenticated routes.

Reusable hero/section/process/service/project/contact components expose stable `data-motion-slot` hooks. Essential text is always visible; no opacity/scroll/animation gate controls access. No animation/3D engine or CMS was installed.

## C. Content and asset inventory

The project-provided display name **Fitimi Construction** is used as a display brand, without claiming a registered legal identity. Neutral construction/preparation copy expresses a perspective without invented achievements, employees, years, leadership, guarantees, testimonials or service offerings. English and Albanian structures match and all translation strings are nonempty.

| Item | Actual status / handling | Required before release or publication |
| --- | --- | --- |
| Display name | Owner project name only | Confirm official brand/legal identity and spelling |
| Official logo/brand standards | Not supplied; original neutral wordmark/F icon | Brand approval or official vector assets |
| History/team/credentials/metrics | No verified source; omitted | Approved factual copy and evidence |
| Service catalogue | Zero approved entries; no Service 01 placeholders | Confirm specific offerings and bilingual descriptions |
| Public projects | Zero approved entries; honest introductory empty presentation | Curated copy, publication consent and safe public IDs |
| Project photography | None; no stock/generated work presented as real | Originals, rights/consent, localized alt text and dimensions |
| Contact address/email/phone | None published | Verified contact data |
| Online delivery/privacy | Not configured; fields/button disabled, no submission handler | Approved destination, delivery/storage, abuse and privacy design |
| Public domain/indexing | Unset by default; indexing opt-in off | Approved HTTPS origin and explicit indexing approval |

Typed `PublicService`, `PublicProject`, `ApprovedPhoto` and `PublicContact` enforce the publishing boundary. Drafts stay unpublished. Approved entries require bilingual copy, approval references and, for projects, consent plus approved local image paths, rights and dimensions. This models approval evidence; it does not independently prove legal image rights. `missingContent` holds the explicit outstanding inventory.

The hero is an original code-native abstract SVG architectural study with a localized caption stating it is not a completed project. Portfolio geometry is decorative, not a fictitious project. No unknown-rights imagery or private application assets are public.

## D. UI/UX foundation

Public-only CSS tokens establish warm paper, deep architectural teal and restrained clay accents. Typography, grids, spacing, CTA sections and native mobile menu form a distinct marketing layer without changing operational dashboard styling. Service/project components support approved future content; responsive Next Image sizing exists for future approved photographs.

Keyboard tests cover Enter/Tab, Escape returning focus, outside-click closing, navigation closing, route-preserving locale switches and skip-link focus. Text, links and the menu remain available without animation or JavaScript. Responsive widths 320, 390, 640, 768, 1024, 1280 and 1440 were exercised. No horizontal overflow was observed. Visual review removed duplicate section headings and redundant self-links.

## E. SEO and accessibility

Localized absolute titles fix the homepage's same-segment metadata-template behavior. Each page has description/OG metadata. Canonical/hreflang/x-default use only configured `PUBLIC_SITE_URL`; absent origin means no invented localhost/production canonical and an empty sitemap. The configured-origin sitemap contains exactly ten public pages, never app/API/login data. No fabricated Organization/LocalBusiness schema or social photograph is emitted.

`PUBLIC_SITE_INDEXING=0` defaults to noindex/nofollow and robots disallow-all. Explicit `1` plus a valid origin enables public indexing while retaining private-path disallows. Auth pages and app/API responses have noindex protections; existing private caching/authorization rules remain. Public security headers include nosniff and strict-origin-when-cross-origin.

WCAG 2.2 AA is the target: semantic headings/landmarks, labels, visible focus, accessible disclosure semantics, contrast checks, reduced motion and focusable skip target are implemented. Axe reported zero violations in the ten desktop page scans for WCAG 2 A/AA, 2.1 AA and 2.2 AA tags. This plus browser keyboard checks is not a full conformance claim; manual assistive-technology testing, native browser zoom and additional browser engines remain release QA.

## F. Real browser verification

The connected browser runtime reported no available browser. The owner's explicit WP-11 authorization permitted a bounded local development-only fallback. Existing **Microsoft Edge/Chromium 156.0.4314.42** launched successfully headlessly with a fresh temporary profile, using exact **@playwright/test 1.64.1** and **@axe-core/playwright 4.14.0**. No browser binary download, personal profile access or global browser-default change was needed.

**32 passed**, zero final failures/skips, one worker, no automatic retries. Coverage:

- All ten pages at 1440?1000 and 390?1000, with twenty full-page screenshot captures.
- Ten desktop axe scans, page titles/lang/canonical/hreflang, real direct-route loading and overflow checks.
- Five SQ?EN?SQ page-preserving language-switch cases.
- SQ/EN mobile keyboard/Escape/outside-click/navigation and skip/contact cases; keyboard viewport 390?844.
- Reduced-motion + 200% root-text-size case at 640?900 (not represented as native browser zoom certification).
- A real JavaScript-disabled mobile navigation/language-switch case.
- 320/768/1024/1280 breakpoint checks at 1000px height.
- Browser page errors/console errors and hydration mismatch messages collected per test; none in final results.

Evidence is local ignored `artifacts/wp11/browser-results/results.json` and `artifacts/wp11/screenshots/{sq|en}-{page}-{1440|390}.png`. Representative screenshots were manually reviewed in addition to automated checks; no claim that every screenshot received a separate manual audit. Initial browser failures found the missing home brand title and an outside-click test targeting a heading covered by the open menu. The title was fixed and the test uses a real uncovered outside point. No production test bypass or fake pass was introduced.

For local reruns: start the dev server, then `npm.cmd run test:website:browser`. It defaults to `http://127.0.0.1:3000`, accepts exported `AUTH_ORIGIN` only on loopback, and expects `PUBLIC_SITE_URL` to match the server if configured. The test runner uses ephemeral contexts rather than an owner browser profile.

## G. Security and environment

Synthetic internal client/project/payment/receipt records were created in the owned disposable database. None of their names/IDs appeared in any of the ten public page payloads. Protected app pages still redirect; project/receipt/document/data APIs still return 401 anonymously. Raw receipt storage references do not resolve publicly. Contact POST has no delivery API and never reports sent; disabled controls collect/store no visitor message. Public pages set no session cookie and add no visitor tracking.

Only task container `fitimiconstruction-mysql-wp11`, ID `81341a1baaed8227e4933da2d1707115abc38917a8d8626fac9abd8272bc194f`, loopback `127.0.0.1:3310`, database `fitimi_test_wp11` was used. Actual MySQL 8.4.13/InnoDB/UTC was checked before migration. No new migration was required: all nine prior SQL files/hashes remain identical, with 20 application tables, 45 FKs, 89 indexes, 37 checks and all 13 original guards. Final fixture accounts are inactive.

The owned test server/container/private synthetic files and credentials are disposed after verification. The owner manual environment remains intact. Public screenshots/reports may remain as ignored evidence. Staged files are scanned for local/test secret material before commit. Six previously reported moderate dependency advisories remain; no new clean-audit or production security certification is claimed.

## H. Commands and results

Package scripts ran through `node artifacts/wp11/run.mjs <script>` with an isolated environment and `.next-wp11`, preserving owner configuration/build. This executes the actual package script.

| Script/command | Result |
| --- | --- |
| `npm.cmd test` | PASS ? 8 website + 7 reporting + 48 existing = 63 |
| `npm.cmd run test:db` | PASS ? 15 reporting + 154 existing = 169 |
| `npm.cmd run test:website:db` | PASS ? 7 public/private HTTP results |
| `npm.cmd run test:reports:http` | PASS ? 12 |
| `npm.cmd run test:payments:http` | PASS ? 10 |
| `npm.cmd run test:receipts:http` | PASS ? 9 |
| `npm.cmd run test:expenses:http` | PASS ? 10 |
| `npm.cmd run test:references:http` | PASS ? 19 |
| `npm.cmd run test:projects:http` | PASS ? 8 |
| `npm.cmd run test:clients:http` | PASS ? 8 |
| `npm.cmd run test:auth:http` | PASS ? 9, including exact owned-container outage |
| `npm.cmd run test:website:browser` | PASS ? 32 real browser cases |
| `npm.cmd run db:check` | PASS |
| `npm.cmd run db:migrate` | PASS ? fresh owned DB and repeat execution |
| `npm.cmd run typecheck` | PASS |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS ? 26 static pages, locale pages/icon/robots/sitemap |
| `npm.cmd run check:routes -- http://127.0.0.1:3001` | PASS |
| Migration/README/owner-env comparison | PASS ? preserved |
| Production trace inspection | PASS ? 66 traces exclude private/test/env files |

**356 distinct results** = 63 unit + 169 database + 85 previous HTTP + 7 new isolation HTTP + 32 browser. Node counts include parent/subtests; reruns are not counted twice. Existing tests were not disabled. A pre-existing reporting assertion assumed UUID-sorted phases matched contract display order; it now checks the actual selected/retired phase IDs. Both capacity checks remain enforced, and no financial application formula/rule changed.

### Exact changed paths

| Path | Purpose |
| --- | --- |
| `.env.example` | Approved-origin/indexing configuration and WP-11 test label. |
| `.gitignore` | Exclude isolated build and browser outputs. |
| `AGENTS.md` | Owner WP-11 instructions preserved verbatim. |
| `eslint.config.mjs` | Ignore generated test/build output; retain source checks. |
| `next.config.ts` | Isolated WP-11 build, public headers and private noindex headers. |
| `package-lock.json` | Exact development-only browser/accessibility dependencies. |
| `package.json` | Website unit/HTTP/browser scripts; all existing tests retained. |
| `src/app/(auth)/layout.tsx` | Explicit authentication-page noindex metadata. |
| `src/app/(website)/[locale]/[page]/page.tsx` | Localized per-route metadata. |
| `src/app/(website)/[locale]/layout.tsx` | Public stylesheet and display-brand metadata template. |
| `src/app/(website)/[locale]/page.tsx` | Explicit localized home metadata. |
| `src/components/public/public-shell.tsx` | Public branding/header/footer and native mobile disclosure. |
| `src/features/receipts/storage.ts` | Reject the new build directory as receipt storage. |
| `src/features/website/public-screen.tsx` | Five complete localized page compositions and honest contact availability. |
| `src/i18n/dictionaries.ts` | Equivalent typed SQ/EN neutral copy and navigation. |
| `tests/auth/http.integration.test.ts` | Exact WP-11 outage ownership and build manifest support. |
| `tests/reporting/http.integration.test.ts` | Support only the explicitly owned WP-11 loopback test target in addition to WP-10. |
| `tests/reporting/reporting.integration.test.ts` | Fix nondeterministic positional phase assertions to check the actual phase IDs. |
| `tsconfig.json` | Generated WP-11 route type includes. |
| `playwright.config.ts` | Local-only isolated Edge runner and evidence outputs. |
| `src/app/icon.svg` | Original geometric F icon; no external image/official logo claim. |
| `src/app/robots.ts` | Safe default noindex; explicit opt-in and private-route exclusions. |
| `src/app/sitemap.ts` | Ten public routes only, using configured origin. |
| `src/components/public/mobile-menu.tsx` | Progressive native details menu, Escape/focus/outside click support. |
| `src/features/website/content.ts` | Explicit public approval/consent/image-rights boundary and missing-content inventory. |
| `src/features/website/sections.tsx` | Server-rendered scene, sections, service/project presentations and WP-12 hooks. |
| `src/features/website/seo.ts` | Safe origin, canonical/hreflang, localized OG and indexing control. |
| `src/styles/website.css` | Public-scoped tokens, architectural composition, responsive and reduced-motion styles. |
| `tests/website/browser/public.spec.ts` | 32 real browser checks and twenty screenshot captures. |
| `tests/website/content.test.ts` | Eight translation/publishing/SEO safety tests. |
| `tests/website/isolation.integration.test.ts` | Seven real public/private HTTP and synthetic-record isolation results. |
| `docs/WP-11-report.md` | Delivery, inventory, acceptance and concrete WP-12 handoff. |

## I. Acceptance

| Criterion | Status | Evidence |
| --- | --- | --- |
| WP11-AC01 | PASS | Ten real SQ/EN routes and browser cases. |
| WP11-AC02 | PASS | Five bidirectional page-preserving language switches. |
| WP11-AC03 | PASS | No invented facts/offers/portfolio; explicit inventory. |
| WP11-AC04 | PASS | Visible server content with stable progressive motion hooks. |
| WP11-AC05 | PASS | Scoped public tokens and shared section/navigation patterns. |
| WP11-AC06 | PASS | Curated static public source; real private canary records never exposed. |
| WP11-AC07 | PASS | No message handler/fake success; disabled honest contact state. |
| WP11-AC08 | PASS | Localized titles/descriptions/OG/canonical/hreflang and safe origin. |
| WP11-AC09 | PASS | Public-only sitemap; auth/app/API noindex protections. |
| WP11-AC10 | PASS | Semantic/keyboard/focus/contrast/reduced-motion foundations; no certification claim. |
| WP11-AC11 | PASS | Real desktop/mobile/extra breakpoint navigation tests pass. |
| WP11-AC12 | PASS | Real isolated Edge/hydration/console testing with JSON/screenshots. |
| WP11-AC13 | PASS | SSG, minimal client code, inline SVG and sized future approved images. |
| WP11-AC14 | PASS | Private API/receipt/access boundaries preserved. |
| WP11-AC15 | PASS | Translation, metadata, publishing and public route tests pass. |
| WP11-AC16 | PASS | Financial/auth/history/export/receipt regressions pass. |
| WP11-AC17 | PASS | Strict TypeScript, zero-warning lint and optimized build pass. |
| WP11-AC18 | PASS | Local synthetic environment only; no real customer/production access or deploy. |
| WP11-AC19 | PASS | Missing legal/brand/service/project/contact/photo approvals explicitly recorded. |
| WP11-AC20 | PASS | Concrete section-by-section WP-12 map below; no automatic implementation. |

## J. WP-12 creative/technical handoff

These are feasible directions, **not approved final visuals**. Existing static content is the fallback; no expensive animation has been implemented.

| Section / existing hook | Feasible WP-12 enhancement | Required constraints |
| --- | --- | --- |
| Hero `building-assembly` / `.scene-volume-*`, `.scene-slab` | Progressive slab/building assembly; crane-guided elements; optional SVG stroke reveal | Keep H1/CTA outside scene; preserve abstract-study caption; static/reduced-motion/mobile fallback; no claim of an actual completed project |
| Approach `architectural-reveal` | Grid/dimension lines align with text; restrained architectural scroll storytelling | Never hide essential copy, alter reading order or capture keyboard scrolling |
| Preparation `brick-sequence` | Bricks assemble beside the three visible brief questions | Illustrative sequence, not an unsupported claim of the firm's operational process; pause offscreen and with reduced motion |
| Approved service cards `service-scenes` | Small crane/machinery scenes related to the confirmed service | Await approved catalogue; no scene implying an unconfirmed offering or owned fleet |
| Curated portfolio `project-reveal` | Subtle image framing/depth and project transitions | Only consented real images; preserve dimensions, alt text and zero unpublished/private records |
| Contact CTA `vehicle-transition` | Restrained truck/vehicle line-art travelling along a section boundary | Decorative concept, not an ownership claim; never cover controls or imply delivery where none exists |
| Header/footer/links | Focus/hover/active-state polish and native disclosure transitions | Preserve no-JavaScript navigation, Escape/outside behavior, focus and target sizes |

Use optional, lazy client enhancements attached to these server sections. Gate motion with reduced-motion preference and viewport visibility; provide mobile simplification, pause/offscreen handling and reliable cleanup. Do not install 3D infrastructure or choose a final art direction without an approved need. No counters, fake achievement metrics or invented testimonials belong in these scenes.

## K. Remaining release gates

Approved brand/legal identity, real service catalogue, bilingual copy signoff, public project consent/photography rights, verified contacts, delivery/privacy configuration and approved public domain/indexing remain outstanding. Existing financial receipt/accounting and production storage/backup prerequisites remain unchanged.

Edge desktop/mobile is now verified, closing the previous automatic browser gap. Additional engines/devices, manual assistive-technology/native zoom testing, final content/design approval and production performance/hosting review are still required. No full WCAG conformance, Lighthouse score or final premium-motion approval is claimed. WP-12 was not started automatically. No deployment occurred.
