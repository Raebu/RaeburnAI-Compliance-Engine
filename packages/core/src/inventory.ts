import { z } from 'zod';
import { assessSystem } from './engine.js';
import { AISystemSchema, RiskLevelSchema, type AssessmentResult, type RiskLevel } from './types.js';

export const DeploymentStateSchema = z.enum([
  'planned',
  'development',
  'staging',
  'production',
  'suspended',
  'retired'
]);
export type DeploymentState = z.infer<typeof DeploymentStateSchema>;

export const InventoryComponentTypeSchema = z.enum([
  'model',
  'router',
  'agent',
  'tool_gateway',
  'knowledge_system',
  'governance_service',
  'application',
  'other'
]);
export type InventoryComponentType = z.infer<typeof InventoryComponentTypeSchema>;

export const InventoryControlEvidenceSchema = z.object({
  controlId: z.string().min(1),
  evidenceRef: z.string().min(1),
  status: z.enum(['implemented', 'partial', 'planned', 'not_applicable'])
});

export const InventoryEvaluationSchema = z.object({
  evaluationId: z.string().min(1),
  evidenceRef: z.string().min(1),
  status: z.enum(['passed', 'failed', 'partial', 'pending'])
});

export const AISystemInventoryEntrySchema = z.object({
  system: AISystemSchema,
  componentType: InventoryComponentTypeSchema,
  deploymentState: DeploymentStateSchema,
  repository: z.string().url().optional(),
  version: z.string().min(1).optional(),
  sourceRef: z.string().min(1),
  controls: z.array(InventoryControlEvidenceSchema).default([]),
  evaluations: z.array(InventoryEvaluationSchema).default([])
});
export type AISystemInventoryEntry = z.infer<typeof AISystemInventoryEntrySchema>;

export const ReleaseInventoryRequestSchema = z.object({
  releaseId: z.string().min(1),
  sourceCommit: z.string().regex(/^[0-9a-f]{7,40}$/i).optional(),
  systems: z.array(AISystemInventoryEntrySchema).min(1)
});
export type ReleaseInventoryRequest = z.infer<typeof ReleaseInventoryRequestSchema>;

export const ReleaseInventoryProvenanceSchema = z.object({
  repository: z.string().url(),
  commit: z.string().regex(/^[0-9a-f]{40}$/i),
  ref: z.string().min(1),
  producer: z.string().min(1),
  environment: z.enum(['staging', 'production'])
});
export type ReleaseInventoryProvenance = z.infer<typeof ReleaseInventoryProvenanceSchema>;

export const TrustedReleaseInventoryRequestSchema = z.object({
  releaseId: z.string().min(1),
  capturedAt: z.string().datetime({ offset: true }),
  provenance: ReleaseInventoryProvenanceSchema,
  systems: z.array(AISystemInventoryEntrySchema).min(1)
});
export type TrustedReleaseInventoryRequest = z.infer<typeof TrustedReleaseInventoryRequestSchema>;

export interface InventorySystemSnapshot {
  entry: AISystemInventoryEntry;
  assessment: AssessmentResult;
  inventoryComplete: boolean;
  missingEvidence: string[];
}

export interface ReleaseInventorySnapshot {
  schema: 'raeburnai.release-ai-inventory.v1';
  releaseId: string;
  sourceCommit?: string;
  generatedAt: string;
  totalSystems: number;
  highestRisk: RiskLevel;
  riskCounts: Record<RiskLevel, number>;
  deploymentCounts: Record<DeploymentState, number>;
  incompleteSystemIds: string[];
  inventoryComplete: boolean;
  systems: InventorySystemSnapshot[];
}

const riskOrder: readonly RiskLevel[] = [
  'minimal',
  'limited',
  'medium',
  'high',
  'unacceptable'
];

const deploymentStates = DeploymentStateSchema.options;

function missingInventoryEvidence(entry: AISystemInventoryEntry): string[] {
  const missing: string[] = [];
  if (entry.system.documentation.length === 0) missing.push('documentation');
  if (entry.controls.length === 0) missing.push('controls');
  if (entry.evaluations.length === 0) missing.push('evaluations');
  if (!entry.version) missing.push('version');
  return missing;
}

function emptyRiskCounts(): Record<RiskLevel, number> {
  return Object.fromEntries(RiskLevelSchema.options.map(level => [level, 0])) as Record<
    RiskLevel,
    number
  >;
}

function emptyDeploymentCounts(): Record<DeploymentState, number> {
  return Object.fromEntries(deploymentStates.map(state => [state, 0])) as Record<
    DeploymentState,
    number
  >;
}

export function buildReleaseInventorySnapshot(
  input: unknown,
  generatedAt = new Date().toISOString()
): ReleaseInventorySnapshot {
  const request = ReleaseInventoryRequestSchema.parse(input);
  const seen = new Set<string>();
  for (const entry of request.systems) {
    if (seen.has(entry.system.id)) {
      throw new Error(`duplicate_ai_system_id:${entry.system.id}`);
    }
    seen.add(entry.system.id);
  }

  const systems = [...request.systems]
    .sort((left, right) => left.system.id.localeCompare(right.system.id))
    .map(entry => {
      const assessment = assessSystem(entry.system);
      const missingEvidence = missingInventoryEvidence(entry);
      return {
        entry,
        assessment,
        inventoryComplete: missingEvidence.length === 0,
        missingEvidence
      } satisfies InventorySystemSnapshot;
    });

  const riskCounts = emptyRiskCounts();
  const deploymentCounts = emptyDeploymentCounts();
  let highestRisk: RiskLevel = 'minimal';

  for (const system of systems) {
    riskCounts[system.assessment.riskLevel] += 1;
    deploymentCounts[system.entry.deploymentState] += 1;
    if (riskOrder.indexOf(system.assessment.riskLevel) > riskOrder.indexOf(highestRisk)) {
      highestRisk = system.assessment.riskLevel;
    }
  }

  const incompleteSystemIds = systems
    .filter(system => !system.inventoryComplete)
    .map(system => system.entry.system.id);

  return {
    schema: 'raeburnai.release-ai-inventory.v1',
    releaseId: request.releaseId,
    ...(request.sourceCommit ? { sourceCommit: request.sourceCommit } : {}),
    generatedAt,
    totalSystems: systems.length,
    highestRisk,
    riskCounts,
    deploymentCounts,
    incompleteSystemIds,
    inventoryComplete: incompleteSystemIds.length === 0,
    systems
  };
}

export interface TrustedReleaseInventorySnapshot {
  request: TrustedReleaseInventoryRequest;
  snapshot: ReleaseInventorySnapshot;
}

export function buildTrustedReleaseInventorySnapshot(
  input: unknown
): TrustedReleaseInventorySnapshot {
  const request = TrustedReleaseInventoryRequestSchema.parse(input);
  const snapshot = buildReleaseInventorySnapshot(
    {
      releaseId: request.releaseId,
      sourceCommit: request.provenance.commit,
      systems: request.systems
    },
    request.capturedAt
  );
  return { request, snapshot };
}
