import { describe, expect, it } from 'vitest';
import { buildPreviewText, sanitizeParam, templateParamList } from '@/lib/message';

const params = {
  aliciTipi: 'velimiz',
  setAdi: 'Speakout B1+',
  teslimTarihi: '25.09.2026',
  teslimSaati: '10:00-16:00',
  teslimNoktasi: 'Denizli Koleji Ana Kampüs',
};

describe('şablon mesajı', () => {
  it('parametre sırası Meta şablonuyla aynıdır', () => {
    expect(templateParamList(params)).toEqual([
      'velimiz', 'Speakout B1+', '25.09.2026', '10:00-16:00', 'Denizli Koleji Ana Kampüs',
    ]);
  });

  it('önizleme metnini beklenen şekilde üretir', () => {
    expect(buildPreviewText(params)).toBe(
      'Merhaba değerli velimiz,\n\n' +
      'Sitemiz üzerinden satın almış olduğunuz Speakout B1+ setinizi, 25.09.2026 tarihinde ' +
      '10:00-16:00 saatleri arasında Denizli Koleji Ana Kampüs adresinden teslim alabilirsiniz.\n\n' +
      'İyi günler dileriz.\n\n' +
      'AtlasELT – OkulPaketi',
    );
  });

  it('satır sonu ve fazla boşlukları temizler', () => {
    expect(sanitizeParam('Ana\tKampüs\n  Giriş     Kapısı')).toBe('Ana Kampüs Giriş Kapısı');
  });
});
