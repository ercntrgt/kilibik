/** Excel/CSV baslik eslestirme: kucuk yazim farkliliklarina dayanikli. */

export const CANONICAL_FIELDS = [
  'telefon',
  'alici_tipi',
  'set_adi',
  'teslim_tarihi',
  'teslim_saati',
  'teslim_noktasi',
] as const;

export type CanonicalField = (typeof CANONICAL_FIELDS)[number];

export const FIELD_LABELS: Record<CanonicalField, string> = {
  telefon: 'Telefon',
  alici_tipi: 'Alıcı Tipi',
  set_adi: 'Set Adı',
  teslim_tarihi: 'Teslim Tarihi',
  teslim_saati: 'Teslim Saati',
  teslim_noktasi: 'Teslim Noktası',
};

/** Alan basina kabul edilen baslik yazimlari (normalize edilmis halleriyle karsilastirilir). */
const ALIASES: Record<CanonicalField, string[]> = {
  telefon: [
    'telefon', 'telefonno', 'telefonnumarasi', 'telefonnumara', 'telno', 'tel',
    'ceptelefonu', 'ceptelefonno', 'cep', 'cepno', 'gsm', 'gsmno', 'numara',
    'mobil', 'mobiltelefon', 'phone', 'phonenumber', 'msisdn', 'whatsapp', 'whatsappno',
  ],
  alici_tipi: [
    'alicitipi', 'alicitip', 'alici', 'hitap', 'tip', 'kime', 'unvan',
    'velimiogrencimi', 'ogrencivelidurumu', 'alicituru', 'tur', 'recipienttype',
  ],
  set_adi: [
    'setadi', 'set', 'setismi', 'kitap', 'kitapadi', 'kitapismi', 'urun', 'urunadi',
    'setkitap', 'setkitapadi', 'paket', 'paketadi', 'siparis', 'siparisadi', 'product', 'productname',
  ],
  teslim_tarihi: [
    'teslimtarihi', 'teslimtarih', 'tarih', 'teslimattarihi', 'teslimgunu', 'gun', 'date', 'deliverydate',
  ],
  teslim_saati: [
    'teslimsaati', 'teslimsaat', 'saat', 'saataraligi', 'teslimsaataraligi',
    'teslimataraligi', 'saatler', 'time', 'deliverytime', 'timeslot',
  ],
  teslim_noktasi: [
    'teslimnoktasi', 'teslimnokta', 'nokta', 'teslimyeri', 'teslimadresi', 'teslimatnoktasi',
    'adres', 'lokasyon', 'okul', 'kampus', 'sube', 'location', 'deliverypoint', 'address',
  ],
};

const TR_FOLD: Record<string, string> = {
  ç: 'c', Ç: 'c', ğ: 'g', Ğ: 'g', ı: 'i', I: 'i', İ: 'i', i: 'i',
  ö: 'o', Ö: 'o', ş: 's', Ş: 's', ü: 'u', Ü: 'u', â: 'a', Â: 'a', î: 'i', û: 'u',
};

/** "Cep Telefonu No." -> "ceptelefonuno" */
export function normalizeHeader(header: string): string {
  return String(header ?? '')
    .split('')
    .map((ch) => TR_FOLD[ch] ?? ch)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

export type HeaderMapping = {
  /** alan -> kolon indeksi */
  mapping: Partial<Record<CanonicalField, number>>;
  /** eslestirilemeyen basliklar */
  unmatched: string[];
  /** bulunamayan zorunlu alanlar */
  missing: CanonicalField[];
};

export function mapHeaders(headers: unknown[]): HeaderMapping {
  const mapping: Partial<Record<CanonicalField, number>> = {};
  const unmatched: string[] = [];

  headers.forEach((header, index) => {
    const raw = String(header ?? '').trim();
    if (!raw) return;
    const key = normalizeHeader(raw);
    if (!key) return;

    const field = CANONICAL_FIELDS.find((f) => {
      if (mapping[f] !== undefined) return false;
      const aliases = ALIASES[f];
      if (aliases.includes(key)) return true;
      // "telefon_no_1" gibi ekli yazimlar icin gevsek eslesme
      return aliases.some((alias) => alias.length >= 5 && key.startsWith(alias));
    });

    if (field) mapping[field] = index;
    else unmatched.push(raw);
  });

  const missing = CANONICAL_FIELDS.filter((f) => mapping[f] === undefined);
  return { mapping, unmatched, missing };
}
