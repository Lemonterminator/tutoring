### Task 3: The caliper figure — snapshot and history side by side

The student drags two markers on the snapshot graph to measure λ, two markers on the
history graph to measure T, and the readout divides them. The measured speed starts wrong
(3.50 m/s against a true 4.00 m/s) so there is something to fix.

**Files:**
- Create: `subjects/physics/01-traveling-waves/WaveCalipers.tsx`
- Test: `subjects/physics/01-traveling-waves/WaveCalipers.test.tsx`

**Interfaces:**
- Consumes, from `./wave1d` (task 2): `fromLambdaAndPeriod`, `displacement`,
  `waveSpeed`, `nearestMarker`, `measuredSpeed`, `type Wave1D`, `type Marker`.
  From the framework: `useReportState` (`../../../framework/ask/Figure`),
  `pick` (`../../../framework/i18n/ui`), `cssVar` (`../../../framework/interact/draw`),
  `fixed` (`../../../framework/interact/format`),
  `SimCanvas` (`../../../framework/interact/SimCanvas`).
- Produces: `WaveCalipers` — a component taking no props, default-exported as a named
  export `export function WaveCalipers()`.

jsdom returns `null` from `getContext`, so `draw` never runs in tests and pointer
coordinates are meaningless there. All assertions are on the rendered readouts and
buttons, never on pixels.

---

- [ ] **Step 1: Write the failing test**

`subjects/physics/01-traveling-waves/WaveCalipers.test.tsx`:

```tsx
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../../../framework/i18n/state';
import { WaveCalipers } from './WaveCalipers';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('the figure offers one canvas describing both graphs', () => {
  const { container } = render(<WaveCalipers />);
  const canvas = container.querySelector('canvas');
  expect(canvas).not.toBeNull();
  expect(canvas?.getAttribute('aria-label')).toContain('snapshot');
});

test('it shows the true wave speed so the measurement can be checked against it', () => {
  const { container } = render(<WaveCalipers />);
  expect(container.textContent).toContain('4.00');
});

test('the default marker positions give a deliberately wrong speed', () => {
  const { container } = render(<WaveCalipers />);
  expect(container.textContent).toContain('0.70');
  expect(container.textContent).toContain('0.20');
  expect(container.textContent).toContain('3.50');
});

test('the play button changes label when pressed', () => {
  const { getByText } = render(<WaveCalipers />);
  const button = getByText('Play');
  fireEvent.click(button);
  expect(button.textContent).toBe('Pause');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/01-traveling-waves/WaveCalipers.test.tsx`
Expected: FAIL, resolving `./WaveCalipers` fails.

- [ ] **Step 3: Write the implementation**

`subjects/physics/01-traveling-waves/WaveCalipers.tsx`:

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { pick } from '../../../framework/i18n/ui';
import { cssVar } from '../../../framework/interact/draw';
import { fixed } from '../../../framework/interact/format';
import { SimCanvas, type PointerInfo } from '../../../framework/interact/SimCanvas';
import { displacement, fromLambdaAndPeriod, measuredSpeed, nearestMarker, waveSpeed } from './wave1d';

const WAVE = fromLambdaAndPeriod(1, 2, 0.5); // λ = 2 m, T = 0.5 s, v = 4 m/s
const X_MAX = 6; // metres shown on the snapshot
const T_MAX = 1.5; // seconds shown on the history
const HEIGHT = 420;
const SAMPLES = 260;

type Handle = 'xa' | 'xb' | 'ta' | 'tb';

function layout(w: number, h: number) {
  return {
    left: 44,
    right: w - 14,
    topTop: 26,
    topBottom: h * 0.42,
    bottomTop: h * 0.56,
    bottomBottom: h - 26,
  };
}

export function WaveCalipers() {
  const [xa, setXa] = useState(0.5);
  const [xb, setXb] = useState(1.2);
  const [ta, setTa] = useState(0.1);
  const [tb, setTb] = useState(0.3);
  const [playing, setPlaying] = useState(false);
  const [, repaint] = useState(0);
  const time = useRef(0);
  const dragging = useRef<Handle | null>(null);
  const report = useReportState();

  const dx = Math.abs(xb - xa);
  const dt = Math.abs(tb - ta);

  useEffect(() => report({ dx, dt }), [dx, dt]);

  function onTick(step: number) {
    time.current = (time.current + step) % T_MAX;
    repaint((n) => n + 1);
  }

  function onPointer(p: PointerInfo) {
    if (p.kind === 'up') {
      dragging.current = null;
      return;
    }
    const { left, right } = layout(p.w, p.h);
    const span = Math.max(1, right - left);
    const fraction = Math.min(1, Math.max(0, (p.x - left) / span));
    const onTopPanel = p.y < p.h * 0.5;

    if (p.kind === 'down') {
      const value = fraction * (onTopPanel ? X_MAX : T_MAX);
      dragging.current = nearestMarker(
        value,
        onTopPanel
          ? [{ id: 'xa', at: xa }, { id: 'xb', at: xb }]
          : [{ id: 'ta', at: ta }, { id: 'tb', at: tb }],
      ) as Handle;
    }
    const handle = dragging.current;
    if (!handle) return;
    const isTopHandle = handle === 'xa' || handle === 'xb';
    const value = fraction * (isTopHandle ? X_MAX : T_MAX);
    if (handle === 'xa') setXa(value);
    else if (handle === 'xb') setXb(value);
    else if (handle === 'ta') setTa(value);
    else setTb(value);
  }

  function drawPanel(
    ctx: CanvasRenderingContext2D,
    box: { left: number; right: number; top: number; bottom: number },
    valueAt: (fraction: number) => number,
    markers: number[],
    markerMax: number,
    caption: string,
  ) {
    const mid = (box.top + box.bottom) / 2;
    const amp = (box.bottom - box.top) * 0.38;

    ctx.strokeStyle = cssVar('--axis');
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(box.left, mid);
    ctx.lineTo(box.right, mid);
    ctx.stroke();

    ctx.fillStyle = cssVar('--muted');
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(caption, box.left, box.top - 8);

    ctx.strokeStyle = cssVar('--accent');
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= SAMPLES; i++) {
      const fraction = i / SAMPLES;
      const px = box.left + fraction * (box.right - box.left);
      const py = mid - valueAt(fraction) * amp;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.strokeStyle = cssVar('--accent-2');
    ctx.fillStyle = cssVar('--accent-2');
    ctx.lineWidth = 2;
    for (const marker of markers) {
      const px = box.left + (marker / markerMax) * (box.right - box.left);
      ctx.beginPath();
      ctx.moveTo(px, box.top);
      ctx.lineTo(px, box.bottom);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, box.bottom, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const box = layout(w, h);
    const t = time.current;
    drawPanel(
      ctx,
      { left: box.left, right: box.right, top: box.topTop, bottom: box.topBottom },
      (fraction) => displacement(WAVE, fraction * X_MAX, t),
      [xa, xb],
      X_MAX,
      pick({ en: 'snapshot: y against position x (metres)', fi: 'tilannekuva: y paikan x funktiona (metreinä)' }),
    );
    drawPanel(
      ctx,
      { left: box.left, right: box.right, top: box.bottomTop, bottom: box.bottomBottom },
      (fraction) => displacement(WAVE, xa, fraction * T_MAX),
      [ta, tb],
      T_MAX,
      pick({ en: 'history at the first marker: y against time t (seconds)', fi: 'historia ensimmäisessä merkissä: y ajan t funktiona (sekunteina)' }),
    );
  }

  const measured = measuredSpeed(dx, dt);

  return (
    <div class="sim">
      <SimCanvas
        draw={draw}
        height={HEIGHT}
        running={playing}
        onTick={onTick}
        onPointer={onPointer}
        label={pick({
          en: 'Two graphs of the same wave: a snapshot against position and a history against time, each with two draggable markers',
          fi: 'Kaksi kuvaajaa samasta aallosta: tilannekuva paikan suhteen ja historia ajan suhteen, kummassakin kaksi siirrettävää merkkiä',
        })}
      />
      <p class="sim__hint">
        {pick({
          en: 'Drag the orange markers. Put the top pair one whole wave apart and the bottom pair one whole cycle apart.',
          fi: 'Siirrä oransseja merkkejä. Aseta ylempi pari yhden aallon päähän toisistaan ja alempi pari yhden jakson päähän.',
        })}
      </p>
      <div class="controls">
        <button type="button" class="btn btn--ghost" onClick={() => setPlaying((p) => !p)}>
          {playing ? pick({ en: 'Pause', fi: 'Tauko' }) : pick({ en: 'Play', fi: 'Toista' })}
        </button>
      </div>
      <div class="controls">
        <span class="readout">Δx = {fixed(dx)} m</span>
        <span class="readout">Δt = {fixed(dt)} s</span>
        <span class="readout readout--active">
          Δx / Δt = {fixed(measured)} m/s
        </span>
        <span class="readout">
          {pick({ en: 'true v', fi: 'todellinen v' })} = {fixed(waveSpeed(WAVE))} m/s
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/01-traveling-waves/WaveCalipers.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Gate**

Run: `npx vitest run`
Expected: PASS. Repo total **26 test files, 94 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add subjects/physics/01-traveling-waves/WaveCalipers.tsx subjects/physics/01-traveling-waves/WaveCalipers.test.tsx
git commit -m "feat: caliper figure for measuring wavelength and period"
```
