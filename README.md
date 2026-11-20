# Construction

Construction management software with an Albanian corporate website and an isolated, interactive demo.

## Features

- Clients, projects, contracts and financial phases.
- Payments, expenses, immutable receipt PDFs, Excel reports and complete business exports.
- Audited changes, exact EUR calculations and server-side authorization.
- Password + mandatory MFA, recovery codes and device passkeys.
- One-click demo with fictional data, a separate workspace per visitor and 30-minute sessions.

## Stack

Next.js 16 / React 19 / TypeScript / MySQL 8.4 LTS / Drizzle ORM.

## Local development

Requires Node.js 24, npm and Docker Desktop.

```sh
npm ci
npm run dev:setup
# Starts the local development database:
docker compose up -d
npm run dev
```

Open **http://localhost:3000**. Select **Provo Demo** on the website or login page to explore the management app. The isolated demo runs on port 3001 with its own MySQL on port 3308; initial preparation may take a minute or more.

Real workspace accounts are provisioned through the authorized operator CLI. There is no public registration. On PowerShell systems that block npm scripts, use `npm.cmd`.

## Verification

```sh
npm test
npm run test:demo
npm run lint
npm run typecheck
npm run build
```

With the demo running, `npm run test:demo:browser` verifies visitor isolation, documents, expiry and logout in Edge. See the [demo guide](docs/demo.md) for details.

## Security and deployment

Keep `.env*`, `.private/`, database credentials, MFA keys and private documents out of Git and public storage. Online demo and real data require separate origins, processes and storage. Configure `DEMO_ORIGIN` in the real application; never enable `DEMO_MODE` there.

Production hosting, HTTPS, private storage, verified backup/restore and remaining security release gates must be validated before publishing. The current database launcher is for local development, not a production deployment recipe.

[Local setup](docs/zhvillimi-lokal.md) | [Demo](docs/demo.md) | [Security and MFA](docs/WP-16-report.md)
