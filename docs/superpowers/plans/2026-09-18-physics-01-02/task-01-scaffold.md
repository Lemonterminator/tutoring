### Task 1: Physics subject scaffold and shared acoustics helpers

**Files:**
- Create: `subjects/physics/_components/acoustics.ts`
- Test: `subjects/physics/_components/acoustics.test.ts`
- Create: `subjects/physics/01-traveling-waves/index.html`
- Create: `subjects/physics/01-traveling-waves/main.tsx`
- Create: `subjects/physics/01-traveling-waves/meta.json`
- Create: `subjects/physics/01-traveling-waves/lesson.en.mdx` (placeholder, replaced in task 6)
- Create: `subjects/physics/01-traveling-waves/lesson.fi.mdx` (placeholder, replaced in task 7)
- Create: `subjects/physics/01-traveling-waves/terms.json` (placeholder, replaced in task 6)

**Interfaces:**
- Consumes: nothing from earlier tasks. `framework/layout/Lesson` and
  `framework/layout/LessonContext` already exist; do not modify them.
- Produces: `V_AIR: number`, `V_WATER: number`, `V_TISSUE: number`,
  `HEARING_MIN_HZ: number`, `HEARING_MAX_HZ: number`,
  `wavelength(speed: number, frequency: number): number`,
  `frequencyOf(speed: number, wavelength: number): number`,
  `angularFrequency(frequency: number): number`,
  `waveNumber(wavelength: number): number`,
  `echoDistance(speed: number, roundTripTime: number): number` — all from
  `subjects/physics/_components/acoustics.ts`.

The placeholder `.mdx` files exist so that `scripts/check.ts` (which scans every directory
containing an `index.html`) sees a matching EN/FI pair from this commit onwards. They have
the same block count, zero maths, zero components and zero Term ids, so the check passes.

---

- [ ] **Step 1: Write the failing test**

`subjects/physics/_components/acoustics.test.ts`:

```ts
import { expect, test } from 'vitest';
import {
  angularFrequency,
  echoDistance,
  frequencyOf,
  HEARING_MAX_HZ,
  HEARING_MIN_HZ,
  V_AIR,
  V_TISSUE,
  V_WATER,
  wavelength,
  waveNumber,
} from './acoustics';

test('the lowest audible tone in air is about 17 m long', () => {
  expect(wavelength(V_AIR, HEARING_MIN_HZ)).toBeCloseTo(17, 5);
});

test('the highest audible tone in air is about 17 mm long', () => {
  expect(wavelength(V_AIR, HEARING_MAX_HZ)).toBeCloseTo(0.017, 5);
});

test('medical ultrasound at 2.5 MHz is sub-millimetre in tissue', () => {
  const lambda = wavelength(V_TISSUE, 2.5e6);
  expect(lambda).toBeGreaterThan(0.0006);
  expect(lambda).toBeLessThan(0.00062);
});

test('frequency and wavelength invert each other', () => {
  expect(frequencyOf(V_AIR, wavelength(V_AIR, 440))).toBeCloseTo(440, 9);
});

test('omega over k is the wave speed', () => {
  expect(angularFrequency(440) / waveNumber(wavelength(V_AIR, 440))).toBeCloseTo(V_AIR, 9);
});

test('echo sounding halves the round trip', () => {
  expect(echoDistance(V_WATER, 0.12)).toBeCloseTo(90, 9);
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/physics/_components/acoustics.test.ts`
Expected: FAIL. The message names the missing module, e.g.
`Failed to resolve import "./acoustics"` or `Cannot find module`.
If it passes, stop: the file already exists and something is wrong.

- [ ] **Step 3: Write the implementation**

`subjects/physics/_components/acoustics.ts`:

```ts
/** Wave speeds in m/s, as used in Finnish upper secondary problems (not constants of nature). */
export const V_AIR = 340;
export const V_WATER = 1500;
export const V_TISSUE = 1540;

/** Nominal limits of human hearing, Hz. */
export const HEARING_MIN_HZ = 20;
export const HEARING_MAX_HZ = 20000;

export const wavelength = (speed: number, frequency: number) => speed / frequency;
export const frequencyOf = (speed: number, wavelength: number) => speed / wavelength;
export const angularFrequency = (frequency: number) => 2 * Math.PI * frequency;
export const waveNumber = (wavelength: number) => (2 * Math.PI) / wavelength;

/** Echo sounding: the pulse travels out and back, so it covers twice the distance. */
export const echoDistance = (speed: number, roundTripTime: number) => (speed * roundTripTime) / 2;
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/_components/acoustics.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Create the lesson entry files**

`subjects/physics/01-traveling-waves/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Physics 1</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

`subjects/physics/01-traveling-waves/main.tsx`:

```tsx
import { render } from 'preact';
import '../../../framework/theme/index.css';
import { Lesson } from '../../../framework/layout/Lesson';
import type { LessonMeta } from '../../../framework/layout/LessonContext';
import En from './lesson.en.mdx';
import Fi from './lesson.fi.mdx';
import meta from './meta.json';
import terms from './terms.json';

render(<Lesson meta={meta as LessonMeta} En={En} Fi={Fi} terms={terms} />, document.getElementById('app')!);
```

`subjects/physics/01-traveling-waves/meta.json`:

```json
{
  "id": "physics-01-traveling-waves",
  "subject": "physics",
  "title": {
    "en": "Lesson 1: Travelling waves and the wave equation",
    "fi": "Oppitunti 1: Etenevä aalto ja aaltoyhtälö"
  }
}
```

`subjects/physics/01-traveling-waves/terms.json`:

```json
{}
```

`subjects/physics/01-traveling-waves/lesson.en.mdx`:

```mdx
## 1. Placeholder

The lesson body is written in task 6.
```

`subjects/physics/01-traveling-waves/lesson.fi.mdx`:

```mdx
## 1. Paikanvaraus

Oppitunnin sisältö kirjoitetaan tehtävässä 6.
```

- [ ] **Step 6: Confirm the whole suite and the types are clean**

Run: `npx vitest run`
Expected: PASS. Repo total **24 test files, 80 tests**. If your numbers differ, stop and
find out why before continuing.

Run: `npm run typecheck`
Expected: no output, exit code 0.

Run: `npm run check`
Expected: two lines, both starting `✔`, one for
`subjects/math/00-wave-math-foundations` and one for
`subjects/physics/01-traveling-waves`.

- [ ] **Step 7: Commit**

```bash
git add subjects/physics/_components/acoustics.ts subjects/physics/_components/acoustics.test.ts subjects/physics/01-traveling-waves/index.html subjects/physics/01-traveling-waves/main.tsx subjects/physics/01-traveling-waves/meta.json subjects/physics/01-traveling-waves/terms.json subjects/physics/01-traveling-waves/lesson.en.mdx subjects/physics/01-traveling-waves/lesson.fi.mdx
git commit -m "feat: physics subject scaffold and shared acoustics helpers"
```
