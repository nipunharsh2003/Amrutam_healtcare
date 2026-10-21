const { NodeSDK } = require('@opentelemetry/sdk-node');
const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
const env = require('./env');

let sdk;

function start() {
  if (!env.OTEL_EXPORTER_OTLP_ENDPOINT || sdk) return;
  const baseUrl = env.OTEL_EXPORTER_OTLP_ENDPOINT.replace(/\/$/, '');
  const sanitizeHttpRequest = (span, request) => {
    const path = String(request.url || request.path || '/')
      .split('?')[0]
      .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gi, ':id');
    span.updateName(`${request.method || 'HTTP'} ${path}`);
    span.setAttribute('url.full', path);
    span.setAttribute('url.path', path);
    span.setAttribute('url.query', '[REDACTED]');
    span.setAttribute('http.url', path);
    span.setAttribute('http.target', path);
  };
  sdk = new NodeSDK({
    traceExporter: new OTLPTraceExporter({ url: `${baseUrl}/v1/traces` }),
    instrumentations: [getNodeAutoInstrumentations({
      '@opentelemetry/instrumentation-fs': { enabled: false },
      '@opentelemetry/instrumentation-http': {
        requestHook: sanitizeHttpRequest,
        ignoreOutgoingRequestHook: (request) => request.host === 'otel-collector',
      },
    })],
  });
  sdk.start();
}

async function shutdown() {
  if (sdk) await sdk.shutdown();
}

module.exports = { start, shutdown };