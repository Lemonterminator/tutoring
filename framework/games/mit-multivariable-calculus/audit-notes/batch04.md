# Audit notes, batch 04 (MIT-MV-18, MIT-MV-19, MIT-MV-20)

Conventions: every polynomial is printed in the card text with the literal coefficients named below; an omitted term has coefficient 0 and a bare variable has coefficient 1. "Field order" is the order of the card's `fields`. Choice cards: the oracle decides which English option is correct. Partial derivatives are ordinary derivatives in one variable with the other held constant; `∂²f/∂x∂y = ∂/∂x(∂f/∂y)` (y first, then x). All polynomials here have continuous second partials, so mixed partials do not depend on the order.

Families used (card text always prints the expanded polynomial):
- Q(a,b,c,d,e) = a x² + b xy + c y² + d x + e y.
- D(a,b,c,d,e) = a x² + b y² + c x + d y + e (no xy term; ab ≠ 0).

## MIT-MV-18 Partial Derivatives

- `MIT-MV-18:partial-x` params a,b,c,d,e (f = Q), x0, y0. Field: f_x(x0,y0) = 2a·x0 + b·y0 + d (derivative in x, y held at y0).
- `MIT-MV-18:partial-y` params a,b,c,d,e (f = Q), x0, y0 (the point (x0,y0) printed in the question). Field: f_y(x0,y0) = b·x0 + 2c·y0 + e (x held at x0).
- `MIT-MV-18:which-partial` (choice) params a, b; f = a·x·y² + b·x². Options are three polynomials in x, y. Correct option: the one that equals f_y = 2a·xy identically (one option is f_x = a y² + 2b x, one is 2a xy + 2b x which is wrong because x² is constant when y varies).
- `MIT-MV-18:cubic-partials` params a,b,c,d,x0,y0; f = a x³ + b x²y + c xy² + d y³. Fields [f_x, f_y] at (x0,y0): f_x = 3a x² + 2b xy + c y², f_y = b x² + 2c xy + 3d y².
- `MIT-MV-18:mixed-partial` params a,b,c,d,x0,y0; f = a x³y + b xy² + c x² + d y. Field: ∂²f/∂x∂y at (x0,y0) = ∂/∂x(f_y) = 3a x0² + 2b y0 (equals ∂/∂y(f_x)).
- `MIT-MV-18:direction-of-change` (choice) params a,b,c,d,e (f = Q), x0, y0 (the point P). Move from P a small step in +y with x fixed. Options: "f increases." / "f decreases." / "f does not change to first order." Correct: increases iff f_y(P) = b·x0 + 2c·y0 + e > 0, decreases iff < 0 (never 0 by sampling).
- `MIT-MV-18:challenge` params a,b,c,x0,y0; f = a x²y + b xy³ + c x. Fields [∂f/∂y, ∂²f/∂x∂y] at (x0,y0): f_y = a x² + 3b xy², ∂/∂x(f_y) = 2a x + 3b y².

Cards without audit: `MIT-MV-18-which-fixed` (∂w/∂x is the slope of the curve w = f(x, y0) in the plane y = y0, y held fixed; the correct option is the one that names the plane y = y0 / y held fixed; options are shuffled).

## MIT-MV-19 Tangent Plane Approximation

Facts: tangent plane at P=(x0,y0): z = f(P) + f_x(P)(x−x0) + f_y(P)(y−y0); linear estimate f(x0+Δx, y0+Δy) ≈ f(P) + f_x(P)Δx + f_y(P)Δy (the plane's height, not the exact f unless f is linear); Δw ≈ f_x Δx + f_y Δy.

- `MIT-MV-19:tangent-data` params a,b,c,d,e (f = Q), x0, y0. Fields [f(P), f_x(P), f_y(P)] with P = (x0,y0).
- `MIT-MV-19:plane-constant` params f0 = f(P), m = f_x(P), n = f_y(P), x0, y0 (P = (x0,y0)). The plane z = f0 + m(x−x0) + n(y−y0) is written z = m·x + n·y + k. Field: k = f0 − m·x0 − n·y0.
- `MIT-MV-19:estimate` params a,b,c,d,e (f = Q), x0, y0, dx, dy (Δx, Δy; the evaluation point is (x0+dx, y0+dy) printed in the question). Field: linear estimate f(P) + f_x(P)·dx + f_y(P)·dy (2 decimals, tolerance 0.005). Sampling guarantees the exact f(x0+dx,y0+dy) differs from this by at least 0.009.
- `MIT-MV-19:error` same params as estimate. Field: exact f(x0+dx, y0+dy) minus the linear estimate (2 decimals, tolerance 0.005) = a dx² + b dx dy + c dy².
- `MIT-MV-19:sensitivity` (choice) params a, b, c: the three measured sides (distinct); V = abc. Options "Side a", "Side b", "Side c". Correct: the side whose partial derivative of V has the largest absolute value: V_a = bc, V_b = ac, V_c = ab (largest = the shortest side).
- `MIT-MV-19:challenge` params a, b, x0, y0, dx, dy; f = a x²y + b xy² (x0,y0 ≠ 0). Field: linear estimate f(P) + f_x(P)dx + f_y(P)dy with P = (x0,y0), f_x = 2a xy + b y², f_y = a x² + 2b xy (2 decimals, tolerance 0.005; the exact value differs from the estimate by at least 0.02).

Cards without audit: `MIT-MV-19-formula` (symbols: Δw ≈ f_x Δx + f_y Δy), `MIT-MV-19-when-exact` (choice; the option that is a linear function of x and y (no squares, no xy product), is the only one for which the tangent plane equals f everywhere; the others contain x² or xy), `MIT-MV-19-cone` (choice; w = √(x²+y²) has no tangent plane only at the origin, where f_x and f_y do not exist).

## MIT-MV-20 Optimization

Facts: a critical point has f_x = f_y = 0 (horizontal tangent plane). This only finds candidates; it does not classify them. For D(a,b,c,d,e) with ab ≠ 0, c = −2a·xs, d = −2b·ys: f_x = 2a x + c, f_y = 2b y + d, the unique critical point is (xs, ys) = (−c/(2a), −d/(2b)), and f(x,y) = f(P) + a(x−xs)² + b(y−ys)².

- `MIT-MV-20:fx-zero` params a,b,c,d,e (f = D). Field: x solving f_x = 2a x + c = 0, i.e. −c/(2a).
- `MIT-MV-20:critical-point` params a,b,c,d,e (f = D). Fields [x, y] of the critical point: (−c/(2a), −d/(2b)).
- `MIT-MV-20:value-at-critical` params a,b,c,d,e (f = D). Field: f(xs, ys) at the critical point (= e − a xs² − b ys²).
- `MIT-MV-20:horizontal-plane` (choice) params a,b,c,d,e (f = D). The three options are points (x0, y0) printed as "(x, y)". Correct option: the point where both f_x and f_y vanish, i.e. the critical point (the others have exactly one partial equal to 0).
- `MIT-MV-20:classify` (choice) params a,b,c,d,e (f = D), critical point P printed in the question. Options (English): "P is a minimum…", "P is a maximum…", "P is neither a maximum nor a minimum…" in this fixed order. Correct: minimum iff f ≥ f(P) everywhere, i.e. a>0 and b>0; maximum iff a<0 and b<0; neither iff a and b have opposite signs (then f(x, ys) − f(P) = a(x−xs)² and f(xs, y) − f(P) = b(y−ys)² have opposite signs). Justification is by completing the square, not by f_x = f_y = 0.
- `MIT-MV-20:reciprocal-critical` params A, B, r; w(x,y) = A/x + B/y + r·x·y on x>0, y>0. Fields [x, y] of the critical point: solve w_x = −A/x² + r y = 0 and w_y = −B/y² + r x = 0 with x,y>0 (unique; y³ = B²/(rA), x = (A/B)·y).
- `MIT-MV-20:challenge` params a,b,c,d,e; f = Q(a,b,c,d,e) = a x² + b xy + c y² + d x + e y with 4ac − b² ≠ 0. Fields [x, y]: the unique solution of 2a x + b y + d = 0 and b x + 2c y + e = 0.

Cards without audit: `MIT-MV-20-neither` (choice; f = p x² − q y² + e0 with p,q>0 has f_x = f_y = 0 at (0,0) but f(1,0) > f(0,0) > f(0,1), so (0,0) is a critical point that is neither a maximum nor a minimum; options are shuffled and the correct one is the one saying "critical point but neither a maximum nor a minimum").
