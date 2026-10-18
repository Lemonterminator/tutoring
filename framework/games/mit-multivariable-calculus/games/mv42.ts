import type { CardGenerator } from '../../types';
import { arrowField, fitView, type FigureShape, type Pt } from '../../figure';
import { coef, makeMvDeck, num, par, type Text } from '../support';

type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

export const mv42: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-42');
  warm(g);

  // definition
  const def = retry(() => ({
    p: g.random(1, 6), q: g.random(1, 6), r: g.random(1, 6), s: g.random(1, 6)
  }), v => {
    if (v.q === v.r) return false;
    const vals = [v.r - v.q, v.q - v.r, v.r + v.q, v.s - v.p];
    return new Set(vals.map(x => x.toString())).size === 4;
  });
  const defAnswer = def.r - def.q;

  // scalar-k
  const truePool = [
    { id: 'T1', en: 'The curl is a scalar-valued function: it gives one number at each point (x, y).', zh: '旋度是标量值函数：它在每个点 (x, y) 给出一个数。' },
    { id: 'T2', en: 'The two-dimensional curl is defined only for vector fields in the plane.', zh: '二维旋度只对平面向量场有定义。' },
    { id: 'T3', en: 'The two-dimensional curl is the k-component of the three-dimensional curl.', zh: '二维旋度就是三维旋度的 k 分量。' }
  ];
  const falsePool = [
    { id: 'F1', en: 'The curl is a vector with components (M_y, N_x).', zh: '旋度是以 (M_y, N_x) 为分量的向量。' },
    { id: 'F2', en: 'For a field F = (M, N, P) in space, N_x − M_y is the complete curl.', zh: '对空间中的场 F = (M, N, P)，N_x − M_y 就是完整的旋度。' },
    { id: 'F3', en: 'The two-dimensional curl is the i-component of the three-dimensional curl.', zh: '二维旋度是三维旋度的 i 分量。' },
    { id: 'F4', en: 'For every plane field, the curl has the same value at every point.', zh: '对每个平面场，旋度在每一点都取同一个值。' }
  ];
  const trueIdx = g.random(0, 2);
  const falseIdxs = shuffled(g, [0, 1, 2, 3]).slice(0, 3);
  const scalarOptions = [
    t(truePool[trueIdx].en, truePool[trueIdx].zh),
    t(falsePool[falseIdxs[0]].en, falsePool[falseIdxs[0]].zh),
    t(falsePool[falseIdxs[1]].en, falsePool[falseIdxs[1]].zh),
    t(falsePool[falseIdxs[2]].en, falsePool[falseIdxs[2]].zh)
  ];
  const scalarCorrect = 0;

  // notes-example
  const ne = retry(() => ({
    a: g.random(1, 3), b: g.random(2, 9), x0: g.random(1, 3), y0: g.random(1, 3)
  }), v => v.b !== 2 * v.a * v.x0 * v.y0);
  const neAnswer = ne.b - 2 * ne.a * ne.x0 * ne.y0;
  const neM = coef(ne.a, 'xy²');
  const neN = coef(ne.b, 'x');

  // rotation-field
  const rfW = g.random(2, 7);
  const rfAns1 = coef(-rfW, 'y');
  const rfAns2 = coef(rfW, 'x');
  const rfTokens = shuffled(g, [rfAns1, rfAns2, coef(rfW, 'y'), coef(-rfW, 'x'), 'x', 'y']);

  // rotation-curl
  const rcW = g.random(2, 9);
  const rcAnswer = 2 * rcW;
  const rcM = coef(-rcW, 'y');
  const rcN = coef(rcW, 'x');
  const ccwShapes: FigureShape[] = arrowField((x: number, y: number): Pt => x === 0 && y === 0 ? [0, 0] : [-y, x], [-2, -1, 1, 2], [-2, -1, 1, 2], 0.5);

  // sign-check
  const scW = g.random(2, 9);
  const scM = coef(scW, 'y');
  const scN = coef(-scW, 'x');
  const cwShapes: FigureShape[] = arrowField((x: number, y: number): Pt => x === 0 && y === 0 ? [0, 0] : [y, -x], [-2, -1, 1, 2], [-2, -1, 1, 2], 0.5);

  // undefined-point
  const upW = g.random(2, 4);
  const upK = g.random(1, 4);
  const upSingular = g.pick([
    { M: 'y/x', N: 'x/y' },
    { M: `${coef(2, 'y')}/x`, N: 'x' },
    { M: `${coef(3, 'y')}/x`, N: 'x' }
  ]);
  const upRegular = { M: coef(-upW, 'y'), N: coef(upW, 'x') };
  const upFlip = g.random(0, 1) === 0;
  const upA = upFlip ? upRegular : upSingular;
  const upB = upFlip ? upSingular : upRegular;
  const upCorrectIdx = upFlip ? 0 : 1;

  // challenge
  const ch = retry(() => ({
    u: g.random(1, 5), v: g.random(1, 5), w: g.random(2, 4), c: g.random(1, 3),
    x0: g.pick([-2, -1, 1, 2, 3]), y0: g.random(1, 3)
  }), v => v.w + v.c * v.x0 !== 0);
  const chAnswer = 2 * ch.w + 2 * ch.c * ch.x0;
  const chM = `${ch.u} − ${coef(ch.w, 'y')}`;
  const chN = `${ch.v} + ${coef(ch.w, 'x')} + ${coef(ch.c, 'x²')}`;

  return [
    g.choice({
      id: 'definition',
      title: t('Definition of curl', '旋度的定义'),
      prompt: t(
        `At a point P, the partial derivatives of F = (M, N) are M_x = ${def.p}, M_y = ${def.q}, N_x = ${def.r}, N_y = ${def.s}. What is the two-dimensional curl of F at P?`,
        `在点 P 处，F = (M, N) 的偏导数为 M_x = ${def.p}，M_y = ${def.q}，N_x = ${def.r}，N_y = ${def.s}。F 在 P 处的二维旋度是多少？`
      ),
      options: [
        num(defAnswer),
        num(def.q - def.r),
        num(def.r + def.q),
        num(def.s - def.p)
      ],
      correct: 0,
      hint: t('The curl of F = (M, N) is N_x − M_y. Which two of the four numbers are N_x and M_y?', 'F = (M, N) 的旋度是 N_x − M_y。四个数中哪两个是 N_x 和 M_y？'),
      explanation: t(
        `curl F = N_x − M_y = ${def.r} − ${def.q} = ${num(defAnswer)}. Reversing the order gives ${num(def.q - def.r)}, adding gives ${num(def.r + def.q)}, and ${def.s} − ${def.p} = ${num(def.s - def.p)} uses M_x and N_y, which are not part of the curl.`,
        `curl F = N_x − M_y = ${def.r} − ${def.q} = ${num(defAnswer)}。颠倒次序得 ${num(def.q - def.r)}，相加得 ${num(def.r + def.q)}，而 ${def.s} − ${def.p} = ${num(def.s - def.p)} 用到了 M_x 和 N_y，它们不属于旋度。`
      ),
      audit: { kind: 'MIT-MV-42:definition', params: { p: def.p, q: def.q, r: def.r, s: def.s } }
    }),
    g.choice({
      id: 'scalar-k',
      title: t('Properties of curl', '旋度的性质'),
      prompt: t('Which statement about the two-dimensional curl N_x − M_y of a vector field F = (M, N) is true?', '关于向量场 F = (M, N) 的二维旋度 N_x − M_y，下列哪个说法正确？'),
      options: scalarOptions,
      correct: scalarCorrect,
      hint: t('Think about what the formula N_x − M_y produces for one point: a vector or a single number? And which fields have components M and N only?', '想想公式 N_x − M_y 在一个点上给出什么：向量还是单个数？哪些场只有 M 和 N 两个分量？'),
      explanation: t(
        `The two-dimensional curl N_x − M_y is a single number at each point, so it is a scalar-valued function; it is defined only for fields in the plane and it is the k-component of the three-dimensional curl. For F = x³y² i + x j it equals 1 − 2x³y, which changes from point to point.`,
        `二维旋度 N_x − M_y 在每个点上是一个数，所以它是标量值函数；它只对平面上的场有定义，并且是三维旋度的 k 分量。例如对 F = x³y² i + x j，旋度为 1 − 2x³y，随点的位置而变化。`
      )
    }),
    g.number({
      id: 'notes-example',
      title: t('Curl of a polynomial field', '多项式场的旋度'),
      prompt: t(`F = (${neM}, ${neN}). Compute the two-dimensional curl of F at the point (${num(ne.x0)}, ${num(ne.y0)}).`, `F = (${neM}, ${neN})。求 F 在点 (${num(ne.x0)}, ${num(ne.y0)}) 处的二维旋度。`),
      fields: [{ label: t('curl F', 'curl F'), answer: neAnswer }],
      hint: t(`curl F = N_x − M_y. The first component ${neM} depends on both x and y: differentiate it with respect to y.`, `curl F = N_x − M_y。第一个分量 ${neM} 同时依赖 x 和 y：把它对 y 求偏导。`),
      explanation: t(
        `M = ${neM} so M_y = ${coef(2 * ne.a, 'xy')} = ${2 * ne.a * ne.x0 * ne.y0} at (${num(ne.x0)}, ${num(ne.y0)}); N = ${neN} so N_x = ${ne.b}. curl F = ${ne.b} − ${2 * ne.a * ne.x0 * ne.y0} = ${num(neAnswer)}.`,
        `M = ${neM}，所以 M_y = ${coef(2 * ne.a, 'xy')}，在 (${num(ne.x0)}, ${num(ne.y0)}) 处等于 ${2 * ne.a * ne.x0 * ne.y0}；N = ${neN}，所以 N_x = ${ne.b}。旋度 = ${ne.b} − ${2 * ne.a * ne.x0 * ne.y0} = ${num(neAnswer)}。`
      ),
      audit: { kind: 'MIT-MV-42:notes-example', params: { a: ne.a, b: ne.b, x0: ne.x0, y0: ne.y0 } }
    }),
    g.symbols({
      id: 'rotation-field',
      title: t('Velocity field of rotation', '旋转的速度场'),
      prompt: t(`A flat arrangement of particles moves counterclockwise in circles about the origin with constant angular speed ${rfW}. F(x, y) is the velocity of the particle at the point (x, y). Fill in F.`, `一片平面上的粒子绕原点作逆时针圆周运动，角速度恒为 ${rfW}。F(x, y) 是位于点 (x, y) 的粒子的速度。填写 F。`),
      before: 'F(x, y) = (',
      between: [', '],
      after: ')',
      answers: [rfAns1, rfAns2],
      tokens: rfTokens,
      figure: g.figure({
        alt: t('Arrows circulate counterclockwise around the origin.', '箭头绕原点逆时针旋转。'),
        view: fitView(ccwShapes, 0.25),
        shapes: ccwShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true }
      }),
      hint: t('At the point (1, 0) a counterclockwise particle moves straight up. Its speed is the angular speed times the distance from the origin.', '在点 (1, 0) 处，逆时针运动的粒子竖直向上运动，速度大小等于角速度乘以到原点的距离。'),
      explanation: t(
        `A particle with position (r cos θ, r sin θ) and θ = θ₀ + ${rfW}t has velocity (−${rfW}r sin θ, ${rfW}r cos θ) = (−${rfW}y, ${rfW}x). The tokens ${coef(rfW, 'y')} and ${coef(-rfW, 'x')} would give the clockwise field; x and y alone have the wrong size.`,
        `位置为 (r cos θ, r sin θ)、θ = θ₀ + ${rfW}t 的粒子，速度为 (−${rfW}r sin θ, ${rfW}r cos θ) = (−${rfW}y, ${rfW}x)。令牌 ${coef(rfW, 'y')} 与 ${coef(-rfW, 'x')} 对应顺时针的场；单独的 x 和 y 大小不对。`
      )
    }),
    g.number({
      id: 'rotation-curl',
      title: t('Curl of a rotation field', '旋转场的旋度'),
      prompt: t(`F = (${rcM}, ${rcN}) is the velocity field of particles moving counterclockwise about the origin. Compute its two-dimensional curl.`, `F = (${rcM}, ${rcN}) 是绕原点作逆时针运动的粒子的速度场。求它的二维旋度。`),
      fields: [{ label: t('curl F', 'curl F'), answer: rcAnswer }],
      figure: g.figure({
        alt: t('Arrows circulate counterclockwise around the origin.', '箭头绕原点逆时针旋转。'),
        view: fitView(ccwShapes, 0.25),
        shapes: ccwShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true }
      }),
      hint: t(`M = ${rcM} depends on y only and N = ${rcN} on x only. Find M_y and N_x, then subtract.`, `M = ${rcM} 只依赖 y，N = ${rcN} 只依赖 x。求出 M_y 与 N_x，再相减。`),
      explanation: t(
        `M_y = ${num(-rcW)} and N_x = ${num(rcW)}, so curl F = ${num(rcW)} − ${par(-rcW)} = ${num(rcAnswer)}: twice the angular speed, as in the notes.`,
        `M_y = ${num(-rcW)}，N_x = ${num(rcW)}，所以 curl F = ${num(rcW)} − ${par(-rcW)} = ${num(rcAnswer)}：等于角速度的两倍，与讲义一致。`
      ),
      audit: { kind: 'MIT-MV-42:rotation-curl', params: { w: rcW } }
    }),
    g.choice({
      id: 'sign-check',
      title: t('Curl of clockwise rotation', '顺时针旋转的旋度'),
      prompt: t(`F = (${scM}, ${scN}) is the velocity field of particles moving clockwise about the origin. What is its two-dimensional curl?`, `F = (${scM}, ${scN}) 是绕原点作顺时针运动的粒子的速度场。它的二维旋度是多少？`),
      options: [num(-2 * scW), num(2 * scW), num(-scW), '0'],
      correct: 0,
      figure: g.figure({
        alt: t('Arrows circulate clockwise around the origin.', '箭头绕原点顺时针旋转。'),
        view: fitView(cwShapes, 0.25),
        shapes: cwShapes,
        axes: { xLabel: 'x', yLabel: 'y', grid: true }
      }),
      hint: t(`Compare with the counterclockwise field (−${scW}y, ${scW}x): which signs change, and what does that do to N_x − M_y?`, `与逆时针的场 (−${scW}y, ${scW}x) 比较：哪些符号变了？这会让 N_x − M_y 怎样变化？`),
      explanation: t(
        `M = ${scM} gives M_y = ${scW}; N = ${scN} gives N_x = ${num(-scW)}. curl F = ${num(-scW)} − ${scW} = ${num(-2 * scW)}. Reversing the direction of rotation reverses the sign of the curl: counterclockwise gives +2·${scW}. Using only one term gives ${num(-scW)}; letting the terms cancel gives 0.`,
        `M = ${scM} 给出 M_y = ${scW}；N = ${scN} 给出 N_x = ${num(-scW)}。curl F = ${num(-scW)} − ${scW} = ${num(-2 * scW)}。旋转方向反过来，旋度符号也反过来：逆时针给出 +2·${scW}。只取一项得 ${num(-scW)}；让两项抵消得 0。`
      )
    }),
    g.choice({
      id: 'undefined-point',
      title: t('Where is the curl defined?', '旋度在哪里有定义？'),
      prompt: t(
        `Two fields are given by formulas: A = (${upA.M}, ${upA.N}) and B = (${upB.M}, ${upB.N}). Which field has a two-dimensional curl at the point P = (0, ${upK})? (The curl N_x − M_y needs M, N and their partial derivatives to exist at P.)`,
        `两个场由公式给出：A = (${upA.M}, ${upA.N})，B = (${upB.M}, ${upB.N})。哪个场在点 P = (0, ${upK}) 处有二维旋度？（旋度 N_x − M_y 要求 M、N 及其偏导数在 P 处存在。）`
      ),
      options: [
        t('Only A', '只有 A'),
        t('Only B', '只有 B'),
        t('Both A and B', 'A 和 B 都有'),
        t('Neither A nor B', 'A 和 B 都没有')
      ],
      correct: upCorrectIdx,
      hint: t('A formula can be used at P only if M and N are defined and differentiable at P. Look at every denominator at x = 0.', '只有当 M、N 在 P 处有定义且可微时，公式才能在 P 处使用。检查 x = 0 时的每个分母。'),
      explanation: t(
        `At P = (0, ${upK}) the field ${upSingular.M}, ${upSingular.N} has x = 0 in a denominator, so it is not defined there and has no curl at P. The field ${upRegular.M}, ${upRegular.N} is defined and differentiable everywhere and has curl ${2 * upW} at P.`,
        `在 P = (0, ${upK}) 处，场 ${upSingular.M}, ${upSingular.N} 的分母含 x = 0，所以它在该点没有定义，在 P 处没有旋度。场 ${upRegular.M}, ${upRegular.N} 处处有定义且可微，在 P 处的旋度为 ${2 * upW}。`
      )
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: mixed field', '挑战：混合场'),
      prompt: t(`F = (${chM}, ${chN}) is a vector field in the plane. Compute its two-dimensional curl at the point (${num(ch.x0)}, ${num(ch.y0)}).`, `F = (${chM}, ${chN}) 是平面向量场。求它在点 (${num(ch.x0)}, ${num(ch.y0)}) 处的二维旋度。`),
      fields: [{ label: t('curl F', 'curl F'), answer: chAnswer }],
      hint: t('Only the derivatives matter: N_x and M_y. Constants and the other variable drop out.', '只有两个偏导数起作用：N_x 与 M_y。常数项和另一个变量的项都会消失。'),
      explanation: t(
        `M = ${chM} gives M_y = ${num(-ch.w)}. N = ${chN} gives N_x = ${num(ch.w)} + ${coef(2 * ch.c, 'x')} = ${num(ch.w + 2 * ch.c * ch.x0)} at x = ${num(ch.x0)}. curl F = ${num(ch.w + 2 * ch.c * ch.x0)} − ${par(-ch.w)} = ${num(chAnswer)}. The constants ${ch.u} and ${ch.v} and the value y = ${ch.y0} do not affect it.`,
        `M = ${chM} 给出 M_y = ${num(-ch.w)}。N = ${chN} 给出 N_x = ${num(ch.w)} + ${coef(2 * ch.c, 'x')}，在 x = ${num(ch.x0)} 处等于 ${num(ch.w + 2 * ch.c * ch.x0)}。curl F = ${num(ch.w + 2 * ch.c * ch.x0)} − ${par(-ch.w)} = ${num(chAnswer)}。常数 ${ch.u}、${ch.v} 以及 y = ${ch.y0} 都不影响结果。`
      ),
      audit: { kind: 'MIT-MV-42:challenge', params: { u: ch.u, v: ch.v, w: ch.w, c: ch.c, x0: ch.x0, y0: ch.y0 } }
    })
  ];
};
