import type { CardGenerator } from '../../types';
import { sampleCurve, type FigureShape, type Pt } from '../../figure';
import { exact, makeGpDeck, mat, num, par, term, type Text } from '../support';

type Deck = ReturnType<typeof makeGpDeck>;
const t = (en: string, zh: string): Text => [en, zh];

function retry<T>(make: () => T, ok: (v: T) => boolean): T {
  for (let i = 0; i < 5000; i++) { let v: T; try { v = make(); } catch { continue; } if (ok(v)) return v; } // a sampler may throw to reject a draw
  throw new Error('retry: sampling condition never satisfied');
}
const warm = (g: Deck) => { for (let i = 0; i < 4; i++) g.random(0, 1); };
function shuffled<T>(g: Deck, items: readonly T[]): T[] {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) { const j = g.random(0, i); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// NOTE: Cholesky factor for 2x2 SPD matrix [[a,c],[c,b]] is [[sqrt(a), 0], [c/sqrt(a), sqrt(b - c^2/a)]]
function cholesky2(a: number, c: number, b: number): [number, number, number] {
  const l11 = Math.sqrt(a);
  const l21 = c / l11;
  const l22 = Math.sqrt(b - l21 * l21);
  return [l11, l21, l22];
}

function ellipsePoints(l11: number, l21: number, l22: number, cx: number, cy: number): Pt[] {
  const pts: Pt[] = [];
  for (let i = 0; i <= 72; i++) {
    const theta = (i / 72) * 2 * Math.PI; // closed curve: the last point equals the first
    const cosT = Math.cos(theta);
    const sinT = Math.sin(theta);
    const x = l11 * cosT;
    const y = l21 * cosT + l22 * sinT;
    pts.push([cx + x, cy + y]);
  }
  return pts;
}

/** Subscript digit: x${sb(2)} prints x₂. */
const sb = (n: number): string => '₀₁₂₃₄₅₆₇₈₉'[n];

function formatLin2(a1: number, a2: number): string {
  let s = '';
  if (a1 === 1) s += 'x₁';
  else if (a1 === -1) s += '−x₁';
  else s += `${a1}x₁`;
  if (a2 > 0) s += ` + ${a2 === 1 ? '' : a2}x₂`;
  else s += ` − ${a2 === -1 ? '' : -a2}x₂`;
  return s;
}

function formatLin3(a1: number, a2: number, a3: number): string {
  const terms: string[] = [];
  const addTerm = (a: number, idx: number) => {
    if (a === 0) return;
    const sign = a < 0 ? '−' : '';
    const mag = Math.abs(a);
    const coef = mag === 1 ? '' : num(mag);
    terms.push(`${sign}${coef}x${sb(idx)}`);
  };
  addTerm(a1, 1);
  addTerm(a2, 2);
  addTerm(a3, 3);
  if (terms.length === 0) return '0';
  let s = terms[0];
  for (let i = 1; i < terms.length; i++) {
    if (terms[i].startsWith('−')) s += ' − ' + terms[i].slice(1);
    else s += ' + ' + terms[i];
  }
  return s;
}

export const gp01: CardGenerator = (seed, lang) => {
  const g = makeGpDeck(seed, lang, 'GP-01');
  warm(g);

  // --- Card 1: read-corr ---
  const corrPairs: [number, number][] = [[1, 4], [4, 1], [1, 9], [9, 1], [2, 8], [8, 2], [4, 9], [9, 4]];
  const corrP = retry(() => {
    const [a, b] = corrPairs[g.random(0, corrPairs.length - 1)];
    const s = Math.sqrt(a * b);
    const c = g.random(-Math.floor(s) + 1, Math.floor(s) - 1);
    return { a, b, c, s };
  }, v => v.c !== 0 && Math.abs(v.c) < v.s);
  const rho = corrP.c / corrP.s;

  // --- Card 2: match-contour ---
  const contourP = retry(() => {
    const a = g.pick([1, 2, 3, 4]);
    const b = g.pick([1, 2, 3, 4]);
    const c = g.random(-3, 3);
    const s = Math.sqrt(a * b);
    return { a, b, c, s };
  }, v => v.a !== v.b && v.c !== 0 && v.c * v.c < v.a * v.b && Math.abs(v.c) / v.s >= 0.35);
  const roles = ['T', 'N', 'S', 'Z'];
  const roleAssign = shuffled(g, roles);
  const correctLetter = 'ABCD'[roleAssign.indexOf('T')];
  const nLetter = 'ABCD'[roleAssign.indexOf('N')];
  const sLetter = 'ABCD'[roleAssign.indexOf('S')];
  const zLetter = 'ABCD'[roleAssign.indexOf('Z')];

  const centers: Record<string, [number, number]> = { A: [-3.2, 3.2], B: [3.2, 3.2], C: [-3.2, -3.2], D: [3.2, -3.2] };
  const panelMatrices: Record<string, [number, number, number]> = {
    T: [contourP.a, contourP.c, contourP.b],
    N: [contourP.a, -contourP.c, contourP.b],
    S: [contourP.b, contourP.c, contourP.a],
    Z: [contourP.a, 0, contourP.b],
  };
  const letterToRole: Record<string, string> = {};
  for (let i = 0; i < 4; i++) letterToRole['ABCD'[i]] = roleAssign[i];

  const shapes: FigureShape[] = [];
  for (const letter of ['A', 'B', 'C', 'D']) {
    const [cx, cy] = centers[letter];
    shapes.push({ kind: 'line', points: [[cx - 2.4, cy], [cx + 2.4, cy]], tone: 'axis', width: 1 });
    shapes.push({ kind: 'line', points: [[cx, cy - 2.4], [cx, cy + 2.4]], tone: 'axis', width: 1 });
    const role = letterToRole[letter];
    const [pa, pc, pb] = panelMatrices[role];
    const [l11, l21, l22] = cholesky2(pa, pc, pb);
    shapes.push({ kind: 'line', points: ellipsePoints(l11, l21, l22, cx, cy), tone: 'accent', width: 3 });
    shapes.push({ kind: 'text', at: [cx - 2.4, cy + 2.3], text: letter, tone: 'text', anchor: 'start' });
  }

  const descPanel = (p: number, q: number, r: number): string => {
    let d = p > r ? 'it reaches further left-right than up-down' : 'it reaches further up-down than left-right';
    if (q > 0) d += ', tilted up to the right';
    else if (q < 0) d += ', tilted down to the right';
    else d += ', not tilted';
    return d;
  };
  const descPanelZh = (p: number, q: number, r: number): string => {
    let d = p > r ? '左右方向伸得比上下方向远' : '上下方向伸得比左右方向远';
    if (q > 0) d += '，向右上方倾斜';
    else if (q < 0) d += '，向右下方倾斜';
    else d += '，不倾斜';
    return d;
  };

  // --- Card 3: peak-height ---
  const peakSets: [number, number][] = [[4, 3], [4, -3], [5, 4], [5, -4], [6, 4], [6, -4], [6, 5], [6, -5]];
  const peakP = retry(() => {
    const [a, c] = peakSets[g.random(0, peakSets.length - 1)];
    return { a, c };
  }, () => true);
  const peakRoles = ['Dg', 'Cr', 'Sm'];
  const peakAssign = shuffled(g, peakRoles);
  const peakCorrectLabel = 'PQR'[peakAssign.indexOf('Cr')];
  const peakMatrices: Record<string, [number, number, number]> = {
    Dg: [peakP.a, 0, peakP.a],
    Cr: [peakP.a, peakP.c, peakP.a],
    Sm: [peakP.a - 1, 0, peakP.a - 1],
  };
  const labelToPeakRole: Record<string, string> = {};
  for (let i = 0; i < 3; i++) labelToPeakRole['PQR'[i]] = peakAssign[i];

  // --- Card 4: marginal-pick ---
  const sig3 = (dmin: number, dmax: number) => {
    const s11 = g.random(dmin, dmax);
    const s22 = g.random(dmin, dmax);
    const s33 = g.random(dmin, dmax);
    const s12 = g.random(-2, 2);
    const s13 = g.random(-2, 2);
    const s23 = g.random(-2, 2);
    return { s11, s22, s33, s12, s13, s23 };
  };
  const isSig3Valid = (s: { s11: number; s22: number; s33: number; s12: number; s13: number; s23: number }) =>
    s.s11 > Math.abs(s.s12) + Math.abs(s.s13) &&
    s.s22 > Math.abs(s.s12) + Math.abs(s.s23) &&
    s.s33 > Math.abs(s.s13) + Math.abs(s.s23);

  const marginalP = retry(() => {
    const s = sig3(3, 6);
    const d = g.pick([1, 2, 3]);
    const others = [1, 2, 3].filter(x => x !== d);
    const i = others[0], j = others[1];
    const m1 = g.random(-3, 3);
    const m2 = g.random(-3, 3);
    const m3 = g.random(-3, 3);
    return { ...s, d, i, j, m1, m2, m3 };
  }, v => {
    if (!isSig3Valid(v)) return false; // SIG3: strict row dominance keeps Σ positive definite
    if (v.s12 === 0 && v.s13 === 0 && v.s23 === 0) return false;
    // (S1) the kept pair (i, j) must have a non-zero covariance: dropping x1 keeps (2, 3), and so on.
    if (v.d === 1 && v.s23 === 0) return false;
    if (v.d === 2 && v.s13 === 0) return false;
    if (v.d === 3 && v.s12 === 0) return false;
    if (v.m1 === v.m2 || v.m2 === v.m3 || v.m1 === v.m3) return false;
    const getMean = (idx: number) => idx === 1 ? v.m1 : idx === 2 ? v.m2 : v.m3;
    const getVar = (idx: number) => idx === 1 ? v.s11 : idx === 2 ? v.s22 : v.s33;
    const getCov = (i1: number, i2: number) => {
      if (i1 === 1 && i2 === 2) return v.s12;
      if (i1 === 1 && i2 === 3) return v.s13;
      if (i1 === 2 && i2 === 3) return v.s23;
      return 0;
    };
    const opt = (u: number, v2: number, offDiag: number) => `N((${num(getMean(u))}, ${num(getMean(v2))}), [[${num(getVar(u))}, ${num(offDiag)}], [${num(offDiag)}, ${num(getVar(v2))}]])`;
    const cOpt = opt(v.i, v.j, getCov(v.i, v.j));
    const w1Opt = opt(Math.min(v.i, v.d), Math.max(v.i, v.d), getCov(Math.min(v.i, v.d), Math.max(v.i, v.d)));
    const w3Opt = opt(Math.min(v.j, v.d), Math.max(v.j, v.d), getCov(Math.min(v.j, v.d), Math.max(v.j, v.d)));
    const w2Opt = opt(v.i, v.j, 0);
    const maxLen = Math.max(w1Opt.length, w3Opt.length);
    return cOpt.length <= maxLen;
  });

  const mp = marginalP;
  const getMean4 = (idx: number) => idx === 1 ? mp.m1 : idx === 2 ? mp.m2 : mp.m3;
  const getVar4 = (idx: number) => idx === 1 ? mp.s11 : idx === 2 ? mp.s22 : mp.s33;
  const getCov4 = (i1: number, i2: number) => {
    if (i1 === 1 && i2 === 2) return mp.s12;
    if (i1 === 1 && i2 === 3) return mp.s13;
    if (i1 === 2 && i2 === 3) return mp.s23;
    return 0;
  };
  const opt4 = (u: number, v: number, offDiag: number) => `N((${num(getMean4(u))}, ${num(getMean4(v))}), [[${num(getVar4(u))}, ${num(offDiag)}], [${num(offDiag)}, ${num(getVar4(v))}]])`;
  const mpCorrect = opt4(mp.i, mp.j, getCov4(mp.i, mp.j));
  const mpW1 = opt4(Math.min(mp.i, mp.d), Math.max(mp.i, mp.d), getCov4(Math.min(mp.i, mp.d), Math.max(mp.i, mp.d)));
  const mpW3 = opt4(Math.min(mp.j, mp.d), Math.max(mp.j, mp.d), getCov4(Math.min(mp.j, mp.d), Math.max(mp.j, mp.d)));
  const mpW2 = opt4(mp.i, mp.j, 0);
  const mpOptions = shuffled(g, [mpCorrect, mpW1, mpW3, mpW2]);
  const mpCorrectIdx = mpOptions.indexOf(mpCorrect);

  // --- Card 5: marginal-det ---
  type MarginalDetResult = { s11: number; s22: number; s33: number; s12: number; s13: number; s23: number; d: number; i: number; k: number; covIK: number; varI: number; varK: number; det: number; prod: number; sq: number };
  const marginalDetP = retry((): MarginalDetResult | null => {
    const s = sig3(3, 6);
    const d = g.pick([1, 2, 3]);
    const others = [1, 2, 3].filter(x => x !== d);
    const i = others[0], k = others[1];
    const covIK = (i === 1 && k === 2) ? s.s12 : (i === 1 && k === 3) ? s.s13 : s.s23;
    const varI = i === 1 ? s.s11 : i === 2 ? s.s22 : s.s33;
    const varK = k === 1 ? s.s11 : k === 2 ? s.s22 : s.s33;
    const det = varI * varK - covIK * covIK;
    const prod = varI * varK;
    const sq = covIK * covIK;
    const otherPairs: [number, number][] = [[1, 2], [1, 3], [2, 3]];
    const det3 = s.s11 * s.s22 * s.s33 + 2 * s.s12 * s.s13 * s.s23 - s.s11 * s.s23 * s.s23 - s.s22 * s.s13 * s.s13 - s.s33 * s.s12 * s.s12;
    for (const [pi, pk] of otherPairs) {
      if (pi === i && pk === k) continue;
      const covPK = (pi === 1 && pk === 2) ? s.s12 : (pi === 1 && pk === 3) ? s.s13 : s.s23;
      const varP = pi === 1 ? s.s11 : pi === 2 ? s.s22 : s.s33;
      const varK2 = pk === 1 ? s.s11 : pk === 2 ? s.s22 : s.s33;
      const detPK = varP * varK2 - covPK * covPK;
      if (Math.abs(det - detPK) < 1) return null;
    }
    if (Math.abs(det - prod) < 1) return null;
    if (Math.abs(det - det3) < 1) return null;
    return { ...s, d, i, k, covIK, varI, varK, det, prod, sq };
  }, v => v !== null && v.covIK !== 0 && isSig3Valid(v)
    // plan guard G2: a different dropped index and a different matrix than card 4
    && v.d !== mp.d && !(v.s11 === mp.s11 && v.s22 === mp.s22 && v.s33 === mp.s33 && v.s12 === mp.s12 && v.s13 === mp.s13 && v.s23 === mp.s23));

  const md = marginalDetP!;
  const mdMat = mat([[num(md.varI), num(md.covIK)], [num(md.covIK), num(md.varK)]]);

  // --- Card 6: lincomb-var ---
  const lincombP = retry(() => {
    const s = g.pick([2, 3, 4, 5]);
    const tt = g.pick([2, 3, 4, 5]);
    const c = g.random(-3, 3);
    const a1 = g.pick([1, 2, 3]);
    const a2 = g.random(-3, 3);
    const varW = a1 * a1 * s + 2 * a1 * a2 * c + a2 * a2 * tt;
    const noCross = a1 * a1 * s + a2 * a2 * tt;
    const crossOnce = a1 * a1 * s + a1 * a2 * c + a2 * a2 * tt;
    const notSq = a1 * s + a2 * tt + 2 * a1 * a2 * c;
    const wrongSign = a1 * a1 * s + a2 * a2 * tt - 2 * a1 * a2 * c;
    const ignored = s + tt + 2 * c;
    const noCoef = a1 * a1 * s + a2 * a2 * tt + 2 * a1 * a2;
    return { s, t: tt, c, a1, a2, varW, noCross, crossOnce, notSq, wrongSign, ignored, noCoef };
  }, v => {
    if (v.c === 0 || v.c * v.c >= v.s * v.t) return false;
    if (v.a2 === 0) return false;
    if (v.varW <= 0 || v.varW > 60) return false;
    if (Math.abs(v.varW - v.noCross) < 1) return false;
    if (Math.abs(v.varW - v.crossOnce) < 1) return false;
    if (Math.abs(v.varW - v.notSq) < 1) return false;
    if (Math.abs(v.varW - v.wrongSign) < 1) return false;
    if (Math.abs(v.varW - v.ignored) < 1) return false;
    if (Math.abs(v.varW - v.noCoef) < 1) return false;
    return true;
  });

  const lc = lincombP;
  const lcLin2 = formatLin2(lc.a1, lc.a2);
  const lcP1 = lc.a1 * lc.a1 * lc.s;
  const lcP2 = 2 * lc.a1 * lc.a2 * lc.c;
  const lcP3 = lc.a2 * lc.a2 * lc.t;

  // --- Card 7: sum-vs-diff ---
  const sumDiffP = retry(() => {
    const s = g.pick([2, 3, 4, 5]);
    const tt = g.pick([2, 3, 4, 5]);
    const c = g.random(-3, 3);
    return { s, t: tt, c };
  }, v => v.c * v.c < v.s * v.t);

  const sd = sumDiffP;
  const sdVs = sd.s + sd.t + 2 * sd.c;
  const sdVd = sd.s + sd.t - 2 * sd.c;
  const sdOptions = shuffled(g, [
    t('Var(x₁ + x₂) is the larger variance', 'Var(x₁ + x₂) 是较大的方差'),
    t('Var(x₁ − x₂) is the larger variance', 'Var(x₁ − x₂) 是较大的方差'),
    t('The two variances are equal', '两个方差相等'),
  ]);
  const sdCorrectIdxShuffled = sdOptions.findIndex((o, i) => {
    const en = o[0];
    if (sd.c > 0) return en === 'Var(x₁ + x₂) is the larger variance';
    if (sd.c < 0) return en === 'Var(x₁ − x₂) is the larger variance';
    return en === 'The two variances are equal';
  });

  // --- Card 8: validity ---
  const validityP = retry(() => {
    const a = g.pick([2, 3, 4, 5]);
    const b = g.pick([2, 3, 4, 5]);
    const c = g.random(-3, 3);
    if (c === 0 || c * c >= a * b) return null;
    const p1 = g.pick([1, 2, 3]);
    const r1 = g.pick([1, 2, 3]);
    const q1 = g.pick([-4, -3, -2, 2, 3, 4]);
    if (q1 * q1 <= p1 * r1) return null;
    const a2 = g.pick([2, 3, 4, 5]);
    const b2 = g.pick([2, 3, 4, 5]);
    const c1 = g.pick([1, 2, 3]);
    const c2 = g.pick([-3, -2, -1, 1, 2, 3]);
    if (c2 === 0 || c2 === c1) return null;
    if (a2 * b2 - c1 * c2 <= 0) return null;
    const p3 = g.pick([2, 3, 4, 5]);
    const r3 = g.pick([2, 3, 4, 5]);
    const q3 = g.random(-3, 3);
    if (q3 === 0 || q3 * q3 >= p3 * r3) return null;
    return { a, b, c, p1, r1, q1, a2, b2, c1, c2, p3, r3, q3 };
  }, v => v !== null);

  const val = validityP!;
  const valV = mat([[num(val.a), num(val.c)], [num(val.c), num(val.b)]]);
  const valI1 = mat([[num(val.p1), num(val.q1)], [num(val.q1), num(val.r1)]]);
  const valI2 = mat([[num(val.a2), num(val.c1)], [num(val.c2), num(val.b2)]]);
  const valI3 = mat([[num(-val.p3), num(val.q3)], [num(val.q3), num(-val.r3)]]);
  const valOptions = shuffled(g, [valV, valI1, valI2, valI3]);
  const valCorrectIdx = valOptions.indexOf(valV);
  const valDv = val.a * val.b - val.c * val.c;
  const valD1 = num(val.p1 * val.r1 - val.q1 * val.q1);
  const valD3 = val.p3 * val.r3 - val.q3 * val.q3;

  // --- Card 9: challenge ---
  type ChallengeResult = { s11: number; s22: number; s33: number; s12: number; s13: number; s23: number; a1: number; a2: number; a3: number; m1: number; m2: number; m3: number; eU: number; diagSum: number; cross1: number; cross2: number; cross3: number; crossSum: number; varU: number; noCross: number; crossOnce: number; wrongSign: number; allEntries: number; meanNoCoef: number; meanAbs: number; nonZeroCount: number; activeCross: number };
  const challengeP = retry((): ChallengeResult => {
    const s = sig3(3, 5);
    if (!isSig3Valid(s)) throw new Error('retry: sampling condition never satisfied');
    const a1 = g.random(-2, 2);
    const a2 = g.random(-2, 2);
    const a3 = g.random(-2, 2);
    const m1 = g.random(-3, 3);
    const m2 = g.random(-3, 3);
    const m3 = g.random(-3, 3);
    const eU = a1 * m1 + a2 * m2 + a3 * m3;
    const diagSum = a1 * a1 * s.s11 + a2 * a2 * s.s22 + a3 * a3 * s.s33;
    const cross1 = a1 * a2 * s.s12;
    const cross2 = a1 * a3 * s.s13;
    const cross3 = a2 * a3 * s.s23;
    const crossSum = cross1 + cross2 + cross3;
    const varU = diagSum + 2 * crossSum;
    const noCross = diagSum;
    const crossOnce = diagSum + crossSum;
    const wrongSign = diagSum - 2 * crossSum;
    const allEntries = s.s11 + s.s22 + s.s33 + 2 * s.s12 + 2 * s.s13 + 2 * s.s23;
    const meanNoCoef = m1 + m2 + m3;
    const meanAbs = Math.abs(a1) * m1 + Math.abs(a2) * m2 + Math.abs(a3) * m3;
    const nonZeroCount = [a1, a2, a3].filter(x => x !== 0).length;
    const activeCross = [cross1, cross2, cross3].filter(x => x !== 0).length;
    return { ...s, a1, a2, a3, m1, m2, m3, eU, diagSum, cross1, cross2, cross3, crossSum, varU, noCross, crossOnce, wrongSign, allEntries, meanNoCoef, meanAbs, nonZeroCount, activeCross };
  }, v => {
    if (v.nonZeroCount < 2) return false;
    if (v.activeCross < 2) return false;
    if (v.varU <= 0 || v.varU > 40) return false;
    if (v.eU === 0) return false;
    if (Math.abs(v.varU - v.noCross) < 1) return false;
    if (Math.abs(v.varU - v.crossOnce) < 1) return false;
    if (Math.abs(v.varU - v.wrongSign) < 1) return false;
    if (Math.abs(v.varU - v.allEntries) < 1) return false;
    if (Math.abs(v.eU - v.meanNoCoef) < 1) return false;
    if (Math.abs(v.eU - v.meanAbs) < 1) return false;
    return true;
  });

  const ch = challengeP;
  const chLin3 = formatLin3(ch.a1, ch.a2, ch.a3);
  // only the pairs whose two coefficients are both non-zero are listed (plan); the others contribute 0 anyway
  const chCrossList = ([[ch.a1, ch.a2, ch.cross1], [ch.a1, ch.a3, ch.cross2], [ch.a2, ch.a3, ch.cross3]] as const).filter(([x, y]) => x !== 0 && y !== 0).map(([, , v]) => par(v)).join(' + ');
  const chEParts = [`${par(ch.a1)}·${par(ch.m1)}`, `${par(ch.a2)}·${par(ch.m2)}`, `${par(ch.a3)}·${par(ch.m3)}`].join(' + ');

  return [
    g.number({
      id: 'read-corr',
      title: t('Reading a covariance matrix', '读懂协方差矩阵'),
      prompt: t(
        `x = (x₁, x₂) is a zero-mean Gaussian vector with covariance matrix Σ = ${mat([[num(corrP.a), num(corrP.c)], [num(corrP.c), num(corrP.b)]])}. The correlation of x₁ and x₂ is ρ = Cov(x₁, x₂) / (√Var(x₁) · √Var(x₂)). What is ρ? Give an integer, a fraction or a decimal rounded to 2 places.`,
        `x = (x₁, x₂) 是零均值高斯向量，协方差矩阵 Σ = ${mat([[num(corrP.a), num(corrP.c)], [num(corrP.c), num(corrP.b)]])}。x₁ 与 x₂ 的相关系数为 ρ = Cov(x₁, x₂) / (√Var(x₁) · √Var(x₂))。ρ 是多少？请填整数、分数，或保留 2 位小数的小数。`
      ),
      fields: [{ label: t('ρ', 'ρ'), answer: rho, tolerance: 0.006 }],
      hint: t(
        'The variances are the diagonal entries; the covariance is the off-diagonal entry. Take the square root of the product of the two variances.',
        '方差是对角元，协方差是非对角元。对两个方差的乘积开平方。'
      ),
      explanation: t(
        `Var(x₁) = ${corrP.a} and Var(x₂) = ${corrP.b} are the diagonal entries, Cov(x₁, x₂) = ${num(corrP.c)} is the off-diagonal entry. √(${corrP.a} · ${corrP.b}) = √${corrP.a * corrP.b} = ${corrP.s}, so ρ = ${num(corrP.c)}/${corrP.s}${exact(rho) === `${num(corrP.c)}/${corrP.s}` ? '' : ` = ${exact(rho)}`}. The entry ${num(corrP.c)} is the covariance, not the correlation: the slides write the off-diagonal entry as ρ only for unit variances. The bound |c| ≤ √a √b of Lecture 1 p. 52 says exactly that |ρ| ≤ 1.`,
        `Var(x₁) = ${corrP.a}、Var(x₂) = ${corrP.b} 是对角元，Cov(x₁, x₂) = ${num(corrP.c)} 是非对角元。√(${corrP.a} · ${corrP.b}) = √${corrP.a * corrP.b} = ${corrP.s}，所以 ρ = ${num(corrP.c)}/${corrP.s}${exact(rho) === `${num(corrP.c)}/${corrP.s}` ? '' : ` = ${exact(rho)}`}。${num(corrP.c)} 是协方差，不是相关系数：只有方差都为 1 时，讲义才把非对角元记作 ρ。第 1 讲第 52 页的界 |c| ≤ √a √b 恰好说明 |ρ| ≤ 1。`
      ),
      audit: { kind: 'GP-01:read-corr', params: { a: corrP.a, b: corrP.b, c: corrP.c } },
    }),
    g.choice({
      id: 'match-contour',
      title: t('Which density is this?', '这是哪个密度？'),
      prompt: t(
        `x = (x₁, x₂) is a Gaussian vector with mean 0 and covariance matrix Σ = ${mat([[num(contourP.a), num(contourP.c)], [num(contourP.c), num(contourP.b)]])}. The figure shows four zero-mean Gaussian densities, each by its contour (x − μ)ᵀΣ⁻¹(x − μ) = 1, with x₁ horizontal and x₂ vertical on the same scale in every panel. Exactly one panel belongs to this Σ. Which one?`,
        `x = (x₁, x₂) 是均值为 0、协方差矩阵为 Σ = ${mat([[num(contourP.a), num(contourP.c)], [num(contourP.c), num(contourP.b)]])} 的高斯向量。图中画出四个零均值高斯密度，每个用其等高线 (x − μ)ᵀΣ⁻¹(x − μ) = 1 表示，每个面板中 x₁ 为横轴、x₂ 为纵轴，比例相同。恰有一个面板对应这个 Σ。是哪一个？`
      ),
      options: [t('Panel A', '图 A'), t('Panel B', '图 B'), t('Panel C', '图 C'), t('Panel D', '图 D')],
      correct: 'ABCD'.indexOf(correctLetter),
      fixedOrder: true,
      figure: g.figure({
        alt: t(
          `Four panels A, B, C, D, each with a horizontal axis x₁ and a vertical axis x₂ crossing at the mean, drawn on the same scale, and one ellipse around the crossing point. Panel A: ${descPanel(...panelMatrices[letterToRole['A']])}. Panel B: ${descPanel(...panelMatrices[letterToRole['B']])}. Panel C: ${descPanel(...panelMatrices[letterToRole['C']])}. Panel D: ${descPanel(...panelMatrices[letterToRole['D']])}.`,
          `四个面板 A、B、C、D，每个面板有水平的 x₁ 轴和竖直的 x₂ 轴，交点是均值，比例相同，交点周围各有一个椭圆。图 A：${descPanelZh(...panelMatrices[letterToRole['A']])}。图 B：${descPanelZh(...panelMatrices[letterToRole['B']])}。图 C：${descPanelZh(...panelMatrices[letterToRole['C']])}。图 D：${descPanelZh(...panelMatrices[letterToRole['D']])}。`
        ),
        view: { xmin: -6, xmax: 6, ymin: -6, ymax: 6 },
        shapes,
        aspect: 'equal',
      }),
      hint: t(
        'The ellipse reaches √Σ₁₁ to each side of the centre and √Σ₂₂ up and down. A positive covariance tilts it up to the right, a negative one down to the right, zero leaves it upright.',
        '椭圆向左右各伸出 √Σ₁₁，向上下各伸出 √Σ₂₂。协方差为正时向右上方倾斜，为负时向右下方倾斜，为零时不倾斜。'
      ),
      explanation: t(
        `Σ₁₁ = ${contourP.a} and Σ₂₂ = ${contourP.b}, so the ellipse reaches √${contourP.a} sideways and √${contourP.b} up and down: it reaches further ${contourP.a > contourP.b ? 'left-right' : 'up-down'}. The covariance ${num(contourP.c)} is ${contourP.c > 0 ? 'positive' : 'negative'}, so it is tilted ${contourP.c > 0 ? 'up' : 'down'} to the right. Panel ${nLetter} has the opposite tilt (it belongs to −c), panel ${sLetter} has the two variances exchanged, and panel ${zLetter} is upright (it belongs to zero covariance). Only panel ${correctLetter} has both the right reach and the right tilt.`,
        `Σ₁₁ = ${contourP.a}，Σ₂₂ = ${contourP.b}，所以椭圆左右伸出 √${contourP.a}、上下伸出 √${contourP.b}：它在${contourP.a > contourP.b ? '左右' : '上下'}方向伸得更远。协方差 ${num(contourP.c)} 为${contourP.c > 0 ? '正' : '负'}，所以向右${contourP.c > 0 ? '上' : '下'}方倾斜。图 ${nLetter} 的倾斜方向相反（对应 −c），图 ${sLetter} 交换了两个方差，图 ${zLetter} 不倾斜（对应协方差为零）。只有图 ${correctLetter} 的伸展和倾斜都对。`
      ),
    }),
    g.choice({
      id: 'peak-height',
      title: t('Which peak is highest?', '哪个峰最高？'),
      prompt: t(
        `Three zero-mean Gaussian densities in two dimensions have the covariance matrices Σ_P = ${mat([[num(peakMatrices[labelToPeakRole['P']][0]), num(peakMatrices[labelToPeakRole['P']][1])], [num(peakMatrices[labelToPeakRole['P']][1]), num(peakMatrices[labelToPeakRole['P']][2])]])}, Σ_Q = ${mat([[num(peakMatrices[labelToPeakRole['Q']][0]), num(peakMatrices[labelToPeakRole['Q']][1])], [num(peakMatrices[labelToPeakRole['Q']][1]), num(peakMatrices[labelToPeakRole['Q']][2])]])}, Σ_R = ${mat([[num(peakMatrices[labelToPeakRole['R']][0]), num(peakMatrices[labelToPeakRole['R']][1])], [num(peakMatrices[labelToPeakRole['R']][1]), num(peakMatrices[labelToPeakRole['R']][2])]])}. Which density has the highest value at its own mean, that is, the highest peak?`,
        `二维中三个零均值高斯密度的协方差矩阵分别为 Σ_P = ${mat([[num(peakMatrices[labelToPeakRole['P']][0]), num(peakMatrices[labelToPeakRole['P']][1])], [num(peakMatrices[labelToPeakRole['P']][1]), num(peakMatrices[labelToPeakRole['P']][2])]])}，Σ_Q = ${mat([[num(peakMatrices[labelToPeakRole['Q']][0]), num(peakMatrices[labelToPeakRole['Q']][1])], [num(peakMatrices[labelToPeakRole['Q']][1]), num(peakMatrices[labelToPeakRole['Q']][2])]])}，Σ_R = ${mat([[num(peakMatrices[labelToPeakRole['R']][0]), num(peakMatrices[labelToPeakRole['R']][1])], [num(peakMatrices[labelToPeakRole['R']][1]), num(peakMatrices[labelToPeakRole['R']][2])]])}。哪个密度在自己的均值处取值最大，即峰最高？`
      ),
      options: [t('Σ_P', 'Σ_P'), t('Σ_Q', 'Σ_Q'), t('Σ_R', 'Σ_R'), t('All three peaks are equal, because every density integrates to 1', '三个峰一样高，因为每个密度的积分都是 1')],
      correct: 'PQR'.indexOf(peakCorrectLabel),
      fixedOrder: true,
      hint: t(
        'At the mean a 2-D Gaussian density equals 1 / (2π · √|Σ|) (Lecture 1 p. 50). Compare the three determinants.',
        '二维高斯密度在均值处的值为 1 / (2π · √|Σ|)（第 1 讲第 50 页）。比较三个行列式。'
      ),
      explanation: t(
        `The peak is 1 / (2π · √|Σ|), so the smallest determinant gives the highest peak. The determinants are ${peakP.a}² = ${peakP.a * peakP.a} for the first diagonal matrix, ${peakP.a}² − ${par(peakP.c)}² = ${peakP.a * peakP.a - peakP.c * peakP.c} for the correlated one and ${peakP.a - 1}² = ${(peakP.a - 1) * (peakP.a - 1)} for the second diagonal matrix. So Σ_${peakCorrectLabel} has the highest peak, although its variances ${peakP.a} are larger than those of the diagonal matrix with ${peakP.a - 1}: the correlation squeezes the density into a narrower ridge. All three integrate to 1; a taller, narrower density and a lower, wider one have the same volume.`,
        `峰值为 1 / (2π · √|Σ|)，所以行列式最小的密度峰最高。第一个对角矩阵的行列式为 ${peakP.a}² = ${peakP.a * peakP.a}，相关的那个为 ${peakP.a}² − ${par(peakP.c)}² = ${peakP.a * peakP.a - peakP.c * peakP.c}，第二个对角矩阵为 ${peakP.a - 1}² = ${(peakP.a - 1) * (peakP.a - 1)}。因此 Σ_${peakCorrectLabel} 的峰最高，尽管它的方差 ${peakP.a} 比对角元为 ${peakP.a - 1} 的矩阵更大：相关性把密度压成更窄的脊。三个密度的积分都是 1；又高又窄的密度和又矮又宽的密度体积相同。`
      ),
    }),
    g.choice({
      id: 'marginal-pick',
      title: t('Dropping a variable', '去掉一个变量'),
      prompt: t(
        `x = (x₁, x₂, x₃) is Gaussian with mean m = (${num(mp.m1)}, ${num(mp.m2)}, ${num(mp.m3)}) and covariance matrix Σ = ${mat([[num(mp.s11), num(mp.s12), num(mp.s13)], [num(mp.s12), num(mp.s22), num(mp.s23)], [num(mp.s13), num(mp.s23), num(mp.s33)]])}. The variable x${sb(mp.d)} is integrated out. Which is the marginal distribution of (x${sb(mp.i)}, x${sb(mp.j)})?`,
        `x = (x₁, x₂, x₃) 是高斯向量，均值 m = (${num(mp.m1)}, ${num(mp.m2)}, ${num(mp.m3)})，协方差矩阵 Σ = ${mat([[num(mp.s11), num(mp.s12), num(mp.s13)], [num(mp.s12), num(mp.s22), num(mp.s23)], [num(mp.s13), num(mp.s23), num(mp.s33)]])}。对变量 x${sb(mp.d)} 积分，把它消去。(x${sb(mp.i)}, x${sb(mp.j)}) 的边缘分布是哪一个？`
      ),
      options: mpOptions.map(s => t(s, s)),
      correct: mpCorrectIdx,
      hint: t(
        `Integrating x${sb(mp.d)} out deletes its entry from the mean and its row and column from Σ; everything else stays exactly as it is (Lecture 1 p. 57).`,
        `对 x${sb(mp.d)} 积分就是从均值中去掉它的分量、从 Σ 中去掉它的行和列，其余保持不变（第 1 讲第 57 页）。`
      ),
      explanation: t(
        `Delete entry ${mp.d} of m and row ${mp.d} and column ${mp.d} of Σ. What remains is the mean (${num(getMean4(mp.i))}, ${num(getMean4(mp.j))}) and the covariance ${mat([[num(getVar4(mp.i)), num(getCov4(mp.i, mp.j))], [num(getCov4(mp.i, mp.j)), num(getVar4(mp.j))]])}. The covariance ${num(getCov4(mp.i, mp.j))} between x${sb(mp.i)} and x${sb(mp.j)} is kept: marginalising does not make them independent. The option with the block that contains x${sb(mp.d)} describes a pair that includes the variable we integrated out.`,
        `删去 m 的第 ${mp.d} 个分量，以及 Σ 的第 ${mp.d} 行和第 ${mp.d} 列。剩下的是均值 (${num(getMean4(mp.i))}, ${num(getMean4(mp.j))}) 和协方差 ${mat([[num(getVar4(mp.i)), num(getCov4(mp.i, mp.j))], [num(getCov4(mp.i, mp.j)), num(getVar4(mp.j))]])}。x${sb(mp.i)} 与 x${sb(mp.j)} 之间的协方差 ${num(getCov4(mp.i, mp.j))} 保留：边缘化不会让它们变得独立。含有 x${sb(mp.d)} 的那个块描述的是包含被积分掉的变量的一对变量。`
      ),
    }),
    g.number({
      id: 'marginal-det',
      title: t('Determinant of a marginal', '边缘分布的行列式'),
      prompt: t(
        `x = (x₁, x₂, x₃) is a zero-mean Gaussian vector with covariance matrix Σ = ${mat([[num(md.s11), num(md.s12), num(md.s13)], [num(md.s12), num(md.s22), num(md.s23)], [num(md.s13), num(md.s23), num(md.s33)]])}. The variable x${sb(md.d)} (component ${md.d}) is integrated out. What is the determinant of the covariance matrix of the marginal distribution of (x${sb(md.i)}, x${sb(md.k)})? Give an integer.`,
        `x = (x₁, x₂, x₃) 是零均值高斯向量，协方差矩阵 Σ = ${mat([[num(md.s11), num(md.s12), num(md.s13)], [num(md.s12), num(md.s22), num(md.s23)], [num(md.s13), num(md.s23), num(md.s33)]])}。对变量 x${sb(md.d)}（第 ${md.d} 个分量）积分，把它消去。(x${sb(md.i)}, x${sb(md.k)}) 的边缘分布的协方差矩阵的行列式是多少？请填整数。`
      ),
      fields: [{ label: t('det', 'det'), answer: md.det, tolerance: 0.006 }],
      hint: t(
        `The marginal covariance keeps only rows and columns ${md.i} and ${md.k} of Σ (Lecture 1 p. 57). For a 2 × 2 matrix [[p, q], [q, r]] the determinant is p·r − q².`,
        `边缘分布的协方差只保留 Σ 的第 ${md.i} 行、第 ${md.k} 行和第 ${md.i} 列、第 ${md.k} 列（第 1 讲第 57 页）。2 × 2 矩阵 [[p, q], [q, r]] 的行列式是 p·r − q²。`
      ),
      explanation: t(
        `Delete row ${md.d} and column ${md.d}: the marginal covariance is ${mdMat}. Its determinant is ${md.varI}·${md.varK} − ${par(md.covIK)}² = ${md.prod} − ${md.sq} = ${exact(md.det)}. (The determinant of the whole 3 × 3 matrix is not asked, and the product ${md.prod} alone forgets the covariance.)`,
        `删去第 ${md.d} 行和第 ${md.d} 列，边缘协方差为 ${mdMat}。它的行列式为 ${md.varI}·${md.varK} − ${par(md.covIK)}² = ${md.prod} − ${md.sq} = ${exact(md.det)}。（并不要求整个 3 × 3 矩阵的行列式；只算乘积 ${md.prod} 会漏掉协方差。）`
      ),
      audit: { kind: 'GP-01:marginal-det', params: { s11: md.s11, s12: md.s12, s13: md.s13, s22: md.s22, s23: md.s23, s33: md.s33, drop: md.d } },
    }),
    g.number({
      id: 'lincomb-var',
      title: t('Variance of a linear combination', '线性组合的方差'),
      prompt: t(
        `x = (x₁, x₂) is a zero-mean Gaussian vector with covariance matrix Σ = ${mat([[num(lc.s), num(lc.c)], [num(lc.c), num(lc.t)]])}. Let w = ${lcLin2}. What is Var(w)? Give an integer.`,
        `x = (x₁, x₂) 是零均值高斯向量，协方差矩阵 Σ = ${mat([[num(lc.s), num(lc.c)], [num(lc.c), num(lc.t)]])}。令 w = ${lcLin2}。Var(w) 是多少？请填整数。`
      ),
      fields: [{ label: t('Var(w)', 'Var(w)'), answer: lc.varW, tolerance: 0.006 }],
      hint: t(
        `w = aᵀx with aᵀ = (${num(lc.a1)}, ${num(lc.a2)}), and Var(aᵀx) = aᵀΣa (Lecture 1 p. 54 eq. 16). Written out: a₁²Σ₁₁ + 2a₁a₂Σ₁₂ + a₂²Σ₂₂.`,
        `w = aᵀx，aᵀ = (${num(lc.a1)}, ${num(lc.a2)})，且 Var(aᵀx) = aᵀΣa（第 1 讲第 54 页式 16）。展开：a₁²Σ₁₁ + 2a₁a₂Σ₁₂ + a₂²Σ₂₂。`
      ),
      explanation: t(
        `Var(w) = ${num(lc.a1)}²·${lc.s} + 2·${par(lc.a1)}·${par(lc.a2)}·${par(lc.c)} + ${par(lc.a2)}²·${lc.t} = ${lcP1} ${term(lcP2)} + ${lcP3} = ${exact(lc.varW)}. Dropping the cross term would give ${lc.noCross}, which is wrong whenever the variables are correlated.`,
        `Var(w) = ${num(lc.a1)}²·${lc.s} + 2·${par(lc.a1)}·${par(lc.a2)}·${par(lc.c)} + ${par(lc.a2)}²·${lc.t} = ${lcP1} ${term(lcP2)} + ${lcP3} = ${exact(lc.varW)}。如果漏掉交叉项会得到 ${lc.noCross}，只要变量相关就是错的。`
      ),
      audit: { kind: 'GP-01:lincomb-var', params: { s11: lc.s, s12: lc.c, s22: lc.t, a1: lc.a1, a2: lc.a2 } },
    }),
    g.choice({
      id: 'sum-vs-diff',
      title: t('Sum or difference?', '和还是差？'),
      prompt: t(
        `(x₁, x₂) is a zero-mean Gaussian vector with covariance matrix Σ = ${mat([[num(sd.s), num(sd.c)], [num(sd.c), num(sd.t)]])}. Compare the variance of the sum x₁ + x₂ with the variance of the difference x₁ − x₂. Which statement is correct?`,
        `(x₁, x₂) 是零均值高斯向量，协方差矩阵 Σ = ${mat([[num(sd.s), num(sd.c)], [num(sd.c), num(sd.t)]])}。比较和 x₁ + x₂ 的方差与差 x₁ − x₂ 的方差。下列哪条说法正确？`
      ),
      options: sdOptions,
      correct: sdCorrectIdxShuffled,
      hint: t(
        `Var(x₁ ± x₂) = Σ₁₁ + Σ₂₂ ± 2Σ₁₂. Look at the sign of Σ₁₂ = ${num(sd.c)}.`,
        `Var(x₁ ± x₂) = Σ₁₁ + Σ₂₂ ± 2Σ₁₂。看 Σ₁₂ = ${num(sd.c)} 的正负。`
      ),
      explanation: t(
        `Var(x₁ + x₂) = ${sd.s} + ${sd.t} + 2·${par(sd.c)} = ${sdVs} and Var(x₁ − x₂) = ${sd.s} + ${sd.t} − 2·${par(sd.c)} = ${sdVd}. ${sd.c > 0 ? 'Positively correlated variables move together, so the sum varies more than the difference.' : sd.c < 0 ? 'Negatively correlated variables move in opposite directions, so the difference varies more than the sum.' : 'With zero covariance the cross term vanishes and both variances equal the sum of the variances.'}`,
        `Var(x₁ + x₂) = ${sd.s} + ${sd.t} + 2·${par(sd.c)} = ${sdVs}，Var(x₁ − x₂) = ${sd.s} + ${sd.t} − 2·${par(sd.c)} = ${sdVd}。${sd.c > 0 ? '正相关的变量同向变化，所以和的波动比差大。' : sd.c < 0 ? '负相关的变量反向变化，所以差的波动比和大。' : '协方差为零时交叉项消失，两个方差都等于方差之和。'}`
      ),
    }),
    g.choice({
      id: 'validity',
      title: t('Which one is a covariance matrix?', '哪个是协方差矩阵？'),
      prompt: t(
        'Exactly one of these four matrices could be the covariance matrix of a Gaussian vector. Which one?',
        '这四个矩阵中恰有一个可以作为某个高斯向量的协方差矩阵。是哪一个？'
      ),
      options: valOptions.map(s => t(s, s)),
      correct: valCorrectIdx,
      hint: t(
        'A covariance matrix must be symmetric (Σᵢⱼ = Σⱼᵢ) and positive definite. For [[a, c], [c, b]] that means a > 0 and ab − c² > 0 (Lecture 1 p. 52).',
        '协方差矩阵必须对称 (Σᵢⱼ = Σⱼᵢ) 且正定。对 [[a, c], [c, b]]，这意味着 a > 0 且 ab − c² > 0（第 1 讲第 52 页）。'
      ),
      explanation: t(
        `${valV} is symmetric, its diagonal is positive and its determinant is ${valDv} > 0, so it is valid. ${valI1} is symmetric but its determinant is ${valD1} < 0: the covariance ${num(val.q1)} is larger than √(${val.p1}·${val.r1}) allows. ${valI2} has ${val.c1} above the diagonal and ${num(val.c2)} below, so it is not symmetric. ${valI3} has a positive determinant (${valD3}) but negative diagonal entries; a variance cannot be negative.`,
        `${valV} 对称，对角元为正，行列式为 ${valDv} > 0，所以是合法的。${valI1} 对称，但行列式为 ${valD1} < 0：协方差 ${num(val.q1)} 超过了 √(${val.p1}·${val.r1}) 允许的范围。${valI2} 的对角线上方是 ${val.c1}、下方是 ${num(val.c2)}，不对称。${valI3} 的行列式为正 (${valD3})，但对角元为负；方差不能为负。`
      ),
    }),
    g.number({
      id: 'challenge',
      title: t('Challenge: a new Gaussian', '挑战：新的高斯分布'),
      prompt: t(
        `x = (x₁, x₂, x₃) is Gaussian with mean m = (${num(ch.m1)}, ${num(ch.m2)}, ${num(ch.m3)}) and covariance matrix Σ = ${mat([[num(ch.s11), num(ch.s12), num(ch.s13)], [num(ch.s12), num(ch.s22), num(ch.s23)], [num(ch.s13), num(ch.s23), num(ch.s33)]])}. Let u = ${chLin3}. Find E[u] and Var(u). Give integers.`,
        `x = (x₁, x₂, x₃) 是高斯向量，均值 m = (${num(ch.m1)}, ${num(ch.m2)}, ${num(ch.m3)})，协方差矩阵 Σ = ${mat([[num(ch.s11), num(ch.s12), num(ch.s13)], [num(ch.s12), num(ch.s22), num(ch.s23)], [num(ch.s13), num(ch.s23), num(ch.s33)]])}。令 u = ${chLin3}。求 E[u] 和 Var(u)。请填整数。`
      ),
      fields: [
        { label: t('E[u]', 'E[u]'), answer: ch.eU, tolerance: 0.006 },
        { label: t('Var(u)', 'Var(u)'), answer: ch.varU, tolerance: 0.006 },
      ],
      hint: t(
        'A linear combination of a Gaussian vector is Gaussian: its mean is aᵀm and its variance is aᵀΣa (Lecture 1 pp. 48 and 54).',
        '高斯向量的线性组合仍是高斯：均值是 aᵀm，方差是 aᵀΣa（第 1 讲第 48 页和第 54 页）。'
      ),
      explanation: t(
        `E[u] = ${chEParts} = ${exact(ch.eU)}. Var(u): the squared coefficients with the variances give ${ch.diagSum}, the cross terms give 2·(${chCrossList}) = ${num(2 * ch.crossSum)}, so Var(u) = ${ch.diagSum} ${term(2 * ch.crossSum)} = ${exact(ch.varU)}. This game does not assess conditioning, sampling or evaluating the density at a point.`,
        `E[u] = ${chEParts} = ${exact(ch.eU)}。Var(u)：系数平方乘方差得 ${ch.diagSum}，交叉项为 2·(${chCrossList}) = ${num(2 * ch.crossSum)}，所以 Var(u) = ${ch.diagSum} ${term(2 * ch.crossSum)} = ${exact(ch.varU)}。本游戏不考查条件化、采样或在某点计算密度值。`
      ),
      audit: { kind: 'GP-01:challenge', params: { s11: ch.s11, s12: ch.s12, s13: ch.s13, s22: ch.s22, s23: ch.s23, s33: ch.s33, m1: ch.m1, m2: ch.m2, m3: ch.m3, a1: ch.a1, a2: ch.a2, a3: ch.a3 } },
    }),
  ];
};
