import { z } from 'zod';

export const FrameworkSchema = z.enum(['eu_ai_act', 'gdpr', 'iso_42001', 'iso_27001', 'uk_ai_guidance']);
export type Framework = z.infer<typeof FrameworkSchema>;

export const RiskLevelSchema = z.enum(['minimal', 'limited', 'medium', 'high', 'unacceptable']);
export type RiskLevel = z.infer<typeof RiskLevelSchema>;

export const AISystemSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(2),
  owner: z.string().min(1),
  businessUnit: z.string().min(1),
  purpose: z.string().min(10),
  users: z.array(z.string()).default([]),
  affectedGroups: z.array(z.string()).default([]),
  modelProviders: z.array(z.string()).default([]),
  dataCategories: z.array(z.string()).default([]),
  personalData: z.boolean().default(false),
  specialCategoryData: z.boolean().default(false),
  automatedDecisions: z.boolean().default(false),
  humanOversight: z.boolean().default(false),
  publicFacing: z.boolean().default(false),
  safetyCritical: z.boolean().default(false),
  employmentOrEducationUse: z.boolean().default(false),
  biometricUse: z.boolean().default(false),
  lawEnforcementUse: z.boolean().default(false),
  criticalInfrastructureUse: z.boolean().default(false),
  documentation: z.array(z.string()).default([]),
  evidence: z.record(z.string()).default({}),
  createdAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime().optional()
});
export type AISystem = z.infer<typeof AISystemSchema>;

export type RuleSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface ComplianceRule {
  id: string;
  framework: Framework;
  title: string;
  description: string;
  severity: RuleSeverity;
  controlRefs: string[];
  evidenceRequired: string[];
  test: (system: AISystem) => boolean;
  remediation: string;
}

export interface RuleResult {
  ruleId: string;
  framework: Framework;
  title: string;
  severity: RuleSeverity;
  passed: boolean;
  evidenceRequired: string[];
  remediation?: string;
  controlRefs: string[];
}

export interface AssessmentResult {
  systemId: string;
  systemName: string;
  overallScore: number;
  riskLevel: RiskLevel;
  passed: number;
  failed: number;
  results: RuleResult[];
  generatedAt: string;
}
