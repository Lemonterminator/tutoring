import type { ConceptEdge, ConceptGraphData, ConceptNode } from './model';

export function node(id: string, depth: number, extra: Partial<ConceptNode> = {}): ConceptNode {
  return { id, name: id, aliases_en: [], aliases_fi: [], aliases_zh: [], definition: `${id} definition`,
    courses: ['MS-C2111'], introduced_in: [], used_in: [], prereq_depth: depth, root: depth === 0,
    degree: 2, status: 'auto', ...extra };
}
export function edge(src: string, dst: string, extra: Partial<ConceptEdge> = {}): ConceptEdge {
  return { src, dst, rel: 'prerequisite_of', confidence: 0.8, support: 2, in_dag: true, quote_verified: true,
    evidence: [{ doc: 'lecture-one', page: 7, quote: 'Original wording', verified: true },
      { doc: 'lecture-two', page: 9, quote: 'Restated evidence', verified: false }], ...extra };
}
export const fixture: ConceptGraphData = {
  nodes: [node('Foundation', 0, { aliases_zh: ['基础'], aliases_fi: ['perusta'], aliases_en: ['base'] }),
    node('Middle', 1, { courses: ['MS-C2111', 'ELEC-E8125'] }),
    node('Target', 2, { courses: ['ELEC-E8125'], status: 'needs_review' }),
    node('Excluded', 3)],
  edges: [edge('Foundation', 'Middle'), edge('Middle', 'Target'),
    edge('Excluded', 'Target', { in_dag: false }), edge('Target', 'Foundation', { in_dag: false }),
    edge('Excluded', 'Foundation', { rel: 'related_to', confidence: 0.5 })],
};
