import type { CardGenerator } from '../../types';
import { coef, gcd, makeMvDeck, piTerm, type Text } from '../support';

type Deck = ReturnType<typeof makeMvDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { const v = make(); if (ok(v)) return v; }
  throw new Error('retry: sampling condition never satisfied');
}
/** The shared LCG gives near-constant first draws for neighbouring seeds. */
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

const NOT_ASSESSED_EN = 'This game reviews only Unit 3: double integrals, Jacobian, triple integrals and applications. It does not assess Green, line integrals, divergence or Stokes.';
const NOT_ASSESSED_ZH = '本游戏只复习第三单元：二重积分、雅可比因子、三重积分及其应用。不涉及格林公式、线积分、散度与斯托克斯。';

export const mv67: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-67');
  warm(g);

  // 1. choose-exchange: a is the upper limit of the outer integral.
  const ceA = g.pick([2, 3, 4, 5, 6, 7]);

  // 2. exchange-limits: a is the same upper limit; the token palette is de-duplicated (a = 2 makes a² = 2a).
  const exA = g.pick([2, 3, 4, 5, 6, 7]);
  const exTokens = shuffled(g, [...new Set(['0', String(exA * exA), '√y', String(exA), 'x²', 'y²', String(2 * exA)])]);

  // 3. polar-moment-setup: disk radius R.
  const pmR = g.random(1, 6);
  // NOTE: plan token "2R" is taken as the value 2R (the palette only holds printed values); see also card 8.
  const pmTokens = shuffled(g, ['0', '2π', String(pmR), 'r²', 'r³', 'π', String(2 * pmR)]);

  // 4. polar-moment-value: same disk radius family, independent draw.
  const pvR = g.random(1, 6);

  // 5. jacobian-scale: a ≠ b and a, b ≥ 2.
  // NOTE: plan samples a, b in {1..4}; a = 1 or b = 1 makes the "one factor missing" distractor coincide
  // with "r dr dθ" or with the correct option, so those degenerate sets are excluded (6 admissible pairs).
  const js = retry(() => ({ a: g.random(1, 4), b: g.random(1, 4) }), v => v.a !== v.b && v.a !== 1 && v.b !== 1);
  const jsAB = js.a * js.b;

  // 6. not-elementary-check: fixed conceptual card, no sampled numbers.

  // 7. spherical-z: R is a decoy printed in the stem.
  const szR = g.pick([1, 2, 3]);

  // 8. spherical-setup: hemisphere radius R.
  const ssR = g.random(1, 6);
  const ssTokens = shuffled(g, ['0', '2π', 'π/2', String(ssR), 'π', String(2 * ssR), 'ρcos²φsinφ', 'ρsinφ', 'ρcosφ']);

  // 9. spherical-value: hemisphere radius R.
  const svR = g.random(1, 6);
  const svK = svR * svR / 3;
  const svStr = Number.isInteger(svK) ? piTerm(svK) : `${piTerm(svR * svR)}/3`;

  // 10. challenge: c = cNum·π/cDen; c/2 is reduced for display.
  // NOTE: plan writes the audit param as "c printed as an angle"; the radian value is not a literal in the text,
  // so (per the conventions doc: a fraction is passed as two params) the angle is passed as cNum and cDen.
  const angles = [
    { num: 1, den: 6 }, { num: 1, den: 4 }, { num: 1, den: 3 },
    { num: 1, den: 2 }, { num: 2, den: 3 }, { num: 3, den: 4 },
  ];
  const ch = g.pick(angles);
  const chAngle = ch.num === 1 ? `π/${ch.den}` : `${ch.num}π/${ch.den}`;
  const chG = gcd(ch.num, 2 * ch.den);
  const chHalf = `${ch.num / chG === 1 ? '' : ch.num / chG}π/${2 * ch.den / chG}`;
  const chAns = ch.num * Math.PI / (2 * ch.den);

  return [
    // NOTE: the plan says "3 of 5 distractors shown" but names only four distractors (D1-D4); all four are shown.
    g.choice({
      id: 'choose-exchange',
      title: t('Which tool evaluates it', '用哪种方法计算'),
      prompt: t(
        `The inner integral ∫e^{−y²} dy is not elementary. For ∫0^{a}∫_{x²}^{a²} x e^{−y²} dy dx with a = ${ceA}, which technique evaluates it?`,
        `内层积分 ∫e^{−y²} dy 不是初等函数。对 ∫0^{a}∫_{x²}^{a²} x e^{−y²} dy dx，其中 a = ${ceA}，用哪种方法可以求出它？`
      ),
      options: [
        t('Change the order of integration', '交换积分次序'),
        t('Integrate by parts in y', '对 y 分部积分'),
        t('Substitute u = y² in the inner integral', '在内层换元 u = y²'),
        t("L'Hôpital's rule", '洛必达法则'),
        t('It cannot be evaluated', '无法求出'),
      ],
      correct: 0,
      hint: t('Check whether the inner antiderivative is elementary; sketch the region x² ≤ y ≤ a².', '检查内层原函数是否初等；画出区域 x² ≤ y ≤ a²。'),
      explanation: t(
        `The inner ∫e^{−y²} dy is non-elementary, but after the swap y runs from 0 to ${ceA * ceA} and, for each y, x runs from 0 to √y; the new inner integral ∫0^{√y} x dx = y/2 is elementary (P9, practice p.2). The named distractors keep the non-elementary inner integral or misuse a rule about limits.`,
        `内层 ∫e^{−y²} dy 非初等，但交换次序后 y 从 0 到 ${ceA * ceA}，对每个 y，x 从 0 到 √y；新的内层积分 ∫0^{√y} x dx = y/2 是初等的（第 9 题）。所列干扰项仍保留非初等的内层积分，或误用关于求极限的法则。`
      ),
    }),
    g.symbols({
      id: 'exchange-limits',
      title: t('Limits after swapping', '交换后的积分限'),
      prompt: t(
        `For ∫0^{a}∫_{x²}^{a²} x e^{−y²} dy dx with a = ${exA}, write the reversed order. Complete: y runs from [ ] to [ ], and for fixed y x runs from [ ] to [ ].`,
        `对 ∫0^{a}∫_{x²}^{a²} x e^{−y²} dy dx，其中 a = ${exA}，写出交换后的次序。补全：y 从 [ ] 到 [ ]，固定 y 时 x 从 [ ] 到 [ ]。`
      ),
      before: lang === 'zh' ? 'y 从 ' : 'y runs from ',
      between: lang === 'zh' ? [' 到 ', '，固定 y 时 x 从 ', ' 到 '] : [' to ', ', and for fixed y x runs from ', ' to '],
      after: lang === 'zh' ? '。' : '.',
      answers: ['0', String(exA * exA), '0', '√y'],
      tokens: exTokens,
      hint: t('The parabola y = x² meets y = a² at x = a; slice horizontally.', '抛物线 y = x² 与 y = a² 交于 x = a；作水平切片。'),
      explanation: t(
        `The region is 0 ≤ x ≤ ${exA} with x² ≤ y ≤ ${exA * exA}; for y between 0 and ${exA * exA}, x runs between 0 and √y (P9).`,
        `区域是 0 ≤ x ≤ ${exA}，x² ≤ y ≤ ${exA * exA}；y 在 0 到 ${exA * exA} 之间时 x 在 0 到 √y 之间（第 9 题）。`
      ),
    }),
    g.symbols({
      id: 'polar-moment-setup',
      title: t('Polar setup for moment about origin', '对原点转动惯量的极坐标设置'),
      prompt: t(
        `A disk x² + y² ≤ ${pmR}² has density 1. Write its moment about the origin as a polar integral, using dA = r dr dθ. Complete: θ runs from [ ] to [ ], r runs from [ ] to [ ], and the integrand is [ ] dr dθ.`,
        `圆盘 x² + y² ≤ ${pmR}² 的密度为 1。用 dA = r dr dθ 写出它关于原点的转动惯量的极坐标积分。补全：θ 从 [ ] 到 [ ]，r 从 [ ] 到 [ ]，被积函数为 [ ] dr dθ。`
      ),
      before: lang === 'zh' ? 'θ 从 ' : 'θ runs from ',
      between: lang === 'zh' ? [' 到 ', '，r 从 ', ' 到 ', '，被积函数为 '] : [' to ', ', r runs from ', ' to ', ', and the integrand is '],
      after: lang === 'zh' ? ' dr dθ。' : ' dr dθ.',
      answers: ['0', '2π', '0', String(pmR), 'r³'],
      tokens: pmTokens,
      hint: t('x² + y² = r², and remember the Jacobian factor r.', 'x² + y² = r²，别漏雅可比因子 r。'),
      explanation: t(
        `The full disk gives θ from 0 to 2π and r from 0 to ${pmR}; the integrand is (x² + y²) times the Jacobian r, that is r² · r = r³ (P10 adapted to a disk).`,
        `整个圆盘给出 θ 从 0 到 2π，r 从 0 到 ${pmR}；被积函数是 (x² + y²) 乘以雅可比因子 r，即 r² · r = r³（第 10 题改编为圆盘）。`
      ),
    }),
    g.number({
      id: 'polar-moment-value',
      title: t('Moment of the disk', '圆盘的转动惯量'),
      prompt: t(
        `A disk x² + y² ≤ ${pvR}² has density 1. Evaluate its moment about the origin, I = ∬ (x² + y²) dA. Enter a multiple of π, for example pi/2 or 8pi.`,
        `圆盘 x² + y² ≤ ${pvR}² 的密度为 1。求它关于原点的转动惯量 I = ∬ (x² + y²) dA。以 π 的倍数输入，例如 π/2 或 8π。`
      ),
      fields: [{ label: t('I', 'I'), answer: Math.PI * pvR ** 4 / 2 }],
      hint: t('Use the r³ set-up; ∫0^{2π} dθ = 2π.', '用 r³ 的设置；∫0^{2π} dθ = 2π。'),
      explanation: t(
        `I = ∫0^{2π} ∫0^{${pvR}} r³ dr dθ = 2π · ${pvR ** 4}/4 = ${piTerm(pvR ** 4 / 2)} (P10).`,
        `I = ∫0^{2π} ∫0^{${pvR}} r³ dr dθ = 2π · ${pvR ** 4}/4 = ${piTerm(pvR ** 4 / 2)}（第 10 题）。`
      ),
      audit: { kind: 'MIT-MV-67:polar-moment-value', params: { R: pvR } },
    }),
    g.choice({
      id: 'jacobian-scale',
      title: t('Stretched polar Jacobian', '拉伸极坐标的雅可比因子'),
      prompt: t(
        `Under the map x = ${coef(js.a, 'r cosθ')}, y = ${coef(js.b, 'r sinθ')}, with r ≥ 0, what is dA = dx dy in terms of r and θ?`,
        `在映射 x = ${coef(js.a, 'r cosθ')}，y = ${coef(js.b, 'r sinθ')}，r ≥ 0 下，dA = dx dy 用 r 与 θ 表示是什么？`
      ),
      options: [
        t(`${jsAB}r dr dθ`, `${jsAB}r dr dθ`),
        t('r dr dθ', 'r dr dθ'),
        t(`${jsAB} dr dθ`, `${jsAB} dr dθ`),
        t(`${jsAB}r² dr dθ`, `${jsAB}r² dr dθ`),
        t(`${js.a}r dr dθ`, `${js.a}r dr dθ`),
      ],
      correct: 0,
      hint: t('Compute the determinant x_r x_θ y_r y_θ.', '算行列式 x_r x_θ y_r y_θ。'),
      explanation: t(
        `x_r = ${js.a}cosθ, x_θ = −${js.a}r sinθ, y_r = ${js.b}sinθ and y_θ = ${js.b}r cosθ, so the determinant is ${jsAB}r(cos²θ + sin²θ) = ${jsAB}r (Clip 1, Jacobian background). Dropping the factor r or one of the two scalars gives the other options.`,
        `x_r = ${js.a}cosθ，x_θ = −${js.a}r sinθ，y_r = ${js.b}sinθ，y_θ = ${js.b}r cosθ，行列式为 ${jsAB}r(cos²θ + sin²θ) = ${jsAB}r（第一段雅可比背景）。漏掉因子 r 或两个系数之一就得到其它选项。`
      ),
    }),
    g.choice({
      id: 'not-elementary-check',
      title: t('Non-elementary does not mean impossible', '非初等不等于不可算'),
      prompt: t(
        `Claim: because ∫e^{−x²} dx is not elementary, the double integral ∫0^∞∫0^∞ e^{−x²}e^{−y²} dy dx cannot be evaluated. What is the flaw in the claim?`,
        `断言：因为 ∫e^{−x²} dx 不是初等函数，所以二重积分 ∫0^∞∫0^∞ e^{−x²}e^{−y²} dy dx 不可算。这个断言错在哪里？`
      ),
      options: [
        t('The double integral is evaluable in polar coordinates and equals π/4', '该二重积分用极坐标可算，等于 π/4'),
        t('The integral diverges', '该积分发散'),
        t('e^{−x²} is discontinuous', 'e^{−x²} 不连续'),
        t("Apply L'Hôpital's rule", '用洛必达法则'),
        t('A single non-elementary integral makes the double integral impossible', '单积分非初等就使二重积分不可算'),
      ],
      correct: 0,
      hint: t('Try x = r cosθ, y = r sinθ, with the extra factor r.', '试 x = r cosθ，y = r sinθ，多出因子 r。'),
      explanation: t(
        `The single integral ∫e^{−x²} dx is non-elementary, but I² in polar coordinates is ∫0^{π/2}∫0^∞ e^{−r²} r dr dθ = π/4, so I = √π/2 (P18, practice p.2, solutions p.4). One non-elementary integral does not make the double integral impossible.`,
        `单积分 ∫e^{−x²} dx 非初等，但 I² 化极坐标得 ∫0^{π/2}∫0^∞ e^{−r²} r dr dθ = π/4，所以 I = √π/2（第 18 题）。一个非初等积分并不意味着二重积分不可算。`
      ),
    }),
    g.choice({
      id: 'spherical-z',
      title: t('z in spherical coordinates', '球坐标中的 z'),
      prompt: t(
        `In MIT spherical coordinates, where φ is measured from the positive z-axis, a sphere has radius ${szR}. For a point (ρ, φ, θ), which expression gives z?`,
        `在 MIT 球坐标中，φ 是从正 z 轴量起的角，球半径为 ${szR}。对点 (ρ, φ, θ)，哪个表达式给出 z？`
      ),
      options: [
        t('z = ρ cosφ', 'z = ρ cosφ'),
        t('z = ρ sinφ', 'z = ρ sinφ'),
        t('z = ρ cosθ', 'z = ρ cosθ'),
        t('z = ρ', 'z = ρ'),
        t('z = ρ sinφ cosθ', 'z = ρ sinφ cosθ'),
      ],
      correct: 0,
      hint: t('The side adjacent to φ, measured from the +z axis, uses the cosine.', '与 φ 相邻的边用余弦，φ 从正 z 轴量起。'),
      explanation: t(
        `z = ρ cosφ, the adjacent side to the angle φ measured from the positive z-axis (P12 states δ = z = ρ cosφ, solutions p.3). The angle θ is the azimuth around the z-axis and does not appear.`,
        `z = ρ cosφ，是以正 z 轴起算的角 φ 的邻边（第 12 题已用 δ = z = ρ cosφ）。角 θ 是绕 z 轴的方位角，不会出现。`
      ),
    }),
    g.symbols({
      id: 'spherical-setup',
      title: t('Hemisphere force setup', '半球引力设置'),
      prompt: t(
        `A hemisphere of radius ${ssR} has its base in the xy-plane, centred at the origin, with δ = z = ρ cosφ and φ measured from the positive z-axis. Write the magnitude F = G∭ δ·(cosφ/ρ²) dV as a spherical integral. Complete: θ from [ ] to [ ], φ from [ ] to [ ], ρ from [ ] to [ ], integrand [ ].`,
        `半径为 ${ssR} 的半球，底面在 xy 平面内、圆心在原点，δ = z = ρ cosφ，φ 从正 z 轴量起。把大小 F = G∭ δ·(cosφ/ρ²) dV 写成球坐标积分。补全：θ 从 [ ] 到 [ ]，φ 从 [ ] 到 [ ]，ρ 从 [ ] 到 [ ]，被积函数为 [ ]。`
      ),
      before: lang === 'zh' ? 'θ 从 ' : 'θ from ',
      between: lang === 'zh' ? [' 到 ', '，φ 从 ', ' 到 ', '，ρ 从 ', ' 到 ', '，被积函数为 '] : [' to ', ', φ from ', ' to ', ', ρ from ', ' to ', ', integrand '],
      after: lang === 'zh' ? ' dρ dφ dθ。' : ' dρ dφ dθ.',
      answers: ['0', '2π', '0', 'π/2', '0', String(ssR), 'ρcos²φsinφ'],
      tokens: ssTokens,
      hint: t('The upper hemisphere has φ only up to π/2; include the projection cosφ and the volume factor.', '上半球 φ 只到 π/2；别漏投影 cosφ 与体积因子。'),
      explanation: t(
        `θ from 0 to 2π, φ from 0 to π/2, ρ from 0 to ${ssR}; the force factor cosφ/ρ² times δ = z = ρ cosφ times the volume factor ρ² sinφ gives ρ cos²φ sinφ (P12, practice p.2).`,
        `θ 从 0 到 2π，φ 从 0 到 π/2，ρ 从 0 到 ${ssR}；力因子 cosφ/ρ² 乘 δ = z = ρ cosφ 乘体积因子 ρ² sinφ 得 ρ cos²φ sinφ（第 12 题）。`
      ),
    }),
    g.number({
      id: 'spherical-value',
      title: t('Hemisphere force over G', '半球引力除以 G'),
      prompt: t(
        `A hemisphere of radius ${svR} as above, with φ measured from the positive z-axis. Find the magnitude F divided by G. Enter one constant, for example pi/3.`,
        `半径为 ${svR} 的上半球，φ 从正 z 轴量起。求大小 F 除以 G。以单个常数输入，例如 π/3。`
      ),
      fields: [{ label: t('F/G', 'F/G'), answer: Math.PI * svR * svR / 3 }],
      hint: t('Integrate in θ, ρ and φ separately.', '分别对 θ、ρ、φ 积分。'),
      explanation: t(
        `F/G = 2π · ${svR * svR}/2 · 1/3 = ${svStr} (P12 gives π/3 for R = 1).`,
        `F/G = 2π · ${svR * svR}/2 · 1/3 = ${svStr}（R = 1 时第 12 题得 π/3）。`
      ),
      audit: { kind: 'MIT-MV-67:spherical-value', params: { R: svR } },
    }),
    g.number({
      id: 'challenge',
      title: t('Gaussian sector', '高斯扇形'),
      prompt: t(
        `Evaluate ∫0^{c}∫0^∞ e^{−r²} r dr dθ with c = ${chAngle}. No steps are given. Enter one constant, for example pi/4.`,
        `求 ∫0^{c}∫0^∞ e^{−r²} r dr dθ，其中 c = ${chAngle}。没有提示步骤。以单个常数输入，例如 π/4。`
      ),
      fields: [{ label: t('value', '值'), answer: chAns }],
      hint: t('Do the inner integral first, with u = r².', '先用 u = r² 做内层积分。'),
      explanation: t(
        `The inner integral is [−e^{−r²}/2] from 0 to ∞ = 1/2, so the outer integral gives c·1/2 = c/2; for c = ${chAngle} this is ${chHalf}. (P18 gives π/4 for c = π/2 and I = √π/2.) ${NOT_ASSESSED_EN}`,
        `内层积分 [−e^{−r²}/2] 从 0 到 ∞ = 1/2，所以外层积分给出 c·1/2 = c/2；c = ${chAngle} 时为 ${chHalf}。（第 18 题 c = π/2 得 π/4 且 I = √π/2。）${NOT_ASSESSED_ZH}`
      ),
      audit: { kind: 'MIT-MV-67:challenge', params: { cNum: ch.num, cDen: ch.den } },
    }),
  ];
};
