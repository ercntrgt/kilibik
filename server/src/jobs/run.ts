import { loadConfig } from '../config.js';
import { createPool } from '../db.js';
import { runRetention } from './retention.js';

const config = loadConfig();
const db = createPool(config.databaseUrl);
runRetention(db, config)
  .then((r) => {
    console.log(`retention: ${r.requests} request(s), ${r.users} user(s) purged`);
    return db.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
