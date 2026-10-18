import { relative, sep } from 'node:path';

export type SourceReferenceGraph = {
  nodes: Array<{
    introduced_in?: Array<{ doc?: unknown }>;
    used_in?: Array<{ doc?: unknown }>;
  }>;
  edges: Array<{ evidence?: Array<{ doc?: unknown }> }>;
};

export type SourceManifestEntry = {
  id: string;
  file: string;
  pages: number;
};

export type SourceDocument = {
  url: string;
  filename: string;
  pages: number;
  available: boolean;
  language?: 'zh-CN';
  pdfPages?: number;
  pageMap?: Record<string, number>;
};

export type SourceResolution = {
  documents: Record<string, SourceDocument>;
  summary: { referenced: number; available: number; missing: number };
  copied: Array<{ docId: string; source: string; filename: string }>;
  issues: Array<{ docId: string; kind: 'missing' | 'ambiguous'; candidates: string[] }>;
};

export function collectDocumentIds(graph: SourceReferenceGraph): string[] {
  const ids = new Set<string>();
  const add = (value: unknown) => {
    if (typeof value === 'string' && value.trim()) ids.add(value);
  };
  for (const node of graph.nodes) {
    for (const reference of node.introduced_in ?? []) add(reference.doc);
    for (const reference of node.used_in ?? []) add(reference.doc);
  }
  for (const edge of graph.edges) {
    for (const reference of edge.evidence ?? []) add(reference.doc);
  }
  return [...ids].sort((a, b) => a.localeCompare(b));
}

function normalizedRelativePath(root: string, file: string): string {
  return relative(root, file).split(sep).join('/').toLocaleLowerCase('en-US');
}

function sourceBasename(file: string): string {
  return file.split(/[\\/]/).at(-1) ?? '';
}

function expectedMigratedSuffix(file: string, materialRoots: Set<string>): string | undefined {
  // Manifest paths were recorded under Downloads. Locate the first path segment
  // that is also a direct migrated course/material folder, then retain the full
  // suffix from that folder to the PDF.
  const segments = file.replace(/\\/g, '/').split('/').filter(Boolean);
  const rootNames = new Set([...materialRoots].map((name) => name.toLocaleLowerCase('en-US')));
  const index = segments.findIndex((segment) => rootNames.has(segment.toLocaleLowerCase('en-US')));
  if (index < 0) return undefined;
  return segments.slice(index).join('/').toLocaleLowerCase('en-US');
}

export function resolveSourceDocuments(
  graph: SourceReferenceGraph,
  manifest: SourceManifestEntry[],
  materialRoot: string,
  pdfFiles: string[],
): SourceResolution {
  const ids = collectDocumentIds(graph);
  const entriesById = new Map<string, SourceManifestEntry[]>();
  for (const entry of manifest) entriesById.set(entry.id, [...(entriesById.get(entry.id) ?? []), entry]);

  const roots = new Set(
    pdfFiles.map((file) => relative(materialRoot, file).split(sep)[0]).filter(Boolean),
  );
  const filesBySuffix = new Map<string, string[]>();
  for (const file of pdfFiles) {
    const suffix = normalizedRelativePath(materialRoot, file);
    filesBySuffix.set(suffix, [...(filesBySuffix.get(suffix) ?? []), file]);
  }

  const documents: Record<string, SourceDocument> = {};
  const copied: SourceResolution['copied'] = [];
  const issues: SourceResolution['issues'] = [];
  for (const docId of ids) {
    const entries = entriesById.get(docId) ?? [];
    let candidates: string[] = [];
    const pages = entries.length === 1 ? entries[0].pages : 0;
    if (entries.length === 1) {
      const suffix = expectedMigratedSuffix(entries[0].file, roots);
      if (suffix) candidates = filesBySuffix.get(suffix) ?? [];
    }

    const source = candidates.length === 1 ? candidates[0] : undefined;
    const available = Boolean(source && entries.length === 1);
    const filename = source ? sourceBasename(source) : entries.length === 1 ? sourceBasename(entries[0].file) : '';
    documents[docId] = {
      // The physical filename is encoded once; encode it again for an HTTP URL.
      url: available ? `sources/${encodeURIComponent(`${encodeURIComponent(docId)}.pdf`)}` : '',
      filename,
      pages,
      available,
    };
    if (source && available) copied.push({ docId, source, filename });
    else {
      const kind = candidates.length > 1 || entries.length > 1 ? 'ambiguous' : 'missing';
      issues.push({ docId, kind, candidates: candidates.map((candidate) => relative(materialRoot, candidate)) });
    }
  }

  return {
    documents,
    summary: {
      referenced: ids.length,
      available: copied.length,
      missing: ids.length - copied.length,
    },
    copied,
    issues,
  };
}
