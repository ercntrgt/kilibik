import type { Db, Tx } from './db.js';

export interface ActivePair {
  id: string;
  partnerId: string;
  createdAt: Date;
}

export async function getActivePair(q: Db | Tx, userId: string): Promise<ActivePair | null> {
  const { rows } = await q.query<{ id: string; user_a_id: string; user_b_id: string; created_at: Date }>(
    `select id, user_a_id, user_b_id, created_at from pairs
     where dissolved_at is null and (user_a_id = $1 or user_b_id = $1) limit 1`,
    [userId],
  );
  const p = rows[0];
  if (!p) return null;
  return { id: p.id, partnerId: p.user_a_id === userId ? p.user_b_id : p.user_a_id, createdAt: p.created_at };
}

/** Eşleşmeyi sonlandırır ve eşleşmeye ait tüm istekleri siler. */
export async function dissolvePair(tx: Tx, pairId: string): Promise<void> {
  await tx.query('delete from requests where pair_id = $1', [pairId]);
  await tx.query('update pairs set dissolved_at = now() where id = $1 and dissolved_at is null', [pairId]);
}
