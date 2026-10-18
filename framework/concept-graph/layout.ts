import { COURSES, graphSignature, type ConceptGraphData } from './model';

export type Point = { x: number; y: number };
export type Positions = Record<string, Point>;
export type LayoutCache = { signature: string; positions: Positions };

function seedPosition(id: string): Point {
  let hash = 2166136261;
  for (const char of id) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  const random = () => {
    hash ^= hash << 13; hash ^= hash >>> 17; hash ^= hash << 5;
    return (hash >>> 0) / 4294967296;
  };
  return { x: (random() - 0.5) * 900, y: (random() - 0.5) * 900 };
}

/** Claude's Canvas force model, with stable seeds and incremental steps for a responsive fallback. */
export function createForceLayout(graph: ConceptGraphData, iterations = 260) {
  const nodes = graph.nodes.map((node) => ({ id: node.id, ...seedPosition(node.id), vx: 0, vy: 0 }));
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const links = graph.edges.filter((edge) => edge.rel !== 'related_to')
    .map((edge) => [byId.get(edge.src)!, byId.get(edge.dst)!] as const);
  let completed = 0;
  return {
    step(count: number): boolean {
      for (let step = 0; step < count && completed < iterations; step++, completed++) {
        const alpha = 1 - completed / iterations;
        for (let i = 0; i < nodes.length; i++) {
          const a = nodes[i];
          for (let j = i + 1; j < nodes.length; j++) {
            const b = nodes[j];
            const dx = a.x - b.x, dy = a.y - b.y, squared = dx * dx + dy * dy + 0.01;
            if (squared > 90000) continue;
            const force = 1800 / squared * alpha;
            a.vx += dx * force; a.vy += dy * force;
            b.vx -= dx * force; b.vy -= dy * force;
          }
        }
        for (const [a, b] of links) {
          const dx = b.x - a.x, dy = b.y - a.y, distance = Math.hypot(dx, dy) + 0.01;
          const force = (distance - 70) * 0.012 * alpha;
          a.vx += dx / distance * force; a.vy += dy / distance * force;
          b.vx -= dx / distance * force; b.vy -= dy / distance * force;
        }
        for (const node of nodes) {
          node.vx -= node.x * 0.002; node.vy -= node.y * 0.002;
          node.x += node.vx; node.y += node.vy;
          node.vx *= 0.55; node.vy *= 0.55;
        }
      }
      return completed === iterations;
    },
    positions(): Positions { return Object.fromEntries(nodes.map((node) => [node.id, { x: node.x, y: node.y }])); },
  };
}

export function layeredLayout(graph: ConceptGraphData): Positions {
  const groups = new Map<string, typeof graph.nodes>();
  for (const node of graph.nodes) {
    const key = `${node.courses[0]}:${node.prereq_depth}`;
    const group = groups.get(key) ?? [];
    group.push(node); groups.set(key, group);
  }
  // Each course owns a separate lane; a crowded depth wraps into several rows.
  const courseIds = [...new Set([...COURSES.map((course) => course.id), ...graph.nodes.map((node) => node.courses[0])])];
  const lanes = new Map<string, { x: number; columns: number }>();
  let laneX = 0;
  for (const course of courseIds) {
    const largest = Math.max(1, ...[...groups.values()].filter((nodes) => nodes[0].courses[0] === course).map((nodes) => nodes.length));
    const columns = Math.min(6, largest);
    lanes.set(course, { x: laneX, columns });
    laneX += columns * 110 + 100;
  }
  const depths = [...new Set(graph.nodes.map((node) => node.prereq_depth))].sort((a, b) => a - b);
  const depthY = new Map<number, number>();
  let bandY = 0;
  for (const depth of depths) {
    depthY.set(depth, bandY);
    const rows = Math.max(1, ...[...groups.values()].filter((nodes) => nodes[0].prereq_depth === depth)
      .map((nodes) => Math.ceil(nodes.length / lanes.get(nodes[0].courses[0])!.columns)));
    bandY += rows * 80 + 90;
  }
  const positions: Positions = {};
  for (const nodes of groups.values()) {
    const sorted = [...nodes].sort((a, b) => a.name.localeCompare(b.name));
    sorted.forEach((node, index) => {
      const lane = lanes.get(node.courses[0])!;
      positions[node.id] = {
        x: lane.x + (index % lane.columns) * 110,
        y: depthY.get(node.prereq_depth)! + Math.floor(index / lane.columns) * 80,
      };
    });
  }
  return positions;
}

export function validLayoutCache(value: unknown, graph: ConceptGraphData): value is LayoutCache {
  const cache = value as LayoutCache | null;
  return Boolean(cache?.signature === graphSignature(graph) && cache.positions && graph.nodes.every((node) => {
    const point = cache.positions[node.id];
    return point && Number.isFinite(point.x) && Number.isFinite(point.y);
  }));
}
