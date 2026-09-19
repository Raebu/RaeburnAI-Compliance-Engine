import { timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { z, ZodError } from 'zod';
import {
  assessSystem,
  buildReleaseGovernanceApplicabilitySnapshot,
  buildReleaseInventorySnapshot,
  buildRemediationRoadmap,
  rules
} from '@raeburnai/compliance-core';
import {
  buildInventoryEvidenceExceptions,
  FileInventoryEvidenceStore,
  type InventoryEvidenceStore
} from './inventory-evidence.js';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

export interface BuildServerOptions {
  inventoryEvidenceStore?: InventoryEvidenceStore;
  inventoryRegistryToken?: string;
  evidenceDirectory?: string;
  inventoryMaxAgeSeconds?: number;
  now?: () => Date;
}

function httpError(statusCode: number, message: string): Error & { statusCode: number } {
  return Object.assign(new Error(message), { statusCode });
}

function secureBearerMatches(header: string | undefined, expectedToken: string): boolean {
  if (!header) return false;
  const value = header.trim();
  const prefix = 'bearer ';
  if (value.length <= prefix.length || value.slice(0, prefix.length).toLowerCase() !== prefix) {
    return false;
  }
  const supplied = value.slice(prefix.length).trim();
  if (!supplied) return false;
  const expectedBuffer = Buffer.from(expectedToken);
  const suppliedBuffer = Buffer.from(supplied);
  return (
    expectedBuffer.length === suppliedBuffer.length &&
    timingSafeEqual(expectedBuffer, suppliedBuffer)
  );
}

export function buildServer(options: BuildServerOptions = {}) {
  const app = Fastify({ logger: true });
  const now = options.now ?? (() => new Date());
  const evidenceStore =
    options.inventoryEvidenceStore ??
    new FileInventoryEvidenceStore(
      options.evidenceDirectory ??
        process.env.COMPLIANCE_EVIDENCE_DIR ??
        './data/compliance-evidence',
      now
    );
  const registryToken = options.inventoryRegistryToken ?? process.env.INVENTORY_REGISTRY_TOKEN;
  const configuredMaxAge = options.inventoryMaxAgeSeconds ??
    Number(process.env.INVENTORY_MAX_AGE_SECONDS ?? 86400);
  const inventoryMaxAgeSeconds =
    Number.isFinite(configuredMaxAge) && configuredMaxAge > 0 ? configuredMaxAge : 86400;

  function requireInventoryEvidenceAccess(authorization: string | undefined): void {
    if (!registryToken) {
      throw httpError(503, 'inventory_registry_auth_unconfigured');
    }
    if (!secureBearerMatches(authorization, registryToken)) {
      throw httpError(401, 'inventory_registry_auth_failed');
    }
  }

  app.register(helmet);
  app.register(cors, { origin: process.env.CORS_ORIGIN?.split(',') ?? true });
  app.register(rateLimit, { max: 250, timeWindow: '1 minute' });

  app.get('/health', async () => ({ status: 'ok', service: 'raeburnai-compliance-api' }));

  app.get('/v1/frameworks', async () => ({
    frameworks: ['eu_ai_act', 'gdpr', 'iso_42001', 'iso_27001', 'uk_ai_guidance']
  }));

  app.get('/v1/rules', async () => ({ rules }));

  app.post('/v1/assessments/run', async request => {
    const result = assessSystem(request.body);
    return { result, roadmap: buildRemediationRoadmap(result) };
  });

  app.post('/v1/inventory/release-snapshot', async request => {
    return { snapshot: buildReleaseInventorySnapshot(request.body) };
  });

  app.post('/v1/inventory/evidence', async (request, reply) => {
    requireInventoryEvidenceAccess(request.headers.authorization);
    const result = await evidenceStore.put(request.body);
    return reply.status(result.created ? 201 : 200).send(result);
  });

  app.get('/v1/inventory/evidence', async request => {
    requireInventoryEvidenceAccess(request.headers.authorization);
    return { evidence: await evidenceStore.list() };
  });

  app.get('/v1/inventory/evidence/:releaseId', async request => {
    requireInventoryEvidenceAccess(request.headers.authorization);
    const { releaseId } = z.object({ releaseId: z.string().min(1) }).parse(request.params);
    const evidence = await evidenceStore.get(releaseId);
    if (!evidence) throw httpError(404, 'inventory_evidence_not_found');
    return { evidence };
  });

  app.get('/v1/inventory/exceptions', async request => {
    requireInventoryEvidenceAccess(request.headers.authorization);
    const evidence = await evidenceStore.list();
    return {
      maxAgeSeconds: inventoryMaxAgeSeconds,
      exceptions: buildInventoryEvidenceExceptions(evidence, now(), inventoryMaxAgeSeconds)
    };
  });

  app.post('/v1/governance/release-applicability', async request => {
    return { snapshot: buildReleaseGovernanceApplicabilitySnapshot(request.body) };
  });

  app.get('/v1/openapi.json', async () => ({
    openapi: '3.1.0',
    info: { title: 'RaeburnAI Compliance Engine API', version: '0.1.0' },
    paths: {
      '/health': { get: { summary: 'Health check' } },
      '/v1/rules': { get: { summary: 'List compliance rules' } },
      '/v1/assessments/run': { post: { summary: 'Run AI compliance assessment' } },
      '/v1/inventory/release-snapshot': {
        post: { summary: 'Build a release-scoped AI system inventory and risk snapshot' }
      },
      '/v1/inventory/evidence': {
        get: { summary: 'List immutable authenticated release inventory evidence' },
        post: { summary: 'Persist an authenticated immutable release inventory snapshot' }
      },
      '/v1/inventory/evidence/{releaseId}': {
        get: { summary: 'Retrieve immutable release inventory evidence by release ID' }
      },
      '/v1/inventory/exceptions': {
        get: { summary: 'List stale or incomplete persisted inventory evidence exceptions' }
      },
      '/v1/governance/release-applicability': {
        post: {
          summary: 'Screen a release inventory for EU AI Act and UK AI governance applicability'
        }
      }
    }
  }));

  app.setErrorHandler((error, _request, reply) => {
    app.log.error(error);
    const candidate = error as { statusCode?: unknown };
    const statusCode = error instanceof ZodError
      ? 400
      : typeof candidate.statusCode === 'number' && candidate.statusCode >= 400
        ? candidate.statusCode
        : 500;
    const message = error instanceof Error ? error.message : 'Request failed';
    reply
      .status(statusCode)
      .send({ error: statusCode === 500 ? 'Internal server error' : message });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test') {
  const app = buildServer();
  app.listen({ port, host }).catch(error => {
    app.log.error(error);
    process.exit(1);
  });
}
