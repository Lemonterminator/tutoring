### Task 6: Lesson 1 English content and glossary

**Files:**
- Modify (replace entirely): `subjects/physics/01-traveling-waves/lesson.en.mdx`
- Modify (replace entirely): `subjects/physics/01-traveling-waves/terms.json`
- Test: `subjects/physics/01-traveling-waves/lesson.test.tsx`

**Interfaces:**
- Consumes: `WaveCalipers` (task 3), `TransverseVsLongitudinal` (task 4),
  `StringElement` (task 5). Framework components `Term`, `Syllabus`, `Beyond`, `ExamTip`,
  `Figure`, `NumericQuiz`, `ChoiceQuiz`, `Choice`, `Hint`, `Solution` need no import.
- Produces: a lesson body with **5 `h2` sections, 3 figures, 7 quizzes**.

`lesson.fi.mdx` is still the task 1 placeholder after this task, so `npm run check` will
**fail** here. That is expected and is fixed in task 7. The gate for this task is
`npx vitest run` plus `npm run typecheck` only — do not run `npm run build` yet.

**MDX rules:** a blank line before and after every block component and around paragraphs
inside them. A bare `{` or `<` outside `$…$` starts an expression or a tag — rephrase
instead. Readable text never goes in an attribute.

---

- [ ] **Step 1: Write the glossary**

`subjects/physics/01-traveling-waves/terms.json`:

```json
{
  "wavelength": { "en": "wavelength", "fi": "aallonpituus" },
  "period": { "en": "period", "fi": "jaksonaika" },
  "frequency": { "en": "frequency", "fi": "taajuus" },
  "wave-speed": { "en": "wave speed", "fi": "etenemisnopeus" },
  "amplitude": { "en": "amplitude", "fi": "amplitudi" },
  "angular-frequency": { "en": "angular frequency", "fi": "kulmataajuus" },
  "wave-number": { "en": "wave number", "fi": "aaltoluku" },
  "transverse-wave": { "en": "transverse wave", "fi": "poikittainen aaltoliike" },
  "longitudinal-wave": { "en": "longitudinal wave", "fi": "pitkittäinen aaltoliike" },
  "partial-derivative": { "en": "partial derivative", "fi": "osittaisderivaatta" },
  "pressure": { "en": "pressure", "fi": "paine" },
  "infrasound": { "en": "infrasound", "fi": "infraääni" },
  "ultrasound": { "en": "ultrasound", "fi": "ultraääni" },
  "wave-equation": { "en": "wave equation", "fi": "aaltoyhtälö" }
}
```

**Finnish sourcing.** `infraääni` and `ultraääni` come from Luku 16. The rest belong to an
earlier chapter that has not been exported, and the PDFs in `Textbook_materials/` are
scanned images with no text layer. Do **not** try to confirm them from the PDFs and do not
change them from memory. Write one line in `EXECUTION-LOG.md`:

```
UNVERIFIED: wavelength, period, frequency, wave-speed, amplitude, angular-frequency,
wave-number, transverse-wave, longitudinal-wave, partial-derivative, pressure, wave-equation
```

- [ ] **Step 2: Write the lesson body**

`subjects/physics/01-traveling-waves/lesson.en.mdx`:

````mdx
import { StringElement } from './StringElement';
import { TransverseVsLongitudinal } from './TransverseVsLongitudinal';
import { WaveCalipers } from './WaveCalipers';

Module 0 gave you three tools: the derivative, the <Term id="partial-derivative">partial derivative</Term> and the logarithm. This lesson spends the first two on the thing they were built for — a shape that moves through a material without carrying the material with it.

## 1. What actually travels?

<Syllabus>
A wave carries energy from one place to another without transporting matter. The particles of the medium oscillate about their own fixed positions.
</Syllabus>

Hold one end of a long rope and flick it once. A hump runs away from your hand to the far end. Now paint one dot on the rope and watch only the dot: it goes up, comes back down, and finishes exactly where it started. The hump travelled the whole length of the rope. The dot travelled nowhere.

That is the whole idea, and it is worth being blunt about it: **the pattern moves, the matter does not.** Energy moves with the pattern. Matter stays home.

<ChoiceQuiz correct={1}>
A cork floats on a pond while a wave passes underneath it. After the wave has gone by, where is the cork?

<Choice>Further away from where the wave came from</Choice>
<Choice>Back where it started</Choice>
<Choice>Pushed down below its old position</Choice>
<Choice>It depends on the amplitude</Choice>

<Hint>
Follow one particle of the medium, not the shape.
</Hint>

<Solution>
Back where it started. The cork moves up and down as each crest and trough arrives, but the water — and the cork with it — has no net motion in the direction the wave travels.
</Solution>
</ChoiceQuiz>

## 2. Writing the wave down

<Syllabus>
For a wave, $v = f\lambda$. The <Term id="wavelength">wavelength</Term> $\lambda$ is the distance between two neighbouring crests and the <Term id="period">period</Term> $T$ is the time one particle takes to complete one oscillation, with $f = 1/T$.
</Syllabus>

The displacement of the medium depends on two things at once: **where** you look and **when** you look. So it is a function of two variables, $y(x, t)$, and the whole course writes it as

$$
y(x, t) = A\cos(\omega t - kx + \varphi)
$$

with <Term id="amplitude">amplitude</Term> $A$, <Term id="angular-frequency">angular frequency</Term> $\omega = 2\pi f$ and <Term id="wave-number">wave number</Term> $k = 2\pi/\lambda$. Divide one by the other and the <Term id="wave-speed">wave speed</Term> falls out:

$$
v = \frac{\omega}{k} = \frac{2\pi f}{2\pi/\lambda} = f\lambda
$$

Because a function of two variables cannot be drawn on one pair of axes, the textbook draws two different graphs, and confusing them is the single most common way to lose marks here.

- A **snapshot** freezes time and plots $y$ against $x$. You can measure $\lambda$ on it. You cannot measure $T$ on it.
- A **history** stands at one place and plots $y$ against $t$. You can measure $T$ on it. You cannot measure $\lambda$ on it.

<Figure id="calipers">
  <WaveCalipers />
</Figure>

Drag the orange markers until the top pair spans one whole wave and the bottom pair spans one whole cycle. The readout divides what you measured. When your $\Delta x / \Delta t$ matches the true speed, you have found $\lambda$ and $T$ correctly.

<Syllabus>
Human hearing runs from about 20 Hz to about 20 000 Hz. In air at 340 m/s that is a wavelength of 17 m at the bottom and 0.017 m at the top. Below 20 Hz is <Term id="infrasound">infrasound</Term>; above 20 kHz is <Term id="ultrasound">ultrasound</Term>.
</Syllabus>

<NumericQuiz answer={340} unit="m/s">
A tone of <Term id="frequency">frequency</Term> 500 Hz has a wavelength of 0.68 m in air. What is the speed of sound?

<Hint>
$v = f\lambda$. Watch the units: hertz are 1/s.
</Hint>

<Solution>
$v = 500 \cdot 0.68 = 340$ m/s.
</Solution>
</NumericQuiz>

<ChoiceQuiz correct={2}>
You are given a graph of $y$ against $t$ for one particle, with the time axis marked in milliseconds. Which quantities can you read directly off it?

<Choice>Wavelength and wave speed</Choice>
<Choice>Wavelength and period</Choice>
<Choice>Amplitude and period</Choice>
<Choice>Amplitude and wavelength</Choice>

<Hint>
The horizontal axis is time. Nothing on this graph knows about distance.
</Hint>

<Solution>
Amplitude and period. To get the wavelength you also need the wave speed, through $\lambda = v/f$ — it is not on the graph.
</Solution>
</ChoiceQuiz>

<NumericQuiz answer={400} unit="m/s" rel={0.02}>
On a snapshot you measure one whole wave as 1.2 m. On a history of the same wave you measure one whole cycle as 3.0 ms. How fast is the wave travelling?

<Hint>
One wavelength passes any fixed point in exactly one period.
</Hint>

<Solution>
$v = \lambda/T = 1.2 / 0.0030 = 400$ m/s.
</Solution>
</NumericQuiz>

## 3. Two speeds that are easy to confuse

<ExamTip>
A wave question almost always contains two different speeds. The <Term id="wave-speed">wave speed</Term> $v$ is how fast the pattern advances and is set by the medium. The particle speed $\partial y/\partial t$ is how fast one piece of the medium is moving and is set by the amplitude and the frequency. They have the same unit and nothing else in common.
</ExamTip>

Differentiating $y(x,t)$ with respect to $t$ while holding $x$ fixed — exactly the <Term id="partial-derivative">partial derivative</Term> from Module 0 — gives the particle velocity:

$$
\frac{\partial y}{\partial t} = -A\omega\sin(\omega t - kx + \varphi)
$$

so the fastest a particle ever moves is $A\omega$. For ordinary sound that number is tiny compared with 340 m/s, and noticing this is often worth a mark on its own.

<NumericQuiz answer={0.53} unit="m/s" rel={0.03}>
A 170 Hz sound wave moves air molecules back and forth with an amplitude of 0.5 mm. What is the largest speed any molecule reaches?

<Hint>
The maximum of $A\omega$, and $\omega = 2\pi f$. Convert the amplitude to metres first.
</Hint>

<Solution>
$A\omega = 0.0005 \cdot 2\pi \cdot 170 \approx 0.53$ m/s. The wave itself runs at 340 m/s — about 600 times faster than the air ever moves.
</Solution>
</NumericQuiz>

## 4. Sound is a longitudinal wave

<Syllabus>
Sound in air is a <Term id="longitudinal-wave">longitudinal wave</Term>: the medium oscillates along the direction the wave travels. A wave on a rope or a string is a <Term id="transverse-wave">transverse wave</Term>, oscillating across it.
</Syllabus>

Every picture so far has been a rope, because a rope is easy to draw. Sound is not like that, and the bridge between the two is worth making explicit or the exam questions will not look like the pictures.

Use the same function, but let it describe how far a thin slice of air has shifted **along** the direction of travel. Call that displacement $\xi$. Where neighbouring slices shift towards each other the air bunches up and the <Term id="pressure">pressure</Term> rises; where they shift apart it falls. "How fast the shift changes from place to place" is again a partial derivative, so

$$
p = -B\,\frac{\partial \xi}{\partial x}
$$

where $B$ is a property of the air. The minus sign says what your intuition already said: squeezing raises the pressure.

<Figure id="longitudinal">
  <TransverseVsLongitudinal />
</Figure>

Switch to longitudinal and watch the two curves below the dots. The pressure peaks exactly where the displacement is zero, and the pressure is zero exactly where the displacement peaks. They are a quarter of a cycle apart — which is the same statement as "one is the derivative of the other".

<ExamTip>
Whenever a question says "node" or "antinode" for sound, ask yourself: of displacement, or of pressure? The two swap places. Lesson 2 leans on this hard.
</ExamTip>

<Beyond>
For a transverse wave, $\partial y/\partial x$ is the **slope** of the snapshot, not the strain — stretching a rope sideways changes its length only in second order, roughly $\tfrac{1}{2}(\partial y/\partial x)^2$. For a longitudinal wave, $\partial \xi/\partial x$ really is the strain, which is why the pressure formula above is so simple.
</Beyond>

## 5. Why does a wave move at all?

<Beyond>
Nothing so far explains why the hump travels. That comes from Newton's second law applied to one short piece of the string, and it produces the <Term id="wave-equation">wave equation</Term> — the single most reused equation in physics and engineering.
</Beyond>

Take a short element of a stretched string. The tension pulls along the string at each end. If that piece of string is straight, the two pulls are exactly opposite and cancel: no net force, no acceleration, nothing happens. If the piece is **curved**, the two pulls are no longer parallel, and what is left over points towards the concave side.

<Figure id="element">
  <StringElement />
</Figure>

So curvature produces force, and force produces acceleration. Writing "curvature" as $\partial^2 y/\partial x^2$ and "acceleration" as $\partial^2 y/\partial t^2$ turns that sentence into

$$
\frac{\partial^2 y}{\partial t^2} = v^2\,\frac{\partial^2 y}{\partial x^2}
$$

and substituting $y = A\cos(\omega t - kx)$ into it gives back $v = \omega/k$ — the travelling wave is a solution, not an assumption.

<ChoiceQuiz correct={0}>
A point on a vibrating string is at the bottom of a trough at this instant. Which way does the net force on it point?

<Choice>Upwards, back towards the straight line</Choice>
<Choice>Downwards, away from the straight line</Choice>
<Choice>Along the string, in the direction of travel</Choice>
<Choice>There is no net force, because the point is momentarily at rest</Choice>

<Hint>
At a trough the string is concave upwards. Use the figure above, and remember that being momentarily at rest says nothing about the force.
</Hint>

<Solution>
Upwards. At a trough the curvature is positive, so the resultant of the two tensions points up. The point is momentarily at rest but has its largest acceleration there — exactly like a mass on a spring at the end of its travel.
</Solution>
</ChoiceQuiz>

<NumericQuiz answer={0.62} unit="mm" rel={0.04}>
Medical <Term id="ultrasound">ultrasound</Term> uses 2.5 MHz, and sound travels at about 1540 m/s in soft tissue. What is the wavelength, in millimetres?

<Hint>
$\lambda = v/f$, then convert metres to millimetres.
</Hint>

<Solution>
$\lambda = 1540 / (2.5 \cdot 10^{6}) = 6.16 \cdot 10^{-4}$ m, about 0.62 mm. Structures much smaller than a wavelength cannot be resolved, which is the order-of-magnitude reason medical scanners work in megahertz instead of kilohertz — at 20 kHz the wavelength would be about 8 cm.
</Solution>
</NumericQuiz>
````

- [ ] **Step 3: Write the failing test**

`subjects/physics/01-traveling-waves/lesson.test.tsx`:

```tsx
import { act, cleanup, render } from '@testing-library/preact';
import { afterEach, expect, test } from 'vitest';
import { setExamMode, setLang } from '../../../framework/i18n/state';
import { Lesson } from '../../../framework/layout/Lesson';
import type { LessonMeta } from '../../../framework/layout/LessonContext';
import En from './lesson.en.mdx';
import Fi from './lesson.fi.mdx';
import meta from './meta.json';
import terms from './terms.json';

const renderLesson = () => render(<Lesson meta={meta as LessonMeta} En={En} Fi={Fi} terms={terms} />);

afterEach(() => {
  cleanup();
  setLang('en');
  setExamMode(false);
});

test('the English lesson has five sections, three figures and seven quizzes', () => {
  const { container } = renderLesson();
  expect(container.querySelectorAll('article h2')).toHaveLength(5);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(3);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(7);
  expect(container.querySelectorAll('article math').length).toBeGreaterThan(15);
});

test('it labels syllabus material, university material and exam technique', () => {
  const { container } = renderLesson();
  expect(container.querySelectorAll('article .box--syllabus').length).toBeGreaterThanOrEqual(4);
  expect(container.querySelectorAll('article .box--beyond').length).toBeGreaterThanOrEqual(2);
  expect(container.querySelectorAll('article .box--exam').length).toBeGreaterThanOrEqual(2);
});

test('every Term resolves and the glossary lists them all', () => {
  const { container } = renderLesson();
  expect(container.querySelector('.term--missing')).toBeNull();
  expect(container.querySelector('[data-term="wavelength"] .term__alt')?.textContent).toBe(' (aallonpituus)');
  // The Finnish body is still the task 1 placeholder, so nothing here may depend on it.
  // The glossary is built from terms.json and renders in either language; task 7 adds the
  // assertions that need real Finnish prose.
  act(() => setLang('fi'));
  expect(container.querySelectorAll('.glossary__row')).toHaveLength(14);
});
```

**Do not assert anything about the article body after `setLang('fi')` in this task.**
`Lesson` renders `Fi` *instead of* `En`, and `lesson.fi.mdx` is still the task 1
placeholder, which contains no `Term` tags and no figures. Any such assertion cannot pass
until task 7 has run.

- [ ] **Step 4: Run it to confirm it fails, and check the failure is the right one**

Run: `npx vitest run subjects/physics/01-traveling-waves/lesson.test.tsx`
Expected: FAIL **before** you write the mdx in step 2; if you already wrote step 2, this
step will pass and that is fine — record in the log which order you used.
The failure to expect is on the counts (`expected 1 to be 5`) or on a missing Term.

If a test fails with `term--missing`, an id used in the body is absent from `terms.json` —
fix `terms.json`, never delete the `Term` tag.

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run subjects/physics/01-traveling-waves/lesson.test.tsx`
Expected: PASS (3 tests)

- [ ] **Step 6: Gate**

Run: `npx vitest run`
Expected: PASS. Repo total **29 test files, 103 tests**.

Run: `npm run typecheck`
Expected: no output, exit code 0.

Do **not** run `npm run build` or `npm run check` in this task: the Finnish file is still a
placeholder and the check is supposed to fail until task 7.

- [ ] **Step 7: Commit**

```bash
git add subjects/physics/01-traveling-waves/lesson.en.mdx subjects/physics/01-traveling-waves/terms.json subjects/physics/01-traveling-waves/lesson.test.tsx
git commit -m "feat: lesson 1 English content and glossary"
```
