import { useEffect, useRef, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { pick } from '../../../framework/i18n/ui';
import { cssVar, drawArrow, drawAxes, type Frame } from '../../../framework/interact/draw';
import { fixed } from '../../../framework/interact/format';
import { SimCanvas, type PointerInfo } from '../../../framework/interact/SimCanvas';
import { abs, arg, c, fmt, fromPolar, I, mul, type C } from './complex';

const START = c(1.5, 0.5);
const MINUS_ONE = c(-1, 0);
const TURN_SECONDS = 0.6;
const MIN_R = 0.3;
const MAX_R = 2.8;

type Turn = { from: C; to: C; angle: number; t: number };

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const frameFor = (w: number, h: number): Frame => ({ ox: w / 2, oy: h / 2, scale: Math.min(w, h) / 6 });

export function ComplexRotator() {
  const [z, setZ] = useState<C>(START);
  const [trail, setTrail] = useState<C[]>([]);
  const [turning, setTurning] = useState(false);
  const turn = useRef<Turn | null>(null);
  const dragging = useRef(false);
  const report = useReportState();

  useEffect(() => report({ z: fmt(z) }), [z]);

  function rotate(factor: C, angle: number) {
    if (turn.current) return;
    turn.current = { from: z, to: mul(z, factor), angle, t: 0 };
    setTurning(true);
  }

  function onTick(dt: number) {
    const active = turn.current;
    if (!active) return;
    active.t = Math.min(1, active.t + dt / TURN_SECONDS);
    if (active.t < 1) return;
    turn.current = null;
    setTrail((old) => [...old, active.from].slice(-4));
    setZ(active.to);
    setTurning(false);
  }

  /** Position to draw: mid-turn it moves along the circle, not along a straight line. */
  function shown(): C {
    const active = turn.current;
    if (!active) return z;
    return fromPolar(abs(active.from), arg(active.from) + active.angle * ease(active.t));
  }

  function onPointer(p: PointerInfo) {
    const f = frameFor(p.w, p.h);
    if (p.kind === 'down') {
      const tipX = f.ox + z.re * f.scale;
      const tipY = f.oy - z.im * f.scale;
      dragging.current = !turn.current && Math.hypot(p.x - tipX, p.y - tipY) < 24;
      return;
    }
    if (p.kind === 'up') {
      dragging.current = false;
      return;
    }
    if (!dragging.current) return;
    const next = c((p.x - f.ox) / f.scale, (f.oy - p.y) / f.scale);
    const r = Math.min(MAX_R, Math.max(MIN_R, abs(next)));
    setZ(fromPolar(r, arg(next)));
    setTrail([]);
  }

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const f = frameFor(w, h);
    const px = (q: C) => [f.ox + q.re * f.scale, f.oy - q.im * f.scale] as const;
    drawAxes(ctx, w, h, f, ['Re', 'Im']);

    ctx.globalAlpha = 0.3;
    for (const old of trail) {
      const [x, y] = px(old);
      drawArrow(ctx, f.ox, f.oy, x, y, cssVar('--muted'));
    }
    ctx.globalAlpha = 1;

    const current = shown();
    const [x, y] = px(current);
    const accent = cssVar('--accent');
    drawArrow(ctx, f.ox, f.oy, x, y, accent, 3);
    ctx.fillStyle = accent;
    ctx.beginPath();
    ctx.arc(x, y, 7, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = cssVar('--text');
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(`z = ${fmt(current)}`, x + 10, y - 10);
  }

  const degrees = ((arg(z) * 180) / Math.PI + 360) % 360;

  return (
    <div class="sim">
      <SimCanvas
        draw={draw}
        height={340}
        running={turning}
        onTick={onTick}
        onPointer={onPointer}
        label={pick({ en: 'Complex plane with a draggable arrow z', fi: 'Kompleksitaso ja siirrettävä nuoli z' })}
      />
      <div class="controls">
        <button type="button" class="btn" onClick={() => rotate(I, Math.PI / 2)}>
          × i
        </button>
        <button type="button" class="btn" onClick={() => rotate(MINUS_ONE, Math.PI)}>
          × (−1)
        </button>
        <button
          type="button"
          class="btn btn--ghost"
          onClick={() => {
            setZ(START);
            setTrail([]);
          }}
        >
          {pick({ en: 'Reset', fi: 'Palauta' })}
        </button>
        <span class="readout">
          |z| = {fixed(abs(z))} · {pick({ en: 'angle', fi: 'kulma' })} = {fixed(degrees, 0)}°
        </span>
      </div>
      <p class="sim__hint">{pick({ en: 'Drag the tip of the arrow to choose any z.', fi: 'Vedä nuolen kärkeä ja valitse mikä tahansa z.' })}</p>
    </div>
  );
}
