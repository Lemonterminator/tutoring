/**
 * Declarative, serializable figure specification for practice cards.
 * Pure data: built by generators, drawn by `Figure2D.tsx` as SVG with theme tokens.
 * A figure never carries information that the question text lacks; `alt` must describe it in words.
 */
export type Tone = 'accent' | 'accent2' | 'accent3' | 'warn' | 'muted' | 'axis' | 'text';
export type Pt = readonly [number, number];
export type Pt3 = readonly [number, number, number];

export type FigureShape =
  /** Open polyline. */
  | { kind: 'line'; points: Pt[]; tone?: Tone; dash?: boolean; width?: number; label?: string; labelAt?: Pt }
  /** Closed filled polygon (a region). */
  | { kind: 'area'; points: Pt[]; tone?: Tone; opacity?: number; label?: string; labelAt?: Pt }
  | { kind: 'arrow'; from: Pt; to: Pt; tone?: Tone; width?: number; label?: string }
  | { kind: 'point'; at: Pt; tone?: Tone; label?: string; hollow?: boolean }
  | { kind: 'text'; at: Pt; text: string; tone?: Tone; anchor?: 'start' | 'middle' | 'end' };

export type FigureView = { xmin: number; xmax: number; ymin: number; ymax: number };
export type Figure = {
  /** Required text alternative, in the card's language. */
  alt: string;
  view: FigureView;
  /**
   * `equal`: one unit is the same length on both axes (circles stay round); the view is widened on its short side.
   * `free`: each axis fills the frame (graphs whose axes carry different units). Default: `equal` unless the
   * view is more than 8 times taller than wide or wider than tall, see `figureScale`.
   */
  aspect?: 'equal' | 'free';
  axes?: { xLabel?: string; yLabel?: string; grid?: boolean };
  shapes: FigureShape[];
  caption?: string;
};

export function sampleCurve(fn: (t: number) => Pt, t0: number, t1: number, n = 64): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => fn(t0 + (t1 - t0) * i / n));
}
export function graphOf(fn: (x: number) => number, x0: number, x1: number, n = 64): Pt[] {
  return sampleCurve(x => [x, fn(x)], x0, x1, n);
}
export function ellipse(cx: number, cy: number, rx: number, ry = rx, n = 72): Pt[] {
  return sampleCurve(t => [cx + rx * Math.cos(t), cy + ry * Math.sin(t)], 0, 2 * Math.PI, n);
}
export function rect(x0: number, y0: number, x1: number, y1: number): Pt[] {
  return [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
}
/** Axis-aligned arrow glyphs for a vector field, each shortened/clamped so it fits in its cell. */
export function arrowField(field: (x: number, y: number) => Pt, xs: number[], ys: number[], scale = 1, tone: Tone = 'accent'): FigureShape[] {
  const cell = Math.min(xs.length > 1 ? Math.abs(xs[1] - xs[0]) : Infinity, ys.length > 1 ? Math.abs(ys[1] - ys[0]) : Infinity) * 0.85;
  const shapes: FigureShape[] = [];
  for (const y of ys) for (const x of xs) {
    const [fx, fy] = field(x, y);
    let dx = fx * scale, dy = fy * scale;
    const length = Math.hypot(dx, dy);
    if (!Number.isFinite(length) || length < 1e-9) continue;
    if (length > cell) { dx *= cell / length; dy *= cell / length; }
    shapes.push({ kind: 'arrow', from: [x, y], to: [x + dx, y + dy], tone });
  }
  return shapes;
}
/** Marching-squares level set of f(x, y) = level inside `view`, as 2-point segments. */
export function contourLines(f: (x: number, y: number) => number, view: FigureView, level: number, n = 40, tone: Tone = 'accent'): FigureShape[] {
  const xs = Array.from({ length: n + 1 }, (_, i) => view.xmin + (view.xmax - view.xmin) * i / n);
  const ys = Array.from({ length: n + 1 }, (_, i) => view.ymin + (view.ymax - view.ymin) * i / n);
  const g = ys.map(y => xs.map(x => f(x, y) - level));
  const lerp = (a: number, b: number, va: number, vb: number) => a + (b - a) * (va / (va - vb));
  const shapes: FigureShape[] = [];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const v = [g[j][i], g[j][i + 1], g[j + 1][i + 1], g[j + 1][i]];
    if (v.some(value => !Number.isFinite(value))) continue;
    const edge: Pt[] = [];
    if (v[0] * v[1] < 0) edge.push([lerp(xs[i], xs[i + 1], v[0], v[1]), ys[j]]);
    if (v[1] * v[2] < 0) edge.push([xs[i + 1], lerp(ys[j], ys[j + 1], v[1], v[2])]);
    if (v[3] * v[2] < 0) edge.push([lerp(xs[i], xs[i + 1], v[3], v[2]), ys[j + 1]]);
    if (v[0] * v[3] < 0) edge.push([xs[i], lerp(ys[j], ys[j + 1], v[0], v[3])]);
    for (let k = 0; k + 1 < edge.length; k += 2) shapes.push({ kind: 'line', points: [edge[k], edge[k + 1]], tone, width: 2 });
  }
  return shapes;
}

/** Fixed oblique projection used for every 3D figure: x toward the viewer (down-left), y to the right, z up. */
export function project3d([x, y, z]: Pt3): Pt { return [y - 0.45 * x, z - 0.3 * x]; }
export function line3d(points: Pt3[], tone?: Tone, extra: Partial<Extract<FigureShape, { kind: 'line' }>> = {}): FigureShape {
  return { kind: 'line', points: points.map(project3d), ...(tone ? { tone } : {}), ...extra };
}
export function arrow3d(from: Pt3, to: Pt3, tone?: Tone, label?: string): FigureShape {
  return { kind: 'arrow', from: project3d(from), to: project3d(to), ...(tone ? { tone } : {}), ...(label ? { label } : {}) };
}
export function axes3d(length: number): FigureShape[] {
  return [arrow3d([0, 0, 0], [length, 0, 0], 'axis', 'x'), arrow3d([0, 0, 0], [0, length, 0], 'axis', 'y'), arrow3d([0, 0, 0], [0, 0, length], 'axis', 'z')];
}
/** Wireframe of a parametric surface (u, v) -> (x, y, z). */
export function wire3d(fn: (u: number, v: number) => Pt3, u0: number, u1: number, v0: number, v1: number, nu = 6, nv = 6, samples = 24, tone: Tone = 'accent'): FigureShape[] {
  const shapes: FigureShape[] = [];
  for (let i = 0; i <= nu; i++) {
    const u = u0 + (u1 - u0) * i / nu;
    shapes.push(line3d(Array.from({ length: samples + 1 }, (_, k) => fn(u, v0 + (v1 - v0) * k / samples)), tone, { width: 1 }));
  }
  for (let j = 0; j <= nv; j++) {
    const v = v0 + (v1 - v0) * j / nv;
    shapes.push(line3d(Array.from({ length: samples + 1 }, (_, k) => fn(u0 + (u1 - u0) * k / samples, v)), tone, { width: 1 }));
  }
  return shapes;
}

/** A view that encloses every finite coordinate of the shapes, padded, with equal x/y scale. */
export function fitView(shapes: FigureShape[], pad = 0.12): FigureView {
  const xs: number[] = [], ys: number[] = [];
  const add = (p: Pt) => { if (Number.isFinite(p[0]) && Number.isFinite(p[1])) { xs.push(p[0]); ys.push(p[1]); } };
  for (const s of shapes) {
    if (s.kind === 'line' || s.kind === 'area') s.points.forEach(add);
    else if (s.kind === 'arrow') { add(s.from); add(s.to); }
    else add(s.at);
  }
  if (!xs.length) return { xmin: -1, xmax: 1, ymin: -1, ymax: 1 };
  let xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
  const w = Math.max(xmax - xmin, 1e-6), h = Math.max(ymax - ymin, 1e-6);
  const px = w * pad, py = h * pad;
  xmin -= px; xmax += px; ymin -= py; ymax += py;
  return { xmin, xmax, ymin, ymax };
}

export const FIGURE_WIDTH = 400;
export const FIGURE_MIN_HEIGHT = 150;
export const FIGURE_MAX_HEIGHT = 480;
const FREE_RATIO = 8;

/**
 * The drawing frame for a figure: its pixel height (frame width is FIGURE_WIDTH) and the view actually drawn.
 * With equal scale the requested view is centred and widened on its short side, so it never stretches a shape.
 */
export function figureScale(figure: Pick<Figure, 'view' | 'aspect'>): { view: FigureView; height: number; equal: boolean } {
  const { xmin, xmax, ymin, ymax } = figure.view;
  const ratio = (ymax - ymin) / (xmax - xmin);
  const height = Math.min(FIGURE_MAX_HEIGHT, Math.max(FIGURE_MIN_HEIGHT, FIGURE_WIDTH * ratio));
  const equal = figure.aspect === 'equal' || (figure.aspect !== 'free' && ratio <= FREE_RATIO && ratio >= 1 / FREE_RATIO);
  if (!equal) return { view: figure.view, height, equal };
  const unit = Math.max((xmax - xmin) / FIGURE_WIDTH, (ymax - ymin) / height);
  const cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2, hx = unit * FIGURE_WIDTH / 2, hy = unit * height / 2;
  return { view: { xmin: cx - hx, xmax: cx + hx, ymin: cy - hy, ymax: cy + hy }, height, equal };
}

/** Structural problems with a figure; empty when valid. Used by deck-invariant tests. */
export function figureProblems(figure: Figure): string[] {
  const problems: string[] = [];
  const { xmin, xmax, ymin, ymax } = figure.view;
  if (![xmin, xmax, ymin, ymax].every(Number.isFinite) || xmax <= xmin || ymax <= ymin) problems.push('invalid view');
  if (!figure.alt.trim()) problems.push('missing alt text');
  if (!figure.shapes.length) problems.push('no shapes');
  const check = (p: Pt) => { if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) problems.push('non-finite coordinate'); };
  for (const s of figure.shapes) {
    if (s.kind === 'line' || s.kind === 'area') { if (s.points.length < 2) problems.push(`${s.kind} with fewer than 2 points`); s.points.forEach(check); }
    else if (s.kind === 'arrow') { check(s.from); check(s.to); }
    else check(s.at);
  }
  return [...new Set(problems)];
}
