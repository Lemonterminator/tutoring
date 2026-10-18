import type { FieldSpec, GeneratorMap, Text } from './support';
import { makeDeck } from './support';

type Deck = ReturnType<typeof makeDeck>;
const titles: Record<string, Text> = {
  'skew-spectrum': ['Skew-symmetric spectrum', '反对称矩阵的谱'], 'symmetric': ['Symmetric matrices', '对称矩阵'],
  'pd-test': ['Positive definiteness', '正定性'], 'projection': ['Projection matrix', '投影矩阵'], 'svd': ['Singular values', '奇异值'],
  'ata': ['The Gram matrix AᵀA', 'Gram 矩阵 AᵀA'], 'rayleigh': ['Rayleigh quotient', 'Rayleigh 商'], 'flow': ['Matrix exponential', '矩阵指数'],
  'exam-challenge': ['Independent challenge', '独立挑战'], 'orthogonal': ['Orthogonal matrices', '正交矩阵'], 'diagonalize': ['Diagonalization', '对角化'],
  'triangular-eigen': ['Triangular eigenvalues', '三角矩阵特征值'], 'inverse-eigen': ['Inverse eigenvalues', '逆矩阵的特征值'],
  'svd-rank': ['SVD and rank', 'SVD 与秩'], 'semidefinite': ['Semidefinite check', '半正定判断'], 'power': ['Matrix powers', '矩阵幂'],
  'rank-dimensions': ['Rank and dimensions', '秩与维数'], 'column-method': ['The column method', '列组合方法'], 'uniqueness': ['Solution uniqueness', '解的唯一性'],
  'markov-spectrum': ['Markov eigenvalues', 'Markov 矩阵特征值'], 'steady-state': ['Steady state', '稳态'], 'least-squares': ['Least squares', '最小二乘'],
  'projection-space': ['Projection and residual', '投影与残差'], 'changed-example': ['Independent challenge', '独立挑战'],
  'special-solutions': ['Special solutions', '特解'], 'four-spaces': ['Four subspaces', '四个子空间'], 'triangular-det': ['Triangular determinant', '三角矩阵行列式'],
  'gram-pd': ['Gram matrix', 'Gram 矩阵'], 'qr-step': ['Orthogonal component', '正交分量'], 'rank-augment': ['Augmented rank', '增广矩阵的秩'],
  'rank-square': ['Rank of [A A²]', '[A A²] 的秩'], 'double-nullity': ['Nullity of [A A]', '[A A] 的零度'], 'permutation-det': ['Permutation spectrum', '置换矩阵的谱'],
  'projection-formula': ['Projection formula', '投影公式'], 'rayleigh-max': ['Maximum Rayleigh quotient', 'Rayleigh 商最大值'],
  'rref-pivots': ['Pivot and free variables', '主元与自由变量'], 'augment-basis': ['Augmenting columns', '增加列'], 'rank-a2': ['Rank of [A A²]', '[A A²] 的秩'],
  'normal-equations': ['Normal equations', '正规方程'], 'least-squares-fit': ['Least-squares fit', '最小二乘拟合'],
  'det-triangular': ['Triangular determinant', '三角矩阵行列式'], 'gram-positive': ['Positive definite Gram matrix', '正定 Gram 矩阵'],
  'orthogonal-counterexample': ['Assumption check', '条件反例'],
  'determinant': ['Determinant', '行列式'], 'rank-2023': ['Matrix rank', '矩阵的秩'],
  'eliminate': ['Elimination step', '消元步骤'], 'back-substitute': ['Back substitution', '回代'], 'solution': ['Solve the system', '解方程组'],
  'dependent-row': ['Dependent row', '相关行'], 'rank-equality': ['Row rank equals column rank', '行秩等于列秩'], 'special-one': ['First special solution', '第一个特解'],
  'special-two': ['Second special solution', '第二个特解'], 'span-solutions': ['All homogeneous solutions', '齐次方程的全部解'],
  'nullity': ['Nullspace dimension', '零空间维数'], 'new-challenge': ['Independent challenge', '独立挑战'],
};
function titleFor(id: string): Text { return titles[id] ?? ['Review step', '复习步骤']; }
function num(d: Deck, id: string, prompt: Text, fields: FieldSpec[], hint: Text, explanation: Text, lines?: Text[]) {
  return d.number(id, titleFor(id), prompt, fields, hint, explanation, lines);
}
function pick(d: Deck, id: string, prompt: Text, options: Text[], answer: number, hint: Text, explanation: Text, lines?: Text[]) {
  return d.choice(id, titleFor(id), prompt, options, answer, hint, explanation, lines);
}

/** Review and exam practice adapted from MIT 18.06SC sessions 3.9 and 4.1–4.3. */
export const batch07Generators: GeneratorMap = {
  'MIT-LA-37': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-37');
    const a = d.random(1, 4), b = d.random(1, 4);
    const cards = [
      pick(d, 'skew-spectrum', ['For the real skew-symmetric matrix A=[[0,−k],[k,0]], which statement always holds?', '对实反对称矩阵 A=[[0,−k],[k,0]]，哪项总成立？'],
        [['Its eigenvalues are purely imaginary or zero.', '特征值为纯虚数或零。'], ['All its eigenvalues are positive.', '所有特征值都为正。'], ['It is positive definite.', '它是正定的。']], 0,
        ['Aᵀ=−A constrains its spectrum.', '利用 Aᵀ=−A 对谱的限制。'],
        ['A real skew-symmetric matrix has eigenvalues on the imaginary axis; this 2×2 example has ±ki.', '实反对称矩阵的特征值位于虚轴；这个 2×2 例子的特征值为 ±ki。']),
      pick(d, 'symmetric', ['For a real symmetric matrix, what can be said about its eigenvectors and eigenvalues?', '实对称矩阵的特征值和特征向量有什么性质？'],
        [['It has real eigenvalues and an orthonormal eigenbasis.', '特征值为实数，并有一组正交归一特征基。'], ['It may lack enough eigenvectors.', '它可能没有足够的特征向量。'], ['Its eigenvalues must be positive.', '特征值必须为正。']], 0,
        ['Use the spectral theorem; positivity is a separate condition.', '使用谱定理；正性是另一个条件。'],
        ['A=QΛQᵀ with Q orthogonal; eigenvalues are real but need not be positive.', 'A=QΛQᵀ，Q 正交；特征值为实数，但不一定为正。']),
      pick(d, 'pd-test', ['A symmetric matrix has eigenvalues 0, 2, and 5. Is it positive definite?', '对称矩阵的特征值为 0、2、5。它是正定矩阵吗？'],
        [['No; positive definite requires every eigenvalue > 0.', '不是；正定要求所有特征值都大于 0。'], ['Yes; none are negative.', '是；没有负特征值。'], ['Yes; one eigenvalue is positive.', '是；有一个正特征值。']], 0,
        ['Zero is not strictly positive.', '0 不是严格正数。'], ['It is positive semidefinite, but not positive definite.', '它是半正定的，但不是正定的。']),
      num(d, 'projection', ['For P=diag(1,0,1), compute P² and state whether P is a projection.', '对 P=diag(1,0,1)，求 P² 并判断 P 是否为投影。'], [[['(P²)₁₁', '(P²)₁₁'], 1], [['(P²)₂₂', '(P²)₂₂'], 0], [['(P²)₃₃', '(P²)₃₃'], 1]],
        ['A projection satisfies P²=P.', '投影矩阵满足 P²=P。'], ['Squaring 0s and 1s leaves them unchanged, so P²=P.', '0 和 1 平方后不变，因此 P²=P。']),
      num(d, 'svd', ['For A=diag(3,2), give its two singular values.', '对 A=diag(3,2)，求两个奇异值。'], [[['σ₁', 'σ₁'], 3], [['σ₂', 'σ₂'], 2]],
        ['Singular values are the nonnegative square roots of eigenvalues of AᵀA.', '奇异值是 AᵀA 特征值的非负平方根。'], ['AᵀA=diag(9,4), hence σ₁=3 and σ₂=2.', 'AᵀA=diag(9,4)，所以 σ₁=3、σ₂=2。']),
      pick(d, 'ata', ['Why is AᵀA always positive semidefinite for a real matrix A?', '实矩阵 A 的 AᵀA 为什么总是半正定？'],
        [['xᵀAᵀAx=‖Ax‖²≥0 for every x.', '对任意 x，xᵀAᵀAx=‖Ax‖²≥0。'], ['Its determinant is always positive.', '它的行列式总为正。'], ['AᵀA is always invertible.', 'AᵀA 总可逆。']], 0,
        ['Rewrite the quadratic form as a squared norm.', '把二次型改写成范数平方。'], ['It is positive definite only when A has independent columns; otherwise a nonzero null vector gives zero.', '仅当 A 列满秩时它才正定；否则非零零空间向量会使二次型为零。']),
      num(d, 'rayleigh', [`For D=diag(${a},${b}), and x=(1,1), compute xᵀDx / xᵀx.`, `对 D=diag(${a},${b})、x=(1,1)，求 xᵀDx / xᵀx。`], [[['Quotient', '商'], (a + b) / 2]],
        ['The numerator is a+b and the denominator is 2.', '分子为 a+b，分母为 2。'], [`The quotient is (${a}+${b})/2=${(a + b) / 2}; it lies between the eigenvalues.`, `商为 (${a}+${b})/2=${(a + b) / 2}，位于两个特征值之间。`]),
      pick(d, 'flow', ['If A=diag(−1,2), what does u(t)=eᴬᵗu(0) do to the two coordinate modes?', '若 A=diag(−1,2)，u(t)=eᴬᵗu(0) 对两个坐标模态有什么作用？'],
        [['The first decays like e⁻ᵗ; the second grows like e²ᵗ.', '第一分量按 e⁻ᵗ 衰减；第二分量按 e²ᵗ 增长。'], ['Both decay.', '两者都衰减。'], ['Both stay constant.', '两者都不变。']], 0,
        ['For diagonal A, exponentiate each diagonal eigenvalue.', '对角矩阵的指数对每个对角特征值分别取指数。'], ['The sign of each eigenvalue controls growth or decay in its eigenvector direction.', '每个特征值的符号决定对应特征向量方向上的增长或衰减。']),
    ];
    const j = d.random(1, 4), m = d.random(1, 4), n = d.random(1, 4);
    cards.push(num(d, 'exam-challenge', [`Independent challenge: for symmetric D=diag(${j},${m},${n}) and x=(1,0,1), compute xᵀDx / xᵀx and give the largest eigenvalue.`, `独立挑战：对对称矩阵 D=diag(${j},${m},${n})、x=(1,0,1)，求 xᵀDx / xᵀx 及最大特征值。`],
      [[['Rayleigh quotient', 'Rayleigh 商'], (j + n) / 2], [['Largest eigenvalue', '最大特征值'], Math.max(j, m, n)]],
      ['Use only the first and third diagonal entries in the quotient.', '商只用到第 1 和第 3 个对角元素。'],
      [`The quotient is (${j}+${n})/2=${(j + n) / 2}; the largest eigenvalue is max(${j},${m},${n})=${Math.max(j, m, n)}.`, `Rayleigh 商为 (${j}+${n})/2=${(j + n) / 2}；最大特征值为 max(${j},${m},${n})=${Math.max(j, m, n)}。`],
      ['Review templates are practice, not a proof of mastery or transfer to unfamiliar problems.', '复习题型仅供练习，不证明已经掌握或能迁移到陌生问题。']));
    return cards;
  },
  'MIT-LA-38': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-38');
    const u = d.random(1, 4);
    const a = d.random(1, 4), b = d.random(1, 4), c = d.random(1, 4);
    const cards = [
      pick(d, 'orthogonal', ['A square matrix has every singular value equal to 1. What must A be?', '方阵 A 的所有奇异值都等于 1。A 必须是什么矩阵？'],
        [['Orthogonal', '正交'], ['Positive definite', '正定'], ['Diagonal', '对角']], 0,
        ['Use A=UΣVᵀ and Σ=I.', '使用 A=UΣVᵀ 且 Σ=I。'], ['A=UVᵀ is a product of orthogonal matrices, so A is orthogonal; it need not be symmetric.', 'A=UVᵀ 是正交矩阵的乘积，因此 A 正交；但它不一定对称。']),
      num(d, 'triangular-eigen', [`Find the eigenvalues of T=[[${a},2,0],[0,${b},1],[0,0,${c}]], in diagonal order.`, `求 T=[[${a},2,0],[0,${b},1],[0,0,${c}]] 的特征值，按对角元素的顺序填写。`],
        [[['λ₁', 'λ₁'], a], [['λ₂', 'λ₂'], b], [['λ₃', 'λ₃'], c]], ['For triangular matrices, read the diagonal.', '三角矩阵的特征值就是对角元素。'],
        [`The characteristic polynomial has roots ${a}, ${b}, ${c}, including repeats if values coincide.`, `特征多项式的根为 ${a}、${b}、${c}；若数值相同则按重数计算。`]),
      num(d, 'power', [`For A=diag(${u},−1), compute the diagonal entries of A³.`, `对 A=diag(${u},−1)，求 A³ 的对角元素。`], [[['first diagonal', '第一个对角元'], u ** 3], [['second diagonal', '第二个对角元'], -1]],
        ['Powers of a diagonal matrix are entrywise powers.', '对角矩阵的幂逐个对角元素取幂。'], [`A³=diag(${u ** 3},−1).`, `A³=diag(${u ** 3},−1)。`]),
      pick(d, 'diagonalize', ['If A=SΛS⁻¹, which expression gives Aᵏ?', '若 A=SΛS⁻¹，Aᵏ 等于什么？'],
        [['SΛᵏS⁻¹', 'SΛᵏS⁻¹'], ['Λᵏ only', '仅 Λᵏ'], ['S⁻¹ΛᵏS', 'S⁻¹ΛᵏS']], 0,
        ['Adjacent S⁻¹S factors cancel.', '相邻的 S⁻¹S 会抵消。'], ['The same eigenvector matrix appears on both sides; take powers of the diagonal eigenvalue matrix.', '两侧保留相同特征向量矩阵；对角特征值矩阵取幂。']),
      num(d, 'inverse-eigen', ['A is diagonalizable with eigenvalues 2 and 5. Give the corresponding eigenvalues of A⁻¹ in that order.', 'A 可对角化，特征值为 2 和 5。按这个顺序求 A⁻¹ 对应的特征值。'], [[['first', '第一个'], 0.5], [['second', '第二个'], 0.2]],
        ['If Av=λv with λ≠0, then A⁻¹v=(1/λ)v.', '若 Av=λv 且 λ≠0，则 A⁻¹v=(1/λ)v。'], ['The inverse eigenvalues are 1/2 and 1/5.', '逆矩阵的特征值为 1/2、1/5。']),
      num(d, 'svd-rank', ['For A=[[1,2,0],[2,4,0]], how many singular values are positive and how many are zero?', '对 A=[[1,2,0],[2,4,0]]，有几个正奇异值、几个零奇异值？'], [[['positive', '正奇异值数'], 1], [['zero', '零奇异值数'], 1]],
        ['The second row is twice the first, so rank(A)=1; the usual singular-value list has min(2,3)=2 entries.', '第 2 行是第 1 行的两倍，所以 rank(A)=1；通常奇异值列表有 min(2,3)=2 项。'],
        ['Rank equals the number of positive singular values: one positive and one zero.', '秩等于正奇异值个数：一个正奇异值、一个零奇异值。']),
      pick(d, 'semidefinite', ['For real A, can AᵀA have a negative eigenvalue?', '对实矩阵 A，AᵀA 能有负特征值吗？'],
        [['No; xᵀAᵀAx=‖Ax‖²≥0.', '不能；xᵀAᵀAx=‖Ax‖²≥0。'], ['Yes, when A is rectangular.', '可以，若 A 是长方形矩阵。'], ['Only if A is singular.', '仅当 A 奇异时。']], 0,
        ['AᵀA is symmetric positive semidefinite.', 'AᵀA 是对称半正定矩阵。'], ['Zero eigenvalues are possible when A is rank deficient, but negative ones are not.', 'A 秩亏时可以有零特征值，但不会有负特征值。']),
      pick(d, 'pd-test', ['A is real symmetric with eigenvalues −1 and 3. Which statement is correct?', '实对称矩阵的特征值为 −1 和 3。哪项正确？'],
        [['It is indefinite, so not positive definite.', '它是不定矩阵，因此不正定。'], ['It is positive definite because one eigenvalue is positive.', '它正定，因为有一个特征值为正。'], ['It is positive semidefinite.', '它半正定。']], 0,
        ['Positive definiteness requires every eigenvalue to be positive.', '正定要求每个特征值都为正。'], ['The negative eigenvalue makes the quadratic form negative in its eigenvector direction.', '沿负特征值对应的特征向量方向，二次型为负。']),
      num(d, 'determinant', [`For diagonal M=diag(${a},${b},−${c}), compute det(M).`, `对对角矩阵 M=diag(${a},${b},−${c})，求 det(M)。`], [[['det(M)', 'det(M)'], -a * b * c]],
        ['Multiply the diagonal entries.', '将对角元素相乘。'], [`det(M)=${a}·${b}·(−${c})=${-a * b * c}.`, `det(M)=${a}·${b}·(−${c})=${-a * b * c}。`]),
      pick(d, 'orthogonal-counterexample', ['Counterexample check: is Q=diag(1,−1) positive definite?', '反例检查：Q=diag(1,−1) 是正定矩阵吗？'],
        [['No; it is symmetric and orthogonal but has eigenvalue −1.', '不是；它对称且正交，但有特征值 −1。'], ['Yes; every orthogonal matrix is positive definite.', '是；所有正交矩阵都正定。'], ['Only if det(Q)=1.', '仅当 det(Q)=1。']], 0,
        ['Orthogonality does not imply all eigenvalues are positive.', '正交性不代表所有特征值为正。'], ['The matrix is an explicit counterexample to “symmetric orthogonal implies positive definite.”', '该矩阵直接反驳“对称正交就正定”的说法。']),
    ];
    const r = d.random(1, 4), s = d.random(1, 4);
    cards.push(num(d, 'exam-challenge', [`Independent challenge: for A=diag(${r},${s}), give its singular values and det(A).`, `独立挑战：对 A=diag(${r},${s})，求奇异值及 det(A)。`],
      [[['larger singular value', '较大奇异值'], Math.max(r, s)], [['smaller singular value', '较小奇异值'], Math.min(r, s)], [['det(A)', 'det(A)'], r * s]],
      ['Positive diagonal entries are already singular values.', '正对角元素本身就是奇异值。'],
      [`The singular values are ${Math.max(r, s)} and ${Math.min(r, s)}; det(A)=${r}·${s}=${r * s}.`, `奇异值为 ${Math.max(r, s)}、${Math.min(r, s)}；det(A)=${r}·${s}=${r * s}。`],
      ['This is focused exam practice, not a claim of complete exam readiness.', '这是针对性考试练习，不代表已全面准备好考试。']));
    return cards;
  },
  'MIT-LA-39': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-39');
    const cards = [
      num(d, 'rank-dimensions', ['A is 3×4 with rank 2. Give dim C(A), dim N(A), dim C(Aᵀ), and dim N(Aᵀ).', 'A 是 3×4 矩阵且秩为 2。求 dim C(A)、dim N(A)、dim C(Aᵀ)、dim N(Aᵀ)。'],
        [[['dim C(A)', '列空间维数'], 2], [['dim N(A)', '零空间维数'], 2], [['dim C(Aᵀ)', '行空间维数'], 2], [['dim N(Aᵀ)', '左零空间维数'], 1]],
        ['Use r, n−r, r, and m−r.', '依次使用 r、n−r、r、m−r。'], ['The four dimensions are 2, 2, 2, and 1.', '四个维数依次为 2、2、2、1。']),
      num(d, 'column-method', ['If A=[v₁ v₂ v₃], solve A x=v₁−v₂+v₃ by giving x.', '若 A=[v₁ v₂ v₃]，求 A x=v₁−v₂+v₃ 的解 x。'], [[['x₁', 'x₁'], 1], [['x₂', 'x₂'], -1], [['x₃', 'x₃'], 1]],
        ['Read the coefficients of the column combination.', '直接读取列组合的系数。'], ['The coefficient vector is (1,−1,1).', '系数向量为 (1,−1,1)。']),
      pick(d, 'uniqueness', ['If v₁−v₂+v₃=0, is the solution to A x=v₁−v₂+v₃ unique?', '若 v₁−v₂+v₃=0，A x=v₁−v₂+v₃ 的解是否唯一？'],
        [['No; (1,−1,1) is a nonzero null vector, so solutions are not unique.', '否；(1,−1,1) 是非零零空间向量，因此解不唯一。'], ['Yes; the right side is zero.', '是；右端为零。'], ['Only if the columns are unit vectors.', '仅当列向量都是单位向量。']], 0,
        ['A nonzero vector in N(A) can be added to any solution.', '可将 N(A) 中的非零向量加到任一解上。'], ['The condition says A(1,−1,1)=0, so the nullspace is nontrivial.', '该条件说明 A(1,−1,1)=0，因此零空间非平凡。']),
      pick(d, 'markov-spectrum', ['For M=[[p,1−p],[1−p,p]] with p=1/4, give its eigenvalues.', '对 M=[[p,1−p],[1−p,p]] 且 p=1/4，求特征值。'],
        [['1 and −1/2', '1 和 −1/2'], ['1/2 and 1/4', '1/2 和 1/4'], ['0 and 1/2', '0 和 1/2']], 0,
        ['The all-ones direction has eigenvalue 1; (1,−1) has eigenvalue 2p−1.', '全 1 方向的特征值为 1；(1,−1) 方向的特征值为 2p−1。'],
        ['The matrix is symmetric stochastic; its eigenvalues are 1 and 2(1/4)−1=−1/2.', '该矩阵是对称随机矩阵；特征值为 1 和 2(1/4)−1=−1/2。']),
      num(d, 'steady-state', ['For this M and u₀=(1,0), what is limₖ→∞ Mᵏu₀?', '对该 M 和 u₀=(1,0)，求 limₖ→∞ Mᵏu₀。'], [[['first component', '第一分量'], 0.5], [['second component', '第二分量'], 0.5]],
        ['The eigenvalue −1/2 decays under repeated powers; the eigenvalue-1 direction remains.', '反复取幂时，特征值 −1/2 的模态衰减；特征值 1 的方向保留。'], ['The limit is the projection onto span(1,1), namely (1/2,1/2).', '极限是投影到 span(1,1)，即 (1/2,1/2)。']),
      num(d, 'least-squares', ['For A=[[1,0],[1,1],[1,2]] and b=(1,2,2), find the least-squares coefficients x̂.', '对 A=[[1,0],[1,1],[1,2]]、b=(1,2,2)，求最小二乘系数 x̂。'], [[['x̂₁', 'x̂₁'], 7 / 6], [['x̂₂', 'x̂₂'], 1 / 2]],
        ['Solve AᵀA x̂=Aᵀb; here AᵀA=[[3,3],[3,5]] and Aᵀb=(5,6).', '解 AᵀA x̂=Aᵀb；这里 AᵀA=[[3,3],[3,5]]，Aᵀb=(5,6)。'], ['Solving gives x̂=(7/6,1/2).', '解得 x̂=(7/6,1/2)。']),
      num(d, 'projection-space', ['For the least-squares fit above, give p=A x̂ and the residual e=b−p.', '对上题的最小二乘拟合，求 p=A x̂ 和残差 e=b−p。'], [[['p₁', 'p₁'], 7 / 6], [['p₂', 'p₂'], 5 / 3], [['p₃', 'p₃'], 13 / 6], [['e₁', 'e₁'], -1 / 6], [['e₂', 'e₂'], 1 / 3], [['e₃', 'e₃'], -1 / 6]],
        ['Multiply A x̂, then subtract from b.', '计算 A x̂，再用 b 减去它。'], ['p lies in C(A); the residual is orthogonal to C(A), so Aᵀe=0.', 'p 属于 C(A)；残差与 C(A) 正交，因此 Aᵀe=0。']),
      pick(d, 'projection-formula', ['For full-column-rank A, which is the orthogonal projector onto C(A)?', '若 A 列满秩，哪个矩阵是到 C(A) 的正交投影？'],
        [['P=A(AᵀA)⁻¹Aᵀ', 'P=A(AᵀA)⁻¹Aᵀ'], ['P=(AᵀA)A', 'P=(AᵀA)A'], ['P=AᵀA', 'P=AᵀA']], 0,
        ['It must map b to A x̂, where x̂ solves the normal equations.', '它应把 b 映射到 A x̂，其中 x̂ 满足正规方程。'], ['The formula is symmetric and idempotent, and its range is C(A).', '该公式对称且幂等，值域为 C(A)。']),
    ];
    const r = d.random(-3, 3), s = d.random(-3, 3), mean = (r + s) / 2;
    cards.push(num(d, 'changed-example', [`Independent challenge: project b=(${r},${s}) onto span{(1,1)}. Give the projection’s two components.`, `独立挑战：将 b=(${r},${s}) 投影到 span{(1,1)}。求投影的两个分量。`],
      [[['first component', '第一分量'], mean], [['second component', '第二分量'], mean]], ['The projection coefficient is b·(1,1)/2.', '投影系数为 b·(1,1)/2。'],
      [`The coefficient is (${r}+${s})/2=${mean}; both components equal it.`, `系数为 (${r}+${s})/2=${mean}；两个分量都等于该值。`],
      ['These selected review items do not cover every course topic or establish mastery.', '这些复习题没有覆盖课程所有内容，也不代表已经掌握。']));
    return cards;
  },
  'MIT-LA-40': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-40');
    const a = d.random(1, 3), b = d.random(1, 3), c = d.random(-3, 3), e = d.random(-3, 3);
    const u = d.random(1, 3), v = d.random(1, 3), w = d.random(1, 3);
    const cards = [
      pick(d, 'rref-pivots', [`For R=[[1,0,${a},${b}],[0,1,${c},${e}],[0,0,0,0]], identify pivot and free columns.`, `对 R=[[1,0,${a},${b}],[0,1,${c},${e}],[0,0,0,0]]，指出主元列和自由列。`],
        [['Pivots 1,2; free 3,4', '主元列 1、2；自由列 3、4'], ['Pivots 1,3; free 2,4', '主元列 1、3；自由列 2、4'], ['All four are pivot columns', '四列都是主元列']], 0,
        ['Find leading 1s; columns 3 and 4 contain no leading pivot.', '找首个 1；第 3、4 列没有主元。'], ['There are two pivot variables and two free variables.', '有两个主元变量和两个自由变量。']),
      num(d, 'special-solutions', [`For that R, set x₃=1,x₄=0. Find x₁,x₂ in the first special solution.`, `对该 R，令 x₃=1、x₄=0，求第一个特解中的 x₁、x₂。`], [[['x₁', 'x₁'], -a], [['x₂', 'x₂'], -c]],
        ['Substitute x₃=1 and x₄=0 into the two nonzero rows of R.', '将 x₃=1、x₄=0 代入 R 的两个非零行。'], [`The first special solution is (${-a},${-c},1,0).`, `第一个特解为 (${-a},${-c},1,0)。`]),
      num(d, 'four-spaces', ['For a 3×4 matrix of rank 2, give the dimensions of C(A), N(A), C(Aᵀ), N(Aᵀ).', '对秩为 2 的 3×4 矩阵，求 C(A)、N(A)、C(Aᵀ)、N(Aᵀ) 的维数。'],
        [[['column', '列'], 2], [['null', '零空间'], 2], [['row', '行'], 2], [['left null', '左零空间'], 1]],
        ['Use rank r, columns n=4, rows m=3.', '使用秩 r、列数 n=4、行数 m=3。'], ['The dimensions are r=2, n−r=2, r=2, and m−r=1.', '维数依次为 r=2、n−r=2、r=2、m−r=1。']),
      num(d, 'qr-step', ['Let u=(1,1,0), v=(2,0,2). For w=v−αu with w⊥u, find α and w.', '设 u=(1,1,0)、v=(2,0,2)。令 w=v−αu 且 w⊥u，求 α 和 w。'],
        [[['α', 'α'], 1], [['w₁', 'w₁'], 1], [['w₂', 'w₂'], -1], [['w₃', 'w₃'], 2]],
        ['Set uᵀ(v−αu)=0, so α=(uᵀv)/(uᵀu).', '令 uᵀ(v−αu)=0，因此 α=(uᵀv)/(uᵀu)。'], ['uᵀv=2 and uᵀu=2, so α=1 and w=(1,−1,2).', 'uᵀv=2、uᵀu=2，所以 α=1，w=(1,−1,2)。']),
      num(d, 'projection-formula', ['For orthogonal columns u=(1,1,0), v=(0,0,1), find P₁₁, P₁₂, P₂₂ and P₃₃ of the projection onto their span. P is symmetric and its other off-diagonal entries are zero.', '对正交列向量 u=(1,1,0)、v=(0,0,1)，求到其张成空间的投影矩阵的 P₁₁、P₁₂、P₂₂、P₃₃。P 对称，其余非对角元素均为零。'],
        [[['P₁₁', 'P₁₁'], 0.5], [['P₁₂', 'P₁₂'], 0.5], [['P₂₂', 'P₂₂'], 0.5], [['P₃₃', 'P₃₃'], 1]],
        ['Normalize each orthogonal column and sum qᵢqᵢᵀ.', '将正交列归一化，再求和 qᵢqᵢᵀ。'], ['P=QQᵀ=[[1/2,1/2,0],[1/2,1/2,0],[0,0,1]].', 'P=QQᵀ=[[1/2,1/2,0],[1/2,1/2,0],[0,0,1]]。']),
      pick(d, 'rank-augment', ['For matrices A and B with the same number of rows, which relation always holds?', '矩阵 A、B 行数相同。哪项秩关系总成立？'],
        [['rank(A) ≤ rank([A B]).', 'rank(A)≤rank([A B])。'], ['rank(A) ≥ rank([A B]).', 'rank(A)≥rank([A B])。'], ['The ranks are always equal.', '两者秩总相等。']], 0,
        ['Appending columns cannot remove existing independent columns.', '添加列不会消除原有独立列。'], ['New columns may add pivots, so equality is not guaranteed.', '新列可能带来额外主元，因此不保证相等。']),
      pick(d, 'rank-a2', ['For square A, why is rank([A A²])=rank(A)?', '对方阵 A，为什么 rank([A A²])=rank(A)？'],
        [['Every column of A² is a combination of columns of A.', 'A² 的每一列都是 A 的列的线性组合。'], ['A² is always invertible.', 'A² 总可逆。'], ['The two blocks have different dimensions.', '两个分块维数不同。']], 0,
        ['Each column of A² is A times a column of A.', 'A² 的每一列都是 A 乘以 A 的一列。'],
        ['Each column of A² is A times a column of A, hence is a linear combination of A’s columns; appending it adds no new column-space direction.', 'A² 每一列都是 A 乘以 A 的某列，因此是 A 的列组合；增广后不会增加新的列空间方向。']),
      num(d, 'double-nullity', ['If A is 4×3 with rank 2, what is dim N([A A])?', '若 A 是 4×3 且秩为 2，求 dim N([A A])。'], [[['Dimension', '维数'], 4]],
        ['[A A] has 6 columns and the same rank 2.', '[A A] 有 6 列，秩仍为 2。'], ['Nullity is number of columns minus rank: 6−2=4.', '零度等于列数减秩：6−2=4。']),
      pick(d, 'normal-equations', ['For full-column-rank A, which formula gives the least-squares solution?', '若 A 列满秩，哪个公式给出最小二乘解？'],
        [['x̂=(AᵀA)⁻¹Aᵀb', 'x̂=(AᵀA)⁻¹Aᵀb'], ['x̂=Aᵀb', 'x̂=Aᵀb'], ['x̂=A⁻¹b', 'x̂=A⁻¹b']], 0,
        ['The residual is orthogonal to the columns: Aᵀ(Ax̂−b)=0.', '残差与 A 的列正交：Aᵀ(Ax̂−b)=0。'], ['This gives the normal equation AᵀA x̂=Aᵀb; full column rank makes AᵀA invertible.', '这给出正规方程 AᵀA x̂=Aᵀb；列满秩使 AᵀA 可逆。']),
      num(d, 'least-squares-fit', [`For A=[1,1,1]ᵀ and b=(${u},${v},${w}), find x̂ and the projection p=A x̂.`, `对 A=[1,1,1]ᵀ、b=(${u},${v},${w})，求 x̂ 和投影 p=A x̂。`],
        [[['x̂', 'x̂'], (u + v + w) / 3], [['p₁', 'p₁'], (u + v + w) / 3], [['p₂', 'p₂'], (u + v + w) / 3], [['p₃', 'p₃'], (u + v + w) / 3]],
        ['Project onto the constant-vector line; the coefficient is the mean of b.', '投影到常向量直线上；系数是 b 的平均值。'], [`x̂=(${u}+${v}+${w})/3=${(u + v + w) / 3}; each entry of p equals x̂.`, `x̂=(${u}+${v}+${w})/3=${(u + v + w) / 3}；p 的每个分量都等于 x̂。`]),
      num(d, 'det-triangular', [`Compute det(U) for U=[[${a},2,0],[0,${b},1],[0,0,${c}]].`, `对 U=[[${a},2,0],[0,${b},1],[0,0,${c}]]，求 det(U)。`], [[['det(U)', 'det(U)'], a * b * c]],
        ['The determinant of a triangular matrix is the product of its diagonal entries.', '三角矩阵的行列式等于对角元素之积。'], [`det(U)=${a}·${b}·${c}=${a * b * c}.`, `det(U)=${a}·${b}·${c}=${a * b * c}。`]),
      pick(d, 'gram-positive', ['If A has independent columns, why is AᵀA positive definite?', '若 A 列线性无关，为什么 AᵀA 正定？'],
        [['For x≠0, Ax≠0, so xᵀAᵀAx=‖Ax‖²>0.', '对 x≠0，Ax≠0，因此 xᵀAᵀAx=‖Ax‖²>0。'], ['AᵀA has a zero eigenvalue.', 'AᵀA 有零特征值。'], ['A must be square.', 'A 必须是方阵。']], 0,
        ['Use full column rank to rule out nonzero x in N(A).', '列满秩意味着 N(A) 中没有非零向量。'], ['The independent-column assumption is essential; if A is rank deficient, a nonzero null vector makes the quadratic form zero.', '列独立的假设不可少；若 A 秩亏，非零零空间向量会使二次型为零。']),
      pick(d, 'orthogonal-counterexample', ['Counterexample: is symmetric orthogonal Q=diag(1,−1) necessarily positive definite?', '反例：对称正交矩阵 Q=diag(1,−1) 一定正定吗？'],
        [['No; q=(0,1) gives qᵀQq=−1.', '否；取 q=(0,1) 得 qᵀQq=−1。'], ['Yes; symmetry and orthogonality imply positive eigenvalues.', '是；对称与正交意味着特征值为正。'], ['Only for odd dimensions.', '仅在奇数维时。']], 0,
        ['Test the quadratic form on the second coordinate vector.', '用第二个坐标向量检验二次型。'], ['The eigenvalue −1 violates positive definiteness.', '特征值 −1 违反正定条件。']),
    ];
    const x = d.random(1, 4), y = d.random(1, 4), z = d.random(1, 4);
    cards.push(num(d, 'changed-example', [`Independent challenge: fit b=(${x},${y},${z}) by a constant vector c(1,1,1). Find c and the fitted vector.`, `独立挑战：用常向量 c(1,1,1) 拟合 b=(${x},${y},${z})。求 c 和拟合向量。`],
      [[['c', 'c'], (x + y + z) / 3], [['first fitted value', '拟合值 1'], (x + y + z) / 3], [['second fitted value', '拟合值 2'], (x + y + z) / 3], [['third fitted value', '拟合值 3'], (x + y + z) / 3]],
      ['The least-squares constant is the mean.', '最小二乘常数等于平均值。'], [`c=(${x}+${y}+${z})/3=${(x + y + z) / 3}; all three fitted values equal c.`, `c=(${x}+${y}+${z})/3=${(x + y + z) / 3}；三个拟合值都等于 c。`],
      ['This samples selected final-exam topics and is not a comprehensive readiness measure.', '本题抽查部分期末主题，不是全面的应考能力测量。']));
    return cards;
  },
  'MIT-LA-41': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-41');
    const cards = [
      num(d, 'eliminate', ['The augmented rows are (2,3,4|19), (4,11,14|55), (2,8,17|50). After row 2−2·row 1 and row 3−row 1, find the (y,z,right-side) entries in rows 2 and 3.', '增广矩阵的各行为 (2,3,4|19)、(4,11,14|55)、(2,8,17|50)。第 2 行减 2 倍第 1 行、第 3 行减第 1 行后，求第 2、3 行的 (y,z,右端) 分量。'],
        [[['row 2 y', '第 2 行 y'], 5], [['row 2 z', '第 2 行 z'], 6], [['row 2 RHS', '第 2 行右端'], 17], [['row 3 y', '第 3 行 y'], 5], [['row 3 z', '第 3 行 z'], 13], [['row 3 RHS', '第 3 行右端'], 31]],
        ['Original rows are (2,3,4|19), (4,11,14|55), (2,8,17|50).', '原始各行为 (2,3,4|19)、(4,11,14|55)、(2,8,17|50)。'], ['The new rows are (0,5,6|17) and (0,5,13|31).', '新行是 (0,5,6|17) 和 (0,5,13|31)。']),
      num(d, 'back-substitute', ['The difference of the new rows gives 7z=14; then 5y+13z=31. Find z and y.', '新行之差给出 7z=14；再用 5y+13z=31。求 z 和 y。'], [[['z', 'z'], 2], [['y', 'y'], 1]], ['Solve bottom-up.', '从下往上求解。'], ['z=2, then 5y+26=31 gives y=1.', 'z=2，再由 5y+26=31 得 y=1。']),
      num(d, 'solution', ['Use 2x+3y+4z=19 with y=1,z=2. Give the solution (x,y,z).', '在 y=1、z=2 时，使用 2x+3y+4z=19，写出解 (x,y,z)。'], [[['x', 'x'], 4], [['y', 'y'], 1], [['z', 'z'], 2]], ['Substitute into the original top row.', '代入原始第一行。'], ['2x+3+8=19, so (x,y,z)=(4,1,2).', '2x+3+8=19，因此 (x,y,z)=(4,1,2)。']),
      pick(d, 'dependent-row', ['For rows (1,2,11,17), (3,7,37,57), (4,9,48,74), what is the row relation?', '对三行 (1,2,11,17)、(3,7,37,57)、(4,9,48,74)，行之间是什么关系？'],
        [['Row 3 = row 1 + row 2.', '第 3 行 = 第 1 行 + 第 2 行。'], ['Row 1 = row 2 + row 3.', '第 1 行 = 第 2 行 + 第 3 行。'], ['All three rows are independent.', '三行都线性无关。']], 0,
        ['Add rows 1 and 2 componentwise.', '逐项相加第 1、2 行。'], ['The third row is redundant and reduces to zero.', '第 3 行冗余，消元后为零行。']),
      num(d, 'rank-2023', ['The first two rows above are independent and the third is their sum. Find rank(A).', '上面前两行线性无关，第三行是它们之和。求 rank(A)。'], [[['rank(A)', '秩'], 2]], ['Count independent rows.', '数独立行。'], ['There are two independent rows, so rank(A)=2.', '有两行线性无关，因此 rank(A)=2。']),
      pick(d, 'rank-equality', ['What does this example show about row rank and column rank?', '这个例子说明行秩与列秩有什么关系？'],
        [['They are equal; both are 2.', '二者相等，都是 2。'], ['Row rank is 3, column rank is 2.', '行秩为 3、列秩为 2。'], ['They can differ.', '二者可能不同。']], 0,
        ['Rank is the number of pivots.', '秩等于主元数。'], ['The number of independent rows equals the number of independent columns.', '独立行数等于独立列数。']),
      num(d, 'nullity', ['A has 4 columns and rank 2. Find dim N(A).', 'A 有 4 列、秩为 2。求 dim N(A)。'], [[['dim N(A)', '零空间维数'], 2]], ['Use nullity=n−rank.', '使用零度=n−秩。'], ['There are two free variables and two special solutions.', '有两个自由变量和两个特解。']),
      num(d, 'special-one', ['For x₁+3x₃+5x₄=0 and x₂+4x₃+6x₄=0, set x₃=1,x₄=0. Find x₁,x₂.', '对 x₁+3x₃+5x₄=0、x₂+4x₃+6x₄=0，令 x₃=1、x₄=0，求 x₁、x₂。'], [[['x₁', 'x₁'], -3], [['x₂', 'x₂'], -4]], ['The free variables are fixed; solve the pivot equations.', '自由变量已固定，解主元方程。'], ['The first special solution is (−3,−4,1,0).', '第一个特解为 (−3,−4,1,0)。']),
      num(d, 'special-two', ['For the same equations, set x₃=0,x₄=1. Find x₁,x₂.', '对同一组方程，令 x₃=0、x₄=1，求 x₁、x₂。'], [[['x₁', 'x₁'], -5], [['x₂', 'x₂'], -6]], ['Again solve the pivot equations.', '再次解主元方程。'], ['The second special solution is (−5,−6,0,1).', '第二个特解为 (−5,−6,0,1)。']),
      pick(d, 'span-solutions', ['How do the two special solutions describe every solution of A x=0?', '两个特解如何描述 A x=0 的全部解？'],
        [['Their arbitrary linear combinations.', '它们的任意线性组合。'], ['Only the two listed vectors.', '只有列出的两个向量。'], ['Every vector in R⁴.', 'R⁴ 中所有向量。']], 0,
        ['The two free variables vary independently.', '两个自由变量可独立变化。'], ['N(A)=span{(−3,−4,1,0),(−5,−6,0,1)}.', 'N(A)=span{(−3,−4,1,0),(−5,−6,0,1)}。']),
    ];
    const A = d.random(-3, 3), B = d.random(-3, 3), C = d.random(-3, 3), E = d.random(-3, 3);
    cards.push(num(d, 'new-challenge', [`Independent challenge: R=[[1,0,${A},${B}],[0,1,${C},${E}],[0,0,0,0]]. Set x₃=1,x₄=0; find the special solution.`, `独立挑战：R=[[1,0,${A},${B}],[0,1,${C},${E}],[0,0,0,0]]。令 x₃=1、x₄=0，求特解。`],
      [[['x₁', 'x₁'], -A], [['x₂', 'x₂'], -C], [['x₃', 'x₃'], 1], [['x₄', 'x₄'], 0]], ['Set the free variables before solving for pivots.', '先设自由变量，再求主元变量。'],
      [`The solution is (${-A},${-C},1,0); substitution confirms R x=0.`, `解为 (${-A},${-C},1,0)；代入可验证 R x=0。`],
      ['This practices the transcript’s math examples, not biography or proof mastery.', '本题练习讲座中的数学例子，不涉及人物轶事，也不代表证明能力已掌握。']));
    return cards;
  },
};
