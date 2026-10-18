import { appendFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mv51 } from './games/mv51';
import { mv52 } from './games/mv52';
import { mv53 } from './games/mv53';
import { spreadSeed } from './deck-invariants';
import { simpson } from './oracle-harness';
import { gradeCard, type CardGenerator, type GameLanguage, type PracticeCard } from '../types';
import { figureProblems, type Figure, type FigureShape, type Pt } from '../figure';

/**
 * Acceptance oracle for MIT-MV-51, 52 and 53. Written from the approved plan (docs/mit-mv-drafts/approved-51-53.md)
 * without reading the generators. Every numeric answer is recomputed by a route that does not use the plan's closed form.
 */
vi.setConfig({ testTimeout: 180000 });
const SEEDS = 60;
const PI = Math.PI;
const SQ2 = Math.SQRT2;
type Lang = GameLanguage;
const LANGS: Lang[] = ['en', 'zh'];
const generators: Record<number, CardGenerator> = { 51: mv51, 52: mv52, 53: mv53 };

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

// ---------- numerics ----------
const clean = (text: string) => text.replaceAll('−', '-').replaceAll('·', '*').replaceAll(' ', ' ');
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const ptNear = (p: Pt, q: Pt, tol = 1e-9) => near(p[0], q[0], tol) && near(p[1], q[1], tol);
const memo = <A extends unknown[], R>(fn: (...args: A) => R) => { const m = new Map<string, R>(); return (...args: A): R => { const k = args.join(','); if (!m.has(k)) m.set(k, fn(...args)); return m.get(k)!; }; };

function integrate(fn: (value: number) => number, lo: number, hi: number): number {
  let previous = simpson(fn, lo, hi, 32);
  for (let panels = 64; panels <= 8192; panels *= 2) {
    const current = simpson(fn, lo, hi, panels);
    if (Math.abs(current - previous) / 15 < 2e-11 * Math.max(1, Math.abs(current))) return current + (current - previous) / 15;
    previous = current;
  }
  throw new Error(`quadrature did not stabilise on [${lo}, ${hi}]`);
}
function adapt(f: (x: number) => number, a: number, b: number, eps = 1e-12): number {
  const rec = (a0: number, b0: number, fa: number, fm: number, fb: number, whole: number, e: number, depth: number): number => {
    const m = (a0 + b0) / 2, flm = f((a0 + m) / 2), frm = f((m + b0) / 2);
    const left = (m - a0) / 6 * (fa + 4 * flm + fm), right = (b0 - m) / 6 * (fm + 4 * frm + fb);
    if (depth <= 0 || Math.abs(left + right - whole) <= 15 * e) return left + right + (left + right - whole) / 15;
    return rec(a0, m, fa, flm, fm, left, e / 2, depth - 1) + rec(m, b0, fm, frm, fb, right, e / 2, depth - 1);
  };
  const pieces = 8; let total = 0;
  for (let i = 0; i < pieces; i++) {
    const lo = a + (b - a) * i / pieces, hi = a + (b - a) * (i + 1) / pieces, fa = f(lo), fb = f(hi), fm = f((lo + hi) / 2);
    total += rec(lo, hi, fa, fm, fb, (hi - lo) / 6 * (fa + 4 * fm + fb), eps / pieces, 40);
  }
  return total;
}
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
/** Cartesian double integral of f over the disc x^2+y^2 <= r2 (substitution x = sqrt(r2) sin t only for quadrature accuracy). */
function discIntegral(r2: number, f: (x: number, y: number) => number): number {
  const R = Math.sqrt(r2);
  return integrate(t => {
    const x = R * Math.sin(t), s = Math.sqrt(Math.max(0, r2 - x * x));
    return gauss(y => f(x, y), -s, s, 2) * R * Math.cos(t);
  }, -PI / 2, PI / 2);
}
/** Vertical pull of a disc-shaped ring at height z, from r = 0 to s, with density dens(r): integral dens(r) r z / (r^2+z^2)^(3/2) dr. */
function ringPull(z: number, s: number, dens: (r: number) => number): number {
  if (s <= 0) return 0;
  const upper = Math.asinh(s / z);
  return adapt(u => dens(z * Math.sinh(u)) * Math.sinh(u) / Math.cosh(u) ** 2, 0, upper, 1e-13);
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
    if (t === 'sin') return Math.sin(atom());
    if (t === 'cos') return Math.cos(atom());
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
  const sum = (): number => {
    let v = term();
    while (tokens[p] === '+' || tokens[p] === '-') { const op = tokens[p++]; const n = term(); v += op === '+' ? n : -n; }
    return v;
  };
  const result = sum();
  if (p !== tokens.length) throw new Error(`trailing tokens in "${source}"`);
  return result;
}
function angleOf(s: string): number {
  const t = s.trim();
  if (t === '0') return 0;
  const m = t.match(/^(\d*)π(?:\/(\d+))?$/);
  if (!m) throw new Error(`bad angle "${s}"`);
  return (m[1] === '' ? 1 : Number(m[1])) * PI / (m[2] ? Number(m[2]) : 1);
}
function exactString(v: number): string {
  for (let q = 1; q <= 24; q++) { const p = Math.round(v * q); if (Math.abs(v - p / q) < 1e-9) return q === 1 ? `${p}` : `${p}/${q}`; }
  for (let q = 1; q <= 24; q++) { const p = Math.round(v * q / SQ2); if (Math.abs(v - p * SQ2 / q) < 1e-9) return `${p}sqrt(2)${q === 1 ? '' : `/${q}`}`; }
  for (let q = 1; q <= 24; q++) { const p = Math.round(v * q / PI); if (Math.abs(v - p * PI / q) < 1e-9) return `${p}pi${q === 1 ? '' : `/${q}`}`; }
  throw new Error(`no exact form for ${v}`);
}
const exactPi = (v: number) => exactString(v);

// ---------- generic checks ----------
const CJK = /[㐀-鿿]/;
const ALLOWED_ASCII = new Set(['OP', 'GM', 'sin', 'cos', 'tan', 'sqrt', 'pi', 'dr', 'dz', 'dV', 'dS', 'dA', 'Fz', 'xz', 'yz', 'xy']);
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
      if (/写作|print/.test(text)) bad.push(`template note leaked in ZH: ${text.slice(0, 60)}`);
    }
    if (/\{[^}]*\}|undefined|NaN|\[object/.test(text)) bad.push(`template/undefined leftover: ${text.slice(0, 60)}`);
  }
  return bad;
}
function gradeNumeric(card: PracticeCard, expected: number[], tol: number, where: string, f: Fails) {
  f.ok(card.fields?.length === expected.length, `${where}: field count`);
  if (!card.fields) return;
  expected.forEach((v, i) => {
    const got = card.fields![i].answer;
    f.ok(Math.abs(got - v) <= tol * Math.max(1, Math.abs(v)), `${where} field ${i} (${card.fields![i].label}): oracle ${v}, card ${got}`);
  });
  let accepted: string[];
  try { accepted = expected.map(exactString); } catch (error) { f.list.push(`${where}: ${(error as Error).message}`); return; }
  f.ok(gradeCard(card, accepted, null, []) === 'correct', `${where}: accepted answer ${JSON.stringify(accepted)} does not grade correct`);
  expected.forEach((v, i) => {
    const bad = accepted.slice(); bad[i] = String(v * 1.01 + 0.013);
    f.ok(gradeCard(card, bad, null, []) === 'incorrect', `${where}: perturbed field ${i} is not graded incorrect`);
  });
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
  f.ok(JSON.stringify(en.figure?.view) === JSON.stringify(zh.figure?.view), `seed ${index} ${slug}: EN/ZH figure views differ`);
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
const areaShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'area' }> => s.kind === 'area');
const pointShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'point' }> => s.kind === 'point');
const arrowShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'arrow' }> => s.kind === 'arrow');
const textShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'text' }> => s.kind === 'text');
const segment = (fig: Figure, a: Pt, b: Pt, tone?: string) => lineShapes(fig).find(l => l.points.length === 2 && ((ptNear(l.points[0], a) && ptNear(l.points[1], b)) || (ptNear(l.points[0], b) && ptNear(l.points[1], a))) && (!tone || l.tone === tone));
const shoelace = (pts: readonly Pt[]) => { let s = 0; pts.forEach((p, i) => { const q = pts[(i + 1) % pts.length]; s += p[0] * q[1] - q[0] * p[1]; }); return Math.abs(s) / 2; };
function viewIs(card: PracticeCard, expected: [number, number, number, number], where: string, f: Fails) {
  const v = card.figure!.view;
  f.ok(near(v.xmin, expected[0]) && near(v.xmax, expected[1]) && near(v.ymin, expected[2]) && near(v.ymax, expected[3]), `${where}: view ${JSON.stringify(v)} vs ${JSON.stringify(expected)}`);
}
function distinctCount(game: number, slug: string, key: (card: PracticeCard) => string): number {
  const set = new Set<string>();
  for (let index = 0; index < SEEDS; index++) set.add(key(getCard(game, index, 'en', slug)));
  return set.size;
}
const plainKey = (card: PracticeCard) => card.prompt;
const fullKey = (card: PracticeCard) => JSON.stringify([card.prompt, card.choice?.options, card.figure?.shapes]);
const num = (text: string | undefined, label: string): number => { if (text === undefined) throw new Error(`cannot parse ${label}`); return Number(text); };
const rx = (text: string, pattern: RegExp, label: string): RegExpMatchArray => { const m = clean(text).match(pattern); if (!m) throw new Error(`cannot parse ${label} in "${text}"`); return m; };
const rel = (a: number, b: number, tol: number) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

/**
 * Symbol-card check. `integral(values)` assembles the learner's set-up from the slot strings and returns its numeric value (throws when a
 * slot string cannot be evaluated in its position). It must equal `truth` for the answers, and for no other token substituted into any one slot.
 */
function checkSlots(card: PracticeCard, truth: number, integral: (values: string[]) => number, tol: number, where: string, f: Fails) {
  const slots = card.slots!;
  f.ok(slots.between !== undefined && slots.between.length === slots.answers.length - 1, `${where}: between.length ${slots.between?.length} vs ${slots.answers.length} blanks`);
  slots.answers.forEach(a => f.ok(slots.tokens.includes(a), `${where}: answer "${a}" not in tokens`));
  f.ok(new Set(slots.tokens).size === slots.tokens.length, `${where}: duplicate tokens ${JSON.stringify(slots.tokens)}`);
  f.ok(new Set(slots.tokens).size >= new Set(slots.answers).size, `${where}: fewer tokens than distinct answers`);
  const value = (values: string[]) => { try { const v = integral(values); return Number.isFinite(v) ? v : NaN; } catch { return NaN; } };
  const base = value(slots.answers);
  f.ok(rel(base, truth, tol), `${where}: assembled answers ${JSON.stringify(slots.answers)} integrate to ${base}, independent value ${truth}`);
  slots.answers.forEach((_, i) => {
    for (const token of slots.tokens) {
      if (token === slots.answers[i]) continue;
      const trial = slots.answers.slice(); trial[i] = token;
      const v = value(trial);
      f.ok(!(Number.isFinite(v) && rel(v, truth, tol)), `${where}: token "${token}" in slot ${i} also gives the correct value ${v}`);
    }
  });
  f.ok(gradeCard(card, [], null, slots.answers) === 'correct', `${where}: answers do not grade correct`);
  slots.answers.forEach((_, i) => { const bad = slots.answers.slice(); bad[i] = slots.tokens.find(t => t !== slots.answers[i]) ?? 'x'; f.ok(gradeCard(card, [], null, bad) === 'incorrect', `${where}: wrong slot ${i} not graded incorrect`); });
}

// ---------- explanations must state the answer that the card accepts ----------
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
  const hit = statedCandidates(v).some(c => new RegExp(String.raw`(?:=|得|gives) ${escapeRe(c)}(?![\d/π]|\.\d)`).test(text));
  f.ok(hit, `${where}: explanation does not state ${statedCandidates(v).join(' or ')}: "${card.explanation.slice(-120)}"`);
}
function explanationsOf(game: number, slugs: string[]) {
  everySeed((index, lang, f) => {
    for (const slug of slugs) {
      const card = getCard(game, index, lang, slug);
      explanationStates(card, card.fields![0].answer, `seed ${index} ${lang} ${slug}`, f);
    }
  });
}

// ======================================================================================================
// MIT-MV-51
// ======================================================================================================
const END_51 = { en: 'This game does not ask you to find centres of mass or average heights, and it does not cover moments of inertia about axes other than the z-axis.', zh: '本游戏不要求求质心或平均高度，也不涉及关于 z 轴以外其他轴的转动惯量。' };
const END_52 = { en: 'This game does not ask you to derive the volume element ρ² sin φ from the Jacobian determinant, and it does not cover regions whose boundaries are not spheres, cones, planes or the rotated circle of the notes.', zh: '本游戏不要求用雅可比行列式推导体积元 ρ² sin φ，也不涉及边界不是球面、圆锥面、平面或笔记中旋转圆曲面的区域。' };
const END_53 = { en: 'This game only treats solids placed symmetrically so that the pull is along the z-axis, as in the notes; it does not test the x- and y-components of the attraction or forces from off-axis solids.', zh: '本游戏只讨论像笔记中那样对称放置、引力沿 z 轴的立体，不涉及引力的 x、y 分量，也不涉及偏离轴的立体产生的引力。' };

const momentK = memo((delta: number, h: number) => delta * discIntegral(h, (x, y) => (h - x * x - y * y) * (x * x + y * y)) / PI);
const cylinderK = memo((delta: number, a: number, H: number) => delta * H * discIntegral(a * a, (x, y) => x * x + y * y) / PI);

function sideView51(card: PracticeCard, h: number, z0: number | undefined, where: string, f: Fails) {
  const fig = card.figure;
  if (!fig) { f.list.push(`${where}: figure missing`); return; }
  const s = Math.sqrt(h);
  viewIs(card, [-s - 0.6, s + 0.6, -0.6, h + 0.9], where, f);
  const parabola = lineShapes(fig).find(l => l.points.length >= 20 && l.points.every(p => near(p[1], p[0] * p[0], 1e-9)));
  f.ok(parabola, `${where}: no parabola z = x^2 line`);
  if (parabola) {
    const xs = parabola.points.map(p => p[0]);
    f.ok(near(Math.min(...xs), -s) && near(Math.max(...xs), s), `${where}: parabola spans x in [${Math.min(...xs)}, ${Math.max(...xs)}], expected [-${s}, ${s}] (up to the plane z = ${h})`);
  }
  f.ok(segment(fig, [-s, h], [s, h], 'accent2'), `${where}: plane line z = ${h} from -sqrt(h) to sqrt(h) missing`);
  const region = areaShapes(fig)[0];
  f.ok(region, `${where}: region missing`);
  if (region) {
    f.ok(region.points.every(p => (near(p[1], p[0] * p[0], 1e-9) || near(p[1], h)) && Math.abs(p[0]) <= s + 1e-9), `${where}: region points are not on the parabola/plane`);
    f.ok(region.points.some(p => ptNear(p, [s, h])) && region.points.some(p => ptNear(p, [-s, h])), `${where}: region does not reach (+-sqrt(h), h)`);
    f.ok(rel(shoelace(region.points), 4 / 3 * h ** 1.5, 2e-3), `${where}: region area ${shoelace(region.points)} vs ${4 / 3 * h ** 1.5}`);
  }
  const labels = fig.shapes.map(sh => ('label' in sh && sh.label) || (sh.kind === 'text' ? sh.text : '')).join('|');
  f.ok(labels.includes(`z = ${h}`), `${where}: label z = ${h} missing`);
  f.ok(fig.alt.includes(`z = ${h}`), `${where}: alt lacks z = ${h}`);
  if (z0 !== undefined) {
    const r = Math.sqrt(z0);
    f.ok(segment(fig, [-r, z0], [r, z0], 'warn'), `${where}: z0 chord missing`);
    f.ok(pointShapes(fig).some(p => ptNear(p.at, [0, z0]) && (p.label ?? '').includes(`z = ${z0}`)), `${where}: point (0, z0) with its label missing`);
    f.ok(arrowShapes(fig).some(a => ptNear(a.from, [0, z0]) && ptNear(a.to, [r, z0]) && a.label === 'r'), `${where}: radius arrow missing or wrong`);
    f.ok(fig.alt.includes(`z = ${z0}`), `${where}: alt lacks z = ${z0}`);
  }
}

describe('MIT-MV-51 oracle', () => {
  it('has exactly the five approved audit kinds, each on every seed, and every numeric card is audited', () => everySeed((index, lang, f) => {
    const cards = deck(51, index, lang);
    const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
    f.ok(JSON.stringify(kinds) === JSON.stringify(['MIT-MV-51:challenge', 'MIT-MV-51:disk-radius', 'MIT-MV-51:inner', 'MIT-MV-51:moment', 'MIT-MV-51:z-step']), `seed ${index} ${lang}: kinds ${kinds}`);
    f.ok(cards.every(c => !c.fields || c.audit), `seed ${index}: unaudited numeric card`);
    f.ok(cards.length >= 7 && cards.length <= 12 && cards[cards.length - 1].id === 'MIT-MV-51-challenge', `seed ${index}: deck shape`);
    f.ok(JSON.stringify(cards.map(c => c.id)) === JSON.stringify(['factors', 'limits', 'disk-radius', 'inner', 'z-step', 'density', 'moment', 'challenge'].map(s => `MIT-MV-51-${s}`)), `seed ${index}: card order ${cards.map(c => c.id)}`);
    cards.forEach(c => { for (const p of languageProblems(c, lang)) f.list.push(`seed ${index} ${lang} ${c.id}: ${p}`); checkFigureGeneric(c, `seed ${index} ${lang} ${c.id}`, f); });
    for (const c of cards) bothLanguagesAgree(51, index, c.id.slice('MIT-MV-51-'.length), f);
    const last = cards[cards.length - 1];
    f.ok(last.explanation.endsWith(END_51[lang]), `seed ${index} ${lang}: challenge explanation must end with the does-not-assess sentence`);
  }));

  it('factors: exactly one option says r^2 is the squared distance from the z-axis and the extra r is dV', () => everySeed((index, lang, f) => {
    const card = getCard(51, index, lang, 'factors');
    const h = num(rx(card.prompt, /z = (\d+)/, 'h')[1], 'h');
    f.ok(h >= 2 && h <= 7, `h ${h}`);
    const test = (o: string) => lang === 'en' ? /r² is the squared distance from the z-axis/.test(o) && /the extra r comes from dV = r dr dθ dz/.test(o) : /r² 是到 z 轴距离的平方/.test(o) && /多出来的 r 来自体积元 dV = r dr dθ dz/.test(o);
    const good = card.choice!.options.map(test);
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: predicate ${good} answer ${card.choice!.answer}`);
    f.ok(new Set(card.choice!.options).size === 4, 'options distinct');
  }));

  it('limits: the learner\'s bounds integrate r^3 over the solid to pi h^3/6 (Cartesian moment of the same solid), and no other token does', () => everySeed((index, lang, f) => {
    const card = getCard(51, index, lang, 'limits');
    const h = num(rx(card.prompt, /z = (\d+)/, 'h')[1], 'h');
    const slots = card.slots!;
    const isA = /(over z from|z 从) $/.test(slots.before);
    const isB = /(over r from|r 从) $/.test(slots.before);
    f.ok(isA !== isB, `seed ${index} ${lang}: cannot tell variant from before "${slots.before}"`);
    f.ok(isA ? (lang === 'en' ? /dr dz dθ/.test(slots.after!) : /dr、dz、dθ/.test(slots.after!)) : (lang === 'en' ? /dz dr dθ/.test(slots.after!) : /dz、dr、dθ/.test(slots.after!)), `seed ${index} ${lang}: order of differentials in "${slots.after}" does not match the nesting`);
    f.ok(slots.after!.includes('r³'), 'integrand r^3 stated');
    const truth = PI * momentK(1, h);
    const integral = isA
      ? (v: string[]) => 2 * PI * gauss(z => gauss(r => r ** 3, ev(v[2], { z }), ev(v[3], { z }), 1), ev(v[0]), ev(v[1]), 2)
      : (v: string[]) => 2 * PI * gauss(r => { const lo = ev(v[2], { r }), hi = ev(v[3], { r }); return (hi - lo) * r ** 3; }, ev(v[0]), ev(v[1]), 2);
    checkSlots(card, truth, integral, 1e-9, `seed ${index} ${lang} h=${h} ${isA ? 'A' : 'B'}`, f);
    const expectedAnswers = isA ? ['0', `${h}`, '0', '√z'] : ['0', `√${h}`, 'r²', `${h}`];
    f.ok(JSON.stringify(slots.answers) === JSON.stringify(expectedAnswers), `seed ${index} ${lang}: answers ${slots.answers} vs plan ${expectedAnswers}`);
    const planTokens = isA ? ['0', `${h}`, '√z', 'z', 'z²', `√${h}`, `${h * h}`] : ['0', `√${h}`, 'r²', `${h}`, 'r', '√r', `${h * h}`];
    f.ok(JSON.stringify([...slots.tokens].sort()) === JSON.stringify([...planTokens].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(slots.tokens)} vs plan ${JSON.stringify(planTokens)}`);
    if (lang === 'zh') f.ok(!/[A-Za-z]{3,}/.test([slots.before, ...slots.between!, slots.after!].join(' ').replace(/sin|cos/g, '')), `seed ${index}: English words in ZH slot text ${JSON.stringify([slots.before, ...slots.between!, slots.after])}`);
    sideView51(card, h, undefined, `seed ${index} ${lang} limits`, f);
  }));
  it('limits: both variants occur and wording varies', () => {
    const variants = new Set<string>();
    for (let index = 0; index < SEEDS; index++) variants.add(getCard(51, index, 'en', 'limits').slots!.answers[1] === `${num(rx(getCard(51, index, 'en', 'limits').prompt, /z = (\d+)/, 'h')[1], 'h')}` ? 'A' : 'B');
    expect([...variants].sort()).toEqual(['A', 'B']);
    expect(distinctCount(51, 'limits', c => c.prompt + JSON.stringify(c.slots))).toBeGreaterThanOrEqual(6);
  });

  it('disk-radius: radius of the cross-section at height z0 (boundary z0 = r^2, and the disc area)', () => everySeed((index, lang, f) => {
    const card = getCard(51, index, lang, 'disk-radius');
    const m = [...clean(card.prompt).matchAll(/z = (\d+)/g)].map(x => Number(x[1]));
    const [h, z0] = m;
    f.ok(m.length === 2 && h > z0, `seed ${index}: numbers ${m}`);
    f.ok([4, 9, 16, 25].includes(z0) && [1, 2, 3].includes(h - z0), `seed ${index}: z0 ${z0} h ${h} outside plan sampling`);
    auditIs(card, 'MIT-MV-51:disk-radius', { z0, h }, `seed ${index} ${lang}`, f);
    let lo = 0, hi = 10;
    for (let i = 0; i < 100; i++) { const mid = (lo + hi) / 2; if (mid * mid < z0) lo = mid; else hi = mid; }
    const area = integrate(t => 2 * Math.sqrt(z0 - z0 * Math.sin(t) ** 2) * Math.sqrt(z0) * Math.cos(t), -PI / 2, PI / 2);
    f.ok(near(lo, Math.sqrt(area / PI), 1e-8), 'oracle routes disagree');
    gradeNumeric(card, [(lo + hi) / 2], 1e-9, `seed ${index} ${lang} disk-radius z0=${z0}`, f);
    sideView51(card, h, z0, `seed ${index} ${lang} disk-radius`, f);
  }));

  it('inner: Simpson of r^3 on [0, sqrt(z0)]', () => everySeed((index, lang, f) => {
    const card = getCard(51, index, lang, 'inner');
    const z0 = num(rx(card.prompt, /z = (\d+)/, 'z0')[1], 'z0');
    f.ok([2, 3, 5, 6, 7, 8, 10].includes(z0), `z0 ${z0}`);
    f.ok(clean(card.prompt).includes(`r = √${z0}`) && numbersIn(card.prompt.replace(/√\d+/g, '')).every(n => n === z0 || n === 0 || n === 3 || n === 1) , 'bound printed');
    f.ok(clean(card.prompt).split(`√${z0}`).length >= 3, `seed ${index}: sqrt bound printed twice`);
    auditIs(card, 'MIT-MV-51:inner', { z0 }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [simpson(r => r ** 3, 0, Math.sqrt(z0), 200)], 1e-9, `seed ${index} ${lang} inner`, f);
  }));
  it('z-step: Simpson of z^2/4 on [0, h]', () => everySeed((index, lang, f) => {
    const card = getCard(51, index, lang, 'z-step');
    const h = num((lang === 'en' ? rx(card.prompt, /from z = 0 to (\d+)/, 'h') : rx(card.prompt, /z 从 0 到 (\d+)/, 'h'))[1], 'h');
    f.ok([2, 3, 4, 6, 8, 9].includes(h), `h ${h}`);
    auditIs(card, 'MIT-MV-51:z-step', { h }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [simpson(z => z * z / 4, 0, h, 200)], 1e-9, `seed ${index} ${lang} z-step`, f);
  }));
  it('density: the option whose factor equals delta is the only correct one', () => everySeed((index, lang, f) => {
    const card = getCard(51, index, lang, 'density');
    const delta = num(rx(card.prompt, /δ = (\d+)/, 'delta')[1], 'delta');
    f.ok([2, 3, 4, 5, 6, 8].includes(delta), `delta ${delta}`);
    const factor = (o: string): number => {
      const t = clean(o);
      let m = t.match(/^(\d+)\*I₁$/); if (m) return Number(m[1]);
      m = t.match(/^I₁\/(\d+)$/); if (m) return 1 / Number(m[1]);
      if (/^I₁[,，]/.test(t)) return 1;
      throw new Error(`unparsed option ${o}`);
    };
    const good = card.choice!.options.map(o => near(factor(o), delta));
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: ${card.choice!.options} -> ${good}, answer ${card.choice!.answer}`);
    f.ok(new Set(card.choice!.options).size === 4, 'options distinct');
  }));
  it('moment: k = (delta / pi) times the Cartesian double integral of (h - x^2 - y^2)(x^2 + y^2)', () => everySeed((index, lang, f) => {
    const card = getCard(51, index, lang, 'moment');
    const h = num(rx(card.prompt, /z = (\d+)/, 'h')[1], 'h'), delta = num(rx(card.prompt, /δ = (\d+)/, 'delta')[1], 'delta');
    f.ok([2, 3, 4, 6].includes(delta) && [2, 3, 4].includes(h), `delta ${delta} h ${h}`);
    auditIs(card, 'MIT-MV-51:moment', { delta, h }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [momentK(delta, h)], 1e-8, `seed ${index} ${lang} moment`, f);
  }));
  it('challenge: cylinder moment of inertia by a Cartesian double integral; sampling rules', () => everySeed((index, lang, f) => {
    const card = getCard(51, index, lang, 'challenge');
    const [a, H] = (lang === 'en' ? rx(card.prompt, /radius (\d+) and height (\d+)/, 'a,H') : rx(card.prompt, /半径为 (\d+)、高为 (\d+)/, 'a,H')).slice(1).map(Number);
    const delta = num(rx(card.prompt, /δ = (\d+)/, 'delta')[1], 'delta');
    f.ok(num(rx(card.prompt, /0 ≤ z ≤ (\d+)/, 'top')[1], 'top') === H, 'height matches 0 <= z <= H');
    f.ok([1, 2, 3].includes(a) && [1, 2, 3, 4].includes(H) && [1, 2, 3].includes(delta), `a ${a} H ${H} delta ${delta}`);
    f.ok(!(a === H && H === delta) && !(a === 3 && delta * H > 3), `seed ${index}: sampling constraint violated (${delta},${a},${H})`);
    auditIs(card, 'MIT-MV-51:challenge', { delta, a, H }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [cylinderK(delta, a, H)], 1e-8, `seed ${index} ${lang} challenge`, f);
  }));
  it('explanations state the accepted answer', () => explanationsOf(51, ['disk-radius', 'inner', 'z-step', 'moment', 'challenge']));
  it('variety: at least 6 distinct prompts per card', () => {
    for (const [slug, key, min] of [['factors', plainKey, 6], ['limits', plainKey, 6], ['disk-radius', plainKey, 6], ['inner', plainKey, 6], ['z-step', plainKey, 6], ['density', plainKey, 6], ['moment', plainKey, 6], ['challenge', plainKey, 6]] as const)
      expect(distinctCount(51, slug, key), slug).toBeGreaterThanOrEqual(min);
  });
});

// ======================================================================================================
// MIT-MV-52
// ======================================================================================================
function conePieces(alphaN: number): { k: number; zbar: number } {
  const key = `cone${alphaN}`;
  const hit = (conePieces as unknown as { c?: Map<string, { k: number; zbar: number }> }).c ?? ((conePieces as unknown as { c: Map<string, { k: number; zbar: number }> }).c = new Map());
  if (hit.has(key)) return hit.get(key)!;
  const cosA = Math.cos(alphaN * PI / 3), n = 400, cell = 2 / n;
  let count = 0, zSum = 0;
  for (let i = 0; i < n; i++) {
    const x = -1 + (i + 0.5) * cell;
    for (let j = 0; j < n; j++) {
      const y = -1 + (j + 0.5) * cell, rr = x * x + y * y;
      if (rr > 1) continue;
      for (let l = 0; l < n; l++) {
        const z = -1 + (l + 0.5) * cell, rho2 = rr + z * z;
        if (rho2 <= 1 && z >= cosA * Math.sqrt(rho2)) { count++; zSum += z; }
      }
    }
  }
  const volume = count * cell ** 3, result = { k: volume / PI, zbar: zSum / count };
  hit.set(key, result);
  return result;
}
const capK = memo((R: number, d: number) => {
  const slab = integrate(z => R * R - z * z, d, R);
  const spherical = 2 * integrate(phi => Math.sin(phi) * (R ** 3 - (d / Math.cos(phi)) ** 3) / 3, 0, Math.acos(d / R));
  if (!near(slab, spherical, 1e-8)) throw new Error('cap routes disagree');
  return slab;
});
const ANGLES = ['0', 'π/4', 'π/2', '3π/4', 'π', '5π/4', '3π/2', '7π/4'];

function coneSector(card: PracticeCard, a: number, alphaN: number, alphaText: string, where: string, f: Fails) {
  const fig = card.figure;
  if (!fig) { f.list.push(`${where}: figure missing`); return; }
  const alpha = alphaN * PI / 3;
  viewIs(card, [-1.3 * a, 1.3 * a, -1.3 * a, 1.3 * a], where, f);
  const region = areaShapes(fig)[0];
  f.ok(region && ptNear(region.points[0], [0, 0]), `${where}: sector must start at the origin`);
  if (region) {
    const arc = region.points.slice(1);
    f.ok(arc.every(p => near(Math.hypot(p[0], p[1]), a)), `${where}: sector arc is not on the sphere of radius ${a}`);
    f.ok(arc.every(p => Math.atan2(Math.abs(p[0]), p[1]) <= alpha + 1e-9), `${where}: sector arc leaves the cone phi <= ${alphaText}`);
    f.ok(arc.some(p => ptNear(p, [a * Math.sin(alpha), a * Math.cos(alpha)])) && arc.some(p => ptNear(p, [-a * Math.sin(alpha), a * Math.cos(alpha)])), `${where}: arc end points at +-alpha missing`);
    f.ok(rel(shoelace(region.points), alpha * a * a, 1e-2), `${where}: sector area ${shoelace(region.points)} vs ${alpha * a * a}`);
  }
  f.ok(lineShapes(fig).some(l => l.tone === 'muted' && l.points.length > 20 && l.points.every(p => near(Math.hypot(p[0], p[1]), a))), `${where}: sphere circle missing`);
  for (const sgn of [1, -1]) f.ok(segment(fig, [0, 0], [sgn * a * Math.sin(alpha), a * Math.cos(alpha)], 'accent2'), `${where}: cone ray ${sgn} missing`);
  f.ok(segment(fig, [0, -1.2 * a], [0, 1.2 * a], 'axis'), `${where}: z-axis line missing`);
  f.ok(textShapes(fig).some(t => t.text.includes(`ρ = ${a}`)), `${where}: label ρ = ${a} missing`);
  f.ok(fig.alt.includes(`${a}`) && fig.alt.includes(alphaText), `${where}: alt lacks radius ${a} or angle ${alphaText}`);
}

describe('MIT-MV-52 oracle', () => {
  it('has exactly the five approved audit kinds, each on every seed; deck shape, language and end sentence', () => everySeed((index, lang, f) => {
    const cards = deck(52, index, lang);
    const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
    f.ok(JSON.stringify(kinds) === JSON.stringify(['MIT-MV-52:challenge', 'MIT-MV-52:cone-centroid', 'MIT-MV-52:cone-volume', 'MIT-MV-52:to-cartesian', 'MIT-MV-52:to-spherical']), `seed ${index} ${lang}: kinds ${kinds}`);
    f.ok(cards.every(c => !c.fields || c.audit), `seed ${index}: unaudited numeric card`);
    f.ok(JSON.stringify(cards.map(c => c.id)) === JSON.stringify(['to-cartesian', 'to-spherical', 'pole-choice', 'circle-surface', 'cap-limits', 'cone-setup', 'cone-volume', 'cone-centroid', 'challenge'].map(s => `MIT-MV-52-${s}`)), `seed ${index}: order ${cards.map(c => c.id)}`);
    cards.forEach(c => { for (const p of languageProblems(c, lang)) f.list.push(`seed ${index} ${lang} ${c.id}: ${p}`); checkFigureGeneric(c, `seed ${index} ${lang} ${c.id}`, f); });
    for (const c of cards) bothLanguagesAgree(52, index, c.id.slice('MIT-MV-52-'.length), f);
    f.ok(cards[cards.length - 1].explanation.endsWith(END_52[lang]), `seed ${index} ${lang}: challenge explanation must end with the does-not-assess sentence`);
    for (const c of cards) if (/φ/.test([c.prompt, ...(c.choice?.options ?? [])].join(' '))) f.ok(lang === 'en' ? /φ (is )?measured from the positive z-axis/.test(c.prompt) : /φ 是从正 z 轴量起的角/.test(c.prompt), `seed ${index} ${lang} ${c.id}: φ convention not stated`);
  }));

  it('to-cartesian: P = Rz(theta) Ry(phi) (0, 0, a) by rotation matrices', () => everySeed((index, lang, f) => {
    const card = getCard(52, index, lang, 'to-cartesian');
    const m = rx(card.prompt, /ρ = (\d+)[,，] ?φ = ([^,，]+)[,，] ?θ = ([^.。]+)[.。]/, 'a,phi,theta');
    const a = Number(m[1]), phi = angleOf(m[2]), theta = angleOf(m[3]);
    f.ok([2, 3, 4].includes(a) && [PI / 4, PI / 2, 3 * PI / 4].some(v => near(v, phi)) && ANGLES.includes(m[3].trim()), `seed ${index}: a ${a} φ ${m[2]} θ ${m[3]}`);
    const p = card.audit!.params as Record<string, number>;
    f.ok(p.a === a && p.thD > 0 && p.phiD > 0 && near(p.phiN / p.phiD * PI, phi) && near(p.thN / p.thD * PI, theta), `seed ${index} ${lang}: audit ${JSON.stringify(p)} vs printed ${a}, ${m[2]}, ${m[3]}`);
    const ry = [Math.sin(phi) * a, 0, Math.cos(phi) * a];
    const exp = [Math.cos(theta) * ry[0], Math.sin(theta) * ry[0], ry[2]];
    gradeNumeric(card, exp, 1e-9, `seed ${index} ${lang} to-cartesian (${a}, ${m[2]}, ${m[3]})`, f);
    card.fields!.forEach((fl, i) => f.ok(Math.abs(exp[i]) > 1e-9 || fl.answer === 0, `seed ${index}: zero coordinate stored as ${fl.answer}, plan wants exact 0`));
  }));
  it('to-spherical: the forward map of the card\'s (rho, phi, theta) returns P', () => everySeed((index, lang, f) => {
    const card = getCard(52, index, lang, 'to-spherical');
    const m = rx(card.prompt, /P = \(([^)]*)\)/, 'P')[1].split(',').map(part => ev(part.trim()));
    const [x, y, z] = m;
    const a = Math.abs(x);
    const sz = Math.round(z / (a * SQ2));
    f.ok([1, 2, 3, 4, 5].includes(a) && Math.abs(y) === a && near(z, sz * a * SQ2), `seed ${index} ${lang}: P=(${x},${y},${z}) outside plan sampling`);
    auditIs(card, 'MIT-MV-52:to-spherical', { a, sx: Math.sign(x), sy: Math.sign(y), sz }, `seed ${index} ${lang}`, f);
    const [rho, phi, theta] = card.fields!.map(fl => fl.answer);
    const back = [rho * Math.sin(phi) * Math.cos(theta), rho * Math.sin(phi) * Math.sin(theta), rho * Math.cos(phi)];
    f.ok(back.every((v, i) => near(v, [x, y, z][i], 1e-9)), `seed ${index} ${lang}: forward map of the card answer gives ${back}, P is ${[x, y, z]}`);
    f.ok(rho >= 0 && phi >= 0 && phi <= PI + 1e-12 && theta >= 0 && theta < 2 * PI, `seed ${index}: ranges ρ ${rho} φ ${phi} θ ${theta}`);
    const exp = [Math.sqrt(x * x + y * y + z * z), Math.acos(z / Math.sqrt(x * x + y * y + z * z)), (Math.atan2(y, x) + 2 * PI) % (2 * PI)];
    gradeNumeric(card, exp, 1e-9, `seed ${index} ${lang} to-spherical P=(${x},${y},${z})`, f);
  }));
  it('pole-choice: only "any theta works" is correct, with the right rho and phi printed', () => everySeed((index, lang, f) => {
    const card = getCard(52, index, lang, 'pole-choice');
    const c = num(clean(rx(card.prompt, /P = \(0, 0, (-?\d+|−\d+)\)/, 'c')[1]), 'c');
    f.ok([1, 2, 3, 4].includes(Math.abs(c)), `c ${c}`);
    f.ok(num(rx(card.prompt, /ρ = (\d+)/, 'rho')[1], 'rho') === Math.abs(c), `ρ must be |c|`);
    f.ok(rx(card.prompt, /φ = (0|π)/, 'phi')[1] === (c > 0 ? '0' : 'π'), `φ must be ${c > 0 ? 0 : 'π'} for c = ${c}`);
    const test = (o: string) => lang === 'en' ? /^Any θ works/.test(o) && /does not determine θ/.test(o) : /^任何 θ 都可以/.test(o) && /并不确定 θ/.test(o);
    const good = card.choice!.options.map(test);
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: ${good}, answer ${card.choice!.answer}`);
  }));
  it('pole-choice: negative c occurs, both wordings occur', () => {
    const cs = new Set<number>(), wordings = new Set<string>();
    for (let index = 0; index < SEEDS; index++) { const card = getCard(52, index, 'en', 'pole-choice'); cs.add(num(clean(card.prompt.match(/P = \(0, 0, (-?\d+|−\d+)\)/)![1]), 'c')); wordings.add(card.prompt.split('. ').slice(-1)[0]); }
    expect(cs.size).toBeGreaterThanOrEqual(6);
    expect([...cs].some(c => c < 0) && [...cs].some(c => c > 0)).toBe(true);
    expect(wordings.size).toBe(2);
  });
  it('circle-surface: candidate rho(phi) equals the distance to the rotated circle along every ray', () => everySeed((index, lang, f) => {
    const card = getCard(52, index, lang, 'circle-surface');
    const R = num((lang === 'en' ? rx(card.prompt, /radius (\d+)/, 'R') : rx(card.prompt, /半径为 (\d+)/, 'R'))[1], 'R');
    f.ok(R >= 1 && R <= 6, `R ${R}`);
    const ringRho = (phi: number): number => {
      // ray (y, z) = rho (sin phi, cos phi); the circle (y - R)^2 + z^2 = R^2 is crossed at rho > 0
      const g = (rho: number) => (rho * Math.sin(phi) - R) ** 2 + (rho * Math.cos(phi)) ** 2 - R * R;
      let lo = 1e-9, hi = 4 * R;
      for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (g(mid) < 0) lo = mid; else hi = mid; }
      return (lo + hi) / 2;
    };
    const test = (o: string) => {
      const rhs = clean(o).replace(/^ρ = /, '');
      return [0.2, 0.55, 0.9, 1.3].every(phi => near(ev(rhs, { φ: phi }), ringRho(phi), 1e-7));
    };
    const good = card.choice!.options.map(test);
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: ${card.choice!.options} -> ${good}, answer ${card.choice!.answer}`);
    const fig = card.figure!;
    viewIs(card, [-0.6 * R, 2.6 * R, -1.6 * R, 1.6 * R], `seed ${index} ${lang} circle-surface`, f);
    const circle = lineShapes(fig).find(l => l.tone === 'accent' && l.points.length > 36);
    f.ok(circle && circle.points.every(p => near(Math.hypot(p[0] - R, p[1]), R)), `seed ${index} ${lang}: circle of radius ${R} centred at y = ${R} missing`);
    const P = pointShapes(fig).find(p => p.label === 'P'), O = pointShapes(fig).find(p => p.label === 'O');
    f.ok(O && ptNear(O.at, [0, 0]), 'O at origin');
    f.ok(P && near(Math.hypot(P.at[0] - R, P.at[1]), R), `seed ${index} ${lang}: P is not on the circle`);
    f.ok(P && ptNear(P.at, [1.5 * R, R * Math.sqrt(3) / 2]), `seed ${index} ${lang}: P at ${P?.at}`);
    f.ok(P && segment(fig, [0, 0], P.at as Pt, 'warn'), `seed ${index} ${lang}: segment O-P tone warn missing`);
    f.ok(segment(fig, [-0.6 * R, 0], [2.6 * R, 0]) && segment(fig, [0, -1.6 * R], [0, 1.6 * R]), `seed ${index} ${lang}: axes missing`);
    f.ok(textShapes(fig).some(t => t.text === 'φ' && ptNear(t.at, [0.2 * R, 0.5 * R])), `seed ${index} ${lang}: φ text`);
    f.ok(fig.axes?.xLabel === 'y' && fig.axes?.yLabel === 'z', 'axes labels y and z');
    f.ok(fig.alt.includes(`${R}`), 'alt has R');
  }));
  it('cap-limits: the learner\'s spherical bounds give the cap volume pi(R^2(R-d) - (R^3-d^3)/3); the figure is the cap with one ray', () => everySeed((index, lang, f) => {
    const card = getCard(52, index, lang, 'cap-limits');
    const d = num(rx(card.prompt, /z = (\d+)/, 'a')[1], 'a');
    const radiusText = (lang === 'en' ? rx(card.prompt, /radius (\d*√2)/, 'radius') : rx(card.prompt, /半径为 (\d*√2)/, 'radius'))[1];
    const a = d, R = ev(radiusText);
    f.ok(near(R, a * SQ2, 1e-12) && a >= 1 && a <= 6, `seed ${index} ${lang}: radius ${radiusText} vs z = ${a}`);
    f.ok((radiusText === '√2') === (a === 1), 'coefficient 1 omitted');
    const truth = PI * capK(R, a) / 1; // = volume / 1, capK returns k with V = kπ
    const integral = (v: string[]) => 2 * PI * simpson(phi => {
      const lo = ev(v[2], { φ: phi }), hi = ev(v[3], { φ: phi });
      return Math.sin(phi) * (hi ** 3 - lo ** 3) / 3;
    }, ev(v[0]), ev(v[1]), 400);
    checkSlots(card, truth, integral, 1e-8, `seed ${index} ${lang} cap a=${a}`, f);
    const expected = a === 1 ? ['0', 'π/4', '1/cos φ', '√2'] : ['0', 'π/4', `${a}/cos φ`, `${a}√2`];
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(expected), `seed ${index}: answers ${card.slots!.answers} vs plan ${expected}`);
    const planTokens = a === 1 ? ['0', 'π/4', 'π/3', 'π/2', '1/cos φ', 'cos φ', '1', '√2'] : ['0', 'π/4', 'π/3', 'π/2', `${a}/cos φ`, `${a} cos φ`, `${a}`, `${a}√2`];
    f.ok(JSON.stringify([...card.slots!.tokens].sort()) === JSON.stringify([...planTokens].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)} vs plan ${JSON.stringify(planTokens)}`);
    const fig = card.figure!, where = `seed ${index} ${lang} cap-limits`;
    viewIs(card, [-1.8 * a, 1.8 * a, -1.8 * a, 1.8 * a], where, f);
    f.ok(lineShapes(fig).some(l => l.tone === 'muted' && l.points.length > 36 && l.points.every(p => near(Math.hypot(p[0], p[1]), R))), `${where}: sphere circle of radius ${radiusText} missing`);
    const cap = areaShapes(fig)[0];
    f.ok(cap, `${where}: shaded cap missing`);
    if (cap) {
      f.ok(cap.points.every(p => near(Math.hypot(p[0], p[1]), R) && p[1] >= a - 1e-9), `${where}: cap polygon must consist of arc points above the plane (got first ${cap.points[0]}, last ${cap.points[cap.points.length - 1]})`);
      f.ok(rel(shoelace(cap.points), R * R / 2 * (PI / 2 - 1), 2e-2), `${where}: shaded area ${shoelace(cap.points)} vs cap segment ${R * R / 2 * (PI / 2 - 1)}`);
    }
    f.ok(segment(fig, [-1.5 * a, a], [1.5 * a, a], 'accent2'), `${where}: plane line missing`);
    f.ok(lineShapes(fig).some(l => (l.label ?? '').includes(`z = ${a}`)), `${where}: plane label z = ${a} missing`);
    const tip: Pt = [R * Math.sin(PI / 6), R * Math.cos(PI / 6)], inn: Pt = [a * Math.tan(PI / 6), a];
    f.ok(segment(fig, [0, 0], tip, 'warn'), `${where}: ray from O to the sphere (phi = 30 degrees) missing`);
    f.ok(pointShapes(fig).some(p => ptNear(p.at, inn) && p.label), `${where}: entry point on the plane missing`);
    f.ok(pointShapes(fig).some(p => ptNear(p.at, tip) && p.label), `${where}: exit point on the sphere missing`);
    f.ok(pointShapes(fig).some(p => ptNear(p.at, [0, 0])), `${where}: O missing`);
    f.ok(segment(fig, [-1.8 * a, 0], [1.8 * a, 0]) || segment(fig, [-1.8 * a, 0], [1.8 * a, 0], 'axis'), `${where}: x-axis missing`);
    f.ok(fig.alt.includes(radiusText) && fig.alt.includes(`z = ${a}`), `${where}: alt numbers`);
  }));
  it('cone-setup: the learner\'s integral over the cone region equals the grid volume; figure = sector', () => everySeed((index, lang, f) => {
    const card = getCard(52, index, lang, 'cone-setup');
    const m = rx(card.prompt, /ρ ≤ (\d+) (?:and|且) φ ≤ ([^\s;；(（]+)/, 'a,alpha');
    const a = Number(m[1]), alphaText = m[2];
    const alphaN = alphaText === 'π/3' ? 1 : alphaText === '2π/3' ? 2 : NaN;
    f.ok([2, 3, 4, 6].includes(a) && (alphaN === 1 || alphaN === 2), `a ${a} α ${alphaText}`);
    f.ok(clean(card.prompt).includes(`ρ = ${a}`) && clean(card.prompt).includes(`φ = ${alphaText}`), 'sphere and cone equations printed');
    const truth = conePieces(alphaN).k * a ** 3 * PI;
    const integral = (v: string[]) => {
      const t1 = ev(v[0]), t2 = ev(v[1]), t3 = ev(v[2]);
      return simpson(th => simpson(phi => simpson(rho => ev(v[3], { ρ: rho, φ: phi }), 0, t3, 16), 0, t2, 64), 0, t1, 4);
    };
    checkSlots(card, truth, integral, 4e-3, `seed ${index} ${lang} cone a=${a} α=${alphaText}`, f);
    const expected = ['2π', alphaText, `${a}`, 'ρ² sin φ'];
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(expected), `seed ${index}: answers ${card.slots!.answers} vs plan ${expected}`);
    const planTokens = ['π', '2π', 'π/3', '2π/3', `${a}`, 'ρ² sin φ', 'ρ sin φ', 'ρ²', 'ρ² cos φ'];
    f.ok(JSON.stringify([...card.slots!.tokens].sort()) === JSON.stringify([...planTokens].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)} vs plan ${JSON.stringify(planTokens)}`);
    coneSector(card, a, alphaN, alphaText, `seed ${index} ${lang} cone-setup`, f);
  }));
  it('cone-volume: k from a 400^3 voxel count of {rho <= a, phi <= alpha}', () => everySeed((index, lang, f) => {
    const card = getCard(52, index, lang, 'cone-volume');
    const m = rx(card.prompt, /ρ ≤ (\d+) (?:and|且) φ ≤ ([^\s;；(（]+)/, 'a,alpha');
    const a = Number(m[1]), alphaN = m[2] === 'π/3' ? 1 : m[2] === '2π/3' ? 2 : NaN;
    f.ok(alphaN === 1 || alphaN === 2, `α ${m[2]}`);
    auditIs(card, 'MIT-MV-52:cone-volume', { a, alphaN }, `seed ${index} ${lang}`, f);
    const k = conePieces(alphaN).k * a ** 3;
    f.ok(rel(card.fields![0].answer, k, 3e-3), `seed ${index} ${lang} cone-volume a=${a} α=${m[2]}: voxel k ${k}, card ${card.fields![0].answer}`);
    gradeNumeric(card, [card.fields![0].answer], 1e-12, `seed ${index} ${lang} cone-volume self`, f);
    coneSector(card, a, alphaN, m[2], `seed ${index} ${lang} cone-volume`, f);
  }));
  it('cone-centroid: mean z over the voxels of the cone region', () => everySeed((index, lang, f) => {
    const card = getCard(52, index, lang, 'cone-centroid');
    const m = rx(card.prompt, /ρ ≤ (\d+) (?:and|且) φ ≤ ([^\s;；(（]+)/, 'a,alpha');
    const a = Number(m[1]), alphaN = m[2] === 'π/3' ? 1 : m[2] === '2π/3' ? 2 : NaN;
    auditIs(card, 'MIT-MV-52:cone-centroid', { a, alphaN }, `seed ${index} ${lang}`, f);
    const zbar = conePieces(alphaN).zbar * a;
    f.ok(rel(card.fields![0].answer, zbar, 3e-3), `seed ${index} ${lang} cone-centroid a=${a} α=${m[2]}: voxel mean ${zbar}, card ${card.fields![0].answer}`);
    gradeNumeric(card, [card.fields![0].answer], 1e-12, `seed ${index} ${lang} cone-centroid self`, f);
    const k = getCard(52, index, lang, 'cone-volume').fields![0].answer;
    const quoted = clean(card.hint).match(/(?:volume is|体积是) V = (\S+?)[.。]$/);
    f.ok(quoted, `seed ${index}: hint should quote V = k pi: ${card.hint}`);
    if (quoted) f.ok(near(ev(quoted[1]), k * PI, 1e-9), `seed ${index} ${lang}: hint quotes V = ${quoted[1]}, previous card k pi = ${k * PI}`);
  }));
  it('challenge: cap volume by slicing and by the spherical integral', () => everySeed((index, lang, f) => {
    const card = getCard(52, index, lang, 'challenge');
    const R = num((lang === 'en' ? rx(card.prompt, /radius (\d+)/, 'R') : rx(card.prompt, /半径为 (\d+)/, 'R'))[1], 'R');
    const d = num(rx(card.prompt, /z = (\d+)/, 'd')[1], 'd');
    f.ok(R >= 3 && R <= 6 && d >= 1 && d < R, `R ${R} d ${d}`);
    auditIs(card, 'MIT-MV-52:challenge', { R, d }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [capK(R, d)], 1e-8, `seed ${index} ${lang} challenge R=${R} d=${d}`, f);
  }));
  it('explanations state the accepted answers (to-cartesian, to-spherical, cone, cap)', () => {
    explanationsOf(52, ['cone-volume', 'cone-centroid', 'challenge']);
    everySeed((index, lang, f) => {
      const cart = getCard(52, index, lang, 'to-cartesian'), where = `seed ${index} ${lang} to-cartesian`;
      const text = clean(cart.explanation);
      const zr = text.match(/z = ρ cos φ = .*? = ([^.。]+?)[.。]/), rr = text.match(/r = ρ sin φ = ([^.。]+?)[.。]/), xy = text.match(/x = r cos\(.*?\) = (\S+?)(?: and |，)y = r sin\(.*?\) = ([^.。]+?)[.。]/);
      f.ok(zr && rr && xy, `${where}: cannot parse explanation "${cart.explanation}"`);
      if (zr && xy) {
        const [x, y, z] = cart.fields!.map(fl => fl.answer);
        f.ok(near(ev(zr[1]), z, 1e-9) && near(ev(xy[1]), x, 1e-9) && near(ev(xy[2]), y, 1e-9), `${where}: explanation says x=${xy[1]}, y=${xy[2]}, z=${zr[1]}; answers ${x}, ${y}, ${z}`);
        const a = Number(cart.audit!.params.a);
        const phi = angleOf(rx(cart.prompt, /φ = ([^,，]+)[,，]/, 'phi')[1]);
        f.ok(rr && near(ev(rr[1]), a * Math.sin(phi), 1e-9), `${where}: explanation r = ${rr?.[1]} vs ${a * Math.sin(phi)}`);
        f.ok(!/\d\.\d/.test(zr[1] + xy[1] + xy[2]), `${where}: decimal in an exact value`);
      }
      const sph = getCard(52, index, lang, 'to-spherical'), w2 = `seed ${index} ${lang} to-spherical`;
      const t2 = clean(sph.explanation);
      const mr = t2.match(/ρ = √\(.*\) = (\S+?)[.。] ?cos φ/), mp = t2.match(/(?:so|所以) φ = (\S+?)[.。]/), mt = t2.match(/θ = (\S+?)[.。]\s*$/), mq = t2.match(/(?:in the (\w+) quadrant|在(第.)象限)/);
      f.ok(mr && mp && mt && mq, `${w2}: cannot parse explanation "${sph.explanation}"`);
      if (mr && mp && mt && mq) {
        const [rho, phi, theta] = sph.fields!.map(fl => fl.answer);
        f.ok(near(ev(mr[1]), rho, 1e-9) && near(angleOf(mp[1]), phi, 1e-9) && near(angleOf(mt[1]), theta, 1e-9), `${w2}: explanation says ρ=${mr[1]} φ=${mp[1]} θ=${mt[1]}; answers ${rho} ${phi} ${theta}`);
        const P = rx(sph.prompt, /P = \(([^)]*)\)/, 'P')[1].split(',').map(part => ev(part.trim()));
        const quadrant = P[0] > 0 && P[1] > 0 ? ['first', '第一'] : P[0] < 0 && P[1] > 0 ? ['second', '第二'] : P[0] < 0 && P[1] < 0 ? ['third', '第三'] : ['fourth', '第四'];
        f.ok(mq[1] === quadrant[0] || mq[2] === quadrant[1], `${w2}: quadrant ${mq[1] ?? mq[2]} vs ${quadrant}`);
        f.ok(!/\d\.\d/.test(t2), `${w2}: decimal in the explanation: ${sph.explanation}`);
      }
    });
  });
  it('variety', () => {
    for (const slug of ['to-cartesian', 'to-spherical', 'pole-choice', 'circle-surface', 'cap-limits', 'cone-setup', 'cone-volume', 'cone-centroid', 'challenge']) expect(distinctCount(52, slug, slug === 'pole-choice' ? fullKey : plainKey), slug).toBeGreaterThanOrEqual(6);
  });
});

// ======================================================================================================
// MIT-MV-53
// ======================================================================================================
/** Rings at distance r from the axis (z from 0 up to the sphere); z = r sinh u makes the inner integral smooth. */
const hemiForce = memo((a: number, c: number, radial: number) => 2 * PI * gauss(r => {
  const dens = radial ? r : c, zmax = Math.sqrt(a * a - r * r);
  return dens * adapt(u => Math.sinh(u) / Math.cosh(u) ** 2, 0, Math.asinh(zmax / r), 1e-14);
}, 0, a, 100));
const capForce = memo((b: number, d: number) => 2 * PI * gauss(z => ringPull(z, Math.sqrt(b * b - z * z), () => 1), d, b, 200));
const ballForce = memo((a: number, c: number, R: number) => 2 * PI * gauss(z => ringPull(z, Math.sqrt(a * a - (z - R) ** 2), () => c), R - a, R + a, 200));
const SHELL_SETS = [[1, 3, 3], [2, 2, 4], [2, 3, 6], [1, 2, 4], [1, 2, 2], [3, 1, 6], [1, 1, 2], [2, 1, 4], [3, 2, 6]];
const fmtKey = (vals: number[]) => vals.join(',');

function halfBall(card: PracticeCard, a: number, where: string, f: Fails) {
  const fig = card.figure;
  if (!fig) { f.list.push(`${where}: figure missing`); return; }
  viewIs(card, [-1.3 * a, 1.3 * a, -1.3 * a, 1.3 * a], where, f);
  const half = areaShapes(fig)[0];
  f.ok(half, `${where}: half-ball area missing`);
  if (half) {
    f.ok(half.points.every(p => (near(Math.hypot(p[0], p[1]), a) && p[1] >= -1e-9) || (Math.abs(p[1]) < 1e-9 && Math.abs(p[0]) <= a + 1e-9)), `${where}: half-ball polygon not bounded by the upper semicircle and the x-axis`);
    f.ok(half.points.some(p => ptNear(p, [a, 0])) && half.points.some(p => ptNear(p, [-a, 0])), `${where}: semicircle end points`);
    f.ok(rel(shoelace(half.points), PI * a * a / 2, 1e-2), `${where}: area ${shoelace(half.points)} vs ${PI * a * a / 2}`);
  }
  f.ok(segment(fig, [0, -0.3 * a], [0, 1.2 * a], 'axis'), `${where}: z-axis (0,-0.3a)-(0,1.2a) missing`);
  f.ok(lineShapes(fig).some(l => l.tone === 'axis' && l.points.length === 2 && l.points.every(p => Math.abs(p[1]) < 1e-12) && (l.label ?? '') === 'x'), `${where}: x-axis line missing`);
  f.ok(pointShapes(fig).some(p => ptNear(p.at, [0, 0]) && p.label === 'O'), `${where}: O`);
  f.ok(textShapes(fig).some(t => t.text === `${a}` && ptNear(t.at, [0.55 * a, 0.25 * a])), `${where}: radius text ${a} at (0.55a, 0.25a)`);
  f.ok(fig.alt.includes(`${a}`), `${where}: alt has the radius`);
}

describe('MIT-MV-53 oracle', () => {
  it('has exactly the five approved audit kinds, each on every seed; deck shape, language and end sentence', () => everySeed((index, lang, f) => {
    const cards = deck(53, index, lang);
    const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
    f.ok(JSON.stringify(kinds) === JSON.stringify(['MIT-MV-53:cap-force', 'MIT-MV-53:challenge', 'MIT-MV-53:hemisphere-radial', 'MIT-MV-53:hemisphere-uniform', 'MIT-MV-53:shell-exterior']), `seed ${index} ${lang}: kinds ${kinds}`);
    f.ok(cards.every(c => !c.fields || c.audit), `seed ${index}: unaudited numeric card`);
    f.ok(JSON.stringify(cards.map(c => c.id)) === JSON.stringify(['z-component', 'force-setup', 'hemisphere-uniform', 'hemisphere-radial', 'cap-limits', 'cap-force', 'shell-exterior', 'not-general', 'challenge'].map(s => `MIT-MV-53-${s}`)), `seed ${index}: order ${cards.map(c => c.id)}`);
    cards.forEach(c => { for (const p of languageProblems(c, lang)) f.list.push(`seed ${index} ${lang} ${c.id}: ${p}`); checkFigureGeneric(c, `seed ${index} ${lang} ${c.id}`, f); });
    for (const c of cards) bothLanguagesAgree(53, index, c.id.slice('MIT-MV-53-'.length), f);
    f.ok(cards[cards.length - 1].explanation.endsWith(END_53[lang]), `seed ${index} ${lang}: challenge explanation must end with the does-not-assess sentence`);
    for (const c of cards) if (c.audit || c.slots) if (/Fz|F\b/.test(c.prompt) && !/hemisphere|cap|ball|球/.test(c.id + c.prompt)) f.ok(true, '');
    for (const c of cards.filter(x => ['force-setup', 'hemisphere-uniform', 'hemisphere-radial', 'cap-limits', 'cap-force', 'shell-exterior'].some(s => x.id.endsWith(s)))) f.ok(lang === 'en' ? /Take G = 1/.test(c.prompt) : /取 G = 1/.test(c.prompt), `seed ${index} ${lang} ${c.id}: G = 1 not stated`);
    for (const c of cards.filter(x => /φ/.test(x.prompt))) f.ok(lang === 'en' ? /φ (is )?measured from the positive z-axis|angle φ with the positive z-axis/.test(c.prompt) : /φ 是从正 z 轴量起的角|与正 z 轴夹角为 φ/.test(c.prompt), `seed ${index} ${lang} ${c.id}: φ convention`);
  }));

  it('z-component: only G dm cos(phi)/rho^2 equals the z-component of the pull for every phi and rho', () => everySeed((index, lang, f) => {
    const card = getCard(53, index, lang, 'z-component');
    const test = (o: string) => {
      const rhs = clean(o).replace(/^ΔFz = /, '').replace('G Δm', '1');
      return [[0.3, 1.4], [0.9, 2.2], [1.2, 0.7]].every(([phi, rho]) => {
        const direction = [Math.sin(phi), 0, Math.cos(phi)];
        const zComponent = direction[2] / (rho * rho);
        return near(ev(rhs, { φ: phi, ρ: rho }), zComponent, 1e-9);
      });
    };
    const good = card.choice!.options.map(test);
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: ${card.choice!.options} -> ${good}, answer ${card.choice!.answer}`);
    const fig = card.figure!, where = `seed ${index} ${lang} z-component`;
    viewIs(card, [-1, 4, -1, 4], where, f);
    const q = pointShapes(fig).find(p => p.label === 'Δm');
    const phiF = q ? Math.atan2(q.at[0], q.at[1]) : NaN;
    f.ok(q && near(Math.hypot(q.at[0], q.at[1]), 3) && [PI / 6, PI / 4, PI / 3].some(v => near(v, phiF)), `${where}: Δm point ${q?.at}`);
    if (q) {
      f.ok(lineShapes(fig).some(l => l.dash === true && l.label === 'ρ' && ptNear(l.points[0], [0, 0]) && ptNear(l.points[l.points.length - 1], q.at)), `${where}: dashed ρ line O-Q missing`);
      f.ok(arrowShapes(fig).some(ar => ptNear(ar.from, [0, 0]) && ptNear(ar.to, [1.2 * Math.sin(phiF), 1.2 * Math.cos(phiF)]) && ar.tone === 'warn'), `${where}: pull arrow to 40% of the way missing`);
      const arc = lineShapes(fig).find(l => l.points.length > 10 && l.points.every(p => near(Math.hypot(p[0], p[1]), 0.8)));
      f.ok(arc && ptNear(arc.points[0], [0, 0.8]) && ptNear(arc.points[arc.points.length - 1], [0.8 * Math.sin(phiF), 0.8 * Math.cos(phiF)]), `${where}: angle arc from the z-axis to the ray at radius 0.8 missing`);
      f.ok(textShapes(fig).some(t => t.text === 'φ' && ptNear(t.at, [0.55 * Math.sin(phiF / 2) + 0.1, 0.55 * Math.cos(phiF / 2)])), `${where}: φ text position`);
    }
    f.ok(segment(fig, [-0.8, 0], [3.8, 0], 'axis') && segment(fig, [0, -0.8], [0, 3.8], 'axis'), `${where}: axes`);
  }));
  it('z-component: variety over wording, figure angle and option order', () => {
    expect(distinctCount(53, 'z-component', fullKey)).toBeGreaterThanOrEqual(6);
    const wordings = new Set<string>(), angles = new Set<string>();
    for (let index = 0; index < SEEDS; index++) { const c = getCard(53, index, 'en', 'z-component'); wordings.add(c.prompt); angles.add(String(c.figure!.shapes.find(s => s.kind === 'point' && (s as { label?: string }).label === 'Δm' && true) && JSON.stringify((c.figure!.shapes.find(s => s.kind === 'point' && (s as { label?: string }).label === 'Δm') as { at: Pt }).at))); }
    expect(wordings.size).toBe(2);
    expect(angles.size).toBe(3);
  });
  it('force-setup: the learner\'s integral for Fz of the upper half-ball equals pi a c, computed as a vector sum of rings', () => everySeed((index, lang, f) => {
    const card = getCard(53, index, lang, 'force-setup');
    const a = num((lang === 'en' ? rx(card.prompt, /radius (\d+)/, 'a') : rx(card.prompt, /半径为 (\d+)/, 'a'))[1], 'a'), c = num(rx(card.prompt, /δ = (\d+)/, 'c')[1], 'c');
    f.ok(a >= 2 && a <= 6 && c >= 2 && c <= 5, `a ${a} c ${c}`);
    const truth = hemiForce(a, c, 0);
    const integral = (v: string[]) => 2 * PI * simpson(phi => simpson(rho => ev(v[1], { ρ: rho, φ: phi }), 0, a, 16), 0, ev(v[0]), 200);
    checkSlots(card, truth, integral, 1e-7, `seed ${index} ${lang} force-setup a=${a} c=${c}`, f);
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(['π/2', `${c} cos φ sin φ`]), `seed ${index}: answers ${card.slots!.answers}`);
    f.ok(JSON.stringify([...card.slots!.tokens].sort()) === JSON.stringify(['π/2', 'π', 'π/4', '2π', `${c} cos φ sin φ`, `${c} cos φ / ρ²`, `${c} ρ² cos φ sin φ`, `${c} cos φ`].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    f.ok(clean(card.slots!.between!.join('')).includes(`${a}`), `seed ${index} ${lang}: radius ${a} appears in the slot text`);
    halfBall(card, a, `seed ${index} ${lang} force-setup`, f);
  }));
  it('hemisphere-uniform: Fz as the vector sum of the pull of horizontal rings', () => everySeed((index, lang, f) => {
    const card = getCard(53, index, lang, 'hemisphere-uniform');
    const a = num((lang === 'en' ? rx(card.prompt, /radius (\d+)/, 'a') : rx(card.prompt, /半径为 (\d+)/, 'a'))[1], 'a'), c = num(rx(card.prompt, /δ = (\d+)/, 'c')[1], 'c');
    f.ok(a >= 2 && a <= 6 && c >= 2 && c <= 5, `a ${a} c ${c}`);
    auditIs(card, 'MIT-MV-53:hemisphere-uniform', { a, c }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [hemiForce(a, c, 0)], 1e-7, `seed ${index} ${lang} hemisphere-uniform a=${a} c=${c}`, f);
    f.ok(near(card.fields![0].answer / PI, a * c, 1e-9), 'integer multiple of pi');
    halfBall(card, a, `seed ${index} ${lang} hemisphere-uniform`, f);
    f.ok(!near(card.fields![0].answer, 3.5 * PI), 'the printed example 7pi/2 must not be the answer');
  }));
  it('hemisphere-radial: density sqrt(x^2+y^2) by rings', () => everySeed((index, lang, f) => {
    const card = getCard(53, index, lang, 'hemisphere-radial');
    const a = num((lang === 'en' ? rx(card.prompt, /radius (\d+)/, 'a') : rx(card.prompt, /半径为 (\d+)/, 'a'))[1], 'a');
    f.ok([2, 3, 4, 6, 8, 9].includes(a), `a ${a}`);
    auditIs(card, 'MIT-MV-53:hemisphere-radial', { a }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [hemiForce(a, 0, 1)], 1e-7, `seed ${index} ${lang} hemisphere-radial a=${a}`, f);
    f.ok(!card.figure, 'plan: no figure');
  }));
  it('cap-limits: the learner\'s bounds integrate cos(phi) sin(phi) over the cap to the cap\'s pull (rings), and no other token does', () => everySeed((index, lang, f) => {
    const card = getCard(53, index, lang, 'cap-limits');
    const b = num((lang === 'en' ? rx(card.prompt, /radius (\d+)/, 'b') : rx(card.prompt, /半径为 (\d+)/, 'b'))[1], 'b'), d = num(rx(card.prompt, /z = (\d+)/, 'd')[1], 'd');
    f.ok(b === 2 * d && d >= 1 && d <= 8, `b ${b} d ${d}`);
    const truth = capForce(b, d);
    const integral = (v: string[]) => 2 * PI * simpson(phi => { const lo = ev(v[1], { φ: phi }), hi = ev(v[2], { φ: phi }); return Math.cos(phi) * Math.sin(phi) * (hi - lo); }, 0, ev(v[0]), 400);
    checkSlots(card, truth, integral, 1e-7, `seed ${index} ${lang} cap53 b=${b} d=${d}`, f);
    const expected = ['π/3', d === 1 ? '1/cos φ' : `${d}/cos φ`, `${b}`];
    f.ok(JSON.stringify(card.slots!.answers) === JSON.stringify(expected), `seed ${index}: answers ${card.slots!.answers} vs ${expected}`);
    const planTokens = d === 1 ? ['π/3', 'π/4', 'π/6', 'π/2', '1/cos φ', 'cos φ', '1', '2'] : ['π/3', 'π/4', 'π/6', 'π/2', `${d}/cos φ`, `${d} cos φ`, `${d}`, `${b}`];
    f.ok(JSON.stringify([...card.slots!.tokens].sort()) === JSON.stringify([...planTokens].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)} vs plan ${JSON.stringify(planTokens)}`);
    const fig = card.figure!, where = `seed ${index} ${lang} cap-limits53`;
    const circle = lineShapes(fig).find(l => l.tone === 'muted' && l.points.length > 36 && l.points.every(p => near(Math.hypot(p[0], p[1]), b)));
    f.ok(circle, `${where}: sphere circle radius ${b} missing`);
    const cap = areaShapes(fig)[0];
    if (cap) {
      f.ok(cap.points.every(p => near(Math.hypot(p[0], p[1]), b) && p[1] >= d - 1e-9), `${where}: cap polygon must consist of arc points above z = ${d}`);
      const theta = 2 * Math.acos(d / b);
      f.ok(rel(shoelace(cap.points), b * b / 2 * (theta - Math.sin(theta)), 2e-2), `${where}: cap area ${shoelace(cap.points)}`);
    } else f.list.push(`${where}: cap missing`);
    const plane = lineShapes(fig).find(l => l.points.length === 2 && l.points.every(p => near(p[1], d)) && (l.label ?? '').includes(`z = ${d}`));
    f.ok(plane && Math.abs(plane.points[0][0] - plane.points[1][0]) / 2 >= Math.sqrt(b * b - d * d) - 1e-9, `${where}: plane line z = ${d} must span the whole chord (half width ${Math.sqrt(b * b - d * d)})`);
    const tip: Pt = [b * Math.cos(7 * PI / 18), b * Math.sin(7 * PI / 18)], inn: Pt = [d / Math.tan(7 * PI / 18), d];
    f.ok(segment(fig, [0, 0], tip, 'warn'), `${where}: ray at 70 degrees from the x-axis`);
    f.ok(pointShapes(fig).some(p => ptNear(p.at, inn) && p.label) && pointShapes(fig).some(p => ptNear(p.at, tip) && p.label), `${where}: in/out points`);
    f.ok(fig.alt.includes(`${b}`) && fig.alt.includes(`z = ${d}`), `${where}: alt numbers`);
  }));
  it('cap-force: rings of the cap', () => everySeed((index, lang, f) => {
    const card = getCard(53, index, lang, 'cap-force');
    const b = num((lang === 'en' ? rx(card.prompt, /radius (\d+)/, 'b') : rx(card.prompt, /半径为 (\d+)/, 'b'))[1], 'b'), d = num(rx(card.prompt, /z = (\d+)/, 'd')[1], 'd');
    f.ok(b === 2 * d, `b ${b} d ${d}`);
    auditIs(card, 'MIT-MV-53:cap-force', { b, d }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [capForce(b, d)], 1e-7, `seed ${index} ${lang} cap-force b=${b} d=${d}`, f);
  }));
  it('shell-exterior: direct attraction of the ball by rings (no theorem)', () => everySeed((index, lang, f) => {
    const card = getCard(53, index, lang, 'shell-exterior');
    const [a, c] = (lang === 'en' ? rx(card.prompt, /radius (\d+) and density (\d+)/, 'a,c') : rx(card.prompt, /半径为 (\d+)、密度为 (\d+)/, 'a,c')).slice(1).map(Number);
    const R = num(rx(card.prompt, /\(0, 0, (\d+)\)/, 'R')[1], 'R');
    f.ok(SHELL_SETS.some(s => fmtKey(s) === fmtKey([a, c, R])), `(${a},${c},${R}) outside plan sampling`);
    f.ok(clean(card.prompt).includes(`${R} > ${a}`), 'R > a stated');
    auditIs(card, 'MIT-MV-53:shell-exterior', { a, c, R }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [ballForce(a, c, R)], 1e-7, `seed ${index} ${lang} shell a=${a} c=${c} R=${R}`, f);
  }));
  it('not-general: only "true for the ball, not for every solid" is correct', () => everySeed((index, lang, f) => {
    const card = getCard(53, index, lang, 'not-general');
    const test = (o: string) => lang === 'en' ? /^True for a uniform solid ball, but not for every uniform solid\.$/.test(o) : /^对均匀实心球成立，但并非对每个均匀实心体都成立。$/.test(o);
    const good = card.choice!.options.map(test);
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: ${good} answer ${card.choice!.answer}`);
    f.ok(new Set(card.choice!.options).size === 4, 'distinct');
  }));
  it('not-general: two wordings and many option orders', () => {
    const w = new Set<string>();
    for (let index = 0; index < SEEDS; index++) w.add(getCard(53, index, 'en', 'not-general').prompt);
    expect(w.size).toBe(2);
    expect(distinctCount(53, 'not-general', fullKey)).toBeGreaterThanOrEqual(6);
  });
  it('challenge: average distance from a diameter, cylindrical route', () => everySeed((index, lang, f) => {
    const card = getCard(53, index, lang, 'challenge');
    const a = num((lang === 'en' ? rx(card.prompt, /radius (\d+)/, 'a') : rx(card.prompt, /半径为 (\d+)/, 'a'))[1], 'a');
    f.ok([2, 4, 8, 16, 24, 32].includes(a), `a ${a}`);
    auditIs(card, 'MIT-MV-53:challenge', { a }, `seed ${index} ${lang}`, f);
    const total = integrate(t => 2 * PI * simpson(r => r * r, 0, a * Math.cos(t), 16) * a * Math.cos(t), -PI / 2, PI / 2);
    gradeNumeric(card, [total / (4 / 3 * PI * a ** 3)], 1e-8, `seed ${index} ${lang} challenge a=${a}`, f);
  }));
  it('explanations state the accepted answer', () => explanationsOf(53, ['hemisphere-uniform', 'hemisphere-radial', 'cap-force', 'shell-exterior', 'challenge']));
  it('variety', () => {
    for (const slug of ['force-setup', 'hemisphere-uniform', 'hemisphere-radial', 'cap-limits', 'cap-force', 'shell-exterior', 'challenge']) expect(distinctCount(53, slug, plainKey), slug).toBeGreaterThanOrEqual(6);
  });
});
void exactPi;
