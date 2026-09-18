### Task 11: Reflection at a boundary, with an impedance slider

A pulse runs into a junction between two media. The slider is the impedance ratio
`Z₂/Z₁`, and a fixed end and a free end are simply its two extremes. At the ratio for air
against soft tissue the readout says 99.9 % reflects — which is the answer to the
textbook's opening question about the ultrasound gel.

This figure is **analytic**, not a finite-difference run: a step in wave speed needs a
variable-coefficient scheme, which would give up the exactness that task 8 relies on. The
closed form is exact anyway, and it produces the 99.9 % the lesson quotes.

**Files:**
- Create: `subjects/physics/02-standing-waves/ImpedanceReflection.tsx`
- Test: `subjects/physics/02-standing-waves/ImpedanceReflection.test.tsx`

**Interfaces:**
- Consumes: `useReportState`, `pick`, `Slider`, `cssVar`, `SimCanvas`.
- Produces, from `subjects/physics/02-standing-waves/ImpedanceReflection.tsx`:
  - `displacementReflection(ratio: number): number` — `(1 − ratio) / (1 + ratio)`
  - `displacementTransmission(ratio: number): number` — `2 / (1 + ratio)`
  - `reflectedFraction(ratio: number): number` — the reflected share of the energy
  - `transmittedFraction(ratio: number): number` — the transmitted share
  - `export function ImpedanceReflection()`, no props

The sign convention matters and is easy to get backwards. These are the coefficients for
**displacement**: a much heavier second medium (`ratio → ∞`) gives `r → −1`, an inverted
reflection, which is the fixed end. For **pressure** every sign flips. The lesson says
which one it means; so does the code.

---

- [ ] **Step 1: Write the failing test**

`subjects/physics/02-standing-waves/ImpedanceReflection.test.tsx`:

```tsx
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../../../framework/i18n/state';
import {
  displacementReflection,
  displacementTransmission,
  ImpedanceReflection,
  reflectedFraction,
  transmittedFraction,
} from './ImpedanceReflection';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('a fixed end and a free end are the two extremes of the same slider', () => {
  expect(displacementReflection(1e9)).toBeCloseTo(-1, 6); // immovable second medium
  expect(displacementReflection(1e-9)).toBeCloseTo(1, 6); // weightless second medium
  expect(displacementReflection(1)).toBeCloseTo(0, 12); // matched: nothing comes back
  expect(displacementTransmission(1)).toBeCloseTo(1, 12);
});

test('reflected and transmitted energy always add up to all of it', () => {
  for (const ratio of [0.01, 0.4, 1, 2.5, 40, 4000]) {
    expect(reflectedFraction(ratio) + transmittedFraction(ratio)).toBeCloseTo(1, 9);
  }
});

test('the air to tissue preset reports that almost everything reflects', () => {
  const { container, getByText } = render(<ImpedanceReflection />);
  fireEvent.click(getByText('Air to tissue'));
  expect(container.textContent).toContain('99.9');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/02-standing-waves/ImpedanceReflection.test.tsx`
Expected: FAIL, resolving `./ImpedanceReflection` fails.

- [ ] **Step 3: Write the implementation**

`subjects/physics/02-standing-waves/ImpedanceReflection.tsx`:

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { pick } from '../../../framework/i18n/ui';
import { Slider } from '../../../framework/interact/Controls';
import { cssVar } from '../../../framework/interact/draw';
import { SimCanvas } from '../../../framework/interact/SimCanvas';

/**
 * Amplitude coefficients for the DISPLACEMENT of a wave meeting a change of impedance
 * Z = ρc, with ratio = Z₂/Z₁. A much heavier second medium gives r → −1: the reflection
 * comes back upside down, which is exactly a fixed end. A much lighter one gives r → +1,
 * a free end. For PRESSURE every sign is the other way round.
 */
export const displacementReflection = (ratio: number) => (1 - ratio) / (1 + ratio);
export const displacementTransmission = (ratio: number) => 2 / (1 + ratio);

export const reflectedFraction = (ratio: number) => displacementReflection(ratio) ** 2;
export const transmittedFraction = (ratio: number) => ratio * displacementTransmission(ratio) ** 2;

const BOUNDARY = 0.5;
const WIDTH = 0.05;
const START = 0.15;
const RUN_TIME = 0.85;
const HEIGHT = 260;

/** Air is about 400 and soft tissue about 1.6 million, in SI units of impedance. */
const PRESETS = [
  { key: 'fixed', ratio: 1e4, en: 'Fixed end', fi: 'Kiinteä pää' },
  { key: 'free', ratio: 1e-4, en: 'Free end', fi: 'Vapaa pää' },
  { key: 'matched', ratio: 1, en: 'Matched', fi: 'Sovitettu' },
  { key: 'tissue', ratio: 4000, en: 'Air to tissue', fi: 'Ilmasta kudokseen' },
];

const bump = (s: number) => Math.exp(-((s / WIDTH) ** 2));

export function ImpedanceReflection() {
  const [logRatio, setLogRatio] = useState(4);
  const [, repaint] = useState(0);
  const time = useRef(0);
  const report = useReportState();

  const ratio = 10 ** logRatio;
  const r = displacementReflection(ratio);
  const t = displacementTransmission(ratio);

  useEffect(() => {
    time.current = 0;
    report({ ratio });
  }, [logRatio]);

  function onTick(step: number) {
    time.current = (time.current + step * 0.35) % RUN_TIME;
    repaint((n) => n + 1);
  }

  function draw(ctx: CanvasRenderingContext2D, w: number, h: number) {
    const left = 16;
    const right = w - 16;
    const span = right - left;
    const mid = h * 0.52;
    const amp = h * 0.3;
    const elapsed = time.current;
    const boundaryX = left + BOUNDARY * span;

    ctx.fillStyle = cssVar('--grid');
    ctx.fillRect(boundaryX, 0, right - boundaryX, h);
    ctx.strokeStyle = cssVar('--axis');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(boundaryX, 0);
    ctx.lineTo(boundaryX, h);
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(left, mid);
    ctx.lineTo(right, mid);
    ctx.stroke();

    const value = (x: number) => {
      if (x <= BOUNDARY) {
        return bump(x - START - elapsed) + r * bump(2 * BOUNDARY - x - START - elapsed);
      }
      return t * bump(BOUNDARY + (x - BOUNDARY) / ratio - START - elapsed);
    };

    ctx.strokeStyle = cssVar('--accent');
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    for (let i = 0; i <= 400; i++) {
      const x = i / 400;
      const px = left + x * span;
      const py = mid - value(x) * amp;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    ctx.fillStyle = cssVar('--muted');
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(pick({ en: 'medium 1', fi: 'väliaine 1' }), left + 4, 16);
    ctx.fillText(pick({ en: 'medium 2', fi: 'väliaine 2' }), boundaryX + 6, 16);
  }

  return (
    <div class="sim">
      <SimCanvas
        draw={draw}
        height={HEIGHT}
        running
        onTick={onTick}
        label={pick({
          en: 'A pulse travelling into a boundary between two media, splitting into a reflected and a transmitted pulse',
          fi: 'Pulssi saapuu kahden väliaineen rajapintaan ja jakautuu heijastuneeksi ja läpäisseeksi pulssiksi',
        })}
      />
      <div class="controls">
        {PRESETS.map((preset) => (
          <button
            key={preset.key}
            type="button"
            class="btn btn--ghost"
            onClick={() => setLogRatio(Math.log10(preset.ratio))}
          >
            {pick({ en: preset.en, fi: preset.fi })}
          </button>
        ))}
      </div>
      <div class="controls">
        <Slider
          label={pick({ en: 'Impedance ratio', fi: 'Impedanssisuhde' })}
          min={-4}
          max={4}
          step={0.05}
          value={logRatio}
          onInput={setLogRatio}
          display={ratio >= 1 ? `${ratio.toPrecision(3)} : 1` : `1 : ${(1 / ratio).toPrecision(3)}`}
        />
      </div>
      <div class="controls">
        <span class="readout readout--active">
          {pick({ en: 'reflected', fi: 'heijastuu' })}: {(reflectedFraction(ratio) * 100).toFixed(1)} %
        </span>
        <span class="readout">
          {pick({ en: 'transmitted', fi: 'läpäisee' })}: {(transmittedFraction(ratio) * 100).toFixed(1)} %
        </span>
        <span class="readout">
          {r < 0
            ? pick({ en: 'the reflection comes back inverted', fi: 'heijastus palaa käännettynä' })
            : pick({ en: 'the reflection keeps its sign', fi: 'heijastus säilyttää merkkinsä' })}
        </span>
      </div>
      <p class="sim__hint">
        {pick({
          en: 'A fixed end and a free end are not two separate rules — they are the two ends of this one slider. Match the two media and the boundary disappears, which is the whole job of the gel in an ultrasound scan.',
          fi: 'Kiinteä ja vapaa pää eivät ole kaksi eri sääntöä — ne ovat tämän saman liukusäätimen ääripäät. Sovita väliaineet toisiinsa, ja rajapinta katoaa; juuri sitä geeli tekee ultraäänitutkimuksessa.',
        })}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/02-standing-waves/ImpedanceReflection.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Gate**

Run: `npx vitest run`
Expected: PASS. Repo total **33 test files, 127 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add subjects/physics/02-standing-waves/ImpedanceReflection.tsx subjects/physics/02-standing-waves/ImpedanceReflection.test.tsx
git commit -m "feat: reflection at an impedance boundary with fixed and free ends as limits"
```
