import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { FastifyInstance } from 'fastify';
import { LOCATION_CONSENT_VERSION, PRIVACY_NOTICE_VERSION } from '../../../shared/src/index.js';

const docsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'docs', 'compliance');

const DOCS: Record<string, { file: string; version: number }> = {
  'privacy-notice': { file: 'aydinlatma-metni.md', version: PRIVACY_NOTICE_VERSION },
  'location-consent': { file: 'acik-riza-metni.md', version: LOCATION_CONSENT_VERSION },
  'privacy-policy': { file: 'gizlilik-politikasi.md', version: 1 },
  retention: { file: 'veri-saklama-tablosu.md', version: 1 },
};

/** Uyum metinleri uygulama içinden erişilebilir (kimlik doğrulama gerektirmez). */
export async function legalRoutes(app: FastifyInstance) {
  app.get('/legal', async () => ({
    documents: Object.entries(DOCS).map(([slug, d]) => ({ slug, version: d.version })),
  }));
  app.get('/legal/:slug', async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const d = DOCS[slug];
    if (!d) return reply.code(404).send({ error: 'not_found' });
    const body = await readFile(path.join(docsDir, d.file), 'utf8');
    return reply.header('content-type', 'text/markdown; charset=utf-8').header('x-document-version', String(d.version)).send(body);
  });
}
