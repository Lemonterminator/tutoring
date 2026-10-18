# Audit notes, batch 07 (MIT-MV-31 to MIT-MV-35)

Conventions: "params" are exactly the sampled inputs; every param value is printed in the question (0 and 1 are implicit). "Fields" is the order of the card's `fields`. An omitted polynomial term has coefficient 0, a bare variable coefficient 1, and `−x²` means coefficient −1. Choice cards: the oracle decides which English option is correct from the rule given (options are shuffled unless `fixedOrder`). π = Math.PI. All integrals are over the region named in the question; double integrals are ordinary Riemann integrals, so the printed order of integration only matters for the explanation.

Iterated limits are printed as inequalities, inner variable first, e.g. `0 ≤ y ≤ 4 − 2x,  0 ≤ x ≤ 2` means inner y from 0 to 4 − 2x, outer x from 0 to 2.

## MIT-MV-31 Exam 2 (14 cards: Unit 2 mixed deck)

Shared function of cards 1 to 4: f(x, y) = a x²y² − b x (printed expanded; a, b non-zero), point P = (x0, y0), with f_x(P) ≠ 0 and f_y(P) ≠ 0 guaranteed.

- `MIT-MV-31:gradient` | `a`, `b`, `x0`, `y0` | Fields [f_x(P), f_y(P)] with f_x = 2a·x·y² − b, f_y = 2a·x²·y.
- `MIT-MV-31:tangent-plane` | `a`, `b`, `x0`, `y0` (the printed point is P = (x0, y0, f(P))) | Tangent plane to the graph at P written z = m x + n y + k. Field [k] = f(P) − f_x(P)·x0 − f_y(P)·y0.
- `MIT-MV-31:linear-approx` | `a`, `b`, `x0`, `y0`, `dx`, `dy` (Δx, Δy ∈ {±0.1, ±0.2}; the printed target point is (x0 + dx, y0 + dy)) | Field [estimate] = f(P) + f_x(P)·dx + f_y(P)·dy, to 2 decimals (tolerance 0.005). The exact f(x0 + dx, y0 + dy) differs from it by at least 0.02, so the exact value must be rejected.
- `MIT-MV-31:directional` | `a`, `b`, `x0`, `y0`, `v1`, `v2` (v = (v1, v2) has |v| = 5, entries ±3, ±4) | Field [df/ds] = (f_x(P)·v1 + f_y(P)·v2)/5.
- `MIT-MV-31:critical` | `a`, `b`, `c`, `d`, `e`; w = a x² + b xy + c y² + d x + e y, with 4ac − b² ≠ 0, integer critical point in [−3, 3]² | Fields [x, y] = the unique solution of 2a x + b y + d = 0 and b x + 2c y + e = 0.
- `MIT-MV-31:classify` (choice) | `a`, `b`, `c` (the function printed also contains the linear terms d, e, which do not matter) | Options (English): "A local minimum", "A local maximum", "A saddle point", "The test cannot decide". With D = 4ac − b² (= w_xx w_yy − w_xy²): D < 0 saddle point; D > 0 and a > 0 local minimum; D > 0 and a < 0 local maximum. D is never 0, so "cannot decide" is never correct.
- `MIT-MV-31:boundary-max` | `a`, `c`, `d`, `e` (all positive; a printed as `−x²` when a = 1) | w = −a x² − c y² + d x − e y on x ≥ 0, y ≥ 0. Fields [x, y, w] of the maximum on the quadrant = [d/(2a), 0, d²/(4a)] (the only critical point has y = −e/(2c) < 0).
- `MIT-MV-31:chain-rule` | `x0`, `y0`, `wu`, `wv` (x0 ∈ {±1, ±2}, y0 ≠ 0); w = w(u, v), u = y/x, v = x² + y² | Fields [w_x, w_y] at (x0, y0) = [−(y0/x0²)·wu + 2·x0·wv, (1/x0)·wu + 2·y0·wv].
- `MIT-MV-31:total-diff` | `p`, `q`, `r`, `a`, `b`, `c` | Surfaces p x² + q y³ + r z⁴ = p + q + r and a z³ + b xz + c xy = a + b + c, both through (1, 1, 1). Field [dy/dx at (1,1,1) along the intersection curve]: with A1 = 2p, B1 = 3q, C1 = 4r, A2 = b + c, B2 = c, C2 = 3a + b the value is (A1·C2 − A2·C1)/(B2·C1 − B1·C2). Sampling guarantees denominator and numerator non-zero, reduced denominator ≤ 4 and |answer| ≤ 8.
- `MIT-MV-31:challenge` | `p`, `q`, `R`; (p, q) ∈ {(±3, ±4), (±4, ±3)}; the circle x² + y² = R² (R printed as the radius and as R²) | Maximise f = p x + q y on the circle. Fields [x, y, largest f] = [p·R/5, q·R/5, 5R].

Cards without audit:
- `MIT-MV-31-contour-points` (choice, `fixedOrder`, options "Point P/Q/R/S"): f = (x − h)² + (y − k)² (printed), circle f = ρ² with centre (h, k). Four labelled points sit at top (h, k + ρ), right, bottom, left in a shuffled letter order that the figure's alt text lists as "(top), (right), (bottom), (left)". The asked condition is one of: f_x = 0 and f_y > 0 (top), f_y = 0 and f_x > 0 (right), f_x = 0 and f_y < 0 (bottom), f_y = 0 and f_x < 0 (left). The correct option is the letter at that position.
- `MIT-MV-31-inconclusive` (choice): f = ±k1 x⁴ ± k2 y⁴, (0, 0) critical with zero discriminant. Correct: the option that concludes "minimum" if both coefficients are positive, "maximum" if both negative, "saddle point" (f > 0 along one axis and < 0 along the other) if the signs differ. The option "Because … = 0, the point (0, 0) is always a saddle point" is never correct.
- `MIT-MV-31-choose-tool` (choice): scenario text decides the correct method: "largest x on a surface" is Lagrange multipliers; "f(2,1), f_x, f_y given, estimate f(2.1, 0.9)" is linear (tangent-plane) approximation; "second derivatives of w at a critical point, decide min/max/saddle" is the second derivative test; "w = w(u, v) with u, v given, express w_x" is the chain rule.
- `MIT-MV-31-lagrange-setup` (choice, `fixedOrder`): surface g = c with g = A x² + B y² + C z² + D xy + E yz; "where X is largest" (X = x, y or z). Correct: the option "(unit vector with 1 in the position of X) = λ(g_x, g_y, g_z)"; the options are in the order x, y, z, then "(g_x, g_y, g_z) = (0, 0, 0)" which is never correct.

## MIT-MV-32 Definition of Double Integrals (8 cards)

- `MIT-MV-32:corner-sum` | `m`, `n`, `p`, `q`, `r` | R = [0, m] × [0, n] cut into m·n unit squares (ΔA = 1), f = p x + q y + r, sample point = lower-left corner (i, j), i = 0..m−1, j = 0..n−1. Field [Σ f(x_i, y_i)] = Σ_{i,j} (p·i + q·j + r).
- `MIT-MV-32:table-sum` | `dA` (array of 4 areas), `delta` (array of 4 densities), printed as "Piece i: ΔA = …, δ = …" | Field [M] = Σ dA[i]·delta[i].
- `MIT-MV-32:challenge` | `m`, `n`, `p`, `q`, `r` | Same as corner-sum but sample point = upper-right corner (i, j), i = 1..m, j = 1..n. Field [Σ] = Σ_{i=1..m, j=1..n} (p·i + q·j + r).

Cards without audit:
- `MIT-MV-32-piece-area` (choice): correct "The area of the i-th small piece of R."
- `MIT-MV-32-setup` (symbols): one of three quantities (mass M with density δ(x, y), volume V under z = f(x, y), population N with density ρ(x, y)). Slot answers in order: `∬_R`, the matching integrand (`δ(x, y)`, `f(x, y)` or `ρ(x, y)`), `dA`.
- `MIT-MV-32-sample-point` (choice): correct "The sums differ, but both are only approximations; …same limit ∬_R f dA." (the options "only A is genuine" and "the sums must be equal" are wrong; the printed sums are lower-left and upper-right corner sums of f = p x + q y).
- `MIT-MV-32-limit` (choice): correct "S is an approximation; the integral is the limit of such sums when the number of pieces goes to infinity and every ΔA_i goes to 0."
- `MIT-MV-32-units` (choice): density in `M/L²` and areas in `L²`: the mass unit `M` alone is correct (not `M/L²`, not `M·L²`).

## MIT-MV-33 Examples of Double Integration (9 cards)

Triangle R of cards 1 to 3 and 8: bounded by the axes and the line y = c − k x, meeting the axes at (a, 0) and (0, c), c = k·a (a, k ∈ 1..3).

- `MIT-MV-33:triangle-integral` | `a`, `c`, `p`, `q` | Field [∬_R (p x + q y) dA] over the triangle (0,0), (a,0), (0,c) = a·c·(p·a + q·c)/6.
- `MIT-MV-33:curved-area` | `s` (1..4) | Region between y = x² and y = x + s for 0 ≤ x ≤ 1. Field [area] = s + 1/6.
- `MIT-MV-33:curved-mass` | `s`, `p` | Same region, density δ = p·x. Field [M] = p·(1 + 6s)/12.
- `MIT-MV-33:tetrahedron` | `h`, `p`, `q` | Volume under the plane z = h − p x − q y over the triangle with vertices (0,0), (h/p, 0), (0, h/q) (these intercepts are printed). Field [V] = h³/(6·p·q).
- `MIT-MV-33:challenge` | `m`, `b`, `p`, `q` | R = triangle bounded by y = 0, x = b and y = m x. Field [∬_R (p x + q y) dA] = p·m·b³/3 + q·m²·b³/6.

Cards without audit:
- `MIT-MV-33-vertical-line` (choice): correct = the procedure "Hold x fixed and let y increase … vertical line … inner limits are the y-values where the line enters and leaves R; outer limits run over all x for which the line meets R."
- `MIT-MV-33-triangle-limits` (symbols, blanks printed as `[ ] ≤ y ≤ [ ],  [ ] ≤ x ≤ [ ]`): answers in order `0`, `c − kx` (printed as e.g. `4 − 2x`), `0`, `a`.
- `MIT-MV-33-curved-limits` (choice): correct "Inner: y from x² to x + s. Outer: x from 0 to 1."
- `MIT-MV-33-bad-limits` (choice): correct "Outer: x from 0 to a. Inner: y from 0 to c − kx."

## MIT-MV-34 Exchanging the Order of Integration (8 cards)

Regions used by the symbols and picture cards (forms): `upper` {0 ≤ x ≤ y ≤ a}, `lower` {0 ≤ y ≤ x ≤ a}, `under` {x + y ≤ a, x, y ≥ 0}, `parabola` {x² ≤ y ≤ a, 0 ≤ x ≤ √a} (a ∈ {4, 9}), `wedge` {0 ≤ y ≤ m·x, 0 ≤ x ≤ a}. The card prints the limits in the given order and the region in words.

- `MIT-MV-34:poly-exchange` | `a`, `lo0`, `lo1`, `hi0`, `hi1`, `p`, `q` | Region {0 ≤ x ≤ a, lo0 + lo1·x ≤ y ≤ hi0 + hi1·x} (printed in the order dy dx, e.g. `0 ≤ y ≤ 3 − x,  0 ≤ x ≤ 3` for lo = (0, 0), hi = (3, −1)). Field [I = ∬_R (p x + q y) dA]; the order of integration does not change the value.
- `MIT-MV-34:gaussian` | `a`, `m` | I = ∬_R m·e^{−y²} dA over R = {0 ≤ x ≤ a, x ≤ y ≤ a}. The card says I = k(1 − e^{−a²}) (the exponent printed as a²). Field [k] = m/2.
- `MIT-MV-34:challenge` | `n`, `d`, `k` | c = n·π/d printed as `π`, `π/d` or `nπ/d`. I = ∬_R k·sin(x)/x dA over R = {0 ≤ y ≤ c, y ≤ x ≤ c}. Field [I] = k·(1 − cos c).

Cards without audit:
- `MIT-MV-34-read-region` (choice, `fixedOrder`, options "Picture A..D" with figures): pictures are the forms upper, lower, under, parabola (same a ∈ {4, 9}) in this order; the correct picture is the form whose limits are printed (inner y from x … to …, outer x).
- `MIT-MV-34-swap-limits` (symbols): given dy dx limits of a region (any of the five forms), answers in order: inner x lower, inner x upper, outer y lower, outer y upper, printed as `[ ] ≤ x ≤ [ ],  [ ] ≤ y ≤ [ ]`. Expected: upper `0, y, 0, a`; lower `y, a, 0, a`; under `0, a − y, 0, a`; parabola `0, √y, 0, a`; wedge `y/m, a, 0, m·a`.
- `MIT-MV-34-swap-back` (symbols): given dx dy limits, answers in order: inner y lower, inner y upper, outer x lower, outer x upper, printed as `[ ] ≤ y ≤ [ ],  [ ] ≤ x ≤ [ ]`. Expected: upper `x, a, 0, a`; lower `0, x, 0, a`; under `0, a − x, 0, a`; parabola `x², a, 0, √a`; wedge `0, m·x, 0, a`.
- `MIT-MV-34-why-exchange` (choice): correct = the option that says to exchange the order (R becomes 0 ≤ y ≤ c, 0 ≤ x ≤ y; inner x-integral gives sin y or y·e^{−y²}); the other two options (keep the order; neither works) are wrong.
- `MIT-MV-34-constant-limits` (choice): correct = the rectangle option (`0 ≤ y ≤ b,  0 ≤ x ≤ a`); the two triangles are wrong.

## MIT-MV-35 Double Integrals in Polar Coordinates (9 cards)

- `MIT-MV-35:patch-area` | `r`, `dr`, `dth` (dr, dth ∈ {0.1, 0.2, 0.5}) | Field [ΔA ≈ r·dr·dth] rounded to 2 decimals (tolerance 0.005).
- `MIT-MV-35:sector-mass` | `R`, `d` (d ∈ {2, 3, 4, 6}) | Plate on 0 ≤ r ≤ R, 0 ≤ θ ≤ π/d with density xy. Field [M] = R⁴·sin²(π/d)/8.
- `MIT-MV-35:ring-integral` | `b`, `c`, `k` | ∬ k·(x² + y²) dA over b² ≤ x² + y² ≤ c² (printed as b², c²; the integrand is printed `k(x² + y²)`, or `(x² + y²)` for k = 1). Field [value] = k·π·(c⁴ − b⁴)/2 (answer entered as an exact multiple of π, e.g. `15pi/2`).
- `MIT-MV-35:cardioid-area` | `a`, `sign` (±1) | Area inside r = a(1 + sign·cos θ), 0 ≤ θ ≤ 2π (printed `a(1 + cos θ)` or `a(1 − cos θ)`; `1 + cos θ` for a = 1). Field [area] = 3π·a²/2.
- `MIT-MV-35:challenge` | `a`, `k` | ∬_R k/√(x² + y²) dA over the disk (x − a)² + y² ≤ a² (printed as radius a centred at (a, 0)). Field [value] = 4·a·k.

Cards without audit:
- `MIT-MV-35-area-element` (choice): correct "r Δr Δθ" (not Δr Δθ, r² Δr Δθ, Δr Δθ / r).
- `MIT-MV-35-circle-equation` (choice): circle of radius a centred at (a, 0): correct `r = 2a cos θ` (printed with the number 2a); the others are `r = 2a sin θ`, `r = a`, `r = a cos θ`.
- `MIT-MV-35-polar-limits` (symbols, printed as `[ ] ≤ r ≤ [ ],  [ ] ≤ θ ≤ [ ]`, inner r first): five regions. Sector of radius R from the x-axis to the ray at angle π/d: `0, R, 0, π/d`. Ring between r = b and r = c: `b, c, 0, 2π`. Disk (x − a)² + y² ≤ a²: `0, 2a cos θ, −π/2, π/2`. Region 1 ≤ x ≤ c, 0 ≤ y ≤ x: `sec θ, c sec θ, 0, π/4`. Inside the cardioid r = a(1 + cos θ): `0, a(1 + cos θ), 0, 2π`. The token texts are the strings shown (for example `6 cos θ`, `2(1 + cos θ)`, `3 sec θ`).
- `MIT-MV-35-negative-r` (choice): the student's integral ∫₀^{2π}∫_{−R}^{R} r dr dθ equals 0; correct = the option that says the integral is 0 (not πR², not 2πR²).
