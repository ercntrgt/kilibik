import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export function dedupeKey(phone: string, setAdi: string, tarih: string): string {
  return `${phone}|${setAdi.toLocaleLowerCase('tr')}|${tarih}`;
}

type RecentRow = {
  phone_e164: string | null;
  set_adi: string | null;
  teslim_tarihi: string | null;
};

/**
 * Yakin gecmiste ayni numaraya ayni set + tarih ile basarili mesaj gitmis mi?
 * Ayni dosyanin yanlislikla iki kez yuklenmesini engeller.
 */
export async function findRecentlySent(
  supabase: SupabaseClient,
  phones: string[],
  windowHours: number,
): Promise<Set<string>> {
  const found = new Set<string>();
  if (windowHours <= 0 || phones.length === 0) return found;

  const cutoff = new Date(Date.now() - windowHours * 3600_000).toISOString();
  const unique = [...new Set(phones)];
  const CHUNK = 400;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data, error } = await supabase
      .from('recipients')
      .select('phone_e164, set_adi, teslim_tarihi, messages!inner(status, sent_at)')
      .in('phone_e164', chunk)
      .in('messages.status', ['sent', 'delivered', 'read'])
      .gte('messages.sent_at', cutoff);

    if (error) throw new Error(`Tekrar kontrolü başarısız: ${error.message}`);

    for (const row of (data ?? []) as RecentRow[]) {
      if (!row.phone_e164) continue;
      found.add(dedupeKey(row.phone_e164, row.set_adi ?? '', row.teslim_tarihi ?? ''));
    }
  }

  return found;
}
