### Task 7: Simulation and audio toolkit

**Files:**
- Create: `framework/interact/format.ts`, `framework/interact/draw.ts`, `framework/interact/useAnimationFrame.ts`, `framework/interact/SimCanvas.tsx`, `framework/interact/Controls.tsx`
- Create: `framework/audio/decibel.ts`, `framework/audio/tone.ts`
- Test: `framework/interact/format.test.ts`, `framework/interact/Controls.test.tsx`, `framework/audio/decibel.test.ts`, `framework/audio/tone.test.ts`

**Interfaces:**
- Produces (`format.ts`): `sci(x: number, digits = 1): string` → `"1.0 × 10⁻⁶"`; `fixed(x: number, digits = 2): string` → typographic minus, never `"-0.00"`.
- Produces (`draw.ts`): `cssVar(name, fallback = '#888'): string`; `drawArrow(ctx, x0, y0, x1, y1, color, width = 2.5)`; `type Frame = { ox: number; oy: number; scale: number }`; `drawAxes(ctx, w, h, frame, labels: [string, string])` (unit grid, axes, labels).
- Produces (`useAnimationFrame.ts`): `useAnimationFrame(target: RefObject<Element>, onFrame: (dt: number) => void, running: boolean)` — `dt` in seconds, clamped to [0, 0.05]; paused while the element is off-screen; no-op without `requestAnimationFrame`.
- Produces (`SimCanvas.tsx`): `type Draw = (ctx, w, h) => void`; `type PointerInfo = { x; y; w; h; kind: 'down' | 'move' | 'up' }`; `<SimCanvas draw height? running? onTick? onPointer? label />` — CSS-pixel coordinates, repaints after every render and every frame while running.
- Produces (`Controls.tsx`): `<Slider label min max step value onInput display? />` (number callback); `<Segmented label options={[{ value, label }]} value onChange />`.
- Produces (`decibel.ts`): `I0 = 1e-12`; `intensityToDb(I, ref = I0)`; `dbToIntensity(L, ref = I0)`; `ampRatioToDb(r)`; `dbToAmpRatio(dB)`; `addLevels(...levels)`.
- Produces (`tone.ts`): `MAX_GAIN = 0.2`; `clampGain(g)`; `class Tone { start(frequency, gain): void; stop(): void }` — `start` on a running tone just retunes it.

- [ ] **Step 1: Write the failing tests**

`framework/interact/format.test.ts`:

```ts
import { expect, test } from 'vitest';
import { fixed, sci } from './format';

test.each([
  [1e-6, '1.0 × 10⁻⁶'],
  [3.2e-12, '3.2 × 10⁻¹²'],
  [1, '1.0 × 10⁰'],
  [9.96e-7, '1.0 × 10⁻⁶'],
  [250, '2.5 × 10²'],
])('sci(%s) = %s', (x, expected) => {
  expect(sci(x)).toBe(expected);
});

test('fixed uses a typographic minus and never shows negative zero', () => {
  expect(fixed(-1.5708)).toBe('−1.57');
  expect(fixed(-3e-16)).toBe('0.00');
  expect(fixed(18.43, 0)).toBe('18');
});
```

`framework/interact/Controls.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { Segmented, Slider } from './Controls';

afterEach(cleanup);

test('slider reports numbers, segmented reports the chosen value', () => {
  const seen: unknown[] = [];
  render(
    <>
      <Slider label="ω" min={0} max={4} step={0.1} value={1} onInput={(v) => seen.push(v)} display="1.0 rad/s" />
      <Segmented label="mode" value="a" onChange={(v) => seen.push(v)} options={[{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }]} />
    </>,
  );
  fireEvent.input(screen.getByRole('slider'), { target: { value: '2.5' } });
  fireEvent.click(screen.getByRole('button', { name: 'B' }));
  expect(seen).toEqual([2.5, 'b']);
  expect(screen.getByRole('button', { name: 'A' }).getAttribute('aria-pressed')).toBe('true');
});
```

`framework/audio/decibel.test.ts`:

```ts
import { expect, test } from 'vitest';
import { addLevels, ampRatioToDb, dbToAmpRatio, dbToIntensity, intensityToDb } from './decibel';

test('threshold of hearing is 0 dB and 1 W/m² is 120 dB', () => {
  expect(intensityToDb(1e-12)).toBeCloseTo(0, 10);
  expect(intensityToDb(1)).toBeCloseTo(120, 10);
  expect(dbToIntensity(60)).toBeCloseTo(1e-6, 15);
});

test('amplitude ratios use 20 lg', () => {
  expect(ampRatioToDb(10)).toBeCloseTo(20, 10);
  expect(dbToAmpRatio(-40)).toBeCloseTo(0.01, 12);
});

test('two equal sources add about 3 dB', () => {
  expect(addLevels(70, 70)).toBeCloseTo(73.01, 2);
});
```

`framework/audio/tone.test.ts`:

```ts
import { expect, test } from 'vitest';
import { clampGain, MAX_GAIN, Tone } from './tone';

test('gain is capped and sanitised', () => {
  expect(clampGain(5)).toBe(MAX_GAIN);
  expect(clampGain(-1)).toBe(0);
  expect(clampGain(Number.NaN)).toBe(0);
  expect(clampGain(0.1)).toBe(0.1);
});

test('a tone without Web Audio support is silently a no-op', () => {
  const tone = new Tone();
  expect(() => {
    tone.start(440, 0.1);
    tone.stop();
  }).not.toThrow();
});
```

- [ ] **Step 2: Run them to confirm they fail**

Run: `npx vitest run framework/interact framework/audio`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement formatting, decibels and tone**

`framework/interact/format.ts`:

```ts
const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

const power = (e: number) => `10${[...String(e)].map((ch) => SUPERSCRIPT[ch]).join('')}`;

/** Scientific notation as printed in Finnish textbooks: 1.0 × 10⁻⁶. */
export function sci(x: number, digits = 1): string {
  if (x === 0) return '0';
  let exponent = Math.floor(Math.log10(Math.abs(x)) + 1e-9);
  let mantissa = x / 10 ** exponent;
  if (Math.abs(Number(mantissa.toFixed(digits))) >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  return `${mantissa.toFixed(digits)} × ${power(exponent)}`;
}

export function fixed(x: number, digits = 2): string {
  const s = x.toFixed(digits);
  return Number(s) === 0 ? s.replace('-', '') : s.replace('-', '−');
}
```

`framework/audio/decibel.ts`:

```ts
/** Threshold of hearing, W/m². */
export const I0 = 1e-12;

export const intensityToDb = (intensity: number, ref = I0) => 10 * Math.log10(intensity / ref);
export const dbToIntensity = (level: number, ref = I0) => ref * 10 ** (level / 10);
export const ampRatioToDb = (ratio: number) => 20 * Math.log10(ratio);
export const dbToAmpRatio = (dB: number) => 10 ** (dB / 20);

/** Incoherent sources add intensities, not decibels. */
export const addLevels = (...levels: number[]) => intensityToDb(levels.reduce((sum, level) => sum + dbToIntensity(level), 0));
```

`framework/audio/tone.ts`:

```ts
export const MAX_GAIN = 0.2;

export function clampGain(gain: number): number {
  return Number.isFinite(gain) ? Math.min(MAX_GAIN, Math.max(0, gain)) : 0;
}

/** One sine oscillator. Start it from a click: browsers block audio that starts on its own. */
export class Tone {
  private ctx: AudioContext | null = null;
  private osc: OscillatorNode | null = null;
  private gain: GainNode | null = null;

  start(frequency: number, gain: number): void {
    if (typeof AudioContext === 'undefined') return;
    this.ctx ??= new AudioContext();
    void this.ctx.resume();
    if (!this.osc || !this.gain) {
      this.gain = this.ctx.createGain();
      this.gain.gain.value = 0;
      this.osc = this.ctx.createOscillator();
      this.osc.connect(this.gain).connect(this.ctx.destination);
      this.osc.start();
    }
    const now = this.ctx.currentTime;
    this.osc.frequency.setTargetAtTime(frequency, now, 0.02);
    this.gain.gain.setTargetAtTime(clampGain(gain), now, 0.03);
  }

  stop(): void {
    if (!this.ctx || !this.osc || !this.gain) return;
    const now = this.ctx.currentTime;
    this.gain.gain.setTargetAtTime(0, now, 0.03);
    this.osc.stop(now + 0.2);
    this.osc = null;
    this.gain = null;
  }
}
```

- [ ] **Step 4: Implement drawing, animation loop, canvas and controls**

`framework/interact/draw.ts`:

```ts
export function cssVar(name: string, fallback = '#888'): string {
  if (typeof document === 'undefined') return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

export function drawArrow(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string, width = 2.5): void {
  const length = Math.hypot(x1 - x0, y1 - y0);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  if (length > 1) {
    const angle = Math.atan2(y1 - y0, x1 - x0);
    const head = Math.min(12, length * 0.4);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1 - head * Math.cos(angle - 0.45), y1 - head * Math.sin(angle - 0.45));
    ctx.lineTo(x1 - head * Math.cos(angle + 0.45), y1 - head * Math.sin(angle + 0.45));
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

/** Origin in CSS pixels and pixels per unit. */
export type Frame = { ox: number; oy: number; scale: number };

export function drawAxes(ctx: CanvasRenderingContext2D, w: number, h: number, frame: Frame, labels: [string, string]): void {
  const { ox, oy, scale } = frame;
  ctx.save();
  ctx.lineWidth = 1;
  ctx.strokeStyle = cssVar('--grid');
  for (let gx = Math.ceil(-ox / scale); gx <= (w - ox) / scale; gx++) {
    ctx.beginPath();
    ctx.moveTo(ox + gx * scale, 0);
    ctx.lineTo(ox + gx * scale, h);
    ctx.stroke();
  }
  for (let gy = Math.ceil((oy - h) / scale); gy <= oy / scale; gy++) {
    ctx.beginPath();
    ctx.moveTo(0, oy - gy * scale);
    ctx.lineTo(w, oy - gy * scale);
    ctx.stroke();
  }
  ctx.strokeStyle = cssVar('--axis');
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, oy);
  ctx.lineTo(w, oy);
  ctx.moveTo(ox, 0);
  ctx.lineTo(ox, h);
  ctx.stroke();
  ctx.fillStyle = cssVar('--muted');
  ctx.font = '13px system-ui, sans-serif';
  ctx.fillText(labels[0], w - 8 - ctx.measureText(labels[0]).width, oy - 8);
  ctx.fillText(labels[1], ox + 8, 16);
  ctx.restore();
}
```

`framework/interact/useAnimationFrame.ts`:

```ts
import type { RefObject } from 'preact';
import { useEffect, useRef } from 'preact/hooks';

/** Calls onFrame(dt in seconds) every frame while running and while the element is on screen. */
export function useAnimationFrame(target: RefObject<Element>, onFrame: (dt: number) => void, running: boolean): void {
  const latest = useRef(onFrame);
  latest.current = onFrame;

  useEffect(() => {
    const element = target.current;
    if (!running || !element || typeof requestAnimationFrame === 'undefined') return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      latest.current(dt);
      raf = requestAnimationFrame(tick);
    };
    const start = () => {
      if (raf) return;
      last = performance.now();
      raf = requestAnimationFrame(tick);
    };
    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
    };
    if (typeof IntersectionObserver === 'undefined') {
      start();
      return stop;
    }
    const observer = new IntersectionObserver(([entry]) => (entry.isIntersecting ? start() : stop()));
    observer.observe(element);
    return () => {
      stop();
      observer.disconnect();
    };
  }, [running, target]);
}
```

`framework/interact/SimCanvas.tsx`:

```tsx
import { useEffect, useRef } from 'preact/hooks';
import { useAnimationFrame } from './useAnimationFrame';

export type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
export type PointerInfo = { x: number; y: number; w: number; h: number; kind: 'down' | 'move' | 'up' };

type Props = {
  draw: Draw;
  label: string;
  height?: number;
  running?: boolean;
  onTick?: (dt: number) => void;
  onPointer?: (pointer: PointerInfo) => void;
};

export function SimCanvas({ draw, label, height = 320, running = false, onTick, onPointer }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  const paint = useRef(() => {});
  paint.current = () => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.clientWidth || 600;
    const pw = Math.round(w * dpr);
    const ph = Math.round(height * dpr);
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw;
      canvas.height = ph;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, height);
    draw(ctx, w, height);
  };

  useEffect(() => paint.current());

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => paint.current());
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  useAnimationFrame(ref, (dt) => {
    onTick?.(dt);
    paint.current();
  }, running);

  const pointer = (kind: PointerInfo['kind']) => (event: PointerEvent) => {
    const canvas = ref.current;
    if (!onPointer || !canvas) return;
    if (kind === 'down') canvas.setPointerCapture?.(event.pointerId);
    const rect = canvas.getBoundingClientRect();
    onPointer({ x: event.clientX - rect.left, y: event.clientY - rect.top, w: rect.width, h: rect.height, kind });
  };

  return (
    <canvas
      ref={ref}
      class="sim-canvas"
      style={{ height: `${height}px` }}
      role="img"
      aria-label={label}
      onPointerDown={pointer('down')}
      onPointerMove={pointer('move')}
      onPointerUp={pointer('up')}
      onPointerCancel={pointer('up')}
    />
  );
}
```

`framework/interact/Controls.tsx`:

```tsx
type SliderProps = {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onInput: (value: number) => void;
  display?: string;
};

export function Slider({ label, min, max, step, value, onInput, display }: SliderProps) {
  return (
    <label class="slider">
      <span class="slider__label">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onInput={(e) => onInput(Number((e.target as HTMLInputElement).value))} />
      <output class="slider__value">{display ?? String(value)}</output>
    </label>
  );
}

type SegmentedProps<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
};

export function Segmented<T extends string>({ label, options, value, onChange }: SegmentedProps<T>) {
  return (
    <div class="seg" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.value} type="button" aria-pressed={option.value === value} onClick={() => onChange(option.value)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Run the tests to confirm they pass**

Run: `npx vitest run framework/interact framework/audio`
Expected: PASS (12 tests).

- [ ] **Step 6: Typecheck and commit**

Run: `npm run typecheck` → no errors.

```bash
git add framework/interact framework/audio
git commit -m "feat: canvas simulation toolkit, controls and Web Audio tone"
```
