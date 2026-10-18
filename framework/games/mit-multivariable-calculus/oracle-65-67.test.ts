import { appendFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mv65 } from './games/mv65';
import { mv66 } from './games/mv66';
import { mv67 } from './games/mv67';
import { spreadSeed } from './deck-invariants';
import { simpson } from './oracle-harness';
import { gradeCard, type CardGenerator, type GameLanguage, type PracticeCard } from '../types';
import { figureProblems, type Figure, type FigureShape, type Pt } from '../figure';

/**
 * Acceptance oracle for MIT-MV-65, 66, 67. Numeric answers are recomputed from the plan's definitions by quadrature,
 * finite differences, linear algebra and numerical optimisation, never from a generator closed form. Written against
 * docs/mit-mv-drafts/approved-65-67.md before the generators were read.
 */
vi.setConfig({ testTimeout: 300000 });
const SEEDS = 60;
const PI = Math.PI;
type Lang = GameLanguage;
const LANGS: Lang[] = ['en', 'zh'];
const generators: Record<number, CardGenerator> = { 65: mv65, 66: mv66, 67: mv67 };

const cache = new Map<string, PracticeCard[]>();
function deck(game: number, index: number, lang: Lang): PracticeCard[] {
  const key = `${game}/${index}/${lang}`;
  let cards = cache.get(key);
  if (!cards) { cards = generators[game](spreadSeed(index), lang); cache.set(key, cards); }
  return cards;
}
const getCard = (game: number, index: number, lang: Lang, slug: string): PracticeCard => {
  const found = deck(game, index, lang).find(card => card.id === `MIT-MV-${game}-${slug}`);
  if (!found) throw new Error(`MIT-MV-${game}-${slug} missing`);
  return found;
};

class Fails {
  list: string[] = [];
  ok(cond: unknown, msg: string) { if (!cond) this.list.push(msg); }
  done() {
    const dump = process.env.ORACLE_DUMP;
    if (dump && this.list.length) appendFileSync(dump, ['### ' + expect.getState().currentTestName, ...this.list, ''].join(String.fromCharCode(10)));
    expect(this.list.slice(0, 12), `${this.list.length} failures`).toEqual([]);
  }
}
function everySeed(fn: (index: number, lang: Lang, f: Fails) => void) {
  const f = new Fails();
  for (let index = 0; index < SEEDS; index++) for (const lang of LANGS) {
    try { fn(index, lang, f); } catch (error) { f.list.push(`seed ${index} ${lang}: threw ${(error as Error).message}`); }
  }
  f.done();
}

// ---------- text normalisation and numerics ----------
const clean = (text: string) => text.replaceAll('−', '-').replaceAll('·', '*').replaceAll(' ', ' ').replaceAll(' ', ' ');
/** Normalise full-width punctuation so one regex parses EN and ZH. */
const norm = (text: string) => clean(text).replaceAll('，', ',').replaceAll('（', '(').replaceAll('）', ')').replaceAll('。', '.').replaceAll('、', ',').replaceAll('：', ':').replace(/\s+/g, ' ');
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const ptNear = (p: Pt, q: Pt, tol = 1e-9) => near(p[0], q[0], tol) && near(p[1], q[1], tol);
const rx = (text: string, pattern: RegExp, label: string): RegExpMatchArray => { const m = norm(text).match(pattern); if (!m) throw new Error(`cannot parse ${label} in "${text.slice(0, 90)}"`); return m; };
const has = (text: string, ...needles: string[]) => needles.every(n => norm(text).includes(norm(n)));
const cf = (s: string | undefined): number => s === undefined || s.replace(/\s/g, '') === '' || s === '+' ? 1 : s === '-' ? -1 : Number(s);
function det3(r1: number[], r2: number[], r3: number[]): number {
  const [a, b, c] = r1, [d, e, f] = r2, [g, h, i] = r3;
  return a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
}
/** Exact accepted string in the grammar of `parseGameNumber`: integer, fraction, k*sqrt(m)[/d] or k*pi[/d]. */
function acceptedString(v: number): string {
  if (!Number.isFinite(v)) throw new Error('non-finite answer');
  for (let d = 1; d <= 24; d++) { const n = Math.round(v * d); if (Math.abs(v - n / d) < 1e-9 * Math.max(1, Math.abs(v))) return d === 1 ? `${n}` : `${n}/${d}`; }
  for (let d = 1; d <= 24; d++) { const k = Math.round(v * d / PI); if (k !== 0 && Math.abs(v - k * PI / d) < 1e-9 * Math.max(1, Math.abs(v))) return `${k === 1 ? '' : k === -1 ? '-' : k}π${d === 1 ? '' : `/${d}`}`; }
  for (const m of [2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15]) { const s = Math.sqrt(m); for (let d = 1; d <= 24; d++) { const k = Math.round(v * d / s); if (k !== 0 && Math.abs(v - k * s / d) < 1e-9 * Math.max(1, Math.abs(v))) return `${k === 1 ? '' : k === -1 ? '-' : k}√${m}${d === 1 ? '' : `/${d}`}`; } }
  throw new Error(`no accepted string for ${v}`);
}
const numLike = (x: number) => { const r = Number(x.toFixed(6)); return r < 0 ? `${'-'}${-r}` : String(r === 0 ? 0 : r); };
/** True when the explanation prints the value v in some acceptable form (integer, fraction, k√m or kπ/d). */
function mentionsValue(explanation: string, v: number): boolean {
  const text = norm(explanation);
  const cand = new Set<string>();
  const add = (s: string) => { cand.add(s); cand.add(s.replaceAll('-', '−')); };
  if (Number.isInteger(v)) add(String(v));
  for (let d = 1; d <= 24; d++) { const n = Math.round(v * d); if (Math.abs(v - n / d) < 1e-9 * Math.max(1, Math.abs(v))) { add(d === 1 ? `${n}` : `${n}/${d}`); break; } }
  const k = v / PI;
  for (let d = 1; d <= 24; d++) { const n = Math.round(k * d); if (n !== 0 && Math.abs(k - n / d) < 1e-9 * Math.max(1, Math.abs(k))) { if (d === 1) add(`${n === 1 ? '' : n}π`); else { add(`${n === 1 ? '' : n}π/${d}`); add(`${numLike(n / d)}π`); } break; } }
  for (const m of [2, 3, 5, 6, 7, 8, 10, 12, 13, 14, 15]) { const s = Math.sqrt(m); for (let d = 1; d <= 24; d++) { const n = Math.round(v * d / s); if (n !== 0 && Math.abs(v - n * s / d) < 1e-9 * Math.max(1, Math.abs(v))) { add(d === 1 ? `${n === 1 ? '' : n}√${m}` : `${n === 1 ? '' : n}√${m}/${d}`); add(`${numLike(n / d)}√${m}`); break; } } }
  for (const c of cand) if (text.includes(norm(c))) return true;
  return false;
}
// expression evaluator for slot tokens (`2√3 θ`, `r³`, `ρcos²φsinφ`, `√y`, `2π`)
function ev(source: string, env: Record<string, number> = {}): number {
  const text = clean(source);
  const tokens = text.match(/\d+(?:\.\d+)?|sin|cos|tan|sec|csc|[A-Za-zρφθπ]|[√²³⁴]|[-+*/()]/g) ?? [];
  if (tokens.join('') !== text.replace(/\s/g, '')) throw new Error(`cannot tokenise "${source}"`);
  let p = 0;
  const FN = ['sin', 'cos', 'tan', 'sec', 'csc'];
  const startsAtom = (t?: string) => t !== undefined && (/^\d/.test(t) || t === '(' || t === '√' || FN.includes(t) || /^[A-Za-zρφθπ]$/.test(t));
  const atom = (): number => {
    const t = tokens[p++];
    if (t === undefined) throw new Error(`unexpected end in "${source}"`);
    if (t === '(') { const v = sum(); if (tokens[p++] !== ')') throw new Error(`missing ) in "${source}"`); return v; }
    if (t === '√') return Math.sqrt(atom());
    if (FN.includes(t)) { let e = 1; if (tokens[p] === '²' || tokens[p] === '³' || tokens[p] === '⁴') { const sup = tokens[p++]; e = sup === '²' ? 2 : sup === '³' ? 3 : 4; } const arg = atom(); const base = t === 'sin' ? Math.sin(arg) : t === 'cos' ? Math.cos(arg) : t === 'tan' ? Math.tan(arg) : t === 'sec' ? 1 / Math.cos(arg) : 1 / Math.sin(arg); return base ** e; }
    if (t === 'π') return PI;
    if (/^\d/.test(t)) return Number(t);
    if (env[t] === undefined) throw new Error(`unbound ${t} in "${source}"`);
    return env[t];
  };
  const power = (): number => { let v = atom(); while (tokens[p] === '²' || tokens[p] === '³' || tokens[p] === '⁴') v **= tokens[p++] === '²' ? 2 : tokens[p - 1] === '³' ? 3 : 4; return v; };
  const unary = (): number => { if (tokens[p] === '-') { p++; return -unary(); } if (tokens[p] === '+') { p++; return unary(); } return power(); };
  const term = (): number => { let v = unary(); for (;;) { const t = tokens[p]; if (t === '*') { p++; v *= unary(); } else if (t === '/') { p++; v /= unary(); } else if (startsAtom(t)) v *= unary(); else break; } return v; };
  const sum = (): number => { let v = term(); while (tokens[p] === '+' || tokens[p] === '-') { const op = tokens[p++]; const n = term(); v += op === '+' ? n : -n; } return v; };
  const result = sum();
  if (p !== tokens.length) throw new Error(`trailing tokens in "${source}"`);
  return result;
}
const evOrNaN = (source: string, env: Record<string, number> = {}): number => { try { return ev(source, env); } catch { return NaN; } };
const fd = (f: (x: number, y: number, z: number) => number, p: [number, number, number], axis: 0 | 1 | 2, h = 1e-5): number => {
  const a = [...p] as [number, number, number]; const b = [...p] as [number, number, number];
  a[axis] += h; b[axis] -= h;
  return (f(a[0], a[1], a[2]) - f(b[0], b[1], b[2])) / (2 * h);
};
type V3 = (x: number, y: number, z: number) => [number, number, number];
/** Minimise x² + y² + z² on the plane ax + by + cz = d by Newton on the two free variables (quadratic, so exact). */
function planeMin(a: number, b: number, c: number, d: number): [number, number, number] {
  const coef = [a, b, c];
  let k = 0; for (let i = 1; i < 3; i++) if (Math.abs(coef[i]) > Math.abs(coef[k])) k = i;
  const o = [0, 1, 2].filter(i => i !== k);
  const P = (v: number[]): [number, number, number] => { const p = [0, 0, 0]; p[o[0]] = v[0]; p[o[1]] = v[1]; p[k] = (d - coef[o[0]] * v[0] - coef[o[1]] * v[1]) / coef[k]; return p as [number, number, number]; };
  const F = (v: number[]) => { const p = P(v); return p[0] ** 2 + p[1] ** 2 + p[2] ** 2; };
  let v = [0, 0];
  for (let step = 0; step < 60; step++) {
    const h = 1e-6; const g = [0, 0];
    for (let i = 0; i < 2; i++) { const vp = [...v], vm = [...v]; vp[i] += h; vm[i] -= h; g[i] = (F(vp) - F(vm)) / (2 * h); }
    const H = [[0, 0], [0, 0]];
    for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) { const vpp = [...v], vpm = [...v], vmp = [...v], vmm = [...v]; vpp[i] += h; vpp[j] += h; vpm[i] += h; vpm[j] -= h; vmp[i] -= h; vmp[j] += h; vmm[i] -= h; vmm[j] -= h; H[i][j] = (F(vpp) - F(vpm) - F(vmp) + F(vmm)) / (4 * h * h); }
    const det = H[0][0] * H[1][1] - H[0][1] * H[1][0];
    const dx = [(-g[0] * H[1][1] + g[1] * H[0][1]) / det, (-g[1] * H[0][0] + g[0] * H[1][0]) / det];
    v = [v[0] + dx[0], v[1] + dx[1]];
    if (Math.hypot(dx[0], dx[1]) < 1e-12) break;
  }
  return P(v);
}
/** Inverse of a 3x3 matrix by Gauss-Jordan on [A | I] (independent of the cofactor formula). */
function inv3(A: number[][]): number[][] {
  const M = A.map((row, i) => [...row, i === 0 ? 1 : 0, i === 1 ? 1 : 0, i === 2 ? 1 : 0]);
  for (let col = 0; col < 3; col++) {
    let piv = col; for (let r = col + 1; r < 3; r++) if (Math.abs(M[r][col]) > Math.abs(M[piv][col])) piv = r;
    [M[col], M[piv]] = [M[piv], M[col]];
    const p = M[col][col]; for (let j = 0; j < 6; j++) M[col][j] /= p;
    for (let r = 0; r < 3; r++) if (r !== col) { const f = M[r][col]; for (let j = 0; j < 6; j++) M[r][j] -= f * M[col][j]; }
  }
  return M.map(row => row.slice(3));
}
const pythagorean = (a: number, c: number) => Math.sqrt(a * a + c * c);

// ---------- generic card checks ----------
const CJK = /[㐀-鿿]/;
const EN_WORD = /\b(and|or|the|with|for|is|are|if|then|where|of|to|because|over|from|area|none|all)\b/;
function textsOf(card: PracticeCard): string[] {
  const figs = [card.figure, ...(card.choice?.figures ?? [])].filter((x): x is Figure => !!x);
  return [card.title, card.prompt, card.hint, card.explanation, ...(card.lines ?? []), ...(card.fields?.map(x => x.label) ?? []),
    ...(card.choice?.options ?? []), ...(card.slots ? [card.slots.before, ...(card.slots.between ?? []), card.slots.after ?? '', ...card.slots.tokens] : []),
    ...figs.flatMap(fig => [fig.alt, fig.caption ?? '', ...fig.shapes.map(s => s.kind === 'text' ? s.text : 'label' in s ? s.label ?? '' : '')])];
}
function languageProblems(card: PracticeCard, lang: Lang): string[] {
  const bad: string[] = [];
  for (const text of textsOf(card)) {
    if (lang === 'en' && CJK.test(text)) bad.push(`CJK in EN: ${text.slice(0, 50)}`);
    if (lang === 'zh' && EN_WORD.test(norm(text))) bad.push(`English word in ZH: ${text.slice(0, 60)}`);
    if (/\$\{|undefined|NaN|\[object|Infinity/.test(text)) bad.push(`template/undefined leftover: ${text.slice(0, 60)}`);
  }
  return bad;
}
function gradeNumeric(card: PracticeCard, expected: number[], tol: number, where: string, f: Fails) {
  f.ok(card.fields?.length === expected.length, `${where}: field count ${card.fields?.length} vs ${expected.length}`);
  if (!card.fields) return;
  expected.forEach((v, i) => { const got = card.fields![i].answer; f.ok(Math.abs(got - v) <= Math.max(tol * Math.max(1, Math.abs(v)), 1e-9), `${where} field ${i} (${card.fields![i].label}): oracle ${v}, card ${got}`); });
  let accepted: string[];
  try { accepted = expected.map(acceptedString); } catch (error) { f.list.push(`${where}: ${(error as Error).message}`); return; }
  f.ok(gradeCard(card, accepted, null, []) === 'correct', `${where}: accepted ${JSON.stringify(accepted)} does not grade correct`);
  expected.forEach((v, i) => { const bad = accepted.slice(); bad[i] = String(v * 1.013 + 0.017); f.ok(gradeCard(card, bad, null, []) === 'incorrect', `${where}: perturbed field ${i} grades correct`); });
}
function auditIs(card: PracticeCard, kind: string, params: Record<string, number | number[]>, where: string, f: Fails) {
  f.ok(card.audit?.kind === kind, `${where}: audit kind ${card.audit?.kind} vs ${kind}`);
  if (!card.audit) return;
  const keys = Object.keys(params);
  f.ok(Object.keys(card.audit.params).length === keys.length, `${where}: audit params ${JSON.stringify(card.audit.params)} vs ${JSON.stringify(params)}`);
  for (const key of keys) {
    const got = card.audit.params[key], want = params[key];
    if (Array.isArray(want)) f.ok(JSON.stringify(got) === JSON.stringify(want), `${where}: audit ${key} ${JSON.stringify(got)} vs ${JSON.stringify(want)}`);
    else f.ok(got === want, `${where}: audit ${key} = ${got}, printed ${want}`);
  }
}
function bothLanguagesAgree(game: number, index: number, slug: string, f: Fails) {
  const en = getCard(game, index, 'en', slug), zh = getCard(game, index, 'zh', slug);
  f.ok(JSON.stringify(en.audit) === JSON.stringify(zh.audit), `seed ${index} ${slug}: EN/ZH audit differ`);
  f.ok(JSON.stringify(en.fields?.map(x => x.answer)) === JSON.stringify(zh.fields?.map(x => x.answer)), `seed ${index} ${slug}: EN/ZH answers differ`);
  f.ok(en.choice?.answer === zh.choice?.answer, `seed ${index} ${slug}: EN/ZH choice answer differs`);
  f.ok(JSON.stringify(en.slots?.answers) === JSON.stringify(zh.slots?.answers), `seed ${index} ${slug}: EN/ZH slot answers differ`);
  f.ok((en.figure?.shapes.length ?? 0) === (zh.figure?.shapes.length ?? 0), `seed ${index} ${slug}: EN/ZH shape counts differ`);
  f.ok(JSON.stringify(en.figure?.view) === JSON.stringify(zh.figure?.view), `seed ${index} ${slug}: EN/ZH figure views differ`);
}
const labelAnchor = (s: FigureShape): Pt | undefined => s.kind === 'text' ? s.at : s.kind === 'point' ? (s.label ? s.at : undefined) : s.kind === 'arrow' ? (s.label ? s.to : undefined) : s.label ? (s.labelAt ?? s.points[0]) : undefined;
function checkFigureGeneric(card: PracticeCard, where: string, f: Fails, lang: Lang) {
  const fig = card.figure;
  if (!fig) return;
  f.ok(figureProblems(fig).length === 0, `${where}: figureProblems ${figureProblems(fig).join(';')}`);
  const { xmin, xmax, ymin, ymax } = fig.view;
  const inside = (p: Pt) => p[0] >= xmin - 1e-9 && p[0] <= xmax + 1e-9 && p[1] >= ymin - 1e-9 && p[1] <= ymax + 1e-9;
  fig.shapes.forEach((s, i) => {
    const pts: Pt[] = s.kind === 'line' || s.kind === 'area' ? s.points : s.kind === 'arrow' ? [s.from, s.to] : [s.at];
    f.ok(pts.every(inside), `${where}: shape ${i} (${s.kind}) outside the view`);
  });
  const anchors = fig.shapes.map(labelAnchor).filter((p): p is Pt => !!p);
  for (let i = 0; i < anchors.length; i++) for (let j = i + 1; j < anchors.length; j++)
    f.ok(Math.hypot(anchors[i][0] - anchors[j][0], anchors[i][1] - anchors[j][1]) > 1e-6, `${where}: two labels at the same point ${anchors[i]}`);
  if (lang === 'zh') for (const s of fig.shapes) {
    const label = s.kind === 'text' ? s.text : 'label' in s ? s.label ?? '' : '';
    f.ok(!/[A-Za-z]{3,}/.test(label), `${where}: English label "${label}" on a ZH card`);
  }
}
const lineShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'line' }> => s.kind === 'line');
const pointShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'point' }> => s.kind === 'point');
const arrowShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'arrow' }> => s.kind === 'arrow');
const textShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'text' }> => s.kind === 'text');
const hasPoint = (fig: Figure, p: Pt, tol = 1e-9) => pointShapes(fig).some(s => ptNear(s.at, p, tol));
const hasArrow = (fig: Figure, from: Pt, to: Pt, tol = 1e-9, label?: string) => arrowShapes(fig).some(s => ptNear(s.from, from, tol) && ptNear(s.to, to, tol) && (label === undefined || s.label === label));
const proj = (x: number, y: number, z: number) => (({ x, y, z }) => [y - 0.45 * x, z - 0.3 * x] as Pt)({ x, y, z });
const proj3 = (p: number[]): Pt => proj(p[0], p[1], p[2]);
type P3 = [number, number, number];
/** The figure has a line of 2+ points matching the projected polyline fn(t) over [t0, t1] at the same sample fraction. */
function hasPolyline(fig: Figure, fn: (t: number) => P3, t0: number, t1: number, tol = 1e-9, tone?: string, width?: number) {
  return lineShapes(fig).some(l => (tone === undefined || l.tone === tone) && (width === undefined || (l.width ?? 1) === width) && l.points.length >= 2 &&
    l.points.every((pt, i) => ptNear(pt, proj(...fn(t0 + (t1 - t0) * i / (l.points.length - 1))), tol)));
}
function axesProblems(fig: Figure, length: number): string[] {
  const bad: string[] = [];
  if (!hasArrow(fig, proj(0, 0, 0), proj(length, 0, 0), 1e-9, 'x')) bad.push('x axis');
  if (!hasArrow(fig, proj(0, 0, 0), proj(0, length, 0), 1e-9, 'y')) bad.push('y axis');
  if (!hasArrow(fig, proj(0, 0, 0), proj(0, 0, length), 1e-9, 'z')) bad.push('z axis');
  return bad;
}
/** Symbol-card structure, answers grade correct, a single wrong slot grades incorrect. */
function symbolShape(card: PracticeCard, n: number, where: string, f: Fails) {
  const slots = card.slots;
  f.ok(!!slots, `${where}: not a symbol card`);
  if (!slots) return;
  f.ok(slots.answers.length === n, `${where}: ${slots.answers.length} answers vs ${n}`);
  f.ok(slots.between === undefined || slots.between.length === Math.max(0, slots.answers.length - 1), `${where}: between.length ${slots.between?.length}`);
  slots.answers.forEach(a => f.ok(slots.tokens.includes(a), `${where}: answer "${a}" not in tokens`));
  f.ok(new Set(slots.tokens).size === slots.tokens.length, `${where}: duplicate tokens ${JSON.stringify(slots.tokens)}`);
  f.ok(gradeCard(card, [], null, slots.answers) === 'correct', `${where}: answers do not grade correct`);
  slots.answers.forEach((_, i) => { const other = slots.tokens.find(t => t !== slots.answers[i]); if (other === undefined) return; const bad = slots.answers.slice(); bad[i] = other; f.ok(gradeCard(card, [], null, bad) === 'incorrect', `${where}: wrong slot ${i} not graded incorrect`); });
}
function distinctCount(game: number, slug: string, key: (card: PracticeCard) => string): number {
  const set = new Set<string>();
  for (let index = 0; index < SEEDS; index++) set.add(key(getCard(game, index, 'en', slug)));
  return set.size;
}
const fullKey = (card: PracticeCard) => JSON.stringify([card.prompt, [...(card.choice?.options ?? [])].sort(), card.slots, card.figure?.shapes]);
function answerPositions(game: number, slug: string): Set<number> {
  const set = new Set<number>();
  for (let index = 0; index < SEEDS; index++) set.add(getCard(game, index, 'en', slug).choice!.answer);
  return set;
}
const numbersIn = (text: string): number[] => (norm(text).match(/\d+(?:\.\d+)?/g) ?? []).map(Number);
const PHI = /from the positive z-axis|从正 ?z ?轴量起|φ 是从正 z 轴/;
function phiProblems(card: PracticeCard, lang: Lang): string[] {
  const texts = [card.prompt, card.hint, card.explanation, ...(card.choice?.options ?? [])];
  if (!texts.some(t => t.includes('φ'))) return [];
  void lang;
  return texts.some(t => PHI.test(t)) ? [] : ['φ appears but the positive-z-axis rule does not'];
}
const END: Record<number, { en: string; zh: string }> = {
  65: { en: 'This game reviews only Unit 1: vectors, planes, matrices and parametric curves. It does not assess derivatives of functions of several variables, integrals or vector fields.', zh: '本游戏只复习第一单元：向量、平面、矩阵和参数曲线。不涉及多元函数的导数、积分和向量场。' },
  66: { en: 'This game reviews only Unit 2: gradients, tangent planes, Lagrange multipliers and constrained differentials. It does not assess the second derivative test, least squares or integrals.', zh: '本游戏只复习第二单元：梯度、切平面、拉格朗日乘数法和受约束的微分。不涉及二阶导数检验、最小二乘和积分。' },
  67: { en: 'This game reviews only Unit 3: double integrals, Jacobian, triple integrals and applications. It does not assess Green, line integrals, divergence or Stokes.', zh: '本游戏只复习第三单元：二重积分、雅可比因子、三重积分及其应用。不涉及格林公式、线积分、散度与斯托克斯。' },
};

function shapeTests(game: number, ids: string[], kinds: string[]) {
  it('deck shape, audit kinds, language, figures, φ rule and end sentence', () => everySeed((index, lang, f) => {
    const cards = deck(game, index, lang);
    const got = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
    f.ok(JSON.stringify(got) === JSON.stringify(kinds), `seed ${index} ${lang}: kinds ${JSON.stringify(got)}`);
    f.ok(cards.every(c => !c.fields || c.audit), `seed ${index}: unaudited numeric card`);
    f.ok(JSON.stringify(cards.map(c => c.id)) === JSON.stringify(ids.map(s => `MIT-MV-${game}-${s}`)), `seed ${index}: order ${cards.map(c => c.id)}`);
    cards.forEach(c => {
      for (const p of languageProblems(c, lang)) f.list.push(`seed ${index} ${lang} ${c.id}: ${p}`);
      for (const p of phiProblems(c, lang)) f.list.push(`seed ${index} ${lang} ${c.id}: ${p}`);
      checkFigureGeneric(c, `seed ${index} ${lang} ${c.id}`, f, lang);
      f.ok(!c.choice || c.choice.options.length >= 3, `seed ${index} ${c.id}: fewer than 3 options`);
    });
    for (const c of cards) bothLanguagesAgree(game, index, c.id.slice(`MIT-MV-${game}-`.length), f);
    for (const c of cards) {
      const where = `seed ${index} ${lang} ${c.id}`;
      if (c.fields) for (const field of c.fields) f.ok(mentionsValue(c.explanation, field.answer), `${where}: the explanation never states the answer ${field.answer}`);
    }
    const last = cards[cards.length - 1];
    f.ok(last.explanation.trimEnd().endsWith(END[game][lang]), `seed ${index} ${lang}: challenge explanation must end with the does-not-assess sentence`);
  }));
}

// ---------- shared expression parsing ----------
/** Coefficients (a, b, c, d) of a printed plane `ax + by + cz = d` in x, y, z order. */
function planeOf(text: string): { a: number; b: number; c: number; d: number } {
  const m = rx(text, /([+-]?)\s*(\d*)\s*([xyz])\s*([+-])\s*(\d*)\s*([xyz])\s*([+-])\s*(\d*)\s*([xyz])\s*=\s*(-?\d+)/, 'plane');
  const co = (sign: string, digits: string) => (sign === '-' ? -1 : 1) * cf(digits);
  return { a: co(m[1], m[2]), b: co(m[4], m[5]), c: co(m[7], m[8]), d: Number(m[10]) };
}
/** Coefficient of `cos t` / `sin t` (a bare term means 1, `-` means -1). */
const tc = (s: string) => { const t = s.replace(/\s/g, ''); return t === '' ? 1 : t === '-' ? -1 : Number(t); };

// ======================================================================================================
// MIT-MV-65 — Final Review: Unit 1
// ======================================================================================================
const IDS_65 = ['normal', 'plane-d', 'singular', 'inv-entry', 'tape-vector', 'tape-curve', 'speed', 'yz-point', 'challenge'];
const KINDS_65 = ['MIT-MV-65:challenge', 'MIT-MV-65:inv-entry', 'MIT-MV-65:normal', 'MIT-MV-65:plane-d', 'MIT-MV-65:tape-vector', 'MIT-MV-65:yz-point'];
const f65 = (card: PracticeCard): [number, number, number] => { const m = norm(card.prompt).match(/\((-?\d+), (-?\d+), (-?\d+)\)/); if (!m) throw new Error('vector'); return [Number(m[1]), Number(m[2]), Number(m[3])]; };

describe('MIT-MV-65 oracle', () => {
  shapeTests(65, IDS_65, KINDS_65);

  it('normal: cross product by the determinant route, orthogonal to both sides; figure triangle and axes', () => everySeed((index, lang, f) => {
    const card = getCard(65, index, lang, 'normal');
    const t = norm(card.prompt);
    const P = f65(card);
    const Q = [Number(t.match(/Q = \((-?\d+), (-?\d+), (-?\d+)\)/)![1]), Number(t.match(/Q = \((-?\d+), (-?\d+), (-?\d+)\)/)![2]), Number(t.match(/Q = \((-?\d+), (-?\d+), (-?\d+)\)/)![3])];
    const R = [Number(t.match(/R = \((-?\d+), (-?\d+), (-?\d+)\)/)![1]), Number(t.match(/R = \((-?\d+), (-?\d+), (-?\d+)\)/)![2]), Number(t.match(/R = \((-?\d+), (-?\d+), (-?\d+)\)/)![3])];
    const u = [Q[0] - P[0], Q[1] - P[1], Q[2] - P[2]], w = [R[0] - P[0], R[1] - P[1], R[2] - P[2]];
    const N = [det3([1, 0, 0], u, w), det3([0, 1, 0], u, w), det3([0, 0, 1], u, w)];
    f.ok(N.some(v => v !== 0), `seed ${index}: degenerate cross product`);
    f.ok(N[0] * u[0] + N[1] * u[1] + N[2] * u[2] === 0 && N[0] * w[0] + N[1] * w[1] + N[2] * w[2] === 0, `seed ${index}: N not orthogonal to u,w`);
    auditIs(card, 'MIT-MV-65:normal', { p: [P[0], P[1], P[2]], q: [Q[0], Q[1], Q[2]], r: [R[0], R[1], R[2]] }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, N, 1e-9, `seed ${index} ${lang} normal`, f);
    const fig = card.figure!;
    f.ok(!!fig, `seed ${index}: figure missing`);
    f.ok(axesProblems(fig, 4).length === 0, `seed ${index}: axes3d(4) ${axesProblems(fig, 4)}`);
    const tri: P3[] = [[P[0], P[1], P[2]], [Q[0], Q[1], Q[2]], [R[0], R[1], R[2]], [P[0], P[1], P[2]]];
    f.ok(lineShapes(fig).some(l => l.tone === 'accent' && (l.width ?? 1) === 2 && l.points.length === 4 && l.points.every((pt, i) => ptNear(pt, proj3(tri[i]), 1e-9))), `seed ${index}: triangle line3d(P,Q,R,P) missing`);
    f.ok(pointShapes(fig).length === 3 && hasPoint(fig, proj3([P[0], P[1], P[2]])) && hasPoint(fig, proj3([Q[0], Q[1], Q[2]])) && hasPoint(fig, proj3([R[0], R[1], R[2]])), `seed ${index}: points P,Q,R missing`);
    f.ok(!arrowShapes(fig).some(s => s.label === 'n'), `seed ${index}: normal vector drawn`);
  }));

  it('plane-d: d = n·X for two independent points X of the plane; audit params', () => everySeed((index, lang, f) => {
    const card = getCard(65, index, lang, 'plane-d');
    const all = [...norm(card.prompt).matchAll(/\((-?\d+), (-?\d+), (-?\d+)\)/g)];
    f.ok(all.length >= 2, `seed ${index}: fewer than two printed vectors`);
    const N = [Number(all[0][1]), Number(all[0][2]), Number(all[0][3])];
    const P = [Number(all[1][1]), Number(all[1][2]), Number(all[1][3])];
    f.ok(N.every(v => Math.abs(v) >= 1 && Math.abs(v) <= 4), `seed ${index}: normal ${N} outside plan`);
    f.ok(P.every(v => Math.abs(v) <= 4), `seed ${index}: point ${P} outside plan`);
    const cross = (p: number[], q: number[]): number[] => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
    const X1 = [0, 1, 2].map(k => P[k] + cross(N, [1, 2, 3])[k]);
    const X2 = [0, 1, 2].map(k => P[k] + cross(N, [3, -1, 2])[k]);
    const d1 = N[0] * X1[0] + N[1] * X1[1] + N[2] * X1[2];
    const d2 = N[0] * X2[0] + N[1] * X2[1] + N[2] * X2[2];
    f.ok(near(d1, d2, 1e-9), `seed ${index}: the two plane points disagree ${d1} vs ${d2}`);
    f.ok(d1 !== 0, `seed ${index}: the answer is zero`);
    auditIs(card, 'MIT-MV-65:plane-d', { n: N, p: P }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [d1], 1e-9, `seed ${index} ${lang} plane-d`, f);
    f.ok(!card.figure, `seed ${index}: plane-d must have no figure`);
  }));

  it('singular: exactly one statement is true, decided by det A = 1 − c² and the rank', () => everySeed((index, lang, f) => {
    const card = getCard(65, index, lang, 'singular');
    const c = Number(rx(card.prompt, /\(2, (-?\d+), 1\)/, 'c')[1]);
    f.ok([-4, -3, -2, -1, 1, 2, 3, 4].includes(c), `seed ${index}: c ${c} outside plan`);
    const A = [[1, 0, c], [2, c, 1], [1, -1, 2]];
    const det = det3(A[0], A[1], A[2]);
    f.ok(near(det, 1 - c * c, 1e-9), `seed ${index}: det ${det} vs 1−c²`);
    const singular = Math.abs(det) < 1e-9;
    const truth = (o: string): boolean => {
      const x = norm(o);
      if (lang === 'en') {
        if (/Only x = \(0, 0, 0\) is a solution/.test(x)) return !singular;
        if (/infinitely many solutions/.test(x)) return singular;
        if (/exactly one non-zero solution/.test(x)) return false;
        if (/no solution at all/.test(x)) return false;
      } else {
        if (/^只有 x = \(0, 0, 0\) 是解/.test(x)) return !singular;
        if (/有无穷多个解/.test(x)) return singular;
        if (/恰好有一个非零解/.test(x)) return false;
        if (/根本没有解/.test(x)) return false;
      }
      return false;
    };
    const verdict = card.choice!.options.map(truth);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: options ${card.choice!.options.length}`);
  }));

  it('inv-entry: entry (i,j) of A⁻¹ by Gauss-Jordan, equals cofactor/det', () => everySeed((index, lang, f) => {
    const card = getCard(65, index, lang, 'inv-entry');
    const c = Number(rx(card.prompt, /\(2, (-?\d+), 1\)/, 'c')[1]);
    const ij = norm(card.prompt).match(/row (\d+), column (\d+)/) ?? norm(card.prompt).match(/第 (\d+) 行第 (\d+) 列/);
    if (!ij) throw new Error('cannot parse i,j');
    const ii = Number(ij[1]), jj = Number(ij[2]);
    f.ok([-4, -3, -2, 2, 3, 4].includes(c), `seed ${index}: c ${c} outside plan`);
    f.ok([[3, 2], [2, 1], [3, 3], [2, 3]].some(([a, b]) => a === ii && b === jj), `seed ${index}: position (${ii},${jj}) outside plan`);
    const A = [[1, 0, c], [2, c, 1], [1, -1, 2]];
    const entry = inv3(A)[ii - 1][jj - 1];
    auditIs(card, 'MIT-MV-65:inv-entry', { c, i: ii, j: jj }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [entry], 1e-6, `seed ${index} ${lang} inv-entry`, f);
  }));

  it('tape-vector: QP = aθ(cos α, sin α) by the rotation matrix', () => everySeed((index, lang, f) => {
    const card = getCard(65, index, lang, 'tape-vector');
    const t = norm(card.prompt);
    const a = Number(rx(card.prompt, /(?:radius|半径(?:为)?) a = (\d+)/, 'a')[1]);
    const th = Number(rx(card.prompt, /θ = (\d+) (?:radians|弧度)/, 'θ')[1]);
    const alpha = Number(rx(card.prompt, /(\d+)°/, 'α')[1]);
    f.ok([2, 3, 4, 5, 6].includes(a) && [1, 2, 3, 4].includes(th) && [30, 45, 60].includes(alpha), `seed ${index}: a,θ,α ${a},${th},${alpha} outside plan`);
    const r = alpha * PI / 180, len = a * th;
    const x = Math.cos(r) * len, y = Math.sin(r) * len;
    f.ok(t.includes(`${alpha}°`), `seed ${index}: angle not printed as {α}°`);
    auditIs(card, 'MIT-MV-65:tape-vector', { a, th, alpha }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [x, y], 1e-9, `seed ${index} ${lang} tape-vector`, f);
    f.ok(!card.figure, `seed ${index}: tape-vector must have no figure`);
  }));

  it('tape-curve: slot answers evaluate to a cos α·θ and a sin α·θ; tokens and figure', () => everySeed((index, lang, f) => {
    const card = getCard(65, index, lang, 'tape-curve');
    const a = Number(rx(card.prompt, /(?:radius|半径(?:为)?) a = (\d+)/, 'a')[1]);
    const alpha = Number(rx(card.prompt, /(\d+)°/, 'α')[1]);
    f.ok([2, 4, 6].includes(a) && [30, 45, 60].includes(alpha), `seed ${index}: a,α ${a},${alpha} outside plan`);
    symbolShape(card, 2, `seed ${index} ${lang} tape-curve`, f);
    const [T1, T2] = card.slots!.answers;
    const r = alpha * PI / 180;
    for (const th of [0.7, 2.3, 5.1]) {
      f.ok(near(evOrNaN(T1, { θ: th }), a * Math.cos(r) * th, 1e-9), `seed ${index}: slot 1 at θ=${th}: ${evOrNaN(T1, { θ: th })} vs ${a * Math.cos(r) * th}`);
      f.ok(near(evOrNaN(T2, { θ: th }), a * Math.sin(r) * th, 1e-9), `seed ${index}: slot 2 at θ=${th}: ${evOrNaN(T2, { θ: th })} vs ${a * Math.sin(r) * th}`);
    }
    f.ok(has(card.slots!.before, `x(θ) = ${a} cos θ +`), `seed ${index}: before "${card.slots!.before}"`);
    f.ok((card.slots!.between ?? []).length === 1 && has(card.slots!.between![0], 'y(θ) = '), `seed ${index}: between ${JSON.stringify(card.slots!.between)}`);
    f.ok(card.slots!.tokens.length >= 4, `seed ${index}: too few tokens`);
    const fig = card.figure!;
    f.ok(!!fig, `seed ${index}: figure missing`);
    const Q: Pt = [a * Math.cos(1), a * Math.sin(1)];
    const Pp: Pt = [Q[0] + a * Math.cos(r), Q[1] + a * Math.sin(r)];
    f.ok(lineShapes(fig).some(l => l.points.length >= 20 && l.points.every(pt => Math.abs(Math.hypot(pt[0], pt[1]) - a) < 1e-9)), `seed ${index}: circle of radius ${a} missing`);
    f.ok(pointShapes(fig).some(s => s.label === 'O' && ptNear(s.at, [0, 0])) && pointShapes(fig).some(s => s.label === 'A' && ptNear(s.at, [a, 0])) && pointShapes(fig).some(s => s.label === 'Q' && ptNear(s.at, Q, 1e-9)) && pointShapes(fig).some(s => s.label === 'P' && ptNear(s.at, Pp, 1e-9)), `seed ${index}: points O/A/Q/P missing`);
    f.ok(lineShapes(fig).some(l => l.dash && l.tone === 'muted' && l.points.length === 2 && ptNear(l.points[0], [0, 0]) && ptNear(l.points[1], Q)), `seed ${index}: dashed OQ missing`);
    f.ok(hasArrow(fig, Q, Pp, 1e-9), `seed ${index}: arrow Q→P missing`);
    f.ok(textShapes(fig).some(s => s.text === 'θ') && textShapes(fig).some(s => s.text === `${alpha}°`), `seed ${index}: angle labels θ / ${alpha}° missing`);
    f.ok(['O', 'A', 'Q', 'P'].every(l => pointShapes(fig).some(s => s.label === l)), `seed ${index}: point labels O/A/Q/P missing`);
  }));

  it('speed: constant iff a² + c² = b² (central differences), exactly one option true', () => everySeed((index, lang, f) => {
    const card = getCard(65, index, lang, 'speed');
    const m = rx(card.prompt, /\(([^,()]*?)cos t,\s*([^,()]*?)sin t,\s*([^,()]*?)cos t\)/, 'a,b,c');
    const a = tc(m[1]), b = tc(m[2]), c = tc(m[3]);
    f.ok([a, c].every(v => v >= 2 && v <= 15) && b >= 2 && b <= 17, `seed ${index}: a,b,c ${a},${b},${c} outside plan`);
    const speed = (t: number) => Math.hypot(-a * Math.sin(t), b * Math.cos(t), -c * Math.sin(t));
    const constant = a * a + c * c === b * b;
    let maxSpread = 0; for (const t of [0.3, 1.1, 2.0, 2.7]) maxSpread = Math.max(maxSpread, Math.abs(speed(t) - speed(0)));
    f.ok(constant ? maxSpread < 1e-9 : maxSpread > 1e-3, `seed ${index}: speed spread ${maxSpread} but constant=${constant} (a,b,c=${a},${b},${c})`);
    if (constant) f.ok(near(speed(0), b, 1e-9), `seed ${index}: constant speed ${speed(0)} vs b=${b}`);
    const truth = (o: string): boolean => {
      const x = norm(o);
      const notConst = /not constant/.test(x) || /不是常数/.test(x);
      const cm = x.match(/constant and equals (-?\d+)/) || x.match(/速率为常数,等于 (-?\d+)/) || x.match(/速率为常数，等于 (-?\d+)/);
      if (notConst) return !constant;
      if (cm) return constant && Number(cm[1]) === b;
      return false;
    };
    const verdict = card.choice!.options.map(truth);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: options ${card.choice!.options.length}`);
  }));

  it('yz-point: first crossing of x = 0 at t = π/2 gives (0, b, d) (bisection)', () => everySeed((index, lang, f) => {
    const card = getCard(65, index, lang, 'yz-point');
    const zm = rx(card.prompt, /x = ([^,()]*?)cos t,\s*y = ([^,()]*?)sin t,\s*z = ([^,()]*?)cos t ([+-]) ([^,()]*?)sin t/, 'curve');
    const a = tc(zm[1]), b = tc(zm[2]);
    const c = tc(zm[3]), d = (zm[4] === '-' ? -1 : 1) * tc(zm[5]);
    f.ok(a >= 1 && a <= 5 && [b, c, d].every(v => Math.abs(v) >= 1 && Math.abs(v) <= 5), `seed ${index}: a,b,c,d ${a},${b},${c},${d} outside plan`);
    // first t > 0 with a cos t = 0, by bisection on sign changes scanned on a coarse grid
    let t0 = NaN;
    for (let k = 0; k < 64; k++) { const l = PI * k / 32, r = PI * (k + 1) / 32; if (a * Math.cos(l) * a * Math.cos(r) <= 0 && k > 0) { let lo = l, hi = r; for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (a * Math.cos(lo) * a * Math.cos(mid) <= 0) hi = mid; else lo = mid; } t0 = (lo + hi) / 2; break; } }
    f.ok(near(t0, PI / 2, 1e-6), `seed ${index}: crossing time ${t0} vs π/2`);
    const X = a * Math.cos(t0), Y = b * Math.sin(t0), Z = c * Math.cos(t0) + d * Math.sin(t0);
    f.ok(near(X, 0, 1e-6) && near(Y, b, 1e-6) && near(Z, d, 1e-6), `seed ${index}: point (${X}, ${Y}, ${Z}) vs (0, ${b}, ${d})`);
    auditIs(card, 'MIT-MV-65:yz-point', { a, b, c, d }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [0, b, d], 1e-6, `seed ${index} ${lang} yz-point`, f);
  }));

  it('challenge: speed at the crossing = √(a² + c²) (central difference)', () => everySeed((index, lang, f) => {
    const card = getCard(65, index, lang, 'challenge');
    const m = rx(card.prompt, /\(([^,()]*?)cos t,\s*([^,()]*?)sin t,\s*([^,()]*?)cos t\)/, 'a,b,c');
    const a = tc(m[1]), b = tc(m[2]), c = tc(m[3]);
    f.ok(a >= 3 && c >= 3 && b >= 2 && b <= 9, `seed ${index}: a,b,c ${a},${b},${c} outside plan`);
    f.ok(a * a + c * c !== b * b, `seed ${index}: b is not a decoy`);
    const t0 = PI / 2, h = 1e-6;
    const r = (t: number) => [a * Math.cos(t), b * Math.sin(t), c * Math.cos(t)];
    const v = [0, 1, 2].map(k => (r(t0 + h)[k] - r(t0 - h)[k]) / (2 * h));
    const speed = Math.hypot(v[0], v[1], v[2]);
    f.ok(near(speed, pythagorean(a, c), 1e-5), `seed ${index}: numerical speed ${speed} vs ${pythagorean(a, c)}`);
    f.ok(Number.isInteger(pythagorean(a, c)), `seed ${index}: √(a²+c²) = ${pythagorean(a, c)} not an integer`);
    auditIs(card, 'MIT-MV-65:challenge', { a, b, c }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [pythagorean(a, c)], 1e-6, `seed ${index} ${lang} challenge`, f);
    f.ok(!card.figure, `seed ${index}: the challenge must have no figure`);
  }));

  it('variety and answer positions', () => {
    for (const slug of IDS_65) expect(distinctCount(65, slug, fullKey), slug).toBeGreaterThanOrEqual(6);
    for (const slug of ['singular', 'speed']) expect(answerPositions(65, slug).size, `${slug} answer positions`).toBeGreaterThanOrEqual(2);
  });
});

// ======================================================================================================
// MIT-MV-66 — Final Review: Unit 2
// ======================================================================================================
const IDS_66 = ['grad-dir', 'level-dir', 'tangent-plane', 'dihedral', 'lagrange-setup', 'lagrange-point', 'lagrange-check', 'constraint-setup', 'constraint-value', 'challenge'];
const KINDS_66 = ['MIT-MV-66:challenge', 'MIT-MV-66:constraint-value', 'MIT-MV-66:dihedral', 'MIT-MV-66:grad-dir', 'MIT-MV-66:lagrange-point', 'MIT-MV-66:tangent-plane'];
const varIndex: Record<string, number> = { x: 0, y: 1, z: 2 };
function gradVec(text: string, which: string): [number, number, number] {
  const m = rx(text, new RegExp(`∇${which} = \\(([^()]*)\\)`), `∇${which}`);
  const p = m[1].split(',').map(s => Number(s.trim().replace('−', '-')));
  if (p.length !== 3) throw new Error(`∇${which} not a triple`);
  return [p[0], p[1], p[2]];
}
function orderUVW(text: string): [string, string, string] {
  let m = norm(text).match(/Take ([xyz]) and ([xyz]) as the independent variables[;,]\s*(?:so )?([xyz]) depends/);
  if (!m) m = norm(text).match(/取 ([xyz]) 和 ([xyz]) 为独立变量[,]\s*([xyz]) 依赖于/);
  if (!m) throw new Error('cannot parse (u,v,w)');
  return [m[3], m[1], m[2]];
}

describe('MIT-MV-66 oracle', () => {
  shapeTests(66, IDS_66, KINDS_66);

  it('grad-dir: directional derivative by central difference; the m-aside is not printed for every m', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'grad-dir');
    const m = cf(rx(card.prompt, /x²y - (\d*)xy³/, 'm')[1]);
    const p = Number(rx(card.prompt, /P = \((-?\d+), (-?\d+)\)/, 'P')[1]);
    const q = Number(rx(card.prompt, /P = \((-?\d+), (-?\d+)\)/, 'P')[2]);
    const A = rx(card.prompt, /A = \((-?\d+), (-?\d+)\)/, 'A');
    const u = Number(A[1]), v = Number(A[2]);
    f.ok([1, 2].includes(m), `seed ${index}: m ${m}`);
    const omega = (x: number, y: number) => x * x * y - m * x * y ** 3;
    const n = Math.hypot(u, v);
    const h = 1e-6;
    const d = (omega(p + h * u / n, q + h * v / n) - omega(p - h * u / n, q - h * v / n)) / (2 * h);
    auditIs(card, 'MIT-MV-66:grad-dir', { m, p, q, u, v }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [d], 1e-5, `seed ${index} ${lang} grad-dir`, f);
    f.ok(has(card.prompt, `|A| = ${n}`), `seed ${index}: |A| = ${n} not printed`);
    // the plan's aside "(for m = 1 this is x²y − xy³)" must not be shown for every m
    const aside = lang === 'en' ? /for m = 1 this is/ : /m = 1 时即/;
    f.ok(m === 2 ? aside.test(norm(card.prompt)) : !aside.test(norm(card.prompt)), `seed ${index}: the "for m = 1 this is" aside is printed wrongly for m = ${m}`);
  }));

  it('level-dir: exactly the option perpendicular to ∇ω is correct', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'level-dir');
    const g = rx(card.prompt, /∇ω = \((-?\d+), (-?\d+)\)/, 'g');
    const g1 = Number(g[1]), g2 = Number(g[2]);
    f.ok(Math.abs(g1) >= 1 && Math.abs(g1) <= 4 && Math.abs(g2) >= 1 && Math.abs(g2) <= 4 && Math.abs(g1) !== Math.abs(g2), `seed ${index}: g ${g1},${g2} outside plan`);
    const parse = (o: string) => { const m = norm(o).match(/A = \((-?\d+), (-?\d+)\)/); return m ? [Number(m[1]), Number(m[2])] : null; };
    const verdict = card.choice!.options.map(o => { const A = parse(o); return !!A && g1 * A[0] + g2 * A[1] === 0; });
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4 && card.choice!.options.every(o => parse(o) !== null), `seed ${index}: options ${card.choice!.options}`);
  }));

  it('tangent-plane: the plane through P halves ∇w so the x-coefficient is x₀; second-order contact', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'tangent-plane');
    const ab = rx(card.prompt, /x² \+ (\d*)y² \+ (\d*)z²/, 'w');
    const a = cf(ab[1]), b = cf(ab[2]);
    const x0 = cf(rx(card.prompt, /(\d*)x \+ By \+ Cz = D/, 'x0')[1]);
    const P: P3 = (() => { const m = [...norm(card.prompt).matchAll(/\((-?\d+), (-?\d+), (-?\d+)\)/g)]; if (!m.length) throw new Error('P'); const z = m[m.length - 1]; return [Number(z[1]), Number(z[2]), Number(z[3])]; })();
    f.ok([[1, 2], [2, 1], [2, 2], [1, 3], [3, 1], [2, 3], [3, 2]].some(([u, v]) => u === a && v === b), `seed ${index}: (a,b) = (${a},${b}) outside plan`);
    f.ok([1, 2].includes(x0) && Math.abs(P[1]) <= 2 && Math.abs(P[2]) <= 2, `seed ${index}: x0,P ${x0},${P}`);
    const w = (x: number, y: number, z: number) => x * x + a * y * y + b * z * z;
    const B = fd(w, P, 1) / 2, C = fd(w, P, 2) / 2;
    f.ok(near(fd(w, P, 0) / 2, x0, 1e-4), `seed ${index}: the x-coefficient halves to ${fd(w, P, 0) / 2} not ${x0}`);
    const D = P[0] * x0 + P[1] * B + P[2] * C;
    auditIs(card, 'MIT-MV-66:tangent-plane', { a, b, x0, y0: P[1], z0: P[2] }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [B, C, D], 1e-4, `seed ${index} ${lang} tangent-plane`, f);
    // contact check: along a tangent direction t ⟂ ∇w the residual shrinks like s²
    const grad = [fd(w, P, 0), fd(w, P, 1), fd(w, P, 2)];
    const t1: P3 = [grad[1], -grad[0], 0];
    const norm1 = [t1, [grad[2], 0, -grad[0]]].find(t => Math.hypot(...t) > 1e-9)!;
    const un = norm1.map(c => c / Math.hypot(...norm1)) as P3;
    const r1 = w(P[0] + 1e-2 * un[0], P[1] + 1e-2 * un[1], P[2] + 1e-2 * un[2]) - D;
    const r2 = w(P[0] + 1e-3 * un[0], P[1] + 1e-3 * un[1], P[2] + 1e-3 * un[2]) - D;
    f.ok(Math.abs(r1) / Math.max(Math.abs(r2), 1e-300) > 50, `seed ${index}: contact ratio ${Math.abs(r1) / Math.abs(r2)}`);
  }));

  it('dihedral: cos θ = |c|/|n| from the plane coefficients', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'dihedral');
    const { a, b, c, d } = planeOf(card.prompt);
    f.ok([a, b, c].every(v => Math.abs(v) >= 1), `seed ${index}: a,b,c ${a},${b},${c}`);
    const quad = [[1, 2, 2], [2, 3, 6], [1, 4, 8], [4, 4, 7]];
    const combo = [[a, b, c], [a, c, b], [b, a, c], [b, c, a], [c, a, b], [c, b, a]].find(p => quad.some(q => [0, 1, 2].every(k => Math.abs(p[k]) === q[k])));
    f.ok(!!combo, `seed ${index}: (a,b,c) ${a},${b},${c} not a permutation/sign of a plan quadruple`);
    const N = Math.hypot(a, b, c);
    f.ok(near(N, Math.round(N), 1e-9), `seed ${index}: |n| = ${N} not an integer`);
    const tan = Math.hypot(a, b) / Math.abs(c);
    const cos = 1 / Math.hypot(1, tan);
    f.ok(near(cos, Math.abs(c) / N, 1e-12), `seed ${index}: two routes disagree ${cos} vs ${Math.abs(c) / N}`);
    auditIs(card, 'MIT-MV-66:dihedral', { a, b, c, d }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [cos], 1e-9, `seed ${index} ${lang} dihedral`, f);
  }));

  it('lagrange-setup: answers are the plane coefficients a, b, c; tokens and misconceptions', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'lagrange-setup');
    const { a, b, c, d } = planeOf(card.prompt);
    symbolShape(card, 3, `seed ${index} ${lang} lagrange-setup`, f);
    const ans = card.slots!.answers.map(x => evOrNaN(x));
    f.ok(near(ans[0], a, 1e-9) && near(ans[1], b, 1e-9) && near(ans[2], c, 1e-9), `seed ${index}: answers ${ans} vs (${a}, ${b}, ${c})`);
    f.ok([a, b, c].every(v => Math.abs(v) >= 1 && Math.abs(v) <= 5), `seed ${index}: coefficients ${a},${b},${c} outside plan`);
    // tokens: {a,b,c,d,2a,2b,2c} as printed numbers, de-duplicated
    const want = [a, b, c, d, 2 * a, 2 * b, 2 * c].map(String).sort();
    f.ok(JSON.stringify(card.slots!.tokens.map(norm).sort()) === JSON.stringify(want.map(norm)), `seed ${index}: tokens ${JSON.stringify(card.slots!.tokens)} vs ${want}`);
    f.ok(has(card.slots!.before, '2x = λ*'), `seed ${index}: before "${card.slots!.before}"`);
    // a different coefficient in a slot must change the value
    card.slots!.answers.forEach((_, si) => { for (const tok of card.slots!.tokens) { if (tok === card.slots!.answers[si]) continue; const trial = card.slots!.answers.slice(); trial[si] = tok; f.ok(evOrNaN(trial[si]) !== evOrNaN(card.slots!.answers[si]), `seed ${index}: token ${tok} in slot ${si} unchanged`); } });
  }));

  it('lagrange-point: closest point by numerical minimisation, (d/N)(a,b,c)', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'lagrange-point');
    const { a, b, c, d } = planeOf(card.prompt);
    const N = a * a + b * b + c * c;
    const min = planeMin(a, b, c, d);
    f.ok(near(min[0], d * a / N, 1e-5) && near(min[1], d * b / N, 1e-5) && near(min[2], d * c / N, 1e-5), `seed ${index}: numeric min ${min} vs closed ${[d * a / N, d * b / N, d * c / N]}`);
    auditIs(card, 'MIT-MV-66:lagrange-point', { a, b, c, d }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [d * a / N, d * b / N, d * c / N], 1e-6, `seed ${index} ${lang} lagrange-point`, f);
    f.ok(d !== 0, `seed ${index}: d = 0`);
  }));

  it('lagrange-check: exactly the point parallel to the normal (minimal |P|²) is correct', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'lagrange-check');
    const { a, b, c, d } = planeOf(card.prompt);
    const parse = (o: string) => { const m = norm(o).match(/\((-?\d+), (-?\d+), (-?\d+)\)/); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null; };
    const pts = card.choice!.options.map(parse);
    f.ok(pts.every(p => p !== null), `seed ${index}: option without a point ${card.choice!.options}`);
    const flat = pts as number[][];
    flat.forEach(p => f.ok(a * p[0] + b * p[1] + c * p[2] === d, `seed ${index}: point ${p} is not on the plane`));
    const norm2 = flat.map(p => p[0] ** 2 + p[1] ** 2 + p[2] ** 2);
    const min = Math.min(...norm2);
    const verdict = norm2.map(v => v === min);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    // the closest one is the multiple of the normal
    const best = flat[norm2.indexOf(min)];
    f.ok(Math.abs(best[0] * b - best[1] * a) < 1e-9 && Math.abs(best[1] * c - best[2] * b) < 1e-9, `seed ${index}: the closest point ${best} is not parallel to n`);
  }));

  it('constraint-setup: the four blanks are 1, 0, −g_v, g_u; tokens', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'constraint-setup');
    const [u, v, w] = orderUVW(card.prompt);
    symbolShape(card, 4, `seed ${index} ${lang} constraint-setup`, f);
    const ans = card.slots!.answers;
    f.ok(ans[0] === '1' && ans[1] === '0', `seed ${index}: first two blanks ${ans[0]},${ans[1]}`);
    f.ok(norm(ans[2]) === norm(`-g_${v}`), `seed ${index}: third blank ${ans[2]} vs -g_${v}`);
    f.ok(norm(ans[3]) === norm(`g_${u}`), `seed ${index}: fourth blank ${ans[3]} vs g_${u}`);
    void w;
    const want = ['1', '0', 'g_x', 'g_y', 'g_z', '-g_x', '-g_y', '-g_z'].map(norm).sort();
    f.ok(JSON.stringify(card.slots!.tokens.map(norm).sort()) === JSON.stringify(want), `seed ${index}: tokens ${JSON.stringify(card.slots!.tokens)}`);
  }));

  it('constraint-value: (∂ω/∂v)_w by the linear model + central difference', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'constraint-value');
    const [u, v, w] = orderUVW(card.prompt);
    const F = gradVec(card.prompt, 'f'), G = gradVec(card.prompt, 'g');
    const iu = varIndex[u], iv = varIndex[v], iw = varIndex[w];
    const c0 = Number(rx(card.prompt, /g\(x, y, z\) = (\d+)/, 'c0')[1]);
    const gu = G[iu];
    f.ok(Math.abs(gu) >= 1, `seed ${index}: g_u = 0`);
    // g(X) = G·X = c0, so u = (c0 − gv v − gw w)/gu; omega(v,w) = fv v + fw w + fu u
    const om = (vv: number, ww: number) => F[iv] * vv + F[iw] * ww + F[iu] * (c0 - G[iv] * vv - G[iw] * ww) / gu;
    const h = 1e-6;
    const d = (om(0.1 + h, 0.3) - om(0.1 - h, 0.3)) / (2 * h);
    const expect = F[iv] - F[iu] * G[iv] / gu;
    f.ok(near(d, expect, 1e-6), `seed ${index}: numeric ${d} vs ${expect}`);
    f.ok(Math.abs(expect) > 1e-9, `seed ${index}: answer is zero`);
    auditIs(card, 'MIT-MV-66:constraint-value', { fu: F[iu], fv: F[iv], fw: F[iw], gu: G[iu], gv: G[iv], gw: G[iw] }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [expect], 1e-6, `seed ${index} ${lang} constraint-value`, f);
  }));

  it('challenge: least squared distance to the plane = (n·P₀)²/|n|² by numerical minimisation', () => everySeed((index, lang, f) => {
    const card = getCard(66, index, lang, 'challenge');
    const all = [...norm(card.prompt).matchAll(/\((-?\d+), (-?\d+), (-?\d+)\)/g)].map(m => [Number(m[1]), Number(m[2]), Number(m[3])]);
    f.ok(all.length >= 2, `seed ${index}: fewer than two vectors`);
    const P0 = all[0], n = all[1];
    const d = n[0] * P0[0] + n[1] * P0[1] + n[2] * P0[2];
    const N = n[0] ** 2 + n[1] ** 2 + n[2] ** 2;
    f.ok([3, 6, 9].includes(N), `seed ${index}: |n|² = ${N} outside plan`);
    f.ok(d !== 0 && Math.abs(d) <= 12, `seed ${index}: d = ${d} outside plan`);
    const min = planeMin(n[0], n[1], n[2], d);
    const val = min[0] ** 2 + min[1] ** 2 + min[2] ** 2;
    f.ok(near(val, d * d / N, 1e-6), `seed ${index}: numeric ${val} vs ${d * d / N}`);
    auditIs(card, 'MIT-MV-66:challenge', { n, p0: P0 }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [d * d / N], 1e-6, `seed ${index} ${lang} challenge`, f);
    f.ok(!card.figure, `seed ${index}: the challenge must have no figure`);
  }));

  it('variety and answer positions', () => {
    for (const slug of IDS_66) expect(distinctCount(66, slug, fullKey), slug).toBeGreaterThanOrEqual(6);
    for (const slug of ['level-dir', 'lagrange-check']) expect(answerPositions(66, slug).size, `${slug} answer positions`).toBeGreaterThanOrEqual(2);
  });
});

// ======================================================================================================
// MIT-MV-67 — Final Review: Unit 3
// ======================================================================================================
const IDS_67 = ['choose-exchange', 'exchange-limits', 'polar-moment-setup', 'polar-moment-value', 'jacobian-scale', 'not-elementary-check', 'spherical-z', 'spherical-setup', 'spherical-value', 'challenge'];
const KINDS_67 = ['MIT-MV-67:challenge', 'MIT-MV-67:polar-moment-value', 'MIT-MV-67:spherical-value'];
const radiusOfDisk = (card: PracticeCard): number => { const m = norm(card.prompt).match(/≤\s*(\d+)²/); if (!m) throw new Error('R'); return Number(m[1]); };

describe('MIT-MV-67 oracle', () => {
  shapeTests(67, IDS_67, KINDS_67);

  it('choose-exchange: only "change the order of integration" is correct', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'choose-exchange');
    const a = Number(rx(card.prompt, /a\s*=\s*(\d+)/, 'a')[1]);
    f.ok(a >= 2 && a <= 7, `seed ${index}: a ${a} outside plan`);
    const good = (o: string) => lang === 'en' ? /change the order of integration/i.test(o) : /交换积分次序/.test(o);
    const verdict = card.choice!.options.map(good);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 5, `seed ${index}: options ${card.choice!.options.length}`);
    // the swapped integral is elementary: inner ∫0^√y x dx = y/2, value (1 − e^{−a⁴})/4 (numeric check)
    const val = simpson(y => simpson(x => x * Math.exp(-y * y), 0, Math.sqrt(y), 8), 0, a * a, 400);
    f.ok(near(val, (1 - Math.exp(-(a ** 4))) / 4, 1e-4), `seed ${index}: swapped value ${val}`);
  }));

  it('exchange-limits: swapped bounds y:0→a², x:0→√y', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'exchange-limits');
    const a = Number(rx(card.prompt, /a\s*=\s*(\d+)/, 'a')[1]);
    f.ok(a >= 2 && a <= 7, `seed ${index}: a ${a} outside plan`);
    symbolShape(card, 4, `seed ${index} ${lang} exchange-limits`, f);
    const [b0, b1, b2, b3] = card.slots!.answers;
    f.ok(near(evOrNaN(b0), 0, 1e-9) && near(evOrNaN(b1), a * a, 1e-9), `seed ${index}: y-bounds ${evOrNaN(b0)},${evOrNaN(b1)}`);
    f.ok(near(evOrNaN(b2), 0, 1e-9), `seed ${index}: x-lower ${evOrNaN(b2)}`);
    for (const y of [1, 4, 9]) f.ok(near(evOrNaN(b3, { y }), Math.sqrt(y), 1e-9) || evOrNaN(b3, { y }) === Math.sqrt(y), `seed ${index}: x-upper at y=${y} = ${evOrNaN(b3, { y })}`);
  }));

  it('polar-moment-setup: θ:0→2π, r:0→R, integrand r³', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'polar-moment-setup');
    const R = radiusOfDisk(card);
    f.ok(R >= 1 && R <= 6, `seed ${index}: R ${R} outside plan`);
    symbolShape(card, 5, `seed ${index} ${lang} polar-moment-setup`, f);
    const ans = card.slots!.answers;
    f.ok(near(evOrNaN(ans[0]), 0) && near(evOrNaN(ans[1]), 2 * PI), `seed ${index}: θ ${ans[0]},${ans[1]}`);
    f.ok(near(evOrNaN(ans[2]), 0) && near(evOrNaN(ans[3]), R), `seed ${index}: r ${ans[2]},${ans[3]}`);
    for (const r of [0.5, 1.5, 3]) f.ok(near(evOrNaN(ans[4], { r }), r ** 3, 1e-9), `seed ${index}: integrand at r=${r} = ${evOrNaN(ans[4], { r })} vs ${r ** 3}`);
  }));

  it('polar-moment-value: I = πR⁴/2 by polar and Cartesian quadrature', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'polar-moment-value');
    const R = radiusOfDisk(card);
    f.ok(R >= 1 && R <= 6, `seed ${index}: R ${R} outside plan`);
    const polar = simpson(th => simpson(r => r * r * r, 0, R, 200), 0, 2 * PI, 200);
    f.ok(near(polar, PI * R ** 4 / 2, 1e-9), `seed ${index}: polar quadrature ${polar} vs πR⁴/2`);
    auditIs(card, 'MIT-MV-67:polar-moment-value', { R: R }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [PI * R ** 4 / 2], 1e-6, `seed ${index} ${lang} polar-moment-value`, f);
  }));

  it('jacobian-scale: the correct option is (ab) r dr dθ (det = ab r)', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'jacobian-scale');
    const a = Number(rx(card.prompt, /x\s*=\s*(\d+)r\s*cosθ/, 'a')[1]);
    const b = Number(rx(card.prompt, /y\s*=\s*(\d+)r\s*sinθ/, 'b')[1]);
    f.ok(a >= 1 && a <= 4 && b >= 1 && b <= 4 && a !== b, `seed ${index}: a,b ${a},${b} outside plan`);
    const det = a * b;
    const good = (o: string): boolean => {
      const x = norm(o).replace(/\s/g, '');
      const m = x.match(/^(\d*)rdrdθ$/);
      return !!m && (m[1] === '' ? 1 : Number(m[1])) === det;
    };
    const verdict = card.choice!.options.map(good);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}, options ${JSON.stringify(card.choice!.options)}`);
    f.ok(card.choice!.options.length === 5, `seed ${index}: options ${card.choice!.options.length}`);
  }));

  it('not-elementary-check: only the polar evaluation (π/4) is correct', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'not-elementary-check');
    const good = (o: string): boolean => { const x = norm(o); return lang === 'en' ? /evaluable in polar/.test(x) : /极坐标可算/.test(x); };
    const verdict = card.choice!.options.map(good);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 5, `seed ${index}: options ${card.choice!.options.length}`);
    const I = simpson(th => simpson(r => Math.exp(-r * r) * r, 0, 12, 400), 0, PI / 2, 100);
    f.ok(near(I, PI / 4, 1e-6), `seed ${index}: polar integral I² ${I} vs π/4`);
  }));

  it('spherical-z: only ρ cos φ is the height z', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'spherical-z');
    const R = Number(rx(card.prompt, /radius\s+(\d+)|半径\s*为?\s*(\d+)/, 'R').slice(1).find(x => x !== undefined)!);
    f.ok([1, 2, 3].includes(R), `seed ${index}: R ${R} outside plan`);
    const good = (o: string) => norm(o).replace(/\s/g, '') === 'z=ρcosφ';
    const verdict = card.choice!.options.map(good);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}, options ${JSON.stringify(card.choice!.options)}`);
    f.ok(card.choice!.options.length === 5, `seed ${index}: options ${card.choice!.options.length}`);
  }));

  it('spherical-setup: θ:0→2π, φ:0→π/2, ρ:0→R, integrand ρcos²φsinφ', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'spherical-setup');
    const R = Number(rx(card.prompt, /radius\s+(\d+)|半径\s*为?\s*(\d+)/, 'R').slice(1).find(x => x !== undefined)!);
    f.ok(R >= 1 && R <= 6, `seed ${index}: R ${R} outside plan`);
    symbolShape(card, 7, `seed ${index} ${lang} spherical-setup`, f);
    const ans = card.slots!.answers;
    f.ok(near(evOrNaN(ans[0]), 0) && near(evOrNaN(ans[1]), 2 * PI), `seed ${index}: θ ${ans[0]},${ans[1]}`);
    f.ok(near(evOrNaN(ans[2]), 0) && near(evOrNaN(ans[3]), PI / 2), `seed ${index}: φ ${ans[2]},${ans[3]}`);
    f.ok(near(evOrNaN(ans[4]), 0) && near(evOrNaN(ans[5]), R), `seed ${index}: ρ ${ans[4]},${ans[5]}`);
    for (const [ph, rho] of [[0.4, 1.2], [0.9, 2.1], [1.3, 0.6]]) f.ok(near(evOrNaN(ans[6], { φ: ph, ρ: rho }), rho * Math.cos(ph) ** 2 * Math.sin(ph), 1e-9), `seed ${index}: integrand at (φ,ρ)=(${ph},${rho}) = ${evOrNaN(ans[6], { φ: ph, ρ: rho })}`);
  }));

  it('spherical-value: F/G = πR²/3 by spherical quadrature', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'spherical-value');
    const R = Number(rx(card.prompt, /radius\s+(\d+)|半径\s*为?\s*(\d+)/, 'R').slice(1).find(x => x !== undefined)!);
    f.ok(R >= 1 && R <= 6, `seed ${index}: R ${R} outside plan`);
    const val = simpson(th => simpson(ph => simpson(rho => rho * Math.cos(ph) ** 2 * Math.sin(ph), 0, R, 100), 0, PI / 2, 100), 0, 2 * PI, 50);
    f.ok(near(val, PI * R * R / 3, 1e-6), `seed ${index}: quadrature ${val} vs πR²/3`);
    auditIs(card, 'MIT-MV-67:spherical-value', { R: R }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [PI * R * R / 3], 1e-6, `seed ${index} ${lang} spherical-value`, f);
  }));

  it('challenge: ∫0^c ∫0^∞ e^{−r²} r dr dθ = c/2', () => everySeed((index, lang, f) => {
    const card = getCard(67, index, lang, 'challenge');
    // c is printed as an angle (e.g. π/2 or 2π/3); the audit passes it as the fraction cNum/cDen (conventions doc).
    const cm = norm(card.prompt).match(/c = (\d*)π\/(\d+)/);
    if (!cm) throw new Error(`cannot parse c in "${norm(card.prompt).slice(0, 90)}"`);
    const cNum = cm[1] === '' ? 1 : Number(cm[1]);
    const cDen = Number(cm[2]);
    const c = cNum * PI / cDen;
    f.ok([[1, 6], [1, 4], [1, 3], [1, 2], [2, 3], [3, 4]].some(([n, d]) => n === cNum && d === cDen), `seed ${index}: c = ${cNum}π/${cDen} outside plan`);
    const inner = simpson(r => Math.exp(-r * r) * r, 0, 12, 800);
    f.ok(near(inner, 0.5, 1e-6), `seed ${index}: inner ${inner} vs 1/2`);
    auditIs(card, 'MIT-MV-67:challenge', { cNum, cDen }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [c / 2], 1e-9, `seed ${index} ${lang} challenge`, f);
    f.ok(!card.figure, `seed ${index}: the challenge must have no figure`);
  }));

  it('variety and answer positions', () => {
    // not-elementary-check is a fixed conceptual card (no sampled numbers) and spherical-z samples only the decoy R ∈ {1,2,3}.
    for (const slug of IDS_67) {
      const need = slug === 'not-elementary-check' ? 1 : slug === 'spherical-z' ? 3 : 6;
      expect(distinctCount(67, slug, fullKey), slug).toBeGreaterThanOrEqual(need);
    }
    for (const slug of ['choose-exchange', 'jacobian-scale', 'spherical-z', 'not-elementary-check']) expect(answerPositions(67, slug).size, `${slug} answer positions`).toBeGreaterThanOrEqual(2);
  });
});
