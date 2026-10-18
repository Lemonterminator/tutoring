/** Source field names are preserved so a regenerated graph can replace graph.json. */
export type SourceLocation = { course: string; doc: string; pages: number[] };
export type ConceptNode = {
  id: string;
  name: string;
  aliases_en: string[];
  aliases_fi: string[];
  aliases_zh: string[];
  definition: string;
  courses: string[];
  introduced_in: SourceLocation[];
  used_in: SourceLocation[];
  prereq_depth: number;
  root: boolean;
  degree: number;
  status: 'auto' | 'needs_review';
  notes?: string;
  facets?: string[];
  origin?: string;
  kind?: 'course' | 'course_topic';
};
export type Evidence = { doc: string; page?: number; quote?: string; note?: string; verified?: boolean };
export type ConceptEdge = {
  src: string;
  dst: string;
  rel: string;
  confidence: number;
  support: number;
  in_dag: boolean;
  quote_verified: boolean;
  evidence: Evidence[];
};
export type ConceptGraphData = { nodes: ConceptNode[]; edges: ConceptEdge[] };
export type GraphIndex = {
  byId: Map<string, ConceptNode>;
  incoming: Map<string, ConceptEdge[]>;
  outgoing: Map<string, ConceptEdge[]>;
};

export const COURSES = [
  { id: 'MS-C2111', short: 'SP', name: '随机过程' },
  { id: 'MS-C2105', short: 'OPT', name: '优化导论' },
  { id: 'MS-C1620', short: 'STAT', name: '统计推断' },
  { id: 'MS-E1604', short: 'BM', name: '布朗运动与随机分析' },
  { id: 'ELEC-E8425', short: 'EN', name: '能源系统建模与优化' },
  { id: 'ELEC-E8125', short: 'RL', name: '强化学习' },
  { id: 'ELEC-E5424', short: 'CVX', name: '凸优化' },
  { id: 'MIT-18.06SC', short: 'LA', name: 'MIT 线性代数' },
  { id: 'MIT-18.02SC', short: 'CALC', name: 'MIT 多元微积分' },
  { id: 'MIT-6.041SC', short: 'PROB', name: 'MIT 应用概率' },
  { id: 'MIT-18.650', short: 'INF', name: 'MIT 统计推断' },
  { id: 'MS-E1600', short: 'MEAS', name: 'Aalto 测度概率' },
  { id: 'MIT-18.065', short: 'MAT', name: 'MIT 数据分析矩阵方法' },
  { id: 'CS-E4895', short: 'GP', name: 'Aalto 高斯过程' },
] as const;

export function courseLabel(id: string): string {
  return COURSES.find((course) => course.id === id)?.short ?? id;
}

export function parseGraph(value: unknown): ConceptGraphData {
  if (!value || typeof value !== 'object') throw new Error('图谱必须是 JSON 对象。');
  const graph = value as ConceptGraphData;
  if (!Array.isArray(graph.nodes) || !Array.isArray(graph.edges) || !graph.nodes.length) {
    throw new Error('图谱缺少 nodes / edges 数组。');
  }
  const ids = new Set<string>();
  for (const node of graph.nodes) {
    if (!node.id || ids.has(node.id) || typeof node.name !== 'string'
      || !Number.isFinite(node.prereq_depth) || !Number.isFinite(node.degree)
      || typeof node.definition !== 'string'
      || ![node.courses, node.aliases_en, node.aliases_fi, node.aliases_zh, node.introduced_in, node.used_in].every(Array.isArray)) {
      throw new Error(`概念字段不完整或 ID 重复：${node.id ?? '未知'}。`);
    }
    ids.add(node.id);
  }
  for (const edge of graph.edges) {
    if (!ids.has(edge.src) || !ids.has(edge.dst) || typeof edge.rel !== 'string'
      || !Number.isFinite(edge.confidence) || !Array.isArray(edge.evidence)
      || (edge.rel === 'prerequisite_of' && typeof edge.in_dag !== 'boolean')) {
      throw new Error(`关系字段不完整或引用缺失：${edge.src} → ${edge.dst}。`);
    }
  }
  return graph;
}

export function indexGraph(graph: ConceptGraphData): GraphIndex {
  const byId = new Map(graph.nodes.map((node) => [node.id, node]));
  const incoming = new Map(graph.nodes.map((node) => [node.id, [] as ConceptEdge[]]));
  const outgoing = new Map(graph.nodes.map((node) => [node.id, [] as ConceptEdge[]]));
  for (const edge of graph.edges) {
    incoming.get(edge.dst)?.push(edge);
    outgoing.get(edge.src)?.push(edge);
  }
  return { byId, incoming, outgoing };
}

/** Only admitted prerequisite edges participate in traversal, even if the source contains cycles. */
export function prerequisiteClosure(index: GraphIndex, id: string, direction: 'ancestors' | 'descendants'): Set<string> {
  const seen = new Set([id]);
  const queue = [id];
  while (queue.length) {
    const current = queue.pop()!;
    const edges = (direction === 'ancestors' ? index.incoming : index.outgoing).get(current) ?? [];
    for (const edge of edges) {
      if (edge.rel !== 'prerequisite_of' || !edge.in_dag) continue;
      const next = direction === 'ancestors' ? edge.src : edge.dst;
      if (!seen.has(next)) { seen.add(next); queue.push(next); }
    }
  }
  seen.delete(id);
  return seen;
}

export function prerequisitePath(index: GraphIndex, id: string): ConceptNode[] {
  return [...prerequisiteClosure(index, id, 'ancestors')].map((key) => index.byId.get(key)!)
    .sort((left, right) => left.prereq_depth - right.prereq_depth || left.name.localeCompare(right.name));
}

export function matchesQuery(node: ConceptNode, query: string): boolean {
  const term = query.trim().toLocaleLowerCase();
  return !term || [node.name, ...node.aliases_en, ...node.aliases_fi, ...node.aliases_zh]
    .some((value) => value.toLocaleLowerCase().includes(term));
}

export function visibleNodes(graph: ConceptGraphData, active: ReadonlySet<string>): ConceptNode[] {
  return graph.nodes.filter((node) => node.courses.some((course) => active.has(course)));
}

export function visibleEdges(graph: ConceptGraphData, ids: ReadonlySet<string>, showRelations: boolean): ConceptEdge[] {
  return graph.edges.filter((edge) => ids.has(edge.src) && ids.has(edge.dst)
    && (showRelations || edge.rel === 'prerequisite_of'));
}

export function quoteIsVerified(edge: ConceptEdge, evidence: Evidence): boolean {
  return evidence.verified ?? edge.quote_verified;
}

/** A small stable fingerprint invalidates cached coordinates when graph topology changes. */
export function graphSignature(graph: ConceptGraphData): string {
  const text = JSON.stringify([
    graph.nodes.map((node) => [node.id, node.name, node.courses, node.prereq_depth]),
    graph.edges.map((edge) => [edge.src, edge.dst, edge.rel]),
  ]);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619);
  return `force-v1-${(hash >>> 0).toString(16)}`;
}
