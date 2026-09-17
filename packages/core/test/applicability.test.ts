import { describe, expect, it } from 'vitest';
import { buildReleaseGovernanceApplicabilitySnapshot } from '../src/applicability.js';

function entry(overrides: Record<string, unknown> = {}) {
  return {
    system: {
      id: 'system-a',
      name: 'System A',
      owner: 'AI Governance',
      businessUnit: 'Platform',
      purpose: 'Provides governed AI assistance for an approved business workflow.',
      users: ['staff'],
      affectedGroups: [],
      modelProviders: ['approved-provider'],
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
      documentation: ['docs/system-a.md'],
      evidence: { 'ai-policy': 'docs/ai-policy.md' }
    },
    componentType: 'application',
    deploymentState: 'staging',
    version: '1.0.0',
    sourceRef: 'platform-registry:system-a',
    controls: [],
    evaluations: [],
    regulatoryProfile: {
      eu: {
        roles: ['deployer'],
        prohibitedPracticeSignals: [],
        highRiskAreas: [],
        transparencySignals: [],
        gpaiModel: false,
        gpaiSystemicRisk: false
      },
      uk: {
        inScope: false,
        sectorRegulators: []
      }
    },
    ...overrides
  };
}

function request(systemEntries: unknown[]) {
  return {
    releaseId: 'release-2026-09-17',
    sourceCommit: 'abcdef1234567',
    systems: systemEntries
  };
}

describe('release governance applicability', () => {
  it('passes a fully profiled general-risk system with no triggered governance gate', () => {
    const snapshot = buildReleaseGovernanceApplicabilitySnapshot(
      request([entry()]),
      '2026-09-17T18:00:00.000Z'
    );

    expect(snapshot.schema).toBe('raeburnai.release-governance-applicability.v1');
    expect(snapshot.gate).toBe('pass');
    expect(snapshot.blockedSystemIds).toEqual([]);
    expect(snapshot.reviewSystemIds).toEqual([]);
    expect(snapshot.systems[0]?.eu.categories).toEqual(['general_or_minimal_risk']);
    expect(snapshot.systems[0]?.eu.legalReviewRequired).toBe(false);
  });

  it('blocks a potentially prohibited practice pending qualified review', () => {
    const candidate = entry({
      regulatoryProfile: {
        eu: {
          roles: ['provider'],
          prohibitedPracticeSignals: ['social_scoring'],
          highRiskAreas: [],
          transparencySignals: [],
          gpaiModel: false,
          gpaiSystemicRisk: false
        },
        uk: { inScope: false, sectorRegulators: [] }
      }
    });

    const snapshot = buildReleaseGovernanceApplicabilitySnapshot(request([candidate]));

    expect(snapshot.gate).toBe('block');
    expect(snapshot.blockedSystemIds).toEqual(['system-a']);
    expect(snapshot.systems[0]?.eu.categories).toContain('potentially_prohibited');
    expect(snapshot.systems[0]?.eu.requiredEvidence).toContain(
      'prohibited-practice-legal-assessment'
    );
    expect(snapshot.systems[0]?.eu.legalReviewRequired).toBe(true);
  });

  it('infers high-risk screening areas from existing system risk flags', () => {
    const candidate = entry({
      system: {
        ...entry().system,
        employmentOrEducationUse: true,
        criticalInfrastructureUse: true
      }
    });

    const snapshot = buildReleaseGovernanceApplicabilitySnapshot(request([candidate]));
    const eu = snapshot.systems[0]?.eu;

    expect(snapshot.gate).toBe('review');
    expect(eu?.categories).toContain('potentially_high_risk');
    expect(eu?.highRiskAreas).toEqual(['critical_infrastructure', 'education_or_employment']);
    expect(eu?.requiredEvidence).toContain('human-oversight-plan');
    expect(eu?.requiredEvidence).toContain('conformity-readiness-assessment');
  });

  it('flags GPAI provider and systemic-risk evidence requirements without calling it prohibited', () => {
    const candidate = entry({
      regulatoryProfile: {
        eu: {
          roles: ['gpai_provider'],
          prohibitedPracticeSignals: [],
          highRiskAreas: [],
          transparencySignals: [],
          gpaiModel: true,
          gpaiSystemicRisk: true
        },
        uk: { inScope: false, sectorRegulators: [] }
      }
    });

    const snapshot = buildReleaseGovernanceApplicabilitySnapshot(request([candidate]));
    const eu = snapshot.systems[0]?.eu;

    expect(snapshot.gate).toBe('review');
    expect(eu?.categories).toContain('gpai_provider_obligations');
    expect(eu?.categories).not.toContain('potentially_prohibited');
    expect(eu?.requiredEvidence).toContain('systemic-risk-model-evaluation');
    expect(eu?.requiredEvidence).toContain('copyright-policy');
  });

  it('fails visibly to review when regulatory profiles are missing', () => {
    const candidate = entry();
    delete (candidate as { regulatoryProfile?: unknown }).regulatoryProfile;

    const snapshot = buildReleaseGovernanceApplicabilitySnapshot(request([candidate]));

    expect(snapshot.gate).toBe('review');
    expect(snapshot.incompleteProfileSystemIds).toEqual(['system-a']);
    expect(snapshot.systems[0]?.eu.categories).toContain('not_fully_profiled');
    expect(snapshot.systems[0]?.uk.principles).toHaveLength(5);
    expect(snapshot.systems[0]?.reasons).toContain('eu:profile_incomplete');
    expect(snapshot.systems[0]?.reasons).toContain('uk:profile_incomplete');
  });

  it('sorts release output deterministically by system id', () => {
    const systemB = entry({
      system: { ...entry().system, id: 'system-b', name: 'System B' },
      sourceRef: 'platform-registry:system-b'
    });
    const systemA = entry();

    const snapshot = buildReleaseGovernanceApplicabilitySnapshot(request([systemB, systemA]));

    expect(snapshot.systems.map(system => system.systemId)).toEqual(['system-a', 'system-b']);
  });
});
