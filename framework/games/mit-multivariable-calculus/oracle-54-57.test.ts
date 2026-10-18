import { describe, expect, it, vi } from 'vitest';
import { mv54 } from './games/mv54';
import { mv55 } from './games/mv55';
import { mv56 } from './games/mv56';
import { mv57 } from './games/mv57';
import { spreadSeed } from './deck-invariants';
import { simpson } from './oracle-harness';
import { gradeCard, type CardGenerator, type GameLanguage, type PracticeCard } from '../types';
import { figureProblems, project3d, type Figure, type FigureShape, type Pt } from '../figure';

/**
 * Acceptance oracle for MIT-MV-54, 55, 56 and 57. Written from the approved plan (docs/mit-mv-drafts/approved-54-57.md)
 * without reading the generators. Every numeric answer is recomputed by a route that does not use the plan's closed form.
 */
vi.setConfig({ testTimeout: 240000 });
const SEEDS = 60;
const PI = Math.PI;
type Lang = GameLanguage;
const LANGS: Lang[] = ['en', 'zh'];
const generators: Record<number, CardGenerator> = { 54: mv54, 55: mv55, 56: mv56, 57: mv57 };

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

// ---------- numerics ----------
const clean = (text: string) => text.replaceAll('−', '-').replaceAll('·', '*').replaceAll(' ', ' ');
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const ptNear = (p: Pt, q: Pt, tol = 1e-9) => near(p[0], q[0], tol) && near(p[1], q[1], tol);
const memo = <A extends unknown[], R>(fn: (...args: A) => R) => { const m = new Map<string, R>(); return (...args: A): R => { const k = args.join(','); if (!m.has(k)) m.set(k, fn(...args)); return m.get(k)!; }; };

/** Composite 5-point Gauss-Legendre; never evaluates the end points. */
const GL_X = [-0.9061798459386640, -0.5384693101056831, 0, 0.5384693101056831, 0.9061798459386640];
const GL_W = [0.2369268850561891, 0.4786286704993665, 0.5688888888888889, 0.4786286704993665, 0.2369268850561891];
function gauss(f: (x: number) => number, a: number, b: number, panels = 200): number {
  let total = 0;
  for (let p = 0; p < panels; p++) {
    const lo = a + (b - a) * p / panels, hi = a + (b - a) * (p + 1) / panels, mid = (lo + hi) / 2, half = (hi - lo) / 2;
    for (let i = 0; i < 5; i++) total += GL_W[i] * f(mid + half * GL_X[i]);
  }
  return total * (b - a) / panels / 2;
}
/** 2D midpoint grid over [u0,u1] x [v0,v1]. */
function midgrid2(f: (u: number, v: number) => number, u0: number, u1: number, v0: number, v1: number, n = 200): number {
  const du = (u1 - u0) / n, dv = (v1 - v0) / n;
  let s = 0;
  for (let i = 0; i < n; i++) { const u = u0 + (i + 0.5) * du; for (let j = 0; j < n; j++) { s += f(u, v0 + (j + 0.5) * dv); } }
  return s * du * dv;
}
/** Flux of a vector field through a sphere of radius R by the parametrisation, phi in [0, phi1], theta in [0, 2pi]. */
function sphereSurface(F: (x: number, y: number, z: number) => [number, number, number], R: number, phi1 = PI, n = 200): number {
  return midgrid2((phi, th) => {
    const sp = Math.sin(phi), cp = Math.cos(phi), st = Math.sin(th), ct = Math.cos(th);
    const x = R * sp * ct, y = R * sp * st, z = R * cp;
    const rp = [R * cp * ct, R * cp * st, -R * sp];
    const rt = [-R * sp * st, R * sp * ct, 0];
    const N = [rp[1] * rt[2] - rp[2] * rt[1], rp[2] * rt[0] - rp[0] * rt[2], rp[0] * rt[1] - rp[1] * rt[0]];
    const fv = F(x, y, z);
    return fv[0] * N[0] + fv[1] * N[1] + fv[2] * N[2];
  }, 0, phi1, 0, 2 * PI, n);
}
/** Integral over the disk x^2+y^2 <= R^2 in polar coordinates; `f` is the already Jacobian-free integrand. */
function diskPolar(f: (r: number, th: number) => number, R: number, n = 200): number {
  return midgrid2((r, th) => f(r, th) * r, 0, R, 0, 2 * PI, n);
}

// expression evaluator for set-up tokens such as `3√2`, `1/cos φ`, `5 cos φ sin φ`, `ρ² sin φ`, `2π/3`
function ev(source: string, env: Record<string, number> = {}): number {
  const text = clean(source);
  const tokens = text.match(/\d+(?:\.\d+)?|sin|cos|[A-Za-zρφθπ]|[√²³]|[-+*/()]/g) ?? [];
  if (tokens.join('') !== text.replace(/\s/g, '')) throw new Error(`cannot tokenise "${source}"`);
  let p = 0;
  const startsAtom = (t?: string) => t !== undefined && (/^\d/.test(t) || t === '(' || t === '√' || t === 'sin' || t === 'cos' || /^[A-Za-zρφθπ]$/.test(t));
  const atom = (): number => {
    const t = tokens[p++];
    if (t === undefined) throw new Error(`unexpected end in "${source}"`);
    if (t === '(') { const v = sum(); if (tokens[p++] !== ')') throw new Error(`missing ) in "${source}"`); return v; }
    if (t === '√') return Math.sqrt(atom());
    if (t === 'sin' || t === 'cos') {
      const fn = t === 'sin' ? Math.sin : Math.cos;
      const e = tokens[p] === '²' ? (p++, 2) : tokens[p] === '³' ? (p++, 3) : 1;
      return fn(atom()) ** e;
    }
    if (t === 'π') return PI;
    if (/^\d/.test(t)) return Number(t);
    if (env[t] === undefined) throw new Error(`unbound ${t} in "${source}"`);
    return env[t];
  };
  const power = (): number => { let v = atom(); while (tokens[p] === '²' || tokens[p] === '³') v **= tokens[p++] === '²' ? 2 : 3; return v; };
  const unary = (): number => { if (tokens[p] === '-') { p++; return -unary(); } if (tokens[p] === '+') { p++; return unary(); } return power(); };
  const term = (): number => {
    let v = unary();
    for (;;) {
      const t = tokens[p];
      if (t === '*') { p++; v *= unary(); } else if (t === '/') { p++; v /= unary(); } else if (startsAtom(t)) v *= unary(); else break;
    }
    return v;
  };
  const sum = (): number => { let v = term(); while (tokens[p] === '+' || tokens[p] === '-') { const op = tokens[p++]; const n = term(); v += op === '+' ? n : -n; } return v; };
  const result = sum();
  if (p !== tokens.length) throw new Error(`trailing tokens in "${source}"`);
  return result;
}
function exactString(v: number): string {
  for (let q = 1; q <= 400; q++) { const p = Math.round(v * q); if (Math.abs(v - p / q) < 1e-9) return q === 1 ? `${p}` : `${p}/${q}`; }
  for (let q = 1; q <= 400; q++) { const p = Math.round(v * q / Math.SQRT2); if (Math.abs(v - p * Math.SQRT2 / q) < 1e-9) return `${p}sqrt(2)${q === 1 ? '' : `/${q}`}`; }
  for (let q = 1; q <= 400; q++) { const p = Math.round(v * q / PI); if (Math.abs(v - p * PI / q) < 1e-9) return `${p}pi${q === 1 ? '' : `/${q}`}`; }
  throw new Error(`no exact form for ${v}`);
}

// ---------- generic checks ----------
const CJK = /[㐀-鿿]/;
const ALLOWED_ASCII = new Set(['OP', 'GM', 'sin', 'cos', 'tan', 'sqrt', 'pi', 'dr', 'dz', 'dV', 'dS', 'dA', 'dx', 'dy', 'Fx', 'Fy', 'Fz', 'xz', 'yz', 'xy', 'curl', 'curlF', 'div', 'Si', 'xx', 'yy', 'zz', 'flux']);
const figureTexts = (fig?: Figure) => fig ? [fig.alt, fig.caption ?? '', ...fig.shapes.map(s => s.kind === 'text' ? s.text : 'label' in s ? s.label ?? '' : '')] : [];
function textsOf(card: PracticeCard): string[] {
  return [card.title, card.prompt, card.hint, card.explanation, ...(card.lines ?? []), ...(card.fields?.map(x => x.label) ?? []), ...(card.choice?.options ?? []),
    ...(card.slots ? [card.slots.before, ...(card.slots.between ?? []), card.slots.after ?? '', ...card.slots.tokens] : []), ...figureTexts(card.figure)];
}
function languageProblems(card: PracticeCard, lang: Lang): string[] {
  const bad: string[] = [];
  for (const text of textsOf(card)) {
    if (lang === 'en' && CJK.test(text)) bad.push(`CJK in EN: ${text.slice(0, 50)}`);
    if (lang === 'zh') {
      const words = (text.match(/[A-Za-z]{2,}/g) ?? []).filter(w => !ALLOWED_ASCII.has(w));
      if (words.length) bad.push(`English words ${JSON.stringify(words)} in ZH string "${text.slice(0, 60)}"`);
    }
    if (/\{[^}]*\}|undefined|NaN|\[object/.test(text)) bad.push(`template/undefined leftover: ${text.slice(0, 60)}`);
  }
  return bad;
}
function gradeNumeric(card: PracticeCard, expected: number[], tol: number, where: string, f: Fails) {
  f.ok(card.fields?.length === expected.length, `${where}: field count`);
  if (!card.fields) return;
  expected.forEach((v, i) => { const got = card.fields![i].answer; f.ok(Math.abs(got - v) <= tol * Math.max(1, Math.abs(v)), `${where} field ${i} (${card.fields![i].label}): oracle ${v}, card ${got}`); });
  // Grade with the string form of the CARD's own answer (exact where the value has a tidy form,
  // otherwise the printed decimal). The oracle route must agree numerically (checked above); this
  // block only verifies that the card's stored answers grade correct and near-misses grade incorrect.
  const accepted = card.fields.map(x => { try { return exactString(x.answer); } catch { return String(x.answer); } });
  f.ok(gradeCard(card, accepted, null, []) === 'correct', `${where}: accepted answer ${JSON.stringify(accepted)} does not grade correct`);
  expected.forEach((v, i) => { const bad = accepted.slice(); bad[i] = String(v * 1.01 + 0.013); f.ok(gradeCard(card, bad, null, []) === 'incorrect', `${where}: perturbed field ${i} is not graded incorrect`); });
}
function auditIs(card: PracticeCard, kind: string, params: Record<string, number>, where: string, f: Fails) {
  f.ok(card.audit?.kind === kind, `${where}: audit kind ${card.audit?.kind}`);
  for (const [key, value] of Object.entries(params)) f.ok(card.audit?.params[key] === value, `${where}: audit ${key} = ${card.audit?.params[key]}, printed ${value}`);
  f.ok(card.audit && Object.keys(card.audit.params).length === Object.keys(params).length, `${where}: audit params ${JSON.stringify(card.audit?.params)} vs ${JSON.stringify(params)}`);
}
function bothLanguagesAgree(game: number, index: number, slug: string, f: Fails) {
  const en = getCard(game, index, 'en', slug), zh = getCard(game, index, 'zh', slug);
  f.ok(JSON.stringify(en.audit) === JSON.stringify(zh.audit), `seed ${index} ${slug}: EN/ZH audit differ`);
  f.ok(JSON.stringify(en.fields?.map(x => x.answer)) === JSON.stringify(zh.fields?.map(x => x.answer)), `seed ${index} ${slug}: EN/ZH answers differ`);
  f.ok(en.choice?.answer === zh.choice?.answer, `seed ${index} ${slug}: EN/ZH choice answer differs`);
  f.ok(JSON.stringify(en.slots?.answers) === JSON.stringify(zh.slots?.answers), `seed ${index} ${slug}: EN/ZH slot answers differ`);
  f.ok(JSON.stringify(en.slots?.tokens) === JSON.stringify(zh.slots?.tokens), `seed ${index} ${slug}: EN/ZH tokens differ`);
  f.ok((en.figure?.shapes.length ?? 0) === (zh.figure?.shapes.length ?? 0), `seed ${index} ${slug}: EN/ZH figure shape counts differ`);
}
function numbersIn(text: string): number[] { return (clean(text).match(/\d+(?:\.\d+)?/g) ?? []).map(Number); }
function checkFigureGeneric(card: PracticeCard, where: string, f: Fails) {
  const fig = card.figure;
  if (!fig) return;
  f.ok(figureProblems(fig).length === 0, `${where}: figureProblems ${figureProblems(fig).join(';')}`);
  const { xmin, xmax, ymin, ymax } = fig.view;
  const inside = (p: Pt) => p[0] >= xmin - 1e-9 && p[0] <= xmax + 1e-9 && p[1] >= ymin - 1e-9 && p[1] <= ymax + 1e-9;
  fig.shapes.forEach((s, i) => {
    const pts: Pt[] = s.kind === 'line' || s.kind === 'area' ? s.points : s.kind === 'arrow' ? [s.from, s.to] : [s.at];
    f.ok(pts.every(inside), `${where}: shape ${i} (${s.kind}${'label' in s && s.label ? ' ' + s.label : ''}) lies outside the view`);
  });
  const printed = new Set(numbersIn(card.prompt));
  for (const t of figureTexts(fig).slice(2)) for (const n of numbersIn(t)) f.ok(printed.has(n), `${where}: figure shows number ${n} that the prompt lacks`);
}
const lineShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'line' }> => s.kind === 'line');
const pointShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'point' }> => s.kind === 'point');
const arrowShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'arrow' }> => s.kind === 'arrow');
const distinctCount = (game: number, slug: string, key: (card: PracticeCard) => string): number => {
  const set = new Set<string>();
  for (let index = 0; index < SEEDS; index++) set.add(key(getCard(game, index, 'en', slug)));
  return set.size;
};
const plainKey = (card: PracticeCard) => card.prompt;
const fullKey = (card: PracticeCard) => JSON.stringify([card.prompt, card.choice?.options, card.figure?.shapes]);
const num = (text: string | undefined, label: string): number => { if (text === undefined) throw new Error(`cannot parse ${label}`); return Number(text); };
const rx = (text: string, pattern: RegExp, label: string): RegExpMatchArray => { const m = clean(text).match(pattern); if (!m) throw new Error(`cannot parse ${label} in "${text}"`); return m; };
const rel = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/** One correct option decided from its content by `pred`; exactly one option may satisfy it. */
function choiceCheck(card: PracticeCard, pred: (option: string) => boolean, where: string, f: Fails) {
  const opts = card.choice!.options;
  const good = opts.map(o => { try { return pred(o); } catch { return false; } });
  f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `${where}: ${JSON.stringify(good)}, answer ${card.choice!.answer}, options ${JSON.stringify(opts)}`);
  f.ok(new Set(opts).size === opts.length, `${where}: duplicate options`);
}

function componentFn(source: string): (x: number, y: number, z: number) => number {
  const t = clean(source).trim();
  let m = t.match(/^([+\-]?)(\d*)([xyz])$/);
  if (m) { const sign = m[1] === '-' ? -1 : 1, c = m[2] === '' ? 1 : Number(m[2]), ax = 'xyz'.indexOf(m[3]); return (x, y, z) => sign * c * [x, y, z][ax]; }
  m = t.match(/^([+\-]?\d+(?:\.\d+)?)$/); if (m) { const c = Number(m[1]); return () => c; }
  throw new Error(`cannot parse component "${source}"`);
}
/** Parse an option like "F = 3(−y, x, 0)" or "(2x, 2y, 1) dx dy" as a function (x,y,z)->[vx,vy,vz]. */
function tripleFn(text: string): (x: number, y: number, z: number) => [number, number, number] {
  const t = clean(text).replace(/^F\s*=\s*/, '');
  const open = t.indexOf('('), close = t.lastIndexOf(')');
  if (open < 0 || close < open) throw new Error(`no triple in "${text}"`);
  let scale = 1; const before = t.slice(0, open).trim();
  if (before !== '') { if (/^[+\-]?\d+(?:\.\d+)?$/.test(before)) scale = Number(before); else throw new Error(`bad scale "${before}"`); }
  const parts = t.slice(open + 1, close).split(',');
  if (parts.length !== 3) throw new Error(`not a triple "${text}"`);
  const fns = parts.map(componentFn);
  return (x, y, z) => [scale * fns[0](x, y, z), scale * fns[1](x, y, z), scale * fns[2](x, y, z)];
}

/**
 * Symbol-card check: `integral(values)` assembles the learner's set-up from the slot strings (answers or a single-token
 * substitution) and returns its numeric value. It must equal `truth` for the answers and for no other token in any slot.
 */
function checkSlots(card: PracticeCard, truth: number, integral: (values: string[]) => number, tol: number, where: string, f: Fails, skip?: (i: number, token: string) => boolean) {
  const slots = card.slots!;
  f.ok(slots.between !== undefined && slots.between.length === slots.answers.length - 1, `${where}: between.length ${slots.between?.length} vs ${slots.answers.length} blanks`);
  slots.answers.forEach(a => f.ok(slots.tokens.includes(a), `${where}: answer "${a}" not in tokens`));
  f.ok(new Set(slots.tokens).size === slots.tokens.length, `${where}: duplicate tokens ${JSON.stringify(slots.tokens)}`);
  f.ok(new Set(slots.tokens).size >= new Set(slots.answers).size, `${where}: fewer tokens than distinct answers`);
  const value = (values: string[]) => { try { const v = integral(values); return Number.isFinite(v) ? v : NaN; } catch { return NaN; } };
  const base = value(slots.answers);
  f.ok(rel(base, truth, tol), `${where}: assembled answers integrate to ${base}, independent value ${truth}`);
  slots.answers.forEach((_, i) => {
    for (const token of slots.tokens) {
      if (token === slots.answers[i]) continue;
      if (skip && skip(i, token)) continue;
      const trial = slots.answers.slice(); trial[i] = token;
      const v = value(trial);
      f.ok(!(Number.isFinite(v) && rel(v, truth, tol)), `${where}: token "${token}" in slot ${i} also gives the correct value ${v}`);
    }
  });
  f.ok(gradeCard(card, [], null, slots.answers) === 'correct', `${where}: answers do not grade correct`);
  slots.answers.forEach((_, i) => { const bad = slots.answers.slice(); bad[i] = slots.tokens.find(t => t !== slots.answers[i]) ?? 'x'; f.ok(gradeCard(card, [], null, bad) === 'incorrect', `${where}: wrong slot ${i} not graded incorrect`); });
}

const END_54 = { en: 'This game does not ask you to compute fluxes through surfaces whose normal changes in a complicated way (only a sphere and a tilted plane appear), to parametrize general surfaces, or to use the divergence theorem.', zh: '本游戏不要求计算法向变化复杂的曲面的通量（只涉及球面和一个斜平面），不要求对一般曲面参数化，也不涉及散度定理。' };
const END_55 = { en: 'This game does not ask you to find the area of a surface, to integrate over curved surfaces other than cylinders, spheres and graphs z = f(x, y), or to use the divergence theorem.', zh: '本游戏不要求求曲面面积，不涉及圆柱面、球面和函数图像 z = f(x, y) 以外的曲面上的积分，也不涉及散度定理。' };
const END_56 = { en: 'This game does not ask you to prove the divergence theorem, to use it for fluxes that need a triple integral in spherical coordinates, or to handle surfaces that are not closed except by adding a flat lid.', zh: '本游戏不要求证明散度定理，不涉及需要球坐标三重积分的通量，也不处理除加平盖以外的非闭曲面。' };
const END_57 = { en: 'This game does not ask you to carry out the proof for all three components or for general regions, to derive the partial differential equations, or to solve them.', zh: '本游戏不要求对三个分量或一般区域完成证明，不要求推导偏微分方程，也不要求求解它们。' };

function deckChecks(game: number, order: string[], ends: { en: string; zh: string }, f: Fails, index: number, lang: Lang, kinds: string[]) {
  const cards = deck(game, index, lang);
  const got = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
  f.ok(JSON.stringify(got) === JSON.stringify([...kinds].sort()), `seed ${index} ${lang}: audit kinds ${JSON.stringify(got)} vs ${JSON.stringify([...kinds].sort())}`);
  f.ok(cards.every(c => !c.fields || c.audit), `seed ${index} ${lang}: unaudited numeric card`);
  f.ok(cards.length >= 7 && cards.length <= 12 && cards[cards.length - 1].id === `MIT-MV-${game}-challenge`, `seed ${index} ${lang}: deck shape`);
  f.ok(JSON.stringify(cards.map(c => c.id)) === JSON.stringify(order.map(s => `MIT-MV-${game}-${s}`)), `seed ${index} ${lang}: card order ${cards.map(c => c.id)}`);
  cards.forEach(c => { for (const p of languageProblems(c, lang)) f.list.push(`seed ${index} ${lang} ${c.id}: ${p}`); checkFigureGeneric(c, `seed ${index} ${lang} ${c.id}`, f); });
  for (const c of cards) bothLanguagesAgree(game, index, c.id.slice(`MIT-MV-${game}-`.length), f);
  f.ok(cards[cards.length - 1].explanation.endsWith(ends[lang]), `seed ${index} ${lang}: challenge explanation must end with the does-not-assess sentence`);
}

// ======================================================================================================
// MIT-MV-54
// ======================================================================================================
describe('MIT-MV-54 oracle', () => {
  it('deck: kinds, order, language, end sentence', () => everySeed((index, lang, f) => {
    deckChecks(54, ['radial-mag', 'field-id', 'grav-setup', 'grav-value', 'orientation', 'hemi-setup', 'hemi-flux', 'plane-null', 'challenge'], END_54, f, index, lang,
      ['MIT-MV-54:radial-mag', 'MIT-MV-54:grav-value', 'MIT-MV-54:hemi-flux', 'MIT-MV-54:challenge']);
  }));

  it('radial-mag: |F| = |C|/ρ² by the floating-point norm of C(x,y,z)/ρ³', () => everySeed((index, lang, f) => {
    const card = getCard(54, index, lang, 'radial-mag');
    const p = card.audit!.params as Record<string, number>;
    auditIs(card, 'MIT-MV-54:radial-mag', { C: p.C, x: p.x, y: p.y, z: p.z }, `seed ${index} ${lang}`, f);
    const { C, x, y, z } = p;
    f.ok(Number.isInteger(C) && C >= 1 && C <= 6, `seed ${index}: C ${C}`);
    const r2 = x * x + y * y + z * z;
    f.ok([9, 36, 49].includes(r2), `seed ${index}: ρ² ${r2} outside {9,36,49}`);
    const rho = Math.sqrt(r2);
    const mag = Math.hypot(C * x / rho ** 3, C * y / rho ** 3, C * z / rho ** 3);
    f.ok(near(mag, Math.abs(C) / r2), `seed ${index}: norm route ${mag} vs C/ρ² ${Math.abs(C) / r2}`);
    gradeNumeric(card, [mag], 1e-9, `seed ${index} ${lang} radial-mag`, f);
  }));

  it('field-id: the right-hand-rule field is the only match', () => everySeed((index, lang, f) => {
    const card = getCard(54, index, lang, 'field-id'), en = getCard(54, index, 'en', 'field-id');
    const m = clean(en.prompt).match(/about the (z|y)-axis[\s\S]*?ω = ([\d.]+)/);
    f.ok(m, `seed ${index}: cannot parse field-id prompt: ${en.prompt}`);
    if (!m) return;
    const axis = m[1], W = Number(m[2]);
    f.ok(W >= 2 && W <= 7, `seed ${index}: W ${W}`);
    const expected = axis === 'z' ? (x: number, y: number, z: number): [number, number, number] => [-W * y, W * x, 0]
      : (x: number, y: number, z: number): [number, number, number] => [W * z, 0, -W * x];
    const pts: [number, number, number][] = [[1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 2, 3]];
    choiceCheck(card, o => { const F = tripleFn(o); return pts.every(([x, y, z]) => { const g = F(x, y, z), e = expected(x, y, z); return near(g[0], e[0]) && near(g[1], e[1]) && near(g[2], e[2]); }); }, `seed ${index} ${lang} field-id axis=${axis} W=${W}`, f);
  }));

  it('grav-setup: bounds π/2, a and integrand ρ cos²φ sinφ integrate to π a²/3', () => everySeed((index, lang, f) => {
    const card = getCard(54, index, lang, 'grav-setup');
    const a = num((lang === 'en' ? rx(card.prompt, /radius (\d+)/, 'a') : rx(card.prompt, /半径为 (\d+)/, 'a'))[1], 'a');
    f.ok(a >= 2 && a <= 7, `seed ${index}: a ${a}`);
    const expected = ['π/2', `${a}`, 'ρ cos² φ sin φ'];
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(expected), `seed ${index}: answers ${JSON.stringify(card.slots!.answers)} vs ${JSON.stringify(expected)}`);
    const planTokens = ['π/2', 'π', 'π/4', `${a}`, `${a * a}`, 'ρ cos² φ sin φ', 'cos² φ sin φ / ρ', 'ρ cos φ sin φ', 'ρ² cos² φ sin φ'];
    f.ok(JSON.stringify([...card.slots!.tokens].sort()) === JSON.stringify([...planTokens].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)} vs plan`);
    const truth = PI * a * a / 3;
    const integral = (v: string[]) => 2 * PI * gauss(phi => gauss(rho => ev(v[2], { ρ: rho, φ: phi }), 0, ev(v[1]), 3), 0, ev(v[0]), 120);
    checkSlots(card, truth, integral, 1e-6, `seed ${index} ${lang} grav-setup a=${a}`, f);
  }));

  it('grav-value: k = (1/π)∫₀^a 2π(z − z²/a) dz (cylindrical)', () => everySeed((index, lang, f) => {
    const card = getCard(54, index, lang, 'grav-value');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-54:grav-value', { a: p.a }, `seed ${index} ${lang}`, f);
    const a = p.a; f.ok(a >= 2 && a <= 7, `seed ${index}: a ${a}`);
    const k = simpson(z => 2 * PI * (z - z * z / a), 0, a, 400) / PI;
    f.ok(near(k, a * a / 3, 1e-9), `seed ${index}: route ${k} vs a²/3`);
    gradeNumeric(card, [k], 1e-9, `seed ${index} ${lang} grav-value a=${a}`, f);
  }));

  it('orientation: inward flux = −Φ', () => everySeed((index, lang, f) => {
    const card = getCard(54, index, lang, 'orientation');
    const m = clean(card.prompt).match(lang === 'en' ? /flux (-?\d+)/ : /为 (-?\d+)/);
    f.ok(m, `seed ${index} ${lang}: cannot parse Φ: ${card.prompt}`);
    if (!m) return;
    const Phi = Number(m[1]); f.ok([-12, -8, -5, 5, 8, 12].includes(Phi) && Phi !== 0, `seed ${index}: Φ ${Phi}`);
    choiceCheck(card, o => near(ev(o), -Phi), `seed ${index} ${lang} orientation Φ=${Phi}`, f);
  }));

  it('hemi-setup: (F·n) × (area) = R · 2R²π = 2R³π', () => everySeed((index, lang, f) => {
    const card = getCard(54, index, lang, 'hemi-setup');
    const R = num(rx(card.prompt, /(\d+)²/, 'R')[1], 'R');
    f.ok(R >= 2 && R <= 7, `seed ${index}: R ${R}`);
    const expected = [`${R}`, `${2 * R * R}π`];
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(expected), `seed ${index}: answers ${JSON.stringify(card.slots!.answers)} vs ${JSON.stringify(expected)}`);
    const planTokens = ['1', `${R}`, `${R * R}`, `${2 * R * R}π`, `${4 * R * R}π`, `${R * R}π`];
    f.ok(JSON.stringify([...card.slots!.tokens].sort()) === JSON.stringify([...planTokens].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)} vs plan`);
    const truth = 2 * R ** 3 * PI;
    checkSlots(card, truth, v => ev(v[0]) * ev(v[1]), 1e-9, `seed ${index} ${lang} hemi-setup R=${R}`, f);
  }));

  it('hemi-flux: hemisphere surface integral of k(x,y,z)', () => everySeed((index, lang, f) => {
    const card = getCard(54, index, lang, 'hemi-flux');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-54:hemi-flux', { k: p.k, R: p.R }, `seed ${index} ${lang}`, f);
    const { k, R } = p; f.ok([2, 3, 4].includes(k) && [2, 3, 4, 5].includes(R), `seed ${index}: k ${k} R ${R}`);
    const flux = sphereSurface((x, y, z) => [k * x, k * y, k * z], R, PI / 2);
    f.ok(rel(flux / PI, 2 * k * R ** 3, 1e-4), `seed ${index}: route K ${flux / PI} vs 2kR³ ${2 * k * R ** 3}`);
    gradeNumeric(card, [flux / PI], 1e-4, `seed ${index} ${lang} hemi-flux k=${k} R=${R}`, f);
  }));

  it('plane-null: flux is 0 (F parallel to the plane)', () => everySeed((index, lang, f) => {
    const card = getCard(54, index, lang, 'plane-null');
    choiceCheck(card, o => Math.abs(ev(o)) < 1e-9, `seed ${index} ${lang} plane-null`, f);
  }));

  it('challenge: sphere flux of c(x,y,z)/ρ³ = 4πc', () => everySeed((index, lang, f) => {
    const card = getCard(54, index, lang, 'challenge');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-54:challenge', { c: p.c, R: p.R }, `seed ${index} ${lang}`, f);
    const { c, R } = p; f.ok(c >= 1 && c <= 6 && [2, 3, 4, 5].includes(R), `seed ${index}: c ${c} R ${R}`);
    const F = (x: number, y: number, z: number): [number, number, number] => { const r = (x * x + y * y + z * z) ** 1.5; return [c * x / r, c * y / r, c * z / r]; };
    const flux = sphereSurface(F, R);
    f.ok(rel(flux / PI, 4 * c, 1e-4), `seed ${index}: route K ${flux / PI} vs 4c ${4 * c}`);
    gradeNumeric(card, [flux / PI], 1e-4, `seed ${index} ${lang} challenge c=${c} R=${R}`, f);
  }));

  it('explanations state the accepted answer', () => {
    const { explanationsOf } = makeExplanations(54, ['radial-mag', 'grav-value', 'hemi-flux', 'challenge']);
    explanationsOf();
  });

  it('variety', () => {
    for (const slug of ['radial-mag', 'field-id', 'grav-setup', 'grav-value', 'orientation', 'hemi-setup', 'hemi-flux', 'plane-null', 'challenge'])
      expect(distinctCount(54, slug, slug === 'field-id' || slug === 'orientation' || slug === 'plane-null' ? fullKey : plainKey), slug).toBeGreaterThanOrEqual(6);
  });
});
// ---------- explanations must state the accepted answer ----------
const escapeRe = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function statedCandidates(v: number): string[] {
  const c = exactString(v).replaceAll('pi', 'π').replace(/^(-?)1π/, '$1π');
  const out = [c];
  const m = c.match(/^(-?\d+)(?:\/(\d+))?$/);
  if (m) { const p = Number(m[1]), q = m[2] ? Number(m[2]) : 1; const top = p === 1 ? 'π' : p === -1 ? '-π' : `${p}π`; out.push(q === 1 ? top : `${top}/${q}`); }
  return out;
}
function explanationStates(card: PracticeCard, v: number, where: string, f: Fails) {
  const text = clean(card.explanation);
  const hit = statedCandidates(v).some(c => new RegExp(`(?<![\\d/π.])${escapeRe(c)}(?![\\d/π]|\\.\\d)`).test(text));
  f.ok(hit, `${where}: explanation does not state ${statedCandidates(v).join(' or ')}: "${card.explanation.slice(-140)}"`);
}
function makeExplanations(game: number, slugs: string[]) {
  return {
    explanationsOf: () => everySeed((index, lang, f) => {
      for (const slug of slugs) {
        const card = getCard(game, index, lang, slug);
        card.fields!.forEach((field, i) => explanationStates(card, field.answer, `seed ${index} ${lang} ${slug} field ${i}`, f));
      }
    }),
  };
}

// ======================================================================================================
// MIT-MV-55
// ======================================================================================================
/** Paraboloid surface/coefficient from the printed question. */
function parseParaboloid(text: string): { dome: boolean; p: number; H: number } {
  const t = clean(text);
  const dome = /z = \d+ - /.test(t);
  const hMatch = t.match(/z = (\d+) - /);
  let m = dome ? t.match(/- ?(\d*)\(?x²/) : t.match(/z = (\d*)\(x²/);
  if (!m) m = t.match(/- ?(\d*)x²/);
  const p = m && m[1] !== '' ? Number(m[1]) : 1;
  return { dome, p, H: hMatch ? Number(hMatch[1]) : NaN };
}

describe('MIT-MV-55 oracle', () => {
  it('deck: kinds, order, language, end sentence', () => everySeed((index, lang, f) => {
    deckChecks(55, ['ndS-graph', 'side-choice', 'ndS-implicit', 'dome-setup', 'cylinder-setup', 'cylinder-flux', 'sphere-setup', 'sphere-flux', 'challenge'], END_55, f, index, lang,
      ['MIT-MV-55:ndS-graph', 'MIT-MV-55:ndS-implicit', 'MIT-MV-55:cylinder-flux', 'MIT-MV-55:sphere-flux', 'MIT-MV-55:challenge']);
  }));

  it('ndS-graph: A, B = −f_x, −f_y by central differences', () => everySeed((index, lang, f) => {
    const card = getCard(55, index, lang, 'ndS-graph');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-55:ndS-graph', { a: p.a, b: p.b, c: p.c, x0: p.x0, y0: p.y0 }, `seed ${index} ${lang}`, f);
    const { a, b, c, x0, y0 } = p;
    f.ok([1, 2, 3].includes(a) && [1, 2, 3].includes(b) && [1, 2, 3].includes(c) && [1, 2, 3].includes(x0) && [1, 2, 3].includes(y0), `seed ${index}: params ${JSON.stringify(p)}`);
    const fxy = (x: number, y: number) => a * x * x + b * x * y + c * y;
    const h = 1e-5;
    const A = -(fxy(x0 + h, y0) - fxy(x0 - h, y0)) / (2 * h);
    const B = -(fxy(x0, y0 + h) - fxy(x0, y0 - h)) / (2 * h);
    f.ok(near(A, -(2 * a * x0 + b * y0), 1e-6) && near(B, -(b * x0 + c), 1e-6), `seed ${index}: diff route ${A},${B}`);
    gradeNumeric(card, [A, B], 1e-6, `seed ${index} ${lang} ndS-graph`, f);
  }));

  it('side-choice: only the stated side matches', () => everySeed((index, lang, f) => {
    const card = getCard(55, index, lang, 'side-choice'), en = getCard(55, index, 'en', 'side-choice');
    const { dome, p } = parseParaboloid(en.prompt);
    const t = clean(en.prompt);
    const outward = /away from the z-axis/.test(t), up = /points up|positive z-component/.test(t), down = /points down|negative z-component/.test(t);
    f.ok(outward !== (up || down) || (up !== down), `seed ${index}: ambiguous side in "${en.prompt}"`);
    let A: number, B: number, C: number;
    if (!dome) { if (outward) { A = 2 * p; B = 2 * p; C = -1; } else { A = -2 * p; B = -2 * p; C = 1; } }
    else { if (outward) { A = 2 * p; B = 2 * p; C = 1; } else { A = -2 * p; B = -2 * p; C = -1; } }
    const pts: [number, number][] = [[1, 0], [0, 1], [1, 1], [2, 3]];
    choiceCheck(card, o => { const F = tripleFn(o); return pts.every(([x, y]) => { const g = F(x, y, 0); return near(g[0], A * x) && near(g[1], B * y) && near(g[2], C); }); },
      `seed ${index} ${lang} side-choice dome=${dome} p=${p} outward=${outward} up=${up}`, f);
  }));

  it('ndS-implicit: A, B = x0/z0, y0/z0 by central differences of the graph', () => everySeed((index, lang, f) => {
    const card = getCard(55, index, lang, 'ndS-implicit');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-55:ndS-implicit', { a: p.a, x0: p.x0, y0: p.y0, z0: p.z0 }, `seed ${index} ${lang}`, f);
    const { a, x0, y0, z0 } = p;
    f.ok(z0 > 0 && near(a * a, x0 * x0 + y0 * y0 + z0 * z0), `seed ${index}: a² ${a * a} vs ${x0 * x0 + y0 * y0 + z0 * z0}`);
    const g = (x: number, y: number) => Math.sqrt(a * a - x * x - y * y);
    const h = 1e-6;
    const A = -(g(x0 + h, y0) - g(x0 - h, y0)) / (2 * h);
    const B = -(g(x0, y0 + h) - g(x0, y0 - h)) / (2 * h);
    f.ok(near(A, x0 / z0, 1e-5) && near(B, y0 / z0, 1e-5), `seed ${index}: diff route ${A},${B} vs ${x0 / z0},${y0 / z0}`);
    gradeNumeric(card, [A, B], 1e-5, `seed ${index} ${lang} ndS-implicit`, f);
  }));

  it('dome-setup: n dS = (2x, 2y, 1) and the integrand 4x²+4y²+(c−2H) integrates to cHπ', () => everySeed((index, lang, f) => {
    const card = getCard(55, index, lang, 'dome-setup');
    const { H, c } = { H: num(rx(card.prompt, /z = (\d+) - x²/, 'H')[1], 'H'), c: num(rx(card.prompt, /\((\d+) - 2z\)/, 'c')[1], 'c') };
    const slots = card.slots!;
    f.ok(slots.answers.length === 3 && slots.between!.length === 2, `seed ${index}: slot structure ${JSON.stringify(slots)}`);
    // A valid n dS component is the pure linear monomial 2x (resp. 2y): value 0 at the origin,
    // coefficient 2 on its own axis, no dependence on the other variable (an integrand that still
    // contains z, a quadratic or a constant fails one of these).
    const suitable = (tok: string, axis: 'x' | 'y'): boolean => {
      try {
        const own = axis === 'x' ? { x: 1, y: 0 } : { x: 0, y: 1 };
        const other = axis === 'x' ? { x: 0, y: 1 } : { x: 1, y: 0 };
        return ev(tok, { x: 0, y: 0 }) === 0 && ev(tok, own) === 2 && ev(tok, other) === 0;
      } catch { return false; }
    };
    f.ok(suitable(slots.answers[0], 'x'), `seed ${index} ${lang}: slot 0 = ${slots.answers[0]} (want 2x)`);
    f.ok(suitable(slots.answers[1], 'y'), `seed ${index} ${lang}: slot 1 = ${slots.answers[1]} (want 2y)`);
    f.ok(slots.tokens.filter(tok => suitable(tok, 'x')).length === 1 && slots.tokens.filter(tok => suitable(tok, 'y')).length === 1, `seed ${index}: n dS slot not unique in ${JSON.stringify(slots.tokens)}`);
    const truth = PI * c * H;
    const integrand = (tok: string): number => { try { return midgrid2((r, th) => ev(tok, { x: r * Math.cos(th), y: r * Math.sin(th) }) * r, 0, Math.sqrt(H), 0, 2 * PI, 120); } catch { return NaN; } };
    f.ok(rel(integrand(slots.answers[2]), truth, 1e-3), `seed ${index}: integrand ${slots.answers[2]} -> ${integrand(slots.answers[2])} vs ${truth}`);
    for (const tok of slots.tokens) if (tok !== slots.answers[2]) f.ok(!rel(integrand(tok), truth, 1e-3), `seed ${index}: token "${tok}" also integrates to ${truth}`);
  }));

  it('cylinder-setup: F·n, dS = a dz dθ, θ to π/2 give the cylinder flux a h (a+h)/2', () => everySeed((index, lang, f) => {
    const card = getCard(55, index, lang, 'cylinder-setup');
    const a = num(rx(card.prompt, /x² \+ y² = (\d+)²/, 'a')[1], 'a'), h = num(rx(card.prompt, /z ≤ (\d+)/, 'h')[1], 'h');
    const expected = [`z cos θ + ${a} sin θ cos θ`, `${a}`, 'π/2'];
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(expected), `seed ${index}: answers ${JSON.stringify(card.slots!.answers)} vs ${JSON.stringify(expected)}`);
    const planTokens = [`z cos θ + ${a} sin θ cos θ`, `${a}z cos θ + ${a * a} sin θ cos θ`, 'z cos θ + sin θ cos θ', `${a}`, '1', `${h}`, 'π/2', 'π', '2π'];
    f.ok(JSON.stringify([...card.slots!.tokens].sort()) === JSON.stringify([...planTokens].sort()), `seed ${index} ${lang}: tokens vs plan`);
    const truth = a * h * (a + h) / 2;
    const integral = (v: string[]) => midgrid2((z, th) => ev(v[0], { z, θ: th }) * ev(v[1]), 0, h, 0, ev(v[2]), 160);
    checkSlots(card, truth, integral, 1e-4, `seed ${index} ${lang} cylinder-setup a=${a} h=${h}`, f);
  }));

  it('cylinder-flux: midpoint grid over (θ, z)', () => everySeed((index, lang, f) => {
    const card = getCard(55, index, lang, 'cylinder-flux');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-55:cylinder-flux', { a: p.a, h: p.h }, `seed ${index} ${lang}`, f);
    const { a, h } = p;
    const flux = midgrid2((th, z) => (z * Math.cos(th) + a * Math.sin(th) * Math.cos(th)) * a, 0, PI / 2, 0, h, 200);
    f.ok(rel(flux, a * h * (a + h) / 2, 1e-4), `seed ${index}: route ${flux} vs ${a * h * (a + h) / 2}`);
    gradeNumeric(card, [flux], 1e-4, `seed ${index} ${lang} cylinder-flux a=${a} h=${h}`, f);
  }));

  it('sphere-setup: k a² cos φ and k a⁴ cos φ sin φ integrate to k a⁴ π/4', () => everySeed((index, lang, f) => {
    const card = getCard(55, index, lang, 'sphere-setup');
    const k = num(rx(card.prompt, /F = (\d+)\(/, 'k')[1], 'k'), a = num(rx(card.prompt, /z² = (\d+)²/, 'a')[1], 'a');
    const expected = [`${k * a * a} cos φ`, `${k * a ** 4} cos φ sin φ`];
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(expected), `seed ${index}: answers ${JSON.stringify(card.slots!.answers)} vs ${JSON.stringify(expected)}`);
    const planTokens = [`${k * a * a} cos φ`, `${k * a} cos φ`, `${a * a} cos φ`, `${k * a * a} sin φ`, `${k * a ** 4} cos φ sin φ`, `${k * a * a} cos φ sin φ`, `${k * a ** 4} cos² φ sin φ`, `${a ** 4} cos φ sin φ`];
    f.ok(JSON.stringify([...card.slots!.tokens].sort()) === JSON.stringify([...planTokens].sort()), `seed ${index} ${lang}: tokens vs plan`);
    // F·n × dS must equal F·n dS
    for (const phi of [0.3, 0.9, 1.3]) f.ok(near(ev(card.slots!.answers[0], { φ: phi }) * a * a * Math.sin(phi), ev(card.slots!.answers[1], { φ: phi }), 1e-9), `seed ${index}: F·n × dS ≠ F·n dS at φ=${phi}`);
    const truth = k * a ** 4 * PI / 4;
    // The card has two slots that must be consistent: slot 0 is F·n, slot 1 is F·n dS = (F·n)·a² sinφ.
    // The assembled value is the flux ∫ F·n dS, but we reject (NaN) any pair where the relation fails,
    // so substituting a wrong token into EITHER slot is detected.
    const integral = (v: string[]) => {
      for (const phi of [0.2, 0.7, 1.2]) {
        const lhs = ev(v[0], { φ: phi }) * a * a * Math.sin(phi);
        const rhs = ev(v[1], { φ: phi });
        if (!near(lhs, rhs, 1e-9)) return NaN;
      }
      return midgrid2((phi, _th) => ev(v[1], { φ: phi }), 0, PI / 2, 0, PI / 2, 200);
    };
    checkSlots(card, truth, integral, 1e-4, `seed ${index} ${lang} sphere-setup k=${k} a=${a}`, f);
  }));

  it('sphere-flux: surface integral of k(xz, yz, z²) = k a⁴ π/4', () => everySeed((index, lang, f) => {
    const card = getCard(55, index, lang, 'sphere-flux');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-55:sphere-flux', { k: p.k, a: p.a }, `seed ${index} ${lang}`, f);
    const { k, a } = p; f.ok([2, 3, 4].includes(k) && [2, 4, 6].includes(a), `seed ${index}: k ${k} a ${a}`);
    const flux = sphereSurface((x, y, z) => [k * x * z, k * y * z, k * z * z], a, PI / 2);
    // restrict to the first octant: theta in [0, pi/2] is a quarter of the phi-hemisphere integral
    const octant = flux / 4;
    f.ok(rel(octant / PI, k * a ** 4 / 4, 1e-4), `seed ${index}: route K ${octant / PI} vs ${k * a ** 4 / 4}`);
    gradeNumeric(card, [octant / PI], 1e-4, `seed ${index} ${lang} sphere-flux k=${k} a=${a}`, f);
  }));

  it('challenge: bowl flux by polar midpoint = H(2H−c)π', () => everySeed((index, lang, f) => {
    const card = getCard(55, index, lang, 'challenge');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-55:challenge', { c: p.c, H: p.H }, `seed ${index} ${lang}`, f);
    const { c, H } = p; f.ok(H >= 1 && H <= 3 && c >= 1 && c <= 5 && c !== 2 * H, `seed ${index}: c ${c} H ${H}`);
    const fluxNum = midgrid2((th, r) => { const x = r * Math.cos(th), y = r * Math.sin(th); const F = [x, y, c - 2 * r * r]; const n = [2 * x, 2 * y, -1]; return (F[0] * n[0] + F[1] * n[1] + F[2] * n[2]) * r; }, 0, 2 * PI, 0, Math.sqrt(H), 200);
    f.ok(rel(fluxNum / PI, H * (2 * H - c), 1e-4), `seed ${index}: route K ${fluxNum / PI} vs ${H * (2 * H - c)}`);
    gradeNumeric(card, [fluxNum / PI], 1e-4, `seed ${index} ${lang} challenge55 c=${c} H=${H}`, f);
  }));

  it('explanations state the accepted answer', () => makeExplanations(55, ['ndS-graph', 'ndS-implicit', 'cylinder-flux', 'sphere-flux', 'challenge']).explanationsOf());

  it('variety', () => {
    for (const slug of ['ndS-graph', 'side-choice', 'ndS-implicit', 'dome-setup', 'cylinder-setup', 'cylinder-flux', 'sphere-setup', 'sphere-flux', 'challenge'])
      expect(distinctCount(55, slug, ['side-choice', 'dome-setup'].includes(slug) ? fullKey : plainKey), slug).toBeGreaterThanOrEqual(6);
  });
});
// ======================================================================================================
// MIT-MV-56
// ======================================================================================================
describe('MIT-MV-56 oracle', () => {
  it('deck: kinds, order, language, end sentence', () => everySeed((index, lang, f) => {
    const faceKind = getCard(56, index, lang, 'face-flux').audit!.kind;
    deckChecks(56, ['div-of-f', 'closed-or-open', 'face-flux', 'theorem-setup', 'box-flux', 'sphere-flux', 'closed-setup', 'cap-flux', 'challenge'], END_56, f, index, lang,
      ['MIT-MV-56:div-of-f', faceKind, 'MIT-MV-56:box-flux', 'MIT-MV-56:sphere-flux', 'MIT-MV-56:cap-flux', 'MIT-MV-56:challenge']);
  }));

  it('div-of-f: ∂M/∂x + ∂N/∂y + ∂P/∂z by central differences', () => everySeed((index, lang, f) => {
    const card = getCard(56, index, lang, 'div-of-f');
    const p = card.audit!.params as Record<string, number>;
    auditIs(card, 'MIT-MV-56:div-of-f', { a: p.a, b: p.b, c: p.c, d: p.d, e: p.e, x0: p.x0, y0: p.y0, z0: p.z0 }, `seed ${index} ${lang}`, f);
    const { a, b, c, d, e, x0, y0, z0 } = p;
    f.ok([1, 2, 3].includes(a) && [1, 2, 3].includes(b) && [1, 2, 3].includes(c) && [1, 2, 3].includes(d) && [1, 2, 3].includes(Math.abs(e)) && [1, 2, 3].includes(x0) && [1, 2, 3].includes(y0) && [1, 2, 3].includes(z0), `seed ${index}: params ${JSON.stringify(p)}`);
    const h = 1e-3;
    const div = (a * ((x0 + h) ** 2 - (x0 - h) ** 2) / (2 * h)) + (d * ((y0 + h) ** 2 - (y0 - h) ** 2) / (2 * h)) + e;
    f.ok(near(div, 2 * a * x0 + 2 * d * y0 + e, 1e-6), `seed ${index}: diff route ${div}`);
    gradeNumeric(card, [div], 1e-6, `seed ${index} ${lang} div-of-f`, f);
  }));

  it('closed-or-open: exactly one option names a closed surface', () => everySeed((index, lang, f) => {
    const card = getCard(56, index, lang, 'closed-or-open');
    choiceCheck(card, o => lang === 'en' ? /surface of a (ball|cube)|torus/.test(o) : /球的表面|立方体的表面|环面/.test(clean(o)), `seed ${index} ${lang} closed-or-open`, f);
  }));

  it('face-flux: one face of the box (z = r, y = q or x = p)', () => everySeed((index, lang, f) => {
    const card = getCard(56, index, lang, 'face-flux');
    const p = card.audit!.params as Record<string, number>;
    const kind = card.audit!.kind.slice('MIT-MV-56:face-flux-'.length);
    auditIs(card, `MIT-MV-56:face-flux-${kind}`, { m: p.m, n: p.n, l: p.l, p: p.p, q: p.q, r: p.r }, `seed ${index} ${lang}`, f);
    const { m, n, l } = p, P = p.p, Q = p.q, R = p.r;
    let flux: number;
    if (kind === 'z') flux = midgrid2(() => l * R, 0, P, 0, Q, 60);
    else if (kind === 'y') flux = midgrid2(() => n * Q, 0, P, 0, R, 60);
    else flux = midgrid2(() => m * P, 0, Q, 0, R, 60);
    f.ok(near(flux, (kind === 'z' ? l * P * Q * R : kind === 'y' ? n * P * Q * R : m * P * Q * R), 1e-9), `seed ${index}: face route ${flux}`);
    gradeNumeric(card, [flux], 1e-9, `seed ${index} ${lang} face-flux-${kind}`, f);
  }));

  it('theorem-setup: integrand div F, value m+n+l, volume pqr', () => everySeed((index, lang, f) => {
    const card = getCard(56, index, lang, 'theorem-setup');
    const F = tripleFn(rx(card.prompt, /F = (\([^)]*\))/, 'F')[1]);
    const m = F(1, 0, 0)[0], n = F(0, 1, 0)[1], l = F(0, 0, 1)[2];
    const box = rx(card.prompt, /0 ≤ x ≤ (\d+)[^]*?0 ≤ y ≤ (\d+)[^]*?0 ≤ z ≤ (\d+)/, 'box').slice(1).map(Number);
    const [P, Q, R] = box;
    const slots = card.slots!;
    f.ok(clean(slots.answers[0]) === 'div F', `seed ${index} ${lang}: integrand ${slots.answers[0]}`);
    f.ok(ev(slots.answers[1]) === m + n + l, `seed ${index}: slot 1 ${slots.answers[1]} vs ${m + n + l}`);
    f.ok(ev(slots.answers[2]) === P * Q * R, `seed ${index}: slot 2 ${slots.answers[2]} vs ${P * Q * R}`);
    const flux = (m + n + l) * P * Q * R;
    f.ok(ev(slots.answers[1]) * ev(slots.answers[2]) === flux, `seed ${index}: product ${ev(slots.answers[1]) * ev(slots.answers[2])} vs box flux ${flux}`);
    const numeric = slots.tokens.filter(tok => /^\d+$/.test(clean(tok).trim()));
    f.ok(numeric.filter(tok => Number(clean(tok)) === m + n + l).length === 1, `seed ${index}: m+n+l not unique among tokens ${JSON.stringify(numeric)}`);
    f.ok(numeric.filter(tok => Number(clean(tok)) === P * Q * R).length === 1, `seed ${index}: pqr not unique among tokens ${JSON.stringify(numeric)}`);
  }));

  it('box-flux: sum of the six outward face integrals', () => everySeed((index, lang, f) => {
    const card = getCard(56, index, lang, 'box-flux');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-56:box-flux', { m: p.m, n: p.n, l: p.l, p: p.p, q: p.q, r: p.r }, `seed ${index} ${lang}`, f);
    const { m, n, l } = p, P = p.p, Q = p.q, R = p.r;
    const flux = m * P * Q * R + n * P * Q * R + l * P * Q * R;
    f.ok(near(flux, (m + n + l) * P * Q * R, 1e-9), `seed ${index}: face sum ${flux}`);
    gradeNumeric(card, [flux], 1e-9, `seed ${index} ${lang} box-flux`, f);
  }));

  it('sphere-flux: ∫∫ F·(r_φ×r_θ) = 4(m+n+l)a³π/3', () => everySeed((index, lang, f) => {
    const card = getCard(56, index, lang, 'sphere-flux');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-56:sphere-flux', { m: p.m, n: p.n, l: p.l, a: p.a }, `seed ${index} ${lang}`, f);
    const { m, n, l, a } = p;
    const flux = sphereSurface((x, y, z) => [m * x, n * y, l * z], a);
    f.ok(rel(flux / PI, 4 * (m + n + l) * a ** 3 / 3, 1e-4), `seed ${index}: route K ${flux / PI} vs ${4 * (m + n + l) * a ** 3 / 3}`);
    gradeNumeric(card, [flux / PI], 1e-4, `seed ${index} ${lang} sphere-flux`, f);
  }));

  it('closed-setup: normal −k, integrand div F, sign +', () => everySeed((index, lang, f) => {
    const card = getCard(56, index, lang, 'closed-setup');
    const slots = card.slots!;
    f.ok(clean(slots.answers[0]) === '-k', `seed ${index} ${lang}: slot 0 ${slots.answers[0]}`);
    f.ok(clean(slots.answers[1]) === 'div F', `seed ${index} ${lang}: slot 1 ${slots.answers[1]}`);
    f.ok(clean(slots.answers[2]) === '+', `seed ${index} ${lang}: slot 2 ${slots.answers[2]}`);
    const planTokens = ['−k', 'k', '(2x, 2y, 1)', 'div F', 'curl F', '|F|', '+', '−'].map(clean);
    f.ok(JSON.stringify([...slots.tokens].map(clean).sort()) === JSON.stringify([...planTokens].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(slots.tokens)} vs plan`);
    f.ok(new Set(slots.tokens).size === slots.tokens.length, `seed ${index}: duplicate tokens`);
  }));

  it('cap-flux: upward flux through z = h − x² − y² equals c h π', () => everySeed((index, lang, f) => {
    const card = getCard(56, index, lang, 'cap-flux');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-56:cap-flux', { c: p.c, d: p.d, e: p.e, h: p.h }, `seed ${index} ${lang}`, f);
    const { c, d, e, h } = p;
    const flux = midgrid2((th, r) => { const x = r * Math.cos(th), y = r * Math.sin(th), z = h - r * r; const F = [d * y * z, e * x * z, c + x * y]; return (F[0] * 2 * x + F[1] * 2 * y + F[2]) * r; }, 0, 2 * PI, 0, Math.sqrt(h), 200);
    f.ok(rel(flux / PI, c * h, 1e-4), `seed ${index}: route K ${flux / PI} vs ${c * h}`);
    gradeNumeric(card, [flux / PI], 1e-4, `seed ${index} ${lang} cap-flux`, f);
  }));

  it('challenge: upward flux with a source equals c h² π/2', () => everySeed((index, lang, f) => {
    const card = getCard(56, index, lang, 'challenge');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-56:challenge', { c: p.c, d: p.d, e: p.e, h: p.h }, `seed ${index} ${lang}`, f);
    const { c, d, e, h } = p;
    const flux = midgrid2((th, r) => { const x = r * Math.cos(th), y = r * Math.sin(th), z = h - r * r; const F = [d * y * z, e * x * z, c * z + x * y]; return (F[0] * 2 * x + F[1] * 2 * y + F[2]) * r; }, 0, 2 * PI, 0, Math.sqrt(h), 200);
    f.ok(rel(flux / PI, c * h * h / 2, 1e-4), `seed ${index}: route K ${flux / PI} vs ${c * h * h / 2}`);
    gradeNumeric(card, [flux / PI], 1e-4, `seed ${index} ${lang} challenge56`, f);
  }));

  it('explanations state the accepted answer', () => makeExplanations(56, ['div-of-f', 'face-flux', 'box-flux', 'sphere-flux', 'cap-flux', 'challenge']).explanationsOf());

  it('variety', () => {
    for (const slug of ['div-of-f', 'closed-or-open', 'face-flux', 'theorem-setup', 'box-flux', 'sphere-flux', 'closed-setup', 'cap-flux', 'challenge'])
      expect(distinctCount(56, slug, ['closed-or-open', 'theorem-setup', 'closed-setup'].includes(slug) ? fullKey : plainKey), slug).toBeGreaterThanOrEqual(6);
  });
});
// ======================================================================================================
// MIT-MV-57
// ======================================================================================================
/** Average of u over the sphere of radius R centred at the origin, by Simpson on (phi, theta). */
function sphereAverage(u: (x: number, y: number, z: number) => number, R: number): number {
  // Single-panel 5-point Gauss-Legendre in each angle: exact (to machine precision) for the
  // degree-2 polynomials used here, where a midpoint grid only reaches ~1e-4.
  const at = (phi: number, th: number) => u(R * Math.sin(phi) * Math.cos(th), R * Math.sin(phi) * Math.sin(th), R * Math.cos(phi)) * Math.sin(phi);
  const inner = (th: number) => gauss(phi => at(phi, th), 0, PI, 40);
  return gauss(th => inner(th), 0, 2 * PI, 40) / (4 * PI);
}

describe('MIT-MV-57 oracle', () => {
  it('deck: kinds, order, language, end sentence', () => everySeed((index, lang, f) => {
    deckChecks(57, ['component', 'simple-check', 'lower-setup', 'lower-flux', 'cut-cancel', 'pde-name', 'sphere-bounds', 'non-harmonic', 'challenge'], END_57, f, index, lang,
      ['MIT-MV-57:lower-flux', 'MIT-MV-57:non-harmonic', 'MIT-MV-57:challenge']);
  }));

  it('component: only ∂P/∂z = cγ x^α z^(γ−1) matches', () => everySeed((index, lang, f) => {
    const card = getCard(57, index, lang, 'component'), en = getCard(57, index, 'en', 'component');
    const m = clean(en.prompt).match(/P = (\d+)x(²)?z(²|³)/);
    f.ok(m, `seed ${index}: cannot parse component prompt: ${en.prompt}`);
    if (!m) return;
    const c = Number(m[1]), alpha = m[2] ? 2 : 1, gamma = m[3] === '²' ? 2 : 3;
    f.ok([2, 3, 4, 5].includes(c) && [1, 2].includes(alpha) && [2, 3].includes(gamma), `seed ${index}: c ${c} α ${alpha} γ ${gamma}`);
    const expected = (x: number, z: number) => c * gamma * x ** alpha * z ** (gamma - 1);
    const pts: [number, number][] = [[2, 1], [1, 2], [3, 1], [2, 2]];
    choiceCheck(card, o => { const integrand = rx(o, /∭_D (.+?) dV/, 'integrand')[1]; return pts.every(([x, z]) => near(ev(integrand, { x, y: 0, z }), expected(x, z))); },
      `seed ${index} ${lang} component c=${c} α=${alpha} γ=${gamma}`, f);
  }));

  it('simple-check: Yes iff vertically simple', () => everySeed((index, lang, f) => {
    const card = getCard(57, index, lang, 'simple-check'), en = getCard(57, index, 'en', 'simple-check');
    const notSimple = /torus standing on its edge|horizontal tunnel/.test(en.prompt);
    const pred = (o: string) => {
      if (lang === 'en') return notSimple ? /four times/.test(o) : /exactly twice/.test(o);
      return notSimple ? /四次/.test(o) : /恰好与 S 相交两次|恰好.*两次/.test(clean(o));
    };
    choiceCheck(card, pred, `seed ${index} ${lang} simple-check notSimple=${notSimple}`, f);
  }));

  it('lower-setup: − ∬_R c(x²+y²) dx dy = −cH²π/2', () => everySeed((index, lang, f) => {
    const card = getCard(57, index, lang, 'lower-setup');
    const H = num(rx(card.prompt, /z = (\d+)/, 'H')[1], 'H');
    const c = num(rx(card.prompt, /P = (\d+)z/, 'c')[1], 'c');
    const expected = ['−', `${c}(x² + y²)`];
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(expected), `seed ${index}: answers ${JSON.stringify(card.slots!.answers)} vs ${JSON.stringify(expected)}`);
    const sign = (tok: string) => clean(tok).trim() === '-' ? -1 : clean(tok).trim() === '+' ? 1 : NaN;
    const value = (v: string[]) => sign(v[0]) * midgrid2((r, th) => ev(v[1], { x: r * Math.cos(th), y: r * Math.sin(th) }) * r, 0, Math.sqrt(H), 0, 2 * PI, 160);
    // When H = 2 the misconception token `{c}` (P's derivative, a bare constant) happens to integrate
    // to the same magnitude as `{c}(x²+y²)`: ∫_R c dA = cπH = cH²π/2. The card still grades the
    // string, so this numeric coincidence is not a defect (the plan keeps H = 2 as a valid draw).
    checkSlots(card, -c * H * H * PI / 2, value, 1e-3, `seed ${index} ${lang} lower-setup c=${c} H=${H}`, f,
      (i, tok) => { if (i !== 1 || H !== 2) return false; try { return ev(tok) === c; } catch { return false; } });
  }));

  it('lower-flux: downward flux through z = x² + y² equals −cH²π/2', () => everySeed((index, lang, f) => {
    const card = getCard(57, index, lang, 'lower-flux');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-57:lower-flux', { c: p.c, H: p.H }, `seed ${index} ${lang}`, f);
    const { c, H } = p; f.ok([2, 3, 4, 5].includes(c) && [2, 4, 6].includes(H), `seed ${index}: c ${c} H ${H}`);
    const flux = midgrid2((th, r) => (-c * r * r) * r, 0, 2 * PI, 0, Math.sqrt(H), 200);
    f.ok(rel(flux / PI, -c * H * H / 2, 1e-4), `seed ${index}: route K ${flux / PI} vs ${-c * H * H / 2}`);
    gradeNumeric(card, [flux / PI], 1e-4, `seed ${index} ${lang} lower-flux c=${c} H=${H}`, f);
  }));

  it('cut-cancel: the opposite-normals-cancel option is the only match', () => everySeed((index, lang, f) => {
    const card = getCard(57, index, lang, 'cut-cancel');
    choiceCheck(card, o => lang === 'en' ? /opposite normal vectors/.test(o) && /cancel/.test(o) : /相反/.test(clean(o)) && /抵消/.test(clean(o)), `seed ${index} ${lang} cut-cancel`, f);
  }));

  it('pde-name: the printed equation is named correctly', () => everySeed((index, lang, f) => {
    const card = getCard(57, index, lang, 'pde-name'), en = getCard(57, index, 'en', 'pde-name');
    const text = clean(en.prompt);
    const type = /∂t²/.test(text) ? 'wave' : /∂w\/∂t/.test(text) ? 'heat' : /=\s*0(?![.\d])/.test(text) ? 'laplace' : 'poisson';
    const names: Record<string, [string, string]> = { laplace: ['Laplace', '拉普拉斯'], poisson: ['Poisson', '泊松'], wave: ['Wave', '波'], heat: ['Heat', '热'] };
    if (type !== 'laplace') { const k = text.match(/=\s*(\d)xy|(?:1\/)(\d)²|1\/(\d)²/); f.ok(k, `seed ${index}: no constant in ${type} equation`); }
    choiceCheck(card, o => lang === 'en' ? o.startsWith(names[type][0]) : clean(o).startsWith(names[type][1]), `seed ${index} ${lang} pde-name type=${type}`, f);
  }));

  it('sphere-bounds: 1/(4π) × (θ 0..2π) × (φ 0..π) of sinφ = 1, and no other token set does', () => everySeed((index, lang, f) => {
    const card = getCard(57, index, lang, 'sphere-bounds');
    const expected = ['1/(4π)', '2π', '0', 'π'];
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(expected), `seed ${index}: answers ${JSON.stringify(card.slots!.answers)} vs ${JSON.stringify(expected)}`);
    const value = (v: string[]) => ev(v[0]) * ev(v[1]) * (Math.cos(ev(v[2])) - Math.cos(ev(v[3])));
    // The φ-lower slot is an angle; sin is 2π-periodic, so a token that differs from the answer by a
    // whole turn (2π) describes the same sphere and gives the same integral. The plan reuses 2π for θ.
    checkSlots(card, 1, value, 1e-9, `seed ${index} ${lang} sphere-bounds`, f,
      (i, tok) => i === 2 && Math.abs(ev(tok) / (2 * PI) - Math.round(ev(tok) / (2 * PI))) < 1e-9);
  }));

  it('non-harmonic: spherical average by Simpson = (a+b+c)R²/3 + d', () => everySeed((index, lang, f) => {
    const card = getCard(57, index, lang, 'non-harmonic');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-57:non-harmonic', { a: p.a, b: p.b, c: p.c, d: p.d, R: p.R }, `seed ${index} ${lang}`, f);
    const { a, b, c, d, R } = p; f.ok(d !== 0 && [2, 3, 4].includes(R), `seed ${index}: d ${d} R ${R}`);
    const avg = sphereAverage((x, y, z) => a * x * x + b * y * y + c * z * z + d, R);
    f.ok(rel(avg, (a + b + c) * R * R / 3 + d, 1e-4), `seed ${index}: route ${avg} vs ${(a + b + c) * R * R / 3 + d}`);
    gradeNumeric(card, [avg], 1e-4, `seed ${index} ${lang} non-harmonic`, f);
  }));

  it('challenge: average of the harmonic polynomial = p·q', () => everySeed((index, lang, f) => {
    const card = getCard(57, index, lang, 'challenge');
    const p = card.audit!.params as Record<string, number>; auditIs(card, 'MIT-MV-57:challenge', { p: p.p, q: p.q, c: p.c, R: p.R }, `seed ${index} ${lang}`, f);
    const { p: pp, q, c, R } = p;
    const avg = sphereAverage((x, y, z) => (x + pp) * (y + q) + c * (z * z - x * x), R);
    f.ok(rel(avg, pp * q, 1e-4), `seed ${index}: route ${avg} vs pq ${pp * q}`);
    gradeNumeric(card, [avg], 1e-4, `seed ${index} ${lang} challenge57`, f);
  }));

  it('explanations state the accepted answer', () => makeExplanations(57, ['lower-flux', 'non-harmonic', 'challenge']).explanationsOf());

  it('variety', () => {
    for (const slug of ['component', 'simple-check', 'lower-setup', 'lower-flux', 'cut-cancel', 'pde-name', 'sphere-bounds', 'non-harmonic', 'challenge'])
      expect(distinctCount(57, slug, ['component', 'simple-check', 'cut-cancel', 'pde-name', 'sphere-bounds'].includes(slug) ? fullKey : plainKey), slug).toBeGreaterThanOrEqual(6);
  });
});
