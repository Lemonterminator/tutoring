import { appendFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mv61 } from './games/mv61';
import { mv62 } from './games/mv62';
import { mv63 } from './games/mv63';
import { mv64 } from './games/mv64';
import { spreadSeed } from './deck-invariants';
import { simpson } from './oracle-harness';
import { gradeCard, type CardGenerator, type GameLanguage, type PracticeCard } from '../types';
import { figureProblems, project3d, type Figure, type FigureShape, type Pt } from '../figure';

/**
 * Acceptance oracle for MIT-MV-61, 62, 63, 64. The numeric answers are recomputed from the plan's definitions by quadrature and
 * finite differences, never from a generator closed form. Written against docs/mit-mv-drafts/approved-61-64.md before the
 * generators were read.
 */
vi.setConfig({ testTimeout: 300000 });
const SEEDS = 60;
const PI = Math.PI;
type Lang = GameLanguage;
const LANGS: Lang[] = ['en', 'zh'];
const generators: Record<number, CardGenerator> = { 61: mv61, 62: mv62, 63: mv63, 64: mv64 };

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
const clean = (text: string) => text.replaceAll('−', '-').replaceAll('·', '*').replaceAll(' ', ' ').replaceAll(' ', ' ');
const near = (a: number, b: number, tol = 1e-9) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const ptNear = (p: Pt, q: Pt, tol = 1e-9) => near(p[0], q[0], tol) && near(p[1], q[1], tol);
function integrate(fn: (value: number) => number, lo: number, hi: number): number {
  let previous = simpson(fn, lo, hi, 32);
  for (let panels = 64; panels <= 8192; panels *= 2) {
    const current = simpson(fn, lo, hi, panels);
    if (Math.abs(current - previous) / 15 < 2e-11 * Math.max(1, Math.abs(current))) return current + (current - previous) / 15;
    previous = current;
  }
  throw new Error(`quadrature did not stabilise on [${lo}, ${hi}]`);
}
/** Integral of g(x, y) over the disc of radius R restricted to s-range (x = R sin s) and y from lowFrac·w to w, w = R cos s. Inner Simpson is exact for the polynomial integrands used here. */
function discPiece(g: (x: number, y: number) => number, R: number, sLo: number, sHi: number, lowFrac: 0 | -1): number {
  return integrate(s => { const x = R * Math.sin(s), w = R * Math.cos(s); return simpson(y => g(x, y), lowFrac * w, w, 8) * R * Math.cos(s); }, sLo, sHi);
}
const disc = (g: (x: number, y: number) => number, R: number) => discPiece(g, R, -PI / 2, PI / 2, -1);
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

// expression evaluator for slot tokens such as `2r² + 3`, `ρ³ sin φ`, `3 sec φ`
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
    if (t === 'sin') return Math.sin(atom());
    if (t === 'cos') return Math.cos(atom());
    if (t === 'tan') return Math.tan(atom());
    if (t === 'sec') return 1 / Math.cos(atom());
    if (t === 'csc') return 1 / Math.sin(atom());
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
/** NaN when the token cannot be evaluated (an operator word such as `d/dt`, an unbound variable): such a token is never a numeric match. */
const evOrNaN = (source: string, env: Record<string, number> = {}): number => { try { return ev(source, env); } catch { return NaN; } };
function exactString(v: number): string {
  for (let q = 1; q <= 24; q++) { const p = Math.round(v * q); if (Math.abs(v - p / q) < 1e-7) return q === 1 ? `${p}` : `${p}/${q}`; }
  for (let q = 1; q <= 24; q++) { const p = Math.round(v * q / PI); if (Math.abs(v - p * PI / q) < 1e-9) return `${p}pi${q === 1 ? '' : `/${q}`}`; }
  throw new Error(`no exact form for ${v}`);
}
const rx = (text: string, pattern: RegExp, label: string): RegExpMatchArray => { const m = clean(text).match(pattern); if (!m) throw new Error(`cannot parse ${label} in "${text}"`); return m; };
/** Per-language pattern pick. */
const rxl = (text: string, lang: Lang, en: RegExp, zh: RegExp, label: string) => rx(text, lang === 'en' ? en : zh, label);
const cf = (s: string | undefined): number => s === undefined || s === '' ? 1 : s === '-' ? -1 : Number(s);
const has = (text: string, ...needles: string[]) => needles.every(n => clean(text).includes(clean(n)));
const loop = (lang: Lang, dir: 'ccw' | 'cw') => lang === 'en' ? (dir === 'ccw' ? 'counterclockwise viewed from above' : 'clockwise viewed from above') : (dir === 'ccw' ? '从上往下看为逆时针' : '从上往下看为顺时针');

// ---------- generic card checks ----------
const CJK = /[㐀-鿿]/;
// English function words are forbidden in ZH strings; technical Latin symbols (curl, Stokes, F, ...) are allowed.
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
function bothLanguagesAgree(game: number, index: number, slug: string, f: Fails) {
  const en = getCard(game, index, 'en', slug), zh = getCard(game, index, 'zh', slug);
  f.ok(JSON.stringify(en.audit) === JSON.stringify(zh.audit), `seed ${index} ${slug}: EN/ZH audit differ`);
  f.ok(JSON.stringify(en.fields?.map(x => x.answer)) === JSON.stringify(zh.fields?.map(x => x.answer)), `seed ${index} ${slug}: EN/ZH answers differ`);
  f.ok(en.choice?.answer === zh.choice?.answer, `seed ${index} ${slug}: EN/ZH choice answer differs`);
  f.ok(JSON.stringify(en.slots?.answers) === JSON.stringify(zh.slots?.answers), `seed ${index} ${slug}: EN/ZH slot answers differ`);
  // tokens that contain English words are translated, so only compare the rest
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
  // labels: never two at the same point, none an English word on a ZH card
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
const areaShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'area' }> => s.kind === 'area');
const hasPoint = (fig: Figure, p: Pt, tol = 1e-9) => pointShapes(fig).some(s => ptNear(s.at, p, tol));
const hasArrow = (fig: Figure, from: Pt, to: Pt, tol = 1e-9, label?: string) => arrowShapes(fig).some(s => ptNear(s.from, from, tol) && ptNear(s.to, to, tol) && (label === undefined || s.label === label));
const proj = (x: number, y: number, z: number) => project3d([x, y, z]);
type P3 = [number, number, number];
/** A polyline of fn(t), t from t0 to t1, with `n` panels, projected. */
const curve = (fn: (t: number) => P3, t0: number, t1: number, n: number): Pt[] => Array.from({ length: n + 1 }, (_, i) => proj(...fn(t0 + (t1 - t0) * i / n)));
/** The figure has a line whose points are exactly the projection of fn on [t0, t1] (any sample count). */
const hasCurve = (fig: Figure, fn: (t: number) => P3, t0: number, t1: number, tol = 1e-9, tone?: string) =>
  lineShapes(fig).some(l => (tone === undefined || l.tone === tone) && l.points.length >= 2 && l.points.every((pt, i) => ptNear(pt, proj(...fn(t0 + (t1 - t0) * i / (l.points.length - 1))), tol)));
/** Every circle u_i and meridian v_j of a wire3d(fn, ...) is present. */
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
/** Symbol-card check: structure, answers grade correct, a single wrong slot grades incorrect. */
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
/**
 * The assembled set-up must evaluate to the independent truth, and no single-token replacement in any slot may also evaluate to it
 * (a second correct answer that the game would mark wrong). `value` returns NaN for tokens that cannot be evaluated.
 */
function assembleCheck(card: PracticeCard, value: (answers: string[]) => number, truth: number, where: string, f: Fails, tol = 1e-8, integrand?: { slot: number; envs: Record<string, number>[] }) {
  const slots = card.slots!;
  const base = value(slots.answers);
  f.ok(near(base, truth, tol), `${where}: assembled answers give ${base}, independent truth ${truth}`);
  slots.answers.forEach((_, i) => {
    for (const token of slots.tokens) {
      if (token === slots.answers[i]) continue;
      const trial = slots.answers.slice(); trial[i] = token;
      const v = value(trial);
      // an integrand token that agrees with the right one only in the integral (a numerical coincidence of the sampled numbers) is a different function, not a second answer
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
/** All numbers (as printed) in a text. */
function numbersIn(text: string): number[] { return (clean(text).match(/\d+(?:\.\d+)?/g) ?? []).map(Number); }
/** Parse a value printed as `13`, `-3`, `81/2`, `(81/2)` into a number. */
function parseFrac(s: string): number { const m = clean(s).trim().replace(/^\(|\)$/g, '').match(/^(-?\d+)(?:\/(\d+))?$/); if (!m) throw new Error(`not a fraction: ${s}`); return Number(m[1]) / (m[2] ? Number(m[2]) : 1); }
/** Every `(k)π` / `= (k)π` value printed in an explanation. */
function bracketPi(text: string): number[] { return [...clean(text).matchAll(/\((-?\d+(?:\/\d+)?)\)π/g)].map(m => parseFrac(m[1])); }
function checkOrientation(card: PracticeCard, lang: Lang, words: string[], where: string, f: Fails) {
  for (const w of words) f.ok(has(card.prompt, w), `${where}: prompt lacks "${w}"`);
}
const RIGHT_HAND = (lang: Lang) => lang === 'en' ? 'right thumb' : '右手拇指';
const PHI_EN = 'measured from the positive z-axis', PHI_ZH = '从正 z 轴量起';
/** φ rule: wherever φ appears in prompt, hint, explanation or options, the card says where it is measured from. */
function phiProblems(card: PracticeCard, lang: Lang): string[] {
  const texts = [card.prompt, card.hint, card.explanation, ...(card.choice?.options ?? [])];
  if (!texts.some(t => t.includes('φ'))) return [];
  const phrase = lang === 'en' ? PHI_EN : PHI_ZH;
  return texts.some(t => t.includes(phrase)) ? [] : ['φ appears but "measured from the positive z-axis" does not'];
}
/** The sentence that ends the challenge explanation. */
const END = {
  61: { en: 'This game does not ask you to parametrise surfaces or to prove the topological facts; it checks when \'curl F = 0 implies F = ∇f\' applies and what the standard counterexample shows when simple connectivity fails.', zh: '本游戏不要求参数化曲面或证明拓扑事实；它检验「curl F = 0 推出 F = ∇f」何时适用，以及单连通性失效时标准反例说明了什么。' },
  62: { en: 'This game does not assess proofs, choosing the order of integration in rectangular coordinates, or integrals that need a change of variables other than polar, cylindrical and spherical coordinates.', zh: '本游戏不评估证明、直角坐标下积分次序的选择，也不评估需要极坐标、柱坐标、球坐标以外的变量替换的积分。' },
  63: { en: 'This game does not assess deriving Maxwell\'s equations from physical principles, computing a field from a given charge distribution, or boundary-value problems for harmonic functions.', zh: '本游戏不评估由物理原理推导麦克斯韦方程、由给定电荷分布计算电场，也不评估调和函数的边值问题。' },
  64: { en: 'This game does not ask you to evaluate the spherical-coordinate cap integral or to use the divergence theorem on a closed surface; it checks the set-ups and a few short computations.', zh: '本游戏不要求计算球冠的球坐标积分，也不要求对闭曲面使用散度定理；它检验积分的设定和几个简短的计算。' },
} as const;

function shapeTests(game: 61 | 62 | 63 | 64, ids: string[], kinds: string[]) {
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
    // the explanation states the numeric answer; the hint never states the answer of its own card
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
// MIT-MV-61 — simply connected regions
// ======================================================================================================
const IDS_61 = ['definition', 'region', 'paraboloid', 'mobius', 'circle-setup', 'counterexample', 'winding', 'flux-split', 'challenge'];
const KINDS_61 = ['MIT-MV-61:challenge', 'MIT-MV-61:winding'];
/** F·dr along r(t) for F = (−y, x, 0)/(x² + y²) (z-independent), integrated by Simpson over [t0, t1]. */
function swirl(r: (t: number) => P3, dr: (t: number) => P3, t0: number, t1: number, panels: number): number {
  return simpson(t => { const [x, y] = r(t); const [dx, dy] = dr(t); const d = x * x + y * y; return (-y * dx + x * dy) / d; }, t0, t1, panels);
}
const wholeTurns = (rr: (t: number) => P3, dr: (t: number) => P3, turns: number) => { let s = 0; for (let k = 0; k < Math.abs(turns); k++) s += swirl(rr, dr, 2 * PI * k, 2 * PI * (k + 1), 2000); return s; };

describe('MIT-MV-61 oracle', () => {
  shapeTests(61, IDS_61, KINDS_61);

  it('definition: exactly the shrinking statement is correct; the explanation clauses name only displayed distractors', () => everySeed((index, lang, f) => {
    const card = getCard(61, index, lang, 'definition');
    const mark = lang === 'en' ? 'shrunk to a point' : '缩成一点';
    const correct = card.choice!.options.map(o => has(o, mark));
    f.ok(correct.filter(Boolean).length === 1 && correct[card.choice!.answer], `seed ${index} ${lang}: predicate ${correct}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: ${card.choice!.options.length} options, plan 4 (correct + 3 distractors)`);
    const distractors: [string, string, string][] = lang === 'en'
      ? [['D is all of 3-space', 'is an example, not the definition', 'd1'], ['is a circle', 'any shape', 'd2'], ['gradient field', 'also needs curl F = 0', 'd3'], ['bounded', 'Boundedness', 'd4'], ['inside or the outside of a sphere', 'inside or outside of a sphere are examples', 'd5']]
      : [['D 是整个三维空间', '是单连通区域的一个例子而不是定义', 'd1'], ['都是圆', '可以是任意形状', 'd2'], ['梯度场', '梯度场还要求旋度为零', 'd3'], ['有界的', '有界性不是定义的一部分', 'd4'], ['球面的内部或外部', '球的内部或外部只是例子', 'd5']];
    for (const [optionMark, clauseMark, name] of distractors) {
      const shown = card.choice!.options.some(o => o.includes(optionMark));
      f.ok(shown === card.explanation.includes(clauseMark), `seed ${index} ${lang}: ${name} option shown=${shown} but explanation clause ${card.explanation.includes(clauseMark) ? 'present' : 'absent'}`);
    }
  }));

  it('region: exactly the one non-simply-connected region is correct; radii printed as squares 1, 4, 9', () => everySeed((index, lang, f) => {
    const card = getCard(61, index, lang, 'region');
    const bad = (o: string) => lang === 'en' ? /torus|outside of the cylinder|z-axis removed|loop of wire/.test(o) : /圆环面|圆柱面.*外部|去掉 z 轴|导线/.test(o);
    const verdict = card.choice!.options.map(bad);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    const squares = card.choice!.options.flatMap(o => [...clean(o).matchAll(/= (\d+)/g)].map(m => Number(m[1])));
    f.ok(squares.every(s => [1, 4, 9].includes(s)), `seed ${index}: printed squares ${squares} not in {1,4,9}`);
    // the three simply connected options of the plan are always there
    const need = lang === 'en' ? ['all of 3-space', 'the inside of the sphere', 'the outside of the sphere'] : ['整个三维空间', '的内部', '的外部'];
    f.ok(card.choice!.options.length === 4, `seed ${index}: ${card.choice!.options.length} options`);
    f.ok(need.every(n => card.choice!.options.some(o => o.includes(n))), `seed ${index} ${lang}: one of the three fixed simply connected options is missing`);
  }));

  it('paraboloid: only "yes, every closed curve can be shrunk" is correct; figure shows the surface and the circle', () => everySeed((index, lang, f) => {
    const card = getCard(61, index, lang, 'paraboloid');
    const m = rx(card.prompt, /z = (\d*)x² \+ (\d*)y²/, 'a');
    const a = cf(m[1]);
    f.ok(cf(m[2]) === a && a >= 1 && a <= 4, `seed ${index}: a ${a}/${cf(m[2])} outside plan`);
    const c = rx(card.prompt, /x² \+ y² = (\d+)[,，] ?z = (\d+)/, 'circle');
    const r2 = Number(c[1]), z = Number(c[2]);
    const r = Math.sqrt(r2);
    f.ok([1, 4, 9].includes(r2) && z === a * r2, `seed ${index}: r² ${r2}, z ${z}, a·r² ${a * r2}`);
    const yes = (o: string) => lang === 'en' ? /^Yes/.test(o) && /shrunk/.test(o) : /^是/.test(o) && /缩成/.test(o);
    const verdict = card.choice!.options.map(yes);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: options ${card.choice!.options.length}`);
    const fig = card.figure!;
    f.ok(!!fig, `seed ${index}: figure missing`);
    const wire = wireProblems(fig, (u, v) => [u * Math.cos(v), u * Math.sin(v), a * u * u], 0, r, 0, 2 * PI, 4, 12);
    f.ok(wire.length === 0, `seed ${index}: paraboloid wire missing ${wire}`);
    const axes = axesProblems(fig, Math.max(r, a * r2) + 1);
    f.ok(axes.length === 0, `seed ${index}: axes ${axes} (length ${Math.max(r, a * r2) + 1})`);
    f.ok(lineShapes(fig).some(l => l.tone === 'accent2' && l.points.length >= 24 && l.points.every((pt, i) => ptNear(pt, proj(r * Math.cos(2 * PI * i / (l.points.length - 1)), r * Math.sin(2 * PI * i / (l.points.length - 1)), z), 1e-9))), `seed ${index}: circle C (accent2) at radius ${r}, height ${z} missing`);
    f.ok(lineShapes(fig).some(l => l.tone === 'accent2' && (l.width ?? 1) > 1), `seed ${index}: circle C not thicker`);
    const nums = numbersIn(fig.alt);
    f.ok([a, r, r2, z].every(v => v === 1 || nums.includes(v)), `seed ${index} ${lang}: alt numbers ${nums} lack ${[a, r, r2, z]}`);
  }));

  it('mobius: only "not simply connected" is correct; the clauses match the displayed false statements', () => everySeed((index, lang, f) => {
    const card = getCard(61, index, lang, 'mobius');
    const good = (o: string) => lang === 'en' ? /^It is not simply connected/.test(o) : /^它不是单连通的/.test(o);
    const verdict = card.choice!.options.map(good);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: options ${card.choice!.options.length}`);
    const marks: [string, string, string][] = lang === 'en'
      ? [['so it is simply connected', 'So the claim that every closed curve can be shrunk is false', 'f1'], ['continuous unit normal', 'no continuous normal exists', 'f2'], ['flux of a vector field through it is well defined', 'makes no sense', 'f3'], ["Stokes' theorem applies", 'cannot be oriented', 'f4']]
      : [['所以它是单连通的', '「每条闭曲线都能缩成一点」的说法是错的', 'f1'], ['连续地选取单位法向量', '不存在连续的法向量', 'f2'], ['通量有确定的意义', '谈不上穿过它的通量', 'f3'], ['斯托克斯定理适用于', '无法定向', 'f4']];
    for (const [optionMark, clauseMark, name] of marks) {
      const shown = card.choice!.options.some(o => o.includes(optionMark));
      f.ok(shown === card.explanation.includes(clauseMark), `seed ${index} ${lang}: ${name} shown=${shown} but clause ${card.explanation.includes(clauseMark) ? 'present' : 'absent'}`);
    }
    f.ok(has(card.prompt, lang === 'en' ? 'odd number of half-twists' : '奇数个半圈'), `seed ${index} ${lang}: prompt does not say "odd number of half-twists"`);
  }));

  it('circle-setup: F·r′ = 1 and ∮ = 2π by quadrature; tokens as in the plan; figure circle and arrow', () => everySeed((index, lang, f) => {
    const card = getCard(61, index, lang, 'circle-setup');
    const m = rx(card.prompt, /\((\d+) cos t, (\d+) sin t, (\d+)\)/, 'circle');
    const R = Number(m[1]), z0 = Number(m[3]);
    f.ok(Number(m[2]) === R && R >= 2 && R <= 5 && z0 >= 1 && z0 <= 3, `seed ${index}: R,z0 ${R},${z0} outside plan`);
    checkOrientation(card, lang, [loop(lang, 'ccw'), RIGHT_HAND(lang)], `seed ${index} ${lang}`, f);
    checkSymbols(card, ['1', '2π', '2π'], `seed ${index} ${lang} circle-setup`, f);
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(['1', `${R}`, `1/${R}`, `${R * R}`, '2π', 'π', `${2 * R}π`, `${2 * R * R}π`].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const rr = (t: number): P3 => [R * Math.cos(t), R * Math.sin(t), z0], dr = (t: number): P3 => [-R * Math.sin(t), R * Math.cos(t), 0];
    const integrand = (t: number) => { const [x, y] = rr(t); const [dx, dy] = dr(t); return (-y * dx + x * dy) / (x * x + y * y); };
    const total = simpson(integrand, 0, 2 * PI, 4000);
    const [s0, s1, s2] = card.slots!.answers.map(a => evOrNaN(a));
    f.ok(near(s0, integrand(0.7), 1e-9) && near(s0, integrand(2.9), 1e-9), `seed ${index}: slot 0 ${s0} is not F·r′ = ${integrand(0.7)}`);
    f.ok(near(s1, 2 * PI, 1e-12), `seed ${index}: upper limit ${s1}`);
    f.ok(near(s2, total, 1e-9), `seed ${index}: ∮ ${s2} vs quadrature ${total}`);
    f.ok(has(card.prompt, '2π'), `seed ${index}: the range 0 ≤ t ≤ 2π is not printed`);
    // every other token is wrong in slot 0 and slot 2 (numerically)
    for (const token of card.slots!.tokens) {
      const v = evOrNaN(token);
      if (token !== '1') f.ok(!near(v, integrand(0.7), 1e-9), `seed ${index}: token ${token} also equals the integrand`);
      if (token !== '2π') f.ok(!near(v, total, 1e-9), `seed ${index}: token ${token} also equals the circulation`);
    }
    const fig = card.figure!;
    f.ok(axesProblems(fig, Math.max(R, z0) + 1).length === 0, `seed ${index}: axes missing (${axesProblems(fig, Math.max(R, z0) + 1)}) length ${Math.max(R, z0) + 1}`);
    const circ = (t: number): P3 => [R * Math.cos(t), R * Math.sin(t), z0];
    f.ok(lineShapes(fig).some(l => l.points.length === 49 && hasCurve({ ...fig, shapes: [l] }, circ, 0, 2 * PI)), `seed ${index}: circle of radius ${R} at height ${z0} missing`);
    f.ok(hasArrow(fig, proj(...circ(PI / 4)), proj(...circ(PI / 4 + 0.4)), 1e-9), `seed ${index}: counterclockwise arrow at t = π/4 missing`);
    const nums = numbersIn(fig.alt);
    f.ok(nums.includes(R) && nums.includes(z0), `seed ${index} ${lang}: alt ${fig.alt} lacks R=${R} / z0=${z0}`);
    f.ok(has(fig.alt, loop(lang, 'ccw').replace(' viewed from above', '')) || has(fig.alt, '逆时针'), `seed ${index} ${lang}: alt does not say counterclockwise`);
  }));

  it('counterexample: ∮ = 2π ≠ 0 by quadrature, so only "not a gradient field although curl F = 0" is correct', () => everySeed((index, lang, f) => {
    const card = getCard(61, index, lang, 'counterexample');
    const m = rxl(card.prompt, lang, /radius (\d+) in the plane z = (\d+)/, /z = (\d+) 内以 z 轴为中心、半径为 (\d+)/, 'R,z0');
    const R = Number(lang === 'en' ? m[1] : m[2]), z0 = Number(lang === 'en' ? m[2] : m[1]);
    f.ok(R >= 2 && R <= 5 && z0 >= 1 && z0 <= 3, `seed ${index}: R,z0 ${R},${z0} outside plan`);
    checkOrientation(card, lang, [loop(lang, 'ccw'), RIGHT_HAND(lang)], `seed ${index} ${lang}`, f);
    const rr = (t: number): P3 => [R * Math.cos(t), R * Math.sin(t), z0], dr = (t: number): P3 => [-R * Math.sin(t), R * Math.cos(t), 0];
    const total = swirl(rr, dr, 0, 2 * PI, 4000);
    f.ok(near(total, 2 * PI, 1e-9), `seed ${index}: oracle circulation ${total}`);
    // an option is correct iff what it claims is true: "gradient field" needs zero circulation; a claimed circulation must equal the true one
    const claim = (o: string): boolean => {
      const c = clean(o);
      const claimsGradient = lang === 'en' ? /is a gradient field on D, because/.test(c) : /^F 在 D 上是梯度场/.test(c);
      if (claimsGradient) return Math.abs(total) < 1e-9;
      const value = c.match(/∮_C F \* dr = (\d*)(π)?/);
      if (!value) return false;
      const v = (value[1] === '' ? 1 : Number(value[1])) * (value[2] ? PI : 1);
      return near(v, total, 1e-9);
    };
    const verdict = card.choice!.options.map(claim);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: options ${card.choice!.options.length}`);
    // the false "∮ = 2R²π ... |F| = R" option does not coincide with the truth for R ≥ 2
    f.ok(card.choice!.options.some(o => has(o, `${2 * R * R}π`)), `seed ${index} ${lang}: the 2R²π distractor is not offered (${2 * R * R}π)`);
    const fig = card.figure!;
    const circ = (t: number): P3 => [R * Math.cos(t), R * Math.sin(t), z0];
    f.ok(lineShapes(fig).some(l => l.points.length === 49 && hasCurve({ ...fig, shapes: [l] }, circ, 0, 2 * PI)), `seed ${index}: circle missing`);
    f.ok(hasArrow(fig, proj(...circ(PI / 4)), proj(...circ(PI / 4 + 0.4))), `seed ${index}: ccw arrow missing`);
    f.ok(axesProblems(fig, Math.max(R, z0) + 1).length === 0, `seed ${index}: axes ${axesProblems(fig, Math.max(R, z0) + 1)}`);
    f.ok(lineShapes(fig).some(l => l.dash && l.tone === 'warn' && l.points.length >= 2 && ptNear(l.points[0], proj(0, 0, -1)) && ptNear(l.points[l.points.length - 1], proj(0, 0, z0 + 2))), `seed ${index}: dashed warn z-axis from (0,0,−1) to (0,0,${z0 + 2}) missing`);
    f.ok(has(fig.alt, lang === 'en' ? 'z-axis is the part removed' : 'z 轴是从 D 中去掉的部分'), `seed ${index} ${lang}: alt lacks the removed-axis sentence`);
  }));

  it('winding: ∮ F·dr over n turns by quadrature (circle and ellipse), k = ∮/π', () => everySeed((index, lang, f) => {
    const card = getCard(61, index, lang, 'winding');
    const n = Number(rxl(card.prompt, lang, /goes (\d+) times around/, /绕 z 轴 (\d+) 圈/, 'n')[1]);
    f.ok(n >= 2 && n <= 7, `seed ${index}: n ${n} outside plan`);
    checkOrientation(card, lang, [loop(lang, 'ccw'), RIGHT_HAND(lang)], `seed ${index} ${lang}`, f);
    const circle = wholeTurns(t => [3 * Math.cos(t), 3 * Math.sin(t), 0], t => [-3 * Math.sin(t), 3 * Math.cos(t), 0], n) / PI;
    const ellipse = wholeTurns(t => [3 * Math.cos(t), 2 * Math.sin(t), 0], t => [-3 * Math.sin(t), 2 * Math.cos(t), 0], n) / PI;
    f.ok(near(circle, ellipse, 1e-8), `seed ${index}: routes disagree ${circle} vs ${ellipse}`);
    auditIs(card, 'MIT-MV-61:winding', { n }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [circle], 1e-6, `seed ${index} ${lang} winding`, f);
  }));

  it('flux-split: the assembled boundary integrals reproduce the flux through each hemisphere (G = (−y, x, 0)/2 on the unit sphere)', () => everySeed((index, lang, f) => {
    const card = getCard(61, index, lang, 'flux-split');
    const m = rxl(card.prompt, lang, /The closed curve ([CΓK]) cuts S into two parts S₁ and S₂, and ([CΓK]) is the positive boundary of (S[₁₂])/, /闭曲线 ([CΓK]) 把 S 分成.*?，([CΓK]) 是 (S[₁₂]) 的正向边界/, 'L, Sp');
    const L = m[1], Sp = m[3];
    f.ok(m[2] === L && ['C', 'Γ', 'K'].includes(L), `seed ${index}: curve letters ${m[1]}/${m[2]}`);
    f.ok(has(card.prompt, lang === 'en' ? 'outward' : '外侧'), `seed ${index} ${lang}: outward orientation not stated`);
    const answers = Sp === 'S₁' ? [L, `−${L}`, '0'] : [`−${L}`, L, '0'];
    checkSymbols(card, answers, `seed ${index} ${lang} flux-split`, f);
    // semantic check on a concrete case: S the unit sphere, G = (−y, x, 0)/2, curl G = (0, 0, 1), L the equator.
    // S₁ = upper hemisphere (outward normal up, boundary: equator counterclockwise from above); S₂ = lower hemisphere (boundary clockwise).
    const hemi = (zSign: 1 | -1) => simpson(th => simpson(ph => { const nz = zSign * Math.cos(ph); return nz * Math.sin(ph); }, 0, PI / 2, 200), 0, 2 * PI, 200);
    const flux1 = hemi(1), flux2 = -hemi(1);
    const equator = simpson(t => { const x = Math.cos(t), y = Math.sin(t); return (-y / 2) * (-Math.sin(t)) + (x / 2) * Math.cos(t); }, 0, 2 * PI, 2000); // ccw from above
    f.ok(near(flux1, equator, 1e-8) && near(flux2, -equator, 1e-8), `seed ${index}: hemisphere check inconsistent ${flux1} ${equator} ${flux2}`);
    const orientationOfL = Sp === 'S₁' ? 1 : -1; // L is the positive boundary of Sp: ccw for S₁ (outward normal up), cw for S₂
    const lineValue = (token: string) => token === '0' ? 0 : (token.startsWith('−') ? -1 : 1) * orientationOfL * equator;
    const [a0, a1, a2] = card.slots!.answers;
    f.ok(near(lineValue(a0), flux1, 1e-8), `seed ${index}: first integral ${lineValue(a0)} vs flux through S₁ ${flux1}`);
    f.ok(near(lineValue(a1), flux2, 1e-8), `seed ${index}: second integral ${lineValue(a1)} vs flux through S₂ ${flux2}`);
    f.ok(near(lineValue(a2), flux1 + flux2, 1e-8), `seed ${index}: total ${lineValue(a2)}`);
    // tokens (EN exact): the wrong ones are the plan's misconceptions
    if (lang === 'en') f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify([L, `−${L}`, '0', `2∮ over ${L} of G · dr`, `∮ over ${L} of G · dr`, 'the area of S₁'].sort()), `seed ${index}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    else f.ok(card.slots!.tokens.length === 6 && card.slots!.tokens.includes(L) && card.slots!.tokens.includes(`−${L}`) && card.slots!.tokens.includes('0'), `seed ${index}: zh tokens ${JSON.stringify(card.slots!.tokens)}`);
  }));

  it('challenge: sum of three parametrised line integrals = (2(p − q))π', () => everySeed((index, lang, f) => {
    const card = getCard(61, index, lang, 'challenge');
    const m = rxl(card.prompt, lang, /C₁ goes (\d+) times? around the z-axis.*?C₂ goes (\d+) times? around the z-axis/, /C₁ 绕 z 轴 (\d+) 圈.*?C₂ 绕 z 轴 (\d+) 圈/, 'p,q');
    const p = Number(m[1]), q = Number(m[2]);
    f.ok(p >= 1 && p <= 4 && q >= 1 && q <= 3 && p !== q, `seed ${index}: p,q ${p},${q} outside plan`);
    checkOrientation(card, lang, [loop(lang, 'ccw'), loop(lang, 'cw')], `seed ${index} ${lang}`, f);
    const c1 = wholeTurns(t => [2 * Math.cos(t), 2 * Math.sin(t), 0], t => [-2 * Math.sin(t), 2 * Math.cos(t), 0], p);
    const c2 = wholeTurns(t => [3 * Math.cos(t), -3 * Math.sin(t), 0], t => [-3 * Math.sin(t), -3 * Math.cos(t), 0], q);
    const c3 = swirl(t => [4 + Math.cos(t), Math.sin(t), 0], t => [-Math.sin(t), Math.cos(t), 0], 0, 2 * PI, 4000);
    const k = (c1 + c2 + c3) / PI;
    f.ok(near(c3, 0, 1e-9), `seed ${index}: C₃ ${c3}`);
    auditIs(card, 'MIT-MV-61:challenge', { p, q }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [k], 1e-6, `seed ${index} ${lang} challenge`, f);
  }));

  it('variety and answer positions', () => {
    for (const slug of IDS_61) expect(distinctCount(61, slug, fullKey), slug).toBeGreaterThanOrEqual(6);
    for (const slug of ['definition', 'region', 'paraboloid', 'mobius', 'counterexample']) expect(answerPositions(61, slug).size, `${slug} answer positions`).toBeGreaterThanOrEqual(2);
  });
});

// ======================================================================================================
// MIT-MV-62 — summary of multiple integration
// ======================================================================================================
const IDS_62 = ['coords', 'polar-setup', 'polar-integral', 'jacobian-check', 'cyl-setup', 'cyl-mass', 'sph-setup', 'sph-mass', 'challenge'];
const KINDS_62 = ['MIT-MV-62:challenge', 'MIT-MV-62:cyl-mass', 'MIT-MV-62:polar-integral', 'MIT-MV-62:sph-mass'];
/** ∭ ρ dV over a ≤ ρ ≤ b by cylindrical coordinates; the z-integral is done by the antiderivative of √(r² + z²). */
function shellMass(a: number, b: number): number {
  const F = (z: number, r: number) => r < 1e-12 ? z * z / 2 : 0.5 * (z * Math.sqrt(r * r + z * z) + r * r * Math.asinh(z / r));
  const inner = integrate(s => { const r = a * Math.sin(s); return r * 2 * (F(Math.sqrt(b * b - r * r), r) - F(Math.sqrt(Math.max(0, a * a - r * r)), r)) * a * Math.cos(s); }, 0, PI / 2);
  const outer = integrate(s => { const r = b * Math.sin(s); return r * 2 * F(Math.sqrt(Math.max(0, b * b - r * r)), r) * b * Math.cos(s); }, Math.asin(a / b), PI / 2);
  return 2 * PI * (inner + outer);
}
const radiusOf = (card: PracticeCard, lang: Lang) => Number(rxl(card.prompt, lang, /radius (\d+)/, /半径为 (\d+)/, 'R')[1]);

describe('MIT-MV-62 oracle', () => {
  shapeTests(62, IDS_62, KINDS_62);

  it('coords: the system with constant limits for the sampled region', () => everySeed((index, lang, f) => {
    const card = getCard(62, index, lang, 'coords');
    const q = card.prompt;
    let want: string;
    if (lang === 'en') {
      if (/ball of radius (\d+), x² \+ y² \+ z² ≤ (\d+)/.test(q)) { const m = rx(q, /ball of radius (\d+), x² \+ y² \+ z² ≤ (\d+)/, 'ball'); f.ok(Number(m[1]) ** 2 === Number(m[2]) && Number(m[1]) >= 2 && Number(m[1]) <= 6, `seed ${index}: ball ${m[1]},${m[2]}`); want = 'spherical'; }
      else if (/solid cylinder x² \+ y² ≤ (\d+) \(radius (\d+)\), 0 ≤ z ≤ (\d+)/.test(q)) { const m = rx(q, /solid cylinder x² \+ y² ≤ (\d+) \(radius (\d+)\), 0 ≤ z ≤ (\d+)/, 'cyl'); f.ok(Number(m[2]) ** 2 === Number(m[1]) && Number(m[2]) >= 2 && Number(m[2]) <= 5 && Number(m[3]) >= 2 && Number(m[3]) <= 6, `seed ${index}: cylinder ${m.slice(1)}`); want = 'cylindrical'; }
      else if (/double integral is taken over the disc of radius (\d+) in the xy-plane, x² \+ y² ≤ (\d+)/.test(q)) { const m = rx(q, /disc of radius (\d+) in the xy-plane, x² \+ y² ≤ (\d+)/, 'disc'); f.ok(Number(m[1]) ** 2 === Number(m[2]) && Number(m[1]) >= 2 && Number(m[1]) <= 6, `seed ${index}: disc ${m.slice(1)}`); want = 'polar'; }
      else { const m = rx(q, /box 0 ≤ x ≤ (\d+), 0 ≤ y ≤ (\d+), 0 ≤ z ≤ (\d+)/, 'box'); f.ok(m.slice(1).every(v => Number(v) >= 2 && Number(v) <= 5), `seed ${index}: box ${m.slice(1)}`); want = 'rectangular'; }
    } else {
      if (/对半径为 (\d+) 的球 x² \+ y² \+ z² ≤ (\d+)/.test(clean(q))) { const m = rx(q, /半径为 (\d+) 的球 x² \+ y² \+ z² ≤ (\d+)/, 'ball'); f.ok(Number(m[1]) ** 2 === Number(m[2]), `seed ${index}: ball ${m.slice(1)}`); want = '球坐标'; }
      else if (/实心圆柱 x² \+ y² ≤ (\d+)（半径 (\d+)）/.test(clean(q))) { const m = rx(q, /实心圆柱 x² \+ y² ≤ (\d+)（半径 (\d+)）/, 'cyl'); f.ok(Number(m[2]) ** 2 === Number(m[1]), `seed ${index}: cyl ${m.slice(1)}`); want = '柱坐标'; }
      else if (/二重积分/.test(q)) { const m = rx(q, /半径为 (\d+) 的圆盘 x² \+ y² ≤ (\d+)/, 'disc'); f.ok(Number(m[1]) ** 2 === Number(m[2]), `seed ${index}: disc ${m.slice(1)}`); want = '极坐标'; }
      else { rx(q, /长方体 0 ≤ x ≤ (\d+)，0 ≤ y ≤ (\d+)，0 ≤ z ≤ (\d+)/, 'box'); want = '直角坐标'; }
    }
    const verdict = card.choice!.options.map(o => o.includes(want));
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate (${want}) ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: options ${card.choice!.options.length}`);
  }));

  it('polar-setup: assembled bounds and integrand reproduce ∬ a(x²+y²) dA over the disc (rectangular quadrature)', () => everySeed((index, lang, f) => {
    const card = getCard(62, index, lang, 'polar-setup');
    const a = cf(rx(card.prompt, /∬_D (\d*)\(x² \+ y²\) dA/, 'a')[1]);
    const R = radiusOf(card, lang);
    const R2 = Number(rx(card.prompt, /x² \+ y² ≤ (\d+)/, 'R2')[1]);
    f.ok(a >= 1 && a <= 3 && R >= 2 && R <= 4 && R2 === R * R, `seed ${index}: a,R,R² ${a},${R},${R2}`);
    const co = (k: number, v: string) => k === 1 ? v : `${k}${v}`;
    checkSymbols(card, ['2π', `${R}`, co(a, 'r³')], `seed ${index} ${lang} polar-setup`, f);
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(['2π', 'π', `${R}`, `${R2}`, co(a, 'r³'), co(a, 'r²'), co(a, 'r')].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const truth = disc((x, y) => a * (x * x + y * y), R);
    f.ok(near(truth, a * PI * R ** 4 / 2, 1e-8), `seed ${index}: rectangular quadrature ${truth}`);
    // integral over θ ∈ [0, A], r ∈ [0, B] of g(r) · (the dA factor r is already in the token) dr dθ
    const value = (ans: string[]) => { const A = evOrNaN(ans[0]), B = evOrNaN(ans[1]); return A * simpson(r => evOrNaN(ans[2], { r }), 0, B, 8); };
    assembleCheck(card, value, truth, `seed ${index} ${lang}`, f, 1e-8, { slot: 2, envs: [{ r: 0.7 }, { r: 1.9 }, { r: 3.1 }] });
    const fig = card.figure!;
    f.ok(areaShapes(fig).some(s => s.opacity === 0.25 && s.tone === 'accent' && s.points.every(pt => near(Math.hypot(pt[0], pt[1]), R, 1e-9))), `seed ${index}: disc area of radius ${R} (accent, opacity .25) missing`);
    f.ok(hasArrow(fig, [-(R + 1), 0], [R + 1, 0]) || arrowShapes(fig).some(s => s.label === 'x' && near(s.to[0], R + 1)), `seed ${index}: x-axis arrow missing`);
    f.ok(arrowShapes(fig).some(s => s.label === 'x') && arrowShapes(fig).some(s => s.label === 'y'), `seed ${index}: axis labels x,y missing`);
    f.ok(!/\d/.test(fig.alt), `seed ${index} ${lang}: alt reveals a number (${fig.alt})`);
    f.ok(!fig.shapes.some(s => (s.kind === 'text' && /\d/.test(s.text)) || ('label' in s && /\d/.test(s.label ?? ''))), `seed ${index}: figure labels a number (the radius is an answer)`);
  }));

  it('polar-integral: rectangular quadrature, k = a R⁴/2', () => everySeed((index, lang, f) => {
    const card = getCard(62, index, lang, 'polar-integral');
    const a = cf(rx(card.prompt, /∬_D (\d*)\(x² \+ y²\) dA/, 'a')[1]);
    const R = radiusOf(card, lang);
    f.ok(a >= 1 && a <= 3 && R >= 2 && R <= 4, `seed ${index}: a,R ${a},${R}`);
    const k = disc((x, y) => a * (x * x + y * y), R) / PI;
    auditIs(card, 'MIT-MV-62:polar-integral', { a, R }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [k], 1e-6, `seed ${index} ${lang} polar-integral`, f);
    f.ok(has(card.prompt, 'k·π') || has(card.prompt, 'k*π') || has(card.prompt, 'k·π'), `seed ${index}: prompt does not define k·π`);
    const vals = bracketPi(card.explanation);
    f.ok(vals.some(v => near(v, k, 1e-9)), `seed ${index} ${lang}: explanation (k)π values ${vals} lack ${k}`);
    const fig = card.figure!;
    f.ok(areaShapes(fig).some(s => s.points.every(pt => near(Math.hypot(pt[0], pt[1]), R, 1e-9))), `seed ${index}: disc missing`);
    f.ok(lineShapes(fig).some(l => l.points.length === 2 && ptNear(l.points[0], [0, 0]) && ptNear(l.points[1], [R, 0]) && l.label === `${R}`), `seed ${index}: radius line (0,0)→(${R},0) labelled ${R} missing`);
    f.ok(numbersIn(fig.alt).includes(R), `seed ${index} ${lang}: alt lacks radius`);
  }));

  it('jacobian-check: the correct option is the one whose corrected integral equals the true disc integral', () => everySeed((index, lang, f) => {
    const card = getCard(62, index, lang, 'jacobian-check');
    const a = cf(rx(card.prompt, /∬_D (\d*)\(x² \+ y²\)/, 'a')[1]);
    const R = radiusOf(card, lang);
    f.ok(a >= 1 && a <= 3 && R >= 2 && R <= 4, `seed ${index}: a,R ${a},${R}`);
    const truth = disc((x, y) => a * (x * x + y * y), R);
    const student = 2 * PI * a * R ** 3 / 3;
    f.ok(!near(student, truth, 1e-6), `seed ${index}: the student's value equals the truth`);
    // what each option says the integral should be (value of the corrected integral)
    const fixedValue = (o: string): number => {
      const c = clean(o);
      if (lang === 'en' ? /Jacobian factor r is missing/.test(c) : /漏了雅可比因子 r/.test(c)) return simpson(r => a * r ** 3, 0, R, 8) * 2 * PI;
      if (lang === 'en' ? /upper limit of θ should be π/.test(c) : /θ 的上限应是 π/.test(c)) return simpson(r => a * r * r, 0, R, 8) * PI;
      if (lang === 'en' ? /equals r, so the integrand should be/.test(c) : /等于 r，所以被积函数应为/.test(c)) return simpson(r => a * r, 0, R, 8) * 2 * PI;
      if (lang === 'en' ? /Nothing is wrong/.test(c) : /没有错误/.test(c)) return student;
      return NaN;
    };
    const verdict = card.choice!.options.map(o => near(fixedValue(o), truth, 1e-8));
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4 && card.choice!.options.every(o => !Number.isNaN(fixedValue(o))), `seed ${index}: unrecognised option`);
    const vals = bracketPi(card.explanation);
    f.ok(vals.some(v => near(v, truth / PI, 1e-9)) && vals.some(v => near(v, student / PI, 1e-9)), `seed ${index} ${lang}: explanation values ${vals} lack ${truth / PI} and ${student / PI}`);
  }));

  it('cyl-setup: the assembled triple integral equals the rectangular ∭ z dV', () => everySeed((index, lang, f) => {
    const card = getCard(62, index, lang, 'cyl-setup');
    const m = rx(card.prompt, /x² \+ y² ≤ (\d+)[,，] ?0 ≤ z ≤ (\d+)/, 'R2,h');
    const R2 = Number(m[1]), h = Number(m[2]), R = Math.sqrt(R2);
    const allowed = [[2, 3], [2, 5], [2, 6], [3, 2], [3, 4], [3, 5], [3, 6], [4, 3], [4, 5], [4, 6]];
    f.ok(allowed.some(([r, hh]) => r === R && hh === h), `seed ${index}: (R,h) = (${R},${h}) outside the plan's 10 pairs`);
    checkSymbols(card, [`${R}`, `${h}`, 'z r'], `seed ${index} ${lang} cyl-setup`, f);
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify([`${R}`, `${R2}`, `${h}`, `${h * h}`, 'z r', 'z', 'r', 'z r²'].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const truth = disc(() => h * h / 2, R);
    f.ok(near(truth, PI * R2 * h * h / 2, 1e-8), `seed ${index}: rectangular quadrature ${truth}`);
    const value = (ans: string[]) => { const B = evOrNaN(ans[0]), H = evOrNaN(ans[1]); return 2 * PI * simpson(r => simpson(z => evOrNaN(ans[2], { r, z }), 0, H, 8), 0, B, 8); };
    assembleCheck(card, value, truth, `seed ${index} ${lang}`, f, 1e-8, { slot: 2, envs: [{ r: 0.7, z: 1.1 }, { r: 1.9, z: 0.4 }, { r: 3.1, z: 2.3 }] });
    const fig = card.figure!;
    const wire = wireProblems(fig, (u, v) => [R * Math.cos(u), R * Math.sin(u), v], 0, 2 * PI, 0, h, 12, 2);
    f.ok(wire.length === 0, `seed ${index}: cylinder wire missing ${wire}`);
    f.ok(axesProblems(fig, Math.max(R, h) + 1).length === 0, `seed ${index}: axes ${axesProblems(fig, Math.max(R, h) + 1)}`);
    f.ok(!/\d/.test(fig.alt) && !fig.shapes.some(s => s.kind === 'text'), `seed ${index} ${lang}: setup figure shows numbers`);
  }));

  it('cyl-mass: rectangular quadrature, k = R²h²/2; figure labels R and h', () => everySeed((index, lang, f) => {
    const card = getCard(62, index, lang, 'cyl-mass');
    const R = radiusOf(card, lang);
    const h = Number(rxl(card.prompt, lang, /height (\d+)/, /高为 (\d+)/, 'h')[1]);
    const R2 = Number(rx(card.prompt, /x² \+ y² ≤ (\d+)/, 'R2')[1]);
    f.ok(R2 === R * R && R >= 2 && R <= 4 && h >= 2 && h <= 6, `seed ${index}: R,h,R² ${R},${h},${R2}`);
    f.ok(has(card.prompt, `0 ≤ z ≤ ${h}`), `seed ${index}: z-range`);
    const k = disc(() => h * h / 2, R) / PI;
    auditIs(card, 'MIT-MV-62:cyl-mass', { R, h }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [k], 1e-6, `seed ${index} ${lang} cyl-mass`, f);
    const vals = bracketPi(card.explanation);
    f.ok(vals.some(v => near(v, k, 1e-9)), `seed ${index} ${lang}: explanation values ${vals} lack ${k}`);
    const fig = card.figure!;
    f.ok(wireProblems(fig, (u, v) => [R * Math.cos(u), R * Math.sin(u), v], 0, 2 * PI, 0, h, 12, 2).length === 0, `seed ${index}: cylinder wire`);
    const tx = textShapes(fig);
    f.ok(tx.some(t => t.text === `R = ${R}` && ptNear(t.at, proj(R, 0, 0), 1e-9)), `seed ${index}: label "R = ${R}" at (R,0,0) missing`);
    f.ok(tx.some(t => t.text === `h = ${h}` && ptNear(t.at, proj(0, R + 0.3, h / 2), 1e-9)), `seed ${index}: label "h = ${h}" at (0,R+0.3,h/2) missing`);
    f.ok(axesProblems(fig, Math.max(R, h) + 1).length === 0, `seed ${index}: axes`);
    const nums = numbersIn(fig.alt);
    f.ok(nums.includes(R) && nums.includes(h), `seed ${index} ${lang}: alt lacks R,h`);
  }));

  it('sph-setup: the assembled ρ, φ bounds and integrand integrate to the shell mass (cylindrical quadrature)', () => everySeed((index, lang, f) => {
    const card = getCard(62, index, lang, 'sph-setup');
    const m = rx(card.prompt, /(\d+) ≤ x² \+ y² \+ z² ≤ (\d+)/, 'a2,b2');
    const a = Math.sqrt(Number(m[1])), b = Math.sqrt(Number(m[2]));
    const allowed = [[1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5], [3, 4], [3, 5]];
    f.ok(allowed.some(([x, y]) => x === a && y === b), `seed ${index}: (a,b) = (${a},${b}) outside plan`);
    checkSymbols(card, [`${a}`, `${b}`, 'π', 'ρ³ sin φ'], `seed ${index} ${lang} sph-setup`, f);
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify([`${a}`, `${b}`, `${b * b}`, '0', 'π', 'π/2', 'ρ³ sin φ', 'ρ² sin φ', 'ρ³'].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const truth = shellMass(a, b);
    f.ok(near(truth, PI * (b ** 4 - a ** 4), 1e-6), `seed ${index}: cylindrical quadrature ${truth} vs π(b⁴−a⁴)`);
    // ∫_0^{2π}∫_0^{Φ}∫_{lo}^{hi} g(ρ, φ) dρ dφ dθ with the density-times-Jacobian token g
    const value = (ans: string[]) => { const lo = evOrNaN(ans[0]), hi = evOrNaN(ans[1]), Phi = evOrNaN(ans[2]); return 2 * PI * simpson(ph => simpson(rho => evOrNaN(ans[3], { ρ: rho, φ: ph }), lo, hi, 16), 0, Phi, 64); };
    assembleCheck(card, value, truth, `seed ${index} ${lang}`, f, 1e-6);
    f.ok(has(card.prompt, lang === 'en' ? PHI_EN : PHI_ZH), `seed ${index} ${lang}: prompt lacks the φ rule`);
    const fig = card.figure!;
    const flat = (r: number) => (t: number): Pt => [r * Math.cos(t), r * Math.sin(t)];
    const circle2d = (r: number, tone?: string) => lineShapes(fig).some(l => (tone === undefined || l.tone === tone) && l.points.length >= 24 && l.points.every((pt, i) => ptNear(pt, flat(r)(2 * PI * i / (l.points.length - 1)), 1e-9)));
    f.ok(circle2d(a, 'accent2') && circle2d(b, 'accent'), `seed ${index}: circles of radius ${a} (accent2) and ${b} (accent) missing`);
    f.ok(arrowShapes(fig).some(s => s.label === 'x' && ptNear(s.from, [-(b + 1), 0]) && ptNear(s.to, [b + 1, 0])) && arrowShapes(fig).some(s => s.label === 'z' && ptNear(s.from, [0, -(b + 1)]) && ptNear(s.to, [0, b + 1])), `seed ${index}: x/z axis arrows from −${b + 1} to ${b + 1} missing`);
    f.ok(!/\d/.test(fig.alt) && !fig.shapes.some(s => s.kind === 'text'), `seed ${index} ${lang}: setup figure shows the radii`);
  }));

  it('sph-mass: cylindrical quadrature, k = b⁴ − a⁴', () => everySeed((index, lang, f) => {
    const card = getCard(62, index, lang, 'sph-mass');
    const m = rxl(card.prompt, lang, /radius (\d+) and radius (\d+)/, /半径分别为 (\d+) 和 (\d+)/, 'a,b');
    const a = Number(m[1]), b = Number(m[2]);
    const allowed = [[1, 2], [1, 3], [1, 4], [1, 5], [2, 3], [2, 4], [2, 5], [3, 4], [3, 5]];
    f.ok(allowed.some(([x, y]) => x === a && y === b), `seed ${index}: (a,b) = (${a},${b}) outside plan`);
    const k = shellMass(a, b) / PI;
    auditIs(card, 'MIT-MV-62:sph-mass', { a, b }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [k], 1e-5, `seed ${index} ${lang} sph-mass`, f);
    const vals = bracketPi(card.explanation);
    f.ok(vals.some(v => near(v, b ** 4 - a ** 4, 1e-9)), `seed ${index} ${lang}: explanation values ${vals} lack ${b ** 4 - a ** 4}`);
    const fig = card.figure!;
    const tx = textShapes(fig);
    const ang = 40 * PI / 180;
    f.ok(tx.some(t => t.text === `${a}` && ptNear(t.at, [a * Math.cos(ang), a * Math.sin(ang)], 1e-9)), `seed ${index}: label "${a}" on the inner circle at 40° missing`);
    f.ok(tx.some(t => t.text === `${b}` && ptNear(t.at, [b * Math.cos(ang), b * Math.sin(ang)], 1e-9)), `seed ${index}: label "${b}" on the outer circle at 40° missing`);
    const nums = numbersIn(fig.alt);
    f.ok(nums.includes(a) && nums.includes(b), `seed ${index} ${lang}: alt lacks a,b`);
    const circle2d = (r: number) => lineShapes(fig).some(l => l.points.length >= 24 && l.points.every((pt, i) => ptNear(pt, [r * Math.cos(2 * PI * i / (l.points.length - 1)), r * Math.sin(2 * PI * i / (l.points.length - 1))], 1e-9)));
    f.ok(circle2d(a) && circle2d(b), `seed ${index}: circles missing`);
  }));

  it('challenge: cylindrical quadrature of ∭_H m z dV = (m a⁴/4)π', () => everySeed((index, lang, f) => {
    const card = getCard(62, index, lang, 'challenge');
    const a2 = Number(rx(card.prompt, /x² \+ y² \+ z² ≤ (\d+)/, 'a2')[1]);
    const a = Math.sqrt(a2);
    const m = cf(rx(card.prompt, /∭_H (\d*)z dV/, 'm')[1]);
    f.ok(a >= 2 && a <= 4 && Number.isInteger(a) && [1, 2].includes(m), `seed ${index}: a,m ${a},${m}`);
    f.ok(numbersIn(card.prompt).includes(a), `seed ${index}: "radius a" not printed`);
    f.ok(has(card.prompt, 'z ≥ 0'), `seed ${index}: half ball not stated`);
    const k = 2 * PI * m * integrate(r => r * (a * a - r * r) / 2, 0, a) / PI;
    auditIs(card, 'MIT-MV-62:challenge', { a, m }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [k], 1e-6, `seed ${index} ${lang} challenge`, f);
    f.ok(!card.figure, `seed ${index}: the challenge must have no figure`);
  }));

  it('variety and answer positions', () => {
    for (const slug of IDS_62) expect(distinctCount(62, slug, fullKey), slug).toBeGreaterThanOrEqual(6);
    for (const slug of ['coords', 'jacobian-check']) expect(answerPositions(62, slug).size, `${slug} answer positions`).toBeGreaterThanOrEqual(2);
  });
});

// ======================================================================================================
// MIT-MV-63 — curl and physics
// ======================================================================================================
const IDS_63 = ['bridge', 'gauss-setup', 'gauss-flux', 'faraday-setup', 'emf', 'same-flux', 'harmonic-coef', 'poisson', 'challenge'];
const KINDS_63 = ['MIT-MV-63:challenge', 'MIT-MV-63:emf', 'MIT-MV-63:gauss-flux', 'MIT-MV-63:harmonic-coef'];
/** Outward flux through the sphere of radius 3 of the Coulomb field Σ qᵢ (x − xᵢ)/|x − xᵢ|³, by 2D Simpson over (θ, φ), per unit charge at each position (flux is linear). */
const SPHERE_R = 3;
const CHARGE_AT: Record<'q1' | 'q2' | 'q3', P3> = { q1: [0.5, 0, 0.2], q2: [-1, 0.5, -0.3], q3: [5, 0, 0] };
const unitFlux = (() => {
  const memo: Partial<Record<'q1' | 'q2' | 'q3', number>> = {};
  return (key: 'q1' | 'q2' | 'q3') => memo[key] ??= simpson(th => simpson(ph => {
    const x = SPHERE_R * Math.sin(ph) * Math.cos(th), y = SPHERE_R * Math.sin(ph) * Math.sin(th), z = SPHERE_R * Math.cos(ph);
    const [cx, cy, cz] = CHARGE_AT[key];
    const dx = x - cx, dy = y - cy, dz = z - cz, d3 = Math.hypot(dx, dy, dz) ** 3;
    return (dx * x + dy * y + dz * z) / d3 / SPHERE_R * SPHERE_R * SPHERE_R * Math.sin(ph);
  }, 0, PI, 240), 0, 2 * PI, 240);
})();
const chargeFlux = (q1: number, q2: number, q3: number) => q1 * unitFlux('q1') + (-q2) * unitFlux('q2') + q3 * unitFlux('q3');
const chargesOf = (card: PracticeCard, lang: Lang): [number, number, number] => {
  const m = rxl(card.prompt, lang, /point charges (\d+) and -(\d+) inside it and the point charge (\d+) outside/, /点电荷 (\d+) 和 -(\d+)，S 外有点电荷 (\d+)/, 'charges');
  return [Number(m[1]), Number(m[2]), Number(m[3])];
};
/** Φ(t) = a t² + b t, printed by `coef`. */
const fluxParams = (card: PracticeCard) => { const m = rx(card.prompt, /Φ\(t\) = (\d*)t² \+ (\d*)t/, 'Φ'); return { a: cf(m[1]), b: cf(m[2]), c: Number(rx(card.prompt, /c = (\d+)/, 'c')[1]) }; };

describe('MIT-MV-63 oracle', () => {
  shapeTests(63, IDS_63, KINDS_63);

  it('bridge: divergence theorem for the Gauss statement, Stokes for Faraday and the criterion', () => everySeed((index, lang, f) => {
    const card = getCard(63, index, lang, 'bridge');
    const q = card.prompt;
    const kind = lang === 'en'
      ? (/Gauss-Coulomb|flux of E out of/.test(q) ? 'A' : /Faraday|EMF/.test(q) ? 'B' : /criterion/.test(q) ? 'C' : '?')
      : (/高斯-库仑|穿出/.test(q) ? 'A' : /法拉第|电动势/.test(q) ? 'B' : /判据/.test(q) ? 'C' : '?');
    f.ok(kind !== '?', `seed ${index} ${lang}: unknown statement ${q.slice(0, 60)}`);
    if (kind === 'A') { const v = Number(rx(q, /Q = (\d+)/, 'q')[1]); f.ok(v >= 2 && v <= 7, `seed ${index}: q ${v}`); }
    if (kind === 'B') { const v = Number(rx(q, /c = (\d+)/, 'c')[1]); f.ok(v >= 2 && v <= 7, `seed ${index}: c ${v}`); f.ok(has(q, `1/${v}`) || has(q, `−1/${v}`), `seed ${index}: −1/c not printed`); }
    const isDiv = (o: string) => lang === 'en' ? /^the divergence theorem/.test(o) : /^散度定理/.test(o);
    const isStokes = (o: string) => lang === 'en' ? /^Stokes' theorem/.test(o) : /^斯托克斯定理/.test(o);
    const verdict = card.choice!.options.map(kind === 'A' ? isDiv : isStokes);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: kind ${kind} predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4 && card.choice!.options.filter(isDiv).length === 1 && card.choice!.options.filter(isStokes).length === 1, `seed ${index}: the same four options expected`);
    const mark = kind === 'A' ? (lang === 'en' ? 'divergence theorem' : '散度定理') : kind === 'B' ? (lang === 'en' ? 'only the plane case of Stokes' : '格林定理只是斯托克斯定理在平面上的特例') : (lang === 'en' ? 'provides the bridge' : '桥梁');
    f.ok(has(card.explanation, mark), `seed ${index} ${lang}: explanation of statement ${kind} lacks "${mark}"`);
    f.ok(kind !== 'A' || !has(card.explanation, lang === 'en' ? "Stokes' theorem provides" : '斯托克斯定理是联系'), `seed ${index}: explanation of A names Stokes as the bridge`);
  }));

  it('gauss-setup: constants 4π, 4πρ and the net inside charge q1 − q2 (Coulomb-field flux quadrature)', () => everySeed((index, lang, f) => {
    const card = getCard(63, index, lang, 'gauss-setup');
    const [q1, q2, q3] = chargesOf(card, lang);
    f.ok(q1 >= 1 && q1 <= 6 && q2 >= 1 && q2 <= 6 && q3 >= 1 && q3 <= 6 && q1 !== q2, `seed ${index}: q ${q1},${q2},${q3} outside plan`);
    checkSymbols(card, ['4π', '4πρ', `${q1} − ${q2}`], `seed ${index} ${lang} gauss-setup`, f);
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(['4π', '1/(4π)', '4πρ', 'ρ/(4π)', `${q1} − ${q2}`, `${q1} − ${q2} + ${q3}`, `${q1} + ${q2}`, `${q3}`].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const flux = chargeFlux(q1, q2, q3);
    const Q = evOrNaN(card.slots!.answers[2]);
    f.ok(near(Q, q1 - q2, 1e-12), `seed ${index}: Q slot ${Q}`);
    f.ok(near(flux / Q, evOrNaN(card.slots!.answers[0]), 1e-7), `seed ${index}: flux/Q = ${flux / Q} vs constant ${evOrNaN(card.slots!.answers[0])}`);
    f.ok(card.slots!.answers[1] === `${card.slots!.answers[0]}ρ`, `seed ${index}: ∇·E constant must match the flux constant`);
    // flux = (constant) · (net inside charge), and the ∇·E constant must be the same one
    assembleCheck(card, ans => ans[1] === `${ans[0]}ρ` ? evOrNaN(ans[0]) * evOrNaN(ans[2]) : NaN, flux, `seed ${index} ${lang}`, f, 1e-7);
    f.ok(!card.figure, `seed ${index}: gauss-setup should have no figure`);
  }));

  it('gauss-flux: Coulomb-field flux through the sphere, k = 4(q1 − q2)', () => everySeed((index, lang, f) => {
    const card = getCard(63, index, lang, 'gauss-flux');
    const [q1, q2, q3] = chargesOf(card, lang);
    f.ok(q1 >= 1 && q1 <= 6 && q2 >= 1 && q2 <= 6 && q3 >= 1 && q3 <= 6 && q1 !== q2, `seed ${index}: q ${q1},${q2},${q3} outside plan`);
    f.ok(has(card.prompt, lang === 'en' ? 'oriented outward' : '外侧定向'), `seed ${index} ${lang}: outward orientation not stated`);
    const k = chargeFlux(q1, q2, q3) / PI;
    auditIs(card, 'MIT-MV-63:gauss-flux', { q1, q2, q3 }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [k], 1e-5, `seed ${index} ${lang} gauss-flux`, f);
    const fig = card.figure!;
    const inside = (p: Pt) => (p[0] / 3) ** 2 + (p[1] / 2) ** 2 < 1;
    f.ok(lineShapes(fig).some(l => l.points.length >= 24 && l.points.every((pt, i) => ptNear(pt, [3 * Math.cos(2 * PI * i / (l.points.length - 1)), 2 * Math.sin(2 * PI * i / (l.points.length - 1))], 1e-9))), `seed ${index}: closed ellipse(0,0,3,2) missing`);
    const pts = pointShapes(fig);
    const [a, b, c] = pts;
    f.ok(pts.length === 3 && a.label === `+${q1}` && b.label === `−${q2}` && c.label === `+${q3}`, `seed ${index}: charge points ${pts.map(p => p.label)} vs +${q1} / −${q2} / +${q3}`);
    if (a && b && c) {
      f.ok(inside(a.at) && inside(b.at) && !inside(c.at), `seed ${index}: inside/outside placement wrong`);
      f.ok(ptNear(a.at, [-1, 0.4]) && ptNear(b.at, [1, -0.4]) && ptNear(c.at, [4.8, 0]), `seed ${index}: charge positions`);
    }
    const nums = numbersIn(fig.alt);
    f.ok([q1, q2, q3].every(v => nums.includes(v)), `seed ${index} ${lang}: alt lacks the charges`);
  }));

  it('faraday-setup: the second blank is dΦ/dt of Φ = a t² + b t (finite differences)', () => everySeed((index, lang, f) => {
    const card = getCard(63, index, lang, 'faraday-setup');
    const { a, b, c } = fluxParams(card);
    f.ok(a >= 1 && a <= 4 && b >= 1 && b <= 5 && c >= 2 && c <= 7, `seed ${index}: a,b,c ${a},${b},${c}`);
    f.ok(has(card.prompt, loop(lang, 'ccw')) && has(card.prompt, lang === 'en' ? 'pointing up' : '向上'), `seed ${index} ${lang}: orientation/normal not stated`);
    const co = (k: number, v: string) => k === 1 ? v : `${k}${v}`;
    checkSymbols(card, ['d/dt', `${co(2 * a, 't')} + ${b}`], `seed ${index} ${lang} faraday-setup`, f);
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(['d/dt', '∫ dt', 'Φ(t)/t', `${co(2 * a, 't')} + ${b}`, `${co(a, 't')} + ${b}`, co(2 * a, 't'), `${co(a, 't²')} + ${co(b, 't')}`].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    f.ok(has(card.slots!.before, `1/${c}`), `seed ${index}: before "${card.slots!.before}" lacks 1/${c}`);
    const Phi = (t: number) => a * t * t + b * t;
    const dPhi = (t: number) => (Phi(t + 1e-4) - Phi(t - 1e-4)) / 2e-4;
    for (const t of [0.7, 1.9, 3.3]) f.ok(near(evOrNaN(card.slots!.answers[1], { t }), dPhi(t), 1e-6), `seed ${index}: slot 1 at t=${t}: ${evOrNaN(card.slots!.answers[1], { t })} vs dΦ/dt ${dPhi(t)}`);
    for (const token of card.slots!.tokens) if (token !== card.slots!.answers[1]) {
      const wrong = [0.7, 1.9, 3.3].every(t => near(evOrNaN(token, { t }), dPhi(t), 1e-6));
      f.ok(!wrong, `seed ${index}: token ${token} is also dΦ/dt`);
    }
    const fig = card.figure!;
    const circ = (t: number): P3 => [2 * Math.cos(t), 2 * Math.sin(t), 0];
    f.ok(lineShapes(fig).some(l => l.points.length === 49 && l.tone === 'accent' && hasCurve({ ...fig, shapes: [l] }, circ, 0, 2 * PI)), `seed ${index}: radius-2 circle at z = 0 missing`);
    f.ok(hasArrow(fig, proj(...circ(PI / 4)), proj(...circ(PI / 4 + 0.4))), `seed ${index}: ccw arrow missing`);
    f.ok(hasArrow(fig, proj(0, 0, 0), proj(0, 0, 2), 1e-9, 'n'), `seed ${index}: n arrow (0,0,0)→(0,0,2) missing`);
    f.ok(axesProblems(fig, 3).length === 0, `seed ${index}: axes3d(3) ${axesProblems(fig, 3)}`);
    f.ok(!arrowShapes(fig).some(s => s.label === 'n' && s.to[1] < s.from[1]), `seed ${index}: n arrow points down`);
  }));

  it('emf: central difference of Φ, EMF = −Φ′(t0)/c', () => everySeed((index, lang, f) => {
    const card = getCard(63, index, lang, 'emf');
    const { a, b, c } = fluxParams(card);
    const t0 = Number(rxl(card.prompt, lang, /at t = (\d+)\./, /求 t = (\d+) 时/, 't0')[1]);
    f.ok(a >= 1 && a <= 4 && b >= 1 && b <= 5 && c >= 2 && c <= 7 && t0 >= 1 && t0 <= 3, `seed ${index}: a,b,c,t0 ${a},${b},${c},${t0}`);
    f.ok(has(card.prompt, loop(lang, 'ccw')), `seed ${index} ${lang}: orientation missing`);
    const h = 1e-4;
    const emf = -((a * (t0 + h) ** 2 + b * (t0 + h)) - (a * (t0 - h) ** 2 + b * (t0 - h))) / (2 * h * c);
    auditIs(card, 'MIT-MV-63:emf', { a, b, c, t0 }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [emf], 1e-6, `seed ${index} ${lang} emf`, f);
    const fig = card.figure!;
    const circ = (t: number): P3 => [2 * Math.cos(t), 2 * Math.sin(t), 0];
    f.ok(lineShapes(fig).some(l => l.points.length === 49 && hasCurve({ ...fig, shapes: [l] }, circ, 0, 2 * PI)) && hasArrow(fig, proj(0, 0, 0), proj(0, 0, 2), 1e-9, 'n'), `seed ${index}: figure of faraday-setup expected`);
  }));

  it('same-flux: B = (x, y, −2z + m/π) is divergence-free; its flux through the disc and the hemisphere are both m', () => everySeed((index, lang, f) => {
    const card = getCard(63, index, lang, 'same-flux');
    const m = Number(rxl(card.prompt, lang, /through S₁ is (-?\d+)\./, /穿过 S₁ 的通量为 (-?\d+)。/, 'm')[1]);
    f.ok(Math.abs(m) >= 2 && Math.abs(m) <= 7, `seed ${index}: m ${m}`);
    f.ok(has(card.prompt, loop(lang, 'ccw')) && has(card.prompt, lang === 'en' ? 'upward' : '向上'), `seed ${index} ${lang}: orientation missing`);
    const B = (x: number, y: number, z: number): P3 => [x, y, -2 * z + m / PI];
    f.ok(Math.abs(fd((x, y, z) => B(x, y, z)[0], [0.3, 0.4, 0.5], 0) + fd((x, y, z) => B(x, y, z)[1], [0.3, 0.4, 0.5], 1) + fd((x, y, z) => B(x, y, z)[2], [0.3, 0.4, 0.5], 2)) < 1e-6, 'B not divergence free');
    const discFlux = simpson(th => simpson(r => B(r * Math.cos(th), r * Math.sin(th), 0)[2] * r, 0, 1, 40), 0, 2 * PI, 40);
    const capFlux = simpson(th => simpson(ph => { const x = Math.sin(ph) * Math.cos(th), y = Math.sin(ph) * Math.sin(th), z = Math.cos(ph); const b = B(x, y, z); return (b[0] * x + b[1] * y + b[2] * z) * Math.sin(ph); }, 0, PI / 2, 200), 0, 2 * PI, 200);
    f.ok(near(discFlux, m, 1e-9) && near(capFlux, m, 1e-8), `seed ${index}: disc ${discFlux}, cap ${capFlux}, m ${m}`);
    const claim = (o: string): number => {
      const c = clean(o);
      if (lang === 'en' ? /^The same flux, (-?\d+)$/.test(c) : /^相同的通量，(-?\d+)$/.test(c)) return Number(c.match(/(-?\d+)$/)![1]);
      if (lang === 'en' ? /^The opposite flux, (-?\d+)$/.test(c) : /^相反的通量，(-?\d+)$/.test(c)) return Number(c.match(/(-?\d+)$/)![1]);
      if (/^Zero|^零/.test(c)) return 0;
      return NaN;
    };
    const verdict = card.choice!.options.map(o => near(claim(o), capFlux, 1e-8));
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}, options ${card.choice!.options}`);
    f.ok(card.choice!.options.some(o => claim(o) === -m && /opposite|相反/.test(o)), `seed ${index}: the opposite-flux distractor must print ${-m}`);
    const fig = card.figure!;
    f.ok(axesProblems(fig, 2).length === 0, `seed ${index}: axes3d(2)`);
    f.ok(hasCurve(fig, t => [Math.cos(t), Math.sin(t), 0], 0, 2 * PI), `seed ${index}: unit circle missing`);
    f.ok(wireProblems(fig, (u, v) => [Math.sin(u) * Math.cos(v), Math.sin(u) * Math.sin(v), Math.cos(u)], 0, PI / 2, 0, 2 * PI, 3, 8).length === 0, `seed ${index}: hemisphere wire ${wireProblems(fig, (u, v) => [Math.sin(u) * Math.cos(v), Math.sin(u) * Math.sin(v), Math.cos(u)], 0, PI / 2, 0, 2 * PI, 3, 8)}`);
    f.ok(hasArrow(fig, proj(0, 0, 0), proj(0, 0, 1.6), 1e-9, 'n'), `seed ${index}: n arrow missing`);
    let spokes = 0;
    for (let k = 0; k < 6; k++) { const t = 2 * PI * k / 6; if (lineShapes(fig).some(l => l.tone === 'muted' && l.points.length === 2 && ptNear(l.points[0], proj(0, 0, 0)) && ptNear(l.points[1], proj(Math.cos(t), Math.sin(t), 0), 1e-9))) spokes++; }
    f.ok(spokes === 6, `seed ${index}: ${spokes} of 6 disc spokes found`);
  }));

  it('harmonic-coef: w from the finite-difference Laplacian', () => everySeed((index, lang, f) => {
    const card = getCard(63, index, lang, 'harmonic-coef');
    const m = rx(card.prompt, /f\(x, y, z\) = (\d*)x² \+ (\d*)y² \+ w z² \+ (\d*)xy/, 'f');
    const a = cf(m[1]), b = cf(m[2]), d = cf(m[3]);
    f.ok([a, b, d].every(v => v >= 1 && v <= 5), `seed ${index}: a,b,d ${a},${b},${d}`);
    const lap = (w: number) => {
      const g = (x: number, y: number, z: number) => a * x * x + b * y * y + w * z * z + d * x * y;
      const p: P3 = [0.3, -0.7, 0.5];
      return [0, 1, 2].reduce((sum, ax) => { const lo = [...p] as P3, hi = [...p] as P3; lo[ax] -= 1e-3; hi[ax] += 1e-3; return sum + (g(...hi) - 2 * g(...p) + g(...lo)) / 1e-6; }, 0);
    };
    const w = -lap(0) / (lap(1) - lap(0));
    f.ok(near(w, -(a + b), 1e-5), `seed ${index}: solved w ${w}`);
    auditIs(card, 'MIT-MV-63:harmonic-coef', { a, b, d }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [w], 1e-5, `seed ${index} ${lang} harmonic-coef`, f);
  }));

  it('poisson: the correct option claims ∇²f = +4πr, the value of the Laplacian of a potential with ∇·E = 4πρ', () => everySeed((index, lang, f) => {
    const card = getCard(63, index, lang, 'poisson');
    const r = Number(rx(card.prompt, /ρ = (\d+)/, 'r')[1]);
    f.ok(r >= 1 && r <= 6, `seed ${index}: r ${r}`);
    // potential with E = ∇f and ∇·E = 4πρ for the constant density ρ = r: f = (2π r / 3) |x|²
    const pot = (x: number, y: number, z: number) => (2 * PI * r / 3) * (x * x + y * y + z * z);
    const p: P3 = [0.4, -0.3, 0.8];
    const lapF = [0, 1, 2].reduce((s, ax) => { const lo = [...p] as P3, hi = [...p] as P3; lo[ax] -= 1e-3; hi[ax] += 1e-3; return s + (pot(...hi) - 2 * pot(...p) + pot(...lo)) / 1e-6; }, 0);
    f.ok(near(lapF, 4 * PI * r, 1e-6), `seed ${index}: oracle Laplacian ${lapF}`);
    const claimed = (o: string): number => {
      const c = clean(o);
      if (/is harmonic|是调和函数，因为/.test(c) && !/not harmonic|不是调和函数/.test(c)) return 0;
      const m = c.match(/∇²f = (?:∇ \* E = )?(-)?4π(?:\*(\d+))?/);
      if (!m) return NaN;
      return (m[1] ? -1 : 1) * 4 * PI * (m[2] ? Number(m[2]) : 1);
    };
    const verdict = card.choice!.options.map(o => near(claimed(o), lapF, 1e-9));
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4 && card.choice!.options.every(o => !Number.isNaN(claimed(o))), `seed ${index}: unparsed option ${card.choice!.options}`);
    f.ok(has(card.prompt, lang === 'en' ? 'simply connected' : '单连通'), `seed ${index}: prompt lacks the simply connected assumption`);
  }));

  it('challenge: six face integrals of E·n over the cube, k = flux/4', () => everySeed((index, lang, f) => {
    const card = getCard(63, index, lang, 'challenge');
    const m = rx(card.prompt, /E = \((\d*)x, (\d*)y, (\d*)z\)/, 'E');
    const a = cf(m[1]), b = cf(m[2]), c = cf(m[3]);
    const s = Number(rx(card.prompt, /0 ≤ x, y, z ≤ (\d+)/, 's')[1]);
    f.ok([a, b, c].every(v => v >= 1 && v <= 3) && !(a === b && b === c) && s >= 2 && s <= 4, `seed ${index}: a,b,c,s ${a},${b},${c},${s}`);
    f.ok(has(card.prompt, lang === 'en' ? 'outward' : '外侧'), `seed ${index} ${lang}: outward orientation not stated`);
    const E = (x: number, y: number, z: number): P3 => [a * x, b * y, c * z];
    const face = (axis: 0 | 1 | 2, at: number, sign: 1 | -1) => simpson(u => simpson(v => { const p: P3 = [0, 0, 0]; const others = [0, 1, 2].filter(i => i !== axis); p[axis] = at; p[others[0]] = u; p[others[1]] = v; return sign * E(...p)[axis]; }, 0, s, 200), 0, s, 200);
    const flux = [0, 1, 2].reduce((sum, ax) => sum + face(ax as 0 | 1 | 2, s, 1) + face(ax as 0 | 1 | 2, 0, -1), 0);
    const k = flux / 4;
    f.ok(near(flux, (a + b + c) * s ** 3, 1e-9), `seed ${index}: face sum ${flux}`);
    auditIs(card, 'MIT-MV-63:challenge', { a, b, c, s }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [k], 1e-6, `seed ${index} ${lang} challenge`, f);
    f.ok(!card.figure, `seed ${index}: the challenge must have no figure`);
  }));

  it('variety and answer positions', () => {
    for (const slug of IDS_63) expect(distinctCount(63, slug, fullKey), slug).toBeGreaterThanOrEqual(6);
    for (const slug of ['bridge', 'same-flux', 'poisson']) expect(answerPositions(63, slug).size, `${slug} answer positions`).toBeGreaterThanOrEqual(2);
  });
});

// ======================================================================================================
// MIT-MV-64 — exam 4
// ======================================================================================================
const IDS_64 = ['conservative-pair', 'potential', 'sphere-eq', 'plane-eq', 'cap-setup', 'flux-setup', 'paraboloid-flux', 'curl-sphere', 'cyl-setup', 'challenge'];
const KINDS_64 = ['MIT-MV-64:challenge', 'MIT-MV-64:paraboloid-flux', 'MIT-MV-64:potential'];
/** Components of a vector field printed as `(A, B, C)`, evaluated through `ev`. */
function fieldFromText(inner: string): V3 {
  const parts = clean(inner).split(', ');
  if (parts.length !== 3) throw new Error(`not a triple: ${inner}`);
  return (x, y, z) => parts.map(p => ev(p, { x, y, z })) as [number, number, number];
}
const co1 = (k: number, v: string) => k === 1 ? v : `${k}${v}`;
/** Flux of F = (x, y, c) upward through z = h − x² − y² over the disc r² ≤ h, by direct parametrisation (rectangular coordinates). */
const paraboloidFlux = (h: number, c: number) => disc((x, y) => (x * 2 * x + y * 2 * y + c), Math.sqrt(h));

describe('MIT-MV-64 oracle', () => {
  shapeTests(64, IDS_64, KINDS_64);

  it('conservative-pair: finite differences decide which of the three equalities fails', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'conservative-pair');
    const all = [...clean(card.prompt).matchAll(/F = \(([^()]*)\)/g)];
    const F = fieldFromText(all[all.length - 1][1]);
    const p: P3 = [0.7, -0.4, 1.3];
    const M = (x: number, y: number, z: number) => F(x, y, z)[0], N = (x: number, y: number, z: number) => F(x, y, z)[1], P = (x: number, y: number, z: number) => F(x, y, z)[2];
    const diffs = [fd(M, p, 1) - fd(N, p, 0), fd(M, p, 2) - fd(P, p, 0), fd(N, p, 2) - fd(P, p, 1)];
    const failing = diffs.map(d => Math.abs(d) > 1e-6);
    f.ok(failing.filter(Boolean).length === 1, `seed ${index}: ${failing.filter(Boolean).length} equalities fail (${diffs}) for ${all[all.length - 1][1]}`);
    const verdict = card.choice!.options.map(o => {
      const c = clean(o);
      const i = ['∂M/∂y = ∂N/∂x', '∂M/∂z = ∂P/∂x', '∂N/∂z = ∂P/∂y'].indexOf(c);
      if (i >= 0) return failing[i];
      return /None of them fails|三条都不失效/.test(c) ? !failing.some(Boolean) : false;
    });
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: options ${card.choice!.options.length}`);
    // a ∈ {2,3,4}, b ∈ {1,2,3}: the largest coefficient in the field is within the plan
    const nums = numbersIn(all[all.length - 1][1]);
    f.ok(nums.every(v => v >= 1 && v <= 4), `seed ${index}: coefficients ${nums}`);
  }));

  it('potential: the line integral along (t, 2t, t) of the printed gradient field equals f(1,2,1)', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'potential');
    const m = rxl(card.prompt, lang, /F = \((.*)\) is a gradient field/, /F = \((.*)\) 是梯度场/, 'F');
    const F = fieldFromText(m[1]);
    const d = -F(0, 0, 0)[2], a = F(1, 0, 0)[1], b = F(0, 1, 0)[2] + d, c = F(0, 0, 1)[0];
    f.ok(near(F(1, 1, 0)[0], 2 * a, 1e-12) && near(F(0, 1, 1)[1], 2 * b, 1e-12), `seed ${index}: coefficients inconsistent`);
    f.ok([a, b, c, d].every(v => Number.isInteger(v) && v >= 1 && v <= 3), `seed ${index}: a,b,c,d ${a},${b},${c},${d} outside plan`);
    // the field must really be a gradient field
    const q: P3 = [0.6, 0.9, -0.4];
    const cu = curl(F, q);
    f.ok(cu.every(v => Math.abs(v) < 1e-5), `seed ${index}: printed field has curl ${cu}`);
    const value = simpson(t => { const [M, N, P] = F(t, 2 * t, t); return M * 1 + N * 2 + P * 1; }, 0, 1, 40);
    auditIs(card, 'MIT-MV-64:potential', { a, b, c, d }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [value], 1e-6, `seed ${index} ${lang} potential`, f);
    f.ok(has(card.prompt, 'f(0, 0, 0) = 0'), `seed ${index}: f(0,0,0) = 0 not stated`);
    f.ok(card.fields![0].label.replaceAll(' ', '') === 'f(1,2,1)', `seed ${index}: label ${card.fields![0].label}`);
  }));

  it('sphere-eq: ρ = 2a cos φ describes the sphere of radius a tangent to the xy-plane at the origin', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'sphere-eq');
    const a = radiusOf(card, lang);
    f.ok(a >= 1 && a <= 7, `seed ${index}: a ${a}`);
    checkSymbols(card, [`${2 * a} cos φ`], `seed ${index} ${lang} sphere-eq`, f);
    const plain = (k: number, w: string) => k === 1 ? w : `${k} ${w}`;
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify([`${2 * a} cos φ`, plain(a, 'cos φ'), `${2 * a} sin φ`, `${a}`, `${2 * a} sec φ`].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    // points ρ(φ)(sin φ cos θ, sin φ sin θ, cos φ) must satisfy x² + y² + (z − a)² = a² for all φ ∈ [0, π/2], and no other token does
    const residual = (token: string) => Math.max(...[0.2, 0.7, 1.1, 1.5].map(ph => { const rho = evOrNaN(token, { φ: ph }); const x = rho * Math.sin(ph), z = rho * Math.cos(ph); return Math.abs(x * x + (z - a) ** 2 - a * a); }));
    f.ok(residual(card.slots!.answers[0]) < 1e-9, `seed ${index}: answer residual ${residual(card.slots!.answers[0])}`);
    for (const token of card.slots!.tokens) if (token !== card.slots!.answers[0]) { const r = residual(token); f.ok(!(r < 1e-9), `seed ${index}: token ${token} also describes the sphere`); }
    f.ok(has(card.prompt, lang === 'en' ? PHI_EN : PHI_ZH), `seed ${index} ${lang}: prompt lacks the φ rule`);
    const fig = card.figure!;
    f.ok(axesProblems(fig, 2 * a + 1).length === 0, `seed ${index}: axes3d(2a+1)`);
    f.ok(wireProblems(fig, (u, v) => [a * Math.sin(u) * Math.cos(v), a * Math.sin(u) * Math.sin(v), a + a * Math.cos(u)], 0, PI, 0, 2 * PI, 6, 8).length === 0, `seed ${index}: sphere wire`);
    f.ok(!/\d/.test(fig.alt) && !fig.shapes.some(s => s.kind === 'text'), `seed ${index} ${lang}: figure/alt shows a number`);
  }));

  it('plan-eq: only ρ = h sec φ describes z = h', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'plane-eq');
    const h = Number(rx(card.prompt, /z = (\d+)/, 'h')[1]);
    f.ok(h >= 1 && h <= 6, `seed ${index}: h ${h}`);
    const describes = (o: string) => { const m = clean(o).match(/^ρ = (.+)$/); if (!m) return false; return [0.2, 0.6, 1.0, 1.3].every(ph => { const rho = evOrNaN(m[1], { φ: ph }); return near(rho * Math.cos(ph), h, 1e-9); }); };
    const verdict = card.choice!.options.map(describes);
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}, options ${card.choice!.options}`);
    f.ok(card.choice!.options.length === 4, `seed ${index}: options ${card.choice!.options.length}`);
    f.ok(has(card.prompt, lang === 'en' ? PHI_EN : PHI_ZH), `seed ${index} ${lang}: prompt lacks the φ rule`);
  }));

  it('cap-setup: the assembled bounds integrate to the hemisphere volume 2πa³/3', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'cap-setup');
    const a = radiusOf(card, lang);
    f.ok(a >= 1 && a <= 6 && has(card.prompt, `${2 * a} cos φ`), `seed ${index}: a ${a}`);
    const plain = (k: number, w: string) => k === 1 ? w : `${k} ${w}`;
    checkSymbols(card, [plain(a, 'sec φ'), `${2 * a} cos φ`], `seed ${index} ${lang} cap-setup`, f);
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify([plain(a, 'sec φ'), `${2 * a} cos φ`, plain(a, 'cos φ'), `${2 * a} sin φ`, plain(a, 'tan φ'), `${2 * a}`].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    // volume of the part of the ball x² + y² + (z − a)² ≤ a² above z = a, by cross-sections
    const truth = integrate(z => PI * (a * a - (z - a) ** 2), a, 2 * a);
    f.ok(near(truth, 2 * PI * a ** 3 / 3, 1e-9), 'cross-section volume');
    const value = (ans: string[]) => 2 * PI * simpson(ph => { const lo = evOrNaN(ans[0], { φ: ph }), hi = evOrNaN(ans[1], { φ: ph }); return Math.sin(ph) * (hi ** 3 - lo ** 3) / 3; }, 0, PI / 4, 400);
    assembleCheck(card, value, truth, `seed ${index} ${lang}`, f, 1e-7);
    f.ok(has(card.prompt, lang === 'en' ? PHI_EN : PHI_ZH), `seed ${index} ${lang}: prompt lacks the φ rule`);
    const fig = card.figure!;
    f.ok(wireProblems(fig, (u, v) => [a * Math.sin(u) * Math.cos(v), a * Math.sin(u) * Math.sin(v), a + a * Math.cos(u)], 0, PI, 0, 2 * PI, 6, 8).length === 0, `seed ${index}: sphere wire`);
    const sq: P3[] = [[-a, -a, a], [a, -a, a], [a, a, a], [-a, a, a], [-a, -a, a]];
    f.ok(lineShapes(fig).some(l => l.tone === 'warn' && l.points.length === 5 && sq.every((pt, i) => ptNear(l.points[i], proj(...pt)))), `seed ${index}: warn square at z = ${a} missing`);
    f.ok(axesProblems(fig, 2 * a + 1).length === 0, `seed ${index}: axes`);
    f.ok(!/\d/.test(fig.alt), `seed ${index} ${lang}: alt shows a number`);
  }));

  it('flux-setup: the assembled bound and integrand give the flux of (x, y, c) through the paraboloid', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'flux-setup');
    const h = Number(rx(card.prompt, /z = (\d+) - x² - y²/, 'h')[1]);
    const c = Number(rx(card.prompt, /F = \(x, y, (\d+)\)/, 'c')[1]);
    const s = Math.sqrt(h);
    f.ok([4, 9, 16].includes(h) && c >= 1 && c <= 4, `seed ${index}: h,c ${h},${c}`);
    f.ok(has(card.prompt, lang === 'en' ? 'upward' : '向上'), `seed ${index} ${lang}: direction not stated`);
    checkSymbols(card, [`${s}`, `2r² + ${c}`], `seed ${index} ${lang} flux-setup`, f);
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify([`${s}`, `${h}`, '1', `2r² + ${c}`, `r² + ${c}`, `−2r² − ${c}`, '2r²'].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const truth = paraboloidFlux(h, c);
    const value = (ans: string[]) => { const B = evOrNaN(ans[0]); return 2 * PI * simpson(r => evOrNaN(ans[1], { r }) * r, 0, B, 16); };
    assembleCheck(card, value, truth, `seed ${index} ${lang}`, f, 1e-7);
    const fig = card.figure!;
    f.ok(axesProblems(fig, Math.max(s, h) + 1).length === 0, `seed ${index}: axes3d(max(s,h)+1) = ${Math.max(s, h) + 1}`);
    f.ok(wireProblems(fig, (u, v) => [u * Math.cos(v), u * Math.sin(v), h - u * u], 0, s, 0, 2 * PI, 4, 12).length === 0, `seed ${index}: paraboloid wire`);
    f.ok(hasArrow(fig, proj(0, 0, h), proj(0, 0, h + 1.5), 1e-9, 'n'), `seed ${index}: upward n arrow at the vertex missing`);
    f.ok(!/\d/.test(fig.alt) && !fig.shapes.some(s2 => s2.kind === 'text'), `seed ${index} ${lang}: figure shows a number`);
  }));

  it('paraboloid-flux: direct parametrisation and divergence-theorem routes agree, k = h² + c h', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'paraboloid-flux');
    const h = Number(rx(card.prompt, /z = (\d+) - x² - y²/, 'h')[1]);
    const c = Number(rx(card.prompt, /F = \(x, y, (\d+)\)/, 'c')[1]);
    f.ok([1, 4, 9, 16].includes(h) && c >= 1 && c <= 4, `seed ${index}: h,c ${h},${c}`);
    f.ok(has(card.prompt, lang === 'en' ? 'upward' : '向上'), `seed ${index} ${lang}: direction not stated`);
    const direct = paraboloidFlux(h, c) / PI;
    const volume = 2 * PI * integrate(r => (h - r * r) * r, 0, Math.sqrt(h));
    const viaDiv = (2 * volume + c * PI * h) / PI;
    f.ok(near(direct, viaDiv, 1e-7), `seed ${index}: routes disagree ${direct} vs ${viaDiv}`);
    auditIs(card, 'MIT-MV-64:paraboloid-flux', { h, c }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [direct], 1e-6, `seed ${index} ${lang} paraboloid-flux`, f);
    const s = Math.sqrt(h);
    const fig = card.figure!;
    f.ok(wireProblems(fig, (u, v) => [u * Math.cos(v), u * Math.sin(v), h - u * u], 0, s, 0, 2 * PI, 4, 12).length === 0 && axesProblems(fig, Math.max(s, h) + 1).length === 0 && hasArrow(fig, proj(0, 0, h), proj(0, 0, h + 1.5), 1e-9, 'n'), `seed ${index}: figure of flux-setup expected`);
  }));

  it('curl-sphere: only a = −2b gives zero flux of curl F over every piece of the unit sphere', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'curl-sphere');
    const b = cf(rx(card.prompt, /F = \(a x z, 0, (\d*)y²[)）]/, 'b')[1]);
    f.ok(b >= 1 && b <= 6, `seed ${index}: b ${b}`);
    const flux = (a: number, th0: number, th1: number, ph0: number, ph1: number) => simpson(th => simpson(ph => {
      const x = Math.sin(ph) * Math.cos(th), y = Math.sin(ph) * Math.sin(th), z = Math.cos(ph);
      const cu = curl((X, Y, Z) => [a * X * Z, 0, b * Y * Y], [x, y, z]);
      return (cu[0] * x + cu[1] * y + cu[2] * z) * Math.sin(ph);
    }, ph0, ph1, 120), th0, th1, 120);
    const zeroEverywhere = (a: number) => Math.abs(flux(a, 0, PI / 2, 0, PI / 2)) < 1e-6 && Math.abs(flux(a, 0.3, 0.9, 0.8, 1.4)) < 1e-6 && Math.abs(flux(a, -1.2, -0.4, 1.0, 2.0)) < 1e-6;
    const verdict = card.choice!.options.map(o => { const m = clean(o).match(/^a = (-?\d+)$/); return m ? zeroEverywhere(Number(m[1])) : false; });
    f.ok(verdict.filter(Boolean).length === 1 && verdict[card.choice!.answer], `seed ${index} ${lang}: predicate ${verdict}, answer ${card.choice!.answer}, options ${card.choice!.options}`);
    f.ok(JSON.stringify(card.choice!.options.map(o => clean(o)).sort()) === JSON.stringify([`a = ${-2 * b}`, `a = ${2 * b}`, `a = ${-b}`, `a = ${b}`].sort()), `seed ${index} ${lang}: options ${card.choice!.options}`);
  }));

  it('cyl-setup: the assembled quarter-cylinder moment of inertia equals the rectangular quadrature', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'cyl-setup');
    const m = rxl(card.prompt, lang, /x² \+ y² ≤ (\d+) \(radius (\d+)\)/, /x² \+ y² ≤ (\d+)（半径 (\d+)）/, 'R2,R');
    const R2 = Number(m[1]), R = Number(m[2]);
    const h = Number(rx(card.prompt, /below the plane z = (\d+)|平面 z = (\d+) 下方/, 'h').slice(1).find(Boolean));
    const allowed = [[2, 3], [2, 5], [2, 6], [3, 2], [3, 4], [3, 5], [3, 6], [4, 2], [4, 3], [4, 5], [4, 6]];
    f.ok(R2 === R * R && allowed.some(([r, hh]) => r === R && hh === h), `seed ${index}: (R,h) = (${R},${h}) outside the plan's 11 pairs`);
    checkSymbols(card, ['π/2', `${R}`, `${h}`, 'r³'], `seed ${index} ${lang} cyl-setup`, f);
    f.ok(JSON.stringify(card.slots!.tokens.slice().sort()) === JSON.stringify(['π/2', 'π', '2π', `${R}`, `${R2}`, `${h}`, 'r³', 'r²', 'r', '(r² + z²) r'].sort()), `seed ${index} ${lang}: tokens ${JSON.stringify(card.slots!.tokens)}`);
    const truth = h * discPiece((x, y) => x * x + y * y, R, 0, PI / 2, 0);
    f.ok(near(truth, PI * R ** 4 * h / 8, 1e-8), `seed ${index}: quadrature ${truth}`);
    const value = (ans: string[]) => { const T = evOrNaN(ans[0]), B = evOrNaN(ans[1]), H = evOrNaN(ans[2]); return T * simpson(r => simpson(z => evOrNaN(ans[3], { r, z }), 0, H, 8), 0, B, 8); };
    assembleCheck(card, value, truth, `seed ${index} ${lang}`, f, 1e-8, { slot: 3, envs: [{ r: 0.7, z: 1.1 }, { r: 1.9, z: 0.4 }, { r: 3.1, z: 2.3 }] });
    f.ok(has(card.prompt, 'first octant') || has(card.prompt, '第一卦限'), `seed ${index}: first octant not stated`);
    const fig = card.figure!;
    f.ok(axesProblems(fig, Math.max(R, h) + 1).length === 0, `seed ${index}: axes`);
    f.ok(wireProblems(fig, (u, v) => [R * Math.cos(u), R * Math.sin(u), v], 0, PI / 2, 0, h, 6, 4).length === 0, `seed ${index}: quarter cylinder wire`);
    f.ok(!/\d/.test(fig.alt) && !fig.shapes.some(s => s.kind === 'text'), `seed ${index} ${lang}: figure shows a number`);
  }));

  it('challenge: half cylinder, I = (R⁴ h/4)π by rectangular quadrature', () => everySeed((index, lang, f) => {
    const card = getCard(64, index, lang, 'challenge');
    const m = rxl(card.prompt, lang, /x² \+ y² ≤ (\d+) \(radius (\d+)\) with x ≥ 0 and 0 ≤ z ≤ (\d+)/, /x² \+ y² ≤ (\d+)（半径 (\d+)）中满足 x ≥ 0 且 0 ≤ z ≤ (\d+)/, 'R,h');
    const R2 = Number(m[1]), R = Number(m[2]), h = Number(m[3]);
    f.ok(R2 === R * R && (R === 1 || R === 2) && h >= 1 && h <= 6 && !(R === 1 && h === 1), `seed ${index}: R,h ${R},${h} outside plan`);
    const k = h * discPiece((x, y) => x * x + y * y, R, 0, PI / 2, -1) / PI;
    auditIs(card, 'MIT-MV-64:challenge', { R, h }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [k], 1e-6, `seed ${index} ${lang} challenge`, f);
    f.ok(!card.figure, `seed ${index}: the challenge must have no figure`);
  }));

  it('variety and answer positions', () => {
    for (const slug of IDS_64) expect(distinctCount(64, slug, fullKey), slug).toBeGreaterThanOrEqual(6);
    for (const slug of ['conservative-pair', 'plane-eq', 'curl-sphere']) expect(answerPositions(64, slug).size, `${slug} answer positions`).toBeGreaterThanOrEqual(2);
  });
});
