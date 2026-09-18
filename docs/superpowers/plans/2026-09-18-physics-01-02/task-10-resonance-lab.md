### Task 10: ResonanceLab — the figure the lesson is built on

Two modes over one live simulation:

- **Sweep.** The student drags a frequency slider. At most frequencies nothing happens; at
  a resonance the amplitude climbs and a standing pattern appears. Everything the student
  explores is recorded into a response curve, so the comb of peaks is something they
  discover rather than something they are shown. The node count and the wavelength in the
  readout are **measured from the envelope**, never taken from `modeWavelength`.
- **Pluck.** Release the medium from a triangle and watch it ring. A Goertzel spectrum at
  the first six harmonics updates live, and moving the pluck point changes the recipe —
  the hook into lesson 3.

**Files:**
- Create: `subjects/physics/02-standing-waves/ResonanceLab.tsx`
- Test: `subjects/physics/02-standing-waves/ResonanceLab.test.tsx`

**Interfaces:**
- Consumes, from `./fdwave` (task 8): `advance`, `createField`, `peak`, `pluck`,
  `sampleAt`, `type Field`. From `./modes` (task 9): `countNodesFromEnvelope`, `endsFor`,
  `goertzel`, `harmonicFrequency`, `modeAngularFrequency`, `nodePositions`,
  `spacingToWavelength`, `type PipeKind`. From
  `subjects/physics/_components/acoustics.ts` (task 1): `V_AIR`. From the framework:
  `useReportState`, `pick`, `Segmented`, `Slider`, `cssVar`, `fixed`, `SimCanvas`.
- Produces: `export function ResonanceLab()`, no props.

Physical readouts use a pipe **0.50 m** long in air at `V_AIR = 340` m/s, so the
normalised angular frequency ω maps to `(ω / 2π) · (340 / 0.50)` hertz. That makes the
string and open-pipe fundamental 340 Hz and the closed-pipe fundamental 170 Hz.

---

- [ ] **Step 1: Write the failing test**

`subjects/physics/02-standing-waves/ResonanceLab.test.tsx`:

```tsx
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../../../framework/i18n/state';
import { ResonanceLab } from './ResonanceLab';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('it offers the three boundary cases the syllabus asks about', () => {
  const { getByText } = render(<ResonanceLab />);
  expect(getByText('String, both ends fixed').getAttribute('aria-pressed')).toBe('true');
  expect(getByText('Pipe, both ends open')).toBeTruthy();
  expect(getByText('Pipe, one end closed')).toBeTruthy();
});

test('it starts in sweep mode and can switch to pluck', () => {
  const { container, getByText } = render(<ResonanceLab />);
  expect(container.textContent).toContain('Drive frequency');
  fireEvent.click(getByText('Pluck'));
  expect(container.textContent).toContain('Pluck position');
});

test('the readout reports a measured node count, not a formula', () => {
  const { container } = render(<ResonanceLab />);
  expect(container.textContent).toContain('measured');
});

test('changing the pipe keeps the figure on screen', () => {
  const { container, getByText } = render(<ResonanceLab />);
  fireEvent.click(getByText('Pipe, one end closed'));
  expect(getByText('Pipe, one end closed').getAttribute('aria-pressed')).toBe('true');
  expect(container.querySelector('canvas')).not.toBeNull();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/02-standing-waves/ResonanceLab.test.tsx`
Expected: FAIL, resolving `./ResonanceLab` fails.

- [ ] **Step 3: Write the implementation**

`subjects/physics/02-standing-waves/ResonanceLab.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { pick } from '../../../framework/i18n/ui';
import { Segmented, Slider } from '../../../framework/interact/Controls';
import { cssVar } from '../../../framework/interact/draw';
import { fixed } from '../../../framework/interact/format';
import { SimCanvas } from '../../../framework/interact/SimCanvas';
import { V_AIR } from '../_components/acoustics';
import { advance, createField, peak, pluck, sampleAt } from './fdwave';
import {
  countNodesFromEnvelope,
  endsFor,
  goertzel,
  harmonicFrequency,
  modeAngularFrequency,
  nodePositions,
  spacingToWavelength,
  type PipeKind,
} from './modes';

type Mode = 'sweep' | 'pluck';

const INTERVALS = 160;
const STEPS_PER_FRAME = 300;
const DAMPING = 0.05;
const DRIVE_AMPLITUDE = 0.002;
const DRIVE_FRACTION = 0.31;
const ENVELOPE_DECAY = 0.9985;
const OMEGA_MIN = 1;
const OMEGA_MAX = 16.5;
const BINS = 150;
const PROBE = 0.23;
const SPECTRUM_SAMPLES = 4096;
const HARMONICS = 6;
const LENGTH_M = 0.5;
const HEIGHT = 380;

const toHertz = (omega: number) => (omega / (2 * Math.PI)) * (V_AIR / LENGTH_M);

export function ResonanceLab() {
  const [kind, setKind] = useState<PipeKind>('string');
  const [mode, setMode] = useState<Mode>('sweep');
  const [omega, setOmega] = useState(Math.PI);
  const [pluckAt, setPluckAt] = useState(0.5);
  const [, repaint] = useState(0);

  const field = useMemo(() => createField(INTERVALS), []);
  const response = useRef(new Float64Array(BINS));
  const samples = useRef<number[]>([]);
  const report = useReportState();

  const ends = endsFor(kind);
  const driveIndex = Math.round(DRIVE_FRACTION * INTERVALS);

  // Any change of case, mode or drive frequency invalidates what is on the grid.
  useEffect(() => {
    field.prev.fill(0);
    field.cur.fill(0);
    field.spare.fill(0);
    field.envelope.fill(0);
    field.time = 0;
    samples.current = [];
    if (mode === 'pluck') pluck(field, pluckAt, 1);
    report({ kind, mode, omega, pluckAt });
  }, [kind, mode, omega, pluckAt]);

  useEffect(() => {
    response.current = new Float64Array(BINS);
  }, [kind]);

  function onTick() {
    if (mode === 'sweep') {
      advance(field, STEPS_PER_FRAME, ends, DAMPING, { index: driveIndex, amplitude: DRIVE_AMPLITUDE, angularFrequency: omega }, ENVELOPE_DECAY);
      const bin = Math.min(BINS - 1, Math.max(0, Math.round(((omega - OMEGA_MIN) / (OMEGA_MAX - OMEGA_MIN)) * (BINS - 1))));
      const level = peak(field.envelope);
      if (level > response.current[bin]) response.current[bin] = level;
    } else {
      for (let s = 0; s < STEPS_PER_FRAME; s++) {
        advance(field, 1, ends, DAMPING * 0.2, null, ENVELOPE_DECAY);
        samples.current.push(sampleAt(field, PROBE));
      }
      if (samples.current.length > SPECTRUM_SAMPLES) {
        samples.current = samples.current.slice(-SPECTRUM_SAMPLES);
      }
    }
    repaint((n) => n + 1);
  }

  const found = nodePositions(field.envelope);
  const measuredNodes = countNodesFromEnvelope(field.envelope);
  const measuredLambda = spacingToWavelength(found);

  const spectrum = useMemo(() => {
    if (mode !== 'pluck' || samples.current.length < 512) return [] as number[];
    const bars: number[] = [];
    for (let n = 1; n <= HARMONICS; n++) {
      bars.push(goertzel(samples.current, modeAngularFrequency(kind, n), field.dx));
    }
    const top = Math.max(...bars, 1e-12);
    return bars.map((b) => b / top);
  }, [mode, kind, samples.current.length]);

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const left = 18;
    const right = w - 18;
    const span = right - left;
    const topMid = h * 0.28;
    const topAmp = h * 0.2;
    const lowerTop = h * 0.56;
    const lowerBottom = h - 24;

    const accent = cssVar('--accent');
    const secondary = cssVar('--accent-2');
    const third = cssVar('--accent-3');
    const axis = cssVar('--axis');
    const muted = cssVar('--muted');

    ctx.strokeStyle = axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, topMid);
    ctx.lineTo(right, topMid);
    ctx.stroke();

    const scale = topAmp / Math.max(peak(field.envelope), 1e-6);

    // the measured envelope, as a faint outline above and below
    ctx.strokeStyle = secondary;
    ctx.lineWidth = 1.5;
    for (const sign of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i < field.points; i++) {
        const px = left + (i / (field.points - 1)) * span;
        const py = topMid - sign * field.envelope[i] * scale;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = accent;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i < field.points; i++) {
      const px = left + (i / (field.points - 1)) * span;
      const py = topMid - field.cur[i] * scale;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = third;
    for (const position of found) {
      ctx.beginPath();
      ctx.arc(left + position * span, topMid, 4, 0, 2 * Math.PI);
      ctx.fill();
    }

    ctx.fillStyle = muted;
    ctx.font = '12px system-ui, sans-serif';

    if (mode === 'sweep') {
      ctx.fillText(
        pick({ en: 'what you have explored so far', fi: 'mitä olet tähän mennessä tutkinut' }),
        left,
        lowerTop - 6,
      );
      const top = Math.max(...response.current, 1e-9);
      ctx.strokeStyle = accent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      for (let b = 0; b < BINS; b++) {
        const px = left + (b / (BINS - 1)) * span;
        const py = lowerBottom - (response.current[b] / top) * (lowerBottom - lowerTop);
        if (b === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
      const markerX = left + ((omega - OMEGA_MIN) / (OMEGA_MAX - OMEGA_MIN)) * span;
      ctx.strokeStyle = secondary;
      ctx.beginPath();
      ctx.moveTo(markerX, lowerTop);
      ctx.lineTo(markerX, lowerBottom);
      ctx.stroke();
    } else {
      ctx.fillText(
        pick({ en: 'harmonics present in the sound', fi: 'äänessä esiintyvät harmoniset' }),
        left,
        lowerTop - 6,
      );
      const width = span / (HARMONICS * 2);
      spectrum.forEach((value, i) => {
        const px = left + (i * 2 + 0.5) * width;
        const barHeight = value * (lowerBottom - lowerTop);
        ctx.fillStyle = accent;
        ctx.fillRect(px, lowerBottom - barHeight, width, barHeight);
        ctx.fillStyle = muted;
        ctx.fillText(String(i + 1), px + width / 2 - 3, lowerBottom + 14);
      });
    }
  }

  return (
    <div class="sim">
      <SimCanvas
        draw={draw}
        height={HEIGHT}
        running
        onTick={onTick}
        label={pick({
          en: 'A string or pipe solved step by step, with its measured envelope and either a response curve or a harmonic spectrum below',
          fi: 'Köysi tai putki ratkaistuna askel askeleelta, mitattu verhokäyrä sekä alla joko vastekäyrä tai harmonisten spektri',
        })}
      />
      <div class="controls">
        <Segmented
          label={pick({ en: 'Boundary conditions', fi: 'Reunaehdot' })}
          value={kind}
          onChange={setKind}
          options={[
            { value: 'string', label: pick({ en: 'String, both ends fixed', fi: 'Köysi, molemmat päät kiinni' }) },
            { value: 'open', label: pick({ en: 'Pipe, both ends open', fi: 'Putki, molemmat päät auki' }) },
            { value: 'closed-open', label: pick({ en: 'Pipe, one end closed', fi: 'Putki, toinen pää suljettu' }) },
          ]}
        />
        <Segmented
          label={pick({ en: 'What to do', fi: 'Mitä tehdään' })}
          value={mode}
          onChange={setMode}
          options={[
            { value: 'sweep', label: pick({ en: 'Sweep', fi: 'Pyyhkäisy' }) },
            { value: 'pluck', label: pick({ en: 'Pluck', fi: 'Näppäys' }) },
          ]}
        />
      </div>
      <div class="controls">
        {mode === 'sweep' ? (
          <Slider
            label={pick({ en: 'Drive frequency', fi: 'Herätetaajuus' })}
            min={OMEGA_MIN}
            max={OMEGA_MAX}
            step={0.01}
            value={omega}
            onInput={setOmega}
            display={`${toHertz(omega).toFixed(0)} Hz`}
          />
        ) : (
          <Slider
            label={pick({ en: 'Pluck position', fi: 'Näppäyskohta' })}
            min={0.05}
            max={0.5}
            step={0.01}
            value={pluckAt}
            onInput={setPluckAt}
            display={`${(pluckAt * 100).toFixed(0)} %`}
          />
        )}
      </div>
      <div class="controls">
        <span class="readout readout--active">
          {pick({ en: 'measured nodes inside', fi: 'mitatut solmut sisällä' })}: {measuredNodes}
        </span>
        <span class="readout">
          {pick({ en: 'measured', fi: 'mitattu' })} λ ={' '}
          {measuredLambda > 0 ? `${fixed(measuredLambda * LENGTH_M)} m` : '—'}
        </span>
        <span class="readout">
          {pick({ en: 'first harmonic', fi: 'perustaajuus' })} ={' '}
          {harmonicFrequency(kind, 1, LENGTH_M, V_AIR).toFixed(0)} Hz
        </span>
      </div>
      <p class="sim__hint">
        {mode === 'sweep'
          ? pick({
              en: 'This is a real solution of the wave equation, in slow motion, with a little damping — which is why the peaks have width. Drag slowly: at most frequencies nothing builds up. Nobody told the simulation about 2L/n.',
              fi: 'Tämä on aaltoyhtälön todellinen ratkaisu hidastettuna ja pienellä vaimennuksella, minkä vuoksi huiput ovat leveitä. Vedä hitaasti: useimmilla taajuuksilla mitään ei kasva. Kukaan ei kertonut simulaatiolle kaavaa 2L/n.',
            })
          : pick({
              en: 'Release the medium and it sorts itself into harmonics on its own. Pluck exactly in the middle and the even harmonics vanish, because the middle is a node for every one of them.',
              fi: 'Päästä väliaine irti, ja se järjestyy itsestään harmonisiin. Näppää täsmälleen keskeltä, ja parilliset harmoniset katoavat, koska keskikohta on niiden kaikkien solmu.',
            })}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/02-standing-waves/ResonanceLab.test.tsx`
Expected: PASS (4 tests)

- [ ] **Step 5: Gate**

Run: `npx vitest run`
Expected: PASS. Repo total **32 test files, 124 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add subjects/physics/02-standing-waves/ResonanceLab.tsx subjects/physics/02-standing-waves/ResonanceLab.test.tsx
git commit -m "feat: resonance lab driving and plucking a solved wave equation"
```
