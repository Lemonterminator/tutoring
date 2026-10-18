import type { CardGenerator } from '../../types';
import { arrowField, ellipse, fitView, type FigureShape, type Pt } from '../../figure';
import { coef, frac, makeMvDeck, num, par, term, type Text } from '../support';

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

export const mv38: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-38');
  warm(g);

  // 1. gradient-point
  const gp = { a: g.pick([1, 2, 3]), x0: g.pick([1, 2, 3]), y0: g.pick([1, 2, 3]) };
  const gp_ans1 = gp.a * gp.y0 * gp.y0;
  const gp_ans2 = 2 * gp.a * gp.x0 * gp.y0;
  const gp_f = coef(gp.a, 'xy²');

  // 2. field-match
  const fm_variants = [
    {
      id: 'V1',
      descEn: 'Every vector has length 1 and points away from the origin.',
      descZh: '每个向量长度为 1，方向背离原点。',
      correct: '(x, y)/r',
      distractors: ['(x, y)/r²', '(−y, x)/r', '(x, y)'],
      field: (x: number, y: number): Pt => { const r = Math.sqrt(x * x + y * y); return r === 0 ? [0, 0] : [x / r, y / r]; },
      length: '1'
    },
    {
      id: 'V2',
      descEn: 'Every vector points away from the origin and has length 1/r.',
      descZh: '每个向量背离原点，长度为 1/r。',
      correct: '(x, y)/r²',
      distractors: ['(x, y)/r', '(x, y)/r³', '(−y, x)/r²'],
      field: (x: number, y: number): Pt => { const r2 = x * x + y * y; return r2 === 0 ? [0, 0] : [x / r2, y / r2]; },
      length: '1/r'
    },
    {
      id: 'V3',
      descEn: 'Every vector has length 1 and is tangent to the circles around the origin, pointing counterclockwise.',
      descZh: '每个向量长度为 1，与以原点为心的圆相切，沿逆时针方向。',
      correct: '(−y, x)/r',
      distractors: ['(y, −x)/r', '(−y, x)', '(x, y)/r'],
      field: (x: number, y: number): Pt => { const r = Math.sqrt(x * x + y * y); return r === 0 ? [0, 0] : [-y / r, x / r]; },
      length: '1'
    },
    {
      id: 'V4',
      descEn: 'Every vector has length 1 and is tangent to the circles around the origin, pointing clockwise.',
      descZh: '每个向量长度为 1，与以原点为心的圆相切，沿顺时针方向。',
      correct: '(y, −x)/r',
      distractors: ['(−y, x)/r', '(y, −x)', '(x, y)/r'],
      field: (x: number, y: number): Pt => { const r = Math.sqrt(x * x + y * y); return r === 0 ? [0, 0] : [y / r, -x / r]; },
      length: '1'
    },
    {
      id: 'V5',
      descEn: 'Every vector is the same: it points straight down and has length {g}.',
      descZh: '每个向量都相同：竖直向下，长度为 {g}。',
      correct: '(0, −{g})',
      distractors: ['(0, {g})', '({g}, 0)', '(−{g}, 0)'],
      field: (x: number, y: number): Pt => [0, -1],
      length: '{g}',
      g: g.pick([2, 3, 4])
    }
  ];
  const fm = fm_variants[g.random(0, fm_variants.length - 1)];
  const fm_descEn = fm.descEn.replace('{g}', String((fm as any).g || ''));
  const fm_descZh = fm.descZh.replace('{g}', String((fm as any).g || ''));
  const fm_correct = fm.correct.replace('{g}', String((fm as any).g || ''));
  const fm_distractors = fm.distractors.map(d => d.replace('{g}', String((fm as any).g || '')));
  const fm_len = fm.length.replace('{g}', String((fm as any).g || ''));
  const fm_options = shuffled(g, [fm_correct, ...fm_distractors]);
  const fm_correct_idx = fm_options.indexOf(fm_correct);
  const fm_xs = [-2, -1, 1, 2];
  const fm_shapes: FigureShape[] = [
    ...arrowField(fm.field, fm_xs, fm_xs, 0.9),
    { kind: 'point', at: [0, 0] as Pt, tone: 'axis' }
  ];

  // 3. radial-mag
  const rm_k = g.pick([1, 2, 3]);
  const rm_pts = [[3, 4], [4, 3], [6, 8], [8, 6], [5, 12], [12, 5], [8, 15], [15, 8]];
  const rm_pt = rm_pts[g.random(0, rm_pts.length - 1)];
  const rm_x0 = rm_pt[0], rm_y0 = rm_pt[1];
  const rm_r = Math.sqrt(rm_x0 * rm_x0 + rm_y0 * rm_y0);
  const rm_ans = rm_k / rm_r;
  const rm_f = rm_k === 1 ? '(x, y)/(x² + y²)' : `${rm_k}(x, y)/(x² + y²)`;

  // 4. electric-mag
  const em_j = g.pick([1, 2, 3]);
  const em_r5 = [[3, 4], [4, 3], [-3, 4], [4, -3], [-4, -3], [-3, -4]];
  const em_r10 = [[6, 8], [8, 6]];
  const em_use_r5 = g.random(0, 1) < 0.5;
  const em_pool = em_use_r5 ? em_r5 : em_r10;
  const em_pt = em_pool[g.random(0, em_pool.length - 1)];
  const em_x0 = em_pt[0], em_y0 = em_pt[1];
  const em_c = em_use_r5 ? 5 * em_j : 10 * em_j;
  const em_r2 = em_x0 * em_x0 + em_y0 * em_y0;
  const em_ans = em_c / em_r2;

  // 5. rotation
  const rot_w = g.pick([2, 3, 4]);
  const rot_vals = [-3, -2, -1, 1, 2, 3];
  const rot_x0 = rot_vals[g.random(0, rot_vals.length - 1)];
  const rot_y0 = retry(() => rot_vals[g.random(0, rot_vals.length - 1)], v => v !== rot_x0);
  const rot_v1 = -rot_w * rot_y0;
  const rot_v2 = rot_w * rot_x0;

  // 6. gradient-perp
  const gp_b = g.pick([2, 3, 4]);
  const gp_x0 = g.pick([1, 2, 3]);
  const gp_y0 = retry(() => g.pick([1, 2, 3]), v => v !== gp_x0 / gp_b);
  const gp_correct = `(${num(2 * gp_x0)}, ${num(2 * gp_b * gp_y0)})`;
  const gp_d1 = `(${num(gp_x0)}, ${num(gp_y0)})`;
  const gp_d2 = `(${2 * gp_b * gp_y0}, ${2 * gp_x0})`;
  const gp_d3 = `(${num(-(2 * gp_b * gp_y0))}, ${num(2 * gp_x0)})`;
  const gp_options = shuffled(g, [gp_correct, gp_d1, gp_d2, gp_d3]);
  const gp_correct_idx = gp_options.indexOf(gp_correct);

  // 7. domain-check
  const dc_h = g.pick([-2, -1, 0, 1, 2]);
  const dc_k = retry(() => g.pick([-2, -1, 0, 1, 2]), v => !(dc_h === 0 && v === 0));
  const dcShift = (v: string, c: number) => (c === 0 ? v : c > 0 ? `${v} − ${c}` : `${v} + ${-c}`);
  const dc_num = dcShift('x', dc_h);
  const dc_den = dcShift('y', dc_k);
  const dc_f = `(${dc_num}, ${dc_den})/((${dc_num})² + (${dc_den})²)`;
  const dc_correct = t(`At every point except (${num(dc_h)}, ${num(dc_k)}).`, `在除 (${num(dc_h)}, ${num(dc_k)}) 以外的每个点。`);
  const dc_d1 = t('At every point except the origin (0, 0).', '在除原点 (0, 0) 以外的每个点。');
  const dc_d2 = t(`At every point of the plane: at (${num(dc_h)}, ${num(dc_k)}) the numerator is also 0, so 0/0 can be taken as 0.`, `在平面上的每个点：在 (${num(dc_h)}, ${num(dc_k)}) 处分子也为 0，所以可以把 0/0 当作 0。`);
  const dc_d3 = t(`At every point except those on the line x = ${num(dc_h)}.`, `在除直线 x = ${num(dc_h)} 上的点以外的每个点。`);
  const dc_options = shuffled(g, [dc_correct, dc_d1, dc_d2, dc_d3]);
  const dc_correct_idx = dc_options.indexOf(dc_correct);

  // 8. source-flow
  const sf_k = g.pick([1, 2, 3]);
  const sf_a = g.pick([2, 3, 4, 5]);
  const sf_ans = 2 * sf_k * Math.PI;
  const sf_f = sf_k === 1 ? '(x, y)/(x² + y²)' : `${sf_k}(x, y)/(x² + y²)`;
  const sf_circle = ellipse(0, 0, sf_a, sf_a);
  const sf_arrows: FigureShape[] = [];
  for (let i = 0; i < 8; i++) {
    const ang = i * Math.PI / 4;
    const x = sf_a * Math.cos(ang);
    const y = sf_a * Math.sin(ang);
    sf_arrows.push({ kind: 'arrow', from: [x, y] as Pt, to: [x * 1.2, y * 1.2] as Pt, tone: 'accent' });
  }
  const sf_shapes: FigureShape[] = [
    { kind: 'line', points: [...sf_circle, sf_circle[0]], tone: 'accent', width: 2 },
    ...sf_arrows
  ];

  // 9. challenge
  const ch_d = g.pick([2, 3]);
  const ch_w = g.pick([2, 3, 4]);
  const ch_pts = [[3, 4], [4, 3], [-3, 4], [4, -3], [-4, -3], [-3, -4]];
  const ch_pt = ch_pts[g.random(0, ch_pts.length - 1)];
  const ch_x0 = ch_pt[0], ch_y0 = ch_pt[1];
  const ch_r = Math.sqrt(ch_x0 * ch_x0 + ch_y0 * ch_y0);
  const ch_ans = ch_d * ch_w * ch_r;

  return [
    g.number({
      id: 'gradient-point',
      title: t('Gradient at a point', '点处的梯度'),
      prompt: t(`Let f(x, y) = ${gp_f}. Find ∇f at the point (${num(gp.x0)}, ${num(gp.y0)}). Enter the i-component first, then the j-component.`,
        `设 f(x, y) = ${gp_f}。求 ∇f 在点 (${num(gp.x0)}, ${num(gp.y0)}) 处的值，先填 i 分量，再填 j 分量。`),
      fields: [
        { label: t('f_x', 'f_x'), answer: gp_ans1 },
        { label: t('f_y', 'f_y'), answer: gp_ans2 }
      ],
      hint: t('∇f = (f_x, f_y); differentiate with the other variable held constant.', '∇f = (f_x, f_y)；对一个变量求导时，把另一个变量当作常数。'),
      explanation: t(`f_x = ${coef(gp.a, 'y²')} = ${gp_ans1} and f_y = ${2 * gp.a}xy = ${gp_ans2} at (${num(gp.x0)}, ${num(gp.y0)}).`,
        `在 (${num(gp.x0)}, ${num(gp.y0)}) 处 f_x = ${coef(gp.a, 'y²')} = ${gp_ans1}，f_y = ${2 * gp.a}xy = ${gp_ans2}。`),
      audit: { kind: 'MIT-MV-38:gradient-point', params: { a: gp.a, x0: gp.x0, y0: gp.y0 } }
    }),
    g.choice({
      id: 'field-match',
      title: t('Match the vector field', '匹配向量场'),
      prompt: t(`The picture shows a vector field (arrows drawn at some points around the origin). ${fm_descEn} Which formula describes it? (r = √(x² + y²))`,
        `图中是一个向量场（在原点周围若干点画出了箭头）。${fm_descZh}哪个公式描述这个场？（r = √(x² + y²)）`),
      options: fm_options,
      correct: fm_correct_idx,
      figure: g.figure({
        alt: t(`Vector field: ${fm_descEn}`, `向量场：${fm_descZh}`),
        view: fitView(fm_shapes, 0.2),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: fm_shapes
      }),
      hint: t('Compare the direction and the length of the arrows with each formula.', '把箭头的方向和长度与各公式比较。'),
      explanation: t(fm.id === 'V5'
        ? `F = ${fm_correct} is constant and points straight down; |F| = −F_y.`
        : `The formula F = ${fm_correct} has the stated direction and length (|F| = ${fm_len}). ${fm_descEn}`,
        fm.id === 'V5'
          ? `F = ${fm_correct} 是常向量场，竖直向下；|F| = −F_y。`
          : `公式 F = ${fm_correct} 具有所述方向和长度（|F| = ${fm_len}）。${fm_descZh}`)
    }),
    g.number({
      id: 'radial-mag',
      title: t('Magnitude of a radial field', '径向场的大小'),
      prompt: t(`The field is F(x, y) = ${rm_f}. Find the magnitude |F| at the point (${rm_x0}, ${rm_y0}). Enter an integer or a fraction.`,
        `向量场为 F(x, y) = ${rm_f}。求点 (${rm_x0}, ${rm_y0}) 处的大小 |F|（填整数或分数）。`),
      fields: [{ label: t('|F|', '|F|'), answer: rm_ans }],
      hint: t('|(x, y)| = r, so |F| = ' + (rm_k === 1 ? 'r/r²' : `${rm_k}·r/r²`) + '.', '|(x, y)| = r，所以 |F| = ' + (rm_k === 1 ? 'r/r²' : `${rm_k}·r/r²`) + '。'),
      explanation: t(`At (${rm_x0}, ${rm_y0}) r = ${rm_r}, so |F| = ${rm_k}/r = ${frac(rm_k, rm_r)}: the field gets weaker like 1/r.`,
        `在 (${rm_x0}, ${rm_y0}) 处 r = ${rm_r}，所以 |F| = ${rm_k}/r = ${frac(rm_k, rm_r)}：场按 1/r 衰减。`),
      audit: { kind: 'MIT-MV-38:radial-mag', params: { k: rm_k, x0: rm_x0, y0: rm_y0 } }
    }),
    g.number({
      id: 'electric-mag',
      title: t('Magnitude of an electric field', '电场的大小'),
      prompt: t(`A unit positive charge at the origin produces the force field F(x, y) = ${em_c}(x, y)/(x² + y²)^{3/2}. Find |F| at the point (${num(em_x0)}, ${num(em_y0)}). Enter an integer or a fraction.`,
        `原点处的单位正电荷产生力场 F(x, y) = ${em_c}(x, y)/(x² + y²)^{3/2}。求点 (${num(em_x0)}, ${num(em_y0)}) 处的 |F|（填整数或分数）。`),
      fields: [{ label: t('|F|', '|F|'), answer: em_ans }],
      hint: t('|(x, y)| = r and (x² + y²)^{3/2} = r³.', '|(x, y)| = r，且 (x² + y²)^{3/2} = r³。'),
      explanation: t(`r² = ${em_r2} at (${num(em_x0)}, ${num(em_y0)}), so |F| = ${em_c}·r/r³ = ${em_c}/r² = ${frac(em_c, em_r2)}. A point charge weakens like 1/r², not 1/r.`,
        `在 (${num(em_x0)}, ${num(em_y0)}) 处 r² = ${em_r2}，所以 |F| = ${em_c}·r/r³ = ${em_c}/r² = ${frac(em_c, em_r2)}。点电荷的场按 1/r² 衰减，而不是 1/r。`),
      audit: { kind: 'MIT-MV-38:electric-mag', params: { c: em_c, x0: em_x0, y0: em_y0 } }
    }),
    g.number({
      id: 'rotation',
      title: t('Velocity of a rotating fluid', '旋转流体的速度'),
      prompt: t(`A fluid of density 1 rotates counterclockwise about the origin with constant angular velocity ω = ${rot_w}. Find its velocity vector v at the point (${num(rot_x0)}, ${num(rot_y0)}). Enter the i-component first, then the j-component.`,
        `密度为 1 的流体绕原点逆时针匀速旋转，角速度 ω = ${rot_w}。求点 (${num(rot_x0)}, ${num(rot_y0)}) 处的速度向量 v，先填 i 分量，再填 j 分量。`),
      fields: [
        { label: t('v_i', 'v_i'), answer: rot_v1 },
        { label: t('v_j', 'v_j'), answer: rot_v2 }
      ],
      hint: t('A vector perpendicular to (x, y) counterclockwise is (−y, x), with length r; multiply by ω.', '逆时针方向且垂直于 (x, y) 的向量是 (−y, x)，长度为 r；再乘以 ω。'),
      explanation: t(`v = ω(−y, x) = ${rot_w}·(${num(-rot_y0)}, ${num(rot_x0)}) = (${num(rot_v1)}, ${num(rot_v2)}); its length is ω·r.`,
        `v = ω(−y, x) = ${rot_w}·(${num(-rot_y0)}, ${num(rot_x0)}) = (${num(rot_v1)}, ${num(rot_v2)})；其长度为 ω·r。`),
      audit: { kind: 'MIT-MV-38:rotation', params: { w: rot_w, x0: rot_x0, y0: rot_y0 } }
    }),
    g.choice({
      id: 'gradient-perp',
      title: t('Perpendicular to a contour', '垂直于等值线'),
      prompt: t(`Let f(x, y) = x² + ${gp_b}y². Which vector is perpendicular to the contour curve of f through the point (${num(gp_x0)}, ${num(gp_y0)}) at that point?`,
        `设 f(x, y) = x² + ${gp_b}y²。通过点 (${num(gp_x0)}, ${num(gp_y0)}) 的 f 的等值线在该点处，下列哪个向量与它垂直？`),
      options: gp_options,
      correct: gp_correct_idx,
      hint: t('The gradient is perpendicular to the contour curves.', '梯度垂直于等值线。'),
      explanation: t(`∇f = (2x, 2·${gp_b}y) = (${num(2 * gp_x0)}, ${num(2 * gp_b * gp_y0)}) at (${num(gp_x0)}, ${num(gp_y0)}). The position vector (${num(gp_x0)}, ${num(gp_y0)}) would only work for circles (b = 1), and (${num(-(2 * gp_b * gp_y0))}, ${num(2 * gp_x0)}) is tangent to the contour, not perpendicular.`,
        `在 (${num(gp_x0)}, ${num(gp_y0)}) 处 ∇f = (2x, 2·${gp_b}y) = (${num(2 * gp_x0)}, ${num(2 * gp_b * gp_y0)})。位置向量 (${num(gp_x0)}, ${num(gp_y0)}) 只对圆（b = 1）成立；(${num(-(2 * gp_b * gp_y0))}, ${num(2 * gp_x0)}) 是等值线的切向量，不是法向量。`)
    }),
    g.choice({
      id: 'domain-check',
      title: t('Domain of a vector field', '向量场的定义域'),
      prompt: t(`The vector field is F(x, y) = ${dc_f}. At which points is F defined?`,
        `向量场为 F(x, y) = ${dc_f}。F 在哪些点有定义？`),
      options: dc_options,
      correct: dc_correct_idx,
      hint: t('Where is the denominator 0?', '分母在哪里为 0？'),
      explanation: t(`The denominator (x ${term(-dc_h)})² + (y ${term(-dc_k)})² is 0 only at (${num(dc_h)}, ${num(dc_k)}), where F has no value. F is defined, and continuously differentiable, everywhere else.`,
        `分母 (x ${term(-dc_h)})² + (y ${term(-dc_k)})² 只在 (${num(dc_h)}, ${num(dc_k)}) 处为 0，那里 F 没有定义。其他各点 F 都有定义且连续可微。`)
    }),
    g.number({
      id: 'source-flow',
      title: t('Flow out of a circle', '流出圆的质量'),
      prompt: t(`The flow field F(x, y) = ${sf_f} gives mass per unit length per second. On the circle x² + y² = ${sf_a}² it points radially outward. Find the total mass per second that flows out through the circle (the magnitude of F times the circumference). Give the answer as a multiple of π.`,
        `流场 F(x, y) = ${sf_f} 表示单位长度单位时间的质量输运率。在圆 x² + y² = ${sf_a}² 上它沿径向向外。求每秒从该圆流出的总质量（F 的大小乘以周长），答案写成 π 的倍数。`),
      fields: [{ label: t('rate', 'rate'), answer: sf_ans }],
      figure: g.figure({
        alt: t(`Circle of radius ${sf_a} with outward arrows.`, `半径为 ${sf_a} 的圆，带有向外箭头。`),
        view: fitView(sf_shapes, 0.2),
        axes: { xLabel: 'x', yLabel: 'y', grid: true },
        shapes: sf_shapes
      }),
      hint: t(`At each point the mass transport rate is |F|; multiply by the length of the circle, 2π·${sf_a}.`, `每点的质量输运率是 |F|；再乘以圆的周长 2π·${sf_a}。`),
      explanation: t(`|F| = ${sf_k}/${sf_a} on the circle, so the flow out is (${sf_k}/${sf_a})·2π·${sf_a} = ${sf_k}·2π. It does not depend on the radius.`,
        `圆上 |F| = ${sf_k}/${sf_a}，所以流出量为 (${sf_k}/${sf_a})·2π·${sf_a} = ${sf_k}·2π，与半径无关。`),
      audit: { kind: 'MIT-MV-38:source-flow', params: { k: sf_k, a: sf_a } }
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: mass transport in rotation', '挑战：旋转中的质量输运'),
      prompt: t(`A fluid of constant density ${ch_d} rotates counterclockwise about the origin with angular velocity ω = ${ch_w}. Its flow field is F = δ·v. Find |F|, the rate of mass transport, at the point (${num(ch_x0)}, ${num(ch_y0)}).`,
        `密度为常数 ${ch_d} 的流体绕原点逆时针旋转，角速度 ω = ${ch_w}。它的流场是 F = δ·v。求点 (${num(ch_x0)}, ${num(ch_y0)}) 处的 |F|（质量输运率）。`),
      fields: [{ label: t('|F|', '|F|'), answer: ch_ans }],
      hint: t('F = δ v, |v| = ω r and r = √(x² + y²).', 'F = δ v，|v| = ω r，r = √(x² + y²)。'),
      explanation: t(`|v| = ω·r = ${ch_w}·${ch_r}, so |F| = δ·|v| = ${ch_d}·${ch_w}·${ch_r} = ${ch_ans}. This game does not assess line integrals, divergence or curl.`,
        `|v| = ω·r = ${ch_w}·${ch_r}，所以 |F| = δ·|v| = ${ch_d}·${ch_w}·${ch_r} = ${ch_ans}。本游戏不考查线积分、散度和旋度。`),
      audit: { kind: 'MIT-MV-38:challenge', params: { d: ch_d, w: ch_w, x0: ch_x0, y0: ch_y0 } }
    })
  ];
};
