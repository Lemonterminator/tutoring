### Task 9: ComplexRotator and EulerCircle

**Files:**
- Create: `subjects/math/00-wave-math-foundations/ComplexRotator.tsx`, `subjects/math/00-wave-math-foundations/EulerCircle.tsx`
- Test: `subjects/math/00-wave-math-foundations/figures-1-2.test.tsx`

**Interfaces:**
- Consumes: `useReportState` (Task 5); `pick` (Task 2); `SimCanvas`, `PointerInfo`, `Slider`, `cssVar`, `drawArrow`, `drawAxes`, `fixed` (Task 7); `c`, `I`, `mul`, `abs`, `arg`, `fromPolar`, `fmt`, `C` (Task 8).
- Produces: `ComplexRotator()` — draggable arrow z, buttons `× i` / `× (−1)` animate a 90°/180° counterclockwise turn over 0.6 s, faded trail of the last 4 positions, readout `|z| = … · angle = …°`. Reports `{ z }`.
- Produces: `EulerCircle()` — point rotating on the unit circle at ω (slider 0.2–4 rad/s), velocity arrow `dz/dt = iωz` (toggle), cosine shadow dot on the real axis, scrolling sine trace to the right, play/pause, readout `T = 2π/ω = … s`. Reports `{ omega, velocityShown }`.

- [ ] **Step 1: Write the failing test**

`subjects/math/00-wave-math-foundations/figures-1-2.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { ComplexRotator } from './ComplexRotator';
import { EulerCircle } from './EulerCircle';

afterEach(cleanup);

test('ComplexRotator starts at z = 1.5 + 0.5i and offers both rotations', () => {
  const { container } = render(<ComplexRotator />);
  expect(container.textContent).toContain('|z| = 1.58');
  expect(container.textContent).toContain('angle = 18°');
  expect(screen.getByRole('button', { name: '× i' })).toBeTruthy();
  expect(screen.getByRole('button', { name: '× (−1)' })).toBeTruthy();
  expect(screen.getByRole('img').getAttribute('aria-label')).toContain('Complex plane');
});

test('EulerCircle period follows the ω slider', () => {
  const { container } = render(<EulerCircle />);
  expect(container.textContent).toContain('T = 2π/ω = 4.19 s');
  fireEvent.input(screen.getByRole('slider'), { target: { value: '2' } });
  expect(container.textContent).toContain('T = 2π/ω = 3.14 s');
  fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
  expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/math/00-wave-math-foundations/figures-1-2.test.tsx`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement ComplexRotator**

`subjects/math/00-wave-math-foundations/ComplexRotator.tsx`:

```tsx
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
```

- [ ] **Step 4: Implement EulerCircle**

`subjects/math/00-wave-math-foundations/EulerCircle.tsx`:

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { pick } from '../../../framework/i18n/ui';
import { Slider } from '../../../framework/interact/Controls';
import { cssVar, drawArrow, drawAxes } from '../../../framework/interact/draw';
import { fixed } from '../../../framework/interact/format';
import { SimCanvas } from '../../../framework/interact/SimCanvas';

/** Number of past angles kept for the sine trace (~6 s at 60 fps). */
const HISTORY = 360;

export function EulerCircle() {
  const [omega, setOmega] = useState(1.5);
  const [playing, setPlaying] = useState(true);
  const [showVelocity, setShowVelocity] = useState(true);
  const theta = useRef(0.6);
  const history = useRef<number[]>([]);
  const report = useReportState();

  useEffect(() => report({ omega, velocityShown: showVelocity }), [omega, showVelocity]);

  function onTick(dt: number) {
    theta.current = (theta.current + omega * dt) % (2 * Math.PI);
    history.current.push(theta.current);
    if (history.current.length > HISTORY) history.current.shift();
  }

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const circleWidth = Math.min(h, w * 0.45);
    const cx = circleWidth / 2;
    const cy = h / 2;
    const r = circleWidth * 0.34;
    const sinColor = cssVar('--accent-2');
    const cosColor = cssVar('--accent-3');
    const velocityColor = cssVar('--warn');
    const muted = cssVar('--muted');

    drawAxes(ctx, circleWidth, h, { ox: cx, oy: cy, scale: r }, ['Re', 'Im']);
    ctx.strokeStyle = muted;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 2 * Math.PI);
    ctx.stroke();

    const th = theta.current;
    const px = cx + r * Math.cos(th);
    const py = cy - r * Math.sin(th);
    const traceStart = circleWidth + 16;
    const traceEnd = w - 8;

    // shadows: dashed lines to the real axis (cos) and to the start of the sine trace
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = sinColor;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(traceStart, py);
    ctx.stroke();
    ctx.strokeStyle = cosColor;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, cy);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = cosColor;
    ctx.beginPath();
    ctx.arc(px, cy, 5, 0, 2 * Math.PI);
    ctx.fill();

    drawArrow(ctx, cx, cy, px, py, cssVar('--accent'), 3);
    ctx.font = '13px system-ui, sans-serif';

    if (showVelocity) {
      // v = iωz: the position turned by 90° and scaled by ω
      const k = r * 0.3 * omega;
      const vx = px - Math.sin(th) * k;
      const vy = py - Math.cos(th) * k;
      drawArrow(ctx, px, py, vx, vy, velocityColor, 2.5);
      ctx.fillStyle = velocityColor;
      ctx.fillText('dz/dt = iωz', vx + 6, vy - 4);
    }
    ctx.fillStyle = cosColor;
    ctx.fillText('Re z = cos ωt', 8, h - 10);

    if (traceEnd - traceStart > 80) {
      ctx.strokeStyle = cssVar('--axis');
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(traceStart, cy);
      ctx.lineTo(traceEnd, cy);
      ctx.stroke();

      const angles = history.current;
      const step = (traceEnd - traceStart) / HISTORY;
      ctx.strokeStyle = sinColor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      angles.forEach((angle, i) => {
        const x = traceStart + (angles.length - 1 - i) * step; // newest sample sits next to the circle
        const y = cy - r * Math.sin(angle);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
      ctx.fillStyle = sinColor;
      ctx.fillText('Im z = sin ωt', traceStart + 6, 18);
      ctx.fillStyle = muted;
      ctx.fillText(pick({ en: 'earlier →', fi: 'aiemmin →' }), traceEnd - 70, h - 10);
    }
  }

  return (
    <div class="sim">
      <SimCanvas
        draw={draw}
        height={320}
        running={playing}
        onTick={onTick}
        label={pick({ en: 'A point rotating on the unit circle and its sine shadow', fi: 'Yksikköympyrällä pyörivä piste ja sen sinivarjo' })}
      />
      <div class="controls">
        <Slider label="ω" min={0.2} max={4} step={0.1} value={omega} onInput={setOmega} display={`${fixed(omega, 1)} rad/s`} />
        <button type="button" class="btn btn--ghost" onClick={() => setPlaying((p) => !p)}>
          {playing ? pick({ en: 'Pause', fi: 'Tauko' }) : pick({ en: 'Play', fi: 'Toista' })}
        </button>
        <label class="check">
          <input type="checkbox" checked={showVelocity} onChange={(e) => setShowVelocity((e.target as HTMLInputElement).checked)} />
          {pick({ en: 'Show velocity', fi: 'Näytä nopeus' })}
        </label>
        <span class="readout">T = 2π/ω = {fixed((2 * Math.PI) / omega)} s</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run subjects/math/00-wave-math-foundations/figures-1-2.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: See it move**

Temporarily add to the top of `lesson.en.mdx` (remove after checking):

```mdx
import { ComplexRotator } from './ComplexRotator';
import { EulerCircle } from './EulerCircle';

<Figure id="rotator">
  <ComplexRotator />
</Figure>

<Figure id="euler">
  <EulerCircle />
</Figure>
```

Run `npx vite` and open the printed localhost URL in the browser pane. Check: `× i` turns the arrow smoothly along the circle; four presses return it home; dragging the tip works and clamps near the origin; Euler point rotates, sine trace scrolls, velocity arrow is perpendicular to the radius, ω slider changes speed without jumps; pausing stops everything. Stop the dev server and revert the temporary MDX lines.

- [ ] **Step 7: Commit**

```bash
git add subjects/math/00-wave-math-foundations/ComplexRotator.tsx subjects/math/00-wave-math-foundations/EulerCircle.tsx subjects/math/00-wave-math-foundations/figures-1-2.test.tsx
git commit -m "feat: complex rotation and Euler circle figures"
```
