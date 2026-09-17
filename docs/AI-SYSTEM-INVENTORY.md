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

## Production integration still required

RAI-115 is not complete until the current Chain/module/model registry actually supplies these records for a real release and the resulting snapshot is retained as release evidence. Production work should also authenticate the registry producer, bind snapshots to immutable release provenance, persist them in the evidence store and define ownership for stale or incomplete inventory entries.
