import { createHash } from 'node:crypto';
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceRoot = resolve(process.env.QUANT_METRICS_ROOT ?? join(root, '..', '..', '..', 'Mie_Postprocessing_Py', 'Thesis', 'regression_eval_study'));
const destination = join(root, 'public', 'quant-materials', 'regression-metrics');
const expectedSections = ['sec0', 'sec1', 'sec2', 'sec3', 'sec4', 'sec5', 'sec6', 'sec7', 'sec7b', 'sec8', 'sec9', 'sec10', 'sec11', 'sec11b', 'sec11c', 'sec12', 'sec13'];
const inputs = ['en', 'zh'].map((language) => {
  const filename = `metrics_derivations_${language}.html`;
  const source = join(sourceRoot, filename);
  const bytes = readFileSync(source);
  const html = bytes.toString('utf8');
  const sections = [...html.matchAll(/<h2\b[^>]*id="([^"]+)"/g)].map((match) => match[1]);
  const canvases = [...html.matchAll(/<canvas\b[^>]*id="([^"]+)"/g)].map((match) => match[1]);
  if (sections.join(',') !== expectedSections.join(',') || canvases.length !== 15) {
    throw new Error(`${filename}: source chapters/experiments changed; review the integration before syncing.`);
  }
  return { language, filename, source, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), sections, canvases };
});
if (inputs[0].canvases.join(',') !== inputs[1].canvases.join(',')) throw new Error('EN/ZH experiment IDs differ.');
mkdirSync(destination, { recursive: true });
for (const item of inputs) copyFileSync(item.source, join(destination, item.filename));
writeFileSync(join(destination, 'source-index.json'), JSON.stringify({ generatedAt: new Date().toISOString(), documents: inputs }, null, 2));
console.log('Synced EN/ZH regression-to-risk materials: 17 sections and 15 experiments per language. Original files unchanged.');
