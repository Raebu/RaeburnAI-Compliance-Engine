import { describe, expect, it } from 'vitest';
import { assessSystem, buildRemediationRoadmap, classifyRisk } from '../src/index.js';

describe('compliance engine', () => {
  it('classifies employment AI as high risk', () => {
    expect(classifyRisk({
      id: 'x',
      name: 'Hiring AI',
      owner: 'HR',
      businessUnit: 'People',
      purpose: 'Supports recruiter review of applications.',
      users: [],
      affectedGroups: [],
      modelProviders: [],
      dataCategories: [],
      personalData: true,
      specialCategoryData: false,
      automatedDecisions: true,
      humanOversight: false,
      publicFacing: false,
      safetyCritical: false,
      employmentOrEducationUse: true,
      biometricUse: false,
      lawEnforcementUse: false,
      criticalInfrastructureUse: false,
      documentation: [],
      evidence: {}
    })).toBe('high');
  });

  it('returns failed controls and a remediation roadmap', () => {
    const result = assessSystem({
      id: 'x',
      name: 'Hiring AI',
      owner: 'HR',
      businessUnit: 'People',
      purpose: 'Supports recruiter review of applications.',
      personalData: true,
      automatedDecisions: true,
      employmentOrEducationUse: true,
      humanOversight: false,
      evidence: {}
    });

    expect(result.failed).toBeGreaterThan(0);
    expect(result.overallScore).toBeLessThan(100);
    expect(buildRemediationRoadmap(result).length).toBe(result.failed);
  });
});
