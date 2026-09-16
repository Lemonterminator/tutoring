import type { Element, Root } from 'hast';
import { visit } from 'unist-util-visit';

const NUMBERED = new Set(['p', 'h2', 'h3', 'li']);

export type BlockIdOptions = { onCount?: (count: number) => void };

/**
 * Numbers every p/h2/h3/li in document order as data-b="n" and gives each h2 the id "sec-n".
 * EN and FI bodies share structure, so the same n is the same block in both languages.
 */
export function rehypeBlockIds(options: BlockIdOptions = {}) {
  return (tree: Root) => {
    let n = 0;
    visit(tree, 'element', (node: Element) => {
      if (!NUMBERED.has(node.tagName)) return;
      const index = n++;
      node.properties = { ...node.properties, dataB: String(index) };
      if (node.tagName === 'h2' && !node.properties.id) node.properties.id = `sec-${index}`;
    });
    options.onCount?.(n);
  };
}
