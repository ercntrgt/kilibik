import pg from 'pg';
import { loadConfig } from './config.js';
import { migrate } from './migrate.js';

const pool = new pg.Pool({ connectionString: loadConfig().databaseUrl });
migrate(pool)
  .then((a) => {
    console.log(a.length ? `applied: ${a.join(', ')}` : 'up to date');
    return pool.end();
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
