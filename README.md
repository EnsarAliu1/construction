# Construction website & management workspace

WP-01 creates a local Next.js interface foundation. The public website has five pages in Albanian and English; the management workspace has a dashboard and ten section screens. All business screens are empty previews.

**The `/app` area has no server-side authentication or authorization. Do not deploy this application publicly before access control is implemented.** A `noindex` directive is included for previews; it is not access control.

## Local setup

Use Node.js 24 LTS and npm (verified with Node 24.18.0 and npm 11.6.1). The framework requires Node >=20.9.0; Node 24 is the documented development baseline. No environment variables, credentials, database or external services are required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:3000. The default route redirects to `/sq`. The server binds to loopback for local use. On Windows PowerShell with script execution disabled, use `npm.cmd` in place of `npm`.

```sh
npm run typecheck
npm run lint
npm run build
npm run start
```

`typecheck` first generates Next.js route types and then runs TypeScript with strict checking. ESLint runs separately from the production build, using the official Next.js flat configuration. With either the development or production server running, check all content routes:

```sh
npm run check:routes
# Optional alternative origin:
npm run check:routes -- http://127.0.0.1:3001
```

This smoke check verifies HTTP responses, document languages, headings, active navigation, the default locale redirect, invalid-route responses and disabled contact forms. Browser checks are still needed for responsive appearance, keyboard interaction and hydration.

## Routes and architecture

- `/` redirects to `/sq`.
- `/sq`, `/en`: home.
- `/{sq|en}/{about|services|projects|contact}`: the other four public pages.
- `/app`: dashboard.
- `/app/{clients|projects|payments|expenses|receipts|reports|categories|persons|vehicles|accounts}`: workspace sections.
- Unsupported locales and section slugs return 404.

App Router route groups separate entry, website and workspace layouts. Separate root layouts provide the correct server-rendered HTML language (`sq`/`en` on the website, `en` in the workspace). Transitions between these root layouts can perform a full document navigation, as intended by Next.js. Pages and layouts are server components. Only navigation and language switching use client components.

The typed dictionaries in `src/i18n/dictionaries.ts` drive both languages through shared page components. The language switcher preserves the current page. URLs use the same section slugs in both languages.

Routing composes feature screens; shared components do not import feature business logic. There is no domain or persistence layer yet. Add server-side business logic within feature modules in the authorized future package, rather than creating unused infrastructure now.

## Files

| Path | Purpose |
| --- | --- |
| `package.json`, `package-lock.json` | Scripts, exact direct dependency versions and reproducible npm resolution |
| `.gitignore` | Exclude builds, dependencies, local artifacts and secrets |
| `AGENTS.md` | Next.js-generated instructions pointing future agents to the installed framework documentation |
| `tsconfig.json` | Strict TypeScript and `@/*` alias |
| `next.config.ts` | Framework configuration and explicit workspace build root |
| `eslint.config.mjs` | Next.js Core Web Vitals and TypeScript lint rules |
| `postcss.config.mjs` | Tailwind CSS PostCSS integration |
| `src/app/(entry)/layout.tsx` | Root redirect document layout |
| `src/app/(entry)/page.tsx` | Albanian default redirect |
| `src/app/(website)/[locale]/layout.tsx` | Localized document, metadata, header and footer |
| `src/app/(website)/[locale]/page.tsx` | Localized home route |
| `src/app/(website)/[locale]/[page]/page.tsx` | Validated localized public section routes and metadata |
| `src/app/(workspace)/app/layout.tsx` | Workspace document, shell and preview metadata |
| `src/app/(workspace)/app/page.tsx` | Dashboard route |
| `src/app/(workspace)/app/[section]/page.tsx` | Validated workspace section routes and metadata |
| `src/components/ui/index.tsx` | Button, input, form field, card, badge, heading, empty state and scrolling table shell |
| `src/components/layout/navigation.tsx` | Active links, desktop navigation and accessible mobile disclosure |
| `src/components/layout/workspace-shell.tsx` | Sidebar, mobile header, preview notice and main landmark |
| `src/components/public/public-shell.tsx` | Public header, navigation and footer |
| `src/components/public/language-switcher.tsx` | Page-preserving language links |
| `src/features/dashboard/dashboard-screen.tsx` | Empty dashboard with workspace links |
| `src/features/workspace/sections.ts` | Typed screen definitions, descriptions and navigation |
| `src/features/workspace/section-screen.tsx` | Reusable workspace screen composition |
| `src/features/website/public-screen.tsx` | Shared, localized page composition and disabled contact preview |
| `src/i18n/dictionaries.ts` | Typed Albanian/English copy and public route definitions |
| `src/lib/utils.ts` | Class-name helper |
| `src/types/navigation.ts` | Shared navigation contract |
| `src/styles/tokens.css` | Provisional neutral design tokens |
| `src/styles/globals.css` | Tailwind import, component styles and responsive layout |
| `scripts/check-routes.mjs` | HTTP integration smoke check |
| `README.md` | Setup, architecture, scope and limitations |

`next-env.d.ts`, `.next/` and TypeScript incremental files are generated locally and excluded from Git.

## UI and content status

The only supplied specification was the WP-01 implementation prompt. The repository was empty. No Master Project Prompt v1.1, UX Structure v1.0, UX Review & Decision Handoff v1.1, UX Wireframes v2.1 corrections, Phase 3 Visual Direction + UI Kit Foundation, UI Kit Board, UI Showcase or UI Design System was available. There were no approved logos, photos, fonts, brand tokens or final company copy.

The provisional foundation follows the stated Operational Clarity direction: neutral surfaces, restrained borders, clear navigation, visible focus indicators, consistent headings and readable table scaffolds. Tokens are centralized for later alignment. System fonts avoid external font downloads. The text wordmark “Construction” is explicitly a working title, not an approved company identity. The schematic illustration is CSS artwork clearly labeled as not depicting a real project. Exact approved visual alignment remains pending source verification.

Desktop workspace navigation uses a sidebar. Mobile navigation uses a native button with `aria-expanded` and `aria-controls`, normal keyboard-operable links, Escape to close and return focus, outside-click dismissal and reset on route changes. It is a nonmodal disclosure, so page focus is not trapped. Tables use a labeled, focusable horizontal scrolling region. Reduced-motion preferences are respected.

## Scope and security

- No authentication, authorization, database, ORM, migrations or business persistence.
- No real client information, financial values or simulated production records.
- No working save, payment confirmation, delete, receipt or export actions.
- Contact controls are disabled, labeled as unavailable and have no submission service.
- Company content, project descriptions, contact information and photos await approval.
- Income refers to received payments; expenses refer to outgoing payments; currency is EUR.
- Project statuses are Active, Suspended and Completed. Contract phases describe financial structure, not physical progress.
- Future reporting is company-level PDF/Excel export and on-screen project summaries. Individual project export is out of scope.
- No production deployment, production credentials, external API integrations or infrastructure changes.

## Toolchain compatibility

Exact direct versions are recorded in `package.json` and `package-lock.json`. Registry checks found newer ESLint 10 and TypeScript 7 releases, but the installed Next.js lint plugins require ESLint 9 and TypeScript <6.1. The project therefore pins the latest matching releases resolved by npm: ESLint 9.39.5 and TypeScript 6.0.3. npm marks ESLint 9 as unsupported; updating it requires a compatible Next.js plugin toolchain. No peer dependency overrides or disabled checks are used.

Setup follows the official [Next.js installation guidance](https://nextjs.org/docs/app/getting-started/installation), [Next.js ESLint configuration](https://nextjs.org/docs/app/api-reference/config/eslint) and [Tailwind Next.js guide](https://tailwindcss.com/docs/installation/framework-guides/nextjs).

## Next package

WP-02: Database Schema & Migrations can begin after confirming the approved data-model specification, database engine and local development connection requirements. This UI foundation is ready for that work; it does not imply that a schema or authentication design has been approved. WP-02 is not implemented here.

## WP-01 verification record — 26 October 2026

| Exact command | Result |
| --- | --- |
| `npm.cmd ci` | PASS: 441 packages installed; 0 vulnerabilities reported |
| `npm.cmd ls --depth=0` | PASS: clean dependency tree with exact direct versions |
| `npm.cmd run typecheck` | PASS: route types generated; strict TypeScript exited 0 |
| `npm.cmd run lint` | PASS: no errors or warnings |
| `npm.cmd run build` | PASS: optimized build; 24 generated pages including redirect and framework 404 |
| `npm.cmd run dev` | PASS: ready on loopback port 3000 |
| `npm.cmd run check:routes` | PASS: 21 content routes, root redirect, 3 invalid URLs and disabled contact previews |
| `npm.cmd run start -- --port 3001` | PASS: local production server ready |
| `npm.cmd run check:routes -- http://127.0.0.1:3001` | PASS: same HTTP checks against the production build |

Both owned local servers were stopped after verification. No production deployment occurred. Server responses were successful, and no application exceptions were observed. The development server emitted one `MaxListenersExceededWarning` while serving deliberately invalid routes; this was not observed when running the same checks against the production server. This remains a development-runtime warning; its cause has not been conclusively established. The application does not register Node server response listeners.

Browser setup returned “No browser is available” and discovery returned an empty list. Visual appearance, actual desktop/mobile menu interaction, keyboard behavior and client hydration remain **NOT VERIFIED**. HTTP integration checks are not a substitute for browser verification.

All WP01 acceptance criteria have implementation/command evidence except **WP01-AC07**, which remains **NOT VERIFIED** until desktop and mobile navigation are tested in a browser. **WP01-AC14** is satisfied by reporting unavailable sources and keeping provisional design choices explicit; exact visual alignment is not claimed. No known application defect was found by the executed checks.
