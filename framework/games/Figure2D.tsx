import { FIGURE_WIDTH as WIDTH, figureScale, type Figure, type FigureShape, type Pt, type Tone } from './figure';
import { MathText } from './MathText';

const TONES: Record<Tone, string> = {
  accent: 'var(--accent)', accent2: 'var(--accent-2)', accent3: 'var(--accent-3)', warn: 'var(--warn)',
  muted: 'var(--muted)', axis: 'var(--axis)', text: 'var(--text)',
};

function niceStep(span: number) {
  const raw = span / 8, power = 10 ** Math.floor(Math.log10(raw)), m = raw / power;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * power;
}
const num = (value: number) => Number(value.toFixed(2));

export function Figure2D({ figure, compact = false }: { figure: Figure; compact?: boolean }) {
  const { view, height } = figureScale(figure);
  const { xmin, xmax, ymin, ymax } = view;
  const px = ([x, y]: Pt): [number, number] => [(x - xmin) / (xmax - xmin) * WIDTH, height - (y - ymin) / (ymax - ymin) * height];
  const ok = (p: Pt) => Number.isFinite(p[0]) && Number.isFinite(p[1]);
  const path = (points: Pt[]) => points.filter(ok).map((p, i) => { const [x, y] = px(p); return `${i ? 'L' : 'M'}${num(x)} ${num(y)}`; }).join(' ');
  const tone = (value?: Tone, fallback: Tone = 'accent') => TONES[value ?? fallback];
  /** A label beside the anchor point (dx, dy away), flipped to the other side near the right edge and kept inside the frame. */
  const labelAt = (x: number, y: number, dx: number, dy: number) => {
    const flip = x + dx > WIDTH - 56;
    return { x: num(flip ? x - Math.abs(dx) : x + dx), y: num(Math.min(height - 4, Math.max(14, y + dy))), 'text-anchor': flip ? 'end' as const : 'start' as const };
  };
  const mid = (points: Pt[]): Pt => { const good = points.filter(ok); return [good.reduce((s, p) => s + p[0], 0) / good.length, good.reduce((s, p) => s + p[1], 0) / good.length]; };

  const xStep = niceStep(xmax - xmin), yStep = niceStep(ymax - ymin);
  const gridX = figure.axes?.grid ? Array.from({ length: Math.floor((xmax - xmin) / xStep) + 2 }, (_, i) => Math.ceil(xmin / xStep) * xStep + i * xStep).filter(v => v >= xmin && v <= xmax) : [];
  const gridY = figure.axes?.grid ? Array.from({ length: Math.floor((ymax - ymin) / yStep) + 2 }, (_, i) => Math.ceil(ymin / yStep) * yStep + i * yStep).filter(v => v >= ymin && v <= ymax) : [];

  const renderShape = (shape: FigureShape, key: number) => {
    if (shape.kind === 'line') {
      const label = shape.label && shape.points.length ? px(shape.labelAt ?? shape.points[shape.points.length - 1]) : null;
      return <g key={key}><path d={path(shape.points)} fill="none" stroke={tone(shape.tone)} stroke-width={shape.width ?? 2} stroke-dasharray={shape.dash ? '6 4' : undefined} stroke-linejoin="round" stroke-linecap="round" />{label && <text {...labelAt(label[0], label[1], 4, -4)} fill={tone(shape.tone)} font-size="14">{shape.label}</text>}</g>;
    }
    if (shape.kind === 'area') {
      const label = shape.label ? px(shape.labelAt ?? mid(shape.points)) : null;
      return <g key={key}><path d={`${path(shape.points)} Z`} fill={tone(shape.tone)} fill-opacity={shape.opacity ?? 0.22} stroke={tone(shape.tone)} stroke-width="1.5" />{label && <text x={label[0]} y={label[1]} text-anchor="middle" fill="var(--text)" font-size="14">{shape.label}</text>}</g>;
    }
    if (shape.kind === 'arrow') {
      const [x1, y1] = px(shape.from), [x2, y2] = px(shape.to);
      const length = Math.hypot(x2 - x1, y2 - y1);
      if (!Number.isFinite(length) || length < 0.5) return null;
      const ux = (x2 - x1) / length, uy = (y2 - y1) / length, head = Math.min(9, length * 0.6), half = head * 0.45;
      const color = tone(shape.tone);
      return <g key={key}><line x1={num(x1)} y1={num(y1)} x2={num(x2 - ux * head * 0.8)} y2={num(y2 - uy * head * 0.8)} stroke={color} stroke-width={shape.width ?? 2} stroke-linecap="round" />
        <polygon points={`${num(x2)},${num(y2)} ${num(x2 - ux * head - uy * half)},${num(y2 - uy * head + ux * half)} ${num(x2 - ux * head + uy * half)},${num(y2 - uy * head - ux * half)}`} fill={color} />
        {shape.label && <text {...labelAt(x2, y2, 6, -6)} fill={color} font-size="14">{shape.label}</text>}</g>;
    }
    if (shape.kind === 'point') {
      const [x, y] = px(shape.at);
      return <g key={key}><circle cx={num(x)} cy={num(y)} r="4.5" fill={shape.hollow ? 'var(--surface)' : tone(shape.tone, 'accent2')} stroke={tone(shape.tone, 'accent2')} stroke-width="2" />{shape.label && <text {...labelAt(x, y, 8, -8)} fill="var(--text)" font-size="14">{shape.label}</text>}</g>;
    }
    const [x, y] = px(shape.at);
    return <text key={key} x={num(x)} y={num(y)} text-anchor={shape.anchor ?? 'middle'} fill={tone(shape.tone, 'text')} font-size="14">{shape.text}</text>;
  };

  const [ax, ay] = px([0, 0]);
  const showXAxis = ymin <= 0 && ymax >= 0, showYAxis = xmin <= 0 && xmax >= 0;
  const altText = figure.alt?.trim() || figure.caption?.trim() || 'Mathematical diagram';
  const Wrapper = compact ? 'span' : 'figure';
  return <Wrapper class={`fig2d${compact ? ' fig2d--compact' : ''}`}>
    <svg viewBox={`0 0 ${WIDTH} ${num(height)}`} role="img" aria-label={altText} preserveAspectRatio="xMidYMid meet">
      <title>{altText}</title>
      <rect x="0" y="0" width={WIDTH} height={num(height)} fill="var(--surface)" stroke="var(--border)" rx="8" />
      {gridX.map(v => <line key={`gx${v}`} x1={num(px([v, 0])[0])} x2={num(px([v, 0])[0])} y1="0" y2={num(height)} stroke="var(--border)" stroke-width="1" />)}
      {gridY.map(v => <line key={`gy${v}`} y1={num(px([0, v])[1])} y2={num(px([0, v])[1])} x1="0" x2={WIDTH} stroke="var(--border)" stroke-width="1" />)}
      {showXAxis && <line x1="0" x2={WIDTH} y1={num(ay)} y2={num(ay)} stroke="var(--axis)" stroke-width="1.5" />}
      {showYAxis && <line y1="0" y2={num(height)} x1={num(ax)} x2={num(ax)} stroke="var(--axis)" stroke-width="1.5" />}
      {figure.axes?.xLabel && <text x={WIDTH - 6} y={showXAxis ? num(ay - 6) : num(height - 6)} text-anchor="end" fill="var(--muted)" font-size="14">{figure.axes.xLabel}</text>}
      {figure.axes?.yLabel && <text x={showYAxis ? num(ax + 6) : 6} y="16" fill="var(--muted)" font-size="14">{figure.axes.yLabel}</text>}
      {figure.shapes.map(renderShape)}
    </svg>
    {figure.caption && !compact && <figcaption><MathText text={figure.caption} /></figcaption>}
  </Wrapper>;
}
