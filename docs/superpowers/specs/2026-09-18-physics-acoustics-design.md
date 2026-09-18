# Physics lessons 1–4: waves and sound — Design

**Status:** approved in conversation 2026-09-18. Lessons 1–2 are planned in
`docs/superpowers/plans/2026-09-18-physics-01-02/`. Lessons 3–4 are specified here but
planned only after lesson 1–2 is accepted.

**Follows:** `subjects/math/00-wave-math-foundations/` (Module 0: quarter turn, Euler,
partial derivatives, logarithm). Framework spec: `2026-09-17-lesson-framework-design.md`.

## 1. Audience and purpose

Mid-level international lukio students (≈7/10), good English, sitting Finnish exams,
heading for STEM. Lessons 1–2 and 4 are exam-facing; the university material is always
labelled. Textbook: Sanoma Pro Kampus, Luku 14 (sound interactions), 15 (intensity and
decibels), 16 (applications of sound).

## 2. Course-wide decisions

### 2.1 Sign convention (locked)

Every lesson writes a travelling wave as

    y(x, t) = A cos(ωt − kx + φ)

and its complex form as `ỹ = A e^{i(ωt − kx)}`, so `∂/∂t → +iω`. This agrees with
Module 0's counterclockwise `e^{iωt}` and with the later `Z_L = iωL`. Module 0's figure
used `A sin(kx − ωt)`; because cosine is even, `cos(ωt − kx) = cos(kx − ωt)` — the same
wave, so **no change to Module 0 is needed**. Any lesson that shows both forms says this
in one sentence.

### 2.2 Phasors move to lesson 3

Phasors buy nothing in lessons 1–2 (real acoustics, exam-facing). They pay off in beats,
where two arrows at slightly different angular speeds make the resultant length pulse.
Lesson 1 stays real-valued.

### 2.3 Node counting is derived, never recalled

No lesson states "n antinodes, n − 1 nodes" as a rule to remember. Every count comes from
`λ_n` and the boundary conditions, and in lesson 2 it is also **measured from a
simulation**. Displacement nodes and pressure nodes are always named as such.

### 2.4 Sound speeds

`V_AIR = 340` m/s (the value Sanoma Pro uses in classroom problems), `V_WATER = 1500`,
`V_TISSUE = 1540`. Stated as the value in use, not as a constant of nature.

## 3. Science corrections applied to the tutor's outline

| Outline said | Correction |
|---|---|
| `∂y/∂x` is "spatial strain" | For a transverse wave it is the **slope**; true strain is second order (`≈ y'²/2`). For a longitudinal wave `∂ξ/∂x` *is* the strain and `p = −B ∂ξ/∂x` |
| (missing) | Wave speed `v` and particle speed `∂y/∂t` are different quantities — added as an ExamTip with numbers |
| (missing) | Sound is longitudinal; the rope pictures need an explicit `y ↔ ξ ↔ p` bridge |
| Wave equation from `F = ma` | Only under the small-slope approximation, consistent with Module 0's curvature note |
| Astronomical redshift as Doppler | Cosmological redshift is metric expansion, not Doppler — lesson 5 will use stellar radial velocity instead |
| Fixed/free end as a rule | Reframed as the two limits of an impedance mismatch (`Z = ρv`); the ultrasound-gel question from Luku 16 is the opening hook |
| Square-wave series | Missing the `4/π` factor; lesson 3 either includes it or says only the shape is drawn |
| dB with `10 lg` and `20 lg` | Lesson 4 states explicitly: 10 for power/intensity, 20 for amplitude, because `I ∝ A²` |

## 4. Lesson 1 — Travelling waves and the wave equation

`subjects/physics/01-traveling-waves/`, id `physics-01-traveling-waves`.

| § | Content | Label |
|---|---|---|
| 1 | Vibration vs wave: the pattern and the energy travel, the matter does not | Syllabus |
| 2 | `y(x,t)`, `k = 2π/λ`, `ω = 2πf`, `v = ω/k = fλ`; snapshot (y–x) and history (y–t) are different graphs. Worked on the textbook hearing range 20 Hz–20 kHz ↔ 17 m–0.017 m | Syllabus |
| 3 | Wave speed vs particle speed | ExamTip |
| 4 | Sound is longitudinal: displacement `ξ`, pressure `p = −B ∂ξ/∂x`, 90° apart | Syllabus |
| 5 | Why a wave moves: curvature → unbalanced tension → acceleration (small slope) | Beyond |

Figures: `WaveCalipers` (two linked graphs with draggable markers; the student measures λ
and T and the readout computes v), `TransverseVsLongitudinal` (animated particle row,
displacement and pressure curves), `StringElement` (static SVG force diagram).

Quizzes: where a cork ends up; v from λ and f; which quantities a y–t graph shows; max particle speed vs 340 m/s;
v from measured λ and T; direction of the net force at a trough; ultrasound wavelength.

## 5. Lesson 2 — Standing waves, boundaries and harmonics

`subjects/physics/02-standing-waves/`, id `physics-02-standing-waves`. The flagship.

| § | Content | Label |
|---|---|---|
| 1 | Reflection at a boundary as an impedance mismatch; the ultrasound-gel question; fixed and free ends as the limits `Z₂ → ∞` and `Z₂ → 0` | Syllabus (qualitative) / Beyond (`Z = ρv`, reflection coefficient) |
| 2 | Two counter-propagating waves add to a standing wave; nodes, antinodes, no net energy transport on average | Syllabus |
| 3 | Boundary conditions decide everything: string `λ_n = 2L/n`, open pipe `λ_n = 2L/n`, pipe closed at one end `λ_n = 4L/(2n−1)` (odd harmonics only) | Syllabus |
| 4 | Displacement node = pressure antinode | ExamTip |
| 5 | End correction; why the same note sounds different on different instruments (hook to lesson 3) | Beyond |

### 5.1 The finite-difference simulation

Sections 2–4 are carried by a real PDE solver, not an analytic sum. This is the point of
the lesson: the student never gets told `λ_n = 2L/n` before seeing it appear.

`u_tt + 2γ u_t = c² u_xx` by leapfrog, normalised to `c = 1`, `L = 1`, so `Δt = Δx = 1/n`
and the Courant number is exactly 1. At `C = 1` the update collapses to
`u_i^{n+1} = u_{i+1}^n + u_{i−1}^n − u_i^{n−1}`, which is dispersion-free: the discrete
mode frequencies equal the exact ones. Verified for all three boundary pairs:

| Case | Discrete boundary | Grid mode | Exact condition |
|---|---|---|---|
| String, both fixed | `u₀ = u_N = 0` | `sin(nπi/N)` | `k_nL = nπ` |
| Open pipe (displacement) | ghost `u₋₁ = u₁`, `u_{N+1} = u_{N−1}` | `cos(nπi/N)` | `k_nL = nπ` |
| Closed one end | `u₀ = 0` + ghost at right | `sin(k i Δx)`, condition `cos(k_nL) = 0` | `k_nL = (2n−1)π/2` |

This exactness matters pedagogically: the simulation and the textbook formula must agree
to displayed precision, or the student concludes the computer is wrong.

**Non-negotiable numerical details.** The open end uses the second-order ghost point
`u₋₁ = u₁`; `u₀ = u₁` is first order and shifts the resonances by percent — the student
would see the formula fail. The harmonic slider is capped well below the Nyquist limit.
Damping is required for the driven sweep to reach steady state and does broaden the peaks;
the figure caption says so. The animation is slow motion and says so, with frequencies
converted to Hz in the readouts.

**Node counting is measured.** A leaky peak-hold envelope is accumulated per grid point;
interior dips below a fraction of the peak are counted, and dips touching either edge are
discarded. The readout prints the measured count and spacing next to the formula value.

Figures: `ResonanceLab` (three modes — frequency sweep to find resonances, pluck with a
harmonic spectrum, and a frozen pattern the student has to identify), `ImpedanceReflection`
(a pulse hitting a boundary with an impedance-ratio slider; fixed and free are the ends of
the slider).

Quizzes: guitar-string fundamental; third harmonic; closed-pipe fundamental; which
frequency cannot be a closed-pipe resonance; what the open end is (displacement antinode
**and** pressure node); interior node count for the 4th harmonic; echo sounding at
1500 m/s with the factor of two; why the gel is needed.

## 6. Lesson 3 — Beats, timbre and spectrum (specified, not yet planned)

`physics-03-beats-timbre`. Sections: beats and `f_beat = |f₁ − f₂|`; why it is the
difference (trigonometric identity and the phasor view — Module 0's first real payoff);
timbre as a recipe of harmonics; time domain ↔ frequency domain. Figures: `BeatsLab`
(two real tones sounding together, envelope, and a phasor panel) and `TimbreMixer`
(harmonic sliders, waveform and bar spectrum, playable). Requires a multi-voice extension
to `framework/audio/tone.ts`; total gain stays clamped at `MAX_GAIN = 0.2`.

## 7. Lesson 4 — Intensity, decibels and hearing (specified, not yet planned)

`physics-04-decibels`. Sections: `I = P/4πr²`; `L = 10 lg(I/I₀)`; decibel arithmetic
(+3 dB for a second identical source, −6 dB per doubling of distance); reverberation —
`RT60` is by definition the time for a 60 dB drop, so exponential decay is a straight line
on a dB axis; and `10 lg` vs `20 lg`. Figures: `InverseSquareField` (draggable listener,
dB rings, second source) and `ReverbDecay`. Must add to Module 0's decibel section, not
repeat it. Equal-loudness contours are a Beyond note only — a laptop speaker is not
calibrated, so no playable version.

## 8. Finnish terms

Sourced from the PDFs in `Textbook_materials/Physics/`: Luku 14, 15, 16 cover `huojunta`,
`äänenväri`, `seisova aalto`, `solmu`, `kupu`, `intensiteetti`, `intensiteettitaso`,
`infraääni`, `ultraääni`, `kaikuluotain`, `akustiikka`, `jälkikaiunta-aika`.

**Not sourced:** lesson 1's core vocabulary (`poikittaisaalto`, `pitkittäisaalto`,
`etenemisnopeus`, `aaltoyhtälö`, `aallonpituus`) lives in an earlier chapter that has not
been exported. The executor must mark these `UNVERIFIED` in the log rather than guess; a
human checks them against the book. The PDFs are scanned images with no text layer.

## 9. Out of scope

2D simulation (Chladni patterns, end correction from first principles); Doppler and
supersonic flight (lesson 5); anything about impedance beyond the qualitative statement.
