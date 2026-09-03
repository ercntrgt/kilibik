import { buildApp } from './app.js';
import { LogOtpProvider } from './auth/otp.js';
import { loadConfig } from './config.js';
import { createPool } from './db.js';
import { runRetention } from './jobs/retention.js';
import { migrate } from './migrate.js';
import { createNotifier, createPushProvider } from './push/index.js';
import { createRedis } from './redis.js';

async function main() {
  const config = loadConfig();
  const db = createPool(config.databaseUrl);
  const redis = createRedis(config.redisUrl);
  await migrate(db);
  const app = await buildApp({
    config,
    db,
    redis,
    otp: new LogOtpProvider(),
    notify: createNotifier(db, createPushProvider(config)),
  });
  // Saklama süreleri: saatte bir (istekler 90 gün, silinen hesaplar 30 gün).
  const timer = setInterval(() => runRetention(db, config).catch((e) => app.log.error(e)), 60 * 60 * 1000);
  await runRetention(db, config);
  await app.listen({ port: config.port, host: '0.0.0.0' });
  const stop = async () => {
    clearInterval(timer);
    await app.close();
    await db.end();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', stop);
  process.on('SIGTERM', stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
