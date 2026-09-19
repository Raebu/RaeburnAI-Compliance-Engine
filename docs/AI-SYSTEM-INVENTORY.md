# Release AI system inventory

The Compliance Engine can now turn an upstream platform/module/model registry into a release-scoped governance snapshot.

## Boundary

`POST /v1/inventory/release-snapshot` accepts a release identifier, optional source commit and one or more typed inventory entries. The Compliance Engine does **not** discover repositories, deployed services or model providers by itself. Chain, deployment automation or another trusted registry producer must supply the current inventory.

This separation is deliberate: the Compliance Engine validates and assesses supplied inventory evidence; it must not invent live deployment facts.

## Required inventory dimensions

Each entry contains:

- the existing `AISystem` record: stable ID, name, owner, business unit, purpose, users/affected groups, provider/data categories and risk-relevant use flags;
- component type, such as model, router, agent, tool gateway, knowledge system or governance service;
- deployment state: planned, development, staging, production, suspended or retired;
- a source reference identifying the registry evidence used to create the record;
- optional repository and version;
- control evidence references and their implementation state;
- evaluation evidence references and their result state.

A release inventory is marked `inventoryComplete: false` when an entry lacks documentation, controls, evaluations or version evidence. This is an evidence-completeness signal only; it is not a legal conclusion or regulatory approval decision.

## Snapshot output

The output is sorted by system ID and includes:

- an assessment for every system using the same Compliance Engine rules as the assessment API;
- risk-level counts and highest observed risk classification;
- deployment-state counts;
- incomplete system IDs and per-system missing-evidence reasons;
- a release-level evidence-completeness flag.

Duplicate AI system IDs are rejected so one release cannot silently contain conflicting records for the same governed system.

## Example request

```json
{
  "releaseId": "2026.09.17",
  "sourceCommit": "abcdef1234567",
  "systems": [
    {
      "system": {
        "id": "router",
        "name": "Example Router",
        "owner": "AI Platform",
        "businessUnit": "Platform",
        "purpose": "Routes governed model requests to approved execution targets.",
        "documentation": ["docs/router.md"],
        "evidence": {"architecture": "docs/router.md"}
      },
      "componentType": "router",
      "deploymentState": "staging",
      "repository": "https://github.com/example/router",
      "version": "1.2.3",
      "sourceRef": "platform-registry:router",
      "controls": [
        {
          "controlId": "tenant-policy",
          "evidenceRef": "tests/tenant-policy.test.ts",
          "status": "implemented"
        }
      ],
      "evaluations": [
        {
          "evaluationId": "routing-baseline",
          "evidenceRef": "evals/routing-baseline.json",
          "status": "passed"
        }
      ]
    }
  ]
}
```

## Authenticated immutable evidence path

The pure `POST /v1/inventory/release-snapshot` contract remains available for assessment and preview use. Operational release evidence uses the stricter `POST /v1/inventory/evidence` path.

That endpoint requires `Authorization: Bearer <INVENTORY_REGISTRY_TOKEN>` and requires:

- a full 40-character Git commit rather than an abbreviated SHA;
- the source repository and exact ref;
- the producer identity and `staging` or `production` environment;
- an explicit capture timestamp;
- the same typed system inventory used by the snapshot engine.

The API canonicalises and SHA-256 hashes the evidence material before persistence. A retry with byte-equivalent governed evidence is idempotent. Reusing an existing release ID with different evidence fails with HTTP 409 instead of overwriting the prior record.

Evidence is stored under `COMPLIANCE_EVIDENCE_DIR` using an opaque SHA-256-derived filename, so release IDs cannot become filesystem paths. Reads verify the stored content hash before returning evidence. The default local path is suitable for development; production deployments must mount this directory on durable, backed-up storage.

Operational read endpoints are authenticated with the same registry token:

- `GET /v1/inventory/evidence` lists persisted release evidence;
- `GET /v1/inventory/evidence/:releaseId` retrieves one immutable record;
- `GET /v1/inventory/exceptions` reports incomplete snapshots and snapshots older than `INVENTORY_MAX_AGE_SECONDS`.

These exceptions are governance work items. Staleness or completeness does not itself determine legal compliance.

## Production integration still required

RAI-115 is not complete until the current Chain/module/model/tool registry actually submits a reviewed real release through the authenticated evidence path and the stored record is reconciled against the deployed estate. The new evidence store closes the authentication, immutable-provenance, persistence and stale/incomplete exception primitives in the Compliance Engine itself; remaining work is live producer wiring, durable production storage/backup operations, and the first verified release snapshot.
