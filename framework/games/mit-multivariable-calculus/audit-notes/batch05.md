# Audit notes, batch 05 (MIT-MV-21 .. MIT-MV-25)

Conventions: every polynomial is printed in the card text with the literal coefficients named below; an omitted term has coefficient 0 and a bare variable has coefficient 1. "Field order" is the order of the card's `fields`. Choice cards: the oracle decides which English option is correct from the rule given here (the options are shuffled unless stated "fixed order"). Arrays (`xs`, `ys`, `devA`, `devB`) are printed in the question as lists of points or numbers, in the same order. Exponents are not audit params. All partial derivatives are ordinary partials of polynomials; `∂²f/∂x∂y` is never used in this batch except as `f_xy`.

## MIT-MV-21 Least Squares

Data sets always have n = 4 points with x-values equal to one of {0,1,2,3}, {−1,0,1,2}, {1,2,3,4}, {−3,−1,1,3}, {0,2,4,6} (all distinct) and integer y in 0..6. D(a, b) = Σ (yᵢ − a·xᵢ − b)². Least-squares line (a, b) minimises D: it solves (Σxᵢ²)a + (Σxᵢ)b = Σxᵢyᵢ and (Σxᵢ)a + n·b = Σyᵢ. By sampling a and b are non-zero multiples of 0.05 and the minimum D is at least 1.

- `MIT-MV-21:sum-squares` params xs (4 x-values), ys (4 y-values), a, b (the trial line y = a·x + b, printed as "y = …" and as "a = …, b = …"). Field: D(a, b) = Σ (yᵢ − (a xᵢ + b))².
- `MIT-MV-21:compare-lines` params devA (4 deviations of line A), devB (4 deviations of line B), both printed as vectors. Choice, options "Line A", "Line B", "Neither: both lines have the same D." Correct: the line with the smaller sum of squares of its deviations (never equal; the difference is at least 3). One of the lines always has deviations (p, −p, p, −p), i.e. sum 0.
- `MIT-MV-21:gradient-of-D` params xs, ys, a, b (the trial line, printed as "a = …, b = …"). Fields [∂D/∂a, ∂D/∂b] of D(a, b) = Σ (yᵢ − a xᵢ − b)² at that (a, b): ∂D/∂a = −2 Σ xᵢ dᵢ, ∂D/∂b = −2 Σ dᵢ with dᵢ = yᵢ − a xᵢ − b. Never both 0.
- `MIT-MV-21:normal-sums` params xs, ys. Fields [Σxᵢ², Σxᵢ, Σxᵢyᵢ, Σyᵢ]. (n = 4 is printed.)
- `MIT-MV-21:least-squares-line` params xs, ys. Fields [a, b] of the line that minimises D (answers are exact fractions with denominator dividing 20; typed as fraction or decimal).
- `MIT-MV-21:minimum-d` params xs, ys, a, b, where (a, b) is the least-squares line printed in the question as "y = … , that is a = … and b = …". Field: D(a, b) = Σ (yᵢ − (a xᵢ + b))², which is the minimum of D (two decimals, tolerance 0.005; the exact value has at most 2 decimals).
- `MIT-MV-21:challenge` params xs, ys (a different x-set from the earlier cards). Fields [a, b] as in `least-squares-line`.

Cards without audit: `MIT-MV-21-which-fit` (choice; exactly one option is a linear combination of known functions of x with the unknown coefficients appearing linearly, e.g. y = a₀ + a₁x + a₂x², y = a₀ + a₁x + a₂/x, y = a₀ + a₁eˣ, y = a₁x + a₂x³, y = a₀ + a₁/x, y = a₀ + a₁x + a₂x² + a₃x³; the other two have an unknown inside an exponential, sine, exponent or denominator, e.g. y = c·e^(kx), y = a·sin(bx), y = a·x^b, y = a/(1 + bx), y = a₀ + a₁e^(kx), y = a₀ + a₁x + a₂sin(bx), y = a₀ + a₁x^b). `MIT-MV-21-vertical` (choice; the correct option is the set of three points whose x-values are all equal; the others have all y equal (horizontal best line, fine) or generic distinct x).

## MIT-MV-22 The Second Derivative Test

A = f_xx, B = f_xy, C = f_yy. Test: AC − B² > 0 and A > 0 gives a minimum point; AC − B² > 0 and A < 0 a maximum point; AC − B² < 0 a saddle point; AC − B² = 0 the test fails. The English option order of the "classification" choices is fixed: minimum, maximum, saddle, (test fails).

- `MIT-MV-22:second-partials` params a,b,c,d,e,x0,y0; f = a x³ + b x y² + c x² + d x y + e y² (a, b non-zero). Fields [A, B, C] at (x0, y0): A = 6a·x0 + 2c, B = 2b·y0 + d, C = 2b·x0 + 2e.
- `MIT-MV-22:classify-abc` params A, B, C (printed as "A = f_xx = …"). Choice, fixed order: "A minimum point", "A maximum point", "A saddle point", "The test fails: more investigation is needed". Correct by the test above (disc = AC − B²).
- `MIT-MV-22:classify-quadratic` params a,b,c,d,e; f = a x² + b x y + c y² + d x + e y with 4ac ≠ b². The critical point P (printed in the question as "P = (x, y)") is the solution of 2a x + b y + d = 0, b x + 2c y + e = 0 (integer coordinates in −2..2). Choice, fixed order: minimum, maximum, saddle. Correct: saddle iff 4ac − b² < 0; otherwise minimum iff a > 0, maximum iff a < 0. A figure shows level curves f = f(P) + h (h = 1, 4, 9 for a minimum; −1, −4, −9 for a maximum; ±1, ±4 for a saddle); the caption lists h and f(P).
- `MIT-MV-22:second-critical-point` params p, c; f = p x³ + p y³ + c x y with c = −3 p k for an integer k ≠ 0 (p in {−2,−1,1,2}, |k| ≤ 3). Fields [x, y] of the critical point other than (0, 0): (k, k) with k = −c/(3p).
- `MIT-MV-22:discriminants` params p, c (same f, P = (k, k) printed). Fields [AC − B² at (0, 0), AC − B² at P] = [−c², 3c²] (f_xx = 6p x, f_xy = c, f_yy = 6p y).
- `MIT-MV-22:classify-two` params p, c (same f). Choice (shuffled). Options: "(0, 0) is a saddle point and P is a minimum point.", "(0, 0) is a saddle point and P is a maximum point.", "(0, 0) is a minimum point and P is a saddle point.", "Both (0, 0) and P are saddle points." Correct: (0, 0) is always a saddle (AC − B² = −c² < 0); P is a minimum iff A = f_xx(P) = −2c > 0, i.e. c < 0, and a maximum iff c > 0.
- `MIT-MV-22:test-fails` params s, t; f = s x⁴ + t y⁴ (s, t in ±{1,2,3}), critical point (0, 0), all second partials 0 there. Choice (shuffled). Correct: the option beginning "Nothing:" (AC − B² = 0, the test fails). The other options claim a saddle point or that (0, 0) is not critical.
- `MIT-MV-22:classify-flat` params s, t (same f). Choice, fixed order: minimum, maximum, saddle. Correct: minimum iff s > 0 and t > 0; maximum iff s < 0 and t < 0; saddle iff s and t have opposite signs (judge by f itself, not by the test).
- `MIT-MV-22:challenge` params q, k; f = q·(k x y − x² y − x y²) with q in {−2,−1,1,2}, k = 3m with m in ±{1,2,3}; printed expanded as "q k xy − q x²y − q xy²". Critical points (0,0), (k,0), (0,k), (m, m) with m = k/3. Fields [m, A = f_xx(m, m), AC − B² at (m, m)] = [k/3, −2 q m, 3 q² m²].

## MIT-MV-23 Total Differentials and the Chain Rule

Family W(a,b,c,d) = a·xyz + b·x² + c·yz + d·x with a, b, c non-zero in −2..2 and d in −3..3: w_x = a yz + 2b x + d, w_y = a xz + c z, w_z = a xy + c y. At least two of the three coefficients at the chosen point are non-zero.

- `MIT-MV-23:differential-coefficients` params a,b,c,d,x0,y0,z0 (P = (x0, y0, z0) printed). Fields [w_x(P), w_y(P), w_z(P)].
- `MIT-MV-23:differential-value` params a,b,c,d,x0,y0,z0,dx,dy,dz (increments printed as decimals ±0.1, ±0.2, ±0.3). Field: dw = w_x(P) dx + w_y(P) dy + w_z(P) dz (decimal, tolerance 0.005; the exact value has at most 2 decimals and |dw| ≥ 0.05).
- `MIT-MV-23:chain-path` params a,b,c,d,q,r,t0; w = W(a,b,c,d) printed, path x = t, y = q t², z = r t (q in {1,2}, r in ±{1,2}, t0 in ±{1,2}, printed). Field: dw/dt at t = t0 (chain rule; equals the derivative of the composite function w(t, q t², r t)). |answer| ≤ 150.
- `MIT-MV-23:given-data` params p, q, wx, wy: x = t^p, y = t^q (p ≠ q, 1..4, printed as "t^p"), at (x, y) = (1, 1) (reached at t = 1) the printed ∂w/∂x = wx and ∂w/∂y = wy. Field: dw/dt at t = 1 = wx·p + wy·q.
- `MIT-MV-23:bug` params p, q, a, b, c, t0; T(x, y) = 100 − p x² − q y², path x = a t, y = b + c t (a, c in ±{1,2}, b in −2..2, t0 in {1,2}). Field: dT/dt at t = t0 = −2p·x0·a − 2q·y0·c with x0 = a t0, y0 = b + c t0 (non-zero). A figure shows three level ellipses and the path.
- `MIT-MV-23:challenge` params a,b,c,r,q,t0; w = a x y + b y z² + c x, x = t², y = t + r, z = q t (q in {1,2}, t0 in {−1,1,2}). Field: dw/dt at t = t0 (derivative of the composite function). 0 < |answer| ≤ 200.

Cards without audit: `MIT-MV-23-derive` (choice; correct: divide both sides of Δw ≈ w_xΔx + w_yΔy + w_zΔz by Δt and let Δt → 0, so the quotients become dx/dt, dy/dt, dz/dt; the other options set the increments to 1 or multiply by Δt), `MIT-MV-23-chain-formula` (symbols; dw/dt = w_x x′ + w_y y′ + w_z z′, tokens may be reused), `MIT-MV-23-notation` (choice; correct: "dw/dt, an ordinary derivative, because w ends up depending on the single variable t"; the wrong options are the partial ∂w/∂t and ∂w/∂x).

## MIT-MV-24 The Chain Rule with More Variables

Family: w = p x²y + q y² + r x (p, q non-zero, r in −2..2), x = a u² + b v, y = c u + d v² (a, b, c, d non-zero in −2..2), point (u0, v0) in −2..2² with |x|, |y| ≤ 5 and |∂w/∂u|, |∂w/∂v| ≤ 120, not both 0. w_x = 2p x y + r, w_y = p x² + 2q y; x_u = 2a u, x_v = b, y_u = c, y_v = 2d v. The functions and the point are printed.

- `MIT-MV-24:intermediates` params p,q,r,a,b,c,d,u0,v0. Fields [x, y, w_x, w_y] at (u0, v0) (x = x(u0, v0), y = y(u0, v0), w_x and w_y evaluated at that (x, y)).
- `MIT-MV-24:partials-uv` same params. Fields [∂w/∂u, ∂w/∂v] at (u0, v0) (derivatives of the composite function; = w_x x_u + w_y y_u and w_x x_v + w_y y_v).
- `MIT-MV-24:differential-uv` same params plus du, dv (printed decimals ±0.1, ±0.2, ±0.3). Field: dw = (∂w/∂u) du + (∂w/∂v) dv at (u0, v0) (decimal, tolerance 0.005, |dw| ≥ 0.05).
- `MIT-MV-24:three-intermediates` params p, q, r, u0, v0, which: w = x y z, x = p u v, y = u + q v, z = u − r v (p in {1,2}, q, r in {1,2,3}, u0, v0 non-zero in −2..2). `which` is 0 when the card asks for ∂w/∂u and 1 when it asks for ∂w/∂v (the printed label and question name the variable). Field: that partial derivative of the composite function at (u0, v0). 0 < |answer| ≤ 120.
- `MIT-MV-24:polar` params a, b, r0; w = a x³y + b x y³ with x = r cos θ, y = r sin θ, at (r, θ) = (r0, π/4) (a + b ≠ 0, a ≠ b, a, b non-zero; |a|,|b| ≤ 3 for r0 ≤ 2 and ≤ 2 for r0 = 3). Fields [∂w/∂r, ∂w/∂θ] = [(a + b) r0³, r0⁴ (b − a)/2] (both rational; checked against the derivative of w(r cos θ, r sin θ) at θ = π/4).
- `MIT-MV-24:challenge` params a, b, c, u0, v0; w = a x y + b y², x = u + c v, y = u v (c in ±{1,2}). Fields [∂w/∂u, ∂w/∂v] at (u0, v0) (derivatives of the composite function).

Cards without audit: `MIT-MV-24-chain-formula` (symbols; ∂w/∂u = w_x x_u + w_y y_u), `MIT-MV-24-count-terms` (choice; correct: the option "N terms, one for each of …: the partial derivative of w with respect to that variable times the variable's derivative with respect to u", N = number of intermediate variables printed in the question (2 or 3); the wrong options use the derivative with respect to v or 2N terms), `MIT-MV-24-roles` (choice; correct: w dependent, x and y intermediate, u and v independent).

## MIT-MV-25 The Gradient and Level Curves

- `MIT-MV-25:gradient` params a,b,c,d,e,x0,y0; f = a x² + b x y + c y² + d x + e y. Fields [f_x, f_y] at (x0, y0) = [2a x0 + b y0 + d, b x0 + 2c y0 + e].
- `MIT-MV-25:perpendicular-vector` params a,b,c,x0,y0; f = a x² + b x y + c y² (a, c in 1..3, b in −2..2, 4ac > b², x0, y0 non-zero in −2..2). Choice with four vector options; exactly one is parallel to ∇f(P) = (2a x0 + b y0, b x0 + 2c y0), and that one is correct. The others are the swapped vector (f_y, f_x), the tangent vector (−f_y, f_x) and (f_x, −f_y); sampling guarantees f_x, f_y ≠ 0 and |f_x| ≠ |f_y|. A figure shows level curves f = f(P)/4, f(P), 1.5 f(P) (the caption lists the values) and P.
- `MIT-MV-25:slopes` params a,b,c,d,e,x0,y0 (f = quadratic as in `gradient`, P printed). Fields [slope of the level curve at P, slope of the vector ∇f(P)] = [−f_x/f_y, f_y/f_x]; f_x, f_y ≠ 0, |f_x| ≠ |f_y|, |f_x|,|f_y| ≤ 12. Answers are exact fractions (typed as fractions).
- `MIT-MV-25:graph-normal` params a,b,c,x0; g(x) = a x² + b x + c, the parabola y = g(x) is the level curve w = 0 of w = y − g(x); P = (x0, g(x0)) is printed with its y-value; ∇w(P) = (m, 1). Field: m = −g′(x0) = −(2a x0 + b).
- `MIT-MV-25:gradient-3d` params a,b,c,d,x0,y0,z0; f = a x y + b y z + c z² + d x, P = (x0, y0, z0) printed. Fields [f_x, f_y, f_z] = [a y0 + d, a x0 + b z0, b y0 + 2c z0].
- `MIT-MV-25:on-surface` params a, b, c; surface x² + a y² + b z² = c (a, b in 1..3; c printed). Choice with three points (shuffled); exactly one satisfies x² + a y² + b z² = c and is correct.
- `MIT-MV-25:tangent-plane` params a, b, x0, y0, z0; surface x² + a y² + b z = c with c = x0² + a y0² + b z0 printed; P = (x0, y0, z0) lies on it. Fields [n_x, n_y, n_z, D] where n = ∇w(P) = (2x0, 2a y0, b) and the tangent plane is n_x x + n_y y + n_z z = D with D = n · P.
- `MIT-MV-25:zero-gradient` params a, b, c, d; f = a x² + b y² + c x + d y (a, b non-zero in −3..3, c = −2a·xs, d = −2b·ys). Choice with three points (shuffled); exactly one has ∇f = (0, 0), namely (xs, ys) = (−c/(2a), −d/(2b)); the others differ by +1 in one or both coordinates.
- `MIT-MV-25:challenge` params a,b,c,x0,y0; f = a x² + b x y + c y³ (all non-zero), P = (x0, y0) printed, f_x(P), f_y(P) ≠ 0. Fields [f_x(P), f_y(P), k] with k = f_x(P)·x0 + f_y(P)·y0 (the tangent line to the level curve at P is f_x(P) x + f_y(P) y = k).

All cards of this batch carry an audit except the eight listed above as "Cards without audit" (MV-21: which-fit, vertical; MV-23: derive, chain-formula, notation; MV-24: chain-formula, count-terms, roles).
