import { serve } from '@hono/node-server';
import { Hono } from 'hono';

const bootTimeMs = Date.now();
const bootTimeIso = new Date(bootTimeMs).toISOString();
let requestCount = 0;

const app = new Hono();

app.get('/', (c) => {
  requestCount += 1;
  return c.json({
    message: 'Hello from hono-lambda-oci-sample',
    pid: process.pid,
    bootTime: bootTimeIso,
    uptimeMs: Date.now() - bootTimeMs,
    requestCount,
    awsExecutionEnv: process.env.AWS_EXECUTION_ENV ?? null,
    awsLambdaFunctionName: process.env.AWS_LAMBDA_FUNCTION_NAME ?? null,
    awsRegion: process.env.AWS_REGION ?? null,
  });
});

app.get('/healthz', (c) => c.text('ok'));

const port = Number(process.env.PORT ?? 8080);
serve({ fetch: app.fetch, port });
console.log(`listening on :${port}`);
