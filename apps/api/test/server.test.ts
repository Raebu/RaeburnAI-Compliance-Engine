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

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
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
