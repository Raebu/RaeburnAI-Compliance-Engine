import { AISystemSchema, type AISystem, type AssessmentResult, type RiskLevel, type RuleSeverity } from './types.js';
import { rules } from './rules.js';

const severityWeight: Record<RuleSeverity, number> = {
  info: 1,
  low: 2,
  medium: 4,
  high: 8,
  critical: 13
};

export function classifyRisk(system: AISystem): RiskLevel {
  if (system.safetyCritical || system.criticalInfrastructureUse || system.employmentOrEducationUse || system.biometricUse) return 'high';
  if (system.personalData && system.automatedDecisions) return 'high';
  if (system.personalData || system.publicFacing || system.specialCategoryData) return 'medium';
  return 'limited';
}

export function assessSystem(input: unknown): AssessmentResult {
  const system = AISystemSchema.parse(input);
  const results = rules.map(rule => {
    const passed = rule.test(system);
    return {
      ruleId: rule.id,
      framework: rule.framework,
      title: rule.title,
      severity: rule.severity,
      passed,
      evidenceRequired: rule.evidenceRequired,
      remediation: passed ? undefined : rule.remediation,
      controlRefs: rule.controlRefs
    };
  });

  const totalWeight = results.reduce((sum, r) => sum + severityWeight[r.severity], 0);
  const failedWeight = results.filter(r => !r.passed).reduce((sum, r) => sum + severityWeight[r.severity], 0);
  const overallScore = Math.max(0, Math.round(100 - (failedWeight / totalWeight) * 100));

  return {
    systemId: system.id,
    systemName: system.name,
    overallScore,
    riskLevel: classifyRisk(system),
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    results,
    generatedAt: new Date().toISOString()
  };
}

export function buildRemediationRoadmap(result: AssessmentResult) {
  return result.results
    .filter(r => !r.passed)
    .sort((a, b) => severityWeight[b.severity] - severityWeight[a.severity])
    .map((r, index) => ({
      order: index + 1,
      framework: r.framework,
      control: r.title,
      severity: r.severity,
      action: r.remediation,
      evidence: r.evidenceRequired,
      controlRefs: r.controlRefs
    }));
}
