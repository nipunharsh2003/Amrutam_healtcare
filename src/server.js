const telemetry = require('./config/telemetry');
telemetry.start();

const app = require('./app');
const sequelize = require('./config/database');
const env = require('./config/env');
const logger = require('./utils/logger');

async function startServer() {
  try {
    const server = app.listen(env.PORT, () => {
      logger.info({ port: env.PORT }, 'API listening');
    });

    const shutdown = async () => {
      server.close(async (error) => {
        if (error) logger.error({ err: error }, 'HTTP server shutdown failed');
        await sequelize.close().catch((closeError) => logger.error({ err: closeError }, 'Database shutdown failed'));
        await telemetry.shutdown().catch((traceError) => logger.error({ err: traceError }, 'Telemetry shutdown failed'));
        process.exitCode = error ? 1 : 0;
      });
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    logger.fatal({ err: error }, 'Unable to start API server');
    process.exitCode = 1;
  }
}

startServer();