# Audit notes: batch02 (MIT-MV-07 to MIT-MV-11)

Conventions for every kind below.
- Matrices are flattened **row by row** (row-major). `a: [a11, a12, a21, a22]` is the 2x2 matrix [a11 a12; a21 a22]; a 3x3 has 9 numbers, row by row. Vectors are plain arrays `[x, y, z]`.
- "fields" = the order of the card's numeric `fields`. "options" = the English option texts of a choice card; the oracle decides each option's truth from the params, and exactly one option must be true.
- Plane `n1 x + n2 y + n3 z = d` is given by `n = [n1, n2, n3]` and `d`. A line is `P0 + t v`.
- Answers are exact rationals (single division of integers); default tolerance 1e-8.

## MIT-MV-07 Matrix multiplication
- `MIT-MV-07:defined` params `{am, an, bm, bn}`: A is am x an (rows x columns), B is bm x bn. Fact: AB is defined iff an = bm; BA is defined iff bn = am. Choice options, by text prefix: "Only AB is defined." (AB defined and BA not), "Only BA is defined.", "Both AB and BA are defined.", "Neither AB nor BA is defined." Exactly one is true.
- `MIT-MV-07:matvec` params `{a: [9], x: [3]}`: A 3x3 row-major (the coefficient matrix of three left-hand sides), x = (x, y, z). Fields: the three entries of A x (row i of A dotted with x).
- `MIT-MV-07:entry` params `{a: [6], b: [6], i, j}`: A is 2x3 row-major, B is 3x2 row-major, i and j in {1, 2} (row i, column j, 1-based). Field: the (i, j) entry of AB = (row i of A) . (column j of B).
- `MIT-MV-07:product2` params `{a: [4], b: [4]}`: 2x2 matrices. Fields in order: (AB)11, (AB)12, (AB)21, (AB)22.
- `MIT-MV-07:noncommute` params `{a: [4], b: [4]}`: 2x2 A and B. Choice options: "AB = BA" is true iff AB equals BA entrywise; "AB ≠ BA" true iff they differ; "BA is not defined." is always false (both 2x2). Some seeds use a commuting pair (B = pI + qA), so "AB = BA" can be the correct option.
- `MIT-MV-07:column` params `{j}` (1, 2 or 3): for any 3x3 A with columns c1, c2, c3, A u = u1 c1 + u2 c2 + u3 c3, so A u = c_j for every A iff u = e_j (1 in position j, 0 elsewhere). Options are the vectors in the option text "u = (u1, u2, u3)": the true option is exactly u = e_j; the option (1, 1, 1) and the other unit vectors are false.
- `MIT-MV-07:meaning` params `{a: [4]}`: A = [a11 a12; a21 a22], det A != 0. The unit square maps to the parallelogram with vertices 0, A i = (a11, a21), A i + A j, A j = (a12, a22). Field: its area = |det A| = |a11 a22 − a12 a21|.
- `MIT-MV-07:det-product` params `{a: [4], b: [4]}`: 2x2 matrices. Field: det(AB) (= det A det B; the oracle may multiply explicitly).
- `MIT-MV-07:challenge` params `{a: [6], b: [6], x: [2]}`: A is 2x3, B is 3x2, x a column of 2 entries. Fields: the two components of A (B x) = (AB) x.

## MIT-MV-08 Matrix inverses
- `MIT-MV-08:inverse2` params `{a: [4]}`: A 2x2 with |det A| in {1, 2, 3}. Fields: A⁻¹ entries 11, 12, 21, 22 (row-major). A⁻¹ = (1/det A) [d −b; −c a].
- `MIT-MV-08:exists` params `{a: [4]}`: A 2x2. Options: "A⁻¹ exists, because |A| ≠ 0." true iff det A != 0; "A⁻¹ does not exist, because |A| = 0." true iff det A = 0; "A⁻¹ exists even though |A| = 0." always false.
- `MIT-MV-08:solve-inverse` params `{a: [4], b: [2]}`: A 2x2 with det A = ±1, b a column. The card also shows M = A⁻¹ (derived, not a param). Fields: x1, x2 with A x = b.
- `MIT-MV-08:det3` params `{a: [9]}`: A 3x3 row-major, |det A| in {1, 2}. Field: det A.
- `MIT-MV-08:inverse-entry` params `{a: [9], i, j}`: A 3x3 row-major with det A in {±1, ±2} (the card prints |A|); i, j in {1, 2, 3} (row i, column j of A⁻¹, 1-based). Field: (A⁻¹)_ij = C_ji / det A, where C_ji is the cofactor of the entry in row j, column i of A (minor with checkerboard sign).
- `MIT-MV-08:det-inverse` params `{k}`: A invertible with det A = k. Field: det(A⁻¹) = 1/k (from det(A⁻¹) det A = det I = 1).
- `MIT-MV-08:challenge` params `{a: [4], b: [2]}`: system a11 x + a12 y = b1, a21 x + a22 y = b2 with |det A| in {2, 3, 4, 5}. Fields: x, y = A⁻¹ b (exact fractions).

## MIT-MV-09 Planes and linear systems
- `MIT-MV-09:intercept` params `{a, b, c, x, y}`: the plane meets the axes at (a,0,0), (0,b,0), (0,0,c) (all nonzero); a point on it has the given x and y. Field: its z. Fact: the plane is x/a + y/b + z/c = 1 (it is the plane through the three intercept points).
- `MIT-MV-09:line-normal` params `{p1: [2], p2: [2]}`: line through P1 and P2 in the xy-plane, v = P2 − P1. Fields: N1, N2, c where N = (−v2, v1) (this orientation is stated on the card) and c = N . P1, so the line is N1 x + N2 y = c.
- `MIT-MV-09:plane-distance` params `{n: [3], d, p: [3]}`: plane n . X = d (|n| is an integer), point P. Field: |n . P − d| / |n|.
- `MIT-MV-09:parallel-planes` params `{n: [3], d, n2: [3], e}`: plane 1 is n . X = d; plane 2 is n2 . X = e with n2 = k n for an integer k != 0 (k can be negative or 1) and the planes are different. Field: distance between the parallel planes = (distance from a point of plane 1 to plane 2) = |d − e/k| / |n|.
- `MIT-MV-09:count-2x2` params `{a, b, c, d, e, f}`: system a x + b y = e, c x + d y = f (rows (a, b) and (c, d), (a, b) != (0, 0)). Options, by text prefix: "Exactly one solution" iff det [a b; c d] != 0; "No solution" iff det = 0 and the system is inconsistent (rank[a b; c d] < rank[a b e; c d f]); "Infinitely many solutions" iff det = 0 and consistent (both rows are proportional, including the right sides). Exactly one is true.
- `MIT-MV-09:three-planes` params `{a: [9], d: [3]}`: three planes row_i . X = d_i (a is row-major, the card lists the equations in the same order as the rows). Let r = rank of A, r' = rank of the augmented matrix [A | d]. If r < r' the planes have no common point; otherwise the intersection is a point (r = 3), a line (r = 2) or a plane (r = 1). Options by text prefix: "In exactly one point", "In a line", "In a whole plane (all three equations describe the same plane)", "There is no point on all three planes". Exactly one is true.
- `MIT-MV-09:challenge` params `{p1: [2], p2: [2], p: [2]}`: line through P1 and P2 in the plane (|P2 − P1| is an integer), point P not on it. Field: distance from P to the line = |N . (P − P1)| / |N| with N perpendicular to P2 − P1 (equivalently the length of the component of P − P1 perpendicular to P2 − P1).

## MIT-MV-10 Solutions to square systems
- `MIT-MV-10:unique` params `{a: [9], b: [3]}`: system A x = b, 3x3 with 1 <= |det A| <= 4. Fields: x, y, z (integers).
- `MIT-MV-10:critical-c` params `{r1: [3], r2: [3], u: [2], b: [3]}`: the matrix has rows r1, r2 and (u1, u2, c) with c an unknown in the (3,3) position; b is the right side shown on the card and does not affect the answer. Field: the unique c with det = 0 (det is linear in c with a nonzero slope).
- `MIT-MV-10:homogeneous` params `{a: [9]}`: homogeneous system A x = 0. Options: "Only the trivial solution x = y = z = 0." true iff det A != 0; "There are non-zero solutions." true iff det A = 0; "There is exactly one non-zero solution." always false (nonzero solutions come in whole lines of multiples).
- `MIT-MV-10:null-vector` params `{a: [9]}`: homogeneous A x = 0 where rank A = 2 (det A = 0, solution set a line through the origin). Fields: y, z of the unique solution with x = 1 (the solution set is the multiples of one vector with first component nonzero).
- `MIT-MV-10:count-solutions` params `{a: [9], b: [3]}`: system A x = b (rows in card order). Options by text prefix: "Exactly one solution" iff det A != 0; "No solution" iff rank A < rank [A | b]; "Infinitely many solutions" iff det A = 0 and rank A = rank [A | b]. Exactly one is true.
- `MIT-MV-10:consistent-value` params `{a: [9], b: [2]}`: `a` holds three rows (r1, r2, r3) back to back; rank A = 2 and r3 is a combination of r1 and r2. The system is r1 . x = b1, r2 . x = b2, r3 . x = β with b = [b1, b2]. Field: the unique β for which the system has a solution (r3 = p r1 + q r2 forces β = p b1 + q b2).
- `MIT-MV-10:challenge` params `{r1: [3], r2: [3], u: [2]}`: homogeneous system with rows r1, r2 and (u1, u2, c). There is exactly one c with non-zero solutions (det = 0); for it the solution set is the multiples of one vector. Fields in order: c, y, z where (1, y, z) is the solution with x = 1.

## MIT-MV-11 Lines, and a line meeting a plane
- `MIT-MV-11:on-line` params `{p0: [3], v: [3], x}`: line P0 + t v with v1 != 0; the point on the line whose x-coordinate equals `x`. Field: its y-coordinate (t = (x − p0_1)/v1, then y = p0_2 + t v2).
- `MIT-MV-11:two-points` params `{p0: [3], p1: [3], t}`: P(s) = P0 + s (P1 − P0). Fields: x, y, z of P(t).
- `MIT-MV-11:same-line` params `{p0: [3], v: [3]}`: line L = {P0 + t v}. Each option text has the form "through Q = (q1, q2, q3) with direction w = (w1, w2, w3)" (read the six numbers in order). An option is true iff Q lies on L (Q − P0 parallel to v, cross product zero) and w is a nonzero vector parallel to v (cross product zero). Exactly one is true.
- `MIT-MV-11:meets-plane` params `{p0: [3], v: [3], n: [3], d}`: line P0 + t v, plane n . X = d, with n . v != 0. Fields in order: t, x, y, z (the parameter value at the intersection, then the intersection point). t = (d − n . P0)/(n . v).
- `MIT-MV-11:relationship` params `{p0: [3], v: [3], n: [3], d}`: line P0 + t v and plane n . X = d. Options: "It meets the plane in exactly one point." iff n . v != 0; "It is parallel to the plane and has no point in common with it." iff n . v = 0 and n . P0 != d; "It lies in the plane." iff n . v = 0 and n . P0 = d. Exactly one is true.
- `MIT-MV-11:two-planes` params `{n1: [3], n2: [3], d: [2]}`: planes n1 . X = d1 and n2 . X = d2 (d = [d1, d2] does not affect the answer; n1 and n2 are not parallel). Fields: the three components of N1 x N2 (cross product in this order). Fact: the line of intersection is perpendicular to both normals.
- `MIT-MV-11:challenge` params `{a: [3], b: [3], p: [3], q: [3]}`: line through A and B (A + t (B − A)), plane through the origin O, P and Q (normal P x Q, equation (P x Q) . X = 0; P x Q != 0, and the line is not parallel to the plane). Fields: x, y, z of the intersection point (rational numbers).
