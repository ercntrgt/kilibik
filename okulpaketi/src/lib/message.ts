/**
 * Template metni ve Meta Cloud API parametre kurgusu.
 * Metin Meta tarafinda onayli sablonla birebir ayni olmalidir; buradaki metin
 * yalnizca panel onizlemesi icindir.
 */

export type TemplateParams = {
  aliciTipi: string;      // {{1}} -> ogrencimiz / velimiz
  setAdi: string;         // {{2}}
  teslimTarihi: string;   // {{3}}
  teslimSaati: string;    // {{4}}
  teslimNoktasi: string;  // {{5}}
};

export const TEMPLATE_BODY =
  'Merhaba değerli {{1}},\n\n' +
  'Sitemiz üzerinden satın almış olduğunuz {{2}} setinizi, {{3}} tarihinde ' +
  '{{4}} saatleri arasında {{5}} adresinden teslim alabilirsiniz.\n\n' +
  'İyi günler dileriz.\n\n' +
  'AtlasELT – OkulPaketi';

/** Parametre sirasi Meta sablonundaki {{1}}..{{5}} ile ayni olmak zorundadir. */
export function templateParamList(p: TemplateParams): string[] {
  return [p.aliciTipi, p.setAdi, p.teslimTarihi, p.teslimSaati, p.teslimNoktasi];
}

/** Panelde gosterilen onizleme metni. */
export function buildPreviewText(p: TemplateParams): string {
  return templateParamList(p).reduce<string>(
    (text, value, index) => text.replaceAll(`{{${index + 1}}}`, value || `{{${index + 1}}}`),
    TEMPLATE_BODY,
  );
}

/**
 * WhatsApp sablon parametreleri satir sonu, sekme veya 4+ ardisik bosluk
 * iceremez (Meta hatasi #132000/#132012). Degeri guvenli hale getirir.
 */
export function sanitizeParam(value: string): string {
  return String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s{4,}/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const MAX_PARAM_LENGTH = 1024;
