import { createHash, randomUUID } from 'node:crypto';
import { link, mkdir, readFile, readdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  buildTrustedReleaseInventorySnapshot,
  type ReleaseInventoryProvenance,
  type ReleaseInventorySnapshot
} from '@raeburnai/compliance-core';

export interface StoredReleaseInventoryEvidence {
  schema: 'raeburnai.release-ai-inventory-evidence.v1';
  releaseId: string;
  capturedAt: string;
  provenance: ReleaseInventoryProvenance;
  snapshot: ReleaseInventorySnapshot;
  contentSha256: string;
  storedAt: string;
}

export interface InventoryEvidenceWriteResult {
  evidence: StoredReleaseInventoryEvidence;
  created: boolean;
}

export interface InventoryEvidenceException {
  type: 'incomplete_inventory' | 'stale_inventory';
  releaseId: string;
  capturedAt: string;
  environment: ReleaseInventoryProvenance['environment'];
  systemIds: string[];
  ageSeconds?: number;
  thresholdSeconds?: number;
}

export interface InventoryEvidenceStore {
  put(input: unknown): Promise<InventoryEvidenceWriteResult>;
  get(releaseId: string): Promise<StoredReleaseInventoryEvidence | undefined>;
  list(): Promise<StoredReleaseInventoryEvidence[]>;
}

export class InventoryEvidenceConflictError extends Error {
  readonly statusCode = 409;

  constructor(releaseId: string) {
    super(`immutable_inventory_evidence_conflict:${releaseId}`);
    this.name = 'InventoryEvidenceConflictError';
  }
}

export class InventoryEvidenceIntegrityError extends Error {
  readonly statusCode = 500;

  constructor(releaseId: string) {
    super(`inventory_evidence_integrity_failure:${releaseId}`);
    this.name = 'InventoryEvidenceIntegrityError';
  }
}

function canonicalise(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalise);
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(
      Object.keys(record)
        .sort()
        .map(key => [key, canonicalise(record[key])])
    );
  }
  return value;
}

function evidenceMaterial(evidence: Pick<
  StoredReleaseInventoryEvidence,
  'schema' | 'releaseId' | 'capturedAt' | 'provenance' | 'snapshot'
>) {
  return {
    schema: evidence.schema,
    releaseId: evidence.releaseId,
    capturedAt: evidence.capturedAt,
    provenance: evidence.provenance,
    snapshot: evidence.snapshot
  };
}

function contentHash(material: unknown): string {
  const canonicalJson = JSON.stringify(canonicalise(material));
  return createHash('sha256').update(canonicalJson).digest('hex');
}

function fileKey(releaseId: string): string {
  return createHash('sha256').update(releaseId).digest('hex');
}

function isNodeError(error: unknown, code: string): boolean {
  return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === code;
}

export class FileInventoryEvidenceStore implements InventoryEvidenceStore {
  constructor(
    private readonly directory: string,
    private readonly now: () => Date = () => new Date()
  ) {}

  private filePath(releaseId: string): string {
    return path.join(this.directory, `release-${fileKey(releaseId)}.json`);
  }

  private verify(evidence: StoredReleaseInventoryEvidence): StoredReleaseInventoryEvidence {
    const expected = contentHash(evidenceMaterial(evidence));
    if (expected !== evidence.contentSha256) {
      throw new InventoryEvidenceIntegrityError(evidence.releaseId);
    }
    return evidence;
  }

  async get(releaseId: string): Promise<StoredReleaseInventoryEvidence | undefined> {
    try {
      const raw = await readFile(this.filePath(releaseId), 'utf8');
      const evidence = JSON.parse(raw) as StoredReleaseInventoryEvidence;
      if (evidence.releaseId !== releaseId) {
        throw new InventoryEvidenceIntegrityError(releaseId);
      }
      return this.verify(evidence);
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return undefined;
      throw error;
    }
  }

  async put(input: unknown): Promise<InventoryEvidenceWriteResult> {
    const { request, snapshot } = buildTrustedReleaseInventorySnapshot(input);
    const material = {
      schema: 'raeburnai.release-ai-inventory-evidence.v1' as const,
      releaseId: request.releaseId,
      capturedAt: request.capturedAt,
      provenance: request.provenance,
      snapshot
    };
    const hash = contentHash(material);

    const existing = await this.get(request.releaseId);
    if (existing) {
      if (existing.contentSha256 === hash) return { evidence: existing, created: false };
      throw new InventoryEvidenceConflictError(request.releaseId);
    }

    await mkdir(this.directory, { recursive: true });
    const target = this.filePath(request.releaseId);
    const temporary = `${target}.${randomUUID()}.tmp`;
    const evidence: StoredReleaseInventoryEvidence = {
      ...material,
      contentSha256: hash,
      storedAt: this.now().toISOString()
    };

    await writeFile(temporary, `${JSON.stringify(evidence, null, 2)}\n`, { flag: 'wx' });
    try {
      await link(temporary, target);
    } catch (error) {
      if (!isNodeError(error, 'EEXIST')) throw error;
      const raced = await this.get(request.releaseId);
      if (raced?.contentSha256 === hash) return { evidence: raced, created: false };
      throw new InventoryEvidenceConflictError(request.releaseId);
    } finally {
      await unlink(temporary).catch(() => undefined);
    }

    return { evidence, created: true };
  }

  async list(): Promise<StoredReleaseInventoryEvidence[]> {
    try {
      const names = (await readdir(this.directory))
        .filter(name => /^release-[0-9a-f]{64}\.json$/.test(name))
        .sort();
      const evidence = await Promise.all(
        names.map(async name => {
          const raw = await readFile(path.join(this.directory, name), 'utf8');
          return this.verify(JSON.parse(raw) as StoredReleaseInventoryEvidence);
        })
      );
      return evidence.sort((left, right) => left.releaseId.localeCompare(right.releaseId));
    } catch (error) {
      if (isNodeError(error, 'ENOENT')) return [];
      throw error;
    }
  }
}

export function buildInventoryEvidenceExceptions(
  evidence: StoredReleaseInventoryEvidence[],
  now: Date,
  maxAgeSeconds: number
): InventoryEvidenceException[] {
  const nowMs = now.getTime();
  const exceptions: InventoryEvidenceException[] = [];

  for (const item of evidence) {
    if (!item.snapshot.inventoryComplete) {
      exceptions.push({
        type: 'incomplete_inventory',
        releaseId: item.releaseId,
        capturedAt: item.capturedAt,
        environment: item.provenance.environment,
        systemIds: item.snapshot.incompleteSystemIds
      });
    }

    const capturedMs = Date.parse(item.capturedAt);
    const ageSeconds = Math.max(0, Math.floor((nowMs - capturedMs) / 1000));
    if (ageSeconds > maxAgeSeconds) {
      exceptions.push({
        type: 'stale_inventory',
        releaseId: item.releaseId,
        capturedAt: item.capturedAt,
        environment: item.provenance.environment,
        systemIds: item.snapshot.systems.map(system => system.entry.system.id),
        ageSeconds,
        thresholdSeconds: maxAgeSeconds
      });
    }
  }

  return exceptions.sort(
    (left, right) =>
      left.releaseId.localeCompare(right.releaseId) || left.type.localeCompare(right.type)
  );
}
