# RaeburnAI Compliance Engine

Open-source AI governance and compliance platform for GDPR, ISO/IEC 42001, ISO/IEC 27001, the EU AI Act, UK AI guidance and enterprise AI risk management.

## What it does

RaeburnAI Compliance Engine helps organisations register AI systems, classify risk, map obligations, collect evidence, run automated compliance checks and generate audit-ready remediation plans.

It is designed for consultants, SMEs, enterprise AI governance teams, DPOs, CISOs, legal teams and responsible AI leads.

## Core capabilities

- AI system inventory and model/application register
- EU AI Act risk classification workflow
- GDPR DPIA and lawful-basis checks
- ISO 42001 AI management-system control mapping
- ISO 27001 information-security control mapping
- UK AI governance principle assessment
- Evidence collection and audit trail
- Automated policy-as-code compliance checks
- Risk scoring and remediation roadmap
- Executive compliance dashboard
- Open API for integrations with GRC, ticketing, model registries and data catalogues
- Multi-tenant architecture, RBAC-ready, Postgres-backed
- Docker, CI, linting, tests and production deployment structure

## Architecture

```text
apps/web       Next.js executive dashboard
apps/api       Fastify API, compliance engine, OpenAPI docs
packages/core  Shared domain models, rule engine, scoring
packages/rules Versioned regulatory/control rule packs
packages/sdk   TypeScript SDK for integrations
infra          Docker, compose and deployment assets
docs           Governance, security, implementation and legal docs
```

## Quick start

```bash
pnpm install
cp .env.example .env
pnpm dev
```

API: `http://localhost:4000`

Web: `http://localhost:3000`

## Docker

```bash
docker compose up --build
```

## Example API usage

```bash
curl -X POST http://localhost:4000/v1/assessments/run \
  -H 'content-type: application/json' \
  -d @examples/high-risk-ai-system.json
```

## Compliance frameworks included

- EU AI Act: prohibited, high-risk, transparency, GPAI and governance checks
- GDPR: lawful basis, DPIA, data minimisation, retention, processor controls, DSAR readiness
- ISO/IEC 42001: AI management system governance, risk, lifecycle and monitoring controls
- ISO/IEC 27001: access control, supplier risk, incident, logging, asset and data security controls
- UK AI guidance: safety, transparency, fairness, accountability and contestability principles

## Production notes

This project ships as an excellent open-source foundation. Legal and compliance outputs are decision-support, not legal advice. Organisations should validate results with qualified legal, security and compliance professionals.

## Licence

Apache-2.0. See [LICENSE](LICENSE).
