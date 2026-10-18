import { describe, expect, it, vi } from 'vitest';
import { mv68 } from './games/mv68';
import { mv69 } from './games/mv69';
import { spreadSeed } from './deck-invariants';
import { simpson } from './oracle-harness';
import { gradeCard, type CardGenerator, type GameLanguage, type PracticeCard } from '../types';
import { num } from './support';
import { figureProblems, project3d, type Figure, type FigureShape, type Pt } from '../figure';

/**
 * Acceptance oracle for MIT-MV-68 (Final Review) and MIT-MV-69 (Final Exam). The numeric answers are recomputed from
 * the plan's definitions by quadrature, finite differences and matrix inverses, never from a generator closed form.
 * Written against docs/mit-mv-drafts/approved-68-69.md before the generators were read.
 */
vi.setConfig({ testTimeout: 300000 });
const SEEDS = 60;
const PI = Math.PI;
type Lang = GameLanguage;
const LANGS: Lang[] = ['en', 'zh'];
const generators: Record<number, CardGenerator> = { 68: mv68, 69: mv69 };

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
    // first 12 messages are enough to identify the failing card; the count is the summary
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
const clean = (text: string) => text.replaceAll('−', '-').replaceAll('·', '*').replaceAll(' ', ' ').replaceAll(' ', ' ');
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const ptNear = (p: Pt, q: Pt, tol = 1e-9) => near(p[0], q[0], tol) && near(p[1], q[1], tol);
function integrate(fn: (value: number) => number, lo: number, hi: number): number {
  let previous = simpson(fn, lo, hi, 32);
  if (!Number.isFinite(previous)) throw new Error(`non-finite integrand on [${lo}, ${hi}]`);
  for (let panels = 64; panels <= 8192; panels *= 2) {
    const current = simpson(fn, lo, hi, panels);
    if (!Number.isFinite(current)) throw new Error(`non-finite integrand on [${lo}, ${hi}]`);
    if (Math.abs(current - previous) / 15 < 2e-11 * Math.max(1, Math.abs(current))) return current + (current - previous) / 15;
    previous = current;
  }
  throw new Error(`quadrature did not stabilise on [${lo}, ${hi}]`);
}
function fd(f: (x: number, y: number, z: number) => number, p: [number, number, number], axis: 0 | 1 | 2, h = 1e-5): number {
  const a = [...p] as [number, number, number]; const b = [...p] as [number, number, number];
  a[axis] += h; b[axis] -= h;
  return (f(a[0], a[1], a[2]) - f(b[0], b[1], b[2])) / (2 * h);
}
type V3 = (x: number, y: number, z: number) => [number, number, number];
function curl(F: V3, p: [number, number, number]): [number, number, number] {
  const M = (x: number, y: number, z: number) => F(x, y, z)[0];
  const N = (x: number, y: number, z: number) => F(x, y, z)[1];
  const P = (x: number, y: number, z: number) => F(x, y, z)[2];
  return [fd(P, p, 1) - fd(N, p, 2), fd(M, p, 2) - fd(P, p, 0), fd(N, p, 0) - fd(M, p, 1)];
}
const norm3 = (v: [number, number, number]) => Math.hypot(v[0], v[1], v[2]);

// ---------- small linear algebra ----------
function det3(a: number[][]): number {
  if (a.length === 1) return a[0][0];
  if (a.length === 2) return a[0][0] * a[1][1] - a[0][1] * a[1][0];
  return a[0].reduce((s, v, j) => s + (j % 2 ? -1 : 1) * v * det3(a.slice(1).map(r => r.filter((_, k) => k !== j))), 0);
}
/** Inverse of a 3x3 matrix by the adjugate; null when singular. */
function inv3(m: number[][]): number[][] | null {
  const d = det3(m);
  if (Math.abs(d) < 1e-12) return null;
  const c = (i: number, j: number) => Math.pow(-1, i + j) * det3(m.filter((_, r) => r !== i).map(row => row.filter((_, k) => k !== j)));
  const adj = [[c(0, 0), c(0, 1), c(0, 2)], [c(1, 0), c(1, 1), c(1, 2)], [c(2, 0), c(2, 1), c(2, 2)]];
  return [[adj[0][0], adj[1][0], adj[2][0]], [adj[0][1], adj[1][1], adj[2][1]], [adj[0][2], adj[1][2], adj[2][2]]].map(row => row.map(v => v / d));
}

// ---------- expression evaluator for slot tokens such as `3y`, `y/4`, `√y`, `ρ⁴ cos²φ sin φ`, `3 sec φ` ----------
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
    if (FN.includes(t)) {
      let exponent = 1;
      while (tokens[p] === '²' || tokens[p] === '³') exponent = tokens[p++] === '²' ? 2 : 3;
      const argument = atom();
      const base = t === 'sin' ? Math.sin(argument) : t === 'cos' ? Math.cos(argument) : t === 'tan' ? Math.tan(argument) : t === 'sec' ? 1 / Math.cos(argument) : 1 / Math.sin(argument);
      return exponent === 1 ? base : base ** exponent;
    }
    if (t === 'π') return PI;
    if (/^\d/.test(t)) return Number(t);
    if (env[t] === undefined) throw new Error(`unbound ${t} in "${source}"`);
    return env[t];
  };
  const power = (): number => { let v = atom(); while (tokens[p] === '²' || tokens[p] === '³' || tokens[p] === '⁴') v **= tokens[p++] === '²' ? 2 : tokens[p - 1] === '³' ? 3 : 4; return v; };
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
const evOrNaN = (source: string, env: Record<string, number> = {}): number => { try { return ev(source, env); } catch { return NaN; } };
function exactString(v: number): string {
  for (let q = 1; q <= 24; q++) { const p = Math.round(v * q); if (Math.abs(v - p / q) < 1e-7) return q === 1 ? `${p}` : `${p}/${q}`; }
  for (let q = 1; q <= 24; q++) { const p = Math.round(v * q / PI); if (Math.abs(v - p * PI / q) < 1e-9) return `${p}pi${q === 1 ? '' : `/${q}`}`; }
  throw new Error(`no exact form for ${v}`);
}
const rx = (text: string, pattern: RegExp, label: string): RegExpMatchArray => { const m = clean(text).match(pattern); if (!m) throw new Error(`cannot parse ${label} in "${text}"`); return m; };
const rxl = (text: string, lang: Lang, en: RegExp, zh: RegExp, label: string) => rx(text, lang === 'en' ? en : zh, label);
const cf = (s: string | undefined): number => s === undefined || s === '' ? 1 : s === '-' ? -1 : Number(s);
const has = (text: string, ...needles: string[]) => needles.every(n => clean(text).includes(clean(n)));

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
    if (lang === 'zh' && EN_WORD.test(clean(text))) bad.push(`English word in ZH: ${text.slice(0, 60)}`);
    if (/\$\{|undefined|NaN|\[object|Infinity/.test(text)) bad.push(`template/undefined leftover: ${text.slice(0, 60)}`);
  }
  return bad;
}
function gradeNumeric(card: PracticeCard, expected: number[], tol: number, where: string, f: Fails) {
  f.ok(card.fields?.length === expected.length, `${where}: field count ${card.fields?.length} vs ${expected.length}`);
  if (!card.fields) return;
  expected.forEach((v, i) => {
    const got = card.fields![i].answer;
    f.ok(Math.abs(got - v) <= Math.max(tol * Math.max(1, Math.abs(v)), 1e-9), `${where} field ${i} (${card.fields![i].label}): oracle ${v}, card ${got}`);
  });
  let accepted: string[];
  try { accepted = expected.map(exactString); } catch (error) { f.list.push(`${where}: ${(error as Error).message}`); return; }
  f.ok(gradeCard(card, accepted, null, []) === 'correct', `${where}: accepted ${JSON.stringify(accepted)} does not grade correct`);
  expected.forEach((v, i) => {
    const bad = accepted.slice(); bad[i] = String(v * 1.013 + 0.017);
    f.ok(gradeCard(card, bad, null, []) === 'incorrect', `${where}: perturbed field ${i} grades correct`);
  });
}
function auditIs(card: PracticeCard, kind: string, params: Record<string, number>, where: string, f: Fails) {
  f.ok(card.audit?.kind === kind, `${where}: audit kind ${card.audit?.kind} vs ${kind}`);
  if (!card.audit) return;
  for (const [key, value] of Object.entries(params)) f.ok(card.audit.params[key] === value, `${where}: audit ${key} = ${card.audit.params[key]}, printed ${value}`);
  f.ok(Object.keys(card.audit.params).length === Object.keys(params).length, `${where}: audit params ${JSON.stringify(card.audit.params)} vs ${JSON.stringify(params)}`);
}
const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
/** Numbers visible in the question text before answering (0 and 1 implicit). */
function visibleNumbers(card: PracticeCard, lang: Lang): Set<number> {
  const found = new Set<number>([0, 1]);
  const slots = card.slots ? [card.slots.before, ...(card.slots.between ?? []), card.slots.after ?? ''] : [];
  for (const text of [card.prompt, ...(card.lines ?? []), ...slots]) {
    const t = clean(text).replace(new RegExp(`[${SUP}]`, 'g'), d => ` ${SUP.indexOf(d)} `);
    for (const m of t.matchAll(/\d+(?:\.\d+)?/g)) found.add(Math.abs(Number(m[0])));
  }
  return found;
}
function auditVisible(card: PracticeCard, lang: Lang, where: string, f: Fails) {
  if (!card.audit) return;
  const visible = visibleNumbers(card, lang);
  for (const v of Object.values(card.audit.params)) for (const x of (Array.isArray(v) ? v : [v]))
    f.ok(visible.has(Math.abs(Number(x.toFixed(6)))), `${where}: audit param ${x} is not visible in the question`);
}
function bothLanguagesAgree(game: number, index: number, slug: string, f: Fails) {
  const en = getCard(game, index, 'en', slug), zh = getCard(game, index, 'zh', slug);
  f.ok(JSON.stringify(en.audit) === JSON.stringify(zh.audit), `seed ${index} ${slug}: EN/ZH audit differ`);
  f.ok(JSON.stringify(en.fields?.map(x => x.answer)) === JSON.stringify(zh.fields?.map(x => x.answer)), `seed ${index} ${slug}: EN/ZH answers differ`);
  f.ok(en.choice?.answer === zh.choice?.answer, `seed ${index} ${slug}: EN/ZH choice answer differs`);
  f.ok(JSON.stringify(en.slots?.answers) === JSON.stringify(zh.slots?.answers), `seed ${index} ${slug}: EN/ZH slot answers differ`);
  f.ok(en.slots === undefined || en.slots.tokens.some(t => /[A-Za-z]{3,}/.test(t)) ? zh.slots?.tokens.length === en.slots?.tokens.length : JSON.stringify(en.slots?.tokens) === JSON.stringify(zh.slots?.tokens), `seed ${index} ${slug}: EN/ZH tokens differ`);
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
const areaShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'area' }> => s.kind === 'area');
const textShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'text' }> => s.kind === 'text');
const hasPoint = (fig: Figure, p: Pt, tol = 1e-9) => pointShapes(fig).some(s => ptNear(s.at, p, tol));
const hasArrow = (fig: Figure, from: Pt, to: Pt, tol = 1e-9, label?: string) => arrowShapes(fig).some(s => ptNear(s.from, from, tol) && ptNear(s.to, to, tol) && (label === undefined || s.label === label));
/** The segment A–B is drawn whole, with an orientation arrow from A pointing toward B along it (its head may stop short of B). */
const hasDirectedSegment = (fig: Figure, a: Pt, b: Pt) => fig.shapes.some(s => s.kind === 'line' && s.points.length === 2 && ptNear(s.points[0], a, 1e-9) && ptNear(s.points[1], b, 1e-9))
  && arrowShapes(fig).some(s => ptNear(s.from, a, 1e-9) && Math.abs((s.to[0] - a[0]) * (b[1] - a[1]) - (s.to[1] - a[1]) * (b[0] - a[0])) < 1e-9 && (s.to[0] - a[0]) * (b[0] - a[0]) + (s.to[1] - a[1]) * (b[1] - a[1]) > 0);
const proj = (x: number, y: number, z: number) => project3d([x, y, z]);
type P3 = [number, number, number];
const hasCurve = (fig: Figure, fn: (t: number) => P3, t0: number, t1: number, tol = 1e-9, tone?: string) =>
  lineShapes(fig).some(l => (tone === undefined || l.tone === tone) && l.points.length >= 2 && l.points.every((pt, i) => ptNear(pt, proj(...fn(t0 + (t1 - t0) * i / (l.points.length - 1))), tol)));
function wireProblems(fig: Figure, fn: (u: number, v: number) => P3, u0: number, u1: number, v0: number, v1: number, nu: number, nv: number): string[] {
  const bad: string[] = [];
  for (let i = 0; i <= nu; i++) { const u = u0 + (u1 - u0) * i / nu; if (!hasCurve(fig, v => fn(u, v), v0, v1)) bad.push(`u-curve ${i}`); }
  for (let j = 0; j <= nv; j++) { const v = v0 + (v1 - v0) * j / nv; if (!hasCurve(fig, u => fn(u, v), u0, u1)) bad.push(`v-curve ${j}`); }
  return bad;
}
function axesProblems(fig: Figure, length: number): string[] {
  const bad: string[] = [];
  if (!hasArrow(fig, proj(0, 0, 0), proj(length, 0, 0), 1e-9, 'x')) bad.push('x axis');
  if (!hasArrow(fig, proj(0, 0, 0), proj(0, length, 0), 1e-9, 'y')) bad.push('y axis');
  if (!hasArrow(fig, proj(0, 0, 0), proj(0, 0, length), 1e-9, 'z')) bad.push('z axis');
  return bad;
}
function checkSymbols(card: PracticeCard, answers: string[], where: string, f: Fails) {
  const slots = card.slots;
  f.ok(!!slots, `${where}: not a symbol card`);
  if (!slots) return;
  f.ok(JSON.stringify(slots.answers) === JSON.stringify(answers), `${where}: answers ${JSON.stringify(slots.answers)} vs ${JSON.stringify(answers)}`);
  f.ok(slots.between === undefined || slots.between.length === Math.max(0, slots.answers.length - 1), `${where}: between.length ${slots.between?.length}`);
  slots.answers.forEach(a => f.ok(slots.tokens.includes(a), `${where}: answer "${a}" not in tokens`));
  f.ok(new Set(slots.tokens).size === slots.tokens.length, `${where}: duplicate tokens ${JSON.stringify(slots.tokens)}`);
  f.ok(gradeCard(card, [], null, slots.answers) === 'correct', `${where}: answers do not grade correct`);
  slots.answers.forEach((_, i) => {
    const other = slots.tokens.find(t => t !== slots.answers[i]);
    if (other === undefined) return;
    const bad = slots.answers.slice(); bad[i] = other;
    f.ok(gradeCard(card, [], null, bad) === 'incorrect', `${where}: wrong slot ${i} not graded incorrect`);
  });
}
function assembleCheck(card: PracticeCard, value: (answers: string[]) => number, truth: number, where: string, f: Fails, tol = 1e-8, integrand?: { slot: number; envs: Record<string, number>[] }) {
  const slots = card.slots!;
  const base = value(slots.answers);
  f.ok(near(base, truth, tol), `${where}: assembled answers give ${base}, independent truth ${truth}`);
  slots.answers.forEach((_, i) => {
    for (const token of slots.tokens) {
      if (token === slots.answers[i]) continue;
      const trial = slots.answers.slice(); trial[i] = token;
      const v = value(trial);
      if (integrand && i === integrand.slot && !integrand.envs.every(env => near(evOrNaN(token, env), evOrNaN(slots.answers[i], env), 1e-9))) continue;
      f.ok(!(Number.isFinite(v) && near(v, truth, tol)), `${where}: token "${token}" in slot ${i} also gives the true value ${truth}`);
    }
  });
}
function distinctCount(game: number, slug: string, key: (card: PracticeCard) => string): number {
  const set = new Set<string>();
  for (let index = 0; index < SEEDS; index++) set.add(key(getCard(game, index, 'en', slug)));
  return set.size;
}
const plainKey = (card: PracticeCard) => card.prompt;
const fullKey = (card: PracticeCard) => JSON.stringify([card.prompt, [...(card.choice?.options ?? [])].sort(), card.slots, card.figure?.shapes]);
function answerPositions(game: number, slug: string): Set<number> {
  const set = new Set<number>();
  for (let index = 0; index < SEEDS; index++) set.add(getCard(game, index, 'en', slug).choice!.answer);
  return set;
}
function numbersIn(text: string): number[] { return (clean(text).match(/\d+(?:\.\d+)?/g) ?? []).map(Number); }
function parseFrac(s: string): number { const m = clean(s).trim().replace(/^\(|\)$/g, '').match(/^(-?\d+)(?:\/(\d+))?$/); if (!m) throw new Error(`not a fraction: ${s}`); return Number(m[1]) / (m[2] ? Number(m[2]) : 1); }
/** Parse a linear expression `a x + b y` (coefficient 1 omitted) into its coefficients. */
function linCoef(expr: string): { x: number; y: number } {
  const t = clean(expr).replace(/\s+/g, '');
  let x = 0, y = 0, consumed = 0;
  const re = /([+-]?)(\d*)([xy])/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(t))) { const c = (m[1] === '-' ? -1 : 1) * (m[2] === '' ? 1 : Number(m[2])); if (m[3] === 'x') x += c; else y += c; consumed += m[0].length; }
  if (consumed !== t.length) throw new Error(`not a linear expression: "${expr}"`);
  return { x, y };
}
/** A tuple option `(expr1, expr2)`. */
function tupleOption(o: string): { x: number; y: number }[] {
  const m = rx(o, /\(([^()]*),\s*([^()]*)\)/, 'option tuple');
  return [linCoef(m[1]), linCoef(m[2])];
}
const PHI_EN = 'measured from the positive z-axis', PHI_ZH = '从正 z 轴量起';
function phiProblems(card: PracticeCard, lang: Lang): string[] {
  const texts = [card.prompt, card.hint, card.explanation, ...(card.choice?.options ?? [])];
  if (!texts.some(t => t.includes('φ'))) return [];
  const phrase = lang === 'en' ? PHI_EN : PHI_ZH;
  return texts.some(t => t.includes(phrase)) ? [] : ['φ appears but "measured from the positive z-axis" does not'];
}
const END = {
  68: { en: 'This game does not ask you to prove Green\'s, Stokes\' or the divergence theorem, to find a potential function for a field in space, or to compute the flux through a curved surface in any way other than the divergence theorem or the parametrisation given.', zh: '本游戏不要求证明格林定理、斯托克斯定理或散度定理，不要求为空间中的场求势函数，也不要求用散度定理和所给参数化之外的方法计算穿过曲面的通量。' },
  69: { en: 'This exam game checks set-ups and short computations from each of the four units; it does not ask you to sketch regions or fields, to write full justifications, or to evaluate the long integrals of the original exam.', zh: '本考试游戏检验四个单元中各一部分的积分设定和简短计算；它不要求画出区域或向量场，不要求写完整的论证，也不要求计算原考试中冗长的积分。' },
} as const;

function shapeTests(game: 68 | 69, ids: string[], kinds: string[]) {
  it('deck shape, audit kinds, language, figures, φ rule and end sentence', () => everySeed((index, lang, f) => {
    const cards = deck(game, index, lang);
    const got = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
    f.ok(JSON.stringify(got) === JSON.stringify([...kinds].sort()), `seed ${index} ${lang}: kinds ${JSON.stringify(got)}`);
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
      if (c.fields) for (const field of c.fields) {
        const v = field.answer;
        const shown = exactString(v);
        f.ok(clean(c.explanation).includes(shown), `${where}: the explanation never states the answer ${shown}`);
        const hint = clean(c.hint);
        f.ok(!new RegExp(`(?:=|等于) ?${shown.replace('/', '\\/')}(?![\\d/πA-Za-z])`).test(hint), `${where}: the hint states the answer ${shown}`);
      }
      if (c.choice) f.ok(!clean(c.hint).includes(clean(c.choice.options[c.choice.answer])), `${where}: the hint quotes the correct option`);
      if (c.slots) for (const a of c.slots.answers.filter(a2 => a2.length > 3)) f.ok(!clean(c.hint).includes(clean(a)), `${where}: the hint contains the answer token ${a}`);
    }
    const last = cards[cards.length - 1];
    f.ok(last.explanation.trimEnd().endsWith(END[game][lang]), `seed ${index} ${lang}: challenge explanation must end with the does-not-assess sentence`);
  }));
}

// ======================================================================================================
// MIT-MV-68 — Final Review: Unit 4
// ======================================================================================================
const IDS_68 = ['flux-form', 'flux-area', 'segment-setup', 'segment', 'conservative-ab', 'cap-setup', 'cap-flux', 'curl-setup', 'cylinder-reason', 'challenge'];
const KINDS_68 = ['MIT-MV-68:cap-flux', 'MIT-MV-68:challenge', 'MIT-MV-68:conservative-ab', 'MIT-MV-68:flux-area', 'MIT-MV-68:segment'];

/** Outward flux of F = (P, Q) across the counterclockwise triangle (0,0),(p,0),(0,q) as a line integral. */
function triangleFlux(a: number, b: number, c: number, d: number, p: number, q: number): number {
  const P = (x: number, y: number) => a * x + c * y, Q = (x: number, y: number) => d * x + b * y;
  const s1 = integrate(t => { const x = p * t, y = 0; return -Q(x, y) * p; }, 0, 1);
  const s2 = integrate(t => { const x = p * (1 - t), y = q * t; return q * P(x, y) - (-p) * Q(x, y); }, 0, 1);
  const s3 = integrate(t => { const x = 0, y = q * (1 - t); return -q * P(x, y); }, 0, 1);
  return s1 + s2 + s3;
}
/** Work of (y−x)dx + (y−z)dz along r(t) = A + t(B−A), independent of the plan's α + β/2. */
function segmentWork(A: [number, number, number], B: [number, number, number]): number {
  const v = [B[0] - A[0], B[1] - A[1], B[2] - A[2]];
  return integrate(t => {
    const x = A[0] + v[0] * t, y = A[1] + v[1] * t, z = A[2] + v[2] * t;
    return (y - x) * v[0] + (y - z) * v[2];
  }, 0, 1);
}
/** Flux of F = (a x, b y, z + c) across U: z = h − x² − y², z ≥ 0, normal up, divided by π. */
function capFlux(a: number, b: number, c: number, h: number): number {
  const R = Math.sqrt(h);
  const inner = (theta: number) => simpson(r => {
    const x = r * Math.cos(theta), y = r * Math.sin(theta), z = h - r * r;
    return (a * x * 2 * x + b * y * 2 * y + (z + c)) * r;
  }, 0, R, 80);
  return integrate(inner, 0, 2 * PI) / PI;
}
/** ∮_C F·dr for F = (a z², b y², c xz), C: r(t) = (cos t, 0, z0 + sin t), divided by π. */
function cylinderLoop(a: number, b: number, c: number, z0: number): number {
  return simpson(t => {
    const x = Math.cos(t), y = 0, z = z0 + Math.sin(t);
    const f = [a * z * z, b * y * y, c * x * z];
    const dr = [-Math.sin(t), 0, Math.cos(t)];
    return f[0] * dr[0] + f[1] * dr[1] + f[2] * dr[2];
  }, 0, 2 * PI, 2000) / PI;
}
const field68 = (a: number, b: number, c: number): V3 => (x, y, z) => [a * z * z, b * y * y, c * x * z];

/** The outward normal of a simple closed curve: for the counterclockwise sense n ds = (dy, −dx); for the clockwise sense the step reverses sign. */
describe('MIT-MV-68 orientation rule', () => {
  it('outward flux ∮ F·n ds equals the ccw form ∮ (P dy − Q dx) and the cw form ∮ (Q dx − P dy)', () => {
    const R = 2.3, cx = 0.3, cy = -0.2;
    const F = (x: number, y: number): [number, number] => [x * x + y, x * y - 3 * y];
    // counterclockwise: step (dx, dy) = R(−sin t, cos t) dt, outward normal (cos t, sin t)
    const ccwDirect = simpson(t => { const [P, Q] = F(cx + R * Math.cos(t), cy + R * Math.sin(t)); return (P * Math.cos(t) + Q * Math.sin(t)) * R; }, 0, 2 * PI, 8000);
    const ccw = simpson(t => { const [P, Q] = F(cx + R * Math.cos(t), cy + R * Math.sin(t)); return P * (R * Math.cos(t)) - Q * (-R * Math.sin(t)); }, 0, 2 * PI, 8000);
    // clockwise: step (dx, dy) = R(−sin s, −cos s) ds, outward normal (cos s, −sin s)
    const cwDirect = simpson(s => { const [P, Q] = F(cx + R * Math.cos(s), cy - R * Math.sin(s)); return (P * Math.cos(s) - Q * Math.sin(s)) * R; }, 0, 2 * PI, 8000);
    const cw = simpson(s => { const [P, Q] = F(cx + R * Math.cos(s), cy - R * Math.sin(s)); return Q * (-R * Math.sin(s)) - P * (-R * Math.cos(s)); }, 0, 2 * PI, 8000);
    expect(near(ccw, ccwDirect, 1e-8), `ccw ${ccw} direct ${ccwDirect}`).toBe(true);
    expect(near(cw, cwDirect, 1e-8), `cw ${cw} direct ${cwDirect}`).toBe(true);
    expect(near(ccwDirect, cwDirect, 1e-8), `the flux is orientation independent`).toBe(true);
  });
});

describe('MIT-MV-68 oracle', () => {
  shapeTests(68, IDS_68, KINDS_68);

  it('flux-form: answered pair is the outward-flux form for the printed orientation', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'flux-form');
    const m = rx(card.prompt, /F = \(([A-Za-z]), ?([A-Za-z])\)/, 'letters');
    const M = m[1], N = m[2];
    f.ok(['P', 'M', 'f', 'u'].includes(M), `seed ${index}: first letter ${M} outside the plan`);
    const ccw = has(card.prompt, 'counterclockwise') || has(card.prompt, '逆时针');
    const isCw = /(?<!counter)clockwise/.test(clean(card.prompt)) || has(card.prompt, '顺时针');
    f.ok(ccw !== isCw, `seed ${index} ${lang}: orientation ccw=${ccw} cw=${isCw}`);
    const answers = ccw ? [`−${N}`, M] : [N, `−${M}`];
    checkSymbols(card, answers, `seed ${index} ${lang} flux-form`, f);
    f.ok(card.slots!.tokens.length === 6, `seed ${index}: ${card.slots!.tokens.length} tokens, plan 6`);
    const expect = [M, N, `−${M}`, `−${N}`, `${M} + ${N}`, `${M} − ${N}`].sort();
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(expect), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    f.ok(has(card.prompt, 'out of the region') || has(card.prompt, '区域外部'), `seed ${index} ${lang}: prompt does not say the normal points outward`);
  }));

  it('flux-area: line integral over the triangle, (a+b)pq/2; figure, audit', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'flux-area');
    const fm = rx(card.prompt, /F = \(([^()]+), ?([^()]+)\)/, 'field');
    const c1 = linCoef(fm[1]), c2 = linCoef(fm[2]);
    const a = c1.x, c = c1.y, d = c2.x, b = c2.y;
    const xs = [...clean(card.prompt).matchAll(/\((\d+), 0\)/g)].map(m => Number(m[1])).filter(v => v > 0);
    const ys = [...clean(card.prompt).matchAll(/\(0, (\d+)\)/g)].map(m => Number(m[1])).filter(v => v > 0);
    f.ok(xs.length === 1 && ys.length === 1, `seed ${index} ${lang}: vertices ${JSON.stringify(xs)} ${JSON.stringify(ys)}`);
    const [p] = xs, [q] = ys;
    f.ok([-2, -1, 1, 2, 3, 4].includes(a) && [-2, -1, 1, 2, 3, 4].includes(b) && [2, 3, 4, 5].includes(p) && [2, 3, 4, 5].includes(q), `seed ${index}: a,b,p,q ${a},${b},${p},${q}`);
    f.ok([-3, -2, -1, 1, 2, 3].includes(c) && [-3, -2, -1, 1, 2, 3].includes(d), `seed ${index}: c,d ${c},${d}`);
    const truth = triangleFlux(a, b, c, d, p, q);
    f.ok(near(truth, (a + b) * p * q / 2, 1e-7), `seed ${index}: line integral ${truth} vs (a+b)pq/2 ${(a + b) * p * q / 2}`);
    auditIs(card, 'MIT-MV-68:flux-area', { a, b, c, d, p, q }, `seed ${index} ${lang} flux-area`, f);
    auditVisible(card, lang, `seed ${index} ${lang} flux-area`, f);
    gradeNumeric(card, [truth], 1e-7, `seed ${index} ${lang} flux-area`, f);
    f.ok(has(card.prompt, 'counterclockwise') || has(card.prompt, '逆时针'), `seed ${index} ${lang}: traversal not stated`);
    const fig = card.figure!;
    f.ok(!!fig, `seed ${index}: figure missing`);
    const verts: Pt[] = [[0, 0], [p, 0], [0, q]];
    f.ok(areaShapes(fig).some(s => verts.every(v => s.points.some(p2 => ptNear(p2, v)))), `seed ${index}: triangle area missing`);
    f.ok(verts.every(v => hasPoint(fig, v)), `seed ${index}: triangle vertices not all marked`);
    f.ok((fig.axes?.xLabel === 'x' && fig.axes?.yLabel === 'y') || (arrowShapes(fig).some(s => s.label === 'x') && arrowShapes(fig).some(s => s.label === 'y')), `seed ${index}: axes labels missing`);
  }));

  it('segment-setup: one blank, the assembled integrand is the plan\'s α + βt; figure', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'segment-setup');
    const A = rx(card.prompt, /A = \((-?\d+), ?(-?\d+), ?(-?\d+)\)/, 'A');
    const B = rx(card.prompt, /B = \((-?\d+), ?(-?\d+), ?(-?\d+)\)/, 'B');
    const [x0, y0, z0] = [+A[1], +A[2], +A[3]], [x1, y1, z1] = [+B[1], +B[2], +B[3]];
    const v1 = x1 - x0, v2 = y1 - y0, v3 = z1 - z0;
    f.ok(v1 !== 0 && v2 !== 0 && v3 !== 0, `seed ${index}: a zero displacement component v=(${v1},${v2},${v3})`);
    const alt = (x: number, y: number, z: number) => x * (y0 - x0) + z * (y0 - z0);
    const bet = (x: number, y: number, z: number) => x * (v2 - v1) + z * (v2 - v3);
    const funcs: [number, number][] = [
      [alt(v1, v2, v3), bet(v1, v2, v3)],
      [(y0 - x0) + (y0 - z0), (v2 - v1) + (v2 - v3)],
      [v1 * (y0 - x0), v1 * (v2 - v1)],
      [v3 * (y0 - z0), v3 * (v2 - v3)],
      [v1 * (y0 - x0) + v2 * (y0 - z0), v1 * (v2 - v1) + v2 * (v2 - v3)],
      [v1 * (y1 - x1) + v3 * (y1 - z1), 0],
    ];
    const slots = card.slots!;
    f.ok(slots.answers.length === 1, `seed ${index}: ${slots.answers.length} blanks, plan 1`);
    const at = (token: string, t: number) => evOrNaN(token, { t });
    const [a0, b0] = funcs[0];
    f.ok(near(at(slots.answers[0], 0.3), a0 + b0 * 0.3, 1e-9) && near(at(slots.answers[0], 0.8), a0 + b0 * 0.8, 1e-9), `seed ${index}: answer ${slots.answers[0]} is not ${a0} + ${b0}t`);
    f.ok(slots.tokens.length === 6, `seed ${index}: ${slots.tokens.length} tokens, plan 6`);
    for (const token of slots.tokens) {
      const match = funcs.some(([A2, B2]) => near(at(token, 0.31), A2 + B2 * 0.31, 1e-9) && near(at(token, 0.83), A2 + B2 * 0.83, 1e-9));
      f.ok(match, `seed ${index}: token ${token} is not one of the plan's six integrands`);
    }
    f.ok(gradeCard(card, [], null, slots.answers) === 'correct', `seed ${index}: correct answer grades wrong`);
    const fig = card.figure!;
    const L = Math.max(x0, y0, z0, x1, y1, z1) + 1;
    f.ok(axesProblems(fig, L).length === 0, `seed ${index}: axes3d(${L}) ${axesProblems(fig, L)}`);
    f.ok(hasDirectedSegment(fig, proj(x0, y0, z0), proj(x1, y1, z1)), `seed ${index}: segment with arrow A→B missing`);
    f.ok(hasPoint(fig, proj(x0, y0, z0)) && hasPoint(fig, proj(x1, y1, z1)), `seed ${index}: endpoints not marked`);
  }));

  it('segment: work by Simpson along the segment; figure, audit', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'segment');
    const A = rx(card.prompt, /A = \((-?\d+), ?(-?\d+), ?(-?\d+)\)/, 'A');
    const B = rx(card.prompt, /B = \((-?\d+), ?(-?\d+), ?(-?\d+)\)/, 'B');
    const A3: [number, number, number] = [+A[1], +A[2], +A[3]], B3: [number, number, number] = [+B[1], +B[2], +B[3]];
    f.ok(B3[0] - A3[0] !== 0 && B3[1] - A3[1] !== 0 && B3[2] - A3[2] !== 0, `seed ${index}: zero displacement component`);
    const truth = segmentWork(A3, B3);
    f.ok(Math.abs(truth) > 1e-9, `seed ${index}: the plan rejects the zero answer, got ${truth}`);
    auditIs(card, 'MIT-MV-68:segment', { x0: A3[0], y0: A3[1], z0: A3[2], x1: B3[0], y1: B3[1], z1: B3[2] }, `seed ${index} ${lang} segment`, f);
    auditVisible(card, lang, `seed ${index} ${lang} segment`, f);
    gradeNumeric(card, [truth], 1e-7, `seed ${index} ${lang} segment`, f);
    const fig = card.figure!;
    const L = Math.max(...A3, ...B3) + 1;
    f.ok(axesProblems(fig, L).length === 0, `seed ${index}: axes3d(${L})`);
    f.ok(hasDirectedSegment(fig, proj(...A3), proj(...B3)), `seed ${index}: segment with arrow A→B missing`);
  }));

  it('conservative-ab: (a,b) makes curl F vanish, neighbours do not', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'conservative-ab');
    const m = rx(card.prompt, /\(([^()]*)\)/, 'middle component');
    // the middle component is `{qx}xy + {qz}yz` with the two printed coefficients
    const q = rx(m[1], /(\d+)xy \+ (\d+)yz/, 'qx,qz');
    const qx = Number(q[1]), qz = Number(q[2]);
    f.ok([2, 4, 6, 8, 10].includes(qx) && [2, 4, 6, 8, 10].includes(qz) && qx !== qz, `seed ${index}: qx,qz ${qx},${qz}`);
    const a = qx / 2, b = qz / 2;
    const F = (x: number, y: number, z: number): [number, number, number] => [a * y * y, qx * x * y + qz * y * z, b * y * y + z * z];
    for (const pt of [[0.7, 1.3, 0.9], [1.1, -0.6, 1.7], [-0.9, 1.9, 0.4]] as [number, number, number][])
      f.ok(norm3(curl(F, pt)) < 1e-6, `seed ${index}: |curl| = ${norm3(curl(F, pt))} at the answer`);
    // plan line 149: each of (a+1,b), (a,b+1), (b,a) must NOT be curl-free (max |curl| ≥ 1.2)
    const probe = [[0.7, 1.3, 0.9], [1.1, -0.6, 1.7]] as [number, number, number][];
    for (const [a2, b2] of [[a + 1, b], [a, b + 1], [b, a]] as [number, number][]) {
      const alt = (x: number, y: number, z: number): [number, number, number] => [a2 * y * y, qx * x * y + qz * y * z, b2 * y * y + z * z];
      const m = Math.max(...probe.map(pt => norm3(curl(alt, pt))));
      f.ok(m >= 1.2, `seed ${index}: neighbour (a,b)=(${a2},${b2}) is curl-free (max |curl| = ${m.toFixed(3)})`);
    }
    auditIs(card, 'MIT-MV-68:conservative-ab', { qx, qz }, `seed ${index} ${lang} conservative-ab`, f);
    auditVisible(card, lang, `seed ${index} ${lang} conservative-ab`, f);
    gradeNumeric(card, [a, b], 1e-9, `seed ${index} ${lang} conservative-ab`, f);
    f.ok(card.fields?.[0].label === (lang === 'en' ? 'a' : 'a') && card.fields?.[1].label === 'b', `seed ${index}: field labels`);
  }));

  it('cap-setup: the three blanks are div, the sign and the base normal; figure', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'cap-setup');
    const h = Number(rx(card.prompt, /z = (\d+) - x² - y²/, 'h')[1]);
    const fm = rx(card.prompt, /F = \((\d*)x, ?(\d*)y, ?z \+ (\d+)\)/, 'F');
    const a = cf(fm[1]), b = cf(fm[2]), c = Number(fm[3]);
    f.ok([1, 2, 3].includes(a) && [1, 2, 3].includes(b) && [1, 2, 3].includes(c) && [1, 2, 3, 4].includes(h), `seed ${index}: a,b,c,h ${a},${b},${c},${h}`);
    f.ok(c !== a + b && c !== a + b + 1, `seed ${index}: degenerate c ${c} with a+b ${a + b}`);
    checkSymbols(card, [`${a + b + 1}`, '−', `−${c}`], `seed ${index} ${lang} cap-setup`, f);
    const cx = (k: number, v: string) => (k === 1 ? v : `${k}${v}`);
    const expect = [`${a + b + 1}`, `${a + b}`, `${a + b + c + 1}`, `${cx(a, 'x')} + ${cx(b, 'y')} + z + ${c}`, '−', '+', `−${c}`, `${c}`, '0'].sort();
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(expect), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const div = fd((x, y, z) => a * x, [0.4, 0.7, 0.3], 0) + fd((x, y, z) => b * y, [0.4, 0.7, 0.3], 1) + fd((x, y, z) => z + c, [0.4, 0.7, 0.3], 2);
    f.ok(near(div, a + b + 1, 1e-6) && near(evOrNaN(card.slots!.answers[0]), a + b + 1, 1e-9), `seed ${index}: div ${card.slots!.answers[0]} vs ${a + b + 1}`);
    const fig = card.figure!;
    const L = Math.max(Math.sqrt(h), h) + 1;
    f.ok(axesProblems(fig, L).length === 0, `seed ${index}: axes3d(${L})`);
    const R = Math.sqrt(h);
    f.ok(wireProblems(fig, (u, v) => [u * Math.cos(v), u * Math.sin(v), h - u * u], 0, R, 0, 2 * PI, 4, 12).length === 0, `seed ${index}: paraboloid wire missing`);
    f.ok(hasArrow(fig, proj(0, 0, h), proj(0, 0, h + 1.5), 1e-9, 'n'), `seed ${index}: up-normal arrow missing`);
  }));

  it('cap-flux: direct disc quadrature and the divergence route; figure, audit', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'cap-flux');
    const h = Number(rx(card.prompt, /z = (\d+) - x² - y²/, 'h')[1]);
    const fm = rx(card.prompt, /F = \((\d*)x, ?(\d*)y, ?z \+ (\d+)\)/, 'F');
    const a = cf(fm[1]), b = cf(fm[2]), c = Number(fm[3]);
    const direct = capFlux(a, b, c, h);
    const divergence = (a + b + 1) * (h * h / 2) + c * h;
    f.ok(near(direct, divergence, 1e-6), `seed ${index}: direct ${direct} vs divergence ${divergence}`);
    auditIs(card, 'MIT-MV-68:cap-flux', { a, b, c, h }, `seed ${index} ${lang} cap-flux`, f);
    auditVisible(card, lang, `seed ${index} ${lang} cap-flux`, f);
    gradeNumeric(card, [direct], 1e-6, `seed ${index} ${lang} cap-flux`, f);
    f.ok(card.fields?.[0].label === 'k', `seed ${index}: field label ${card.fields?.[0].label}`);
    const fig = card.figure!;
    const L = Math.max(Math.sqrt(h), h) + 1;
    f.ok(axesProblems(fig, L).length === 0, `seed ${index}: axes3d(${L})`);
  }));

  it('curl-setup: curl F = (0, (2a−c)z, 0); tokens', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'curl-setup');
    const fm = rx(card.prompt, /F = \((\d*)z², ?(\d*)y², ?(\d*)xz\)/, 'F');
    const a = cf(fm[1]), b = cf(fm[2]), c = cf(fm[3]);
    f.ok([1, 2, 3].includes(a) && [1, 2, 3].includes(b) && c >= 1 && c <= 8 && c !== 2 * a && c !== 4 * a, `seed ${index}: a,b,c ${a},${b},${c}`);
    const F = field68(a, b, c);
    const comp = (pt: [number, number, number]) => curl(F, pt);
    const co = (k: number, v = 'z') => (k === 1 ? v : k === -1 ? `−${v}` : `${num(k)}${v}`);
    checkSymbols(card, ['0', co(2 * a - c), '0'], `seed ${index} ${lang} curl-setup`, f);
    const expect = ['0', co(2 * a - c), co(2 * a + c), co(c - 2 * a), co(2 * a), co(2 * b, 'y')].sort();
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(expect), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    f.ok(evOrNaN(card.slots!.answers[0]) === 0 && evOrNaN(card.slots!.answers[2]) === 0, `seed ${index}: outer curl components not 0`);
    const z = 1.7;
    f.ok(near(evOrNaN(card.slots!.answers[1], { z }), comp([0.3, -0.4, z])[1], 1e-6) && near(comp([0.3, -0.4, z])[1], (2 * a - c) * z, 1e-6), `seed ${index}: j-component ${card.slots!.answers[1]}`);
    f.ok(near(comp([0.3, -0.4, z])[0], 0, 1e-6) && near(comp([0.3, -0.4, z])[2], 0, 1e-6), `seed ${index}: curl not along j`);
  }));

  it('cylinder-reason: exactly the "curl ∥ j, n has no j-part" option is correct', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'cylinder-reason');
    const fm = rx(card.prompt, /F = \((\d*)z², ?(\d*)y², ?(\d*)xz\)/, 'F');
    const a = cf(fm[1]), c = cf(fm[3]);
    f.ok(c !== 2 * a, `seed ${index}: c = 2a makes curl F vanish`);
    const correct = (o: string) => { const t = clean(o); return lang === 'en' ? /multiple of j, while n has no j-component/.test(t) : /j 的倍数，而.*n 没有 j 分量/.test(t); };
    const verdict = card.choice!.options.map(correct);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 5, `seed ${index}: ${card.choice!.options.length} options, plan 5`);
    // the "n is the direction of j" distractor is offered and false
    const wrong = (o: string) => { const t = clean(o); return lang === 'en' ? /j, which is the direction of n/.test(t) : /j 正是 xz 柱面上 n 的方向/.test(t); };
    f.ok(card.choice!.options.filter(wrong).length === 1, `seed ${index} ${lang}: the parallel-direction distractor missing`);
  }));

  it('challenge: ∮ F·dr along r(t) = (cos t, 0, z0 + sin t), k = ∮/π; audit', () => everySeed((index, lang, f) => {
    const card = getCard(68, index, lang, 'challenge');
    const fm = rx(card.prompt, /F = \((\d*)z², ?(\d*)y², ?(\d*)xz\)/, 'F');
    const a = cf(fm[1]), b = cf(fm[2]), c = cf(fm[3]);
    const z0 = Number(rx(card.prompt, /\(cos t, 0, (-?\d+) \+ sin t\)/, 'z0')[1]);
    f.ok([1, 2, 3].includes(a) && [1, 2, 3].includes(b) && c >= 1 && c <= 6 && c !== 2 * a, `seed ${index}: a,b,c ${a},${b},${c}`);
    f.ok([-3, -2, -1, 1, 2, 3].includes(z0), `seed ${index}: z0 ${z0}`);
    const k = cylinderLoop(a, b, c, z0);
    f.ok(near(k, (c - 2 * a) * z0, 1e-6), `seed ${index}: loop ${k} vs closed form ${(c - 2 * a) * z0}`);
    auditIs(card, 'MIT-MV-68:challenge', { a, b, c, z0 }, `seed ${index} ${lang} challenge`, f);
    auditVisible(card, lang, `seed ${index} ${lang} challenge`, f);
    gradeNumeric(card, [k], 1e-6, `seed ${index} ${lang} challenge`, f);
  }));

  it('variety and answer positions', () => {
    for (const slug of IDS_68) expect(distinctCount(68, slug, fullKey), slug).toBeGreaterThanOrEqual(6);
    for (const slug of ['cylinder-reason']) expect(answerPositions(68, slug).size, `${slug} answer positions`).toBeGreaterThanOrEqual(2);
  });
});

// ======================================================================================================
// MIT-MV-69 — Final Exam
// ======================================================================================================
const IDS_69 = ['singular-a', 'inverse-entry', 'chain-phi', 'gradient-test', 'order-swap', 'cone-limits', 'cyl-setup', 'cyl-flux', 'stokes-setup', 'challenge'];
const KINDS_69 = ['MIT-MV-69:challenge', 'MIT-MV-69:chain-phi', 'MIT-MV-69:cyl-flux', 'MIT-MV-69:inverse-entry', 'MIT-MV-69:singular-a'];

/** Flux of F = (a x, 0, 0) across the curved quarter-cylinder side, divided by π. */
function cylFlux(a: number, R: number, H: number): number {
  return simpson(th => a * R * Math.cos(th) * R * Math.cos(th) * H, 0, PI / 2, 1000) / PI;
}
/** The answer of the `cone-limits` φ-bound token: tan⁻¹(1/k), tan⁻¹(k) or π/4. */
function conePhi(token: string): number {
  const t = clean(token);
  if (/^π\/4$/.test(t)) return PI / 4;
  const inv = t.match(/^tan(⁻¹|\^-1)?\(1\/(\d+)\)$/);
  if (inv) return Math.atan(1 / Number(inv[2]));
  const plain = t.match(/^tan(⁻¹|\^-1)?\((\d+)\)$/);
  if (plain) return Math.atan(Number(plain[2]));
  return NaN;
}
/** ∮_C F·dr for the boundary of S: z = h − x² − y², first octant, ccw from above, divided by π. */
function loop69(a: number, c: number, d: number, h: number): number {
  const r = Math.sqrt(h);
  const F = (x: number, y: number, z: number): [number, number, number] => [a * y * z + c * y, -a * x * z + d * x, 1];
  const arc = simpson(s => {
    const x = r * Math.cos(s), y = r * Math.sin(s), z = 0;
    const f = F(x, y, z), dr = [-r * Math.sin(s), r * Math.cos(s), 0];
    return f[0] * dr[0] + f[1] * dr[1] + f[2] * dr[2];
  }, 0, PI / 2, 1000);
  const c1 = simpson(t => {
    const y = r * (1 - t), z = h - y * y;
    const f = F(0, y, z), dr = [0, -r, 2 * y * r];
    return f[0] * dr[0] + f[1] * dr[1] + f[2] * dr[2];
  }, 0, 1, 1000);
  const c2 = simpson(t => {
    const x = r * t, z = h - x * x;
    const f = F(x, 0, z), dr = [r, 0, -2 * x * r];
    return f[0] * dr[0] + f[1] * dr[1] + f[2] * dr[2];
  }, 0, 1, 1000);
  return (arc + c1 + c2) / PI;
}

describe('MIT-MV-69 oracle', () => {
  shapeTests(69, IDS_69, KINDS_69);

  it('singular-a: det A = a + K is 0 exactly at a = answer; audit', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'singular-a');
    const p = Number(rx(card.prompt, /\(1, ?0, ?(\d+)\)/, 'p')[1]);
    const qr = rx(card.prompt, /\((-?\d+), ?1, ?(-?\d+)\)/, 'q,r');
    const st = rx(card.prompt, /\((-?\d+), ?(-?\d+), ?a\)/, 's,t');
    const q = Number(qr[1]), r = Number(qr[2]), s = Number(st[1]), t = Number(st[2]);
    const a = t * r - p * q * t + p * s;
    f.ok([2, 3, 4].includes(p) && a !== 0, `seed ${index}: p ${p}, a* ${a}`);
    const det = (value: number) => det3([[1, 0, p], [q, 1, r], [s, t, value]]);
    f.ok(Math.abs(det(a)) < 1e-9, `seed ${index}: det at a=${a} is ${det(a)}`);
    f.ok(near(det(a + 1), 1, 1e-9) && near(det(a - 1), -1, 1e-9), `seed ${index}: det not linear with slope 1 (${det(a + 1)}, ${det(a - 1)})`);
    auditIs(card, 'MIT-MV-69:singular-a', { p, q, r, s, t }, `seed ${index} ${lang} singular-a`, f);
    auditVisible(card, lang, `seed ${index} ${lang} singular-a`, f);
    gradeNumeric(card, [a], 1e-9, `seed ${index} ${lang} singular-a`, f);
    f.ok(card.fields?.[0].label === 'a', `seed ${index}: field label`);
  }));

  it('inverse-entry: the answer makes (u,p,w)·col1 = 0; audit', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'inverse-entry');
    const col = rx(card.prompt, /\((-?\d+), ?(-?\d+), ?(-?\d+)\)/, 'column');
    const row = rx(card.prompt, /\((-?\d+), ?p, ?(-?\d+)\)/, 'row');
    const c1 = Number(col[1]), c2 = Number(col[2]), c3 = Number(col[3]);
    const u = Number(row[1]), w = Number(row[2]);
    f.ok(u * c1 + w * c3 !== 0, `seed ${index}: u·c1 + w·c3 = 0 (degenerate)`);
    const pval = -(u * c1 + w * c3) / c2;
    // independent route: any invertible A with this first column has row2(A⁻¹)·col1 = 0
    const comp = [[c1, 1, 2], [c2, 3, 1], [c3, 1, 4]];
    const inv = inv3(comp);
    if (inv) {
      const dot = inv[1][0] * c1 + inv[1][1] * c2 + inv[1][2] * c3;
      f.ok(Math.abs(dot) < 1e-9, `seed ${index}: row2(A⁻¹)·col1 = ${dot}`);
    }
    f.ok(Math.abs(u * c1 + pval * c2 + w * c3) < 1e-9, `seed ${index}: answer does not satisfy the linear equation`);
    auditIs(card, 'MIT-MV-69:inverse-entry', { c1, c2, c3, u, w }, `seed ${index} ${lang} inverse-entry`, f);
    auditVisible(card, lang, `seed ${index} ${lang} inverse-entry`, f);
    gradeNumeric(card, [pval], 1e-9, `seed ${index} ${lang} inverse-entry`, f);
  }));

  it('chain-phi: ∂F/∂φ by central differences of a linear F; audit', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'chain-phi');
    const gm = rx(card.prompt, /∇F\((-?\d+), ?(-?\d+), ?(-?\d+)\) ?= ?\((-?\d+), ?(-?\d+), ?(-?\d+)\)/, 'gradient');
    const [x0, y0, z0, p, q, r] = gm.slice(1).map(Number);
    const sm = rx(card.prompt, /\((\d*)√2, ?π\/4, ?(0|-?π\/2|-?π)\)/, 'spherical');
    const a = sm[1] === '' ? 1 : Number(sm[1]);
    const theta0 = sm[2] === '0' ? 0 : sm[2] === 'π/2' ? PI / 2 : sm[2] === 'π' ? PI : -PI / 2;
    f.ok([1, 2, 3].includes(a), `seed ${index}: a ${a}`);
    f.ok([0, PI / 2, PI, -PI / 2].some(t => near(t, theta0, 1e-12)), `seed ${index}: θ0 ${theta0}`);
    // check the printed point is the spherical one
    const rho = a * Math.sqrt(2);
    f.ok(near(rho * Math.sin(PI / 4) * Math.cos(theta0), x0, 1e-9) && near(rho * Math.sin(PI / 4) * Math.sin(theta0), y0, 1e-9) && near(rho * Math.cos(PI / 4), z0, 1e-9), `seed ${index}: point (${x0},${y0},${z0}) is not the printed spherical point`);
    const F = (x: number, y: number, z: number) => p * x + q * y + r * z;
    const G = (phi: number) => F(rho * Math.sin(phi) * Math.cos(theta0), rho * Math.sin(phi) * Math.sin(theta0), rho * Math.cos(phi));
    const dphi = (G(PI / 4 + 1e-6) - G(PI / 4 - 1e-6)) / 2e-6;
    f.ok(near(dphi, p * x0 + q * y0 - r * z0, 1e-6), `seed ${index}: ∂F/∂φ ${dphi} vs closed form ${p * x0 + q * y0 - r * z0}`);
    f.ok(Math.abs(p * x0 + q * y0 - r * z0) > 1e-9, `seed ${index}: the plan rejects the zero answer`);
    auditIs(card, 'MIT-MV-69:chain-phi', { x0, y0, z0, p, q, r }, `seed ${index} ${lang} chain-phi`, f);
    auditVisible(card, lang, `seed ${index} ${lang} chain-phi`, f);
    gradeNumeric(card, [dphi], 1e-6, `seed ${index} ${lang} chain-phi`, f);
    f.ok(has(card.prompt, lang === 'en' ? PHI_EN : PHI_ZH), `seed ${index} ${lang}: φ rule missing`);
  }));

  it('gradient-test: exactly the option with M_y = N_x is a gradient', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'gradient-test');
    const verdict = card.choice!.options.map(o => { const [M, N] = tupleOption(o); return near(M.y, N.x, 1e-12); });
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: ${card.choice!.options.length} options, plan 4`);
  }));

  it('order-swap: the assembled swapped bounds give the original-order integral; figure', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'order-swap');
    const a = Number(rxl(card.prompt, lang, /from 0 to (\d+)/, /从 0 到 (\d+)/, 'a')[1]);
    f.ok(a >= 2 && a <= 7, `seed ${index}: a ${a} outside plan`);
    const familyA = has(card.prompt, `to ${a}x`) || has(card.prompt, `到 ${a}x`);
    const at = (token: string, env: Record<string, number>) => evOrNaN(token, env);
    const fxy = (x: number, y: number) => x * y + 0.3 * Math.cos(y) + x * x;
    const slots = card.slots!;
    // y = u² removes the √y endpoint singularity, so the adaptive rule converges
    const value = (ans: string[]) => integrate(u => 2 * u * simpson(x => fxy(x, u * u), at(ans[1], { y: u * u }), at(ans[2], { y: u * u }), 64), 0, Math.sqrt(at(ans[0], {})));
    const truth = familyA
      ? integrate(x => simpson(y => fxy(x, y), x * x, a * x, 64), 0, a)
      : integrate(x => simpson(y => fxy(x, y), 0, x * x, 64), 0, a);
    f.ok(near(value(slots.answers), truth, 1e-6), `seed ${index} ${lang}: assembled ${value(slots.answers)} vs original order ${truth}`);
    const answers = familyA ? [`${a * a}`, `y/${a}`, '√y'] : [`${a * a}`, '√y', `${a}`];
    checkSymbols(card, answers, `seed ${index} ${lang} order-swap`, f);
    const expect = [`${a * a}`, `${a}`, `y/${a}`, `${a}y`, '√y', 'y²'].sort();
    f.ok(JSON.stringify(slots.tokens.slice().sort()) === JSON.stringify(expect), `seed ${index} ${lang}: tokens ${JSON.stringify(slots.tokens)}`);
    const fig = card.figure!;
    f.ok(fig.aspect === 'free', `seed ${index}: aspect ${fig.aspect}, plan 'free'`);
    f.ok(areaShapes(fig).length >= 1, `seed ${index}: region area missing`);
    f.ok(hasPoint(fig, [0, 0]) && hasPoint(fig, [a, a * a]), `seed ${index}: corner points missing`);
    // The figure must not print a², the first answer (added at coordinator review, 2026-10-15).
    f.ok(![fig.alt, ...fig.shapes.map(s => s.kind === 'text' ? s.text : 'label' in s ? s.label ?? '' : '')].some(s => new RegExp(`(^|[^\\d])${a * a}($|[^\\d])`).test(s)), `seed ${index}: figure shows the answer ${a * a}`);
  }));

  it('cone-limits: the spherical integral equals π h⁵/(5k²); tokens; figure', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'cone-limits');
    const k = Number(rx(card.prompt, /z = (\d+)√\(x² \+ y²\)/, 'k')[1]);
    const h = Number(rx(card.prompt, /z = (\d+)√\(x² \+ y²\)[\s\S]*?z = (\d+)/, 'kh')[2]);
    f.ok([2, 3, 4].includes(k) && [2, 3, 4, 5, 6].includes(h), `seed ${index}: k,h ${k},${h}`);
    const Phi = conePhi(card.slots!.answers[0]);
    f.ok(near(Phi, Math.atan(1 / k), 1e-12), `seed ${index}: φ-bound ${card.slots!.answers[0]} vs tan⁻¹(1/${k})`);
    checkSymbols(card, [`tan⁻¹(1/${k})`, `${h} sec φ`, 'ρ⁴ cos²φ sin φ'], `seed ${index} ${lang} cone-limits`, f);
    const expect = [`tan⁻¹(1/${k})`, `tan⁻¹(${k})`, 'π/4', `${h} sec φ`, `${h} cos φ`, `${h}`, 'ρ⁴ cos²φ sin φ', 'ρ³ cos φ sin φ', 'ρ² cos²φ sin φ'].sort();
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(expect), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const truth = PI * Math.pow(h, 5) / (5 * k * k);
    // the third answer token already contains the volume element ρ² sin φ, so it is integrated as written
    const value = (ans: string[]) => { const P = conePhi(ans[0]); return 2 * PI * integrate(phi => simpson(rho => evOrNaN(ans[2], { ρ: rho, φ: phi }), 0, evOrNaN(ans[1], { φ: phi }), 96), 0, P); };
    f.ok(Math.abs(truth - value(card.slots!.answers)) < 1e-7 * Math.max(1, truth), `seed ${index}: spherical ${value(card.slots!.answers)} vs π h⁵/(5k²) ${truth}`);
    const fig = card.figure!;
    f.ok(axesProblems(fig, h + 1).length === 0, `seed ${index}: axes3d(${h + 1})`);
    f.ok(wireProblems(fig, (u, v) => [u * Math.cos(v), u * Math.sin(v), k * u], 0, h / k, 0, 2 * PI, 3, 12).length === 0, `seed ${index}: cone wire missing`);
    f.ok(has(card.prompt, lang === 'en' ? PHI_EN : PHI_ZH), `seed ${index} ${lang}: φ rule missing`);
  }));

  it('cyl-setup: two blanks are div F and the flat-face dot product; figure', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'cyl-setup');
    const R2 = Number(rx(card.prompt, /x² \+ y² ≤ (\d+)/, 'R2')[1]);
    const R = Number(rxl(card.prompt, lang, /\(radius (\d+)\)/, /（半径 (\d+)）/, 'R')[1]);
    const H = Number(rx(card.prompt, /0 ≤ z ≤ (\d+)/, 'H')[1]);
    const a = Number(rx(card.prompt, /F = \((\d+)x, ?0, ?0\)/, 'F')[1]);
    f.ok(R * R === R2 && [2, 4, 6].includes(R) && H >= 1 && H <= 5 && [2, 3, 4].includes(a), `seed ${index}: a,R,H ${a},${R},${H}`);
    checkSymbols(card, [`${a}`, '0'], `seed ${index} ${lang} cyl-setup`, f);
    const expect = [`${a}`, `${a}x`, '1', '0', `−${a}`].sort();
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(expect), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const F = (x: number) => [a * x, 0, 0];
    f.ok(near(fd((x, y, z) => F(x)[0], [0.7, 0.3, 0.5], 0), a, 1e-6), `seed ${index}: div F != ${a}`);
    const fig = card.figure!;
    f.ok(axesProblems(fig, R + 1).length === 0, `seed ${index}: axes3d(${R + 1})`);
    f.ok(wireProblems(fig, (u, v) => [R * Math.cos(u), R * Math.sin(u), v], 0, PI / 2, 0, H, 6, 4).length === 0, `seed ${index}: quarter-cylinder wire missing`);
  }));

  it('cyl-flux: direct ∮ cos²θ flux and the divergence volume; figure, audit', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'cyl-flux');
    const R2 = Number(rx(card.prompt, /x² \+ y² ≤ (\d+)/, 'R2')[1]);
    const R = Number(rxl(card.prompt, lang, /\(radius (\d+)\)/, /（半径 (\d+)）/, 'R')[1]);
    const H = Number(rx(card.prompt, /0 ≤ z ≤ (\d+)/, 'H')[1]);
    const a = Number(rx(card.prompt, /F = \((\d+)x, ?0, ?0\)/, 'F')[1]);
    f.ok(R * R === R2, `seed ${index}: R² ${R2} vs ${R * R}`);
    const direct = cylFlux(a, R, H);
    f.ok(near(direct, a * R2 * H / 4, 1e-9), `seed ${index}: direct ${direct} vs aR²H/4 ${a * R2 * H / 4}`);
    auditIs(card, 'MIT-MV-69:cyl-flux', { a, R, H }, `seed ${index} ${lang} cyl-flux`, f);
    auditVisible(card, lang, `seed ${index} ${lang} cyl-flux`, f);
    gradeNumeric(card, [direct], 1e-7, `seed ${index} ${lang} cyl-flux`, f);
    f.ok(has(card.prompt, 'away from the z-axis') || has(card.prompt, '背离 z 轴'), `seed ${index} ${lang}: normal direction not stated`);
    const fig = card.figure!;
    f.ok(axesProblems(fig, R + 1).length === 0, `seed ${index}: axes3d(${R + 1})`);
  }));

  it('stokes-setup: the assembled Stokes integral equals the surface integral; tokens; figure', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'stokes-setup');
    const h = Number(rx(card.prompt, /z = (\d+) - x² - y²/, 'h')[1]);
    const a = cf(rx(card.prompt, /F = \((\d*)yz/, 'a')[1]);
    f.ok([1, 2, 3].includes(a) && [4, 9, 16].includes(h), `seed ${index}: a,h ${a},${h}`);
    const R = Math.sqrt(h);
    checkSymbols(card, ['π/2', `${R}`, `${4 * a}r² − ${2 * a * h}`], `seed ${index} ${lang} stokes-setup`, f);
    const integrand = `${4 * a}r² − ${2 * a * h}`;
    const expect = ['π/2', 'π', '2π', `${R}`, `${h}`, integrand, `${3 * a}r² − ${2 * a * h}`, `${2 * a}r² − ${2 * a * h}`, `${2 * a * h}`].sort();
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(expect), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const truth = integrate(r => (4 * a * r * r - 2 * a * h) * r, 0, R) * (PI / 2);
    const value = (ans: string[]) => evOrNaN(ans[0]) * integrate(r => evOrNaN(ans[2], { r }) * r, 0, evOrNaN(ans[1]));
    f.ok(near(value(card.slots!.answers), truth, 1e-6), `seed ${index}: assembled ${value(card.slots!.answers)} vs surface integral ${truth}`);
    const fig = card.figure!;
    f.ok(axesProblems(fig, Math.max(R, h) + 1).length === 0, `seed ${index}: axes3d`);
    f.ok(wireProblems(fig, (u, v) => [u * Math.cos(v), u * Math.sin(v), h - u * u], 0, R, 0, PI / 2, 4, 6).length === 0, `seed ${index}: paraboloid wire missing`);
    f.ok(hasCurve(fig, s => [R * Math.cos(s), R * Math.sin(s), 0], 0, PI / 2, 1e-9, 'warn'), `seed ${index}: rim arc missing`);
    f.ok(hasCurve(fig, y => [0, y, h - y * y], 0, R, 1e-9, 'warn'), `seed ${index}: yz parabolic arc missing`);
    f.ok(hasCurve(fig, x => [x, 0, h - x * x], 0, R, 1e-9, 'warn'), `seed ${index}: xz parabolic arc missing`);
  }));

  it('challenge: ∮ F·dr over the three boundary pieces, k = ∮/π; audit', () => everySeed((index, lang, f) => {
    const card = getCard(69, index, lang, 'challenge');
    const h = Number(rx(card.prompt, /z = (\d+) - x² - y²/, 'h')[1]);
    const fm = rx(card.prompt, /F = \((\d*)yz \+ (\d*)y, ?-(\d*)xz \+ (\d*)x, ?1\)/, 'F');
    const a = cf(fm[1]), c = cf(fm[2]), d = cf(fm[4]);
    f.ok(c !== d, `seed ${index}: c = d makes the loop integral 0`);
    f.ok([2, 3, 4, 5, 6, 8].includes(h), `seed ${index}: h ${h}`);
    const k = loop69(a, c, d, h);
    f.ok(near(k, (d - c) * h / 4, 1e-6), `seed ${index}: loop ${k} vs (d−c)h/4 ${(d - c) * h / 4}`);
    auditIs(card, 'MIT-MV-69:challenge', { a, c, d, h }, `seed ${index} ${lang} challenge`, f);
    auditVisible(card, lang, `seed ${index} ${lang} challenge`, f);
    gradeNumeric(card, [k], 1e-6, `seed ${index} ${lang} challenge`, f);
  }));

  it('variety and answer positions', () => {
    for (const slug of IDS_69) expect(distinctCount(69, slug, fullKey), slug).toBeGreaterThanOrEqual(6);
    expect(answerPositions(69, 'gradient-test').size, 'gradient-test answer positions').toBeGreaterThanOrEqual(2);
  });
});
