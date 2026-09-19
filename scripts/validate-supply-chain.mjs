import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const workflowDir = path.join(root, '.github', 'workflows');
const sha40 = /^[0-9a-f]{40}$/i;
const usesPattern = /^\s*-?\s*uses:\s*([^\s#]+)(?:\s+#.*)?$/gm;
const failures = [];

function read(relativePath) {
  const fullPath = path.join(root, relativePath);
  if (!fs.existsSync(fullPath)) {
    failures.push(`${relativePath} is required`);
    return '';
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function requireMarker(source, relativePath, description, marker) {
  if (!source.includes(marker)) {
    failures.push(`${relativePath} is missing ${description}: ${marker}`);
  }
}

const workflowFiles = fs
  .readdirSync(workflowDir)
  .filter(file => file.endsWith('.yml') || file.endsWith('.yaml'))
  .sort();

const workflowSources = new Map();

for (const workflowFile of workflowFiles) {
  const relativePath = `.github/workflows/${workflowFile}`;
  const source = read(relativePath);
  workflowSources.set(relativePath, source);
  usesPattern.lastIndex = 0;
  for (const match of source.matchAll(usesPattern)) {
    const reference = match[1];
    if (reference.startsWith('./') || reference.startsWith('docker://')) continue;
    const separator = reference.lastIndexOf('@');
    const action = separator >= 0 ? reference.slice(0, separator) : '';
    const ref = separator >= 0 ? reference.slice(separator + 1) : '';
    if (!action || !sha40.test(ref)) {
      failures.push(`${relativePath} must pin third-party action to a 40-character commit SHA: ${reference}`);
    }
  }
}

read('pnpm-lock.yaml');
const policy = read('docs/software-supply-chain.md');
requireMarker(policy, 'docs/software-supply-chain.md', 'Critical remediation expectation', '**Critical:**');
requireMarker(policy, 'docs/software-supply-chain.md', 'High remediation expectation', '**High:**');
requireMarker(policy, 'docs/software-supply-chain.md', 'real-release evidence boundary', 'Real release evidence');

const ci = read('.github/workflows/ci.yml');
requireMarker(ci, '.github/workflows/ci.yml', 'frozen dependency installation', 'pnpm install --frozen-lockfile');
requireMarker(ci, '.github/workflows/ci.yml', 'supply-chain policy validation', 'validate-supply-chain.mjs');
requireMarker(ci, '.github/workflows/ci.yml', 'High/Critical dependency audit', 'pnpm audit --audit-level high');
requireMarker(ci, '.github/workflows/ci.yml', 'High/Critical container scan', 'aquasecurity/trivy-action@');
requireMarker(ci, '.github/workflows/ci.yml', 'CodeQL analysis', 'github/codeql-action/init@');
requireMarker(ci, '.github/workflows/ci.yml', 'runtime health smoke test', 'http://127.0.0.1:4000/health');

const dockerfile = read('Dockerfile');
requireMarker(dockerfile, 'Dockerfile', 'immutable base-image digest', '@sha256:');
requireMarker(dockerfile, 'Dockerfile', 'frozen dependency installation', 'pnpm install --frozen-lockfile');
requireMarker(dockerfile, 'Dockerfile', 'production API deployment', 'deploy --prod /prod/api');
requireMarker(dockerfile, 'Dockerfile', 'direct Node runtime entrypoint', 'CMD ["node", "dist/server.js"]');
if (dockerfile.includes('--frozen-lockfile=false')) {
  failures.push('Dockerfile must not disable frozen-lockfile enforcement');
}
if (dockerfile.includes('CMD ["pnpm"')) {
  failures.push('Dockerfile runtime must not require pnpm');
}

for (const legacyWorkflow of [
  '.github/workflows/release-signing.yml',
  '.github/workflows/provenance.yml'
]) {
  if (fs.existsSync(path.join(root, legacyWorkflow))) {
    failures.push(`${legacyWorkflow} must be removed; release assets require one canonical owner`);
  }
}

const releaseTrustPath = '.github/workflows/release-trust.yml';
const releaseTrust = read(releaseTrustPath);
requireMarker(releaseTrust, releaseTrustPath, 'published release trigger', 'types: [published]');
requireMarker(releaseTrust, releaseTrustPath, 'reusable workflow entrypoint', 'workflow_call:');
requireMarker(releaseTrust, releaseTrustPath, 'exact-tag checkout', 'ref: ${{ env.RELEASE_TAG }}');
requireMarker(releaseTrust, releaseTrustPath, 'deterministic git archive', 'git archive --format=tar');
requireMarker(releaseTrust, releaseTrustPath, 'deterministic gzip metadata', 'gzip -n');
requireMarker(releaseTrust, releaseTrustPath, 'SPDX SBOM', 'spdx-json');
requireMarker(releaseTrust, releaseTrustPath, 'CycloneDX SBOM', 'cyclonedx-json');
requireMarker(releaseTrust, releaseTrustPath, 'release checksums', 'SHA256SUMS');
requireMarker(releaseTrust, releaseTrustPath, 'keyless Sigstore signing', 'cosign sign-blob');
requireMarker(releaseTrust, releaseTrustPath, 'Sigstore verification', 'cosign verify-blob');
requireMarker(releaseTrust, releaseTrustPath, 'GitHub provenance/SBOM attestation', 'actions/attest@');
requireMarker(releaseTrust, releaseTrustPath, 'GitHub attestation verification', 'gh attestation verify');
requireMarker(releaseTrust, releaseTrustPath, 'single release upload', 'gh release upload');

const releaseAssetOwners = [];
for (const [relativePath, source] of workflowSources.entries()) {
  const uploadsWithGh = source.includes('gh release upload');
  const uploadsWithSbomAction = /upload-release-assets:\s*true/.test(source);
  if (uploadsWithGh || uploadsWithSbomAction) releaseAssetOwners.push(relativePath);
}
if (
  releaseAssetOwners.length !== 1 ||
  releaseAssetOwners[0] !== releaseTrustPath
) {
  failures.push(
    `release assets must have exactly one canonical workflow owner (${releaseTrustPath}); found: ${releaseAssetOwners.join(', ') || 'none'}`
  );
}

const sbom = read('.github/workflows/sbom.yml');
requireMarker(sbom, '.github/workflows/sbom.yml', 'repository SPDX SBOM generation', 'spdx-json');
requireMarker(sbom, '.github/workflows/sbom.yml', 'repository CycloneDX SBOM generation', 'cyclonedx-json');
requireMarker(sbom, '.github/workflows/sbom.yml', 'release upload disabled', 'upload-release-assets: false');
if (/\brelease:\s*\n\s*types:\s*\[published\]/.test(sbom)) {
  failures.push('.github/workflows/sbom.yml must not own release-event packaging');
}

if (failures.length > 0) {
  console.error('Software supply-chain policy validation failed:');
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Software supply-chain policy validated: ${workflowFiles.length} workflows use immutable action refs; ` +
    'tracked lockfile, dependency/image gates, runtime smoke test and a single-owner verified release trust package are present.'
);
