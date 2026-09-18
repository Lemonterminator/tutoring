# Execution Log — Physics 01–02

## Task 1 — Physics subject scaffold and shared acoustics helpers
- Step 1: done
- Step 2: ran `npx vitest run subjects/physics/_components/acoustics.test.ts` → FAIL: `Error: Failed to resolve import "./acoustics" from "subjects/physics/_components/acoustics.test.ts". Does the file exist?`
- Step 4: ran `npx vitest run subjects/physics/_components/acoustics.test.ts` → `Tests  6 passed (6)`
- Gate: vitest `Test Files  24 passed (24)`, `Tests  81 passed (81)`; typecheck clean; check clean
- Commit: 7f5538c "feat: physics subject scaffold and shared acoustics helpers"

## Task 2 — The travelling wave and its derivatives
- Step 1: done
- Step 2: ran `npx vitest run subjects/physics/01-traveling-waves/wave1d.test.ts` → FAIL: `Error: Failed to resolve import "./wave1d" from "subjects/physics/01-traveling-waves/wave1d.test.ts". Does the file exist?`
- Step 4: ran `npx vitest run subjects/physics/01-traveling-waves/wave1d.test.ts` → `Tests  9 passed (9)`
- Gate: vitest `Test Files  25 passed (25)`, `Tests  90 passed (90)`; typecheck clean
- Commit: 11e0cac "feat: travelling wave model with derivatives and pressure"

## Task 3 — The caliper figure — snapshot and history side by side
- Step 1: done
- Step 2: ran `npx vitest run subjects/physics/01-traveling-waves/WaveCalipers.test.tsx` → FAIL: `Error: Failed to resolve import "./WaveCalipers" from "subjects/physics/01-traveling-waves/WaveCalipers.test.tsx". Does the file exist?`
- Step 4: ran `npx vitest run subjects/physics/01-traveling-waves/WaveCalipers.test.tsx` → `Tests  4 passed (4)`
- Gate: vitest `Test Files  26 passed (26)`, `Tests  94 passed (94)`; typecheck clean
- Commit: dded155 "feat: caliper figure for measuring wavelength and period"

## Task 4 — Transverse against longitudinal, with the pressure curve
- Step 1: done
- Step 2: ran `npx vitest run subjects/physics/01-traveling-waves/TransverseVsLongitudinal.test.tsx` → FAIL: `Error: Failed to resolve import "./TransverseVsLongitudinal" from "subjects/physics/01-traveling-waves/TransverseVsLongitudinal.test.tsx". Does the file exist?`
- Step 4: ran `npx vitest run subjects/physics/01-traveling-waves/TransverseVsLongitudinal.test.tsx` → `Tests  3 passed (3)`
- Gate: vitest `Test Files  27 passed (27)`, `Tests  97 passed (97)`; typecheck clean
- Commit: b326683 "feat: transverse and longitudinal figure with the pressure curve"

## Task 5 — Why a curved string accelerates — a static SVG diagram
- Step 1: done
- Step 2: ran `npx vitest run subjects/physics/01-traveling-waves/StringElement.test.tsx` → FAIL: `Error: Failed to resolve import "./StringElement" from "subjects/physics/01-traveling-waves/StringElement.test.tsx". Does the file exist?`
- Step 4: ran `npx vitest run subjects/physics/01-traveling-waves/StringElement.test.tsx` → `Tests  3 passed (3)`
- Gate: vitest `Test Files  28 passed (28)`, `Tests  100 passed (100)`; typecheck clean
- Commit: 64c40d8 "feat: string element force diagram behind the wave equation"

## Task 6 — Lesson 1 English content and glossary
- Step 1: done
UNVERIFIED: wavelength, period, frequency, wave-speed, amplitude, angular-frequency, wave-number, transverse-wave, longitudinal-wave, partial-derivative, pressure, wave-equation
- Step 2: done
- Step 3: wrote `subjects/physics/01-traveling-waves/lesson.test.tsx` before mdx to verify failure; verified `expected <h2 data-b="0" id="sec-0"></h2> to have a length of 5 but got 1`
- Step 3: replaced the third test with the corrected plan-author version; the Finnish assertion moved to the glossary row count.
- Step 5: ran `npx vitest run subjects/physics/01-traveling-waves/lesson.test.tsx` → FAIL: `AssertionError: expected undefined to be ' (wavelength)'` at line 39 (`expect(container.querySelector('[data-term="wavelength"] .term__alt')?.textContent).toBe(' (wavelength)');`)
- Step 5: reran `npx vitest run subjects/physics/01-traveling-waves/lesson.test.tsx` → `Test Files  1 passed (1)`, `Tests  3 passed (3)`
- Gate: vitest `Test Files  29 passed (29)`, `Tests  103 passed (103)`; typecheck `> tsc --noEmit` exit code 0
- Commit: e0225cf "feat: lesson 1 English content and glossary"

## Task 7 — Lesson 1 Finnish translation
- Step 1: ran `curl -s http://localhost:11434/api/tags` → output contained `"name":"qwen3.6:35b-a3b"`; exit code 0
- Step 2: done
- Step 3: ran `npx vitest run subjects/physics/01-traveling-waves/lesson.test.tsx` → FAIL: `expected [ '1. Paikanvaraus' ] to have a length of 5 but got 1`
- Step 4: ran `npm run translate -- subjects/physics/01-traveling-waves` → `section 1/6, attempt 1 (qwen3.6:35b-a3b)`; `section 2/6, attempt 1 (qwen3.6:35b-a3b)`; `structure mismatch:`; `- invalid MDX: Unexpected character `,` (U+002C) in attribute name, expected an attribute name character such as letters, digits, `$`, or `_`; `=` to initialize a value; whitespace before attributes; or the end of the tag`; `section 2/6, attempt 2 (qwen3.6:35b-a3b)`; `section 3/6, attempt 1 (qwen3.6:35b-a3b)`; `section 4/6, attempt 1 (qwen3.6:35b-a3b)`; `section 5/6, attempt 1 (qwen3.6:35b-a3b)`; `section 6/6, attempt 1 (qwen3.6:35b-a3b)`; `wrote subjects\physics\01-traveling-waves\lesson.fi.mdx — now run: npm run check`
- Step 5: ran `npm run check` → `✔ subjects/math/00-wave-math-foundations: EN and FI match`; `✔ subjects/physics/01-traveling-waves: EN and FI match`
- Step 6: read the complete Finnish file and fixed concrete defects: `Empään kauempana...` → `Kauempana...`; `Sitoo amplitudista` → `Se riippuu amplitudista`; `yhden kokoisen aallon` → `yhden kokonaisen aallon`; `yhden kokoisen kierron` → `yhden kokonaisen jakson`; `aikakalusto` → `aika-akseli`; `ultraäänit` → `ultraääni`; `solmu tai pää` → `solmu tai kupu`; `Oppimäärän 2 kohdalla` → `Oppitunnilla 2`; `otoksen kulma` → `hetkikuvan kulmakerroin`; `liikkuä` → `liikkuu`; decimal commas `0,017`, `0,68`, `1,2`, `3,0`, `0,0030`, `0,5`, `0,0005`, `0,53`, `2,5`, `6,16`, `0,62` → matching English decimal points
- Step 7: ran `npx vitest run subjects/physics/01-traveling-waves/lesson.test.tsx` → `Test Files  1 passed (1)`, `Tests  4 passed (4)`
- Gate: vitest `Test Files  29 passed (29)`, `Tests  104 passed (104)`; typecheck `> tsc --noEmit` exit code 0; check `✔ subjects/math/00-wave-math-foundations: EN and FI match`, `✔ subjects/physics/01-traveling-waves: EN and FI match`
- Commit: 8a7f363 "feat: lesson 1 Finnish translation (Ollama draft, spot-checked)"

## Task 8 — The finite-difference wave solver
- Step 1: done
- Step 2: ran `npx vitest run subjects/physics/02-standing-waves/fdwave.test.ts` → FAIL: `Failed to resolve import "./fdwave" ... Does the file exist?`
- Step 4: ran `npx vitest run subjects/physics/02-standing-waves/fdwave.test.ts` → `Test Files  1 passed (1)`, `Tests  7 passed (7)`
- Step 5: done
- Gate: vitest `Test Files  30 passed (30)`, `Tests  111 passed (111)`; typecheck `> tsc --noEmit` exit code 0; check `✔ subjects/math/00-wave-math-foundations: EN and FI match`, `✔ subjects/physics/01-traveling-waves: EN and FI match`, `✔ subjects/physics/02-standing-waves: EN and FI match`
- Commit: 7d51b7e "feat: dispersion-free finite-difference wave solver"

## Task 9 — Mode formulas, node counting from data, and the cross-check
- Step 1: done
- Step 2: ran `npx vitest run subjects/physics/02-standing-waves/modes.test.ts` → FAIL: `Failed to resolve import "./modes" ... Does the file exist?`
- Step 4: ran `npx vitest run subjects/physics/02-standing-waves/modes.test.ts` → `Test Files  1 passed (1)`, `Tests  9 passed (9)`
- Gate: vitest `Test Files  31 passed (31)`, `Tests  120 passed (120)`; typecheck `> tsc --noEmit` exit code 0
- Commit: 19b86be "feat: mode formulas and node counting measured from the simulation"

## Task 10 — ResonanceLab — the figure the lesson is built on
- Step 1: done
- Step 2: ran `npx vitest run subjects/physics/02-standing-waves/ResonanceLab.test.tsx` → FAIL: `Failed to resolve import "./ResonanceLab" ... Does the file exist?`
- Step 4: ran `npx vitest run subjects/physics/02-standing-waves/ResonanceLab.test.tsx` → `Test Files  1 passed (1)`, `Tests  4 passed (4)`
- Gate: vitest `Test Files  32 passed (32)`, `Tests  124 passed (124)`; typecheck `> tsc --noEmit` exit code 0
- Commit: efb4379 "feat: resonance lab driving and plucking a solved wave equation"

## Task 11 — Reflection at a boundary, with an impedance slider
- Step 1: done
- Step 2: ran `npx vitest run subjects/physics/02-standing-waves/ImpedanceReflection.test.tsx` → FAIL: `Failed to resolve import "./ImpedanceReflection" ... Does the file exist?`
- Step 4: ran `npx vitest run subjects/physics/02-standing-waves/ImpedanceReflection.test.tsx` → `Test Files  1 passed (1)`, `Tests  3 passed (3)`
- Gate: vitest `Test Files  33 passed (33)`, `Tests  127 passed (127)`; typecheck `> tsc --noEmit` exit code 0
- Commit: 64e2a83 "feat: reflection at an impedance boundary with fixed and free ends as limits"

## Task 12 — Lesson 2 English content and glossary
- Step 1: done
UNVERIFIED: standing-wave, node, antinode, harmonic, fundamental-frequency, reflection, boundary-condition, resonance, acoustic-impedance, wavelength, pressure, ultrasound, echo-sounder
- Step 2: done
- Step 4: ran `npx vitest run subjects/physics/02-standing-waves/lesson.test.tsx` → `Test Files  1 passed (1)`, `Tests  3 passed (3)`
- Gate: vitest `Test Files  34 passed (34)`, `Tests  130 passed (130)`; typecheck `> tsc --noEmit` exit code 0
- Commit: efd397f "feat: lesson 2 English content and glossary"

## Task 13 — Lesson 2 Finnish translation, build, and acceptance
- Step 1: ran `curl -s http://localhost:11434/api/tags` → output contained `"name":"qwen3.6:35b-a3b"`; exit code 0
- Step 2: done
- Step 3: ran `npx vitest run subjects/physics/02-standing-waves/lesson.test.tsx` → FAIL: `expected [ '1. Paikanvaraus' ] to have a length of 5 but got 1`
- Step 4: ran `npm run translate -- subjects/physics/02-standing-waves` → `section 1/6, attempt 1 (qwen3.6:35b-a3b)`; `section 2/6, attempt 1 (qwen3.6:35b-a3b)`; `structure mismatch:`; `- invalid MDX: Expected a closing tag for <Echo> (39:1-39:15) before the end of paragraph`; `section 2/6, attempt 2 (qwen3.6:35b-a3b)`; repeated same mismatch; `section 3/6, attempt 1 (qwen3.6:35b-a3b)`; `section 4/6, attempt 1 (qwen3.6:35b-a3b)`; `structure mismatch:`; `- math count differs: en=25 fi=23`; `- Term ids differ: en=[fundamental-frequency harmonic resonance] fi=[harmoninen perustaajuus resonanssi]`; `section 4/6, attempt 2 (qwen3.6:35b-a3b)`; `- math count differs: en=25 fi=24`; `- Term ids differ: en=[fundamental-frequency harmonic resonance] fi=[harmoninen perustaajuus resonanssi]`; `section 5/6, attempt 1 (qwen3.6:35b-a3b)`; `section 6/6, attempt 1 (qwen3.6:35b-a3b)`; `wrote subjects\physics\02-standing-waves\lesson.fi.mdx — now run: npm run check`
- Step 5: first `npm run check` → FAIL: `cannot analyse: Expected a closing tag for <Echo> (44:1-44:15) before the end of paragraph`; after Finnish-only fixes → `✔ subjects/math/00-wave-math-foundations: EN and FI match`, `✔ subjects/physics/01-traveling-waves: EN and FI match`, `✔ subjects/physics/02-standing-waves: EN and FI match`
- Step 5: concrete fixes logged as `before → after`: `1,6` → `1.6`; `"ilma kudokseen"` → `"ilmasta kudokseen"`; `99,9` → `99.9`; `<Echo sounder> <Term id="echo-sounder">kaikuluotain</Term>` → `<Term id="echo-sounder">kaikuluotain</Term>`; `0,12` → `0.12`; `perustuu yhtä ideaaliin` → `perustuu samaan ideaan`; `kiinnitetty pää` → `kiinteä pää`; `Kiinnitetyssä päässä` → `Kiinteässä päässä`; `poistaa ilman väliaineen` → `poistaa ilman ja kudoksen välisen raon`; `Sillä ilman väliaine heijastaisi...` → `Koska ilmaväli heijastaisi...`; `Ilma ja kudos ovat epäsuhtaa ... ilman väliaineessa` → `Ilman ja kudoksen impedanssit eroavat toisistaan ... ilmavälissä`; `kuviointi` → `kuvio`; `sulje aalto kiinni` → `vangitaan aalto`; `janaan, jonka molemmat päät on kiinnitetty` → `molemmista päistä kiinnitetylle kielelle`; `eri sukua oleva eläin` → `eri tyyppinen ilmiö`; `kaikki mitä muuttuu` → `kaikki, mikä muuttuu`; `muoto tuli olemaan` → `muoto on`; `jota ei pitäisi tehdä` → `vaikka ei pitäisi`; `Kokonaiset puolikkaita ... kaksi on päissä` → `Kokonaisia puolikkaita ... kaksi niistä on päissä`; `kuppeja` → `kupuja`; `resonanssi` Term id `resonanssi` → `resonance`; `Sweep` → `Pyyhkäisy`; `kuppia` → `kupuja`; `n kuppia` → `n kupua`; `0,65` → `0.65`; `perustaajuus` Term id `perustaajuus` → `fundamental-frequency`; `0,65` and `1,3` → `0.65` and `1.3`; `harmoninen` Term id `harmoninen` → `harmonic`; `0,17` and `0,68` → `0.17` and `0.68`; `putki, toinen pää kiinni ... sweep` → `putki, toinen pää kiinni ... pyyhkäisy`; `kieliin, tehdä sweepin` → `kielelle, tehdä pyyhkäisyn`; `$3L/4` followed by backtick → `$3L/4$`; `minkä solmusta` → `minkä suureen solmusta`; `simulatio` → `simulaatio`; `pään korjaus` → `päätykorjaus`; `hakupeukaloiden` → `pyyhkäisyn`; `Pluck` and `soiton pistettä` → `Näppäys` and `näppäyskohtaa`; `timbre` → `äänenväri`; `joilla` → `jolla`; `Sieltä oppitunti 3 alkaa` → `Tästä alkaa oppitunti 3`
- Step 6: ran `npx vitest run subjects/physics/02-standing-waves/lesson.test.tsx` → `Test Files  1 passed (1)`, `Tests  4 passed (4)`
- Step 7: ran `npx vitest run` → `Test Files  34 passed (34)`, `Tests  131 passed (131)`; typecheck `> tsc --noEmit` exit code 0; build matching lines `✔ subjects/math/00-wave-math-foundations: EN and FI match`, `✔ subjects/physics/01-traveling-waves: EN and FI match`, `✔ subjects/physics/02-standing-waves: EN and FI match`; sizes `✔ dist\\math-00-wave-math-foundations.html (148 KB)`, `✔ dist\\physics-01-traveling-waves.html (112 KB)`, `✔ dist\\physics-02-standing-waves.html (107 KB)`
- Step 8: `dist/physics-01-traveling-waves.html` URLs → `http://www.w3.org/1998/Math/MathML`, `http://www.w3.org/1999/xhtml`, `http://www.w3.org/2000/svg`; `@font-face` count → `0`. `dist/physics-02-standing-waves.html` URLs → the same three W3C namespace URLs; `@font-face` count → `0`.
- Step 9: `file:///C:/Users/Jiang/Documents/ChatGPT/Tutoring/tutoring/dist/physics-02-standing-waves.html` → `NOT CHECKED (browser tool rejected the file URL: Browser use rejected this action due to browser security policy. Reason: The browser URL policy blocks this action.)` for items 1–6; item 7 → `LEFT FOR HUMAN`
- Commit: 3eaa394 "feat: lesson 2 Finnish translation (Ollama draft, spot-checked)"
