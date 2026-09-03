# Kilibik — ajan notları

- Önce `docs/RED_LINES.md` oku. Oradaki 9 madde pazarlığa kapalıdır; çakışan bir istek gelirse uygulama, gerekçesiyle raporla.
- Sunucu kördür: konum/istek içeriği asla düz metin olarak sunucuya gelmez, loglanmaz, kalıcı tabloya yazılmaz. Konum için tablo eklemek yasaktır.
- `responded_at` ve hız sınırı sayaçları hiçbir yerde toplulaştırılmaz/raporlanmaz.
- `PUT /sharing` ve rıza geri alma yolları `notify()` çağırmaz.
- Push payload'ı yalnızca `kind` taşır.
- Testler gerçek Postgres + Redis ister: `npm test` (bkz. `docs/TESTING.md`). `server/test/redlines.test.ts` kabul kriterlerini kanıtlar; yeni özellik eklerken kırmızı olmamalı.
- Mobil saf mantık `mobile/src/logic/` altındadır ve sunucu test paketinde test edilir.
- Uyum metinleri `docs/compliance/` altında; sürüm değişirse `shared/src/constants.ts` içindeki sürüm sabitlerini artır.
