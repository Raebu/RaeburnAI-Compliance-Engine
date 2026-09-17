# Release regulatory applicability screening

Status basis: 17 September 2026.

RaeburnAI Compliance Engine can screen a release inventory for EU AI Act and UK AI governance applicability using `POST /v1/governance/release-applicability` or `buildReleaseGovernanceApplicabilitySnapshot()`.

This is a governance control, not an automated legal opinion. A `block` or `review` result intentionally requires qualified legal, compliance and (where relevant) sector-regulator review before the release record is treated as cleared.

## EU AI Act screening

The screening contract records the system's EU role, explicit prohibited-practice signals, high-risk-area signals, transparency signals and GPAI-provider/model status.

The engine also derives conservative high-risk screening signals from the existing AI-system inventory flags for biometrics, critical infrastructure, employment/education, law enforcement and safety-critical/product contexts. A public-facing system creates a human-interaction transparency screening signal.

Release gates are:

- `block` — at least one potentially prohibited-practice signal is present. Deployment must not be treated as approved until the signal is resolved by qualified review.
- `review` — the EU profile is incomplete, or the system has potential high-risk, GPAI-provider or transparency obligations.
- `pass` — a complete EU profile contains none of those signals. This is still not a legal compliance certificate.

Evidence requests are generated from the screening result. High-risk candidates request risk management, data governance, technical documentation, logging/traceability, human oversight, robustness/cybersecurity and conformity-readiness evidence. GPAI-provider candidates request technical documentation, downstream information and copyright-policy evidence, plus systemic-risk evidence when flagged. Transparency candidates request AI notice/content-labelling assessment evidence.

### Current EU timing captured for the 2026 release baseline

Official European Commission material states that:

- prohibited-practice provisions have applied since February 2025;
- GPAI provider obligations have applied since August 2025, with Commission enforcement from August 2026;
- Article 50 transparency obligations apply from August 2026;
- the current high-risk timetable places Annex III sensitive-area rules from 2 December 2027 and regulated-product high-risk rules from 2 August 2028.

The code deliberately does **not** hard-code those dates into a legal decision. Timelines and Commission guidance can change, so the snapshot records applicability signals and evidence gates while legal interpretation remains outside the engine.

Official sources:

- https://digital-strategy.ec.europa.eu/en/policies/regulatory-framework-ai
- https://digital-strategy.ec.europa.eu/en/policies/enforcement-ai-act
- https://digital-strategy.ec.europa.eu/en/policies/guidelines-ai-high-risk-systems
- https://digital-strategy.ec.europa.eu/en/library/guidelines-transparency-obligations-providers-and-deployers-ai-systems
- https://digital-strategy.ec.europa.eu/en/faqs/guidelines-obligations-general-purpose-ai-providers

## UK AI governance screening

The UK profile records whether the system is in scope for the organisation's UK governance review and any known sector regulators. For in-scope systems the snapshot carries the five cross-sector principles used by the UK government's regulator-led framework:

1. safety, security and robustness;
2. appropriate transparency and explainability;
3. fairness;
4. accountability and governance;
5. contestability and redress.

An omitted UK profile fails visibly to `review`. An in-scope system with named sector regulators also remains `review`, because the Compliance Engine must not invent sector-specific legal obligations from a generic platform inventory.

Official sources:

- https://www.gov.uk/government/publications/ai-regulation-a-pro-innovation-approach/white-paper
- https://www.gov.uk/government/publications/implementing-the-uks-ai-regulatory-principles-initial-guidance-for-regulators

## Example profile

```json
{
  "regulatoryProfile": {
    "eu": {
      "roles": ["deployer"],
      "prohibitedPracticeSignals": [],
      "highRiskAreas": ["education_or_employment"],
      "transparencySignals": ["human_interaction"],
      "gpaiModel": false,
      "gpaiSystemicRisk": false
    },
    "uk": {
      "inScope": true,
      "sectorRegulators": []
    }
  }
}
```

## Release evidence rule

A release record should retain both the ordinary AI-system inventory snapshot and the regulatory-applicability snapshot. Any `block`, `review`, missing profile or required evidence item must remain visible to release governance; automation must not silently convert it into an approval.

The first production-grade integration still requires a trusted live registry producer, immutable release provenance, persisted evidence snapshots and an exception workflow for stale/incomplete records.
