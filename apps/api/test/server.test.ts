import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

const completeInventory = {
  releaseId: '2026.09.17',
  sourceCommit: 'abcdef1234567',
  systems: [
    {
      system: {
        id: 'router',
        name: 'Governed Router',
        owner: 'AI Platform',
        businessUnit: 'Platform',
        purpose: 'Routes governed model requests to approved execution targets.',
        users: ['platform operators'],
        affectedGroups: [],
        modelProviders: [],
        dataCategories: ['operational metadata'],
        personalData: false,
        specialCategoryData: false,
        automatedDecisions: false,
        humanOversight: true,
        publicFacing: false,
        safetyCritical: false,
        employmentOrEducationUse: false,
        biometricUse: false,
        lawEnforcementUse: false,
        criticalInfrastructureUse: false,
        documentation: ['docs/router.md'],
        evidence: { architecture: 'docs/router.md' }
      },
      componentType: 'router',
      deploymentState: 'staging',
      repository: 'https://github.com/Raebu/RaeburnAI-Router',
      version: '1.0.0',
      sourceRef: 'platform-registry:router',
      controls: [
        {
          controlId: 'tenant-policy',
          evidenceRef: 'tests/tenant-policy.test.ts',
          status: 'implemented'
        }
      ],
      evaluations: [
        {
          evaluationId: 'routing-baseline',
          evidenceRef: 'evals/routing-baseline.json',
          status: 'passed'
        }
      ]
    }
  ]
};

let app: ReturnType<typeof buildServer> | undefined;
const temporaryDirectories: string[] = [];

async function createEvidenceDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), 'raeburn-compliance-evidence-'));
  temporaryDirectories.push(directory);
  return directory;
}

function trustedInventory(overrides: Record<string, unknown> = {}) {
  return {
    releaseId: 'v1.2.3',
    capturedAt: '2026-09-19T20:00:00.000Z',
    provenance: {
      repository: 'https://github.com/Raebu/RaeburnAI-Chain',
      commit: 'a'.repeat(40),
      ref: 'refs/tags/v1.2.3',
      producer: 'raeburnai-chain',
      environment: 'staging'
    },
    systems: completeInventory.systems,
    ...overrides
  };
}

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
  while (temporaryDirectories.length > 0) {
    const directory = temporaryDirectories.pop();
    if (directory) await rm(directory, { recursive: true, force: true });
  }
});

describe('release inventory API', () => {
  it('returns a governed release snapshot for valid inventory', async () => {
    app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/inventory/release-snapshot',
      payload: completeInventory
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.snapshot.schema).toBe('raeburnai.release-ai-inventory.v1');
    expect(body.snapshot.releaseId).toBe('2026.09.17');
    expect(body.snapshot.totalSystems).toBe(1);
    expect(body.snapshot.inventoryComplete).toBe(true);
    expect(body.snapshot.systems[0].entry.system.id).toBe('router');
  });

  it('returns a client validation error instead of a server error', async () => {
    app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/inventory/release-snapshot',
      payload: { releaseId: '2026.09.17', systems: [] }
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain('Array must contain at least 1 element');
  });
});

describe('trusted release inventory evidence API', () => {
  it('requires an authenticated registry producer', async () => {
    const evidenceDirectory = await createEvidenceDirectory();
    app = buildServer({
      evidenceDirectory,
      inventoryRegistryToken: 'registry-test-token'
    });

    const response = await app.inject({
      method: 'POST',
      url: '/v1/inventory/evidence',
      payload: trustedInventory()
    });

    expect(response.statusCode).toBe(401);
    expect(response.json().error).toBe('inventory_registry_auth_failed');
  });

  it('persists immutable evidence and treats an identical retry as idempotent', async () => {
    const evidenceDirectory = await createEvidenceDirectory();
    app = buildServer({
      evidenceDirectory,
      inventoryRegistryToken: 'registry-test-token'
    });

    const first = await app.inject({
      method: 'POST',
      url: '/v1/inventory/evidence',
      headers: { authorization: 'Bearer registry-test-token' },
      payload: trustedInventory()
    });
    expect(first.statusCode).toBe(201);
    expect(first.json().created).toBe(true);
    expect(first.json().evidence.contentSha256).toMatch(/^[0-9a-f]{64}$/);

    const retry = await app.inject({
      method: 'POST',
      url: '/v1/inventory/evidence',
      headers: { authorization: 'Bearer registry-test-token' },
      payload: trustedInventory()
    });
    expect(retry.statusCode).toBe(200);
    expect(retry.json().created).toBe(false);
    expect(retry.json().evidence.contentSha256).toBe(first.json().evidence.contentSha256);
  });

  it('survives a server restart and returns hash-verified release evidence', async () => {
    const evidenceDirectory = await createEvidenceDirectory();
    app = buildServer({
      evidenceDirectory,
      inventoryRegistryToken: 'registry-test-token'
    });

    const created = await app.inject({
      method: 'POST',
      url: '/v1/inventory/evidence',
      headers: { authorization: 'Bearer registry-test-token' },
      payload: trustedInventory()
    });
    expect(created.statusCode).toBe(201);
    const hash = created.json().evidence.contentSha256;

    await app.close();
    app = buildServer({
      evidenceDirectory,
      inventoryRegistryToken: 'registry-test-token'
    });

    const fetched = await app.inject({
      method: 'GET',
      url: '/v1/inventory/evidence/v1.2.3',
      headers: { authorization: 'Bearer registry-test-token' }
    });
    expect(fetched.statusCode).toBe(200);
    expect(fetched.json().evidence.contentSha256).toBe(hash);
    expect(fetched.json().evidence.snapshot.sourceCommit).toBe('a'.repeat(40));
  });

  it('rejects conflicting evidence for an existing immutable release ID', async () => {
    const evidenceDirectory = await createEvidenceDirectory();
    app = buildServer({
      evidenceDirectory,
      inventoryRegistryToken: 'registry-test-token'
    });

    const first = await app.inject({
      method: 'POST',
      url: '/v1/inventory/evidence',
      headers: { authorization: 'Bearer registry-test-token' },
      payload: trustedInventory()
    });
    expect(first.statusCode).toBe(201);

    const conflict = await app.inject({
      method: 'POST',
      url: '/v1/inventory/evidence',
      headers: { authorization: 'Bearer registry-test-token' },
      payload: trustedInventory({
        provenance: {
          ...trustedInventory().provenance,
          commit: 'b'.repeat(40)
        }
      })
    });
    expect(conflict.statusCode).toBe(409);
    expect(conflict.json().error).toBe('immutable_inventory_evidence_conflict:v1.2.3');
  });

  it('surfaces stale and incomplete inventory evidence as operational exceptions', async () => {
    const evidenceDirectory = await createEvidenceDirectory();
    app = buildServer({
      evidenceDirectory,
      inventoryRegistryToken: 'registry-test-token',
      inventoryMaxAgeSeconds: 3600,
      now: () => new Date('2026-09-20T00:00:00.000Z')
    });

    const incompleteSystem = {
      ...completeInventory.systems[0],
      version: undefined,
      controls: [],
      evaluations: [],
      system: {
        ...completeInventory.systems[0]?.system,
        documentation: []
      }
    };

    const created = await app.inject({
      method: 'POST',
      url: '/v1/inventory/evidence',
      headers: { authorization: 'Bearer registry-test-token' },
      payload: trustedInventory({ systems: [incompleteSystem] })
    });
    expect(created.statusCode).toBe(201);

    const exceptions = await app.inject({
      method: 'GET',
      url: '/v1/inventory/exceptions',
      headers: { authorization: 'Bearer registry-test-token' }
    });
    expect(exceptions.statusCode).toBe(200);
    expect(exceptions.json().maxAgeSeconds).toBe(3600);
    expect(exceptions.json().exceptions.map((item: { type: string }) => item.type)).toEqual([
      'incomplete_inventory',
      'stale_inventory'
    ]);
    expect(exceptions.json().exceptions[0].systemIds).toEqual(['router']);
  });
});

