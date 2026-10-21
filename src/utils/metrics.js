const promClient = require('prom-client');

const registry = new promClient.Registry();
promClient.collectDefaultMetrics({ register: registry });

const httpRequests = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests completed',
  labelNames: ['method', 'route', 'status_code'],
  registers: [registry],
});

const httpDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.01, 0.025, 0.05, 0.1, 0.2, 0.5, 1, 2, 5],
  registers: [registry],
});

module.exports = { registry, httpRequests, httpDuration };