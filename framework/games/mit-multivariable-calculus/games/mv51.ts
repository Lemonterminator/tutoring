import type { CardGenerator } from '../../types';
import { fitView, graphOf, type FigureShape, type Pt } from '../../figure';
import { frac, gcd, makeMvDeck, num, type Text } from '../support';
/** n/d times π, written as π, 3π, 14π/3 (never 1π or 14/3π). */
const fracPi = (n: number, d: number): string => { const g = gcd(n, d); const p = n / g, q = d / g; const top = p === 1 ? 'π' : p === -1 ? '−π' : `${num(p)}π`; return q === 1 ? top : `${top}/${q}`; };


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

export const mv51: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-51');
  warm(g);

  // factors
  const hF = g.pick([2, 3, 4, 5, 6, 7]);

  // limits
  const hL = g.pick([2, 3, 5, 6, 7, 8]);
  const variant = g.pick(['A', 'B']);

  // disk-radius
  const z0D = g.pick([4, 9, 16, 25]);
  const sD = g.pick([1, 2, 3]);
  const hD = z0D + sD;
  const ansD = Math.sqrt(z0D);

  // inner
  const z0I = g.pick([2, 3, 5, 6, 7, 8, 10]);
  const ansI = z0I * z0I / 4;

  // z-step
  const hZ = g.pick([2, 3, 4, 6, 8, 9]);
  const ansZ = hZ * hZ * hZ / 12;

  // density
  const deltaD = g.pick([2, 3, 4, 5, 6, 8]);

  // moment
  const deltaM = g.pick([2, 3, 4, 6]);
  const hM = g.pick([2, 3, 4]);
  const ansM = deltaM * hM * hM * hM / 6;

  // challenge
  const ch = retry(() => ({
    a: g.pick([1, 2, 3]),
    H: g.pick([1, 2, 3, 4]),
    delta: g.pick([1, 2, 3])
  }), v => !(v.a === v.H && v.H === v.delta) && !(v.a === 3 && v.delta * v.H > 3));
  const ansC = ch.delta * ch.a ** 4 * ch.H / 2;

  // Figure for limits
  const sL = Math.sqrt(hL);
  const curveL = graphOf((x: number) => x * x, -sL, sL);
  const limitShapes: FigureShape[] = [
    { kind: 'area', points: [...curveL, [sL, hL], [-sL, hL]], tone: 'accent', opacity: 0.25 },
    // the parabola label sits half-way up the right branch, the plane label at the right end of the plane: they never meet
    { kind: 'line', points: curveL, tone: 'accent', width: 2, label: 'z = x²', labelAt: [0.82 * sL, 0.49 * hL] },
    { kind: 'line', points: [[-sL, hL], [sL, hL]], tone: 'accent2', width: 2, label: `z = ${hL}` },
  ];
  const limitView = { xmin: -sL - 0.6, xmax: sL + 0.6, ymin: -0.6, ymax: hL + 0.9 };

  // Figure for disk-radius
  const rD = Math.sqrt(z0D), sD2 = Math.sqrt(hD);
  const curveD = graphOf((x: number) => x * x, -sD2, sD2);
  const diskShapes: FigureShape[] = [
    { kind: 'area', points: [...curveD, [sD2, hD], [-sD2, hD]], tone: 'accent', opacity: 0.25 },
    { kind: 'line', points: curveD, tone: 'accent', width: 2, label: 'z = x²', labelAt: [Math.sqrt(0.2 * hD) + 0.12 * sD2, 0.2 * hD] },
    { kind: 'line', points: [[-sD2, hD], [sD2, hD]], tone: 'accent2', width: 2, label: `z = ${hD}` },
    { kind: 'line', points: [[-rD, z0D], [rD, z0D]], tone: 'warn', width: 2 },
    { kind: 'point', at: [0, z0D], tone: 'warn', label: `z = ${z0D}` },
    { kind: 'arrow', from: [0, z0D], to: [rD, z0D], tone: 'warn', label: 'r' },
  ];
  const diskView = { xmin: -sD2 - 0.6, xmax: sD2 + 0.6, ymin: -0.6, ymax: hD + 0.9 };

  return [
    g.choice({
      id: 'factors',
      title: t('Read the integrand', '读懂被积函数'),
      prompt: t(
        `A solid is bounded by the paraboloid z = x² + y² and the plane z = ${hF}. For density δ, its moment of inertia about the z-axis is written in cylindrical coordinates as I = ∫∫∫ δ · r² · r dr dθ dz. What do the factor r² and the extra factor r stand for?`,
        `立体由抛物面 z = x² + y² 和平面 z = ${hF} 围成。密度为 δ 时，它关于 z 轴的转动惯量在柱坐标中写成 I = ∫∫∫ δ · r² · r dr dθ dz。因子 r² 和多出来的因子 r 各代表什么？`
      ),
      options: [
        t('r² is the squared distance from the z-axis, the weight in a moment of inertia; the extra r comes from dV = r dr dθ dz.', 'r² 是到 z 轴距离的平方，即转动惯量中的权重；多出来的 r 来自体积元 dV = r dr dθ dz。'),
        t('r² is the squared distance from the origin; the extra r comes from dV = r dr dθ dz.', 'r² 是到原点距离的平方；多出来的 r 来自体积元 dV = r dr dθ dz。'),
        t('r² is the squared distance from the z-axis; the extra r is not needed, because dr dθ dz already is the volume element dV.', 'r² 是到 z 轴距离的平方；多出来的 r 是多余的，因为 dr dθ dz 本身就是体积元 dV。'),
        t('r² comes from the volume element, and the extra r is the distance from the z-axis.', 'r² 来自体积元，多出来的 r 是到 z 轴的距离。'),
      ],
      correct: 0,
      hint: t(
        'A moment of inertia weights each small piece of mass by the square of its distance from the axis. Which distance is that for the z-axis, and what is dV in cylindrical coordinates?',
        '转动惯量按每一小块质量到转轴距离的平方加权。对 z 轴来说这个距离是什么？柱坐标下 dV 是什么？'
      ),
      explanation: t(
        'About the z-axis, a piece at (r, θ, z) is at distance r from the axis, so it contributes δ · r² · dV. In cylindrical coordinates dV = r dr dθ dz, which supplies the extra r. Together the integrand is δ r³.',
        '对 z 轴来说，位于 (r, θ, z) 的小块到轴的距离是 r，所以它贡献 δ · r² · dV。柱坐标下 dV = r dr dθ dz，多出来的 r 正是由它而来。合起来被积函数是 δ r³。'
      ),
    }),
    g.symbols({
      id: 'limits',
      title: t('Bounds for the solid', '立体的积分限'),
      prompt: t(
        `The solid is bounded by the paraboloid z = x² + y² (in cylindrical coordinates z = r²) and the plane z = ${hL}; its density is 1, so I = ∭ r² dV has the integrand r² · r = r³. Complete the bounds; z increases from the paraboloid to the plane.`,
        `立体由抛物面 z = x² + y²（柱坐标中为 z = r²）和平面 z = ${hL} 围成，密度为 1，所以 I = ∭ r² dV 的被积函数是 r² · r = r³。补全积分限；z 由抛物面向上增大到平面。`
      ),
      before: variant === 'A'
        ? t('I = ∫ over θ from 0 to 2π, over z from ', 'I = ∫（θ 从 0 到 2π，z 从 ')
        : t('I = ∫ over θ from 0 to 2π, over r from ', 'I = ∫（θ 从 0 到 2π，r 从 '),
      between: variant === 'A'
        ? [g.t([' to ', ' 到 ']), g.t([', over r from ', '，r 从 ']), g.t([' to ', ' 到 '])]
        : [g.t([' to ', ' 到 ']), g.t([', over z from ', '，z 从 ']), g.t([' to ', ' 到 '])],
      after: variant === 'A'
        ? t(' of r³ dr dz dθ', '，被积函数 r³，积分顺序 dr、dz、dθ）')
        : t(' of r³ dz dr dθ', '，被积函数 r³，积分顺序 dz、dr、dθ）'),
      answers: variant === 'A' ? ['0', String(hL), '0', '√z'] : ['0', `√${hL}`, 'r²', String(hL)],
      tokens: variant === 'A'
        ? shuffled(g, ['0', String(hL), '√z', 'z', 'z²', `√${hL}`, String(hL * hL)])
        : shuffled(g, ['0', `√${hL}`, 'r²', String(hL), 'r', '√r', String(hL * hL)]),
      hint: variant === 'A'
        ? t('For a fixed z, how far from the axis does the solid reach? On the paraboloid z = r².', '固定 z 时，立体离轴最远到多远？在抛物面上 z = r²。')
        : t('For a fixed r, where does a vertical line enter and where does it leave the solid?', '固定 r 时，竖直线从哪里进入、从哪里离开立体？'),
      explanation: variant === 'A'
        ? t(`At height z the solid is the disk r ≤ √z, because the paraboloid is z = r². The heights run from the vertex z = 0 up to the plane z = ${hL}. So z goes from 0 to ${hL} and r from 0 to √z.`,
          `在高度 z 处立体是圆盘 r ≤ √z，因为抛物面是 z = r²。高度从顶点 z = 0 一直到平面 z = ${hL}。所以 z 从 0 到 ${hL}，r 从 0 到 √z。`)
        : t(`For a fixed r the vertical line enters at the paraboloid, z = r², and leaves at the plane z = ${hL}. The paraboloid meets the plane where r² = ${hL}, so r runs from 0 to √${hL}.`,
          `固定 r 时，竖直线在抛物面 z = r² 处进入，在平面 z = ${hL} 处离开。抛物面与平面交于 r² = ${hL}，所以 r 从 0 到 √${hL}。`),
      figure: g.figure({
        alt: t(
          `Side view in the xz-plane: the parabola z = x² and the horizontal line z = ${hL}; the solid is the region between them, turned around the z-axis.`,
          `xz 平面内的侧视图：抛物线 z = x² 和水平线 z = ${hL}，立体是两者之间的区域绕 z 轴旋转所得。`
        ),
        view: limitView,
        shapes: limitShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
    }),
    g.number({
      id: 'disk-radius',
      title: t('Cross-section at a height', '某一高度的截面'),
      prompt: t(
        `The solid is bounded by the paraboloid z = x² + y² and the plane z = ${hD}. The horizontal plane z = ${z0D} cuts the solid in a disk centred on the z-axis. Enter the radius of this disk.`,
        `立体由抛物面 z = x² + y² 和平面 z = ${hD} 围成。水平面 z = ${z0D} 与立体相交得到一个圆心在 z 轴上的圆盘。填写这个圆盘的半径。`
      ),
      fields: [{ label: t('radius', '半径'), answer: ansD }],
      hint: t(
        `On the paraboloid z = r²: the boundary of the cross-section at height ${z0D} is where r² = ${z0D}.`,
        `抛物面上 z = r²：高度 ${z0D} 处截面的边界满足 r² = ${z0D}。`
      ),
      explanation: t(
        `At height z = ${z0D} the boundary of the solid is on the paraboloid, where x² + y² = ${z0D}. The disk therefore has radius √${z0D} = ${num(ansD)}. The plane z = ${hD} only limits the solid from above.`,
        `在高度 z = ${z0D} 处，立体的边界在抛物面上，满足 x² + y² = ${z0D}。所以圆盘半径是 √${z0D} = ${num(ansD)}。平面 z = ${hD} 只是从上方限制立体。`
      ),
      figure: g.figure({
        alt: t(
          `Side view in the xz-plane: the parabola z = x² and the horizontal line z = ${hD}; the solid is the region between them, turned around the z-axis. A horizontal segment at height z = ${z0D} marks the disk.`,
          `xz 平面内的侧视图：抛物线 z = x² 和水平线 z = ${hD}，立体是两者之间的区域绕 z 轴旋转所得。高度 z = ${z0D} 处的水平线段表示圆盘。`
        ),
        view: diskView,
        shapes: diskShapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
      audit: { kind: 'MIT-MV-51:disk-radius', params: { z0: z0D, h: hD } },
    }),
    g.number({
      id: 'inner',
      title: t('The inner integral', '最内层积分'),
      prompt: t(
        `For the solid between z = x² + y² and a plane, the r-integral at the height z = ${z0I} runs from r = 0 to r = √${z0I}. Evaluate ∫ from r = 0 to √${z0I} of r³ dr. Enter an integer or a fraction.`,
        `对于抛物面 z = x² + y² 与某平面之间的立体，在高度 z = ${z0I} 处 r 的积分从 r = 0 到 r = √${z0I}。计算 ∫ r³ dr（r 从 0 到 √${z0I}）。填写整数或分数。`
      ),
      fields: [{ label: t('value', '值'), answer: ansI }],
      hint: t(
        `An antiderivative of r³ is r⁴/4, and (√${z0I})⁴ is a power of ${z0I}.`,
        `r³ 的一个原函数是 r⁴/4，而 (√${z0I})⁴ 是 ${z0I} 的幂。`
      ),
      explanation: t(
        `∫ r³ dr = r⁴/4, so the value is (√${z0I})⁴/4 = ${z0I * z0I}/4${frac(z0I * z0I, 4) === `${z0I * z0I}/4` ? '' : ` = ${frac(z0I * z0I, 4)}`}.`,
        `∫ r³ dr = r⁴/4，所以值为 (√${z0I})⁴/4 = ${z0I * z0I}/4${frac(z0I * z0I, 4) === `${z0I * z0I}/4` ? '' : ` = ${frac(z0I * z0I, 4)}`}。`
      ),
      audit: { kind: 'MIT-MV-51:inner', params: { z0: z0I } },
    }),
    g.number({
      id: 'z-step',
      title: t('The z-integral', '对 z 的积分'),
      prompt: t(
        `With density 1, the r-integral of r³ from r = 0 to √z equals z²/4. The z-integral that remains is ∫ from z = 0 to ${hZ} of z²/4 dz. Evaluate it. Enter an integer or a fraction.`,
        `密度为 1 时，r³ 对 r 从 0 到 √z 的积分等于 z²/4。剩下的对 z 的积分是 ∫ z²/4 dz（z 从 0 到 ${hZ}）。计算它。填写整数或分数。`
      ),
      fields: [{ label: t('value', '值'), answer: ansZ }],
      hint: t('An antiderivative of z²/4 is z³/12.', 'z²/4 的一个原函数是 z³/12。'),
      explanation: t(
        `∫ z²/4 dz = z³/12, so from 0 to ${hZ} the value is ${hZ}³/12 = ${hZ * hZ * hZ}/12 = ${frac(hZ * hZ * hZ, 12)}.`,
        `∫ z²/4 dz = z³/12，所以从 0 到 ${hZ} 的值为 ${hZ}³/12 = ${hZ * hZ * hZ}/12 = ${frac(hZ * hZ * hZ, 12)}。`
      ),
      audit: { kind: 'MIT-MV-51:z-step', params: { h: hZ } },
    }),
    g.choice({
      id: 'density',
      title: t('Change the density', '改变密度'),
      prompt: t(
        `In the notes the density is 1: the solid bounded by z = x² + y² and z = 1 has moment of inertia I₁ about the z-axis. The same solid now has uniform density δ = ${deltaD}. How is its moment of inertia related to I₁?`,
        `笔记中密度为 1：由 z = x² + y² 和 z = 1 围成的立体关于 z 轴的转动惯量记为 I₁。同一个立体现在的均匀密度为 δ = ${deltaD}。它的转动惯量与 I₁ 是什么关系？`
      ),
      options: [
        t(`${deltaD}·I₁`, `${deltaD}·I₁`),
        t(`${deltaD * deltaD}·I₁`, `${deltaD * deltaD}·I₁`),
        t(`I₁/${deltaD}`, `I₁/${deltaD}`),
        t('I₁, the density does not matter', 'I₁，与密度无关'),
      ],
      correct: 0,
      hint: t('Every small piece now has δ times its old mass, while the distances to the axis are the same.', '每一小块的质量变成原来的 δ 倍，而到轴的距离不变。'),
      explanation: t(
        `The moment of inertia is I = ∭ δ r² dV, which is proportional to δ. Multiplying the density by ${deltaD} multiplies I by ${deltaD}, so the new value is ${deltaD}·I₁. With density 1 the factor δ is invisible in the solution, which is why it is easy to forget.`,
        `转动惯量 I = ∭ δ r² dV 与 δ 成正比。密度乘以 ${deltaD}，I 也乘以 ${deltaD}，所以新的值是 ${deltaD}·I₁。密度为 1 时解答里看不见因子 δ，所以容易忘记。`
      ),
    }),
    g.number({
      id: 'moment',
      title: t('Moment of inertia of the paraboloid solid', '抛物面立体的转动惯量'),
      prompt: t(
        `The solid bounded by the paraboloid z = x² + y² and the plane z = ${hM} has uniform density δ = ${deltaM}. Its moment of inertia about the z-axis is I = kπ. Enter k as an integer or a fraction.`,
        `由抛物面 z = x² + y² 和平面 z = ${hM} 围成的立体，均匀密度 δ = ${deltaM}。它关于 z 轴的转动惯量为 I = kπ。填写 k（整数或分数）。`
      ),
      fields: [{ label: t('k', 'k'), answer: ansM }],
      hint: t(
        'Do the r-integral, the z-integral and the θ-integral as in the previous cards with the printed h, then multiply by the density.',
        '按前几张卡片的做法，用题中的 h 依次做 r、z、θ 三个积分，再乘以密度。'
      ),
      explanation: t(
        `The r-integral gives z²/4 and the z-integral from 0 to ${hM} gives ${hM}³/12, the θ-integral gives the factor 2π, and the density is ${deltaM}. So I = ${deltaM} · 2π · ${hM}³/12 = ${fracPi(deltaM * hM * hM * hM, 6)}, and k = ${frac(deltaM * hM * hM * hM, 6)}.`,
        `r 的积分得 z²/4，z 从 0 到 ${hM} 的积分得 ${hM}³/12，θ 的积分给出因子 2π，密度是 ${deltaM}。所以 I = ${deltaM} · 2π · ${hM}³/12 = ${fracPi(deltaM * hM * hM * hM, 6)}，k = ${frac(deltaM * hM * hM * hM, 6)}。`
      ),
      audit: { kind: 'MIT-MV-51:moment', params: { delta: deltaM, h: hM } },
    }),
    g.number({
      id: 'challenge',
      title: t('Moment of inertia of a cylinder', '圆柱体的转动惯量'),
      prompt: t(
        `A solid cylinder of radius ${ch.a} and height ${ch.H} has its axis along the z-axis and fills 0 ≤ z ≤ ${ch.H}. Its density is uniform, δ = ${ch.delta}. Its moment of inertia about its axis is I = kπ. Enter k as an integer or a fraction.`,
        `一个半径为 ${ch.a}、高为 ${ch.H} 的实心圆柱体，轴线沿 z 轴，占据 0 ≤ z ≤ ${ch.H}。密度均匀，δ = ${ch.delta}。它关于自身轴线的转动惯量为 I = kπ。填写 k（整数或分数）。`
      ),
      fields: [{ label: t('k', 'k'), answer: ansC }],
      hint: t(
        'Pick the coordinates that fit the cylinder. The moment of inertia about the z-axis weights each piece by the square of its distance from that axis.',
        '选择适合圆柱体的坐标。关于 z 轴的转动惯量按每一小块到该轴距离的平方加权。'
      ),
      explanation: t(
        `In cylindrical coordinates the cylinder is 0 ≤ r ≤ ${ch.a}, 0 ≤ θ ≤ 2π, 0 ≤ z ≤ ${ch.H}. Then I = ${ch.delta} · ∫ r² · r dr dθ dz = ${ch.delta} · (${ch.a ** 4}/4) · 2π · ${ch.H} = ${fracPi(ch.delta * ch.a ** 4 * ch.H, 2)}. This game does not ask you to find centres of mass or average heights, and it does not cover moments of inertia about axes other than the z-axis.`,
        `在柱坐标中，圆柱体是 0 ≤ r ≤ ${ch.a}，0 ≤ θ ≤ 2π，0 ≤ z ≤ ${ch.H}。于是 I = ${ch.delta} · ∫ r² · r dr dθ dz = ${ch.delta} · (${ch.a ** 4}/4) · 2π · ${ch.H} = ${fracPi(ch.delta * ch.a ** 4 * ch.H, 2)}。本游戏不要求求质心或平均高度，也不涉及关于 z 轴以外其他轴的转动惯量。`
      ),
      audit: { kind: 'MIT-MV-51:challenge', params: { delta: ch.delta, a: ch.a, H: ch.H } },
    }),
  ];
};
