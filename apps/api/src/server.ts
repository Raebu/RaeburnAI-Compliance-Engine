import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import { ZodError } from 'zod';
import {
  assessSystem,
  buildReleaseInventorySnapshot,
  buildRemediationRoadmap,
  rules
} from '@raeburnai/compliance-core';

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? '0.0.0.0';

export function buildServer() {
  const app = Fastify({ logger: true });

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

  app.get('/v1/openapi.json', async () => ({
    openapi: '3.1.0',
    info: { title: 'RaeburnAI Compliance Engine API', version: '0.1.0' },
    paths: {
      '/health': { get: { summary: 'Health check' } },
      '/v1/rules': { get: { summary: 'List compliance rules' } },
      '/v1/assessments/run': { post: { summary: 'Run AI compliance assessment' } },
      '/v1/inventory/release-snapshot': {
        post: { summary: 'Build a release-scoped AI system inventory and risk snapshot' }
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
