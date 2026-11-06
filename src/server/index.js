import '../lib/loadEnv.js';
import { createApp } from './app.js';
import { connectDb, disconnectDb } from '../lib/db.js';
import { log } from '../lib/log.js';

const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  if (process.env.DEMO_MODE !== 'true') {
    throw new Error('Refusing to start: set DEMO_MODE=true for the public Parivar Demo deployment.');
  }
  if (!process.env.MONGO_URI) throw new Error('MONGO_URI is required and must point to the separate demo database.');
  if (!process.env.AUTH_JWT_SECRET || process.env.AUTH_JWT_SECRET.length < 32) {
    throw new Error('AUTH_JWT_SECRET must be a unique random secret of at least 32 characters.');
  }
  if (!process.env.DEMO_FID || !process.env.DEMO_MEMBER_ID) {
    throw new Error('DEMO_FID and DEMO_MEMBER_ID are required.');
  }

  await connectDb(process.env.MONGO_URI);
  log.ok('Connected to the dedicated demo database');

  const app = createApp();
  const server = app.listen(PORT, () => {
    log.ok(`Parivar Demo API listening on port ${PORT}`);
    log.dim('  GET  /api/health');
    log.dim('  POST /api/auth/demo-session');
    log.dim('  GET  /api/auth/me');
    log.dim('  GET  /api/families/:fid/members');
  });

  const shutdown = async (signal) => {
    log.info(`Received ${signal}, shutting down`);
    server.close(async () => {
      await disconnectDb();
      log.ok('Closed cleanly');
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

main().catch((err) => {
  log.err(err.message);
  if (process.env.DEBUG) console.error(err);
  process.exit(1);
});
