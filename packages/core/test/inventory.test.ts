import { describe, expect, it } from 'vitest';
import { buildReleaseInventorySnapshot } from '../src/index.js';

function entry(id: string, overrides: Record<string, unknown> = {}) {
  return {
    system: {
      id,
      name: `System ${id}`,
      owner: 'AI Platform',
      businessUnit: 'Platform',
      purpose: 'Provides a governed AI platform capability for enterprise workloads.',
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
      documentation: ['docs/architecture.md'],
      evidence: { architecture: 'docs/architecture.md' }
    },
    componentType: 'application',
    deploymentState: 'staging',
    repository: 'https://github.com/Raebu/example',
    version: '1.0.0',
    sourceRef: 'registry:example',
    controls: [
      { controlId: 'tenant-isolation', evidenceRef: 'tests/tenant.test.ts', status: 'implemented' }
    ],
    evaluations: [
      { evaluationId: 'baseline', evidenceRef: 'evals/baseline.json', status: 'passed' }
    ],
    ...overrides
  };
}

describe('release AI inventory', () => {
  it('builds a deterministic risk and deployment summary', () => {
    const snapshot = buildReleaseInventorySnapshot(
      {
        releaseId: '2026.09.17',
        sourceCommit: 'abcdef1234567',
        systems: [entry('router'), entry('chain')]
      },
      '2026-09-17T12:00:00.000Z'
    );

    expect(snapshot.schema).toBe('raeburnai.release-ai-inventory.v1');
    expect(snapshot.systems.map(item => item.entry.system.id)).toEqual(['chain', 'router']);
    expect(snapshot.totalSystems).toBe(2);
    expect(snapshot.deploymentCounts.staging).toBe(2);
    expect(snapshot.riskCounts.limited).toBe(2);
    expect(snapshot.inventoryComplete).toBe(true);
    expect(snapshot.incompleteSystemIds).toEqual([]);
  });

  it('carries the existing risk classification into the release snapshot', () => {
    const hiring = entry('hiring', {
      system: {
        ...entry('base').system,
        id: 'hiring',
        name: 'Hiring Assistant',
        purpose: 'Supports recruiter review of job applications with human oversight.',
        personalData: true,
        automatedDecisions: true,
        employmentOrEducationUse: true
      }
    });

    const snapshot = buildReleaseInventorySnapshot({ releaseId: 'r1', systems: [hiring] });
    expect(snapshot.highestRisk).toBe('high');
    expect(snapshot.riskCounts.high).toBe(1);
    expect(snapshot.systems[0]?.assessment.riskLevel).toBe('high');
  });

  it('flags missing release evidence without inventing compliance evidence', () => {
    const incomplete = entry('router', {
      version: undefined,
      controls: [],
      evaluations: [],
      system: { ...entry('base').system, id: 'router', documentation: [] }
    });

    const snapshot = buildReleaseInventorySnapshot({ releaseId: 'r1', systems: [incomplete] });
    expect(snapshot.inventoryComplete).toBe(false);
    expect(snapshot.incompleteSystemIds).toEqual(['router']);
    expect(snapshot.systems[0]?.missingEvidence).toEqual([
      'documentation',
      'controls',
      'evaluations',
      'version'
    ]);
  });

  it('rejects duplicate system identifiers', () => {
    expect(() =>
      buildReleaseInventorySnapshot({ releaseId: 'r1', systems: [entry('router'), entry('router')] })
    ).toThrow('duplicate_ai_system_id:router');
  });

  it('requires at least one registered AI system', () => {
    expect(() => buildReleaseInventorySnapshot({ releaseId: 'r1', systems: [] })).toThrow();
  });
});
