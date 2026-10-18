# Audit notes: batch 3 (MIT-MV-12 to MIT-MV-16)

One line per audit kind: `kind | params (meaning, order) | fact the answer relies on`. Params are exactly the sampled inputs; arrays are written `[x, y, z]`. A card's answer fields are listed in the order of `fields`. Angles: π = Math.PI. Cycloid: x = a(t − sin t), y = a(1 − cos t). Counterclockwise is positive.

## MIT-MV-12 (cycloid and cusp)

- `MIT-MV-12:position` | `a` radius, `k` integer 1..3; the angle is θ = kπ | Rolling wheel: center C = (aθ, a), CP = (−a sin θ, −a cos θ), P = C + CP. Fields: [x, y].
- `MIT-MV-12:velocity` | `a` radius, `p`, `q` positive integers; t = pπ/q | Velocity = (dx/dt, dy/dt) of the cycloid at t. Fields: [v₁, v₂].
- `MIT-MV-12:speed` | `a`, `p`, `q` as above; t = pπ/q | Speed = Euclidean length of the cycloid velocity at t. Fields: [|v|].
- `MIT-MV-12:count-cusps` | `a` radius, `n` even positive integer; range 0 ≤ t ≤ nπ | A cusp is a time where the velocity vector is the zero vector; count such t in the closed interval (both endpoints included). Fields: [count].
- `MIT-MV-12:arch-length` | `a` radius, `n` number of arches; range 0 ≤ t ≤ 2nπ | Arc length = ∫ |v| dt over the range (|v| ≥ 0, so integrate per arch and add; kinks at t = 2πj). Fields: [length].
- `MIT-MV-12:cusp-time` (choice) | `a` radius | Option text has the form `t = cπ` or `t = cπ/2` (c a positive integer; read c and the optional `/2`). Correct option = the one whose t makes the cycloid velocity exactly the zero vector. Exactly one option qualifies.
- `MIT-MV-12:challenge` | `R` disk radius, `u`, `w` center velocity components (center = (u·t, w·t)), `n` revolutions per second (counterclockwise), `tn`, `td` with t = tn/td seconds | Edge point at time t: P = center(t) + R(cos φ, sin φ), φ = 2π·n·t, P(0) = center + (R, 0). Fields: [x, y].

## MIT-MV-13 (velocity, acceleration, arc length)

- `MIT-MV-13:velocity` | `a`, `b`, `c` integers, `t` time; r(t) = (a·t², b·t³ + c·t) | v = r′(t) at t. Fields: [v₁, v₂].
- `MIT-MV-13:acceleration` | same params as velocity | a = r″(t) at t. Fields: [a₁, a₂].
- `MIT-MV-13:line-speed-length` | `p`, `q` velocity components (x = p·t + x0, y = q·t + y0), `x0`, `y0` offsets, `t1`, `t2` interval | Speed = |(p, q)| (constant), length = ∫ speed dt over [t1, t2]. Fields: [speed, length].
- `MIT-MV-13:perfect-square` | `c` positive integer, `t` time; r(t) = (t, c·t², 2c²·t³/3) | Speed = |r′(t)| at t (here |r′|² = (1 + 2c²t²)²). Fields: [speed].
- `MIT-MV-13:arc-length-poly` | `c` as above, `T`; same curve r(t) = (t, c·t², 2c²·t³/3) | Arc length = ∫₀^T |r′(t)| dt. Fields: [length] (may be a non-integer rational; compare as a number).
- `MIT-MV-13:circle-acceleration` | `rho` radius, `omega` positive integer; r(t) = (ρ cos ωt, ρ sin ωt) | Fields: [speed |v|, magnitude |a| of the acceleration] (constant in t).
- `MIT-MV-13:challenge` | `k` positive integer, `T`; x = k·t³/3 − k·t, y = k·t² | Arc length = ∫₀^T |(x′, y′)| dt. Fields: [length] (rational).

## MIT-MV-14 (Kepler's second law)

- `MIT-MV-14:cross-z` | `x`, `y` position r = (x, y), `vx`, `vy` velocity v | (r × v)_z = x·v_y − y·v_x (counterclockwise positive); area rate dA/dt = ½|(r × v)_z|. Fields: [(r × v)_z, dA/dt].
- `MIT-MV-14:circle-sign` | `rho` radius, `omega` nonzero integer (negative = clockwise); r(t) = (ρ cos ωt, ρ sin ωt) | (r × v)_z = x·v_y − y·v_x with v = r′ (constant in t); area rate = half its absolute value (equivalently the area πρ² of the disk swept per period 2π/|ω|). Fields: [(r × v)_z, dA/dt].
- `MIT-MV-14:equal-areas` | `d1`, `v1` distance and speed at the first point, `d2` distance at the second point; both points have r ⟂ v | For a central force |r × v| is constant, and r ⟂ v gives |r × v| = d·v, so d1·v1 = d2·v2. Fields: [v2].
- `MIT-MV-14:swept-area` | `K` the (signed) value of (r × v)_z at time t1, `t1`, `t2` | Central force: r × v is constant, dA/dt = ½|K|; area swept from t1 to t2 = ½|K|·(t2 − t1). Fields: [area].
- `MIT-MV-14:torque` | `x`, `y` position, `ax`, `ay` acceleration | d/dt(r × v) = v × v + r × a = r × a, so the z-component is x·a_y − y·a_x. Fields: [(r × a)_z].
- `MIT-MV-14:challenge` | `a`, `b` positive integers, `w` positive integer ω, `T`; r(t) = (a cos ωt, b sin ωt), with ωT < 2π | Area swept by the radius vector from the origin, from t = 0 to t = T, is ∫ ½|x y′ − y x′| dt = ½·a·b·ω·T (equivalently the shoelace area of the fan polygon O, r(t₀), …, r(T)). Fields: [area].

## MIT-MV-15 (Unit 1 review; thin evidence)

- `MIT-MV-15:angle` | `q`, `r` vectors Q and R from the origin O | cos ∠QOR = (Q·R)/(|Q||R|). Fields: [cos].
- `MIT-MV-15:triangle-area` | `p`, `q`, `r` vertices | Area = ½|PQ × PR|. Fields: [area].
- `MIT-MV-15:plane-constant` | `p`, `q`, `r` three non-collinear points | Normal N = PQ × PR exactly (no scaling, this order), plane N·X = d with d = N·P. Fields: [a, b, c, d] = [N₁, N₂, N₃, d].
- `MIT-MV-15:solve-system` | `m` the 3×3 matrix M as a flat row-major array of 9 numbers, `b` right-hand side | Solution X of M·X = b (M invertible). Fields: [x, y, z].
- `MIT-MV-15:singular-c` | `u1`, `u2` the first two entries of row U = (u1, u2, c), `v`, `w` the rows V and W | det M = U·(V × W); the c that makes det M = 0 (unique, because the coefficient of c is nonzero). Fields: [c].
- `MIT-MV-15:ladder` | `L` ladder length, `d` integer with θ = π/d | Ladder with foot at (−L cos θ, 0) and top at (0, L sin θ) (top on the wall x = 0, foot on the ground y = 0 at x ≤ 0), θ = angle with the ground; answer = midpoint. Fields: [x, y].
- `MIT-MV-15:helix-speed` | `a`, `c`, `t`; r(t) = (c·t, a cos t, a sin t) | Speed = |r′(t)| at t (independent of t). Fields: [speed].
- `MIT-MV-15:constant-length` | `v` the velocity vector V at one instant of a motion with |R| constant | |R| constant ⇒ R·V = 0 ⇒ V·V + R·A = 0, so R·A = −|V|². Fields: [R·A].
- `MIT-MV-15:cycloid-arch` | `a` radius, `n` number of arches (0 ≤ t ≤ 2nπ) | Cycloid arc length ∫|v| dt over the range. Fields: [length].
- `MIT-MV-15:area-rate` | `x`, `y` position, `vx`, `vy` velocity | dA/dt = ½|x·v_y − y·v_x| (area of the triangle O, r, r + v·dt divided by dt). Fields: [dA/dt].
- `MIT-MV-15:det-zero` (choice) | `D` = det M | Options (English text): `Only X = 0`, `Infinitely many solutions, including X = 0`, `No solutions`. M·X = 0 always has X = 0; for D ≠ 0 it is the only solution, for D = 0 there are infinitely many. Correct: `Only X = 0` if D ≠ 0, else `Infinitely many...`.
- `MIT-MV-15:challenge` | `p`, `q`, `r` three non-collinear points of a plane, `s` the point S, `v` the direction V | The unique t with S + tV in the plane through P, Q, R (N = PQ × PR, N·X = N·P; N·V ≠ 0). Fields: [t].

## MIT-MV-16 (Exam 1)

- `MIT-MV-16:cosine` | `alpha`, `beta`, `gamma`: P = (α, 0, 0), Q = (0, β, 0), R = (0, 0, γ); α and γ may be negative (changed 2026-10-07) | cos ∠PQR = (QP·QR)/(|QP||QR|), QP = P − Q, QR = R − Q (angle at Q). Fields: [cos].
- `MIT-MV-16:area` | `p`, `q`, `r` vertices | Area = ½|PQ × PR|. Fields: [area].
- `MIT-MV-16:plane` | `p`, `q`, `r` three non-collinear points | N = PQ × PR exactly (no scaling), d = N·P. Fields: [a, b, c, d].
- `MIT-MV-16:bug-position` | `u` car speed | Ladybug position relative to the road is r(t) = (u·t + cos t, sin t) (car center moves right at speed u, bug walks counterclockwise at unit speed on the unit circle starting from (1, 0)); evaluate at t = π/2. Fields: [x, y].
- `MIT-MV-16:bug-speed` | `u` car speed (u ≥ 2), same r(t) = (u·t + cos t, sin t) | On 0 ≤ t ≤ π: |v|² = (u − sin t)² + cos² t. Fields: [minimum of |v|² over [0, π], maximum of |v|² over [0, π]] (changed 2026-10-07: both fields are now |v|²; the minimum used to be |v|).
- `MIT-MV-16:det` | `m` the 3×3 matrix M as a flat row-major array of 9 numbers | det M. Fields: [det].
- `MIT-MV-16:inverse-entry` | `m` flat row-major matrix as above, `i`, `j` (1-based row and column) | K = adjugate of M = transpose of the cofactor matrix, so that M⁻¹ = K/det M. Answer = K[i][j] = det M · (M⁻¹)[i][j]. Fields: [K[i][j]].
- `MIT-MV-16:solve-system` | `m` flat row-major matrix, `b` right-hand side | Solution X of M·X = b. Fields: [x, y, z].
- `MIT-MV-16:plane-motion` | `a`, `b`, `c` plane normal N = (a, b, c), `d` plane constant, `v1`, `v2` first two velocity components | A point moving on N·r = d has N·v = 0; solve for v₃. Fields: [v₃].
- `MIT-MV-16:parallel-line` (choice) | `a`, `b`, `c`, `d` plane a·x + b·y + c·z = d, `A`, `B` two points of the line | Options (English text start): `Yes: N · AB = 0`, `No: N · AB ≠ 0`, `It cannot be decided...`. The direction AB = B − A is parallel to the plane exactly when N·AB = 0. Correct: `Yes...` if N·AB = 0, else `No...`; the third option is never correct.
- `MIT-MV-16:unique-solution` (choice) | `D` = det M | Options (English text start): `Exactly one solution, whatever B is`, `No solution or infinitely many, depending on B`, `Infinitely many solutions for every B`. D ≠ 0: the first; D = 0: the second; the third is never correct.
- `MIT-MV-16:challenge` | `m` flat row-major matrix M, `c1`, `c3` constants | r(t) solves M·r = (c1, t, c3) (second equation has right side t). Fields: [dx/dt, dy/dt, dz/dt] = M⁻¹·(0, 1, 0) (rational numbers).
