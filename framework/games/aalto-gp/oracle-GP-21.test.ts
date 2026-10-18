import { describe, expect, it } from 'vitest';
import { gp21 } from './games/gp21';
import { spreadSeed, questionTextOf, textOf } from '../mit-multivariable-calculus/deck-invariants';
import { gradeCard, parseGameNumber, type GameLanguage, type PracticeCard } from '../types';

const SEEDS = 60;
const LANGS: GameLanguage[] = ['en', 'zh'];
const SLUGS = ['entry-one', 'entry-two', 'schur-gap', 'rank-zeros', 'exactness-check', 'small-matrix', 'woodbury-entry', 'cost-ratio', 'challenge'] as const;
type Slug = (typeof SLUGS)[number];
const NUMERIC: Slug[] = ['entry-one', 'entry-two', 'schur-gap', 'rank-zeros', 'small-matrix', 'woodbury-entry', 'cost-ratio', 'challenge'];

const cache = new Map<string, PracticeCard[]>();
function deck(index: number, lang: GameLanguage): PracticeCard[] {
  const key = `${index}:${lang}`;
  if (!cache.has(key)) cache.set(key, gp21(spreadSeed(index), lang));
  return cache.get(key)!;
}
const slugOf = (card: PracticeCard) => card.id.replace(/^GP-21-/, '');
const cardOf = (index: number, lang: GameLanguage, slug: Slug) => deck(index, lang).find(card => slugOf(card) === slug)!;

// ---------- independent linear algebra (no reuse of any plan closed form) ----------
type Mat = number[][];
function solve(A: Mat, B: Mat): Mat {
  const n = A.length, m = B[0].length;
  const M = A.map((row, i) => [...row, ...B[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    expect(Math.abs(M[c][c]), 'singular matrix').toBeGreaterThan(1e-12);
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k < n + m; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row.slice(n).map(v => v / M[i][i]));
}
const eye = (n: number): Mat => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
const inv = (A: Mat): Mat => solve(A, eye(A.length));
const mul = (A: Mat, B: Mat): Mat => A.map(row => B[0].map((_, j) => row.reduce((s, v, k) => s + v * B[k][j], 0)));
const tr = (A: Mat): Mat => A[0].map((_, j) => A.map(row => row[j]));
const add = (A: Mat, B: Mat): Mat => A.map((row, i) => row.map((v, j) => v + B[i][j]));
const scale = (A: Mat, s: number): Mat => A.map(row => row.map(v => v * s));
const col = (v: number[]): Mat => v.map(x => [x]);
/** Jacobi eigenvalues of a symmetric matrix. */
function eigenvalues(S: Mat): number[] {
  const n = S.length;
  const A = S.map(r => [...r]);
  for (let sweep = 0; sweep < 100; sweep++) {
    let off = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-26) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-30) continue;
      const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
      for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
    }
  }
  return A.map((r, i) => r[i]);
}

// ---------- exact rational helper to test denominators ----------
const gcd = (a: number, b: number): number => (b === 0 ? Math.abs(a) : gcd(b, a % b));
function asFraction(x: number): [number, number] | null {
  for (let d = 1; d <= 1000; d++) {
    const n = Math.round(x * d);
    if (Math.abs(n / d - x) < 1e-9) { const g = gcd(n, d) || 1; return [n / g, d / g]; }
  }
  return null;
}
const DENOMS = new Set([1, 2, 4, 5, 8, 10]);
const denominatorOk = (x: number) => { const f = asFraction(x); return !!f && DENOMS.has(f[1]); };
const fractionString = (x: number) => { const [n, d] = asFraction(x)!; return d === 1 ? String(n) : `${n}/${d}`; };

// ---------- printed-number parsing ----------
const NUM = String.raw`[−-]?\d+(?:\.\d+)?(?:/\d+)?`;
const val = (s: string): number => { const v = parseGameNumber(s); expect(v, `unparseable number "${s}"`).not.toBeNull(); return v!; };
function grab(text: string, re: RegExp, what: string): string[] {
  const m = text.match(re);
  expect(m, `${what}: pattern ${re} not found in "${text.slice(0, 160)}"`).not.toBeNull();
  return m!.slice(1);
}
const SEP = String.raw`\s*[,、]\s*`;
const vecRe = (n: number) => `\\((${Array(n).fill(NUM).join(`)${SEP}(`)})\\)`;
const rowRe = (n: number) => `\\[(${Array(n).fill(NUM).join('), (')})\\]`.replaceAll('), (', `)${SEP}(`);
function matrix(text: string, label: string, rows: number, cols: number): number[][] {
  const row = `\\[${Array(cols).fill(`(${NUM})`).join(SEP)}\\]`;
  const re = new RegExp(`${label} = \\[${Array(rows).fill(row).join(`${SEP}`)}\\]`);
  const g = grab(text, re, `matrix ${label}`).map(val);
  return Array.from({ length: rows }, (_, i) => g.slice(i * cols, (i + 1) * cols));
}
const vector = (text: string, label: string, n: number): number[] => grab(text, new RegExp(`${label} = ${vecRe(n)}`), `vector ${label}`).map(val);
const scalar = (text: string, re: RegExp, what: string) => val(grab(text, re, what)[0]);
/** audit parameter -> number; [n, d] means the fraction n/d, [n] the number n. */
function pv(p: number | number[] | undefined): number {
  expect(p, 'missing audit param').toBeDefined();
  if (Array.isArray(p)) { expect(p.length === 1 || p.length === 2, `bad fraction array ${JSON.stringify(p)}`).toBe(true); return p.length === 2 ? p[0] / p[1] : p[0]; }
  return p!;
}

// ---------- per-card specification: printed numbers, independent answer, wrong routes ----------
type Spec = {
  /** numbers read back out of the printed prompt, keyed like the audit params */
  printed: (prompt: string) => Record<string, number>;
  /** answer from the printed numbers by an independent route */
  answer: (n: Record<string, number>) => number;
  /** every wrong route listed in the plan's guard */
  wrong: (n: Record<string, number>) => number[];
  gap: number;
  tolerance: number;
};
const spec: Record<Exclude<Slug, 'exactness-check'>, Spec> = {
  'entry-one': {
    printed: p => ({ s: scalar(p, new RegExp(`k\\(z, z\\) = (${NUM})`), 's'), a1: scalar(p, new RegExp(`k\\(x₁, z\\) = (${NUM})`), 'a1'), a2: scalar(p, new RegExp(`k\\(x₂, z\\) = (${NUM})`), 'a2') }),
    answer: n => mul(mul(col([n.a1, n.a2]), inv([[n.s]])), tr(col([n.a1, n.a2])))[0][1],
    wrong: n => [n.a1 * n.a2, n.a1 * n.a2 * n.s, (n.a1 + n.a2) / n.s, n.a1 * n.a2 / n.s ** 2, n.a1 / n.s, n.a2 / n.s],
    gap: 0.1, tolerance: 0.006,
  },
  'entry-two': {
    printed: p => {
      const Kzz = matrix(p, 'K_zz', 2, 2);
      expect(Kzz[0][0], 'K_zz diagonal equal').toBe(Kzz[1][1]);
      expect(Kzz[0][1], 'K_zz symmetric').toBe(Kzz[1][0]);
      const D = scalar(p, new RegExp(`(?:with determinant|行列式为) (${NUM})`), 'determinant');
      const [p1, p2] = vector(p, String.raw`k\(x, Z\)`, 2), [q1, q2] = vector(p, String.raw`k\(x′, Z\)`, 2);
      return { a: Kzz[0][0], b: Kzz[0][1], D, p1, p2, q1, q2 };
    },
    // row * solve(Kzz, column): hand-written Gauss-Jordan
    answer: n => mul([[n.p1, n.p2]], solve([[n.a, n.b], [n.b, n.a]], col([n.q1, n.q2])))[0][0],
    wrong: n => {
      const S = n.p1 * n.q1 + n.p2 * n.q2, X = n.p1 * n.q2 + n.p2 * n.q1, D = n.a * n.a - n.b * n.b;
      return [(n.a * S + n.b * X) / D, n.a * S + n.b * X, n.a * S - n.b * X, S, S / n.a, (n.a * S - n.b * X) / n.a];
    },
    gap: 0.1, tolerance: 0.006,
  },
  'schur-gap': {
    printed: p => {
      const K = matrix(p, 'K', 2, 2);
      expect(K[0][1], 'K symmetric').toBe(K[1][0]);
      return { s: K[0][0], a: K[0][1], v: K[1][1] };
    },
    answer: n => {
      const K = [[n.s, n.a], [n.a, n.v]], Kz = [[n.s], [n.a]];
      const direct = add(K, scale(mul(mul(Kz, inv([[n.s]])), tr(Kz)), -1))[1][1];
      const viaInverse = 1 / inv(K)[1][1];
      expect(direct).toBeCloseTo(viaInverse, 9);
      return direct;
    },
    wrong: n => [n.v, n.a ** 2 / n.s, n.v - n.a ** 2, n.v - n.a / n.s, n.v * n.s - n.a ** 2, (n.v - n.a ** 2) / n.s],
    gap: 0.1, tolerance: 0.006,
  },
  'rank-zeros': {
    printed: p => ({ N: scalar(p, /\bN = (\d+)/, 'N'), M: scalar(p, /\bM = (\d+)/, 'M') }),
    answer: n => {
      // deterministic pseudo-random full-rank Kz (N x M) and Kzz = A A^T + I
      let state = 12345 + 31 * n.N + n.M;
      const rnd = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296 * 2 - 1; };
      const Kz = Array.from({ length: n.N }, () => Array.from({ length: n.M }, rnd));
      const A = Array.from({ length: n.M }, () => Array.from({ length: n.M }, rnd));
      const Kzz = add(mul(A, tr(A)), eye(n.M));
      const Kt = mul(mul(Kz, inv(Kzz)), tr(Kz));
      const trace = Kt.reduce((s, r, i) => s + r[i], 0);
      return eigenvalues(Kt).filter(e => Math.abs(e) < 1e-8 * trace).length;
    },
    wrong: n => [n.M, n.N, n.N - n.M + 1, n.N - n.M - 1],
    gap: 1, tolerance: 0.006,
  },
  'small-matrix': {
    printed: p => {
      const Kzz = matrix(p, 'K_zz', 2, 2), Kz = matrix(p, 'K_z', 3, 2);
      expect(Kzz[0][0], 'K_zz diagonal is 3').toBe(3);
      expect(Kzz[1][1]).toBe(3);
      expect(Kzz[0][1]).toBe(Kzz[1][0]);
      return { sg: scalar(p, new RegExp(`σ² = (${NUM})`), 'sigma2'), t: Kzz[0][1], a1: Kz[0][0], b1: Kz[0][1], a2: Kz[1][0], b2: Kz[1][1], a3: Kz[2][0], b3: Kz[2][1] };
    },
    answer: n => {
      const Kz = [[n.a1, n.b1], [n.a2, n.b2], [n.a3, n.b3]];
      return add([[3, n.t], [n.t, 3]], scale(mul(tr(Kz), Kz), 1 / n.sg))[0][1];
    },
    wrong: n => {
      const d = n.a1 * n.b1 + n.a2 * n.b2 + n.a3 * n.b3, c = n.a1 * n.a2 + n.b1 * n.b2;
      return [d / n.sg, n.t + d, n.t + d * n.sg, n.t + c / n.sg, n.t + c, d, n.t];
    },
    gap: 0.1, tolerance: 0.006,
  },
  'woodbury-entry': {
    printed: p => {
      const [a1, a2] = vector(p, 'K_z', 2);
      return { s: scalar(p, new RegExp(`K_zz = (${NUM})`), 's'), a1, a2, sg: scalar(p, new RegExp(`σ² = (${NUM})`), 'sigma2') };
    },
    // dense N x N inverse, no Woodbury
    answer: n => inv(add(scale(mul(col([n.a1, n.a2]), tr(col([n.a1, n.a2]))), 1 / n.s), scale(eye(2), n.sg)))[0][0],
    wrong: n => {
      const m = n.s + (n.a1 ** 2 + n.a2 ** 2) / n.sg, g = n.sg;
      return [1 / g + n.a1 ** 2 / (g * g * m), 1 / g - n.a1 ** 2 / (g * m), 1 / g - n.a1 ** 2 / (g * g * (n.s + n.a1 ** 2 + n.a2 ** 2)), 1 / g, -n.a1 * n.a2 / (g * g * m), n.a1 ** 2 / (g * g * m), 1 / g - n.a1 ** 2 / (g * g * (n.s + n.a1 ** 2))];
    },
    gap: 0.1, tolerance: 0.006,
  },
  'cost-ratio': {
    printed: p => ({ N: scalar(p, /\bN = (\d+)/, 'N'), M: scalar(p, /\bM = (\d+)/, 'M') }),
    answer: n => {
      const num = BigInt(n.N) ** 3n, den = BigInt(n.N) * BigInt(n.M) ** 2n;
      expect(num % den, 'cost ratio not an integer').toBe(0n);
      return Number(num / den);
    },
    wrong: n => [n.N / n.M, (n.N / n.M) ** 3, n.N ** 2 / n.M, n.N * n.M, n.N ** 3 / n.M],
    gap: 90, tolerance: 0.006,
  },
  challenge: {
    printed: p => {
      const [a1, a2, a3] = vector(p, 'K_z', 3), [y1, y2, y3] = vector(p, 'y', 3);
      return { s: scalar(p, new RegExp(`K_zz = (${NUM})`), 's'), sg: scalar(p, new RegExp(`σ² = (${NUM})`), 'sigma2'), a1, a2, a3, y1, y2, y3 };
    },
    answer: n => {
      const a = [n.a1, n.a2, n.a3], y = [n.y1, n.y2, n.y3];
      const C = add(scale(mul(col(a), tr(col(a))), 1 / n.s), scale(eye(3), n.sg));
      return mul(tr(col(y)), solve(C, col(y)))[0][0];
    },
    wrong: n => {
      const ay = n.a1 * n.y1 + n.a2 * n.y2 + n.a3 * n.y3, yy = n.y1 ** 2 + n.y2 ** 2 + n.y3 ** 2, aa = n.a1 ** 2 + n.a2 ** 2 + n.a3 ** 2;
      const g = n.sg, m = n.s + aa / g;
      expect(ay, 'a.y must be non-zero').not.toBe(0);
      return [yy / g, yy / g + ay ** 2 / (g * g * m), yy / g - ay ** 2 / (g * m), yy / g - ay ** 2 / (g * g * (n.s + aa)), ay ** 2 / (g * g * m), yy / g - ay / (g * g * m)];
    },
    gap: 0.1, tolerance: 0.006,
  },
};
const KINDS: Record<string, Exclude<Slug, 'exactness-check'>> = Object.fromEntries(NUMERIC.map(s => [`GP-21:${s}`, s as Exclude<Slug, 'exactness-check'>]));

const LABELS: Record<Slug, { en: string; zh: string }> = {
  'entry-one': { en: 'K̃₁₂', zh: 'K̃₁₂' },
  'entry-two': { en: 'K̃(x, x′)', zh: 'K̃(x, x′)' },
  'schur-gap': { en: 'K₂₂ − K̃₂₂', zh: 'K₂₂ − K̃₂₂' },
  'rank-zeros': { en: 'Number of zero eigenvalues', zh: '零特征值的个数' },
  'exactness-check': { en: '', zh: '' },
  'small-matrix': { en: 'Entry (1, 2)', zh: '第 (1, 2) 个元素' },
  'woodbury-entry': { en: '(1, 1) entry of the inverse', zh: '逆矩阵的第 (1, 1) 个元素' },
  'cost-ratio': { en: 'Times cheaper', zh: '便宜多少倍' },
  challenge: { en: 'yᵀ(K̃ + σ²I)⁻¹y', zh: 'yᵀ(K̃ + σ²I)⁻¹y' },
};

describe('GP-21 deck shape', () => {
  it('has exactly the nine planned cards in order, in both languages', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      expect(deck(i, lang).map(slugOf)).toEqual([...SLUGS]);
      expect(deck(i, lang).map(c => c.id)).toEqual(SLUGS.map(s => `GP-21-${s}`));
    }
  });
  it('every audited card is one of the seven planned kinds and every numeric card has an audit; no figures anywhere', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const card of deck(i, lang)) {
      const slug = slugOf(card);
      expect(card.figure, `${card.id} must have no figure`).toBeUndefined();
      expect(card.choice?.figures?.some(Boolean) ?? false, `${card.id} choice figures`).toBe(false);
      if (slug === 'exactness-check') { expect(card.audit).toBeUndefined(); expect(card.choice).toBeDefined(); expect(card.fields).toBeUndefined(); continue; }
      expect(card.audit?.kind, card.id).toBe(`GP-21:${slug}`);
      expect(Object.keys(KINDS)).toContain(card.audit!.kind);
      expect(card.fields, card.id).toHaveLength(1);
    }
  });
  it('field labels are the planned EN / ZH labels; number fields use tolerance 0.006', () => {
    for (let i = 0; i < 3; i++) for (const lang of LANGS) for (const card of deck(i, lang)) {
      const slug = slugOf(card) as Slug;
      if (!card.fields) continue;
      expect(card.fields[0].label, `${card.id} ${lang}`).toBe(LABELS[slug][lang]);
      expect(card.fields[0].tolerance, `${card.id} tolerance`).toBe(0.006);
    }
  });
});

describe('GP-21 numeric cards: independent answers, printed text = audit, wrong routes, grading', () => {
  for (const slug of NUMERIC) {
    const s = spec[slug as Exclude<Slug, 'exactness-check'>];
    it(`${slug}: 60 spread seeds x EN/ZH`, () => {
      let fires = 0;
      const edgeKeys = new Set<string>();
      for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
        const card = cardOf(i, lang, slug);
        const where = `${slug} seed#${i} ${lang} params ${JSON.stringify(card.audit!.params)}`;
        // printed numbers == audit params
        const printed = s.printed(card.prompt);
        for (const [k, v] of Object.entries(card.audit!.params)) {
          expect(printed[k], `${where}: param ${k} is not printed`).toBeDefined();
          expect(pv(v), `${where}: printed ${k}=${printed[k]} vs audit ${JSON.stringify(v)}`).toBeCloseTo(printed[k], 9);
        }
        if (slug === 'entry-two') expect(printed.D, `${where} determinant`).toBeCloseTo(printed.a ** 2 - printed.b ** 2, 9);
        // answer
        const truth = s.answer(printed);
        const field = card.fields![0];
        expect(field.answer, `${where}: card answer ${field.answer} vs oracle ${truth}`).toBeCloseTo(truth, 9);
        expect(field.tolerance).toBe(s.tolerance);
        // accepted strings and perturbed strings through gradeCard
        expect(denominatorOk(truth), `${where}: answer ${truth} has a bad denominator`).toBe(true);
        const x100 = truth * 100, nearest = Math.round(x100 + 1e-7) / 100;
        const accepted = [fractionString(truth), String(truth), nearest.toFixed(2)];
        // exactly on a half-cent edge: both neighbouring 2-place roundings must be accepted
        if (Math.abs(x100 - Math.floor(x100 + 1e-7) - 0.5) < 1e-6) accepted.push((Math.floor(x100 + 1e-7) / 100).toFixed(2), (Math.ceil(x100 - 1e-7) / 100).toFixed(2));
        for (const a of accepted) expect(gradeCard(card, [a], null, []), `${where}: "${a}" should be correct`).toBe('correct');
        for (const delta of [0.02, -0.02, 0.5, -1]) expect(gradeCard(card, [String(truth + delta)], null, []), `${where}: ${truth + delta} should be wrong`).toBe('incorrect');
        expect(gradeCard(card, [String(truth + 0.0075)], null, []), `${where}: +0.0075 should be wrong`).toBe('incorrect');
        expect(gradeCard(card, [String(truth - 0.0075)], null, []), `${where}: -0.0075 should be wrong`).toBe('incorrect');
        // every wrong route differs from the truth on every draw
        for (const [route, w] of s.wrong(printed).entries()) {
          expect(Math.abs(w - truth), `${where}: wrong route #${route + 1} = ${w} collides with truth ${truth}`).toBeGreaterThanOrEqual(s.gap - 1e-9);
          expect(gradeCard(card, [String(w)], null, []), `${where}: wrong route #${route + 1} grades correct`).toBe('incorrect');
        }
        // a rounded-to-2-places key must never be ambiguous about being accepted (rounding edge check, literal 0.003 rule)
        const frac = Math.abs(truth * 100 - Math.floor(truth * 100));
        const isInteger = Math.abs(truth - Math.round(truth)) < 1e-12;
        // literal 'within 0.003 of a rounding edge' rule: keys with denominator 8 sit exactly on x.xx5 BY PLAN (3/8, 1/8, 7/8, 27/8); both roundings are accepted above, so this is only counted
        if (!isInteger && Math.abs(frac - 0.5) < 0.3 - 1e-9) edgeKeys.add(`${slug}:${fractionString(truth)}`);
        fires++;
      }
      if (edgeKeys.size) console.info(`rounding-edge keys in ${slug}: ${[...edgeKeys].join(' ')}`);
      expect(fires).toBe(SEEDS * 2);
    });
  }
  it('card answers do not depend on the language', () => {
    for (let i = 0; i < SEEDS; i++) for (const slug of NUMERIC) {
      expect(cardOf(i, 'zh', slug).fields![0].answer).toBe(cardOf(i, 'en', slug).fields![0].answer);
      expect(cardOf(i, 'zh', slug).audit).toEqual(cardOf(i, 'en', slug).audit);
    }
  });
});

describe('GP-21 exactness-check choice card', () => {
  it('exactly one option satisfies the predicate, the answer index points to it, correct option is not the longest', () => {
    const positions = new Set<number>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) {
      const card = cardOf(i, lang, 'exactness-check');
      const en = lang === 'en';
      const N = scalar(card.prompt, /\bN = (\d+)/, 'N');
      const options = card.choice!.options;
      expect(options).toHaveLength(4);
      expect(new Set(options).size).toBe(4);
      // option predicate written from the plan: correct = "all N inputs are in the subset (M = N)"
      const isCorrect = (t: string) => (en
        ? new RegExp(`^All ${N} inputs are in the subset`).test(t) && /\(M = N\)/.test(t)
        : new RegExp(`^全部 ${N} 个输入都在子集中`).test(t) && /（M = N）/.test(t));
      const verdicts = options.map(isCorrect);
      expect(verdicts.filter(Boolean), `seed#${i} ${lang}: ${JSON.stringify(options)}`).toHaveLength(1);
      expect(verdicts[card.choice!.answer], `seed#${i} ${lang}: answer index`).toBe(true);
      // the three wrong options each state M < N (explicit M with M <= N-2, or N-1 of N, or the noise/zero-covariance variants)
      options.forEach((t, k) => {
        if (k === card.choice!.answer) return;
        const mm = t.match(/M = (\d+)/);
        if (mm) expect(Number(mm[1]), `${t}`).toBeLessThanOrEqual(N - 2);
        else expect(t, 'N-1 option').toContain(String(N - 1));
        expect(t).not.toMatch(/M = N/);
      });
      const lens = options.map(t => [...t].length);
      const correctLen = lens[card.choice!.answer];
      const longestWrong = Math.max(...lens.filter((_, k) => k !== card.choice!.answer));
      expect(correctLen, `seed#${i} ${lang}: correct option must be shorter than the longest wrong option`).toBeLessThan(longestWrong);
      if (lang === 'zh') expect(correctLen).toBeLessThan(Math.max(...lens));
      positions.add(card.choice!.answer);
      expect(gradeCard(card, [], card.choice!.answer, [])).toBe('correct');
      for (let k = 0; k < 4; k++) if (k !== card.choice!.answer) expect(gradeCard(card, [], k, [])).toBe('incorrect');
    }
    expect(positions.size, 'options are shuffled').toBeGreaterThanOrEqual(3);
  });
  it('all 12 planned (N, M) pairs are reachable and nothing else', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 3000; i++) {
      const card = gp21(spreadSeed(i), 'en').find(c => c.id.endsWith('exactness-check'))!;
      const N = scalar(card.prompt, /\bN = (\d+)/, 'N');
      const wrong = card.choice!.options.filter((_, k) => k !== card.choice!.answer);
      const M = Number(wrong.map(t => t.match(/M = (\d+)/)).find(Boolean)![1]);
      expect(M).toBeLessThanOrEqual(N - 2);
      expect([4, 5, 6, 8, 10]).toContain(N);
      expect([2, 3, 4]).toContain(M);
      seen.add(`${N},${M}`);
    }
    expect([...seen].sort()).toEqual(['10,2', '10,3', '10,4', '4,2', '5,2', '5,3', '6,2', '6,3', '6,4', '8,2', '8,3', '8,4'].sort());
  });
});

describe('GP-21 variety', () => {
  it('each card has at least 6 distinct prompts (including options) over 60 seeds', () => {
    for (const slug of SLUGS) {
      const distinct = new Set<string>();
      for (let i = 0; i < SEEDS; i++) { const c = cardOf(i, 'en', slug); distinct.add(c.prompt + '|' + (c.choice?.options.join('|') ?? '')); }
      expect(distinct.size, `${slug} distinct prompts`).toBeGreaterThanOrEqual(6);
    }
  });
});

// ---------- sampling spaces of the plan, enumerated from the stated predicates ----------
type Space = { count: number; keys: Set<string>; };
const key = (...xs: number[]) => xs.map(x => (Math.round(x * 1e6) / 1e6).toString()).join(',');
function spaces(): Record<string, Space> {
  const out: Record<string, Space> = {};
  const done = (name: string, keys: string[]) => { out[name] = { count: keys.length, keys: new Set(keys) }; };
  const guard = (T: number, wrong: number[], gap: number) => denominatorOk(T) && wrong.every(w => Math.abs(w - T) >= gap - 1e-9);
  {
    const keys: string[] = [];
    for (const s of [2, 4, 5]) for (const a1 of [0.5, 1, 1.5, 2, 3]) for (const a2 of [0.5, 1, 1.5, 2, 3]) {
      if (a1 === a2) continue;
      const T = a1 * a2 / s;
      // the plan's 24-triple list drops the two exact ties |gap| = 0.1 (5,1.5,2 and 5,2,1.5); the exact-arithmetic predicate (gap >= 0.1) gives 26
      if (s === 5 && ((a1 === 1.5 && a2 === 2) || (a1 === 2 && a2 === 1.5))) continue;
      if (guard(T, spec['entry-one'].wrong({ s, a1, a2 }), 0.1)) keys.push(key(s, a1, a2));
    }
    done('entry-one', keys);
  }
  {
    const keys: string[] = [];
    for (const [a, b] of [[3, 1], [3, 2], [2, 1], [1.5, 0.5], [2.5, 1.5]]) for (const p1 of [0, 1, 2, 3]) for (const p2 of [0, 1, 2, 3]) for (const q1 of [0, 1, 2, 3]) for (const q2 of [0, 1, 2, 3]) {
      if (p1 === p2 || q1 === q2 || (p1 === q1 && p2 === q2)) continue;
      const S = p1 * q1 + p2 * q2, X = p1 * q2 + p2 * q1;
      if (S < 1 || X < 1) continue;
      const T = (a * S - b * X) / (a * a - b * b);
      if (T <= 0) continue;
      if (guard(T, spec['entry-two'].wrong({ a, b, p1, p2, q1, q2 }), 0.1)) keys.push(key(a, b, p1, p2, q1, q2));
    }
    done('entry-two', keys);
  }
  {
    const keys: string[] = [];
    for (const s of [2, 4, 5]) for (const a of [1, 2, 3]) for (const v of [1, 2, 3, 4, 5, 6, 8]) {
      if (v * s <= a * a) continue;
      const T = v - a * a / s;
      if (T <= 0) continue;
      if (guard(T, spec['schur-gap'].wrong({ s, a, v }), 0.1)) keys.push(key(s, a, v));
    }
    done('schur-gap', keys);
  }
  {
    const keys: string[] = [];
    for (const N of [5, 6, 7, 8, 9, 10, 12]) for (const M of [2, 3, 4]) if (N >= M + 2 && N !== 2 * M) keys.push(key(N, M));
    done('rank-zeros', keys);
  }
  {
    const keys: string[] = [];
    for (const sg of [2, 4]) for (const t of [0.5, 1, 2]) for (let code = 0; code < 3 ** 6; code++) {
      const e = Array.from({ length: 6 }, (_, k) => Math.floor(code / 3 ** k) % 3);
      const rows = [[e[0], e[1]], [e[2], e[3]], [e[4], e[5]]];
      if (rows.some(r => r[0] === 0 && r[1] === 0)) continue;
      if (rows.filter(r => r[0] !== 0 && r[1] !== 0).length < 2) continue;
      const d = rows.reduce((acc, r) => acc + r[0] * r[1], 0);
      if (d < 1) continue;
      const T = t + d / sg;
      const n = { sg, t, a1: e[0], b1: e[1], a2: e[2], b2: e[3], a3: e[4], b3: e[5] };
      if (guard(T, spec['small-matrix'].wrong(n), 0.1)) keys.push(key(sg, t, e[0], e[1], e[2], e[3], e[4], e[5]));
    }
    done('small-matrix', keys);
  }
  {
    const keys: string[] = [];
    for (let s = 1; s <= 8; s++) for (let a1 = 1; a1 <= 5; a1++) for (let a2 = 1; a2 <= 5; a2++) for (const sg of [0.25, 0.5, 1, 2]) {
      const m = s + (a1 * a1 + a2 * a2) / sg;
      const T = 1 / sg - a1 * a1 / (sg * sg * m);
      if (guard(T, spec['woodbury-entry'].wrong({ s, a1, a2, sg }), 0.1)) keys.push(key(s, a1, a2, sg));
    }
    done('woodbury-entry', keys);
  }
  done('cost-ratio', [[1000, 20], [1000, 50], [1000, 100], [2000, 20], [2000, 50], [2000, 100], [2500, 50], [2500, 100], [5000, 50], [5000, 100]].map(([N, M]) => key(N, M)));
  {
    const keys: string[] = [];
    const ys: number[][] = [];
    for (let c = 0; c < 125; c++) { const y = [c % 5 - 2, Math.floor(c / 5) % 5 - 2, Math.floor(c / 25) - 2]; if (y.filter(v => v !== 0).length >= 2) ys.push(y); }
    for (const s of [1, 2, 4]) for (const sg of [2, 4]) for (let ca = 0; ca < 64; ca++) {
      const a = [ca % 4, Math.floor(ca / 4) % 4, Math.floor(ca / 16)];
      if (a[0] === a[1] && a[1] === a[2]) continue;
      for (const y of ys) {
        const ay = a[0] * y[0] + a[1] * y[1] + a[2] * y[2];
        if (ay === 0) continue;
        const aa = a[0] ** 2 + a[1] ** 2 + a[2] ** 2, yy = y[0] ** 2 + y[1] ** 2 + y[2] ** 2;
        const T = yy / sg - ay * ay / (sg * sg * (s + aa / sg));
        const n = { s, sg, a1: a[0], a2: a[1], a3: a[2], y1: y[0], y2: y[1], y3: y[2] };
        if (guard(T, spec.challenge.wrong(n), 0.1)) keys.push(key(s, sg, ...a, ...y));
      }
    }
    done('challenge', keys);
  }
  return out;
}
const PLAN_COUNTS: Record<string, number> = { 'entry-one': 24, 'entry-two': 286, 'schur-gap': 30, 'rank-zeros': 18, 'small-matrix': 1024, 'woodbury-entry': 22, 'cost-ratio': 10, challenge: 3228 };
const SPACE_SEEDS = 40000;

describe('GP-21 sampling spaces equal the plan', () => {
  const planned = spaces();
  for (const slug of NUMERIC) {
    it(`${slug}: plan predicate enumerates ${PLAN_COUNTS[slug]} sets`, () => {
      expect(planned[slug].count, `enumerated count for ${slug}`).toBe(PLAN_COUNTS[slug]);
    });
  }
  it(`generator draws only planned sets (never outside) over ${SPACE_SEEDS} seeds, and reaches every set of the small spaces`, () => {
    const drawn: Record<string, Set<string>> = Object.fromEntries(NUMERIC.map(s => [s, new Set<string>()]));
    for (let i = 0; i < SPACE_SEEDS; i++) {
      for (const card of gp21(spreadSeed(i), 'en')) {
        const slug = slugOf(card);
        if (!card.audit) continue;
        const p = card.audit.params;
        const order: Record<string, string[]> = {
          'entry-one': ['s', 'a1', 'a2'], 'entry-two': ['a', 'b', 'p1', 'p2', 'q1', 'q2'], 'schur-gap': ['s', 'a', 'v'], 'rank-zeros': ['N', 'M'],
          'small-matrix': ['sg', 't', 'a1', 'b1', 'a2', 'b2', 'a3', 'b3'], 'woodbury-entry': ['s', 'a1', 'a2', 'sg'], 'cost-ratio': ['N', 'M'], challenge: ['s', 'sg', 'a1', 'a2', 'a3', 'y1', 'y2', 'y3'],
        };
        drawn[slug].add(key(...order[slug].map(k => pv(p[k]))));
      }
    }
    const report: string[] = [];
    for (const slug of NUMERIC) {
      const outside = [...drawn[slug]].filter(k => !planned[slug].keys.has(k));
      report.push(`${slug}: drew ${drawn[slug].size}/${planned[slug].count}, outside the guarded plan space: ${outside.length}${outside.length ? ' e.g. ' + outside.slice(0, 3).join(' ; ') : ''}`);
      if (planned[slug].count <= 300 && drawn[slug].size < planned[slug].count) report.push(`  ${slug}: MISSING ${planned[slug].count - [...planned[slug].keys].filter(k => drawn[slug].has(k)).length} planned sets`);
    }
    console.info(report.join(' || '));
    const bad = report.filter(r => /outside the guarded plan space: [1-9]|MISSING/.test(r));
    expect(bad).toEqual([]);
  }, 600000);
});

describe('GP-21 learner-visible text', () => {
  const ALLOWED_ZH_LATIN = /GP|KL|ELBO|exp|ln|log|Lecture-none/g;
  it('Unicode only, no ASCII minus / double parentheses / raw floats / developer markers / restatements; ZH has no English words', () => {
    const hits = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const card of deck(i, lang)) for (const text of textOf(card)) {
      const flag = (name: string, m: RegExpMatchArray | null) => { if (m) hits.add(`${card.id} [${lang}] ${name}: …${text.slice(Math.max(0, (m.index ?? 0) - 20), (m.index ?? 0) + 30)}…`); };
      flag('ascii minus', text.match(/(^|[\s(\[,、=])-\s?\d/));
      flag('ascii minus between', text.match(/\s-\s/));
      flag('caret', text.match(/\^/));
      flag('double paren', text.match(/\(\(|\)\)|（（|））/));
      flag('raw float', text.match(/\d\.\d{4,}|\d\.\d*0(?![\d.])/));
      flag('developer marker', text.match(/\b(Kz|Kzz|sg|undefined|NaN|Infinity|TODO|null|nan)\b|\{(?!x₁\})|(?<!\{x₁)\}|\$|\\\\|\*\*|<=|>=|->|<-|sigma|\bsqrt\b/));
      flag('x = x', text.match(/= (\S+) = \1(?![\w./])/));
      for (const m of text.matchAll(/= (\d+)\/(\d+)(?![\d.]|\s*[·+−*=\/])/g)) if (gcd(Number(m[1]), Number(m[2])) > 1) flag('unreduced result fraction', m);
      flag('1 coefficient', text.match(/(^|[^\d.])1·/));
      flag('combining-tilde misuse', text.match(/K~|K\^|K˜/));
      if (lang === 'zh') {
        const stripped = text.replace(/O\([^)]*\)/g, '').replace(/[A-Za-z]_[A-Za-z]+/g, '').replace(ALLOWED_ZH_LATIN, '');
        flag('English word in ZH', stripped.match(/[A-Za-z]{2,}/));
        flag('ASCII quote/comma/paren in ZH prose', text.match(/[一-鿿][,;:"'?!]|[,;:"?!][一-鿿]|[一-鿿]\(|\)[一-鿿]/));
      }
    }
    expect([...hits].slice(0, 30)).toEqual([]);
  });
  it('one number style per sentence (no decimal and fraction mixed)', () => {
    const hits = new Set<string>();
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const card of deck(i, lang)) for (const text of [card.prompt, card.hint, card.explanation, ...(card.choice?.options ?? [])]) {
      for (const sentence of text.split(/(?<=[。；])|(?<=[^\d]\.)\s|(?<=\D\.)(?=\s)/)) {
        if (/\d\.\d/.test(sentence) && /(?<![\d.])\d+\/\d+(?![\d.])/.test(sentence.replace(/Give an integer, a fraction or a decimal rounded to 2 places\./, '').replace(/请填整数、分数，或保留 2 位小数的小数。/, '')))
          hits.add(`${card.id} [${lang}] ${sentence.slice(0, 160)}`);
      }
    }
    expect([...hits].slice(0, 20)).toEqual([]);
  });
  it('hints do not contain the answer and are not empty', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const card of deck(i, lang)) {
      expect(card.hint.length).toBeGreaterThan(10);
      expect(card.explanation.length).toBeGreaterThan(40);
      if (card.fields && card.fields[0].answer >= 10) expect(card.hint.includes(String(card.fields[0].answer)), `${card.id} hint leaks the answer`).toBe(false);
    }
  });
  it('prompt text ends with the planned answer-format sentence', () => {
    for (let i = 0; i < SEEDS; i++) for (const lang of LANGS) for (const slug of NUMERIC) {
      const c = cardOf(i, lang, slug);
      const integerOnly = slug === 'rank-zeros' || slug === 'cost-ratio';
      const tail = lang === 'en' ? (integerOnly ? 'Give an integer.' : 'Give an integer, a fraction or a decimal rounded to 2 places.') : integerOnly ? '请填整数。' : '请填整数、分数，或保留 2 位小数的小数。';
      expect(c.prompt.endsWith(tail), `${c.id} ${lang}`).toBe(true);
    }
  });
  it('question text exposes every audit parameter (questionTextOf)', () => {
    for (let i = 0; i < SEEDS; i++) {
      const c = cardOf(i, 'en', 'challenge');
      expect(questionTextOf(c).join(' ')).toContain('K_z');
    }
  });
});
