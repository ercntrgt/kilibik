import type { Config } from '../config.js';
import type { Db } from '../db.js';

/**
 * Saklama süreleri (docs/compliance/veri-saklama-tablosu.md):
 * - istekler: 90 gün sonra silinir
 * - silinen hesaplar: 30 gün içinde fiziksel olarak temizlenir
 * Konum için iş yoktur: Redis TTL kendiliğinden siler.
 */
export async function runRetention(db: Db, config: Config): Promise<{ requests: number; users: number }> {
  const r = await db.query(`delete from requests where created_at < now() - ($1 || ' days')::interval`, [String(config.requestRetentionDays)]);
  const u = await db.query(`delete from users where deleted_at is not null and deleted_at < now() - ($1 || ' days')::interval`, [String(config.accountPurgeDays)]);
  return { requests: r.rowCount ?? 0, users: u.rowCount ?? 0 };
}
