export const MESSAGE_STATUS_LABELS: Record<string, string> = {
  pending: 'Bekliyor',
  processing: 'Gönderiliyor',
  sent: 'Gönderildi',
  delivered: 'Teslim edildi',
  read: 'Okundu',
  failed: 'Başarısız',
};

export const RECIPIENT_STATUS_LABELS: Record<string, string> = {
  valid: 'Geçerli',
  invalid: 'Hatalı',
  duplicate: 'Dosyada tekrar',
  duplicate_previous: 'Daha önce gönderildi',
};

export const CAMPAIGN_STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  ready: 'Gönderime hazır',
  sending: 'Gönderiliyor',
  paused: 'Duraklatıldı',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
};

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
    timeZone: 'Europe/Istanbul',
  }).format(date);
}

export function formatNumber(value: number | null | undefined): string {
  return new Intl.NumberFormat('tr-TR').format(value ?? 0);
}

export function percent(part: number, total: number): string {
  if (!total) return '%0';
  return `%${Math.round((part / total) * 100)}`;
}
