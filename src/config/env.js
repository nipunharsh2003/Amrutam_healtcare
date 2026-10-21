const dotenv = require('dotenv');
const { z } = require('zod');

dotenv.config({ quiet: true });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().min(1),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_NAME: z.string().min(1),
  TEST_DB_NAME: z.string().min(1).optional(),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  JWT_SECRET: z.string().min(32),
  APP_ENCRYPTION_KEY: z.string().regex(/^[a-fA-F0-9]{64}$/),
  METRICS_TOKEN: z.string().min(32).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().url().optional(),
  ),
  CORS_ORIGINS: z.string().default(''),
  OUTBOX_WEBHOOK_URL: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.string().url().optional(),
  ),
  OUTBOX_WEBHOOK_TOKEN: z.string().min(32).optional(),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
});

const parsedEnv = envSchema.superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.METRICS_TOKEN) {
    context.addIssue({ code: 'custom', path: ['METRICS_TOKEN'], message: 'Required in production' });
  }
  if (value.NODE_ENV === 'production' && !value.OTEL_EXPORTER_OTLP_ENDPOINT) {
    context.addIssue({ code: 'custom', path: ['OTEL_EXPORTER_OTLP_ENDPOINT'], message: 'Required in production' });
  }
  if (value.NODE_ENV === 'production' && !value.CORS_ORIGINS.trim()) {
    context.addIssue({ code: 'custom', path: ['CORS_ORIGINS'], message: 'Explicit allowed origins required in production' });
  }
  if (Boolean(value.OUTBOX_WEBHOOK_URL) !== Boolean(value.OUTBOX_WEBHOOK_TOKEN)) {
    context.addIssue({ code: 'custom', path: ['OUTBOX_WEBHOOK_TOKEN'], message: 'Configure both webhook URL and token, or neither' });
  }
  if (value.NODE_ENV === 'production' && value.OUTBOX_WEBHOOK_URL && new URL(value.OUTBOX_WEBHOOK_URL).protocol !== 'https:') {
    context.addIssue({ code: 'custom', path: ['OUTBOX_WEBHOOK_URL'], message: 'HTTPS is required in production' });
  }
  if (value.NODE_ENV === 'test' && !value.TEST_DB_NAME) {
    context.addIssue({ code: 'custom', path: ['TEST_DB_NAME'], message: 'Required in test' });
  }
}).safeParse(process.env);

if (!parsedEnv.success) {
  const details = parsedEnv.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid environment configuration: ${details}`);
}

module.exports = parsedEnv.data;