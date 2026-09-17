import { z } from 'zod';
import {
  AISystemInventoryEntrySchema,
  ReleaseInventoryRequestSchema,
  type AISystemInventoryEntry
} from './inventory.js';

export const EUAIActRoleSchema = z.enum([
  'provider',
  'deployer',
  'importer',
  'distributor',
  'product_manufacturer',
  'authorised_representative',
  'gpai_provider',
  'not_determined'
]);
export type EUAIActRole = z.infer<typeof EUAIActRoleSchema>;

export const EUProhibitedPracticeSignalSchema = z.enum([
  'harmful_manipulation_or_deception',
  'exploitation_of_vulnerability',
  'social_scoring',
  'predictive_policing_based_solely_on_profiling',
  'untargeted_facial_image_scraping',
  'emotion_recognition_workplace_or_education',
  'biometric_categorisation_sensitive_traits',
  'remote_biometric_identification_public_space'
]);
export type EUProhibitedPracticeSignal = z.infer<typeof EUProhibitedPracticeSignalSchema>;

export const EUHighRiskAreaSchema = z.enum([
  'biometrics',
  'critical_infrastructure',
  'education_or_employment',
  'access_to_essential_private_or_public_services',
  'law_enforcement',
  'migration_asylum_border',
  'administration_of_justice_or_democratic_processes',
  'regulated_product_safety_component'
]);
export type EUHighRiskArea = z.infer<typeof EUHighRiskAreaSchema>;

export const EUTransparencySignalSchema = z.enum([
  'human_interaction',
  'synthetic_content',
  'deepfake',
  'emotion_recognition_or_biometric_categorisation'
]);
export type EUTransparencySignal = z.infer<typeof EUTransparencySignalSchema>;

export const UKAIPrincipleSchema = z.enum([
  'safety_security_robustness',
  'transparency_explainability',
  'fairness',
  'accountability_governance',
  'contestability_redress'
]);
export type UKAIPrinciple = z.infer<typeof UKAIPrincipleSchema>;

export const RegulatoryApplicabilityProfileSchema = z.object({
  eu: z
    .object({
      roles: z.array(EUAIActRoleSchema).min(1).default(['not_determined']),
      prohibitedPracticeSignals: z.array(EUProhibitedPracticeSignalSchema).default([]),
      highRiskAreas: z.array(EUHighRiskAreaSchema).default([]),
      transparencySignals: z.array(EUTransparencySignalSchema).default([]),
      gpaiModel: z.boolean().default(false),
      gpaiSystemicRisk: z.boolean().default(false)
    })
    .optional(),
  uk: z
    .object({
      inScope: z.boolean().default(true),
      sectorRegulators: z.array(z.string().min(1)).default([])
    })
    .optional()
});
export type RegulatoryApplicabilityProfile = z.infer<typeof RegulatoryApplicabilityProfileSchema>;

export const GovernanceInventoryEntrySchema = AISystemInventoryEntrySchema.extend({
  regulatoryProfile: RegulatoryApplicabilityProfileSchema.optional()
});
export type GovernanceInventoryEntry = z.infer<typeof GovernanceInventoryEntrySchema>;

export const ReleaseGovernanceApplicabilityRequestSchema = ReleaseInventoryRequestSchema.extend({
  systems: z.array(GovernanceInventoryEntrySchema).min(1)
});
export type ReleaseGovernanceApplicabilityRequest = z.infer<
  typeof ReleaseGovernanceApplicabilityRequestSchema
>;

export type GovernanceGate = 'pass' | 'review' | 'block';
export type EUApplicabilityCategory =
  | 'potentially_prohibited'
  | 'potentially_high_risk'
  | 'gpai_provider_obligations'
  | 'transparency_obligations'
  | 'general_or_minimal_risk'
  | 'not_fully_profiled';

export interface EUSystemApplicability {
  categories: EUApplicabilityCategory[];
  roles: EUAIActRole[];
  prohibitedPracticeSignals: EUProhibitedPracticeSignal[];
  highRiskAreas: EUHighRiskArea[];
  transparencySignals: EUTransparencySignal[];
  gpaiModel: boolean;
  gpaiSystemicRisk: boolean;
  profileComplete: boolean;
  legalReviewRequired: boolean;
  gate: GovernanceGate;
  requiredEvidence: string[];
  authorityRefs: string[];
}

export interface UKSystemApplicability {
  inScope: boolean;
  principles: UKAIPrinciple[];
  sectorRegulators: string[];
  profileComplete: boolean;
  legalReviewRequired: boolean;
  gate: GovernanceGate;
  requiredEvidence: string[];
  authorityRefs: string[];
}

export interface GovernanceSystemSnapshot {
  systemId: string;
  systemName: string;
  deploymentState: GovernanceInventoryEntry['deploymentState'];
  sourceRef: string;
  eu: EUSystemApplicability;
  uk: UKSystemApplicability;
  gate: GovernanceGate;
  reasons: string[];
}

export interface ReleaseGovernanceApplicabilitySnapshot {
  schema: 'raeburnai.release-governance-applicability.v1';
  releaseId: string;
  sourceCommit?: string;
  generatedAt: string;
  totalSystems: number;
  gate: GovernanceGate;
  blockedSystemIds: string[];
  reviewSystemIds: string[];
  incompleteProfileSystemIds: string[];
  systems: GovernanceSystemSnapshot[];
  legalDisclaimer: string;
}

const ukPrinciples = [...UKAIPrincipleSchema.options];

function uniqueSorted<T extends string>(values: readonly T[]): T[] {
  return [...new Set(values)].sort() as T[];
}

function inferHighRiskAreas(entry: AISystemInventoryEntry): EUHighRiskArea[] {
  const areas: EUHighRiskArea[] = [];
  const system = entry.system;
  if (system.biometricUse) areas.push('biometrics');
  if (system.criticalInfrastructureUse) areas.push('critical_infrastructure');
  if (system.employmentOrEducationUse) areas.push('education_or_employment');
  if (system.lawEnforcementUse) areas.push('law_enforcement');
  if (system.safetyCritical) areas.push('regulated_product_safety_component');
  return areas;
}

function inferTransparencySignals(entry: AISystemInventoryEntry): EUTransparencySignal[] {
  return entry.system.publicFacing ? ['human_interaction'] : [];
}

function evidenceForEU(input: {
  prohibited: EUProhibitedPracticeSignal[];
  highRiskAreas: EUHighRiskArea[];
  transparencySignals: EUTransparencySignal[];
  gpaiModel: boolean;
  gpaiSystemicRisk: boolean;
  profileComplete: boolean;
}): string[] {
  const evidence = new Set<string>();
  if (!input.profileComplete) {
    evidence.add('eu-ai-act-role-and-use-case-screening');
    evidence.add('legal-review-owner');
  }
  if (input.prohibited.length > 0) {
    evidence.add('prohibited-practice-legal-assessment');
    evidence.add('use-case-design-and-data-flow');
    evidence.add('deployment-block-or-approved-exception-record');
  }
  if (input.highRiskAreas.length > 0) {
    evidence.add('risk-management-system');
    evidence.add('data-governance-assessment');
    evidence.add('technical-documentation');
    evidence.add('logging-and-traceability');
    evidence.add('human-oversight-plan');
    evidence.add('accuracy-robustness-cybersecurity-evidence');
    evidence.add('conformity-readiness-assessment');
  }
  if (input.transparencySignals.length > 0) {
    evidence.add('ai-transparency-notice');
    evidence.add('content-labelling-assessment');
  }
  if (input.gpaiModel) {
    evidence.add('gpai-technical-documentation');
    evidence.add('downstream-provider-information');
    evidence.add('copyright-policy');
  }
  if (input.gpaiSystemicRisk) {
    evidence.add('systemic-risk-model-evaluation');
    evidence.add('adversarial-testing');
    evidence.add('serious-incident-process');
    evidence.add('cybersecurity-protection-evidence');
  }
  return [...evidence].sort();
}

function assessEU(entry: GovernanceInventoryEntry): EUSystemApplicability {
  const eu = entry.regulatoryProfile?.eu;
  const profileComplete = Boolean(eu && eu.roles.every(role => role !== 'not_determined'));
  const prohibitedPracticeSignals = uniqueSorted(eu?.prohibitedPracticeSignals ?? []);
  const highRiskAreas = uniqueSorted([...(eu?.highRiskAreas ?? []), ...inferHighRiskAreas(entry)]);
  const transparencySignals = uniqueSorted([
    ...(eu?.transparencySignals ?? []),
    ...inferTransparencySignals(entry)
  ]);
  const gpaiModel = eu?.gpaiModel ?? false;
  const gpaiSystemicRisk = eu?.gpaiSystemicRisk ?? false;
  const roles = uniqueSorted(eu?.roles ?? ['not_determined']);
  const categories = new Set<EUApplicabilityCategory>();

  if (!profileComplete) categories.add('not_fully_profiled');
  if (prohibitedPracticeSignals.length > 0) categories.add('potentially_prohibited');
  if (highRiskAreas.length > 0) categories.add('potentially_high_risk');
  if (roles.includes('gpai_provider') || gpaiModel) categories.add('gpai_provider_obligations');
  if (transparencySignals.length > 0) categories.add('transparency_obligations');
  if (categories.size === 0) categories.add('general_or_minimal_risk');

  const gate: GovernanceGate = prohibitedPracticeSignals.length > 0
    ? 'block'
    : !profileComplete ||
        highRiskAreas.length > 0 ||
        transparencySignals.length > 0 ||
        roles.includes('gpai_provider') ||
        gpaiModel
      ? 'review'
      : 'pass';

  const authorityRefs = new Set<string>();
  if (prohibitedPracticeSignals.length > 0) authorityRefs.add('EU AI Act Article 5 prohibited practices');
  if (highRiskAreas.length > 0) authorityRefs.add('EU AI Act high-risk classification / Annex III screening');
  if (transparencySignals.length > 0) authorityRefs.add('EU AI Act Article 50 transparency obligations');
  if (roles.includes('gpai_provider') || gpaiModel) authorityRefs.add('EU AI Act GPAI provider obligations');

  return {
    categories: [...categories].sort(),
    roles,
    prohibitedPracticeSignals,
    highRiskAreas,
    transparencySignals,
    gpaiModel,
    gpaiSystemicRisk,
    profileComplete,
    legalReviewRequired: gate !== 'pass',
    gate,
    requiredEvidence: evidenceForEU({
      prohibited: prohibitedPracticeSignals,
      highRiskAreas,
      transparencySignals,
      gpaiModel,
      gpaiSystemicRisk,
      profileComplete
    }),
    authorityRefs: [...authorityRefs].sort()
  };
}

function assessUK(entry: GovernanceInventoryEntry): UKSystemApplicability {
  const uk = entry.regulatoryProfile?.uk;
  const profileComplete = Boolean(uk);
  const inScope = uk?.inScope ?? true;
  const sectorRegulators = uniqueSorted(uk?.sectorRegulators ?? []);
  const gate: GovernanceGate = !profileComplete || (inScope && sectorRegulators.length > 0)
    ? 'review'
    : 'pass';

  return {
    inScope,
    principles: inScope ? ukPrinciples : [],
    sectorRegulators,
    profileComplete,
    legalReviewRequired: gate !== 'pass',
    gate,
    requiredEvidence: inScope
      ? [
          'accountability-and-governance-record',
          'contestability-and-redress-route',
          'fairness-assessment',
          'safety-security-robustness-assessment',
          'transparency-and-explainability-assessment'
        ]
      : [],
    authorityRefs: inScope
      ? ['UK AI regulatory principles: regulator-led, context-specific governance']
      : []
  };
}

function combineGate(...gates: GovernanceGate[]): GovernanceGate {
  if (gates.includes('block')) return 'block';
  if (gates.includes('review')) return 'review';
  return 'pass';
}

export function buildReleaseGovernanceApplicabilitySnapshot(
  input: unknown,
  generatedAt = new Date().toISOString()
): ReleaseGovernanceApplicabilitySnapshot {
  const request = ReleaseGovernanceApplicabilityRequestSchema.parse(input);
  const seen = new Set<string>();
  for (const entry of request.systems) {
    if (seen.has(entry.system.id)) throw new Error(`duplicate_ai_system_id:${entry.system.id}`);
    seen.add(entry.system.id);
  }

  const systems = [...request.systems]
    .sort((left, right) => left.system.id.localeCompare(right.system.id))
    .map(entry => {
      const eu = assessEU(entry);
      const uk = assessUK(entry);
      const gate = combineGate(eu.gate, uk.gate);
      const reasons = [
        ...eu.categories.map(category => `eu:${category}`),
        ...(!eu.profileComplete ? ['eu:profile_incomplete'] : []),
        ...(!uk.profileComplete ? ['uk:profile_incomplete'] : []),
        ...(uk.inScope ? ['uk:principles_review'] : [])
      ];
      return {
        systemId: entry.system.id,
        systemName: entry.system.name,
        deploymentState: entry.deploymentState,
        sourceRef: entry.sourceRef,
        eu,
        uk,
        gate,
        reasons: uniqueSorted(reasons)
      } satisfies GovernanceSystemSnapshot;
    });

  const blockedSystemIds = systems.filter(system => system.gate === 'block').map(system => system.systemId);
  const reviewSystemIds = systems.filter(system => system.gate === 'review').map(system => system.systemId);
  const incompleteProfileSystemIds = systems
    .filter(system => !system.eu.profileComplete || !system.uk.profileComplete)
    .map(system => system.systemId);

  return {
    schema: 'raeburnai.release-governance-applicability.v1',
    releaseId: request.releaseId,
    ...(request.sourceCommit ? { sourceCommit: request.sourceCommit } : {}),
    generatedAt,
    totalSystems: systems.length,
    gate: blockedSystemIds.length > 0 ? 'block' : reviewSystemIds.length > 0 ? 'review' : 'pass',
    blockedSystemIds,
    reviewSystemIds,
    incompleteProfileSystemIds,
    systems,
    legalDisclaimer:
      'This snapshot is an automated governance screening aid, not a legal determination. Potentially prohibited/high-risk classifications and regulator applicability require qualified legal and sector review.'
  };
}
