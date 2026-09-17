import { afterEach, describe, expect, it } from 'vitest';
import { buildServer } from '../src/server.js';

function payload(prohibitedPracticeSignals: string[] = []) {
  return {
    releaseId: '2026.09.17',
    sourceCommit: 'abcdef1234567',
    systems: [
      {
        system: {
          id: 'assistant',
          name: 'Governed Assistant',
          owner: 'AI Platform',
          businessUnit: 'Platform',
          purpose: 'Provides governed assistance to authenticated enterprise users.',
          users: ['enterprise users'],
          affectedGroups: [],
          modelProviders: ['approved-provider'],
          dataCategories: ['operational metadata'],
          personalData: false,
          specialCategoryData: false,
          automatedDecisions: false,
          humanOversight: true,
          publicFacing: true,
          safetyCritical: false,
          employmentOrEducationUse: false,
          biometricUse: false,
          lawEnforcementUse: false,
          criticalInfrastructureUse: false,
          documentation: ['docs/assistant.md'],
          evidence: { 'ai-user-notice': 'docs/ai-notice.md' }
        },
        componentType: 'application',
        deploymentState: 'staging',
        version: '1.0.0',
        sourceRef: 'platform-registry:assistant',
        controls: [],
        evaluations: [],
        regulatoryProfile: {
          eu: {
            roles: ['deployer'],
            prohibitedPracticeSignals,
            highRiskAreas: [],
            transparencySignals: ['human_interaction'],
            gpaiModel: false,
            gpaiSystemicRisk: false
          },
          uk: {
            inScope: true,
            sectorRegulators: []
          }
        }
      }
    ]
  };
}

let app: ReturnType<typeof buildServer> | undefined;

afterEach(async () => {
  if (app) {
    await app.close();
    app = undefined;
  }
});

describe('release governance applicability API', () => {
  it('returns a review gate and structured EU/UK applicability evidence', async () => {
    app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/governance/release-applicability',
      payload: payload()
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.snapshot.schema).toBe('raeburnai.release-governance-applicability.v1');
    expect(body.snapshot.gate).toBe('review');
    expect(body.snapshot.systems[0].eu.categories).toContain('transparency_obligations');
    expect(body.snapshot.systems[0].uk.principles).toHaveLength(5);
    expect(body.snapshot.legalDisclaimer).toContain('not a legal determination');
  });

  it('blocks a release snapshot containing a potentially prohibited practice signal', async () => {
    app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/governance/release-applicability',
      payload: payload(['social_scoring'])
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.snapshot.gate).toBe('block');
    expect(body.snapshot.blockedSystemIds).toEqual(['assistant']);
    expect(body.snapshot.systems[0].eu.requiredEvidence).toContain(
      'prohibited-practice-legal-assessment'
    );
  });

  it('returns HTTP 400 for an empty release inventory', async () => {
    app = buildServer();
    const response = await app.inject({
      method: 'POST',
      url: '/v1/governance/release-applicability',
      payload: { releaseId: '2026.09.17', systems: [] }
    });

    expect(response.statusCode).toBe(400);
  });
});
