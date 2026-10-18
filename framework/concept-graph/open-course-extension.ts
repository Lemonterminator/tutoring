import { parseGraph, type ConceptGraphData, type ConceptNode, type SourceLocation } from './model';

export type OpenCourseExtension = {
  version: 1;
  nodes: ConceptNode[];
  edges: ConceptGraphData['edges'];
  memberships: Array<{ id: string; courses: string[]; locations: SourceLocation[] }>;
  documents: Record<string, { url: string; filename: string; pages: number; available: boolean; sourceFolder: 'open-sources' }>;
  summary: { courses: number; topics: number; matchedConcepts: number };
};

/** Add sourced course coverage while preserving the original prerequisite graph. */
export function mergeOpenCourses(base: ConceptGraphData, extension?: OpenCourseExtension): ConceptGraphData {
  if (!extension) return base;
  if (extension.version !== 1 || !Array.isArray(extension.memberships) || !extension.documents) throw new Error('公开课增量索引格式无效。');
  const nodes = base.nodes.map((node) => ({ ...node, courses: [...node.courses], used_in: [...node.used_in] }));
  const index = new Map(nodes.map((node) => [node.id, node]));
  for (const extra of extension.nodes) {
    if (index.has(extra.id)) throw new Error(`公开课节点 ID 冲突：${extra.id}`);
    const node = { ...extra, courses: [...extra.courses], used_in: [...extra.used_in] };
    nodes.push(node); index.set(node.id, node);
  }
  for (const membership of extension.memberships) {
    const node = index.get(membership.id);
    if (!node) throw new Error(`公开课引用的概念不存在：${membership.id}`);
    node.courses = [...new Set([...node.courses, ...membership.courses])];
    node.used_in.push(...membership.locations);
  }
  const edges = [...base.edges, ...extension.edges];
  const degrees = new Map(nodes.map((node) => [node.id, 0]));
  for (const edge of edges) {
    degrees.set(edge.src, (degrees.get(edge.src) ?? 0) + 1);
    degrees.set(edge.dst, (degrees.get(edge.dst) ?? 0) + 1);
  }
  for (const node of nodes) node.degree = degrees.get(node.id) ?? 0;
  return parseGraph({ nodes, edges });
}
