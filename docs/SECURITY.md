# Security

## Security model

RaeburnAI Compliance Engine is designed for sensitive governance and evidence data.

## Required production controls

- Enforce SSO and MFA through the deployment identity provider.
- Use short-lived sessions and secure cookies.
- Encrypt secrets with a managed key service.
- Encrypt database volumes and object storage.
- Apply role-based access control for governance, legal, security and auditor roles.
- Log all evidence, assessment and rule-pack changes.
- Keep immutable audit logs for regulated deployments.
- Run dependency scanning and container scanning in CI.
- Back up Postgres daily and test restore quarterly.

## Data classification

Compliance evidence may contain confidential, personal or commercially sensitive material. Store only the minimum evidence needed and apply retention policies.

## Responsible disclosure

Please report security issues privately to the maintainers. Do not open public issues for exploitable vulnerabilities.
