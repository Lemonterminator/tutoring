### Task 5: Why a curved string accelerates — a static SVG diagram

One short element of a string, the two tension forces pulling along the string at its ends,
and their resultant. Switching between a trough and a crest flips the resultant, which is
the whole causal story behind the wave equation. Plain SVG, no canvas, no animation, so it
renders and is fully testable in jsdom.

**Files:**
- Create: `subjects/physics/01-traveling-waves/StringElement.tsx`
- Test: `subjects/physics/01-traveling-waves/StringElement.test.tsx`

**Interfaces:**
- Consumes: `pick` (`../../../framework/i18n/ui`),
  `Segmented` (`../../../framework/interact/Controls`),
  `useReportState` (`../../../framework/ask/Figure`).
- Produces:
  - `type Point = { x: number; y: number }`
  - `tangentEnds(p0: Point, p1: Point, p2: Point, length: number): { left: Point; right: Point }`
  - `export function StringElement()`, no props.

`tangentEnds` returns where to put the two tension arrowheads. For a quadratic Bézier the
tangent at the start is along `p1 − p0` and at the end along `p2 − p1`; the string continues
backwards at the left end and forwards at the right end, so the left arrow is drawn against
the start tangent and the right arrow along the end tangent. In SVG y grows downwards, so a
trough uses a control point **below** the ends and both arrowheads then come out **above**
them — which is the picture of an upward resultant.

---

- [ ] **Step 1: Write the failing test**

`subjects/physics/01-traveling-waves/StringElement.test.tsx`:

```tsx
import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setLang } from '../../../framework/i18n/state';
import { StringElement, tangentEnds } from './StringElement';

afterEach(() => {
  cleanup();
  setLang('en');
});

test('for a trough both tension arrows point above the element ends', () => {
  const { left, right } = tangentEnds({ x: 80, y: 120 }, { x: 160, y: 190 }, { x: 240, y: 120 }, 60);
  expect(left.y).toBeLessThan(120);
  expect(right.y).toBeLessThan(120);
  expect(left.x).toBeLessThan(80);
  expect(right.x).toBeGreaterThan(240);
});

test('for a crest both tension arrows point below the element ends', () => {
  const { left, right } = tangentEnds({ x: 80, y: 120 }, { x: 160, y: 50 }, { x: 240, y: 120 }, 60);
  expect(left.y).toBeGreaterThan(120);
  expect(right.y).toBeGreaterThan(120);
});

test('switching from trough to crest flips the stated direction of the net force', () => {
  const { container, getByText } = render(<StringElement />);
  expect(container.textContent).toContain('upwards');
  fireEvent.click(getByText('Crest'));
  expect(container.textContent).toContain('downwards');
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/01-traveling-waves/StringElement.test.tsx`
Expected: FAIL, resolving `./StringElement` fails.

- [ ] **Step 3: Write the implementation**

`subjects/physics/01-traveling-waves/StringElement.tsx`:

```tsx
import { useEffect, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { pick } from '../../../framework/i18n/ui';
import { Segmented } from '../../../framework/interact/Controls';

export type Point = { x: number; y: number };

type Shape = 'trough' | 'crest';

const START: Point = { x: 80, y: 120 };
const END: Point = { x: 240, y: 120 };
const CONTROL: Record<Shape, Point> = {
  trough: { x: 160, y: 190 },
  crest: { x: 160, y: 50 },
};
const ARROW = 60;

const unit = (dx: number, dy: number) => {
  const size = Math.hypot(dx, dy) || 1;
  return { x: dx / size, y: dy / size };
};

/** Where to put the two tension arrowheads on a quadratic Bézier element. */
export function tangentEnds(p0: Point, p1: Point, p2: Point, length: number): { left: Point; right: Point } {
  const atStart = unit(p1.x - p0.x, p1.y - p0.y);
  const atEnd = unit(p2.x - p1.x, p2.y - p1.y);
  return {
    left: { x: p0.x - atStart.x * length, y: p0.y - atStart.y * length },
    right: { x: p2.x + atEnd.x * length, y: p2.y + atEnd.y * length },
  };
}

export function StringElement() {
  const [shape, setShape] = useState<Shape>('trough');
  const report = useReportState();

  useEffect(() => report({ shape }), [shape]);

  const control = CONTROL[shape];
  const { left, right } = tangentEnds(START, control, END, ARROW);
  const midY = (START.y + control.y) / 2;
  const resultantFrom = midY;
  const resultantTo = shape === 'trough' ? midY - 58 : midY + 58;

  return (
    <div class="sim">
      <svg
        class="cascade"
        viewBox="0 0 320 240"
        role="img"
        aria-label={pick({
          en: 'One short element of a string with the two tension forces at its ends and their resultant',
          fi: 'Lyhyt köyden osa, sen päihin vaikuttavat kaksi jännitysvoimaa ja niiden resultantti',
        })}
      >
        <defs>
          <marker id="se-head" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--accent-2)" />
          </marker>
          <marker id="se-net" markerWidth="9" markerHeight="9" refX="6" refY="3.4" orient="auto">
            <path d="M0,0 L7,3.4 L0,6.8 Z" fill="var(--accent-3)" />
          </marker>
        </defs>

        <path
          d={`M ${START.x} ${START.y} Q ${control.x} ${control.y} ${END.x} ${END.y}`}
          fill="none"
          stroke="var(--accent)"
          stroke-width="4"
          stroke-linecap="round"
        />

        <line x1={START.x} y1={START.y} x2={left.x} y2={left.y} stroke="var(--accent-2)" stroke-width="2.5" marker-end="url(#se-head)" />
        <line x1={END.x} y1={END.y} x2={right.x} y2={right.y} stroke="var(--accent-2)" stroke-width="2.5" marker-end="url(#se-head)" />
        <line x1={160} y1={resultantFrom} x2={160} y2={resultantTo} stroke="var(--accent-3)" stroke-width="3.5" marker-end="url(#se-net)" />

        <circle cx={START.x} cy={START.y} r="4" fill="var(--accent)" />
        <circle cx={END.x} cy={END.y} r="4" fill="var(--accent)" />
      </svg>

      <div class="controls">
        <Segmented
          label={pick({ en: 'Shape of the element', fi: 'Osan muoto' })}
          value={shape}
          onChange={setShape}
          options={[
            { value: 'trough', label: pick({ en: 'Trough', fi: 'Aallonpohja' }) },
            { value: 'crest', label: pick({ en: 'Crest', fi: 'Aallonharja' }) },
          ]}
        />
      </div>

      <p class="sim__hint">
        {shape === 'trough'
          ? pick({
              en: 'Orange: the tension pulling along the string at each end. They are not parallel, so they do not cancel — the green resultant points upwards, back towards the straight line.',
              fi: 'Oranssi: jännitys, joka vetää köyden suuntaisesti kummastakin päästä. Ne eivät ole yhdensuuntaisia, joten ne eivät kumoa toisiaan — vihreä resultantti osoittaa ylöspäin, takaisin kohti suoraa.',
            })
          : pick({
              en: 'Bend the element the other way and the resultant points downwards. The force follows the curvature, which is why the acceleration does too.',
              fi: 'Taivuta osa toisin päin, ja resultantti osoittaa alaspäin. Voima seuraa kaareutumista, ja siksi kiihtyvyyskin seuraa sitä.',
            })}
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/01-traveling-waves/StringElement.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 5: Gate**

Run: `npx vitest run`
Expected: PASS. Repo total **28 test files, 100 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 6: Commit**

```bash
git add subjects/physics/01-traveling-waves/StringElement.tsx subjects/physics/01-traveling-waves/StringElement.test.tsx
git commit -m "feat: string element force diagram behind the wave equation"
```
