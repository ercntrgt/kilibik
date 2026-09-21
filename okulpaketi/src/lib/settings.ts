import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';

export type SendMode = 'test' | 'live';

export type AppSettings = {
  templateName: string;
  templateLanguage: string;
  sendMode: SendMode;
  testPhoneE164: string | null;
  batchSize: number;
  throttlePerSecond: number;
  dedupeWindowHours: number;
  updatedAt: string | null;
};

const DEFAULTS: AppSettings = {
  templateName: 'set_teslim_bildirimi',
  templateLanguage: 'tr',
  sendMode: 'test',
  testPhoneE164: null,
  batchSize: 50,
  throttlePerSecond: 15,
  dedupeWindowHours: 24,
  updatedAt: null,
};

type SettingsRow = {
  template_name: string | null;
  template_language: string | null;
  send_mode: SendMode | null;
  test_phone_e164: string | null;
  batch_size: number | null;
  throttle_per_second: number | null;
  dedupe_window_hours: number | null;
  updated_at: string | null;
};

export async function getSettings(supabase: SupabaseClient): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('settings')
    .select('template_name, template_language, send_mode, test_phone_e164, batch_size, throttle_per_second, dedupe_window_hours, updated_at')
    .eq('id', true)
    .maybeSingle<SettingsRow>();

  if (error || !data) return DEFAULTS;

  return {
    templateName: data.template_name || DEFAULTS.templateName,
    templateLanguage: data.template_language || DEFAULTS.templateLanguage,
    sendMode: data.send_mode ?? DEFAULTS.sendMode,
    testPhoneE164: data.test_phone_e164,
    batchSize: data.batch_size ?? DEFAULTS.batchSize,
    throttlePerSecond: data.throttle_per_second ?? DEFAULTS.throttlePerSecond,
    dedupeWindowHours: data.dedupe_window_hours ?? DEFAULTS.dedupeWindowHours,
    updatedAt: data.updated_at,
  };
}
