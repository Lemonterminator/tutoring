import type { CardGenerator } from '../../types';
import { arrow3d, axes3d, fitView, graphOf, line3d, project3d, wire3d, type FigureShape, type Pt3 } from '../../figure';
import { coef, frac, makeMvDeck, num, par, type Text } from '../support';

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

export const mv55: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-55');
  warm(g);

  // --- ndS-graph ---
  const ng = {
    a: g.pick([1, 2, 3]),
    b: g.pick([1, 2, 3]),
    c: g.pick([1, 2, 3]),
    x0: g.pick([1, 2, 3]),
    y0: g.pick([1, 2, 3]),
  };
  const ng_fx = 2 * ng.a * ng.x0 + ng.b * ng.y0;
  const ng_fy = ng.b * ng.x0 + ng.c;
  const ng_A = -ng_fx;
  const ng_B = -ng_fy;
  const ng_f_str = `${coef(ng.a, 'x²')} + ${coef(ng.b, 'xy')} + ${coef(ng.c, 'y')}`;
  const ng_fx_str = `${coef(2 * ng.a, 'x')} + ${coef(ng.b, 'y')}`;
  const ng_fy_str = `${coef(ng.b, 'x')} + ${ng.c}`;

  // --- side-choice ---
  const sc_case = g.pick([1, 2, 3, 4]);
  const sc_p = g.pick([1, 2, 3]);
  const sc_H = g.pick([2, 3, 4]);
  const sc_2p = 2 * sc_p;
  const sc_2px = coef(sc_2p, 'x');
  const sc_2py = coef(sc_2p, 'y');

  let sc_prompt_en: string, sc_prompt_zh: string;
  let sc_correct_idx: number;
  const sc_opts = [
    `(${sc_2px}, ${sc_2py}, 1) dx dy`,
    `(−${sc_2px}, −${sc_2py}, 1) dx dy`,
    `(${sc_2px}, ${sc_2py}, −1) dx dy`,
    `(−${sc_2px}, −${sc_2py}, −1) dx dy`,
  ];

  if (sc_case === 1) {
    sc_prompt_en = `S is the part of the paraboloid z = ${coef(sc_p, '(x² + y²)')} below the plane z = ${sc_H}; the normal n points away from the z-axis (outward from the bowl). Which of these is n dS?`;
    sc_prompt_zh = `S 是抛物面 z = ${coef(sc_p, '(x² + y²)')} 在平面 z = ${sc_H} 下方的部分，法向量 n 背离 z 轴（指向碗的外侧）。下面哪个是 n dS？`;
    sc_correct_idx = 2;
  } else if (sc_case === 2) {
    sc_prompt_en = `S is the part of the paraboloid z = ${coef(sc_p, '(x² + y²)')} below the plane z = ${sc_H}; the normal n points up (positive z-component). Which of these is n dS?`;
    sc_prompt_zh = `S 是抛物面 z = ${coef(sc_p, '(x² + y²)')} 在平面 z = ${sc_H} 下方的部分，法向量 n 向上（z 分量为正）。下面哪个是 n dS？`;
    sc_correct_idx = 1;
  } else if (sc_case === 3) {
    sc_prompt_en = `S is the part of the paraboloid z = ${sc_H} − ${coef(sc_p, '(x² + y²)')} above the xy-plane; the normal n points away from the z-axis (outward from the dome). Which of these is n dS?`;
    sc_prompt_zh = `S 是抛物面 z = ${sc_H} − ${coef(sc_p, '(x² + y²)')} 在 xy 平面上方的部分，法向量 n 背离 z 轴（指向圆顶的外侧）。下面哪个是 n dS？`;
    sc_correct_idx = 0;
  } else {
    sc_prompt_en = `S is the part of the paraboloid z = ${sc_H} − ${coef(sc_p, '(x² + y²)')} above the xy-plane; the normal n points down (negative z-component). Which of these is n dS?`;
    sc_prompt_zh = `S 是抛物面 z = ${sc_H} − ${coef(sc_p, '(x² + y²)')} 在 xy 平面上方的部分，法向量 n 向下（z 分量为负）。下面哪个是 n dS？`;
    sc_correct_idx = 3;
  }

  // --- ndS-implicit ---
  const ni_bases = [
    { u: 1, v: 2, w: 2, a: 3 },
    { u: 2, v: 4, w: 4, a: 6 },
    { u: 2, v: 3, w: 6, a: 7 },
    { u: 1, v: 4, w: 8, a: 9 },
    { u: 4, v: 4, w: 7, a: 9 },
  ];
  const ni_base = g.pick(ni_bases);
  const ni_entries = [ni_base.u, ni_base.v, ni_base.w];
  const ni_z0_idx = g.pick([0, 1, 2]);
  const ni_z0 = ni_entries[ni_z0_idx];
  const ni_xy = ni_entries.filter((_, i) => i !== ni_z0_idx);
  const ni_swap = g.pick([true, false]);
  const ni_x0_abs = ni_swap ? ni_xy[1] : ni_xy[0];
  const ni_y0_abs = ni_swap ? ni_xy[0] : ni_xy[1];
  const ni_x0 = g.pick([1, -1]) * ni_x0_abs;
  const ni_y0 = g.pick([1, -1]) * ni_y0_abs;
  const ni_A = ni_x0 / ni_z0;
  const ni_B = ni_y0 / ni_z0;

  // --- dome-setup ---
  const ds_H = g.pick([1, 2, 3]);
  const ds_c = retry(() => g.pick([1, 2, 3, 4, 5]), v => v !== 2 * ds_H);
  const ds_const = ds_c - 2 * ds_H;
  const ds_integrand = `4x² + 4y² ${ds_const >= 0 ? '+' : '−'} ${Math.abs(ds_const)}`;
  const ds_tokens = [
    '2x', '−2x', '2y', '−2y',
    ds_integrand,
    `4x² + 4y² ${ds_const >= 0 ? '−' : '+'} ${Math.abs(ds_const)}`,
    `2x² + 2y² + ${ds_c} − 2z`
  ];

  // --- cylinder-setup ---
  const cs_a = g.pick([2, 3, 4, 5]);
  const cs_h = retry(() => g.pick([2, 3, 4, 5]), v => v !== cs_a);
  const cs_fn = `z cos θ + ${cs_a} sin θ cos θ`;
  const cs_tokens = [
    cs_fn,
    `${cs_a}z cos θ + ${cs_a * cs_a} sin θ cos θ`,
    `z cos θ + sin θ cos θ`,
    String(cs_a),
    '1',
    String(cs_h),
    'π/2',
    'π',
    '2π'
  ];

  // --- cylinder-flux ---
  const cf_a = g.pick([2, 3, 4, 5]);
  const cf_h = retry(() => g.pick([2, 3, 4, 5]), v => v !== cf_a);
  const cf_ans = cf_a * cf_h * (cf_a + cf_h) / 2;

  // --- sphere-setup ---
  const [ss_k, ss_a] = retry(
    () => [g.pick([2, 3, 4]), g.pick([2, 3, 4, 5])] as [number, number],
    ([k, a]) => k !== a && new Set([`${k * a * a} cos φ`, `${k * a} cos φ`, `${a * a} cos φ`, `${k * a * a} sin φ`, `${k * a ** 4} cos φ sin φ`, `${k * a * a} cos φ sin φ`, `${k * a ** 4} cos² φ sin φ`, `${a ** 4} cos φ sin φ`]).size === 8
  );
  const ss_ka2 = ss_k * ss_a * ss_a;
  const ss_ka4 = ss_k * ss_a ** 4;
  const ss_ans1 = `${ss_ka2} cos φ`;
  const ss_ans2 = `${ss_ka4} cos φ sin φ`;
  const ss_tokens = [
    ss_ans1,
    `${ss_k * ss_a} cos φ`,
    `${ss_a * ss_a} cos φ`,
    `${ss_ka2} sin φ`,
    ss_ans2,
    `${ss_ka2} cos φ sin φ`,
    `${ss_ka4} cos² φ sin φ`,
    `${ss_a ** 4} cos φ sin φ`
  ];

  // --- sphere-flux ---
  const sf_k = g.pick([2, 3, 4]);
  const sf_a = g.pick([2, 4, 6]);
  const sf_K = sf_k * sf_a ** 4 / 4;

  // --- challenge ---
  const ch_H = g.pick([1, 2, 3]);
  const ch_c = retry(() => g.pick([1, 2, 3, 4, 5]), v => v !== 2 * ch_H);
  const ch_K = ch_H * (2 * ch_H - ch_c);

  // --- Figures ---
  const zh = lang === 'zh';
  // side-choice figure: the surface, one point P on it and a text naming the side the prompt states (away from the z-axis,
  // up or down). No arrow: the true normal would give away the signs this card asks for, and any other arrow labelled n
  // would be a wrong normal.
  const sc_bowl = sc_case === 1 || sc_case === 2;
  const sc_s = Math.sqrt(sc_H / sc_p);
  const sc_px = sc_s / 2, sc_pz = sc_bowl ? sc_p * sc_px * sc_px : sc_H - sc_p * sc_px * sc_px;
  const sc_len = 0.22 * Math.max(2 * sc_s, sc_H);
  const sc_surface = sc_bowl ? graphOf((x: number) => sc_p * x * x, -sc_s, sc_s) : graphOf((x: number) => sc_H - sc_p * x * x, -sc_s, sc_s);
  const sc_shapes: FigureShape[] = [
    { kind: 'line', points: sc_surface, tone: 'accent' },
    { kind: 'line', points: [[-sc_s, sc_bowl ? sc_H : 0], [sc_s, sc_bowl ? sc_H : 0]], tone: 'muted' },
    { kind: 'point', at: [sc_px, sc_pz], tone: 'warn' },
  ];
  const sc_M = Math.max(2 * sc_s, sc_H);
  // the label sits outside the curve, right of P: below-right for the bowl, above-right for the dome
  const sc_label = sc_case === 1 || sc_case === 3
    ? (zh ? 'n 背离 z 轴' : 'n away from the z-axis')
    : sc_case === 2 ? (zh ? 'n 向上' : 'n up') : (zh ? 'n 向下' : 'n down');
  sc_shapes.push({ kind: 'text', at: [sc_px + 0.08 * sc_len, sc_pz + (sc_bowl ? -0.12 : 0.08) * sc_M], text: sc_label, tone: 'accent2', anchor: 'start' });
  const sc_dirEn = sc_case === 1 || sc_case === 3 ? 'away from the z-axis' : sc_case === 2 ? 'up' : 'down';
  const sc_dirZh = sc_case === 1 || sc_case === 3 ? '背离 z 轴' : sc_case === 2 ? '向上' : '向下';

  // ndS-implicit figure: oblique 3D view of the upper hemisphere, the point P and the segment O-P
  const ni_shapes: FigureShape[] = [
    ...axes3d(ni_base.a + 1),
    ...wire3d((phi, th): Pt3 => [ni_base.a * Math.sin(phi) * Math.cos(th), ni_base.a * Math.sin(phi) * Math.sin(th), ni_base.a * Math.cos(phi)], 0, Math.PI / 2, 0, 2 * Math.PI, 4, 12, 24),
    line3d([[0, 0, 0], [ni_x0, ni_y0, ni_z0]], 'warn', { dash: true, width: 1.5 }),
    { kind: 'point', at: project3d([ni_x0, ni_y0, ni_z0]), tone: 'warn', label: 'P' },
  ];

  // dome-setup figure: the true upward normal (2x, 1) at x = s/2 (the prompt already states "up, away from the z-axis")
  const ds_s = Math.sqrt(ds_H);
  const ds_shapes: FigureShape[] = [
    { kind: 'line', points: graphOf((x: number) => ds_H - x * x, -ds_s, ds_s), tone: 'accent' },
    { kind: 'line', points: [[-ds_s, 0], [ds_s, 0]], tone: 'muted' },
  ];
  const ds_px = ds_s / 2, ds_pz = ds_H - (ds_s / 2) ** 2;
  const ds_nx = 2 * ds_px, ds_norm = Math.hypot(ds_nx, 1), ds_len = 0.3 * Math.max(2 * ds_s, ds_H);
  ds_shapes.push({ kind: 'arrow', from: [ds_px, ds_pz], to: [ds_px + ds_len * ds_nx / ds_norm, ds_pz + ds_len / ds_norm], tone: 'accent2', label: 'n' });

  // quarter cylinder x^2 + y^2 = a^2, 0 <= z <= h in the first octant, 3D, with the outward normal at theta = pi/4, z = h/2
  const cylinderFigure = (a: number, h: number): FigureShape[] => {
    const wall = (th: number, z: number): Pt3 => [a * Math.cos(th), a * Math.sin(th), z];
    const from = wall(Math.PI / 4, h / 2), out = 0.45 * Math.max(a, h);
    return [
      ...axes3d(Math.max(a, h) + 1),
      ...wire3d(wall, 0, Math.PI / 2, 0, h, 6, 3, 16),
      arrow3d(from, [from[0] + out * Math.cos(Math.PI / 4), from[1] + out * Math.sin(Math.PI / 4), from[2]], 'accent2', 'n'),
    ];
  };
  const cs_shapes = cylinderFigure(cs_a, cs_h);
  const cf_shapes = cylinderFigure(cf_a, cf_h);

  // first-octant patch of the sphere of radius a, 3D, with the outward normal at phi = theta = pi/4
  const sphereFigure = (a: number): FigureShape[] => {
    const ball = (phi: number, th: number): Pt3 => [a * Math.sin(phi) * Math.cos(th), a * Math.sin(phi) * Math.sin(th), a * Math.cos(phi)];
    const from = ball(Math.PI / 4, Math.PI / 4);
    return [
      ...axes3d(a + 1),
      ...wire3d(ball, 0, Math.PI / 2, 0, Math.PI / 2, 4, 4, 16),
      arrow3d(from, [from[0] * 1.4, from[1] * 1.4, from[2] * 1.4], 'accent2', 'n'),
    ];
  };
  const ss_shapes = sphereFigure(ss_a);
  const sf_shapes = sphereFigure(sf_a);

  return [
    g.number({
      id: 'ndS-graph',
      title: t('n dS for a graph', '曲面 z = f(x, y) 的 n dS'),
      prompt: t(
        `S is the graph of z = f(x, y) = ${ng_f_str}. Take the upward side of S (the normal has positive z-component). At the point (x, y) = (${ng.x0}, ${ng.y0}) the vector n dS equals (A, B, 1) dx dy. Enter A and B.`,
        `S 是函数 z = f(x, y) = ${ng_f_str} 的图像（系数为 1 时不写）。取 S 的上侧（法向量的 z 分量为正）。在点 (x, y) = (${ng.x0}, ${ng.y0}) 处，向量 n dS 等于 (A, B, 1) dx dy。求 A 和 B。`
      ),
      fields: [
        { label: t('A', 'A'), answer: ng_A },
        { label: t('B', 'B'), answer: ng_B },
      ],
      hint: t(
        'For the upward side n dS = (−f_x, −f_y, 1) dx dy. Differentiate f with respect to x and to y, then put in the point.',
        '上侧的 n dS = (−f_x, −f_y, 1) dx dy。先求 f 对 x 和对 y 的偏导数，再代入该点。'
      ),
      explanation: t(
        `f_x = ${ng_fx_str} = ${num(ng_fx)} and f_y = ${ng_fy_str} = ${num(ng_fy)} at (${ng.x0}, ${ng.y0}). For the upward side n dS = (−f_x, −f_y, 1) dx dy = (${num(ng_A)}, ${num(ng_B)}, 1) dx dy.`,
        `f_x = ${ng_fx_str}，在 (${ng.x0}, ${ng.y0}) 处等于 ${num(ng_fx)}；f_y = ${ng_fy_str}，在该点等于 ${num(ng_fy)}。上侧的 n dS = (−f_x, −f_y, 1) dx dy = (${num(ng_A)}, ${num(ng_B)}, 1) dx dy。`
      ),
      audit: { kind: 'MIT-MV-55:ndS-graph', params: { a: ng.a, b: ng.b, c: ng.c, x0: ng.x0, y0: ng.y0 } },
    }),
    g.choice({
      id: 'side-choice',
      title: t('Which sign pattern?', '哪种符号？'),
      prompt: t(sc_prompt_en, sc_prompt_zh),
      options: sc_opts.map(s => t(s, s)),
      correct: sc_correct_idx,
      hint: t(
        'For z = f(x, y) the upward vector is (−f_x, −f_y, 1) dx dy. Which z-sign does the stated side need, and what is f_x here?',
        '对 z = f(x, y)，上侧的向量是 (−f_x, −f_y, 1) dx dy。所述一侧需要 z 分量取什么符号？这里 f_x 是多少？'
      ),
      explanation: t(
        `Here f = ${coef(sc_p, '(x² + y²)')} or ${sc_H} − ${coef(sc_p, '(x² + y²)')}. The correct sign pattern matches the stated orientation.`,
        `这里 f 是抛物面方程。正确的符号模式与所述的法向方向一致。`
      ),
      figure: g.figure({
        alt: t(
          `Side view in the xz-plane of the paraboloid ${sc_bowl ? 'bowl' : 'dome'} cut off by the plane ${sc_bowl ? `z = ${sc_H}` : 'z = 0'}; beside a marked point of the surface a label repeats the stated side of n: ${sc_dirEn}.`,
          `xz 平面内的侧视图：抛物面${sc_bowl ? '碗' : '圆顶'}，被平面 ${sc_bowl ? `z = ${sc_H}` : 'z = 0'} 截取；曲面上标出的一点旁，文字重复题中所述 n 的一侧：${sc_dirZh}。`
        ),
        view: fitView(sc_shapes, 0.25),
        shapes: sc_shapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
    }),
    g.number({
      id: 'ndS-implicit',
      title: t('n dS from a normal vector', '由法向量求 n dS'),
      prompt: t(
        `S is the upper part (z > 0) of the sphere x² + y² + z² = ${ni_base.a}², with n pointing up. For any vector N normal to S, n dS = (N / (N · k)) dx dy. Take N = (x, y, z). At the point (${num(ni_x0)}, ${num(ni_y0)}, ${ni_z0}) of S, n dS = (A, B, 1) dx dy. Enter A and B as integers or fractions.`,
        `S 是球面 x² + y² + z² = ${ni_base.a}² 的上半部分（z > 0），n 指向上方。对 S 的任一法向量 N，有 n dS = (N / (N · k)) dx dy。取 N = (x, y, z)。在 S 上的点 (${num(ni_x0)}, ${num(ni_y0)}, ${ni_z0}) 处，n dS = (A, B, 1) dx dy。求 A 和 B，填写整数或分数。`
      ),
      fields: [
        { label: t('A', 'A'), answer: ni_A },
        { label: t('B', 'B'), answer: ni_B },
      ],
      hint: t(
        'N · k is the z-component of N. Divide N by it.',
        'N · k 是 N 的 z 分量。把 N 除以它。'
      ),
      explanation: t(
        `N = (x, y, z), so N · k = z and n dS = (x/z, y/z, 1) dx dy. At (${num(ni_x0)}, ${num(ni_y0)}, ${ni_z0}) this is (${frac(ni_x0, ni_z0)}, ${frac(ni_y0, ni_z0)}, 1).`,
        `N = (x, y, z)，所以 N · k = z，n dS = (x/z, y/z, 1) dx dy。在 (${num(ni_x0)}, ${num(ni_y0)}, ${ni_z0}) 处为 (${frac(ni_x0, ni_z0)}, ${frac(ni_y0, ni_z0)}, 1)。`
      ),
      figure: g.figure({
        alt: t(`Oblique 3D view with the x, y and z axes: the upper half of the sphere of radius ${ni_base.a} as a wireframe, the point P marked on it and a dashed segment from the origin to P.`, `带 x、y、z 轴的斜视立体图：半径为 ${ni_base.a} 的球的上半部分（线框），其上标出点 P，虚线段从原点连到 P。`),
        view: fitView(ni_shapes, 0.15),
        shapes: ni_shapes,
      }),
      audit: { kind: 'MIT-MV-55:ndS-implicit', params: { a: ni_base.a, x0: ni_x0, y0: ni_y0, z0: ni_z0 } },
    }),
    g.symbols({
      id: 'dome-setup',
      title: t('Set up a flux through a dome', '穹顶通量的列式'),
      prompt: t(
        `S is the part of the paraboloid z = ${ds_H} − x² − y² above the xy-plane, with n pointing up (away from the z-axis), and F = x i + y j + (${ds_c} − 2z) k. Then n dS = (A, B, 1) dx dy. Complete A and B and the integrand of the flux ∬_S F · n dS = ∬_R (integrand) dx dy, where z has been replaced by ${ds_H} − x² − y².`,
        `S 是抛物面 z = ${ds_H} − x² − y² 在 xy 平面上方的部分，n 指向上方（背离 z 轴），F = x i + y j + (${ds_c} − 2z) k。于是 n dS = (A, B, 1) dx dy。补全 A、B 和通量 ∬_S F · n dS = ∬_R（被积函数）dx dy 的被积函数，其中 z 已用 ${ds_H} − x² − y² 代替。`
      ),
      before: 'n dS = (',
      between: lang === 'zh' ? [', ', ', 1) dx dy，F · n dS = ('] : [', ', ', 1) dx dy, and F · n dS = ('],
      after: ') dx dy',
      answers: ['2x', '2y', ds_integrand],
      tokens: shuffled(g, ds_tokens),
      hint: t(
        `Here f = ${ds_H} − x² − y², so f_x = −2x. For the upward side n dS = (−f_x, −f_y, 1) dx dy. Then F · n dS = x·A + y·B + (${ds_c} − 2z), and z = ${ds_H} − x² − y².`,
        `这里 f = ${ds_H} − x² − y²，所以 f_x = −2x。上侧的 n dS = (−f_x, −f_y, 1) dx dy。于是 F · n dS = x·A + y·B + (${ds_c} − 2z)，而 z = ${ds_H} − x² − y²。`
      ),
      explanation: t(
        `f_x = −2x and f_y = −2y, so for the upward side n dS = (2x, 2y, 1) dx dy. Then F · n dS = 2x² + 2y² + ${ds_c} − 2z, and with z = ${ds_H} − x² − y² this is ${ds_integrand}.`,
        `f_x = −2x 且 f_y = −2y，所以上侧的 n dS = (2x, 2y, 1) dx dy。于是 F · n dS = 2x² + 2y² + ${ds_c} − 2z，代入 z = ${ds_H} − x² − y² 得 ${ds_integrand}。`
      ),
      figure: g.figure({
        alt: t(`Side view in the xz-plane of the paraboloid dome z = ${ds_H} − x² − y²; at a point on the right half an arrow n points up and away from the z-axis, perpendicular to the curve.`, `xz 平面内抛物面穹顶 z = ${ds_H} − x² − y² 的侧视图；在右半部分的一点处，箭头 n 向上并背离 z 轴，垂直于曲线。`),
        view: fitView(ds_shapes, 0.25),
        shapes: ds_shapes,
        axes: { xLabel: 'x', yLabel: 'z', grid: true },
      }),
    }),
    g.symbols({
      id: 'cylinder-setup',
      title: t('Set up a flux through a cylinder', '圆柱面通量的列式'),
      prompt: t(
        `S is the part of the cylinder x² + y² = ${cs_a}² with x, y, z ≥ 0 and z ≤ ${cs_h}. F = z i + x j + y k and n points outward, away from the z-axis, so n = (x, y, 0)/${cs_a}. Parametrize S by x = ${cs_a} cos θ, y = ${cs_a} sin θ, z = z. Complete: F · n = (the expression in z and θ); the area element is dS = (factor) dz dθ; and θ runs from 0 to the last blank.`,
        `S 是圆柱面 x² + y² = ${cs_a}² 上满足 x、y、z ≥ 0 且 z ≤ ${cs_h} 的部分。F = z i + x j + y k，n 指向外侧（背离 z 轴），所以 n = (x, y, 0)/${cs_a}。用 x = ${cs_a} cos θ，y = ${cs_a} sin θ，z = z 参数化 S。补全：F · n（用 z 和 θ 表示）；面积元 dS =（因子）dz dθ；θ 从 0 变到最后一个空。`
      ),
      before: 'F · n = ',
      between: lang === 'zh' ? ['，dS = ', ' dz dθ，θ 从 0 到 '] : [', dS = ', ' dz dθ, θ from 0 to '],
      after: lang === 'zh' ? '。' : '.',
      answers: [cs_fn, String(cs_a), 'π/2'],
      tokens: shuffled(g, cs_tokens),
      hint: t(
        `x = ${cs_a} cos θ and y = ${cs_a} sin θ, so F · n = (z x + x y)/${cs_a}. A small piece of S is a curved rectangle of height dz and width ${cs_a} dθ.`,
        `x = ${cs_a} cos θ，y = ${cs_a} sin θ，所以 F · n = (z x + x y)/${cs_a}。S 上的小块是高为 dz、宽为 ${cs_a} dθ 的曲边矩形。`
      ),
      explanation: t(
        `F · n = (z x + x y)/${cs_a} = ${cs_fn}. The small piece has height dz and width ${cs_a} dθ, so dS = ${cs_a} dz dθ. The first octant means x, y ≥ 0, that is 0 ≤ θ ≤ π/2.`,
        `F · n = (z x + x y)/${cs_a} = ${cs_fn}。小块的高是 dz、宽是 ${cs_a} dθ，所以 dS = ${cs_a} dz dθ。第一卦限意味着 x、y ≥ 0，即 0 ≤ θ ≤ π/2。`
      ),
      figure: g.figure({
        alt: t(`Oblique 3D view with the x, y and z axes: the quarter of the cylinder x² + y² = ${cs_a}² in the first octant, up to height ${cs_h}, as a wireframe, with an arrow n pointing out of the surface, away from the z-axis.`, `带 x、y、z 轴的斜视立体图：第一卦限内圆柱面 x² + y² = ${cs_a}² 的四分之一，高度到 ${cs_h}，以线框表示，箭头 n 从曲面指向外侧，背离 z 轴。`),
        view: fitView(cs_shapes, 0.15),
        shapes: cs_shapes,
      }),
    }),
    g.number({
      id: 'cylinder-flux',
      title: t('Flux through a cylinder', '穿过圆柱面的通量'),
      prompt: t(
        `F = z i + x j + y k. S is the part of the cylinder x² + y² = ${cf_a}² in the first octant (x, y, z ≥ 0) below the plane z = ${cf_h}, with n pointing outward, away from the z-axis. Find the flux of F through S.`,
        `F = z i + x j + y k。S 是圆柱面 x² + y² = ${cf_a}² 位于第一卦限（x、y、z ≥ 0）且在平面 z = ${cf_h} 下方的部分，n 指向外侧，背离 z 轴。求 F 穿过 S 的通量。`
      ),
      fields: [{ label: t('flux', '通量'), answer: cf_ans }],
      hint: t(
        `With x = ${cf_a} cos θ, y = ${cf_a} sin θ: F · n dS = (${cf_a}z cos θ + ${cf_a * cf_a} sin θ cos θ) dz dθ. Integrate z from 0 to ${cf_h}, then θ from 0 to π/2.`,
        `取 x = ${cf_a} cos θ，y = ${cf_a} sin θ：F · n dS = (${cf_a}z cos θ + ${cf_a * cf_a} sin θ cos θ) dz dθ。先对 z 从 0 积到 ${cf_h}，再对 θ 从 0 积到 π/2。`
      ),
      explanation: t(
        `The inner z-integral is ${cf_a}·${cf_h}²/2·cos θ + ${cf_a * cf_a}·${cf_h} sin θ cos θ. The θ-integral of cos θ from 0 to π/2 is 1 and that of sin θ cos θ is 1/2. So the flux is ${cf_a}·${cf_h}²/2 + ${cf_a * cf_a}·${cf_h}/2 = ${num(cf_ans)}.`,
        `内层对 z 的积分是 ${cf_a}·${cf_h}²/2·cos θ + ${cf_a * cf_a}·${cf_h} sin θ cos θ。对 θ 的积分：cos θ 从 0 到 π/2 的积分是 1，sin θ cos θ 的积分是 1/2。所以通量是 ${cf_a}·${cf_h}²/2 + ${cf_a * cf_a}·${cf_h}/2 = ${num(cf_ans)}。`
      ),
      figure: g.figure({
        alt: t(`Oblique 3D view with the x, y and z axes: the quarter of the cylinder x² + y² = ${cf_a}² in the first octant, up to height ${cf_h}, as a wireframe, with an arrow n pointing out of the surface, away from the z-axis.`, `带 x、y、z 轴的斜视立体图：第一卦限内圆柱面 x² + y² = ${cf_a}² 的四分之一，高度到 ${cf_h}，以线框表示，箭头 n 从曲面指向外侧，背离 z 轴。`),
        view: fitView(cf_shapes, 0.15),
        shapes: cf_shapes,
      }),
      audit: { kind: 'MIT-MV-55:cylinder-flux', params: { a: cf_a, h: cf_h } },
    }),
    g.symbols({
      id: 'sphere-setup',
      title: t('Set up a flux through a sphere', '球面通量的列式'),
      prompt: t(
        `S is the part of the sphere x² + y² + z² = ${ss_a}² in the first octant, with n pointing outward, away from the origin, so n = (x, y, z)/${ss_a}. The angle φ is measured from the positive z-axis, z = ${ss_a} cos φ and dS = ${ss_a}² sin φ dφ dθ. The field is F = ${ss_k}(xz i + yz j + z² k). Complete F · n and the flux integrand F · n dS, both in terms of φ.`,
        `S 是球面 x² + y² + z² = ${ss_a}² 位于第一卦限的部分，n 指向外侧，背离原点，所以 n = (x, y, z)/${ss_a}。角 φ 是从正 z 轴量起的角，z = ${ss_a} cos φ，dS = ${ss_a}² sin φ dφ dθ。场为 F = ${ss_k}(xz i + yz j + z² k)。用 φ 表示，补全 F · n 和通量的被积式 F · n dS。`
      ),
      before: 'F · n = ',
      between: lang === 'zh' ? ['，F · n dS = '] : [', F · n dS = '],
      after: ' dφ dθ',
      answers: [ss_ans1, ss_ans2],
      tokens: shuffled(g, ss_tokens),
      hint: t(
        `F · n = k z (x² + y² + z²)/${ss_a}. On the sphere x² + y² + z² = ${ss_a}². Multiply by dS = ${ss_a}² sin φ dφ dθ, with z = ${ss_a} cos φ.`,
        `F · n = k z (x² + y² + z²)/${ss_a}。球面上 x² + y² + z² = ${ss_a}²。再乘以 dS = ${ss_a}² sin φ dφ dθ，其中 z = ${ss_a} cos φ。`
      ),
      explanation: t(
        `F · n = ${ss_k}(x²z + y²z + z³)/${ss_a} = ${ss_k}z(x² + y² + z²)/${ss_a} = ${ss_k}z·${ss_a} = ${ss_ka2} cos φ, because z = ${ss_a} cos φ. Multiplying by dS = ${ss_a}² sin φ dφ dθ gives ${ss_ka4} cos φ sin φ dφ dθ.`,
        `F · n = ${ss_k}(x²z + y²z + z³)/${ss_a} = ${ss_k}z(x² + y² + z²)/${ss_a} = ${ss_k}z·${ss_a} = ${ss_ka2} cos φ，因为 z = ${ss_a} cos φ。乘以 dS = ${ss_a}² sin φ dφ dθ 得 ${ss_ka4} cos φ sin φ dφ dθ。`
      ),
      figure: g.figure({
        alt: t(`Oblique 3D view with the x, y and z axes: the part of the sphere of radius ${ss_a} in the first octant as a wireframe, with an arrow n pointing out of the surface, away from the origin.`, `带 x、y、z 轴的斜视立体图：半径为 ${ss_a} 的球在第一卦限的部分，以线框表示，箭头 n 从曲面指向外侧，背离原点。`),
        view: fitView(ss_shapes, 0.15),
        shapes: ss_shapes,
      }),
    }),
    g.number({
      id: 'sphere-flux',
      title: t('Flux through a sphere patch', '穿过球面一片的通量'),
      prompt: t(
        `F = ${sf_k}(xz i + yz j + z² k). S is the part of the sphere x² + y² + z² = ${sf_a}² in the first octant (x, y, z ≥ 0), with n pointing outward, away from the origin. The flux of F through S equals K·π. Enter K.`,
        `F = ${sf_k}(xz i + yz j + z² k)。S 是球面 x² + y² + z² = ${sf_a}² 位于第一卦限（x、y、z ≥ 0）的部分，n 指向外侧，背离原点。F 穿过 S 的通量等于 K·π。求 K。`
      ),
      fields: [{ label: t('K', 'K'), answer: sf_K }],
      hint: t(
        `Integrate ${sf_k * sf_a ** 4} cos φ sin φ over φ from 0 to π/2 and θ from 0 to π/2.`,
        `对 ${sf_k * sf_a ** 4} cos φ sin φ 积分，φ 从 0 到 π/2，θ 从 0 到 π/2。`
      ),
      explanation: t(
        `F · n dS = ${sf_k * sf_a ** 4} cos φ sin φ dφ dθ. The φ-integral of cos φ sin φ from 0 to π/2 is 1/2 and the θ-integral is π/2, so the flux is ${sf_k * sf_a ** 4}·(1/2)·(π/2) = (${num(sf_K)})π and K = ${num(sf_K)}.`,
        `F · n dS = ${sf_k * sf_a ** 4} cos φ sin φ dφ dθ。cos φ sin φ 从 0 到 π/2 的积分是 1/2，θ 的积分是 π/2，所以通量是 ${sf_k * sf_a ** 4}·(1/2)·(π/2) = (${num(sf_K)})π，K = ${num(sf_K)}。`
      ),
      figure: g.figure({
        alt: t(`Oblique 3D view with the x, y and z axes: the part of the sphere of radius ${sf_a} in the first octant as a wireframe, with an arrow n pointing out of the surface, away from the origin.`, `带 x、y、z 轴的斜视立体图：半径为 ${sf_a} 的球在第一卦限的部分，以线框表示，箭头 n 从曲面指向外侧，背离原点。`),
        view: fitView(sf_shapes, 0.15),
        shapes: sf_shapes,
      }),
      audit: { kind: 'MIT-MV-55:sphere-flux', params: { k: sf_k, a: sf_a } },
    }),
    g.number({
      id: 'challenge',
      title: t('Flux through a bowl', '穿过碗面的通量'),
      prompt: t(
        `S is the part of the paraboloid z = x² + y² below the plane z = ${ch_H}. F = x i + y j + (${ch_c} − 2z) k. The normal n points away from the z-axis (outward from the bowl). The flux of F through S equals K·π. Enter K, an integer.`,
        `S 是抛物面 z = x² + y² 位于平面 z = ${ch_H} 下方的部分。F = x i + y j + (${ch_c} − 2z) k。法向量 n 背离 z 轴（指向碗的外侧）。F 穿过 S 的通量等于 K·π。求 K，填写整数。`
      ),
      fields: [{ label: t('K', 'K'), answer: ch_K }],
      hint: t(
        `Which way does n point in z on a bowl, when it points away from the z-axis? Write n dS = ±(−f_x, −f_y, 1) dx dy, replace z, and integrate over the disk x² + y² ≤ ${ch_H} in polar coordinates.`,
        `在碗面上，背离 z 轴的法向量的 z 分量是正还是负？写出 n dS = ±(−f_x, −f_y, 1) dx dy，代入 z，再在圆盘 x² + y² ≤ ${ch_H} 上用极坐标积分。`
      ),
      explanation: t(
        `On the bowl, the normal pointing away from the z-axis points downward, so n dS = (2x, 2y, −1) dx dy. Then F · n dS = 2x² + 2y² − (${ch_c} − 2z) dx dy = (4r² − ${ch_c}) dx dy, because z = r². The shadow is the disk r ≤ √${ch_H}, so the flux is ∫ from 0 to 2π ∫ from 0 to √${ch_H} of (4r² − ${ch_c}) r dr dθ = 2π(${ch_H}² − ${ch_c}·${ch_H}/2) = (${num(ch_K)})π, and K = ${num(ch_K)}. This game does not ask you to find the area of a surface, to integrate over curved surfaces other than cylinders, spheres and graphs z = f(x, y), or to use the divergence theorem.`,
        `在碗面上，背离 z 轴的法向量朝下，所以 n dS = (2x, 2y, −1) dx dy。于是 F · n dS = 2x² + 2y² − (${ch_c} − 2z) dx dy = (4r² − ${ch_c}) dx dy（因为 z = r²）。投影是圆盘 r ≤ √${ch_H}，所以通量 = ∫（θ 从 0 到 2π）∫（r 从 0 到 √${ch_H}）(4r² − ${ch_c}) r dr dθ = 2π(${ch_H}² − ${ch_c}·${ch_H}/2) = (${num(ch_K)})π，K = ${num(ch_K)}。本游戏不要求求曲面面积，不涉及圆柱面、球面和函数图像 z = f(x, y) 以外的曲面上的积分，也不涉及散度定理。`
      ),
      audit: { kind: 'MIT-MV-55:challenge', params: { c: ch_c, H: ch_H } },
    }),
  ];
};
