# Software supply-chain policy

This repository treats build inputs, CI workflows, container images and release evidence as production security boundaries. These controls are operational engineering controls; they do not by themselves establish legal, regulatory or certification compliance.

## Dependency integrity

- `pnpm-lock.yaml` is committed and is the authoritative dependency resolution for CI and container builds.
- CI and Docker builds must use `pnpm install --frozen-lockfile`.
- `--frozen-lockfile=false` is not permitted in permanent build or release paths.
- The package manager is pinned to pnpm 9.12.3 for reproducible workspace resolution.
- High or Critical findings from `pnpm audit --audit-level high` block the main CI path. Findings must be remediated or covered by a separately documented, time-bounded security exception with an owner and expiry date.

## Workflow integrity

All third-party GitHub Actions must be referenced by a full 40-character commit SHA. Floating branch or version references such as `@main`, `@v4` or `@latest` are not permitted in committed workflows.

`scripts/validate-supply-chain.mjs` scans the complete workflow estate and also checks that the lockfile, dependency audit, container scan, release signing, SBOM and provenance controls remain present.

## Container integrity

- Production builds use an immutable Node base-image digest.
- Images are identified in CI by the exact Git commit SHA.
- Trivy blocks High and Critical vulnerabilities in the built image.
- The production runtime contains only the deployed API production package rather than the full source workspace.
- npm, Corepack, pnpm and Yarn frontends are removed from the final runtime image.
- The service runs as the non-root `node` user and starts directly with `node dist/server.js`.
- CI starts the built image and requires the `/health` endpoint to return a healthy response before the container job passes.

## Release trust evidence

The repository already maintains separate release-evidence workflows:

- `.github/workflows/release-signing.yml` creates release archives, SPDX and CycloneDX SBOMs, SHA-256 checksums and keyless Sigstore/Cosign signature bundles.
- `.github/workflows/provenance.yml` emits GitHub build provenance attestations.
- `.github/workflows/sbom.yml` generates repository SBOMs and release SBOM attestations.
- `.github/workflows/scorecard.yml` runs OpenSSF Scorecard analysis.

The presence of these workflows is machine-checked by `scripts/validate-supply-chain.mjs`. Their existence is not treated as proof that a specific release has been signed or attested; real release evidence must come from an executed release workflow for the exact release tag.

## Remediation expectations

- **Critical:** block release immediately and remediate as soon as practicable, normally within 24 hours. If remediation is impossible, a time-bounded exception must document the exposure, owner, compensating controls and expiry.
- **High:** block release and remediate normally within 7 days, or use the same governed exception process.
- **Medium/Low:** triage and schedule according to exploitability, reachability and business impact.

Security findings are not suppressed merely to make CI green. When a scanner reports vulnerable build-only tooling that is unnecessary in production, remove that tooling from the runtime rather than blanket-ignoring the finding.

## Local verification

From the repository root:

```bash
corepack enable
corepack prepare pnpm@9.12.3 --activate
pnpm install --frozen-lockfile
node scripts/validate-supply-chain.mjs
pnpm audit --audit-level high
pnpm check
docker build -t raeburnai-compliance-engine:local .
```

The GitHub Actions CI workflow remains the authoritative executable evidence because it also runs CodeQL, the exact-image High/Critical Trivy gate and the production `/health` smoke test.
