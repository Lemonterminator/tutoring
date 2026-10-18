import { describe, expect, it } from 'vitest';
import { arrowField, axes3d, contourLines, ellipse, FIGURE_WIDTH, figureProblems, figureScale, fitView, graphOf, project3d, rect, wire3d } from './figure';

describe('figure scale', () => {
  const unitX = (s: ReturnType<typeof figureScale>) => (s.view.xmax - s.view.xmin) / FIGURE_WIDTH;
  const unitY = (s: ReturnType<typeof figureScale>) => (s.view.ymax - s.view.ymin) / s.height;
  it('keeps one unit equal on both axes when the height is clamped (a tall view gets wider, not stretched)', () => {
    const tall = figureScale({ view: { xmin: 0, xmax: 1, ymin: 0, ymax: 3 } });
    expect(tall.equal).toBe(true);
    expect(tall.height).toBe(480);
    expect(unitX(tall)).toBeCloseTo(unitY(tall), 10);
    expect(tall.view.ymin).toBeCloseTo(0, 10); expect(tall.view.ymax).toBeCloseTo(3, 10);
    expect(tall.view.xmin).toBeLessThan(0); expect(tall.view.xmax).toBeGreaterThan(1);
    const flat = figureScale({ view: { xmin: -5, xmax: 30, ymin: -1, ymax: 9 } });
    expect(flat.height).toBe(150);
    expect(unitX(flat)).toBeCloseTo(unitY(flat), 10);
    expect(flat.view.xmin).toBeCloseTo(-5, 10); expect(flat.view.xmax).toBeCloseTo(30, 10);
  });
  it('leaves an unclamped view unchanged', () => {
    const view = { xmin: -2, xmax: 2, ymin: -1, ymax: 2 };
    expect(figureScale({ view }).view).toEqual(view);
  });
  it('stretches only extreme views or when asked', () => {
    expect(figureScale({ view: { xmin: 0, xmax: 1, ymin: 0, ymax: 20 } }).equal).toBe(false);
    expect(figureScale({ view: { xmin: 0, xmax: 1, ymin: 0, ymax: 3 }, aspect: 'free' }).equal).toBe(false);
    const forced = figureScale({ view: { xmin: 0, xmax: 1, ymin: 0, ymax: 20 }, aspect: 'equal' });
    expect(unitX(forced)).toBeCloseTo(unitY(forced), 10);
  });
});

describe('figure helpers', () => {
  it('samples curves deterministically', () => {
    expect(graphOf(x => x * x, 0, 2, 4)).toEqual([[0, 0], [0.5, 0.25], [1, 1], [1.5, 2.25], [2, 4]]);
    expect(ellipse(0, 0, 2, 1, 8)).toHaveLength(9);
  });
  it('finds the level set x^2 + y^2 = 1 with points on the unit circle', () => {
    const shapes = contourLines((x, y) => x * x + y * y, { xmin: -2, xmax: 2, ymin: -2, ymax: 2 }, 1, 60);
    expect(shapes.length).toBeGreaterThan(40);
    for (const s of shapes) if (s.kind === 'line') for (const [x, y] of s.points) expect(Math.hypot(x, y)).toBeCloseTo(1, 1);
  });
  it('clamps vector-field arrows to their cell', () => {
    const shapes = arrowField((x, y) => [100 * x, 100 * y], [-1, 0, 1], [-1, 0, 1]);
    for (const s of shapes) if (s.kind === 'arrow') expect(Math.hypot(s.to[0] - s.from[0], s.to[1] - s.from[1])).toBeLessThanOrEqual(0.85 + 1e-9);
  });
  it('projects 3D points with the fixed oblique projection', () => {
    expect(project3d([0, 0, 0])).toEqual([0, 0]);
    expect(project3d([0, 1, 0])).toEqual([1, 0]);
    expect(project3d([0, 0, 1])).toEqual([0, 1]);
    expect(project3d([1, 0, 0])).toEqual([-0.45, -0.3]);
  });
  it('validates figures', () => {
    const shapes = [...axes3d(1), ...wire3d((u, v) => [u, v, u * v], 0, 1, 0, 1, 2, 2, 4), { kind: 'area' as const, points: rect(0, 0, 1, 1) }];
    const figure = { alt: 'A surface', view: fitView(shapes), shapes };
    expect(figureProblems(figure)).toEqual([]);
    expect(figureProblems({ alt: '', view: { xmin: 1, xmax: 0, ymin: 0, ymax: 1 }, shapes: [] })).toEqual(['invalid view', 'missing alt text', 'no shapes']);
  });
});
