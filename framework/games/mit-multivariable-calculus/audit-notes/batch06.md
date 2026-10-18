# Audit notes, batch 06 (MIT-MV-26 .. MIT-MV-30)

Conventions: every number named below is printed in the card text (0 and 1 implicit; a bare variable has coefficient 1, an omitted term has coefficient 0). "Field order" is the order of the card's `fields`. Choice cards: the oracle decides which English option is correct by its content (options are shuffled). Where a card says "enter a fraction or a decimal to 2 places" the field has `tolerance: 0.005`; otherwise the tolerance is the default (exact). A "unit vector" is v/|v|; a directional derivative is dw/ds = ∇w · u with u a unit vector.

Family used repeatedly: Q(a,b,c,d,e)(x, y) = a x² + b xy + c y² + d x + e y, so Q_x = 2a x + b y + d and Q_y = b x + 2c y + e (a and c are never 0).

## MIT-MV-26 Directional Derivatives

- `MIT-MV-26:gradient` params a,b,c,d,e (w = Q), x0, y0 (P = (x0, y0)). Fields [w_x(P), w_y(P)].
- `MIT-MV-26:unit-vector` params vx, vy (direction v = (vx, vy), a Pythagorean pair with integer |v| in {5, 10, 13, 15, 17}). Fields [vx/|v|, vy/|v|], tolerance 0.005.
- `MIT-MV-26:directional-derivative` params a,b,c,d,e (w = Q), x0, y0, vx, vy. Field: dw/ds at P in the direction of v = ∇w(P) · v / |v| (tolerance 0.005). Sampling guarantees w_x(P) ≠ 0, w_y(P) ≠ 0 and the value is not 0. The unit-vector card uses the same v.
- `MIT-MV-26:not-unit` (choice) params g1, g2 (the printed gradient ∇w = (g1, g2)), vx, vy (printed v, |v| printed). The correct option is "dw/ds = (g1·vx + g2·vy)/|v|" written as a reduced fraction. The other options are g·v (not normalised), g·v/|v|², and −g·v/|v| (wrong sign). The dot product g·v is never 0.
- `MIT-MV-26:angle` params G (= |∇w|, printed), theta (angle in degrees between ∇w and u, one of 0, 60, 90, 120, 180). Field: G·cos(theta) (exact: G, G/2, 0, −G/2, −G). A figure shows ∇w along +x and u at angle theta.
- `MIT-MV-26:max-rate` params d, e, f, p, q, r. The function printed is T(x, y, z) = x² + 2y² + 2z² + d x + e y + f z (the coefficients 1, 2, 2 are literal in the text; a zero d, e or f is omitted), P = (p, q, r). Field: |∇T(P)| = √((2p + d)² + (4q + e)² + (4r + f)²), an integer (3, 7, 9 or 11).
- `MIT-MV-26:decrease-direction` (choice) params g1, g2 (printed ∇w = (g1, g2), a Pythagorean pair). Correct option: the unit vector u = −(g1, g2)/|g| written with reduced fractions. The other options are +g/|g|, (−g2, g1)/|g| (perpendicular) and −g itself (right direction, length |g| ≠ 1).
- `MIT-MV-26:distance` params r (dT/ds, nonzero integer), dT (ΔT, one decimal, same sign as r). Field: Δs = dT / r (positive, tolerance 0.005).
- `MIT-MV-26:challenge` params a, b, d, e, x0, y0, vx, vy: w = a x² + b y² + d x + e y (the terms printed in that order, zero terms omitted), P = (x0, y0), v = (vx, vy). Fields [∇w(P)·v/|v| (tolerance 0.005), max over unit directions of dw/ds = |∇w(P)| (tolerance 0.005)]. The gradient ∇w(P) has integer length (5, 10, 13, 15 or 17) and is not parallel to v.

## MIT-MV-27 Lagrange Multipliers: Statement and Proof

- `MIT-MV-27:gradients` params a, b, c, x0, y0: f(x, y) = a xy + b y (printed), constraint g(x, y) = x² + c y² = k with k = x0² + c y0² printed and P = (x0, y0) on it. Fields [f_x, f_y, g_x, g_y] at P = [a·y0, a·x0 + b, 2·x0, 2c·y0].
- `MIT-MV-27:lambda` params u1, u2, v1, v2 (printed ∇f(P) = (u1, u2) and ∇g(P) = (v1, v2), parallel and with nonzero entries). Field: λ with ∇f = λ∇g, that is u1/v1 (= u2/v2); it may be a half-integer.
- `MIT-MV-27:parallel` (choice) params u1, u2, v1, v2 (same printed gradients; the vectors may or may not be parallel). Correct option: if u1·v2 − u2·v1 = 0 the option beginning "P is a candidate: ∇f is parallel to ∇g ...", otherwise the option beginning "P cannot be a local maximum or minimum ... not parallel".
- `MIT-MV-27:circle-max` params p, q, R: maximise f(x, y) = p x + q y (printed) on the circle x² + y² = R. Fields [x, y] of the maximiser = √R·(p, q)/√(p² + q²) (an integer point: (p, q) = m(±a, ±b) with a Pythagorean pair and R = (hypotenuse)²).
- `MIT-MV-27:rectangle` params a, b, c: the line a x + b y = c (printed), first quadrant, maximise the area xy of the rectangle with corners O and P = (x, y) on the line. Fields [x, y] = [c/(2a), c/(2b)] (integers since c = 2abk).
- `MIT-MV-27:challenge` params m, k: f(x, y) = x² + k x + m y² on the unit circle x² + y² = 1 (printed as e.g. x² − 2x + 4y²). Fields [maximum of f on the circle, minimum of f on the circle], tolerance 0.005. Closed form (valid for the sampled m, k, where |k| < 2(m − 1)): maximum m + k²/(4(m − 1)), minimum 1 − |k|.

Cards without audit: `MIT-MV-27-why-maximum` (choice; the correct option is the one saying that a maximum occurs at a critical point or an endpoint and the area is 0 at both endpoints, less than the printed area at P; the other two claim that the Lagrange condition itself or the uniqueness of the critical point settles it), `MIT-MV-27-proof-geometric` (choice with figure; the correct option says the level line and the circle are tangent at P so both gradients are perpendicular to the same tangent line; the other two say "crosses at a right angle, so ∇f ⟂ ∇g" and "∇f is the zero vector"), `MIT-MV-27-proof-chain` (symbols; answers `∇f(P)`, `·`, `r′(0)` in that order: h′(0) = ∇f(P) · r′(0)).

## MIT-MV-28 Lagrange Multipliers: An Advanced Example

Notation: the open-top drawer has dimensions x (front/back width), y (depth, the two sides), z (height); α = 2s (two sides, each yz), β = b + f (back plus front, each xz), γ = m (bottom xy); cost C = α yz + β xz + γ xy, volume V = xyz. In params alpha, beta, gamma are these three numbers.

- `MIT-MV-28:cost-coefficients` params s, b, f, m (the per-unit-area prices of each side, the back, the front, the bottom, all printed). Fields [α, β, γ] = [2s, b + f, m].
- `MIT-MV-28:cost-gradient` params alpha, beta, gamma, x0, y0, z0 (printed C = α yz + β xz + γ xy and the point). Fields [C_x, C_y, C_z] = [β z0 + γ y0, α z0 + γ x0, α y0 + β x0].
- `MIT-MV-28:ratios` params alpha, beta, gamma. The printed Lagrange equations are yz = λ(γ y + β z), xz = λ(γ x + α z), xy = λ(α y + β x). Fields [y/x, z/x] at the critical point with x, y, z > 0: [β/α, γ/α], tolerance 0.005.
- `MIT-MV-28:dimensions` params alpha, beta, gamma, B (printed: x : y : z = α : β : γ and C = B). Fields [x, y, z] = t·(α, β, γ) with t = √(B/(3αβγ)) (an integer 1 or 2).
- `MIT-MV-28:lambda` params alpha, beta, gamma, x0, y0, z0 (the critical point (x0, y0, z0) = t(α, β, γ) printed together with the three equations above). Field: λ = y0·z0/(γ·y0 + β·z0) (the same value from the other two equations); it equals t/2.
- `MIT-MV-28:challenge` params a, b, c, d: maximise V = xyz on a x + b y + c z = d with x, y, z > 0. Fields [x, y, z] = [d/(3a), d/(3b), d/(3c)] (integers; a, b, c are not all equal).

Cards without audit: `MIT-MV-28-which-system` (choice; correct option "∇V = λ∇C and C = B"; the others use V = B or ∇V = 0), `MIT-MV-28-why-max` (choice; correct option says V tends to 0 near the boundary of the allowed region, so the positive value at the critical point is the maximum; the other two say that ∇V = λ∇C, or a positive λ, always means a maximum), `MIT-MV-28-which-box` (choice; the correct box is (α t, β t, γ t); the other boxes are 2·(α t, β t, γ t), which has the right shape but costs 4B, and (β t, α t, γ t), the wrong shape).

## MIT-MV-29 Constrained Differentials

Convention: every question names the variable held constant in the symbol (∂w/∂x)_y and says which variables are independent.

- `MIT-MV-29:total-differential` params a, b, c, x0, y0, z0: w = a xy + b yz² + c xz with x, y, z independent. Fields [w_x, w_y, w_z] at (x0, y0, z0) = [a y0 + c z0, a x0 + b z0², 2b y0 z0 + c x0].
- `MIT-MV-29:independent-xy` params a, b, x0, y0: w = x² + y² + z², z = a x² + b y² (printed with its numeric coefficients, for example z = −x² + 2y²; a ∈ {±1}, b ∈ {±1, ±2}, a ≠ b), x and y independent, the point (x0, y0, z0 = a x0² + b y0²) printed. Field (∂w/∂x)_y = 2x0 + 2 z0·(2a x0) = 2 x0 (1 + 2a z0).
- `MIT-MV-29:independent-xz` params a, b, x0, y0 (same function, relation and point). Now x and z are independent and y depends on them (y² = (z − a x²)/b). Field (∂w/∂x)_z = 2 x0 (1 − a/b) (nonzero because a ≠ b).
- `MIT-MV-29:formal-vs-actual` (choice) params a, b, wrt (0: the derivative is (∂w/∂x)_y; 1: it is (∂w/∂y)_x). Same w and relation z = a x² + b y², x and y independent. Correct option (with v = x if wrt = 0, y if wrt = 1, and c = a if wrt = 0, b if wrt = 1): "2v + 4c·v z" (printed e.g. "2x + 4xz", "2y − 8yz"). The other options: "2v", "2v + 2z", and "4c·v z" alone.
- `MIT-MV-29:gradient-with-constraint` params f1, f2, f3 (printed ∇f), g1, g2, g3 (printed ∇g, g3 ∈ {±1, ±2}). x and y independent, z determined by g = 0. Fields [(∂w/∂x)_y, (∂w/∂y)_x] = [f1 − f3·g1/g3, f2 − f3·g2/g3] (half-integers, never 0).
- `MIT-MV-29:cyclic` params A = (∂x/∂y)_z, B = (∂y/∂z)_x (both printed, A, B ∈ ±{1, 2, 3}). Field (∂z/∂x)_y = −1/(A·B) (cyclic rule product = −1), tolerance 0.005.
- `MIT-MV-29:challenge` params x0, y0, z0: P = (x0, y0, z0) on the sphere x² + y² + z² = R (R printed), w = xy + z², x and z independent. Field (∂w/∂x)_z at P = y0 − x0²/y0 (tolerance 0.005; y0 ≠ 0, |y0| ≠ |x0|).

Cards without audit: `MIT-MV-29-notation` (choice; the symbol (∂w/∂x)_h names the independent variables x and h, so the correct option is "x and h are independent; the third variable is determined by them"), `MIT-MV-29-same-or-different` (choice; at the printed point x0 ≠ 0, the two derivatives of the previous two cards differ, and the correct option is the one beginning "No.").

## MIT-MV-30 Unit 2 Review

- `MIT-MV-30:tangent-plane` params a,b,c,d,e (f = Q), x0, y0. The tangent plane to z = f(x, y) at P is written z = m x + n y + k. Fields [m, n, k] = [f_x(P), f_y(P), f(P) − m·x0 − n·y0].
- `MIT-MV-30:classify` (choice) params a,b,c,d,e (f = Q), xs, ys (P = (xs, ys) is printed and is the critical point of f). Options in fixed order [local minimum, local maximum, saddle point]. Correct: saddle if 4ac − b² < 0, local minimum if 4ac − b² > 0 and a > 0, local maximum if 4ac − b² > 0 and a < 0 (4ac − b² is never 0).
- `MIT-MV-30:chain-rule` params a, b, x0, y0: w = f(u, v) = a u² + b uv with u = x + y and v = xy (printed). Fields [∂w/∂x, ∂w/∂y] at (x0, y0) = [f_u + f_v·y0, f_u + f_v·x0] with u = x0 + y0, v = x0·y0, f_u = 2a u + b v, f_v = b u.
- `MIT-MV-30:directional` params a,b,c,d,e (f = Q), x0, y0, vx, vy. Field: ∇f(P) · v / |v| (tolerance 0.005).
- `MIT-MV-30:lagrange-value` params a, b, c: the line a x + b y = c (printed, c = 2abk), x ≥ 0, y ≥ 0. Field: maximum of xy = c²/(4ab) (an integer).
- `MIT-MV-30:constrained` params p, q, x0, y0: z = p x + q y, w = xy + z², x and y independent, the point (x0, y0, z0 = p x0 + q y0) printed. Field (∂w/∂x)_y = y0 + 2p·z0.
- `MIT-MV-30:laplace` (choice) param a: the options are w = a x² − a y², w = a x² + a y², w = a x² − 2a y² (printed with the coefficients). Correct: the one with w_xx + w_yy = 0, that is w = a x² − a y².
- `MIT-MV-30:challenge` params c, x0, y0, dx, dy: f(x, y) = x²y² − c x (printed, c ≠ 0), P = (x0, y0), Δx = dx, Δy = dy (both ±0.1 or ±0.2). Fields [f_x(P), f_y(P), f(P) + f_x(P)·dx + f_y(P)·dy (tolerance 0.005)] with f_x = 2x y² − c, f_y = 2x² y.

Cards without audit: `MIT-MV-30-method-1` and `MIT-MV-30-method-2` (choice; each states one of six kinds of question, namely linear estimate near a point, extreme value on a line, horizontal tangent plane, rate in a direction, chain-rule expression, derivative with a relation between variables, and the correct option is the method that belongs to that kind: tangent plane approximation, Lagrange multipliers, f_x = f_y = 0, directional derivative ∇f · u, chain rule, differentials with dz from the relation; the chain rule and differentials options never appear together), `MIT-MV-30-lagrange-setup` (choice; for f = xy on a x + b y = c the correct option is "y = aλ, x = bλ, a x + b y = c"; the others are "x = aλ, y = bλ, ..." and "y = 0, x = 0, ..."), `MIT-MV-30-critical-claim` (choice; the correct option is the one beginning "False." with the example p x² − q y²).
