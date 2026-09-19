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

`scripts/validate-supply-chain.mjs` scans the complete workflow estate and checks that the lockfile, dependency audit, container scan and release trust controls remain present. It also enforces a single release-asset owner so independent workflows cannot race to overwrite archives, checksums, SBOMs or signatures.

## Container integrity

- Production builds use an immutable Node base-image digest.
- Images are identified in CI by the exact Git commit SHA.
- Trivy blocks High and Critical vulnerabilities in the built image.
- The production runtime contains only the deployed API production package rather than the full source workspace.
- npm, Corepack, pnpm and Yarn frontends are removed from the final runtime image.
- The service runs as the non-root `node` user and starts directly with `node dist/server.js`.
- CI starts the built image and requires the `/health` endpoint to return a healthy response before the container job passes.

## Release trust evidence

`.github/workflows/release-trust.yml` is the sole owner of release trust assets. It runs for published GitHub releases and can also be called as a reusable workflow for a controlled prerelease exercise.

For the exact release tag it:

1. checks out and verifies the tag resolves to the packaged commit;
2. creates one deterministic `git archive` source tarball with normalized gzip metadata;
3. creates SPDX and CycloneDX SBOMs;
4. hashes the archive and both SBOMs in one `SHA256SUMS` manifest;
5. creates keyless Sigstore bundles for the archive, checksum manifest and both SBOMs;
6. creates GitHub provenance plus SPDX and CycloneDX SBOM attestations against that same archive;
7. verifies the checksums, Sigstore bundles and GitHub attestation before publication; and
8. uploads the canonical archive and trust evidence in a single release-upload step.

`.github/workflows/sbom.yml` remains a repository SBOM workflow for main-branch dependency changes and manual inspection. It does not publish release assets.

The legacy independent `release-signing.yml` and `provenance.yml` workflows are intentionally removed because separately recreating and clobbering the same release archive can make signatures, checksums or attestations refer to different bytes.

The presence of release controls is not treated as proof for a particular version. **Real release evidence** requires an executed trust workflow for the exact tag plus inspection of its published assets and successful verification steps.

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

The GitHub Actions CI workflow remains the authoritative repository-level executable evidence because it also runs CodeQL, the exact-image High/Critical Trivy gate and the production `/health` smoke test. Release-level evidence additionally requires the exact-tag release trust workflow to execute and verify its canonical trust package.
