const express = require('express');
const helmet = require('helmet');
const crypto = require('node:crypto');
const cors = require('cors');
const pinoHttp = require('pino-http');
const rateLimit = require('express-rate-limit');
const sequelize = require('./config/database');
const env = require('./config/env');
const logger = require('./utils/logger');
const { registry, httpRequests, httpDuration } = require('./utils/metrics');
const errorHandler = require('./middleware/errorHandler');
const asyncHandler = require('./utils/asyncHandler');
const authRoutes = require('./modules/auth/auth.routes');
const doctorRoutes = require('./modules/doctors/doctors.routes');
const availabilityRoutes = require('./modules/availability/availability.routes');
const consultationRoutes = require('./modules/consultations/consultations.routes');
const prescriptionRoutes = require('./modules/prescriptions/prescriptions.routes');
const adminRoutes = require('./modules/analytics/analytics.routes');

const app = express();

app.disable('x-powered-by');
app.use(helmet());
const allowedOrigins = new Set(env.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean));
app.use(cors({
  origin: (origin, callback) => callback(null, !origin || allowedOrigins.has(origin)),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key'],
  maxAge: 600,
}));
app.use((req, res, next) => {
  req.id = crypto.randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
});
app.use(pinoHttp({
  logger,
  quietReqLogger: true,
  serializers: { req: (req) => ({ id: req.id, method: req.method, url: req.url.split('?')[0] }) },
  customProps: (req) => ({ requestId: req.id }),
}));
app.use(express.json({ limit: '1mb' }));
app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
}));

app.use((req, res, next) => {
  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const route = req.route ? `${req.baseUrl}${req.route.path}` : 'unmatched';
    const labels = { method: req.method, route, status_code: String(res.statusCode) };
    httpRequests.inc(labels);
    httpDuration.observe(labels, Number(process.hrtime.bigint() - startedAt) / 1e9);
  });
  next();
});

const ready = async (req, res) => {
  try {
    await sequelize.authenticate();
    return res.status(200).json({ success: true, data: { status: 'ready', database: 'connected' } });
  } catch {
    return res.status(503).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Service unavailable' },
      data: { status: 'not_ready' },
    });
  }
};

app.get('/health/live', (req, res) => res.json({ success: true, data: { status: 'alive' } }));
app.get('/health/ready', ready);
app.get('/api/v1/health', async (req, res) => {
  try {
    await sequelize.authenticate();
    return res.status(200).json({
      success: true,
      data: { status: 'ok', database: 'connected' },
    });
  } catch {
    return res.status(503).json({
      success: false,
      error: { code: 'DATABASE_UNAVAILABLE', message: 'Service unavailable' },
    });
  }
});

app.get('/metrics', async (req, res, next) => {
  if (!env.METRICS_TOKEN) return res.sendStatus(404);
  const supplied = Buffer.from((req.get('authorization') || '').replace(/^Bearer\s+/i, ''));
  const expected = Buffer.from(env.METRICS_TOKEN);
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
    return res.sendStatus(401);
  }
  try {
    res.set('Content-Type', registry.contentType);
    return res.send(await registry.metrics());
  } catch (error) {
    return next(error);
  }
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/doctors', doctorRoutes);
app.use('/api/v1/availability', availabilityRoutes);
app.use('/api/v1/consultations', consultationRoutes);
app.use('/api/v1/prescriptions', prescriptionRoutes);
app.use('/api/v1/admin', adminRoutes);

app.use((req, res) => {
  res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Route was not found', requestId: req.id } });
});
app.use(errorHandler);

module.exports = app;