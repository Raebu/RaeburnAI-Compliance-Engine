# Architecture

RaeburnAI Compliance Engine is structured as a production monorepo.

## Components

- **Web dashboard**: executive AI governance, framework coverage, risk posture, evidence gaps and remediation.
- **API service**: Fastify HTTP API exposing rules, assessments and OpenAPI metadata.
- **Core package**: domain models, validation, policy-as-code rule engine, risk classification and scoring.
- **Rules package**: versioned compliance mappings for EU AI Act, GDPR, ISO 42001, ISO 27001 and UK AI guidance.
- **SDK package**: client library for future CRM, GRC, ticketing and model registry integrations.

## Data model

Primary entities:

- AI system
- Assessment
- Rule result
- Framework control
- Evidence artefact
- Risk owner
- Remediation task
- Audit event

## Production design principles

- Evidence-first compliance: every failed control maps to required evidence.
- Framework-neutral controls: one system record can satisfy multiple standards.
- Policy-as-code: checks are versioned, testable and reviewable.
- Human accountability: compliance status must have owner, evidence and decision trail.
- Open-source extensibility: rule packs can be added without rewriting the app.

## Future-ready integrations

- Jira/GitHub issue creation for remediation tasks
- Slack/Teams reminders for control owners
- Google Drive/SharePoint evidence vault ingestion
- CRM/model registry ingestion
- SIEM and audit export
- DPO/CISO review workflows
