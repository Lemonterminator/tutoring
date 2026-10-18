import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createForceLayout } from '../framework/concept-graph/layout';
import { graphSignature, parseGraph } from '../framework/concept-graph/model';
import { resolveSourceDocuments, type SourceManifestEntry } from './concept-sources';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const source = process.env.CONCEPT_GRAPH_ROOT ?? resolve(repoRoot, '../../../Long Way to Quant/Learning Materials/concept_graph');
const materialsRoot = resolve(process.env.CONCEPT_MATERIALS_ROOT ?? resolve(repoRoot, '..'));
const destination = join(repoRoot, 'public', 'concept-graph');
const graphFile = join(source, 'graph', 'graph.json');
const graphBytes = readFileSync(graphFile);
const graph = parseGraph(JSON.parse(graphBytes.toString('utf8')));
const manifest = JSON.parse(readFileSync(join(source, 'manifest.json'), 'utf8')) as SourceManifestEntry[];
const solver = createForceLayout(graph);
solver.step(260);
mkdirSync(destination, { recursive: true });
// Preserve the original bytes and every source field. Generated assets stay local and Git-ignored.
copyFileSync(graphFile, join(destination, 'graph.json'));
copyFileSync(join(source, 'manifest.json'), join(destination, 'manifest.json'));
writeFileSync(join(destination, 'layout.json'), JSON.stringify({ signature: graphSignature(graph), positions: solver.positions() }));
writeFileSync(join(destination, 'provenance.json'), JSON.stringify({
  source: graphFile,
  sha256: createHash('sha256').update(graphBytes).digest('hex'),
  nodes: graph.nodes.length,
  edges: graph.edges.length,
  generatedAt: new Date().toISOString(),
}, null, 2));

function findPdfs(directory: string): string[] {
  const found: string[] = [];
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = join(directory, item.name);
    if (item.isDirectory() && fullPath !== repoRoot && !['.git', 'node_modules', 'dist', '__pycache__'].includes(item.name)) found.push(...findPdfs(fullPath));
    else if (item.isFile() && item.name.toLocaleLowerCase('en-US').endsWith('.pdf')) found.push(fullPath);
  }
  return found.sort((a, b) => a.localeCompare(b));
}

const sourcePdfs = findPdfs(materialsRoot);
const resolved = resolveSourceDocuments(graph, manifest, materialsRoot, sourcePdfs);
const sourceDirectory = join(destination, 'sources');
mkdirSync(sourceDirectory, { recursive: true });
const translatedDocId = 'MS-C1620__TPP_TMP_luennot';
const translatedRoot = join(materialsRoot, 'MS-C1620_Statistical_Inference', 'Chinese_Textbook', 'output', 'pdf');
const translationIndex = join(translatedRoot, 'probability-statistics-zh.source-pages.json');
const translatedPdf = join(translatedRoot, 'probability-statistics-zh.pdf');
const translatedName = `${encodeURIComponent(translatedDocId)}.zh.pdf`;
let hasTranslation = false;
if (existsSync(translationIndex)) {
  const translation = JSON.parse(readFileSync(translationIndex, 'utf8')) as {
    documentId: string; language: string; displayFilename: string; sourcePages: number;
    pdfPages: number; sha256: string; pageMap: Record<string, number>;
  };
  const original = resolved.documents[translatedDocId];
  if (!original?.available || translation.documentId !== translatedDocId || translation.language !== 'zh-CN'
    || translation.sourcePages !== original.pages || !Number.isInteger(translation.pdfPages) || translation.pdfPages < 1
    || typeof translation.displayFilename !== 'string' || !translation.pageMap
    || Object.keys(translation.pageMap).length !== original.pages
    || Array.from({ length: original.pages }, (_, index) => translation.pageMap[String(index + 1)])
      .some((page) => !Number.isInteger(page) || page < 1 || page > translation.pdfPages)
    || createHash('sha256').update(readFileSync(translatedPdf)).digest('hex') !== translation.sha256) {
    throw new Error('Chinese textbook PDF/page map is missing, stale, or invalid. Republish the textbook before syncing.');
  }
  resolved.documents[translatedDocId] = {
    ...original, url: `sources/${encodeURIComponent(translatedName)}`,
    filename: translation.displayFilename, language: 'zh-CN',
    pdfPages: translation.pdfPages, pageMap: translation.pageMap,
  };
  hasTranslation = true;
}
const expectedSourceNames = new Set(resolved.copied.map(({ docId }) => `${encodeURIComponent(docId)}.pdf`));
if (hasTranslation) expectedSourceNames.add(translatedName);
for (const item of readdirSync(sourceDirectory, { withFileTypes: true })) {
  if (item.isFile() && item.name.toLocaleLowerCase('en-US').endsWith('.pdf') && !expectedSourceNames.has(item.name)) {
    unlinkSync(join(sourceDirectory, item.name));
  }
}
let copiedBytes = 0;
for (const item of resolved.copied) {
  const target = join(sourceDirectory, `${encodeURIComponent(item.docId)}.pdf`);
  copyFileSync(item.source, target);
  const sourceStat = statSync(item.source);
  copiedBytes += sourceStat.size;
}
if (hasTranslation) {
  copyFileSync(translatedPdf, join(sourceDirectory, translatedName));
  copiedBytes += statSync(translatedPdf).size;
  console.log(`Chinese textbook is the default for ${translatedDocId}; original page links use the translated PDF page map.`);
}
writeFileSync(join(destination, 'sources.json'), JSON.stringify({
  documents: resolved.documents,
  summary: resolved.summary,
}, null, 2));

console.log(`Synced ${graph.nodes.length} nodes and ${graph.edges.length} edges; copied ${resolved.summary.available}/${resolved.summary.referenced} referenced PDFs (${copiedBytes} bytes). Source data was not modified.`);
for (const issue of resolved.issues) {
  const detail = issue.candidates.length ? `: ${issue.candidates.join(', ')}` : '';
  console.warn(`Source ${issue.kind}: ${issue.docId}${detail}`);
}
async function hashFile(file: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
if (resolved.copied.length) {
  const hashes = await Promise.all(resolved.copied.map(async ({ docId }) => ({
    docId,
    sha256: await hashFile(join(sourceDirectory, hasTranslation && docId === translatedDocId ? translatedName : `${encodeURIComponent(docId)}.pdf`)),
    ...(hasTranslation && docId === translatedDocId ? {
      language: 'zh-CN', originalSha256: await hashFile(join(sourceDirectory, `${encodeURIComponent(docId)}.pdf`)),
    } : {}),
  })));
  writeFileSync(join(destination, 'sources.sha256.json'), JSON.stringify(hashes, null, 2));
  console.log(`Wrote ${hashes.length} source SHA-256 hashes to sources.sha256.json.`);
}
