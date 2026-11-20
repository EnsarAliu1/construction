# Demo and public entry: focused pre-publication review

Date: 20 November 2026. Scope: local website → demo flow, demo configuration, session isolation, request limits, provisioning and cleanup. This is a focused engineering review, not an independent penetration test or production signoff.

## Findings addressed

| Finding | Change | Evidence |
| --- | --- | --- |
| Invalid optional demo origin could break real login | Strict origin validation is retained; the real login and public entry handle invalid/missing demo configuration safely. Production demo destinations must use a different hostname from the real app. | Security test covers invalid URLs, credentials, paths, self-origin and shared production hostname. |
| Concurrent requests could exceed the visitor request budget | MySQL reserves each request with one conditional UPDATE; requests at/above 1500 are denied. | Six concurrent HTTP requests with one remaining slot produce exactly one success and five denials; persisted count remains 1500. |
| One cleanup failure could block every later expired workspace | Cleanup isolates failures per registered workspace, emits a bounded signal without credentials and continues. Ownership checks precede removal. | Code review and successful normal expiry/cleanup integration. Corrupt-store fault injection has not been run. |
| Failed provisioning before seeding could occupy a slot for 30 minutes | The whole provisioning sequence now marks failed workspaces expired for guarded cleanup. | Code review; normal provisioning/cleanup passes. Process-crash fault injection remains outside this review. |
| Dynamic private filesystem paths could create broad development watcher dependencies | Private demo filesystem operations explicitly opt out of Turbopack asset tracing, matching the established receipt-store pattern. | Restarted demo remains usable alongside the temporary main app. Private paths remain excluded from build output tracing. |
| Hero CTA could lose an immediate click | Focus cancelled a translated entrance animation, moving the target about 28 px between pointer down and pointer up. Interactive header/hero controls now fade into place without positional movement. | Reproduced in Edge; after correction the same immediate mobile click reaches the demo dashboard. |

## Public entry

The website exposes **Provo Demo** in the header, hero, mobile menu and footer. `/demo` is a dynamic, no-store, noindex entry page. It uses only the operator-configured destination, without forwarding visitor redirect parameters. An unavailable configuration shows a safe explanatory page.

Demo links use full document navigation across application instances and do not prefetch demo startup. The destination starts a session only through the existing same-origin POST. Visiting the public website alone does not allocate a demo workspace.

## Local verification

- 103 existing tests passed; the demo configuration security test passed.
- 16 synthetic MySQL/HTTP/Edge checks passed, including cross-visitor denial, private PDF, Excel, forged tokens, real MFA-guard rejection, concurrent budget enforcement, logout, expiry and cleanup.
- Actual website CTA → demo dashboard passed in Edge. Website and login layouts fit the tested desktop/mobile widths; login fits without scrolling at 1440×900 and 390×844. Hydration-console checks passed.
- Lint, TypeScript and the final production build passed after the corrections.
- Current npm audit reported zero known vulnerabilities for both production-only and all dependencies. This does not prove the absence of application or deployment vulnerabilities.

## Gates that remain open

1. Real production configuration: the existing database/bootstrap guard is deliberately for disposable local databases. Do not turn a development flag into a production deployment procedure.
2. HTTPS, trusted proxy/origin handling and secure cookies must be verified on the selected host.
3. Demo and real data need separate deployment identities/containers and volumes. Separate local processes under one OS user do not protect against a compromised host/user.
4. Production cleanup/prewarming needs supervised scheduling, storage limits and monitoring. Public abuse can still exhaust the intentionally small demo capacity; reverse-proxy protections remain a hosting task.
5. Persistent private documents, separate key management, offsite backups and an actual restore must be verified for production. Existing independent-audit and owner-policy gates remain open.

No deployment, real-data migration, commit or push was performed by this review. The README was intentionally rewritten at the owner's request; private environment files were preserved.
