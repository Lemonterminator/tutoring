import type { CardGenerator } from '../../types';
import { axes3d, fitView, type FigureShape, type Pt } from '../../figure';
import { coef, frac, makeMvDeck, num, par, piTerm, term, type Text } from '../support';

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

export const mv56: CardGenerator = (seed, lang) => {
  const g = makeMvDeck(seed, lang, 'MIT-MV-56');
  warm(g);

  // --- Card 1: div-of-f ---
  const d1 = retry(() => ({
    a: g.pick([1, 2, 3]), b: g.pick([1, 2, 3]), c: g.pick([1, 2, 3]),
    d: g.pick([1, 2, 3]), e: g.pick([-3, -2, -1, 1, 2, 3]),
    x0: g.pick([1, 2, 3]), y0: g.pick([1, 2, 3]), z0: g.pick([1, 2, 3]),
  }), v => v.c !== v.d);
  const d1Ans = 2 * d1.a * d1.x0 + 2 * d1.d * d1.y0 + d1.e;

  // --- Card 2: closed-or-open ---
  const closedType = g.pick(['ball', 'cube', 'torus']);
  const closedA = g.pick([2, 3, 4]);
  const nonClosedPool = ['plane', 'sphere-hole', 'cylinder', 'figure8'];
  const nonClosedIdx = shuffled(g, [0, 1, 2, 3]).slice(0, 3);
  const nonClosedChosen = nonClosedIdx.map(i => nonClosedPool[i]);
  const closedName = { ball: { en: 'ball surface (a sphere)', zh: '球的表面（球面）' }, cube: { en: 'cube surface', zh: '立方体的表面' }, torus: { en: 'torus', zh: '环面' } }[closedType]!;
  const whyNot: Record<string, { en: string; zh: string }> = {
    plane: { en: 'The plane z = 0 encloses no region.', zh: '平面 z = 0 围不住任何区域。' },
    'sphere-hole': { en: 'The sphere with one point removed has a hole, so it is not closed.', zh: '去掉一点的球面有一个洞，所以不是闭曲面。' },
    cylinder: { en: 'The infinite cylinder surrounds an unbounded region.', zh: '无限长圆柱面围住的区域是无界的。' },
    figure8: { en: 'The figure-8 can intersects itself.', zh: '8 字形罐子自身相交。' },
  };

  // --- Card 3: face-flux ---
  const f3 = retry(() => ({
    m: g.pick([1, 2, 3]), n: g.pick([1, 2, 3]), l: g.pick([1, 2, 3]),
    p: g.pick([2, 3, 4]), q: g.pick([2, 3, 4]), r: g.pick([2, 3, 4]),
    face: g.pick(['z', 'y', 'x']),
  }), v => (v.m !== v.n || v.m !== v.l) && (v.p !== v.q || v.p !== v.r));
  const f3Ans = (f3.face === 'z' ? f3.l : f3.face === 'y' ? f3.n : f3.m) * f3.p * f3.q * f3.r;
  const f3AuditKind = f3.face === 'z' ? 'MIT-MV-56:face-flux-z' : f3.face === 'y' ? 'MIT-MV-56:face-flux-y' : 'MIT-MV-56:face-flux-x';

  // --- Card 4: theorem-setup ---
  const t4 = retry(() => {
    const m = g.pick([1, 2, 3]), n = g.pick([1, 2, 3]), l = g.pick([1, 2, 3]);
    const p = g.pick([2, 3, 4]), q = g.pick([2, 3, 4]), r = g.pick([2, 3, 4]);
    return { m, n, l, p, q, r };
  }, v => {
    if (v.m === v.n && v.n === v.l) return false;
    if (v.p === v.q && v.q === v.r) return false;
    const s = v.m + v.n + v.l, prod = v.m * v.n * v.l;
    const vol = v.p * v.q * v.r, sa = 2 * (v.p * v.q + v.q * v.r + v.r * v.p), es = v.p + v.q + v.r;
    const nums = [s, prod, vol, sa, es];
    return new Set(nums).size === 5;
  });
  const t4Sum = t4.m + t4.n + t4.l;
  const t4Vol = t4.p * t4.q * t4.r;

  // --- Card 5: box-flux ---
  const b5 = retry(() => ({
    m: g.pick([1, 2, 3]), n: g.pick([1, 2, 3]), l: g.pick([1, 2, 3]),
    p: g.pick([2, 3, 4]), q: g.pick([2, 3, 4]), r: g.pick([2, 3, 4]),
  }), v => (v.m !== v.n || v.m !== v.l) && (v.p !== v.q || v.p !== v.r));
  const b5Ans = (b5.m + b5.n + b5.l) * b5.p * b5.q * b5.r;

  // --- Card 6: sphere-flux ---
  const s6 = retry(() => {
    const triple = g.pick([[1, 2, 3], [2, 3, 4], [1, 3, 5], [2, 2, 5], [1, 4, 4], [3, 4, 5], [2, 5, 5]]);
    const perm = shuffled(g, triple);
    return { m: perm[0], n: perm[1], l: perm[2], a: g.pick([1, 2, 3]) };
  }, () => true);
  const s6Ans = 4 * (s6.m + s6.n + s6.l) * s6.a ** 3 / 3;

  // --- Card 7: closed-setup ---
  const c7 = {
    h: g.pick([2, 3, 4, 5, 6, 7]),
    c: g.pick([2, 3, 4]), d: g.pick([2, 3, 4]), e: g.pick([2, 3, 4]),
  };

  // --- Card 8: cap-flux ---
  const c8 = {
    c: g.pick([2, 3, 4, 5]), h: g.pick([2, 3, 4]), d: g.pick([2, 3, 4]), e: g.pick([2, 3, 4]),
  };
  const c8Ans = c8.c * c8.h;

  // --- Card 9: challenge ---
  const ch9 = {
    c: g.pick([2, 4, 6]), h: g.pick([1, 2, 3, 4]), d: g.pick([2, 3, 4]), e: g.pick([2, 3, 4]),
  };
  const ch9Ans = ch9.c * ch9.h ** 2 / 2;

  // --- Figures ---
  // Card 3: box with highlighted face
  const boxVerts: [number, number, number][] = [
    [0, 0, 0], [f3.p, 0, 0], [f3.p, f3.q, 0], [0, f3.q, 0],
    [0, 0, f3.r], [f3.p, 0, f3.r], [f3.p, f3.q, f3.r], [0, f3.q, f3.r],
  ];
  const boxEdges: [number, number][] = [
    [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  const proj = (v: [number, number, number]): Pt => [v[1] - 0.45 * v[0], v[2] - 0.3 * v[0]];
  const boxShapes: FigureShape[] = boxEdges.map(([i, j]) => ({
    kind: 'line' as const, points: [proj(boxVerts[i]), proj(boxVerts[j])], tone: 'muted' as const, width: 1,
  }));
  let faceCorners: number[];
  let faceNormal: [number, number, number];
  if (f3.face === 'z') { faceCorners = [5, 6, 7, 4]; faceNormal = [0, 0, 1]; }
  else if (f3.face === 'y') { faceCorners = [2, 3, 7, 6]; faceNormal = [0, 1, 0]; }
  else { faceCorners = [1, 2, 6, 5]; faceNormal = [1, 0, 0]; }
  const faceCenter: [number, number, number] = [
    (boxVerts[faceCorners[0]][0] + boxVerts[faceCorners[1]][0] + boxVerts[faceCorners[2]][0] + boxVerts[faceCorners[3]][0]) / 4,
    (boxVerts[faceCorners[0]][1] + boxVerts[faceCorners[1]][1] + boxVerts[faceCorners[2]][1] + boxVerts[faceCorners[3]][1]) / 4,
    (boxVerts[faceCorners[0]][2] + boxVerts[faceCorners[1]][2] + boxVerts[faceCorners[2]][2] + boxVerts[faceCorners[3]][2]) / 4,
  ];
  boxShapes.push({
    kind: 'area', points: faceCorners.map(i => proj(boxVerts[i])), tone: 'accent', opacity: 0.3,
  });
  boxShapes.push({
    kind: 'arrow', from: proj(faceCenter), to: proj([faceCenter[0] + faceNormal[0], faceCenter[1] + faceNormal[1], faceCenter[2] + faceNormal[2]]),
    tone: 'accent2', width: 2, label: 'n',
  });

  // Card 3 figure: the box, its axes, the shaded face and the one normal arrow (the shared theoremShapes has no shaded face)
  const faceShapes: FigureShape[] = [...boxShapes, ...axes3d(Math.max(f3.p, f3.q, f3.r) + 1)];

  // Cards 4/5: the whole box with outward normals out of three visible faces (no shaded face)
  const theoremFaces: [[number, number, number], [number, number, number]][] = [
    [[f3.p, f3.q / 2, f3.r / 2], [1, 0, 0]],
    [[f3.p / 2, f3.q, f3.r / 2], [0, 1, 0]],
    [[f3.p / 2, f3.q / 2, f3.r], [0, 0, 1]],
  ];
  const theoremShapes: FigureShape[] = [
    ...boxShapes.filter(s => s.kind === 'line'),
    ...axes3d(Math.max(f3.p, f3.q, f3.r) + 1),
    ...theoremFaces.map(([c, n]): FigureShape => ({
      kind: 'arrow', from: proj(c), to: proj([c[0] + n[0], c[1] + n[1], c[2] + n[2]]), tone: 'accent2', width: 2, label: 'n',
    })),
  ];

  // Card 6: sphere wireframe
  const sphereShapes: FigureShape[] = [];
  for (let i = 0; i < 4; i++) {
    const phi = (i + 1) * Math.PI / 5;
    const pts: [number, number, number][] = [];
    for (let j = 0; j <= 8; j++) {
      const theta = j * Math.PI / 4;
      pts.push([s6.a * Math.sin(phi) * Math.cos(theta), s6.a * Math.sin(phi) * Math.sin(theta), s6.a * Math.cos(phi)]);
    }
    sphereShapes.push({ kind: 'line', points: pts.map(proj), tone: 'muted', width: 1 });
  }
  for (let j = 0; j < 8; j++) {
    const theta = j * Math.PI / 4;
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= 4; i++) {
      const phi = i * Math.PI / 4;
      pts.push([s6.a * Math.sin(phi) * Math.cos(theta), s6.a * Math.sin(phi) * Math.sin(theta), s6.a * Math.cos(phi)]);
    }
    sphereShapes.push({ kind: 'line', points: pts.map(proj), tone: 'muted', width: 1 });
  }
  const arrowPts: [[number, number, number], [number, number, number]][] = [
    [[s6.a, 0, 0], [1.3 * s6.a, 0, 0]],
    [[0, s6.a, 0], [0, 1.3 * s6.a, 0]],
    [[s6.a * Math.sin(Math.PI / 4) * Math.cos(Math.PI), s6.a * Math.sin(Math.PI / 4) * Math.sin(Math.PI), s6.a * Math.cos(Math.PI / 4)],
     [1.3 * s6.a * Math.sin(Math.PI / 4) * Math.cos(Math.PI), 1.3 * s6.a * Math.sin(Math.PI / 4) * Math.sin(Math.PI), 1.3 * s6.a * Math.cos(Math.PI / 4)]],
  ];
  for (const [from, to] of arrowPts) {
    sphereShapes.push({ kind: 'arrow', from: proj(from), to: proj(to), tone: 'accent2', width: 2 });
  }
  sphereShapes.push(...axes3d(s6.a + 1));

  // Cards 7/8: paraboloid cap of height h; `lid` also draws the downward normal on the disk (closed surface of card 7)
  const capFigure = (h: number, lid: boolean): FigureShape[] => {
    const shapes: FigureShape[] = [];
    const sqrtH = Math.sqrt(h);
    for (let i = 0; i < 3; i++) {
      const u = (i + 1) * sqrtH / 4;
      const pts: [number, number, number][] = [];
      for (let j = 0; j <= 8; j++) {
        const theta = j * Math.PI / 4;
        pts.push([u * Math.cos(theta), u * Math.sin(theta), h - u * u]);
      }
      shapes.push({ kind: 'line', points: pts.map(proj), tone: 'muted', width: 1 });
    }
    for (let j = 0; j < 8; j++) {
      const theta = j * Math.PI / 4;
      const pts: [number, number, number][] = [];
      for (let i = 0; i <= 3; i++) {
        const u = i * sqrtH / 3;
        pts.push([u * Math.cos(theta), u * Math.sin(theta), h - u * u]);
      }
      shapes.push({ kind: 'line', points: pts.map(proj), tone: 'muted', width: 1 });
    }
    const circlePts: [number, number, number][] = [];
    for (let j = 0; j <= 16; j++) {
      const theta = j * Math.PI / 8;
      circlePts.push([sqrtH * Math.cos(theta), sqrtH * Math.sin(theta), 0]);
    }
    shapes.push({ kind: 'line', points: circlePts.map(proj), tone: 'accent', width: 2 });
    if (lid) shapes.push({ kind: 'arrow', from: proj([0, 0, 0]), to: proj([0, 0, -1]), tone: 'warn', width: 2, label: 'n' });
    shapes.push({ kind: 'arrow', from: proj([0, 0, h]), to: proj([0, 0, h + 1]), tone: 'accent2', width: 2, label: 'n' });
    return shapes;
  };
  const capShapes = capFigure(c7.h, true);
  const cap8Shapes = capFigure(c8.h, false);

  // --- Build cards ---
  return [
    // Card 1: div-of-f
    g.number({
      id: 'div-of-f',
      title: t('Compute a divergence', '计算散度'),
      prompt: t(
        `F = (${coef(d1.a, 'x²')} + ${coef(d1.b, 'y')}, ${coef(d1.c, 'x')} + ${coef(d1.d, 'y²')}, ${coef(d1.e, 'z')}). Find div F = ∂M/∂x + ∂N/∂y + ∂P/∂z at the point (${d1.x0}, ${d1.y0}, ${d1.z0}).`,
        `F = (${coef(d1.a, 'x²')} + ${coef(d1.b, 'y')}, ${coef(d1.c, 'x')} + ${coef(d1.d, 'y²')}, ${coef(d1.e, 'z')})。求点 (${d1.x0}, ${d1.y0}, ${d1.z0}) 处的散度 div F = ∂M/∂x + ∂N/∂y + ∂P/∂z。`
      ),
      fields: [{ label: t('div F', 'div F'), answer: d1Ans }],
      hint: t(
        'Differentiate each component with respect to its own variable only: M with respect to x, N with respect to y, P with respect to z.',
        '每个分量只对它自己的变量求导：M 对 x，N 对 y，P 对 z。'
      ),
      explanation: t(
        `∂M/∂x = ${coef(2 * d1.a, 'x')}, ∂N/∂y = ${coef(2 * d1.d, 'y')} and ∂P/∂z = ${num(d1.e)}. So div F = ${coef(2 * d1.a, 'x')} + ${coef(2 * d1.d, 'y')} ${term(d1.e)}. At the point (${d1.x0}, ${d1.y0}, ${d1.z0}) this is ${num(2 * d1.a)}·${d1.x0} + ${num(2 * d1.d)}·${d1.y0} ${term(d1.e)} = ${num(d1Ans)}. The term ${coef(d1.b, 'y')} of M contains no x and the term ${coef(d1.c, 'x')} of N contains no y, so they drop out.`,
        `∂M/∂x = ${coef(2 * d1.a, 'x')}，∂N/∂y = ${coef(2 * d1.d, 'y')}，∂P/∂z = ${num(d1.e)}，所以 div F = ${coef(2 * d1.a, 'x')} + ${coef(2 * d1.d, 'y')} ${term(d1.e)}。在点 (${d1.x0}, ${d1.y0}, ${d1.z0}) 处为 ${num(2 * d1.a)}·${d1.x0} + ${num(2 * d1.d)}·${d1.y0} ${term(d1.e)} = ${num(d1Ans)}。M 中的项 ${coef(d1.b, 'y')} 不含 x，N 中的项 ${coef(d1.c, 'x')} 不含 y，所以它们不出现。`
      ),
      audit: { kind: 'MIT-MV-56:div-of-f', params: { a: d1.a, b: d1.b, c: d1.c, d: d1.d, e: d1.e, x0: d1.x0, y0: d1.y0, z0: d1.z0 } },
    }),

    // Card 2: closed-or-open
    g.choice({
      id: 'closed-or-open',
      title: t('Is it a closed surface?', '它是闭曲面吗？'),
      prompt: t(
        'The divergence theorem is about closed surfaces: one connected piece that does not intersect itself and completely encloses a finite region of space. Which of these surfaces is a closed surface?',
        '散度定理针对闭曲面：由一整块曲面组成，自身不相交，并且完全围住空间中一个有限区域。下面哪个曲面是闭曲面？'
      ),
      options: [
        t(`The surface of a ball of radius ${closedA}`, `半径为 ${closedA} 的球的表面`),
        t(`The surface of a cube with edge ${closedA}`, `棱长为 ${closedA} 的立方体的表面`),
        t('The surface of a torus (an inflated bicycle inner tube)', '环面（充了气的自行车内胎的表面）'),
        t('The plane z = 0', '平面 z = 0'),
        t(`A sphere of radius ${closedA} with one point removed`, `去掉一点的半径为 ${closedA} 的球面`),
        t(`An infinite cylinder of radius ${closedA}`, `半径为 ${closedA} 的无限长圆柱面`),
        t('A tin can whose cross-section looks like a figure-8 (it intersects itself)', '截面为 8 字形的罐子（自身相交）'),
      ].filter((_, i) => {
        if (i === 0) return closedType === 'ball';
        if (i === 1) return closedType === 'cube';
        if (i === 2) return closedType === 'torus';
        const ncIdx = i - 3;
        return nonClosedChosen.includes(nonClosedPool[ncIdx]);
      }),
      correct: 0,
      hint: t(
        'A closed surface has an inside: a finite region that it completely surrounds without crossing itself.',
        '闭曲面有一个内部：被它完全围住、且自身不相交的有限区域。'
      ),
      explanation: t(
        `The correct option names a ${closedName.en}, which is one piece, does not cross itself and completely encloses a finite region. ${nonClosedChosen.map(kind => whyNot[kind].en).join(' ')}`,
        `正确选项是${closedName.zh}：它是一整块，不自交，并且完全围住一个有限区域。${nonClosedChosen.map(kind => whyNot[kind].zh).join('')}`
      ),
    }),

    // Card 3: face-flux
    g.number({
      id: 'face-flux',
      title: t('Flux through one face', '一个面上的通量'),
      prompt: t(
        `F = (${coef(f3.m, 'x')}, ${coef(f3.n, 'y')}, ${coef(f3.l, 'z')}). The box has opposite vertices (0, 0, 0) and (${f3.p}, ${f3.q}, ${f3.r}). Find the flux of F through the face ${f3.face === 'z' ? `z = ${f3.r} (the top face, the normal pointing up)` : f3.face === 'y' ? `y = ${f3.q} (the normal pointing in the positive y-direction)` : `x = ${f3.p} (the normal pointing in the positive x-direction)`} only.`,
        `F = (${coef(f3.m, 'x')}, ${coef(f3.n, 'y')}, ${coef(f3.l, 'z')})。长方体的两个对顶点是 (0, 0, 0) 和 (${f3.p}, ${f3.q}, ${f3.r})。只求 F 穿过${f3.face === 'z' ? `面 z = ${f3.r}（顶面，法向量指向上方）` : f3.face === 'y' ? `面 y = ${f3.q}（法向量指向 y 轴正方向）` : `面 x = ${f3.p}（法向量指向 x 轴正方向）`}的通量。`
      ),
      fields: [{ label: t('flux', '通量'), answer: f3Ans }],
      figure: g.figure({
        alt: t(
          `A box with one edge of length ${f3.p} along x, ${f3.q} along y and ${f3.r} along z, the face ${f3.face === 'z' ? `z = ${f3.r}` : f3.face === 'y' ? `y = ${f3.q}` : `x = ${f3.p}`} shaded and an arrow n pointing out of the box through it.`,
          `一个长方体，x 方向边长 ${f3.p}，y 方向边长 ${f3.q}，z 方向边长 ${f3.r}，面 ${f3.face === 'z' ? `z = ${f3.r}` : f3.face === 'y' ? `y = ${f3.q}` : `x = ${f3.p}`} 被着色，箭头 n 从该面穿出。`
        ),
        view: fitView(faceShapes, 0.25),
        shapes: faceShapes,
      }),
      hint: t(
        'On this face the normal is a coordinate vector, so F · n is one component of F, constant on the face. Multiply by the area of the face.',
        '在这个面上法向量是坐标向量，F · n 就是 F 的一个分量，在面上是常数。再乘以这个面的面积。'
      ),
      explanation: t(
        f3.face === 'z'
          ? `On the face z = ${f3.r} the normal is k, so F · n = ${coef(f3.l, 'z')} = ${num(f3.l)}·${f3.r} = ${num(f3.l * f3.r)}, a constant. The face is a ${f3.p} by ${f3.q} rectangle, of area ${num(f3.p * f3.q)}. So the flux is ${num(f3.l * f3.r)}·${num(f3.p * f3.q)} = ${num(f3Ans)}.`
          : f3.face === 'y'
            ? `On the face y = ${f3.q} the normal is j, so F · n = ${coef(f3.n, 'y')} = ${num(f3.n)}·${f3.q} = ${num(f3.n * f3.q)}, a constant. The face is a ${f3.p} by ${f3.r} rectangle, of area ${num(f3.p * f3.r)}. So the flux is ${num(f3.n * f3.q)}·${num(f3.p * f3.r)} = ${num(f3Ans)}.`
            : `On the face x = ${f3.p} the normal is i, so F · n = ${coef(f3.m, 'x')} = ${num(f3.m)}·${f3.p} = ${num(f3.m * f3.p)}, a constant. The face is a ${f3.q} by ${f3.r} rectangle, of area ${num(f3.q * f3.r)}. So the flux is ${num(f3.m * f3.p)}·${num(f3.q * f3.r)} = ${num(f3Ans)}.`,
        f3.face === 'z'
          ? `在面 z = ${f3.r} 上法向量是 k，F · n = ${coef(f3.l, 'z')} = ${num(f3.l)}·${f3.r} = ${num(f3.l * f3.r)}，是常数。这个面是 ${f3.p} 乘 ${f3.q} 的矩形，面积 ${num(f3.p * f3.q)}。所以通量 = ${num(f3.l * f3.r)}·${num(f3.p * f3.q)} = ${num(f3Ans)}。`
          : f3.face === 'y'
            ? `在面 y = ${f3.q} 上法向量是 j，F · n = ${coef(f3.n, 'y')} = ${num(f3.n)}·${f3.q} = ${num(f3.n * f3.q)}，是常数。这个面是 ${f3.p} 乘 ${f3.r} 的矩形，面积 ${num(f3.p * f3.r)}。所以通量 = ${num(f3.n * f3.q)}·${num(f3.p * f3.r)} = ${num(f3Ans)}。`
            : `在面 x = ${f3.p} 上法向量是 i，F · n = ${coef(f3.m, 'x')} = ${num(f3.m)}·${f3.p} = ${num(f3.m * f3.p)}，是常数。这个面是 ${f3.q} 乘 ${f3.r} 的矩形，面积 ${num(f3.q * f3.r)}。所以通量 = ${num(f3.m * f3.p)}·${num(f3.q * f3.r)} = ${num(f3Ans)}。`
      ),
      audit: { kind: f3AuditKind, params: { m: f3.m, n: f3.n, l: f3.l, p: f3.p, q: f3.q, r: f3.r } },
    }),

    // Card 4: theorem-setup
    g.symbols({
      id: 'theorem-setup',
      title: t('Set up the divergence theorem', '列出散度定理'),
      prompt: t(
        `F = (${coef(t4.m, 'x')}, ${coef(t4.n, 'y')}, ${coef(t4.l, 'z')}) and S is the surface of the box 0 ≤ x ≤ ${t4.p}, 0 ≤ y ≤ ${t4.q}, 0 ≤ z ≤ ${t4.r}, with the normal pointing out of the box; D is the solid box. Since div F is a constant, the divergence theorem gives: flux = ∭_D (integrand) dV = (value of div F) × (volume of D). Fill in the three blanks.`,
        `F = (${coef(t4.m, 'x')}, ${coef(t4.n, 'y')}, ${coef(t4.l, 'z')})，S 是长方体 0 ≤ x ≤ ${t4.p}、0 ≤ y ≤ ${t4.q}、0 ≤ z ≤ ${t4.r} 的表面，法向量指向长方体外侧；D 是这个实心长方体。因为 div F 是常数，由散度定理：通量 = ∭_D（被积函数）dV =（div F 的值）×（D 的体积）。填写三个空。`
      ),
      before: lang === 'zh' ? '通量 = ∭_D ' : 'flux = ∭_D ',
      between: [' dV = ', ' × '],
      after: lang === 'zh' ? '。' : ' .',
      answers: ['div F', String(t4Sum), String(t4Vol)],
      tokens: shuffled(g, ['div F', 'curl F', 'F · n', String(t4Sum), String(t4.m * t4.n * t4.l), String(t4Vol), String(2 * (t4.p * t4.q + t4.q * t4.r + t4.r * t4.p)), String(t4.p + t4.q + t4.r)]),
      hint: t(
        'div F = ∂M/∂x + ∂N/∂y + ∂P/∂z. The right side is an integral over the solid D, so what does the constant integrand multiply?',
        'div F = ∂M/∂x + ∂N/∂y + ∂P/∂z。右边是对实心体 D 的积分，常数被积函数乘以的是什么？'
      ),
      explanation: t(
        `The divergence theorem turns the flux into ∭_D div F dV. Here div F = ${t4.m} + ${t4.n} + ${t4.l} = ${t4Sum} everywhere, and the volume of the box is ${t4.p}·${t4.q}·${t4.r} = ${t4Vol}. So the flux is ${t4Sum} × ${t4Vol}.`,
        `散度定理把通量化为 ∭_D div F dV。这里处处有 div F = ${t4.m} + ${t4.n} + ${t4.l} = ${t4Sum}，长方体的体积是 ${t4.p}·${t4.q}·${t4.r} = ${t4Vol}。所以通量 = ${t4Sum} × ${t4Vol}。`
      ),
      figure: g.figure({
        alt: t(
          `A box with edges of length ${t4.p}, ${t4.q}, ${t4.r} and arrows n pointing out of three visible faces.`,
          `一个边长为 ${t4.p}、${t4.q}、${t4.r} 的长方体，三个可见面上有箭头 n 指向外侧。`
        ),
        view: fitView(theoremShapes, 0.25),
        shapes: theoremShapes,
      }),
    }),

    // Card 5: box-flux
    g.number({
      id: 'box-flux',
      title: t('Flux out of a box', '流出长方体的通量'),
      prompt: t(
        `F = (${coef(b5.m, 'x')}, ${coef(b5.n, 'y')}, ${coef(b5.l, 'z')}). S is the surface of the box 0 ≤ x ≤ ${b5.p}, 0 ≤ y ≤ ${b5.q}, 0 ≤ z ≤ ${b5.r}, with the normal pointing out of the box. Find the flux of F through S.`,
        `F = (${coef(b5.m, 'x')}, ${coef(b5.n, 'y')}, ${coef(b5.l, 'z')})。S 是长方体 0 ≤ x ≤ ${b5.p}、0 ≤ y ≤ ${b5.q}、0 ≤ z ≤ ${b5.r} 的表面，法向量指向长方体外侧。求 F 穿过 S 的通量。`
      ),
      fields: [{ label: t('flux', '通量'), answer: b5Ans }],
      figure: g.figure({
        alt: t(
          `A box with edges of length ${b5.p}, ${b5.q}, ${b5.r} and arrows n pointing out of three visible faces.`,
          `一个边长为 ${b5.p}、${b5.q}、${b5.r} 的长方体，三个可见面上有箭头 n 指向外侧。`
        ),
        view: fitView(theoremShapes, 0.25),
        shapes: theoremShapes,
      }),
      hint: t(
        'S is closed and the normal points outward, so you may use the divergence theorem.',
        'S 是闭曲面，法向量指向外侧，所以可以用散度定理。'
      ),
      explanation: t(
        `div F = ${b5.m} + ${b5.n} + ${b5.l} = ${b5.m + b5.n + b5.l} is constant. By the divergence theorem the flux is ${b5.m + b5.n + b5.l}·(volume ${b5.p}·${b5.q}·${b5.r} = ${b5.p * b5.q * b5.r}) = ${num(b5Ans)}. (Adding the six faces gives the same: the faces x = ${b5.p}, y = ${b5.q}, z = ${b5.r} contribute ${num(b5.m * b5.p * b5.q * b5.r)}, ${num(b5.n * b5.p * b5.q * b5.r)} and ${num(b5.l * b5.p * b5.q * b5.r)}, the other three faces 0.)`,
        `div F = ${b5.m} + ${b5.n} + ${b5.l} = ${b5.m + b5.n + b5.l} 是常数。由散度定理，通量 = ${b5.m + b5.n + b5.l}·(体积 ${b5.p}·${b5.q}·${b5.r} = ${b5.p * b5.q * b5.r}) = ${num(b5Ans)}。（把六个面加起来结果相同：面 x = ${b5.p}、y = ${b5.q}、z = ${b5.r} 分别贡献 ${num(b5.m * b5.p * b5.q * b5.r)}、${num(b5.n * b5.p * b5.q * b5.r)}、${num(b5.l * b5.p * b5.q * b5.r)}，另外三个面为 0。）`
      ),
      audit: { kind: 'MIT-MV-56:box-flux', params: { m: b5.m, n: b5.n, l: b5.l, p: b5.p, q: b5.q, r: b5.r } },
    }),

    // Card 6: sphere-flux
    g.number({
      id: 'sphere-flux',
      title: t('Flux out of a ball', '流出球面的通量'),
      prompt: t(
        `F = (${coef(s6.m, 'x')}, ${coef(s6.n, 'y')}, ${coef(s6.l, 'z')}). S is the sphere of radius ${s6.a} centred at the origin, with the normal pointing outward. The flux of F through S equals k·π. Enter k, an integer.`,
        `F = (${coef(s6.m, 'x')}, ${coef(s6.n, 'y')}, ${coef(s6.l, 'z')})。S 是球心在原点、半径为 ${s6.a} 的球面，法向量指向外侧。F 穿过 S 的通量等于 k·π。求 k，填写整数。`
      ),
      fields: [{ label: t('k', 'k'), answer: s6Ans }],
      figure: g.figure({
        alt: t(
          `A sphere of radius ${s6.a} about the origin with arrows pointing outward.`,
          `球心在原点、半径为 ${s6.a} 的球面，箭头指向外侧。`
        ),
        view: fitView(sphereShapes, 0.25),
        shapes: sphereShapes,
      }),
      hint: t(
        'div F is constant, and the volume of a ball of radius a is (4/3)πa³.',
        'div F 是常数；半径为 a 的球的体积是 (4/3)πa³。'
      ),
      explanation: t(
        `div F = ${s6.m} + ${s6.n} + ${s6.l} = ${s6.m + s6.n + s6.l}. The ball has volume (4/3)π·${s6.a}³ = ${frac(4 * s6.a ** 3, 3)}π. The flux is ${s6.m + s6.n + s6.l}·(4/3)π·${s6.a}³ = ${num(s6Ans)}π, so k = ${num(s6Ans)}.`,
        `div F = ${s6.m} + ${s6.n} + ${s6.l} = ${s6.m + s6.n + s6.l}。球的体积是 (4/3)π·${s6.a}³ = ${frac(4 * s6.a ** 3, 3)}π。通量 = ${s6.m + s6.n + s6.l}·(4/3)π·${s6.a}³ = ${num(s6Ans)}π，所以 k = ${num(s6Ans)}。`
      ),
      audit: { kind: 'MIT-MV-56:sphere-flux', params: { m: s6.m, n: s6.n, l: s6.l, a: s6.a } },
    }),

    // Card 7: closed-setup
    g.symbols({
      id: 'closed-setup',
      title: t('Close the paraboloid with a lid', '用盖子封住抛物面'),
      prompt: t(
        `Let S1 be the part of the paraboloid z = ${c7.h} − x² − y² above the xy-plane and S2 the disk x² + y² ≤ ${c7.h} in the xy-plane. Let F = (${coef(c7.d, 'yz')}, ${coef(c7.e, 'xz')}, ${num(c7.c)} + xy). Take the disk with the normal pointing down and call it S2′; then S1 (normal pointing up) and S2′ form a closed surface enclosing a solid D, with the normal pointing outward. Complete the statement of the divergence theorem for it.`,
        `设 S1 是抛物面 z = ${c7.h} − x² − y² 在 xy 平面上方的部分，S2 是 xy 平面内的圆盘 x² + y² ≤ ${c7.h}。设 F = (${coef(c7.d, 'yz')}, ${coef(c7.e, 'xz')}, ${num(c7.c)} + xy)。把圆盘取为法向量朝下，记作 S2′；这样 S1（法向量朝上）和 S2′ 构成围住实心体 D 的闭曲面，法向量指向外侧。补全对它使用的散度定理。`
      ),
      before: lang === 'zh' ? 'S2′ 上的法向量是 ' : 'On S2′ the normal is ',
      between: lang === 'zh' ? ['。于是（F 向上穿过 S1 的通量）= ∭_D ', ' dV '] : ['. Then (flux of F upward through S1) = ∭_D ', ' dV '],
      after: lang === 'zh' ? '（F 向上穿过 S2 的通量）。' : ' (flux of F upward through S2).',
      answers: ['−k', 'div F', '+'],
      tokens: shuffled(g, ['−k', 'k', '(2x, 2y, 1)', 'div F', 'curl F', '|F|', '+', '−']),
      hint: t(
        'A closed surface needs the normal pointing out of the solid. On the lid under the solid, which way is out? Then write flux(S1) + flux(S2′) = ∭ …',
        '闭曲面的法向量要指向实心体外侧。实心体下方的盖子上，哪个方向是外侧？再写 flux(S1) + flux(S2′) = ∭ …'
      ),
      explanation: t(
        'The solid lies above the disk, so the outward normal on the disk is −k (down). The divergence theorem gives flux(S1) + flux(S2′) = ∭_D div F dV. Reversing the normal changes the sign: flux(S2′) = −flux(S2 upward). Hence flux(S1 upward) = ∭_D div F dV + flux(S2 upward).',
        '实心体在圆盘上方，所以圆盘上的外法向量是 −k（朝下）。散度定理给出 flux(S1) + flux(S2′) = ∭_D div F dV。法向量反向则符号改变：flux(S2′) = −flux(S2 朝上)。因此 flux(S1 朝上) = ∭_D div F dV + flux(S2 朝上)。'
      ),
      figure: g.figure({
        alt: t(
          `The paraboloid cap z = ${c7.h} − x² − y² above the xy-plane, the disk x² + y² ≤ ${c7.h} below it, an arrow pointing down on the disk and an arrow pointing up on the cap.`,
          `抛物面帽 z = ${c7.h} − x² − y² 在 xy 平面上方，圆盘 x² + y² ≤ ${c7.h} 在下方，圆盘上有向下的箭头，帽上有向上的箭头。`
        ),
        view: fitView(capShapes, 0.25),
        shapes: capShapes,
      }),
    }),

    // Card 8: cap-flux
    g.number({
      id: 'cap-flux',
      title: t('Flux through a paraboloid cap', '穿过抛物面帽的通量'),
      prompt: t(
        `S1 is the part of the paraboloid z = ${c8.h} − x² − y² above the xy-plane. F = (${coef(c8.d, 'yz')}, ${coef(c8.e, 'xz')}, ${num(c8.c)} + xy). The flux of F upward through S1 equals k·π. Enter k, an integer.`,
        `S1 是抛物面 z = ${c8.h} − x² − y² 在 xy 平面上方的部分。F = (${coef(c8.d, 'yz')}, ${coef(c8.e, 'xz')}, ${num(c8.c)} + xy)。F 向上穿过 S1 的通量等于 k·π。求 k，填写整数。`
      ),
      fields: [{ label: t('k', 'k'), answer: c8Ans }],
      figure: g.figure({
        alt: t(
          `The paraboloid cap z = ${c8.h} − x² − y² above the xy-plane as a wireframe, its rim, the circle x² + y² = ${c8.h} in the xy-plane, and an arrow n pointing up at the top of the cap.`,
          `抛物面帽 z = ${c8.h} − x² − y² 在 xy 平面上方，以线框表示；其边缘是 xy 平面内的圆 x² + y² = ${c8.h}；帽顶有一个向上的箭头 n。`
        ),
        view: fitView(cap8Shapes, 0.25),
        shapes: cap8Shapes,
      }),
      hint: t(
        'Compute div F. If it is zero, the flux upward through S1 equals the flux upward through the flat lid z = 0, where F is easy.',
        '先算 div F。如果它是 0，那么 F 向上穿过 S1 的通量就等于向上穿过平盖 z = 0 的通量，那里 F 很简单。'
      ),
      explanation: t(
        `div F = 0 + 0 + 0 = 0, so by the previous card the flux upward through S1 equals the flux upward through the disk S2: x² + y² ≤ ${c8.h} in the plane z = 0. On the disk n = k and F · k = ${num(c8.c)} + xy, so the flux is ∬ (${num(c8.c)} + xy) dA = ${num(c8.c)}·(area π·${c8.h}) + 0 = ${num(c8Ans)}π, because xy is odd in x and integrates to 0 over the disk. So k = ${num(c8Ans)}.`,
        `div F = 0 + 0 + 0 = 0，所以由上一张卡，F 向上穿过 S1 的通量等于向上穿过圆盘 S2（平面 z = 0 上的 x² + y² ≤ ${c8.h}）的通量。圆盘上 n = k，F · k = ${num(c8.c)} + xy，通量 = ∬ (${num(c8.c)} + xy) dA = ${num(c8.c)}·(面积 π·${c8.h}) + 0 = ${num(c8Ans)}π，因为 xy 关于 x 是奇函数，在圆盘上的积分为 0。所以 k = ${num(c8Ans)}。`
      ),
      audit: { kind: 'MIT-MV-56:cap-flux', params: { c: c8.c, d: c8.d, e: c8.e, h: c8.h } },
    }),

    // Card 9: challenge
    g.number({
      id: 'challenge',
      title: t('Flux with a source inside', '内部有源的通量'),
      prompt: t(
        `S1 is the part of the paraboloid z = ${ch9.h} − x² − y² above the xy-plane. F = (${coef(ch9.d, 'yz')}, ${coef(ch9.e, 'xz')}, ${coef(ch9.c, 'z')} + xy). The flux of F upward through S1 equals k·π. Enter k, an integer.`,
        `S1 是抛物面 z = ${ch9.h} − x² − y² 在 xy 平面上方的部分。F = (${coef(ch9.d, 'yz')}, ${coef(ch9.e, 'xz')}, ${coef(ch9.c, 'z')} + xy)。F 向上穿过 S1 的通量等于 k·π。求 k，填写整数。`
      ),
      fields: [{ label: t('k', 'k'), answer: ch9Ans }],
      hint: t(
        'Compute div F first. What does the answer say about the flux through S1 compared with the flux through the flat lid, and how large is the solid under S1?',
        '先算 div F。它告诉你穿过 S1 的通量与穿过平盖的通量相比差多少？S1 下方的实心体有多大？'
      ),
      explanation: t(
        `div F = ${num(ch9.c)}. Close S1 with the disk S2 (z = 0, x² + y² ≤ ${ch9.h}), whose outward normal is −k. Then flux(S1, up) = ∭_D ${num(ch9.c)} dV + flux(S2, up). On the disk z = 0 so F · k = xy, whose integral is 0. The volume of D is ∬ (${ch9.h} − x² − y²) dA = 2π ∫ from 0 to √${ch9.h} of (${ch9.h} − r²) r dr = π·${ch9.h}²/2. So the flux is ${num(ch9.c)}·π·${ch9.h}²/2 = ${piTerm(ch9Ans)} and k = ${num(ch9Ans)}. This game does not ask you to prove the divergence theorem, to use it for fluxes that need a triple integral in spherical coordinates, or to handle surfaces that are not closed except by adding a flat lid.`,
        `div F = ${num(ch9.c)}。用圆盘 S2（z = 0，x² + y² ≤ ${ch9.h}）把 S1 封住，圆盘的外法向量是 −k。于是 flux(S1, 朝上) = ∭_D ${num(ch9.c)} dV + flux(S2, 朝上)。圆盘上 z = 0，F · k = xy，其积分为 0。D 的体积是 ∬ (${ch9.h} − x² − y²) dA = 2π ∫（r 从 0 到 √${ch9.h}）(${ch9.h} − r²) r dr = π·${ch9.h}²/2。所以通量 = ${num(ch9.c)}·π·${ch9.h}²/2 = ${piTerm(ch9Ans)}，k = ${num(ch9Ans)}。本游戏不要求证明散度定理，不涉及需要球坐标三重积分的通量，也不处理除加平盖以外的非闭曲面。`
      ),
      audit: { kind: 'MIT-MV-56:challenge', params: { c: ch9.c, d: ch9.d, e: ch9.e, h: ch9.h } },
    }),
  ];
};
