### Task 12: Lesson 0 English content

**Files:**
- Modify (full rewrite): `subjects/math/00-wave-math-foundations/lesson.en.mdx`, `subjects/math/00-wave-math-foundations/terms.json`
- Modify (temporary copy of the English body, replaced in Task 14): `subjects/math/00-wave-math-foundations/lesson.fi.mdx`
- Test: `subjects/math/00-wave-math-foundations/lesson.test.tsx`

**Interfaces:**
- Consumes: all framework components (Tasks 2–7) and the four figures (Tasks 9–11).
- Produces: the final English lesson — 6 `h2` sections (why, §1–§4, summary), 14 term ids, 4 figures, 5 quizzes.

- [ ] **Step 1: Verify the Finnish terms against the textbook**

Read pages of `Textbook_materials/Physics/15 Äänen havaittu voimakkuus ilmaistaan desibeleinä ….pdf` (Read tool with `pages: "1-5"`). Find the textbook's exact words for: sound intensity (expected `äänen intensiteetti`), sound intensity level (expected `äänenvoimakkuustaso` or `äänen intensiteettitaso`), threshold of hearing (`kuulokynnys`), threshold of pain (`kipukynnys`). Use the textbook's wording in Step 2's `terms.json` and, if different, in `DecibelLadder.tsx`'s `LANDMARKS`. Record what the book uses in the commit message.

- [ ] **Step 2: Write the glossary**

`subjects/math/00-wave-math-foundations/terms.json` (replace values in the last two entries with Step 1's findings):

```json
{
  "derivative": { "en": "derivative", "fi": "derivaatta" },
  "partial-derivative": { "en": "partial derivative", "fi": "osittaisderivaatta" },
  "logarithm": { "en": "logarithm", "fi": "logaritmi" },
  "imaginary-unit": { "en": "imaginary unit", "fi": "imaginaariyksikkö" },
  "complex-plane": { "en": "complex plane", "fi": "kompleksitaso" },
  "real-part": { "en": "real part", "fi": "reaaliosa" },
  "imaginary-part": { "en": "imaginary part", "fi": "imaginaariosa" },
  "complex-number": { "en": "complex number", "fi": "kompleksiluku" },
  "unit-circle": { "en": "unit circle", "fi": "yksikköympyrä" },
  "radian": { "en": "radian", "fi": "radiaani" },
  "angular-velocity": { "en": "angular velocity", "fi": "kulmanopeus" },
  "amplitude": { "en": "amplitude", "fi": "amplitudi" },
  "sound-intensity": { "en": "sound intensity", "fi": "äänen intensiteetti" },
  "sound-intensity-level": { "en": "sound intensity level", "fi": "äänenvoimakkuustaso" }
}
```

- [ ] **Step 3: Write the failing lesson test**

`subjects/math/00-wave-math-foundations/lesson.test.tsx`:

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

test('the English lesson has six sections, four figures and five quizzes', () => {
  const { container } = renderLesson();
  expect(container.querySelectorAll('article h2')).toHaveLength(6);
  expect(container.querySelectorAll('article figure.figure')).toHaveLength(4);
  expect(container.querySelectorAll('article .quiz')).toHaveLength(5);
  expect(container.querySelectorAll('article .box--beyond').length).toBeGreaterThanOrEqual(5);
  expect(container.querySelectorAll('article math').length).toBeGreaterThan(20);
});

test('every Term in the lesson resolves and shows the other language', () => {
  const { container } = renderLesson();
  expect(container.querySelector('.term--missing')).toBeNull();
  expect(container.querySelector('[data-term="imaginary-unit"] .term__alt')?.textContent).toBe(' (imaginaariyksikkö)');
  act(() => setLang('fi'));
  expect(container.querySelector('[data-term="imaginary-unit"] .term__alt')?.textContent).toBe(' (imaginary unit)');
});
```

- [ ] **Step 4: Run it to confirm it fails**

Run: `npx vitest run subjects/math/00-wave-math-foundations/lesson.test.tsx`
Expected: FAIL — only 1 `h2` (the Task 1 placeholder body).

- [ ] **Step 5: Write the lesson**

`subjects/math/00-wave-math-foundations/lesson.en.mdx` (replace the whole file):

```mdx
import { ComplexRotator } from './ComplexRotator';
import { EulerCircle } from './EulerCircle';
import { WaveSurface } from './WaveSurface';
import { DecibelLadder } from './DecibelLadder';

## Why this lesson?

The next modules describe sound with four mathematical tools: rotation, the <Term id="derivative">derivative</Term>, the <Term id="partial-derivative">partial derivative</Term> and the <Term id="logarithm">logarithm</Term>. In math class they look like four unrelated calculation tricks. Here they become one story: **a wave is something that rotates, changes in space and time, and spans an enormous range of sizes.**

Every coloured box in this course tells you how to use it:

<Syllabus>
Part of the Finnish upper secondary syllabus. This can appear in your exams.
</Syllabus>

<Beyond>
Not examined in lukio, but you will definitely study it in a university STEM programme. Read it to understand, not to memorise.
</Beyond>

<ExamTip>
How to turn an idea into points in a real exam.
</ExamTip>

## 1. The imaginary unit is a quarter turn

<Syllabus>
On the number line, multiplying by $-1$ moves a number to the other side of zero: $3$ becomes $-3$. Multiplying by $-1$ twice brings you back.
</Syllabus>

Think of multiplying by $-1$ as a **half turn** (180°) around zero. Which operation, done twice, gives a half turn? A **quarter turn** (90°). That is exactly what the <Term id="imaginary-unit">imaginary unit</Term> $i$ does. The famous rule $i \cdot i = -1$ simply says: two quarter turns make a half turn.

A number line has no room to turn, so we add a second direction. In the <Term id="complex-plane">complex plane</Term> the <Term id="real-part">real part</Term> is on the horizontal axis and the <Term id="imaginary-part">imaginary part</Term> is on the vertical axis. A <Term id="complex-number">complex number</Term> $z = x + iy$ is just an arrow from the origin to the point $(x, y)$.

<Figure id="rotator">
  <ComplexRotator />
</Figure>

Press **× i** four times. The arrow turns 90° each time and returns home, because $i^4 = 1$. Drag the tip somewhere else and try again: multiplying by $i$ never changes the length of the arrow, only its direction.

<Beyond>
Complex numbers are not part of the lukio syllabus, but engineering and physics programmes use them from the first semester: in electric circuits, signal processing, quantum mechanics and control engineering.
</Beyond>

<ChoiceQuiz correct={2}>
Start from $z = 1$ and multiply by $i$ three times. Where does the arrow point?

<Choice>Right, at $1$</Choice>
<Choice>Up, at $i$</Choice>
<Choice>Down, at $-i$</Choice>
<Choice>Left, at $-1$</Choice>

<Hint>
Each multiplication by $i$ is a 90° turn counterclockwise. Three turns make 270°.
</Hint>

<Solution>
$i^3 = i^2 \cdot i = -i$, so the arrow points straight down.
</Solution>
</ChoiceQuiz>

## 2. Euler's formula: a rotation you can differentiate

<Syllabus>
On the <Term id="unit-circle">unit circle</Term> the point at angle $\theta$ has coordinates $(\cos\theta, \sin\theta)$. In physics, angles are measured in <Term id="radian">radians</Term>: a full turn is $2\pi$.
</Syllabus>

Imagine a point moving counterclockwise around the unit circle with <Term id="angular-velocity">angular velocity</Term> $\omega$. We write its position as a complex number $z(t)$. Uniform circular motion has two properties:

- the speed is $\omega$, because the radius is 1;
- the velocity always points 90° counterclockwise from the position.

"Turn by 90°" is multiplication by $i$, and "scale by $\omega$" is multiplication by $\omega$. So the whole motion fits in one equation:

$$
\frac{dz}{dt} = i\omega z
$$

You already know a function whose derivative is a constant times the function itself: $\frac{d}{dt}e^{at} = a\,e^{at}$. If the same rule works for $a = i\omega$, the motion that starts at $z(0) = 1$ is

$$
z(t) = e^{i\omega t} = \cos(\omega t) + i\sin(\omega t)
$$

The shadow of the point on the real axis is $\cos(\omega t)$ and its shadow on the imaginary axis is $\sin(\omega t)$. **An oscillation is the shadow of a rotation.**

<Figure id="euler">
  <EulerCircle />
</Figure>

<Beyond>
Check the rule yourself: differentiate $\cos(\omega t) + i\sin(\omega t)$ term by term and factor out $i\omega$. You get $i\omega\left(\cos(\omega t) + i\sin(\omega t)\right)$, exactly what the equation demands. At university the formula is proved with power series. Many physics books write waves with $e^{-i\omega t}$ instead: the same rotation, clockwise. Only the sign convention differs.
</Beyond>

<Beyond>
Why bother? Because $e^{i\alpha}\,e^{i\beta} = e^{i(\alpha + \beta)}$. Combining waves becomes adding angles, so beats and interference, which need long trigonometric identities in lukio, become short calculations with phasors $A\,e^{i\varphi}$ in Module 3.
</Beyond>

<ExamTip>
Before any trigonometric calculation, check that your calculator or CAS is in the correct angle mode. Formulas such as $\omega = 2\pi f$ and $\sin(\omega t)$ need radians.
</ExamTip>

<NumericQuiz answer={0.5} unit="s">
A point rotates with angular velocity $\omega = 4\pi$ rad/s. How long does one full turn take?

<Hint>
One full turn is $2\pi$ radians, so the period is $T = \frac{2\pi}{\omega}$.
</Hint>

<Solution>
$T = \frac{2\pi}{4\pi}\ \mathrm{s} = 0.5\ \mathrm{s}$
</Solution>
</NumericQuiz>

## 3. Partial derivatives: freeze the place or freeze the time

<Syllabus>
The derivative $\frac{dy}{dt}$ is the slope of a graph: how fast $y$ changes when $t$ changes a little.
</Syllabus>

A wave on a rope depends on two things: **where** you look ($x$) and **when** you look ($t$). The displacement is a function of two variables, $y(x, t)$. For a sine wave with <Term id="amplitude">amplitude</Term> $A$,

$$
y(x, t) = A\sin(kx - \omega t)
$$

With two variables there are two different "how fast?" questions. A <Term id="partial-derivative">partial derivative</Term> lets one variable change and keeps the other one fixed:

- $\frac{\partial y}{\partial t}$: **freeze the place.** Film one point of the rope. How fast does it move up and down?
- $\frac{\partial y}{\partial x}$: **freeze the time.** Take a photo. How steep is the rope at each point?
- $\frac{\partial^2 y}{\partial x^2}$: still in the photo, how strongly does the rope **bend**?

<Figure id="wave-surface">
  <WaveSurface />
</Figure>

Switch the figure to the bending mode. Where the rope bends like an upside-down cup (at a crest), the tension pulling on the two ends of a tiny piece adds up to a force pointing down. Where it bends like a cup, the force points up. A straight piece of rope, even a tilted one, feels no net sideways force. **Bending causes acceleration.** In Module 1 this sentence becomes the wave equation.

<Beyond>
Strictly speaking, the curvature of a curve is $\frac{y''}{(1 + y'^2)^{3/2}}$. For small waves the slope $y'$ is tiny, so $\frac{\partial^2 y}{\partial x^2}$ is an excellent approximation. Partial derivatives are taught in the first calculus courses at university.
</Beyond>

<ChoiceQuiz correct={1}>
At the top of a crest, what is the sign of $\frac{\partial^2 y}{\partial x^2}$?

<Choice>Positive</Choice>
<Choice>Negative</Choice>
<Choice>Zero</Choice>

<Hint>
Put the probe on a crest in the bending mode and look at the colour and the arrow.
</Hint>

<Solution>
Negative. Moving across the crest, the slope changes from positive to negative, so the slope is decreasing. The rope piece is pulled down, back towards the rest position.
</Solution>
</ChoiceQuiz>

## 4. Logarithms turn multiplication into addition

<Syllabus>
Logarithm rules: $\lg(ab) = \lg a + \lg b$ and $\lg 10^n = n$. In Finnish textbooks $\lg$ is the base-10 logarithm.
</Syllabus>

<Syllabus>
The <Term id="sound-intensity-level">sound intensity level</Term> is $L = 10\lg\frac{I}{I_0}$, where $I_0 = 10^{-12}\ \mathrm{W/m^2}$ is the threshold of hearing.
</Syllabus>

Our ears handle <Term id="sound-intensity">sound intensity</Term> from about $10^{-12}\ \mathrm{W/m^2}$ up to about $1\ \mathrm{W/m^2}$: a factor of a **trillion**, $10^{12}$. On a linear scale every quiet sound is squashed into an invisible sliver. The <Term id="logarithm">logarithm</Term> turns "how many times bigger" into "how many steps": every ×10 in intensity is +10 dB, so the whole range fits between 0 and 120 dB.

<Figure id="decibels">
  <DecibelLadder />
</Figure>

The second part of the figure shows why engineers love decibels. When a signal passes through several parts in a row (a microphone, an amplifier, a wall), each part multiplies the amplitude by a factor: $A_\text{out} = T_1 T_2 T_3\, A_\text{in}$. Taking the logarithm turns this product into a sum, and a sum is just bars placed end to end.

<ExamTip>
Remember two shortcuts: ×10 intensity is +10 dB, and ×2 intensity is about +3 dB. Two equally loud sources together are therefore about 3 dB louder than one, not twice as many decibels.
</ExamTip>

<Beyond>
For amplitudes such as pressure or voltage the rule is $20\lg$ instead of $10\lg$, because intensity is proportional to the amplitude squared. Plotting $20\lg$ of a system's amplitude factor against $\lg f$ gives a Bode plot, the standard tool for designing filters, loudspeakers and noise-cancelling headphones. You will draw one in Module 4.
</Beyond>

<NumericQuiz answer={60} unit="dB">
The intensity of normal conversation is $1.0 \cdot 10^{-6}\ \mathrm{W/m^2}$. What is its sound intensity level?

<Hint>
$L = 10\lg\frac{10^{-6}}{10^{-12}} = 10\lg 10^{6}$
</Hint>

<Solution>
$L = 10 \cdot 6\ \mathrm{dB} = 60\ \mathrm{dB}$
</Solution>
</NumericQuiz>

<NumericQuiz answer={73} unit="dB" rel={0} abs={0.5}>
One machine produces a sound intensity level of 70 dB. What is the level of two identical machines running together? Round to the nearest decibel.

<Hint>
Two machines give twice the intensity, and doubling the intensity adds $10\lg 2$ decibels.
</Hint>

<Solution>
$L = 70\ \mathrm{dB} + 10\lg 2\ \mathrm{dB} \approx 73\ \mathrm{dB}$
</Solution>
</NumericQuiz>

## Summary: your toolkit for the wave modules

- $i$ is a quarter turn, so complex numbers are arrows you can rotate. Used in Modules 1 and 3.
- $e^{i\omega t}$ is a rotation whose shadow is an oscillation. Used for waves and beats in Modules 1 and 3.
- $\frac{\partial y}{\partial t}$, $\frac{\partial y}{\partial x}$ and $\frac{\partial^2 y}{\partial x^2}$ separate motion in time from shape in space. Bending causes acceleration: the wave equation in Module 1.
- $\lg(ab) = \lg a + \lg b$ turns chains of factors into sums of decibels. Used for sound levels and Bode plots in Module 4.
```

Refresh the temporary Finnish copy so both bodies compile:

```bash
cp subjects/math/00-wave-math-foundations/lesson.en.mdx subjects/math/00-wave-math-foundations/lesson.fi.mdx
```

- [ ] **Step 6: Run the test to confirm it passes**

Run: `npx vitest run subjects/math/00-wave-math-foundations/lesson.test.tsx`
Expected: PASS (2 tests). If MDX fails to parse, the error names the line: the usual causes are a `{` or `<` outside `$…$` (rephrase the text) or a missing blank line around a JSX block.

- [ ] **Step 7: Read it in the browser**

Run: `npx vite`, open in the browser pane. Read the whole page once: every formula renders, every box has the right colour and label, each quiz grades (try `0,5`, `60`, `73`) and shows its solution after an attempt, the table of contents jumps to all six sections, no console errors.

- [ ] **Step 8: Commit**

```bash
git add subjects/math/00-wave-math-foundations
git commit -m "feat: module 0 English lesson content and glossary"
```
