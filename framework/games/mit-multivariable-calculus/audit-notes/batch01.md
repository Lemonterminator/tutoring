# Audit notes, batch 01 (MIT-MV-01, MIT-MV-03, MIT-MV-04, MIT-MV-05)

Conventions: vectors are arrays, components in order (x, y[, z]); "rows" of a matrix are listed top to bottom; a 3 x 3 matrix passed as a flat array `m` is row-major (m[0..2] = first row). Field order is the order of the card's `fields`. Choice cards: the oracle decides which English option text is correct; option texts are given in the notes.

## MIT-MV-01 Vectors

- `MIT-MV-01:displacement` params `p` = [px,py,pz], `q` = [qx,qy,qz]. Fields: the three components of PQ = Q − P, in x, y, z order.
- `MIT-MV-01:head-to-tail` params `a` = [ax,ay], `b` = [bx,by] (2D). Fields [x, y] = coordinates of the tip of A + B (A from the origin, B from the tip of A), i.e. componentwise sum.
- `MIT-MV-01:combine` params `s`, `r` (nonzero integers; coefficients of A and B in "sA + rB", s = ±1 may be printed without a number), `a` = [ax,ay], `b` = [bx,by]. Fields [x, y] = components of s·A + r·B.
- `MIT-MV-01:length-of-sum` params `a`, `b` (2D vectors). Field: |A + B| = sqrt((ax+bx)² + (ay+by)²) (always an integer by construction).
- `MIT-MV-01:unit-vector` params `v` = [vx,vy] (2D). Fields [u1, u2] = v/|v|, the unit vector in the direction of v (exact rational numbers).
- `MIT-MV-01:parallelogram-vertex` params `a`, `b`, `c` = 2D points A, B, C of parallelogram ABCD with vertices in this order (AB and DC are equal as vectors; diagonals AC and BD share a midpoint). Fields [Dx, Dy] with D = A + C − B.
- `MIT-MV-01:length-inequality` (choice) params `a`, `b` (2D vectors, not parallel in the same direction), `la` = |A|, `lb` = |B| (integers, equal to the true lengths). Options all start with "|A + B| R |A| + |B| = (la+lb)" where R is `<`, `=` or `>`. Correct option: the one whose R is the true relation between |A + B| and la + lb. (Fact: |A+B| ≤ |A|+|B|, with equality only for vectors pointing the same way; the sampling excludes that case, so R is "<".)
- `MIT-MV-01:river` (choice) params `river` = current speed, `rower` = rowing speed in still water (positive, unequal). Net velocity = current velocity + rowing velocity. The net velocity can point straight across iff `river < rower` (then heading upstream at angle θ with sin θ = river/rower works; otherwise no heading works). Options: "Yes: head straight across the river." (never correct), "Yes: head upstream at an angle θ with sin θ = …" (correct iff river < rower), "No: no heading works." (correct iff river > rower).
- `MIT-MV-01:challenge` params `s` (integer 2 or 3), `a` = [ax,ay,az], `b` = [bx,by,bz]. Field: |s·A − B| (integer by construction).

## MIT-MV-03 Vector Components and Projection

Definition (course notes): the component of A in the direction of B is the scalar A · B/|B| (= |A| cos θ). It may be negative. The orthogonal projection of A on B is the vector (A · B/|B|²) B.

- `MIT-MV-03:component-unit` params `a` = [ax,ay], `u` = [un1,un2] integer numerators, `d` = common denominator; the unit vector is u = (un1/d, un2/d) (|u| = 1). Field: A · u.
- `MIT-MV-03:component-direction` params `a` = [ax,ay,az], `b` = [bx,by,bz], `lb` = |B| (integer, the true length). Field: A · B/|B|.
- `MIT-MV-03:both-ways` params `a`, `b` (2D vectors), `la` = |A|, `lb` = |B| (true lengths). Fields [component of A in the direction of B, component of B in the direction of A] = [A·B/|B|, A·B/|A|].
- `MIT-MV-03:angle-form` params `l` = |A|, `m` = |B| (irrelevant to the answer), `k`, `d` such that the angle between A and B is θ = k·π/d. Field: the component of A in the direction of B = l · cos θ (exact: rational or rational times sqrt(2) or sqrt(3)).
- `MIT-MV-03:projection` params `a`, `b` (2D vectors, not parallel, A·B ≠ 0). Fields [x, y] = components of the orthogonal projection of A on B, (A·B/|B|²) B.
- `MIT-MV-03:zero-component` params `y` (second component of A = (a, y)), `b` = [p,q] (B = (p, q)). Unknown a. Field: the value of a for which the component of A in the direction of B is 0, i.e. a·p + y·q = 0.
- `MIT-MV-03:negative-component` (choice) params `y`, `b` = [p,q] as above, A = (a, y). Options are "a < c0", "a > c0", "a = c0" with c0 the zero of A · B (= −y q / p, an integer). Correct option: the one that describes all a for which the component of A in the direction of B is negative (strictly), i.e. A · B = p·a + q·y < 0.
- `MIT-MV-03:challenge` params `t` (second component of A = (x, t)), `b` = [p,q], `lb` = |B| (true length), `c` = given value of the component. Unknown x. Field: x with (p·x + q·t)/lb = c.

## MIT-MV-04 Determinants: Area and Volume

Facts: det of rows (a,b),(c,d) is ad − bc; |det(A,B)| = area of the parallelogram with edges A, B; |det| of the 3 x 3 matrix with rows A, B, C = volume of the parallelepiped with these edges; det = 0 iff the three vectors are coplanar; cofactor A_ij = (−1)^(i+j) times the 2 x 2 minor obtained by deleting row i and column j.

- `MIT-MV-04:det2` params `m` = [a,b,c,d]: rows (a, b) and (c, d). Field: ad − bc (signed).
- `MIT-MV-04:parallelogram-area` params `a`, `b` (2D edge vectors from the origin). Field: area of the parallelogram = |det(A, B)|.
- `MIT-MV-04:triangle-area` params `p`, `q`, `r` (2D vertices). Field: area of triangle PQR = ½|det(Q−P, R−P)|.
- `MIT-MV-04:det3` params `m` = 9 numbers, row-major (three rows listed in the question). Field: det of the 3 x 3 matrix (signed).
- `MIT-MV-04:cofactor` params `m` = 9 numbers row-major, `i` = row index, `j` = column index (both 1-based). Field: the cofactor of entry (i, j), signed, with the checkerboard sign (−1)^(i+j).
- `MIT-MV-04:volume` params `a`, `b`, `c` (3D edge vectors from the origin). Field: volume = |det with rows A, B, C|.
- `MIT-MV-04:coplanar` (choice) params `a`, `b`, `c` (3D origin vectors). Options start with "Yes: the determinant is 0 …", "No: the determinant is not 0 …", "It cannot be decided …". Correct: "Yes" iff det(A,B,C) = 0 (the vectors lie in one plane through the origin), otherwise "No". The third option is never correct.
- `MIT-MV-04:row-operations` params `d` = det M (given), `c` = factor multiplying row 3, `k` = multiple of row 1 added to row 2. Operations on the 3 x 3 matrix M in this order: swap rows 1 and 2; multiply row 3 by c; add k times row 1 to row 2. Field: det N (signed) = −c·d.
- `MIT-MV-04:challenge` params `a`, `b`, `c` (2D points A, B, C); the convex quadrilateral has vertices O = (0,0), A, B, C in this order. Field: its area (any exact method, e.g. shoelace formula).

## MIT-MV-05 Cross Products

Definition (course notes): A × B = (a2 b3 − a3 b2, a3 b1 − a1 b3, a1 b2 − a2 b1); |A × B| = |A||B| sin θ = area of the parallelogram spanned by A, B; direction by the right-hand rule; Lagrange identity |A × B|² = |A|²|B|² − (A·B)²; i × j = k, j × k = i, k × i = j; A × B = −B × A; (A × B) × C ≠ A × (B × C) in general.

- `MIT-MV-05:cross` params `a`, `b` (3D vectors). Fields [x, y, z] = components of A × B.
- `MIT-MV-05:planar` params `a` = [s,t], `b` = [u,v]: the question is "(s i + t j) × (u i + v j) = c k". Field: c = s·v − t·u.
- `MIT-MV-05:parallelogram-area` params `a`, `b` (3D edge vectors from the origin; |A × B| is an integer by construction). Field: area of the parallelogram = |A × B|.
- `MIT-MV-05:lagrange` params `la` = |A|, `lb` = |B|, `d` = A · B (signed). Field: |A × B| = sqrt(la²·lb² − d²) (a positive integer by construction; equals la·lb·sin θ with cos θ = d/(la·lb)).
- `MIT-MV-05:direction` (choice) params `a` = [ax,ay], `b` = [bx,by]; the 3D vectors are A = (ax, ay, 0), B = (bx, by, 0) in the xy-plane, viewed from the +z side (x to the right, y up). Options (English): "A × B points in the +z direction (toward you).", "A × B points in the −z direction (away from you).", "A × B = 0.". Correct by the right-hand rule: +z iff ax·by − ay·bx > 0 (B is counterclockwise from A), −z iff < 0, zero vector iff = 0 (never sampled).
- `MIT-MV-05:triangle-area` params `p`, `q` (3D vectors); the triangle has vertices O = (0,0,0), P = p, Q = q. Field: ½|P × Q| (a half-integer by construction).
- `MIT-MV-05:challenge` params `p`, `q`, `r` (3D vertices of triangle PQR). Field: area = ½|PQ × PR| with PQ = Q − P, PR = R − P (possibly irrational: ½·sqrt(integer); the question asks for the exact value, the field stores the double).

Cards without audit (no sampled numeric truth to recompute): `MIT-MV-05-non-associative` (compares (u×v)×v with u×(v×v) for distinct unit vectors u, v among i, j, k; correct option says they differ: (u×v)×v = −u, u×(v×v) = 0) and `MIT-MV-05-zero-cross` (A × B = 0 means parallel or a zero vector).
