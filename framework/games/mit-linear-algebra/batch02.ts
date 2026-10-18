import type { FieldSpec, GeneratorMap, Text } from './support';
import { makeDeck } from './support';

type Deck = ReturnType<typeof makeDeck>;
const practiceTitle: Text = ['Practice step', '练习步骤'];
function numberCard(d: Deck, id: string, prompt: Text, fields: FieldSpec[], hint: Text, explanation: Text, lines?: Text[]) {
  return d.number(id, titleFor(id), prompt, fields, hint, explanation, lines);
}
function choiceCard(d: Deck, id: string, prompt: Text, options: Text[], answer: number, hint: Text, explanation: Text, lines?: Text[]) {
  return d.choice(id, titleFor(id), prompt, options, answer, hint, explanation, lines);
}
function symbolsCard(d: Deck, id: string, prompt: Text, before: Text, answers: string[], tokens: string[], hint: Text, explanation: Text, between?: string[]) {
  return d.symbols(id, titleFor(id), prompt, before, answers, tokens, hint, explanation, between);
}
function titleFor(id: string): Text {
  const names: Record<string, Text> = {
    'pivot-map': ['Pivot columns', '主元列'], 'free-count': ['Free variables', '自由变量'], 'rank-nullity': ['Rank and nullity', '秩与零度'],
    'special-solution': ['Special solution', '特解'], 'nullspace-span': ['Nullspace solutions', '零空间解'], 'pivot-free': ['Pivot or free', '主元或自由'],
    'rank-bound': ['Rank bound', '秩的上界'], 'independent-challenge': ['Independent challenge', '独立挑战'],
    'rref-rows': ['Reduced row', '化简行'], 'consistent': ['Solvability', '可解性'], 'particular': ['Particular solution', '特解'],
    'null-vector': ['Nullspace basis', '零空间基'], 'all-solutions': ['Complete solution', '通解'], 'inconsistent-check': ['Inconsistent system', '不相容方程组'],
    'dependence': ['Linear dependence', '线性相关'], 'rank': ['Span dimension', '张成空间维数'], 'coordinates': ['Coordinates', '坐标'],
    'basis': ['Choose a basis', '选择一组基'], 'basis-test': ['Basis test', '基的判定'], 'counterexample': ['Dimension check', '维数反例'],
    'poly-dimension': ['Polynomial dimension', '多项式空间维数'], 'rank-dimensions': ['Four dimensions', '四个维数'], 'column-basis': ['Column-space basis', '列空间基'],
    'row-basis': ['Row-space basis', '行空间基'], 'null-basis': ['Nullspace basis', '零空间基'], 'left-null-basis': ['Left-nullspace basis', '左零空间基'],
    'orthogonality': ['Orthogonal complements', '正交补'], 'column-row-reduction': ['Row reduction', '行化简'], 'matrix-space-dim': ['Matrix-space dimension', '矩阵空间维数'],
    'matrix-subspace': ['Matrix subspace', '矩阵子空间'], 'outer-product': ['Outer product', '外积'], 'rank-one': ['Rank-one matrix', '秩一矩阵'],
    'det-check': ['Determinant check', '行列式检验'], 'small-world': ['Small-world shortcut', '小世界捷径'], 'degree': ['Node degree', '节点的度'],
    'convention': ['Incidence convention', '关联矩阵约定'], 'incidence-rank': ['Incidence rank', '关联矩阵的秩'], 'cycle-count': ['Independent cycles', '独立环'],
    'node-balance': ['Node balance', '节点平衡'], 'cycle-flow': ['Cycle flow', '环流'], 'kirchhoff': ['Kirchhoff current law', '基尔霍夫电流定律'],
    'potential-drops': ['Potential differences', '电势差'], 'injection-compatibility': ['Current compatibility', '电流相容条件'],
  };
  return names[id] ?? practiceTitle;
}

/** MIT 18.06SC sessions 1.7–1.12: bounded exact examples for the second batch. */
export const batch02Generators: GeneratorMap = {
  'MIT-LA-07': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-07');
    const signed = () => d.random(0, 1) ? d.random(1, 3) : -d.random(1, 3);
    const a = signed(), b = signed(), c = signed();
    const x1 = a * c - b, x2 = -c;
    const cards = [
      choiceCard(d, 'pivot-map', [`Locate the pivots in R = [[1,${a},${b}],[0,1,${c}]].`, `在 R=[[1,${a},${b}],[0,1,${c}]] 中找主元列。`],
        [['Column 1 and column 2', '第 1、2 列'], ['Column 1 and column 3', '第 1、3 列'], ['Column 2 and column 3', '第 2、3 列']], 0,
        ['Pivots are the leading 1s in the nonzero rows.', '主元是非零行中的首个 1。'],
        ['The leading 1s lie in columns 1 and 2, so x₁ and x₂ are pivot variables.', '首个 1 分别在第 1、2 列，因此 x₁、x₂ 是主元变量。']),
      numberCard(d, 'free-count', ['Count the free variables.', '自由变量有几个？'], [[['Number of free variables', '自由变量数'], 1]],
        ['There are three columns and two pivots.', '有 3 列、2 个主元。'], ['Column 3 has no pivot, so x₃ is free.', '第 3 列没有主元，所以 x₃ 是自由变量。']),
      numberCard(d, 'rank-nullity', ['Give rank(R) and dim N(A).', '求 rank(R) 与 dim N(A)。'], [[['rank', '秩'], 2], [['nullity', '零空间维数'], 1]],
        ['Rank counts pivots; nullity is n − rank.', '秩是主元数；零度为 n − 秩。'], ['There are two pivots among three columns, so rank 2 and nullity 1.', '3 列中有 2 个主元，因此秩为 2、零度为 1。']),
      numberCard(d, 'special-solution', [`For R=[[1,${a},${b}],[0,1,${c}]], set x₃=1 and solve R x=0 for x₁,x₂.`, `对 R=[[1,${a},${b}],[0,1,${c}]]，令 x₃=1，解 R x=0 求 x₁、x₂。`], [['x₁', x1], ['x₂', x2]],
        [`Use x₂ + (${c})x₃ = 0, then x₁ + (${a})x₂ + (${b})x₃ = 0.`, `先用 x₂+(${c})x₃=0，再代入 x₁+(${a})x₂+(${b})x₃=0。`],
        [`The special solution is (${x1}, ${x2}, 1): x₂ = −(${c})=${x2}, then x₁ = (${a})(${c})−(${b})=${x1}.`, `特解为 (${x1},${x2},1)：x₂=−(${c})=${x2}，再得 x₁=(${a})(${c})−(${b})=${x1}。`]),
      choiceCard(d, 'nullspace-span', ['How do all solutions of A x = 0 relate to the special solution v?', 'A x = 0 的全部解与特解 v 有什么关系？'],
        [['All solutions are t v for any real t.', '所有解都是任意实数 t 乘以 v。'], ['Only v is a solution.', '只有 v 是解。'], ['Every vector in R³ is a solution.', 'R³ 中每个向量都是解。']], 0,
        ['There is one free variable.', '这里只有一个自由变量。'],
        ['One free variable gives one special solution; its scalar multiples form N(A).', '一个自由变量给出一个特解；它的所有数乘构成 N(A)。']),
      symbolsCard(d, 'pivot-free', [`For R=[[1,${a},${b}],[0,1,${c}]], classify column 1 and column 3 using pivot/free.`, `对 R=[[1,${a},${b}],[0,1,${c}]]，用 pivot（主元）或 free（自由）分类第 1、3 列。`], ['Column 1 is ', '第 1 列是 '], ['pivot', 'free'], ['pivot', 'free', 'row', 'column'],
        ['A pivot column has a leading 1.', '主元列含有首个 1。'], ['Column 1 is pivot; column 3 is free.', '第 1 列是主元列；第 3 列是自由列。'], [d.t(['; column 3 is ', '；第 3 列是 '])]),
      choiceCard(d, 'rank-bound', ['Can this 2×3 matrix have rank 3?', '这个 2×3 矩阵的秩能否为 3？'],
        [['No; rank is at most the number of rows, 2.', '不能；秩至多为行数 2。'], ['Yes; rank is always the number of columns.', '能；秩总等于列数。'], ['Only when a,b,c are nonzero.', '仅当 a、b、c 都非零。']], 0,
        ['Rank cannot exceed either matrix dimension.', '秩不能超过矩阵的任一维数。'],
        ['A 2×3 matrix has rank at most min(2,3)=2.', '2×3 矩阵的秩至多为 min(2,3)=2。']),
    ];
    const p = signed(), q = signed(), r = signed(), finalX1 = p * r - q;
    cards.push(numberCard(d, 'independent-challenge', [`Independent check: for [[1,${p},${q}],[0,1,${r}]] x=0, set x₃=1. Find x₁,x₂.`, `独立挑战：对 [[1,${p},${q}],[0,1,${r}]]x=0，令 x₃=1，求 x₁、x₂。`],
      [['x₁', finalX1], ['x₂', -r]], ['Treat this as a fresh back-substitution problem.', '把它当作新的回代题。'],
      [`From x₂ + (${r}) = 0, x₂ = ${-r}; then x₁ = (${p})(${r})−(${q}) = ${finalX1}.`, `由 x₂+(${r})=0 得 x₂=${-r}；再得 x₁=(${p})(${r})−(${q})=${finalX1}。`],
      ['No mastery claim: this round practices a few fixed elimination patterns, not proof or transfer to unfamiliar matrices.', '本轮不代表掌握：它只练习若干固定消元模式，不评估证明能力或对陌生矩阵的迁移。']));
    return cards;
  },

  'MIT-LA-08': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-08');
    const signed = () => d.random(0, 1) ? d.random(1, 3) : -d.random(1, 3);
    const a = signed(), u = signed(), v = signed(), w = u + v;
    const cards = [
      choiceCard(d, 'rref-rows', ['For A = [[1,a,0],[0,0,1],[1,a,1]], what row appears after eliminating row 3 − row 1 − row 2?', '对 A=[[1,a,0],[0,0,1],[1,a,1]]，消去第 3 行 − 第 1 行 − 第 2 行后得到哪一行？'],
        ['[0, 0, 0]', '[0, a, 0]', '[1, a, 1]'], 0,
        ['The third row of A is the sum of its first two rows.', 'A 的第 3 行等于前两行之和。'],
        ['The coefficient matrix has one dependent row, so its reduced row is zero.', '系数矩阵有一行依赖于前两行，因此对应化简行是零行。']),
      numberCard(d, 'rank-nullity', ['Find rank(A) and dim N(A).', '求 rank(A) 与 dim N(A)。'], [[['rank', '秩'], 2], [['nullity', '零度'], 1]],
        ['There are two pivot columns among three variables.', '3 个变量中有 2 个主元列。'], ['Rank is 2 and nullity is 3 − 2 = 1.', '秩为 2，零度为 3−2=1。']),
      choiceCard(d, 'consistent', ['For b = (u,v,w), when is A x = b consistent?', '当 b=(u,v,w) 时，A x=b 何时有解？'],
        [['Exactly when w = u + v.', '当且仅当 w=u+v。'], ['For every b.', '对所有 b 都有解。'], ['Exactly when u = v.', '当且仅当 u=v。']], 0,
        ['The left side of the dependent third equation is row 1 plus row 2.', '第 3 个依赖方程的左边等于前两个方程左边之和。'],
        ['The augmented zero row requires the same relation on b: w − u − v = 0.', '增广后的零行要求 b 满足同一关系：w−u−v=0。']),
      numberCard(d, 'particular', [`For A=[[1,${a},0],[0,0,1],[1,${a},1]] and b=(${u},${v},${w}), set x₂=0. Find x₁,x₃.`, `对 A=[[1,${a},0],[0,0,1],[1,${a},1]]、b=(${u},${v},${w})，令 x₂=0，求 x₁、x₃。`], [['x₁', u], ['x₃', v]],
        ['Read the first and second pivot equations.', '读取第一个和第二个主元方程。'], [`A particular solution is xₚ=(${u},0,${v}).`, `一个特解为 xₚ=(${u},0,${v})。`]),
      numberCard(d, 'null-vector', [`For A=[[1,${a},0],[0,0,1],[1,${a},1]], find a nullspace basis vector with x₂=1.`, `对 A=[[1,${a},0],[0,0,1],[1,${a},1]]，令 x₂=1，求零空间基向量。`], [['x₁', -a], ['x₃', 0]],
        [`Solve x₁+(${a})x₂=0 and x₃=0.`, `解 x₁+(${a})x₂=0 与 x₃=0。`], [`The special solution is (${-a},1,0).`, `特解为 (${-a},1,0)。`]),
      choiceCard(d, 'all-solutions', [`For A=[[1,${a},0],[0,0,1],[1,${a},1]], b=(${u},${v},${w}) and xₚ=(${u},0,${v}), which expression gives every solution?`, `对 A=[[1,${a},0],[0,0,1],[1,${a},1]]、b=(${u},${v},${w})、xₚ=(${u},0,${v})，哪个表达式给出全部解？`],
        [[`xₚ+t(${-a},1,0), any real t.`, `xₚ+t(${-a},1,0)，t 为任意实数。`], ['t xₚ only.', '只有 t xₚ。'], ['There is exactly one solution.', '恰有一个解。']], 0,
        ['Add every solution of the homogeneous equation to one particular solution.', '把齐次方程的任意解加到一个特解上。'],
        [`All solutions are xₚ+N(A); N(A)=span{(${-a},1,0)}.`, `全部解为 xₚ+N(A)；N(A)=span{(${-a},1,0)}。`]),
    ];
    const badW = w + (d.random(0, 1) ? 1 : -1);
    cards.push(choiceCard(d, 'inconsistent-check', [`Now take b=(${u},${v},${badW}). What does the last reduced row say?`, `现在取 b=(${u},${v},${badW})。最后一个化简行说明什么？`],
      [['0 = nonzero, so no solution.', '0=非零，因此无解。'], ['There is a unique solution.', '有唯一解。'], ['There are infinitely many solutions.', '有无穷多解。']], 0,
      [`The last row is [0 0 0 | ${badW}−(${u})−(${v})].`, `最后一行为 [0 0 0 | ${badW}−(${u})−(${v})]。`],
      [`The last entry ${badW}−(${u})−(${v})=${badW-w} is nonzero, so the augmented row is contradictory.`, `最后一项 ${badW}−(${u})−(${v})=${badW-w} 非零，因此增广行矛盾。`]));
    const p = signed(), q = signed(), r = signed(), z = p + q;
    cards.push(numberCard(d, 'independent-challenge', [`Independent challenge: for b=(${p},${q},${z}), set x₂=0 and give a particular solution (x₁,x₂,x₃).`, `独立挑战：对 b=(${p},${q},${z})，令 x₂=0，写出特解 (x₁,x₂,x₃)。`],
      [['x₁', p], ['x₂', 0], ['x₃', q]], ['Use the pivot equations; verify the dependent row.', '使用主元方程，并核对依赖行。'],
      [`x₁=${p} and x₃=${q}; the third right side ${z} equals (${p})+(${q}), so it is consistent.`, `x₁=${p}、x₃=${q}；第三个右端 ${z}=(${p})+(${q})，因此相容。`],
      ['This checks one exact pattern; it does not assess proof or general transfer.', '这只检查一种精确模式，不评估证明能力或一般迁移。']));
    return cards;
  },

  'MIT-LA-09': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-09');
    const signed = () => d.random(0, 1) ? d.random(1, 3) : -d.random(1, 3);
    const s = signed(), t = signed();
    const cards = [
      choiceCard(d, 'dependence', [`Let v₁=(1,0,0), v₂=(0,1,0), v₃=(${s},${t},0). Are these independent?`, `设 v₁=(1,0,0)、v₂=(0,1,0)、v₃=(${s},${t},0)。它们线性无关吗？`],
        [['No: v₃ = s v₁ + t v₂.', '否：v₃=s v₁+t v₂。'], ['Yes: all have different coordinates.', '是：坐标都不同。'], ['Only if s=t.', '仅当 s=t。']], 0,
        ['Try expressing v₃ as a combination of the first two.', '尝试用前两个向量表示 v₃。'],
        [`v₃ = ${s}v₁ + ${t}v₂, so the three vectors are dependent.`, `v₃=${s}v₁+${t}v₂，因此三个向量相关。`]),
      numberCard(d, 'rank', [`For v₁=(1,0,0), v₂=(0,1,0), v₃=(${s},${t},0), find dim span{v₁,v₂,v₃}.`, `对 v₁=(1,0,0)、v₂=(0,1,0)、v₃=(${s},${t},0)，求 span{v₁,v₂,v₃} 的维数。`], [[['Dimension', '维数'], 2]],
        ['The first two vectors are independent and v₃ adds no new direction.', '前两个向量无关，v₃ 没有增加新方向。'], ['The span is the xy-plane, so its dimension is 2.', '张成空间是 xy 平面，维数为 2。']),
      numberCard(d, 'coordinates', [`For v₁=(1,0,0), v₂=(0,1,0), v₃=(${s},${t},0), solve v₃=αv₁+βv₂.`, `对 v₁=(1,0,0)、v₂=(0,1,0)、v₃=(${s},${t},0)，解 v₃=αv₁+βv₂。`], [['α', s], ['β', t]],
        ['Match the first and second coordinates.', '分别匹配第一、第二个坐标。'], [`The coordinates are α=${s}, β=${t}.`, `坐标为 α=${s}、β=${t}。`]),
      choiceCard(d, 'basis', [`For v₁=(1,0,0), v₂=(0,1,0), v₃=(${s},${t},0), which is a basis for their span?`, `对 v₁=(1,0,0)、v₂=(0,1,0)、v₃=(${s},${t},0)，哪一组是其张成空间的基？`],
        ['{v₁,v₂}', '{v₁,v₂,v₃}', '{v₃}'], 0,
        ['A basis must span and be independent.', '基必须张成该空间且线性无关。'], ['v₁ and v₂ span the plane and are independent.', 'v₁、v₂ 张成该平面且线性无关。']),
      choiceCard(d, 'basis-test', ['Which condition makes a list of n vectors a basis of an n-dimensional space?', 'n 维空间中的 n 个向量何时构成一组基？'],
        [['They are independent (equivalently, they span).', '它们线性无关（等价地，它们张成空间）。'], ['Every vector has length 1.', '每个向量长度为 1。'], ['All coordinates are positive.', '所有坐标为正。']], 0,
        ['For exactly n vectors in an n-dimensional space, independence and spanning are equivalent.', '在 n 维空间中，恰有 n 个向量时，线性无关与张成等价。'],
        ['This equivalence depends on the finite-dimensional, equal-count setting.', '该等价依赖有限维且向量个数等于维数。']),
      choiceCard(d, 'counterexample', ['Three vectors in R²: can they be independent?', 'R² 中的三个向量能否线性无关？'],
        [['No; at most two can be independent.', '不能；至多两个线性无关。'], ['Yes, if all are nonzero.', '可以，只要都非零。'], ['Yes, if they span R².', '可以，只要张成 R²。']], 0,
        ['The dimension of R² is 2.', 'R² 的维数是 2。'], ['More than dim(V) vectors must be dependent; spanning does not imply independence.', '向量数超过 dim(V) 必相关；张成并不意味着无关。']),
      numberCard(d, 'poly-dimension', ['What is dim(P₂), the polynomials of degree at most 2?', '次数至多为 2 的多项式空间 P₂ 的维数是多少？'], [[['Dimension', '维数'], 3]],
        ['Use the basis {1,x,x²}.', '使用基 {1,x,x²}。'], ['There are three independent basis polynomials, so dim(P₂)=3.', '有三个线性无关的基多项式，因此 dim(P₂)=3。']),
    ];
    const p = signed(), q = signed();
    cards.push(numberCard(d, 'independent-challenge', [`Independent challenge: w₁=(1,0,0), w₂=(0,1,0), w₃=(${p},${q},0). Find coefficients and the span dimension.`, `独立挑战：w₁=(1,0,0)、w₂=(0,1,0)、w₃=(${p},${q},0)。求表示系数及张成空间维数。`],
      [[['coefficient of w₁', 'w₁ 的系数'], p], [['coefficient of w₂', 'w₂ 的系数'], q], [['Span dimension', '张成空间维数'], 2]],
      ['Read the first two coordinates; all three vectors lie in z=0.', '读取前两个坐标；三个向量都位于 z=0 平面。'],
      [`w₃ = ${p}w₁ + ${q}w₂, so the span is the two-dimensional xy-plane.`, `w₃=${p}w₁+${q}w₂，因此张成空间是二维 xy 平面。`],
      ['Correct answers on these templates do not establish proof ability or transfer.', '在这些题型上答对不代表具备证明能力或迁移能力。']));
    return cards;
  },

  'MIT-LA-10': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-10');
    const a = d.random(1, 3) * (d.random(0, 1) ? 1 : -1);
    const cards = [
      numberCard(d, 'rank-dimensions', [`For A=[[1,${a},0],[0,0,0],[0,0,1]], give rank, dim C(A), dim N(A), dim C(Aᵀ), dim N(Aᵀ).`, `对 A=[[1,${a},0],[0,0,0],[0,0,1]]，依次求 rank、dim C(A)、dim N(A)、dim C(Aᵀ)、dim N(Aᵀ)。`],
        [[['rank', '秩'], 2], [['dim C(A)', '列空间维数'], 2], [['dim N(A)', '零空间维数'], 1], [['dim C(Aᵀ)', '行空间维数'], 2], [['dim N(Aᵀ)', '左零空间维数'], 1]],
        ['Use r=2, n=3, m=3; the four dimensions are r, n−r, r, m−r.', '用 r=2、n=3、m=3；四个维数依次为 r、n−r、r、m−r。'],
        ['The column and row spaces have dimension 2; the nullspaces each have dimension 1.', '列空间和行空间维数为 2；两个零空间的维数均为 1。']),
      numberCard(d, 'column-basis', ['Give the two entries after the leading 1 in the pivot columns of A (columns 1 and 3).', '给出 A 的主元列（第 1、3 列）中首项 1 之后的两个分量。'], [[['column 1, row 2', '第 1 列第 2 行'], 0], [['column 3, row 2', '第 3 列第 2 行'], 0]],
        ['The pivot columns of the original A form a basis for C(A).', '原矩阵 A 的主元列构成 C(A) 的一组基。'], ['The actual basis columns are (1,0,0) and (0,0,1).', '实际基列为 (1,0,0) 与 (0,0,1)。']),
      numberCard(d, 'row-basis', [`For A=[[1,${a},0],[0,0,0],[0,0,1]], give the middle coordinates of row-space basis rows (1,a,0) and (0,0,1).`, `对 A=[[1,${a},0],[0,0,0],[0,0,1]]，给出行空间基向量 (1,a,0) 与 (0,0,1) 的中间坐标。`], [[['first row middle entry', '第一行中间项'], a], [['second row middle entry', '第二行中间项'], 0]],
        ['The nonzero rows of R give a basis for the row space.', 'R 的非零行构成行空间的一组基。'], ['These two rows are independent and span the original row space.', '这两行线性无关，并张成原矩阵的行空间。']),
      numberCard(d, 'null-basis', [`For A=[[1,${a},0],[0,0,0],[0,0,1]], find the N(A) basis vector with x₂=1.`, `对 A=[[1,${a},0],[0,0,0],[0,0,1]]，令 x₂=1，求 N(A) 的基向量。`], [['x₁', -a], ['x₃', 0]],
        ['Solve x₁+a x₂=0 and x₃=0.', '解 x₁+a x₂=0 与 x₃=0。'], ['A basis for N(A) is (−a,1,0).', 'N(A) 的一组基为 (−a,1,0)。']),
      numberCard(d, 'left-null-basis', ['Give the basis vector of N(Aᵀ) with second coordinate 1.', '令第二坐标为 1，给出 N(Aᵀ) 的基向量。'], [[['first coordinate', '第一坐标'], 0], [['third coordinate', '第三坐标'], 0]],
        ['The middle row of A is zero, so the corresponding coordinate vector is orthogonal to every column.', 'A 的中间行为零，因此对应坐标向量与每一列正交。'], ['N(Aᵀ) is spanned by (0,1,0).', 'N(Aᵀ) 由 (0,1,0) 张成。']),
      choiceCard(d, 'orthogonality', ['Which spaces are orthogonal complements in their ambient spaces?', '在各自环境空间中，哪两组空间互为正交补？'],
        [['C(Aᵀ) ⟂ N(A), and C(A) ⟂ N(Aᵀ).', 'C(Aᵀ) ⟂ N(A)，且 C(A) ⟂ N(Aᵀ)。'], ['C(A) ⟂ N(A), always.', 'C(A) 总与 N(A) 正交。'], ['All four spaces are the same.', '四个空间都相同。']], 0,
        ['Vectors in N(A) are orthogonal to every row of A.', 'N(A) 中的向量与 A 的每一行正交。'],
        ['The row space is N(A)⊥ in Rⁿ; the column space is N(Aᵀ)⊥ in Rᵐ.', 'Rⁿ 中行空间是 N(A) 的正交补；Rᵐ 中列空间是 N(Aᵀ) 的正交补。']),
      choiceCard(d, 'column-row-reduction', ['When row operations turn A into R, which fundamental space is guaranteed to stay the same?', '对 A 做行变换得到 R 时，哪个基本子空间一定保持不变？'],
        [['Row space', '行空间'], ['Column space', '列空间'], ['Nullspace of Aᵀ', 'Aᵀ 的零空间']], 0,
        ['Row operations replace rows by combinations of rows.', '行变换用行的线性组合替换原行。'],
        ['Row operations preserve the row space and solution set of A x=0, but generally change the column space.', '行变换保持行空间和 A x=0 的解集，但通常会改变列空间。']),
    ];
    const b = d.random(1, 3) * (d.random(0, 1) ? 1 : -1);
    cards.push(numberCard(d, 'independent-challenge', [`Independent challenge: for A=[[1,${b},0],[0,0,0],[0,0,1]], find the nullspace vector with x₂=1 and left-nullspace vector with y₂=1.`, `独立挑战：对 A=[[1,${b},0],[0,0,0],[0,0,1]]，求 x₂=1 的零空间向量及 y₂=1 的左零空间向量。`],
      [[['null vector x₁', '零空间向量 x₁'], -b], [['null vector x₃', '零空间向量 x₃'], 0], [['left vector y₁', '左零空间向量 y₁'], 0], [['left vector y₃', '左零空间向量 y₃'], 0]],
      ['Solve A x=0; the zero row still identifies the left-nullspace direction.', '解 A x=0；零行仍确定左零空间方向。'],
      [`The bases are (${-b},1,0) and (0,1,0).`, `两组基向量分别为 (${-b},1,0) 与 (0,1,0)。`],
      ['This checks bases for one structured matrix, not every possible subspace computation.', '这只检查一种结构矩阵的基，不代表会求任意子空间。']));
    return cards;
  },

  'MIT-LA-11': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-11');
    const p = d.random(1, 3), q = d.random(1, 3), k = d.random(1, 3);
    const cards = [
      numberCard(d, 'matrix-space-dim', ['What is the dimension of the vector space M₂×₂ of all 2×2 matrices?', '所有 2×2 矩阵构成的向量空间 M₂×₂ 的维数是多少？'], [[['Dimension', '维数'], 4]],
        ['One independent coordinate is needed for each entry.', '每个矩阵元素对应一个独立坐标。'], ['The four standard matrices E₁₁,E₁₂,E₂₁,E₂₂ form a basis.', '四个标准矩阵 E₁₁、E₁₂、E₂₁、E₂₂ 构成一组基。']),
      choiceCard(d, 'matrix-subspace', ['Which set is a subspace of M₂×₂?', '哪一个集合是 M₂×₂ 的子空间？'],
        [['All symmetric 2×2 matrices.', '所有对称 2×2 矩阵。'], ['All invertible 2×2 matrices.', '所有可逆 2×2 矩阵。'], ['All matrices with determinant 1.', '所有行列式为 1 的矩阵。']], 0,
        ['A subspace must contain zero and be closed under addition and scalar multiplication.', '子空间必须包含零矩阵，并对加法、数乘封闭。'],
        ['Symmetric matrices satisfy a linear condition; invertible matrices exclude zero and are not a subspace.', '对称矩阵满足线性条件；可逆矩阵不含零矩阵，因此不是子空间。']),
      numberCard(d, 'outer-product', [`Let u=(1,${p}) and v=(${q},1). Compute the four entries of u vᵀ in row order.`, `设 u=(1,${p})、v=(${q},1)，按行顺序求 u vᵀ 的四个元素。`], [[['(1,1)', '左上'], q], [['(1,2)', '右上'], 1], [['(2,1)', '左下'], p * q], [['(2,2)', '右下'], p]],
        ['Multiply each entry of u by each entry of v.', '用 u 的每个分量分别乘 v 的每个分量。'], [`The outer product is [[${q},1],[${p*q},${p}]].`, `外积为 [[${q},1],[${p*q},${p}]]。`]),
      numberCard(d, 'rank-one', [`What is the rank of the nonzero matrix [[${q},1],[${p * q},${p}]]?`, `非零矩阵 [[${q},1],[${p * q},${p}]] 的秩是多少？`], [[['Rank', '秩'], 1]],
        ['Every column is a multiple of u.', '每一列都是 u 的倍数。'], ['A nonzero outer product has rank 1.', '非零外积的秩为 1。']),
      numberCard(d, 'det-check', [`For M=[[${k},${2 * k}],[3,6]], compute det(M).`, `对 M=[[${k},${2 * k}],[3,6]]，求 det(M)。`], [[['Determinant', '行列式'], 0]],
        ['The second column is twice the first.', '第 2 列是第 1 列的两倍。'], ['Dependent columns imply determinant 0 and rank at most 1.', '列相关意味着行列式为 0、秩至多为 1。']),
      choiceCard(d, 'small-world', ['A four-node cycle gets one added edge joining opposite nodes 1 and 3. What is the shortest-path distance from 1 to 3?', '给四节点环添加连接对角节点 1 和 3 的一条边。1 到 3 的最短路径距离是多少？'],
        [['1 edge', '1 条边'], ['2 edges', '2 条边'], ['3 edges', '3 条边']], 0,
        ['The added edge directly joins the two nodes.', '新增边直接连接这两个节点。'],
        ['The shortcut lowers graph distance; small-world networks combine short paths with local clustering.', '捷径缩短图距离；小世界网络兼具短路径与局部聚集。']),
      numberCard(d, 'degree', ['In that graph, what is the degree of node 1 after adding edge 1–3?', '在该图中加入边 1–3 后，节点 1 的度是多少？'], [[['Degree', '度'], 3]],
        ['Count its two cycle neighbors and the new opposite node.', '数出环上的两个邻居和新增的对角邻居。'], ['Node 1 is adjacent to 2, 4, and 3, so its degree is 3.', '节点 1 与 2、4、3 相邻，因此度为 3。']),
    ];
    const r = d.random(1, 3), s = d.random(1, 3), mult = d.random(1, 3);
    cards.push(numberCard(d, 'independent-challenge', [`Independent challenge: M=[[${r},${s}],[${mult * r},${mult * s}]]. Give its rank and determinant.`, `独立挑战：M=[[${r},${s}],[${mult * r},${mult * s}]]。求秩与行列式。`],
      [[['Rank', '秩'], 1], [['Determinant', '行列式'], 0]], ['The second row is mult times the first; r and s are nonzero.', '第 2 行是第 1 行的 mult 倍；r、s 非零。'],
      ['There is one independent nonzero row, and the rows are dependent, so rank 1 and determinant 0.', '有一行非零且行相关，因此秩为 1、行列式为 0。'],
      ['This samples matrix spaces and one shortcut graph; it does not assess broader network science.', '本轮抽查矩阵空间和一种捷径图，不评估更广泛的网络科学。']));
    return cards;
  },

  'MIT-LA-12': (seed, lang) => {
    const d = makeDeck(seed, lang, 'MIT-LA-12');
    // Columns are oriented edges 1→2, 2→3, 3→1; tail = −1, head = +1.
    const f = d.random(1, 3), g = d.random(1, 3), h = d.random(1, 3);
    const P = d.random(-2, 2), Q = d.random(-2, 2), R = d.random(-2, 2);
    const cards = [
      choiceCard(d, 'convention', ['Convention: each incidence-matrix column represents a directed edge, with −1 at its tail and +1 at its head. For edge 1→2, what is the column?', '约定：关联矩阵每列表示一条有向边，尾端记 −1、头端记 +1。边 1→2 对应哪一列？'],
        ['(−1,+1,0)ᵀ', '(+1,−1,0)ᵀ', '(0,−1,+1)ᵀ'], 0,
        ['Rows are nodes 1,2,3 in order.', '行按节点 1、2、3 排列。'], ['The tail node 1 gets −1; the head node 2 gets +1.', '尾节点 1 记 −1；头节点 2 记 +1。']),
      numberCard(d, 'incidence-rank', ['For the triangle with directed edges 1→2, 2→3, 3→1 and incidence columns −1 at tails/+1 at heads, what is rank(B)?', '对方向为 1→2、2→3、3→1 的三角形，关联矩阵各列在尾端记 −1、头端记 +1。求 rank(B)。'], [[['Rank', '秩'], 2]],
        ['For a connected graph, incidence rank is nodes − 1.', '连通图的关联矩阵秩为节点数减 1。'], ['There are 3 nodes, so rank(B)=3−1=2.', '有 3 个节点，因此 rank(B)=3−1=2。']),
      numberCard(d, 'cycle-count', ['For the connected triangle with directed edges 1→2, 2→3, 3→1 (tail −1/head +1 columns), 3 nodes and 3 edges, how many independent cycles are there?', '对方向为 1→2、2→3、3→1 的连通三角形（关联列尾端 −1、头端 +1），有 3 个节点、3 条边。有几个独立环？'], [[['Independent cycles', '独立环数'], 1]],
        ['Use edges − (nodes − 1).', '使用 边数−(节点数−1)。'], ['There is 3−(3−1)=1 independent cycle; a spanning tree uses two edges.', '有 3−(3−1)=1 个独立环；生成树使用两条边。']),
      numberCard(d, 'node-balance', [`For edge columns 1→2, 2→3, 3→1 with −1 at tail/+1 at head, flows are (${f},${g},${h}). Compute Bf (net inflows).`, `边列方向为 1→2、2→3、3→1，尾端 −1、头端 +1，流量为 (${f},${g},${h})。求 Bf（净流入）。`], [[['node 1', '节点 1'], h - f], [['node 2', '节点 2'], f - g], [['node 3', '节点 3'], g - h]],
        ['Each edge contributes −flow at its tail and +flow at its head.', '每条边在尾端贡献 −流量，在头端贡献 +流量。'], ['Bf = (−f+h, f−g, g−h); the entries sum to zero.', 'Bf=(−f+h,f−g,g−h)；三项之和为零。']),
      numberCard(d, 'cycle-flow', ['For edges 1→2, 2→3, 3→1 (tail −1, head +1), set f=g=1. Find h so B(f,g,h)=0.', '边方向为 1→2、2→3、3→1（尾端 −1、头端 +1），令 f=g=1，求 h 使 B(f,g,h)=0。'], [['h', 1]],
        ['At node 2, inflow f must equal outflow g; at node 1, h must equal f.', '节点 2 处流入 f 应等于流出 g；节点 1 处 h 应等于 f。'], ['The cycle flow (1,1,1) lies in N(B).', '环流向量 (1,1,1) 属于 N(B)。']),
      choiceCard(d, 'kirchhoff', ['For oriented edges 1→2, 2→3, 3→1 with tail −1/head +1, Bf=0 states which law?', '对方向为 1→2、2→3、3→1 且尾端 −1、头端 +1 的边，Bf=0 表示哪条定律？'],
        [['Kirchhoff current law: net inflow is zero at every node.', '基尔霍夫电流定律：每个节点净流入为零。'], ['Every edge has zero flow.', '每条边流量都为零。'], ['All node potentials are equal.', '所有节点电势相等。']], 0,
        ['Bf lists net inflow at each node.', 'Bf 列出每个节点的净流入。'], ['Zero net inflow at each node is Kirchhoff’s current law.', '每个节点净流入为零就是基尔霍夫电流定律。']),
      numberCard(d, 'potential-drops', [`With incidence columns oriented 1→2, 2→3, 3→1 and tail −1/head +1, node potentials are (${P},${Q},${R}). Compute Bᵀp.`, `关联矩阵列方向为 1→2、2→3、3→1，尾端 −1、头端 +1；节点电势为 (${P},${Q},${R})。求 Bᵀp。`], [[['edge 1→2', '边 1→2'], Q - P], [['edge 2→3', '边 2→3'], R - Q], [['edge 3→1', '边 3→1'], P - R]],
        ['Each entry is potential at the head minus potential at the tail.', '每一项等于头端电势减尾端电势。'], ['The drops are Q−P, R−Q, and P−R; around the cycle they sum to zero.', '电势差为 Q−P、R−Q、P−R；绕环相加为零。']),
      choiceCard(d, 'injection-compatibility', ['For the oriented triangle 1→2, 2→3, 3→1 with tail −1/head +1, Bf=q. What must be true of q?', '对方向为 1→2、2→3、3→1 且尾端 −1、头端 +1 的三角形，Bf=q。q 必须满足什么条件？'],
        [['The entries of q sum to zero.', 'q 的各分量之和为零。'], ['Every entry of q is positive.', 'q 的每个分量都为正。'], ['q has three independent entries.', 'q 有三个独立分量。']], 0,
        ['Every column of B sums to zero.', 'B 的每一列元素和都为零。'], ['Summing Bf=q over nodes gives 0=sum(q), so total injection must equal total withdrawal.', '对 Bf=q 的各行求和得 0=sum(q)，所以总注入必须等于总流出。']),
    ];
    const x = d.random(1, 3), y = d.random(1, 3), z = d.random(1, 3);
    cards.push(numberCard(d, 'independent-challenge', [`Independent challenge: with edges 1→2, 2→3, 3→1 and tail −1/head +1, edge flows are (${x},${y},${z}). Compute node net inflows and their sum.`, `独立挑战：边方向为 1→2、2→3、3→1，尾端 −1、头端 +1，边流量为 (${x},${y},${z})。求各节点净流入及其总和。`],
      [[['node 1', '节点 1'], z - x], [['node 2', '节点 2'], x - y], [['node 3', '节点 3'], y - z], [['sum', '总和'], 0]],
      ['Use tail −1/head +1 for each of the three oriented edges.', '对三条有向边都使用尾端 −1、头端 +1。'],
      [`The vector is (${z - x}, ${x - y}, ${y - z}); its entries telescope to 0.`, `向量为 (${z - x}, ${x - y}, ${y - z})；各分量相消后总和为 0。`],
      ['This practices incidence signs and conservation on one graph; it does not assess full circuit analysis.', '本轮练习一种图上的关联矩阵符号与守恒关系，不评估完整电路分析能力。']));
    return cards;
  },
};

