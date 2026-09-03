import { createRequire } from 'node:module';
import { defineConfig } from 'vitest/config';

const require = createRequire(import.meta.url);

export default defineConfig({
  resolve: {
    alias: {
      // libsodium-wrappers 0.7.16 ESM girişi eksik bir dosyaya işaret ediyor; CJS derlemesini kullan.
      'libsodium-wrappers': require.resolve('libsodium-wrappers'),
    },
  },
  test: {
    include: ['test/**/*.test.ts'],
    // Testler gerçek Postgres + Redis kullanır; paylaşılan veritabanı için sıralı çalışır.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 30000,
  },
});
