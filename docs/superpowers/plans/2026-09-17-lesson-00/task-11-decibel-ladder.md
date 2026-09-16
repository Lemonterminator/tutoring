### Task 11: DecibelLadder

**Files:**
- Create: `subjects/math/00-wave-math-foundations/DecibelLadder.tsx`
- Test: `subjects/math/00-wave-math-foundations/DecibelLadder.test.tsx`

**Interfaces:**
- Consumes: `useReportState` (Task 5); `pick`, `Bi` (Task 2); `Slider`, `fixed`, `sci` (Task 7); `intensityToDb`, `ampRatioToDb`, `dbToAmpRatio`, `MAX_GAIN`, `Tone` (Task 7).
- Produces: `DecibelLadder()` — plain DOM + SVG (no canvas):
  - **A.** Intensity slider over exponent −12…0 (I = 10^e W/m²). Two bars: linear (width = I/1 W/m²) and decibel (width = L/120) with landmark ticks at 0, 30, 60, 85, 110, 120 dB. Readout `L = 10 lg(I / I₀) = <L> dB · <nearest landmark at or below L>`. Sound toggle: 440 Hz, gain `MAX_GAIN · dbToAmpRatio((L − 120) / 2)` (figure dB halved for speakers, stated on screen).
  - **B.** Three stages (microphone, amplifier, wall), each slider is lg of the amplitude factor in [−1, 1] (×0.1…×10). SVG draws each stage's dB as a bar starting where the previous one ended, plus a total bar. Readout `Aout/Ain = f₁ × f₂ × f₃ = product → d₁ d₂ d₃ = total dB`.
  - Reports `{ intensityExponent, levelDb, stageFactors }`.

- [ ] **Step 1: Write the failing test**

`subjects/math/00-wave-math-foundations/DecibelLadder.test.tsx`:

```tsx
import { cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { DecibelLadder } from './DecibelLadder';

afterEach(cleanup);

test('starts at conversation level and follows the intensity slider', () => {
  const { container } = render(<DecibelLadder />);
  expect(container.textContent).toContain('60.0 dB · conversation');
  expect(container.textContent).toContain('1.0 × 10⁻⁶ W/m²');

  fireEvent.input(screen.getAllByRole('slider')[0], { target: { value: '-9' } });
  expect(container.textContent).toContain('30.0 dB · whisper');
});

test('cascade multiplies factors and adds decibels', () => {
  const { container } = render(<DecibelLadder />);
  expect(container.textContent).toContain('= 6.31');
  expect(container.textContent).toContain('+10.0 +20.0 −14.0 = +16.0 dB');

  fireEvent.input(screen.getAllByRole('slider')[3], { target: { value: '0' } });
  expect(container.textContent).toContain('+10.0 +20.0 +0.0 = +30.0 dB');
});

test('sound toggle switches label without Web Audio support', () => {
  render(<DecibelLadder />);
  fireEvent.click(screen.getByRole('button', { name: /Sound on/ }));
  expect(screen.getByRole('button', { name: /Sound off/ })).toBeTruthy();
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run subjects/math/00-wave-math-foundations/DecibelLadder.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

`subjects/math/00-wave-math-foundations/DecibelLadder.tsx`:

```tsx
import { useEffect, useRef, useState } from 'preact/hooks';
import { useReportState } from '../../../framework/ask/Figure';
import { ampRatioToDb, dbToAmpRatio, intensityToDb } from '../../../framework/audio/decibel';
import { MAX_GAIN, Tone } from '../../../framework/audio/tone';
import { pick } from '../../../framework/i18n/ui';
import { Slider } from '../../../framework/interact/Controls';
import { fixed, sci } from '../../../framework/interact/format';

const LANDMARKS = [
  { L: 0, en: 'threshold of hearing', fi: 'kuulokynnys' },
  { L: 30, en: 'whisper', fi: 'kuiskaus' },
  { L: 60, en: 'conversation', fi: 'keskustelu' },
  { L: 85, en: 'busy street', fi: 'vilkas katu' },
  { L: 110, en: 'rock concert', fi: 'rock-konsertti' },
  { L: 120, en: 'threshold of pain', fi: 'kipukynnys' },
];

const STAGES = [
  { en: 'Microphone', fi: 'Mikrofoni', start: 0.5, color: 'var(--accent)' },
  { en: 'Amplifier', fi: 'Vahvistin', start: 1, color: 'var(--accent-2)' },
  { en: 'Wall', fi: 'Seinä', start: -0.7, color: 'var(--accent-3)' },
];

const MID_X = 300;
const PX_PER_DB = 4.5;

const signed = (x: number) => `${x < 0 ? '−' : '+'}${Math.abs(x).toFixed(1)}`;
const factor = (x: number) => String(Number(x.toPrecision(3)));

export function DecibelLadder() {
  const [exponent, setExponent] = useState(-6);
  const [soundOn, setSoundOn] = useState(false);
  const [logFactors, setLogFactors] = useState(STAGES.map((s) => s.start));
  const tone = useRef<Tone | null>(null);
  const report = useReportState();

  const intensity = 10 ** exponent;
  const level = intensityToDb(intensity);
  const landmark = [...LANDMARKS].reverse().find((m) => m.L <= level + 0.05) ?? LANDMARKS[0];
  const factors = logFactors.map((g) => 10 ** g);
  const stageDb = factors.map(ampRatioToDb);
  const totalDb = stageDb.reduce((sum, d) => sum + d, 0);
  const product = factors.reduce((p, f) => p * f, 1);

  useEffect(
    () => report({ intensityExponent: exponent, levelDb: level, stageFactors: factors.map(factor).join(' × ') }),
    [exponent, logFactors],
  );

  useEffect(() => {
    tone.current ??= new Tone();
    // Speakers cannot play 120 dB: every 20 dB in the figure is played as 10 dB.
    if (soundOn) tone.current.start(440, MAX_GAIN * dbToAmpRatio((level - 120) / 2));
    else tone.current.stop();
  }, [soundOn, level]);

  useEffect(() => () => tone.current?.stop(), []);

  let barStart = 0;

  return (
    <div class="sim">
      <div class="sim__title">{pick({ en: 'A. From watts to decibels', fi: 'A. Wateista desibeleihin' })}</div>
      <div class="controls">
        <Slider
          label={pick({ en: 'Intensity I', fi: 'Intensiteetti I' })}
          min={-12}
          max={0}
          step={0.1}
          value={exponent}
          onInput={setExponent}
          display={`${sci(intensity)} W/m²`}
        />
        <button type="button" class="btn btn--ghost" aria-pressed={soundOn} onClick={() => setSoundOn((on) => !on)}>
          {soundOn ? pick({ en: '🔊 Sound off', fi: '🔊 Ääni pois' }) : pick({ en: '🔈 Sound on', fi: '🔈 Ääni päälle' })}
        </button>
      </div>

      <div class="bars">
        <div class="bar">
          <span>{pick({ en: 'Linear scale', fi: 'Lineaarinen asteikko' })}</span>
          <div class="bar__track">
            <div class="bar__fill" style={{ width: `${intensity * 100}%` }} />
          </div>
        </div>
        <div class="bar">
          <span>{pick({ en: 'Decibel scale', fi: 'Desibeliasteikko' })}</span>
          <div class="bar__track">
            <div class="bar__fill bar__fill--db" style={{ width: `${(level / 120) * 100}%` }} />
            {LANDMARKS.map((m) => (
              <span key={m.L} class="bar__tick" style={{ left: `${(m.L / 120) * 100}%` }} title={pick(m)}>
                {m.L}
              </span>
            ))}
          </div>
        </div>
      </div>

      <p class="readout">
        L = 10 lg(I / I₀) = <strong>{fixed(level, 1)} dB</strong> · {pick(landmark)}
      </p>
      <p class="sim__hint">
        {pick({
          en: 'The tone is scaled for your speakers: +20 dB in the figure plays as +10 dB. Start with a low volume.',
          fi: 'Ääni on skaalattu kaiuttimille: kuvan +20 dB soi +10 dB:nä. Aloita pienellä äänenvoimakkuudella.',
        })}
      </p>

      <div class="sim__title">
        {pick({ en: 'B. A chain of parts: multiply factors, add decibels', fi: 'B. Osien ketju: kertoimet kerrotaan, desibelit lasketaan yhteen' })}
      </div>
      <div class="controls controls--stack">
        {STAGES.map((stage, i) => (
          <Slider
            key={stage.en}
            label={pick(stage)}
            min={-1}
            max={1}
            step={0.05}
            value={logFactors[i]}
            onInput={(v) => setLogFactors((old) => old.map((g, j) => (j === i ? v : g)))}
            display={`× ${factor(factors[i])} = ${signed(stageDb[i])} dB`}
          />
        ))}
      </div>

      <svg class="cascade" viewBox="0 0 600 150" role="img" aria-label={pick({ en: 'Decibel bars placed end to end', fi: 'Desibelipalkit peräkkäin' })}>
        <line x1={MID_X} x2={MID_X} y1={0} y2={150} style={{ stroke: 'var(--axis)' }} />
        {STAGES.map((stage, i) => {
          const from = barStart;
          barStart += stageDb[i];
          return (
            <rect
              key={stage.en}
              x={MID_X + Math.min(from, barStart) * PX_PER_DB}
              y={6 + i * 30}
              width={Math.abs(stageDb[i]) * PX_PER_DB}
              height={22}
              rx={3}
              style={{ fill: stage.color }}
            />
          );
        })}
        <rect x={MID_X + Math.min(0, totalDb) * PX_PER_DB} y={112} width={Math.abs(totalDb) * PX_PER_DB} height={26} rx={3} style={{ fill: 'var(--text)' }} />
        <text x={8} y={130} style={{ fill: 'var(--muted)', fontSize: '13px' }}>
          {pick({ en: 'Total', fi: 'Yhteensä' })}
        </text>
      </svg>

      <p class="readout">
        A<sub>out</sub>/A<sub>in</sub> = {factors.map(factor).join(' × ')} = <strong>{factor(product)}</strong> → {stageDb.map(signed).join(' ')} ={' '}
        <strong>{signed(totalDb)} dB</strong>
      </p>
    </div>
  );
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run subjects/math/00-wave-math-foundations/DecibelLadder.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Listen and look**

Temporarily add to `lesson.en.mdx`:

```mdx
import { DecibelLadder } from './DecibelLadder';

<Figure id="decibels">
  <DecibelLadder />
</Figure>
```

Run `npx vite`, open in the browser pane. Check: the linear bar is invisible until about 10⁻¹ W/m² while the dB bar moves evenly; landmarks label correctly; with speakers at low volume, sound starts only after the click, gets louder with the slider without clicks or pops, and stops on the second click; moving a stage slider moves every later bar and the total. Revert the temporary lines.

- [ ] **Step 6: Commit**

```bash
git add subjects/math/00-wave-math-foundations/DecibelLadder.tsx subjects/math/00-wave-math-foundations/DecibelLadder.test.tsx
git commit -m "feat: decibel ladder and cascade figure with tone"
```
