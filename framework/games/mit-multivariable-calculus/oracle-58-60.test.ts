import { appendFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { mv58 } from './games/mv58';
import { mv59 } from './games/mv59';
import { mv60 } from './games/mv60';
import { spreadSeed } from './deck-invariants';
import { simpson } from './oracle-harness';
import { gradeCard, type CardGenerator, type GameLanguage, type PracticeCard } from '../types';
import { figureProblems, project3d, type Figure, type FigureShape, type Pt } from '../figure';

/**
 * Acceptance oracle for MIT-MV-58, 59, 60. The numeric answers are recomputed from the plan's definitions by quadrature and
 * finite differences, never from a generator closed form. Written against docs/mit-mv-drafts/approved-58-60.md.
 */
vi.setConfig({ testTimeout: 180000 });
const SEEDS = 60;
const PI = Math.PI;
type Lang = GameLanguage;
const LANGS: Lang[] = ['en', 'zh'];
const generators: Record<number, CardGenerator> = { 58: mv58, 59: mv59, 60: mv60 };

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
const clean = (text: string) => text.replaceAll('−', '-').replaceAll('·', '*').replaceAll(' ', ' ');
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

// expression evaluator for slot tokens such as `−6t`, `16t`, `x z`
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
function exactString(v: number): string {
  for (let q = 1; q <= 24; q++) { const p = Math.round(v * q); if (Math.abs(v - p / q) < 1e-7) return q === 1 ? `${p}` : `${p}/${q}`; }
  for (let q = 1; q <= 24; q++) { const p = Math.round(v * q / PI); if (Math.abs(v - p * PI / q) < 1e-9) return `${p}pi${q === 1 ? '' : `/${q}`}`; }
  throw new Error(`no exact form for ${v}`);
}
const rx = (text: string, pattern: RegExp, label: string): RegExpMatchArray => { const m = clean(text).match(pattern); if (!m) throw new Error(`cannot parse ${label} in "${text}"`); return m; };
/** Coefficient of a one-term monomial printed by `coef`: `−6t` with variable `t` gives −6, a bare variable gives 1. */
const coefOf = (term: string, variable: string): number => { const s = clean(term).replace(variable, '').trim(); return s === '' ? 1 : s === '-' ? -1 : Number(s); };
/** Last `(a, b, c)` integer triple in the prompt (the endpoint, whatever the language). */
const lastTuple = (prompt: string): [number, number, number] => {
  const all = [...clean(prompt).matchAll(/\((\d+), (\d+), (\d+)\)/g)].map(m => [Number(m[1]), Number(m[2]), Number(m[3])] as [number, number, number]);
  if (!all.length) throw new Error(`no integer triple in "${prompt}"`);
  return all[all.length - 1];
};
const dirWord = (lang: Lang, word: 'clockwise' | 'counterclockwise') => lang === 'en' ? word : word === 'clockwise' ? '顺时针' : '逆时针';

// ---------- generic card checks ----------
const CJK = /[㐀-鿿]/;
// English function words are forbidden in ZH strings; technical Latin symbols (curl, Stokes, F, ...) are allowed.
const EN_WORD = /\b(and|or|the|with|for|is|are|if|then|where|of|to|because)\b/;
function textsOf(card: PracticeCard): string[] {
  return [card.title, card.prompt, card.hint, card.explanation, ...(card.lines ?? []), ...(card.fields?.map(x => x.label) ?? []),
    ...(card.choice?.options ?? []), ...(card.slots ? [card.slots.before, ...(card.slots.between ?? []), card.slots.after ?? '', ...card.slots.tokens] : []),
    ...(card.figure ? [card.figure.alt, card.figure.caption ?? '', ...card.figure.shapes.map(s => s.kind === 'text' ? s.text : 'label' in s ? s.label ?? '' : '')] : [])];
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
  f.ok(JSON.stringify(en.slots?.tokens) === JSON.stringify(zh.slots?.tokens), `seed ${index} ${slug}: EN/ZH tokens differ`);
  f.ok((en.figure?.shapes.length ?? 0) === (zh.figure?.shapes.length ?? 0), `seed ${index} ${slug}: EN/ZH shape counts differ`);
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
    f.ok(pts.every(inside), `${where}: shape ${i} (${s.kind}) outside the view`);
  });
}
const lineShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'line' }> => s.kind === 'line');
const pointShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'point' }> => s.kind === 'point');
const arrowShapes = (fig: Figure) => fig.shapes.filter((s): s is Extract<FigureShape, { kind: 'arrow' }> => s.kind === 'arrow');
const hasPoint = (fig: Figure, p: Pt, tol = 1e-9) => pointShapes(fig).some(s => ptNear(s.at, p, tol));
const hasArrow = (fig: Figure, from: Pt, to: Pt, tol = 1e-9) => arrowShapes(fig).some(s => ptNear(s.from, from, tol) && ptNear(s.to, to, tol));
const proj = (x: number, y: number, z: number) => project3d([x, y, z]);

// Symbol-card check: assemble the slots, verify the answer tokens grade correctly and no single swap does.
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
function distinctCount(game: number, slug: string, key: (card: PracticeCard) => string): number {
  const set = new Set<string>();
  for (let index = 0; index < SEEDS; index++) set.add(key(getCard(game, index, 'en', slug)));
  return set.size;
}
const plainKey = (card: PracticeCard) => card.prompt;
const fullKey = (card: PracticeCard) => JSON.stringify([card.prompt, card.choice?.options, card.slots, card.figure?.shapes]);

const END = {
  58: { en: 'This game does not assess Stokes\' theorem, surface integrals, or whether \'curl F = 0 implies a potential\' on a region that is not all of space.', zh: '本游戏不评估斯托克斯定理、曲面积分，也不评估“旋度为零推出势函数”在非全空间区域上是否成立。' },
  59: { en: 'This game does not ask you to prove that curl F is twice the paddle-wheel angular velocity, or to derive the curl and divergence identities; it asks only that you compute curl F, read its size and sign, and use the conservative-field criterion.', zh: '本游戏不要求证明旋度等于桨轮角速度的两倍，也不要求推导旋度与散度的恒等式；只要求计算旋度、判读其大小与符号，并运用保守场判据。' },
  60: { en: 'This game does not ask you to prove Stokes\' theorem or to compute a line integral directly around a curve that is not a circle; every line integral here is reduced to a surface integral of curl F (or evaluated on a circle).', zh: '本游戏不要求证明斯托克斯定理，也不要求直接计算非圆周曲线上的线积分；这里的每个线积分都化为旋度的曲面积分（或在圆周上计算）。' },
};

// ======================================================================================================
// MIT-MV-58 — line integrals in space
// ======================================================================================================
const IDS_58 = ['setup', 'segment-work', 'twisted-cubic', 'not-conservative', 'conservative-work', 'find-c', 'exact-diff', 'helix', 'challenge'];
const KINDS_58 = ['MIT-MV-58:challenge', 'MIT-MV-58:conservative-work', 'MIT-MV-58:helix', 'MIT-MV-58:segment-work', 'MIT-MV-58:twisted-cubic'];

describe('MIT-MV-58 oracle', () => {
  it('deck shape, audit kinds, language, figures and end sentence', () => everySeed((index, lang, f) => {
    const cards = deck(58, index, lang);
    const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
    f.ok(JSON.stringify(kinds) === JSON.stringify(KINDS_58), `seed ${index} ${lang}: kinds ${JSON.stringify(kinds)}`);
    f.ok(cards.every(c => !c.fields || c.audit), `seed ${index}: unaudited numeric card`);
    f.ok(JSON.stringify(cards.map(c => c.id)) === JSON.stringify(IDS_58.map(s => `MIT-MV-58-${s}`)), `seed ${index}: order ${cards.map(c => c.id)}`);
    cards.forEach(c => { for (const p of languageProblems(c, lang)) f.list.push(`seed ${index} ${lang} ${c.id}: ${p}`); checkFigureGeneric(c, `seed ${index} ${lang} ${c.id}`, f); });
    for (const c of cards) bothLanguagesAgree(58, index, c.id.slice('MIT-MV-58-'.length), f);
    const last = cards[cards.length - 1];
    f.ok(last.explanation.trimEnd().endsWith(END[58][lang]), `seed ${index} ${lang}: challenge explanation must end with the does-not-assess sentence`);
  }));

  it('setup: the assembled integrand integrates to c^2/2', () => everySeed((index, lang, f) => {
    const card = getCard(58, index, lang, 'setup');
    const [a, b, c] = lastTuple(card.prompt);
    f.ok([a, b, c].every(v => v >= 2 && v <= 7), `seed ${index}: a,b,c ${a},${b},${c} outside plan`);
    const answers = [`−${a * b}t`, `${a * b}t`, `${c * c}t`];
    checkSymbols(card, answers, `seed ${index} ${lang} setup`, f);
    const integral = (v: string[]) => integrate(t => ev(v[0], { t }) + ev(v[1], { t }) + ev(v[2], { t }), 0, 1);
    const truth = c * c / 2;
    f.ok(near(integral(card.slots!.answers), truth, 1e-9), `seed ${index} ${lang}: answers integrate to ${integral(card.slots!.answers)}, plan ${truth}`);
    card.slots!.answers.forEach((_, i) => {
      for (const token of card.slots!.tokens) {
        if (token === card.slots!.answers[i]) continue;
        const trial = card.slots!.answers.slice(); trial[i] = token;
        let v = NaN; try { v = integral(trial); } catch { v = NaN; }
        f.ok(!(Number.isFinite(v) && near(v, truth, 1e-9)), `seed ${index} ${lang}: token "${token}" in slot ${i} also integrates to ${truth}`);
      }
    });
    // figure: an arrow from the origin to (a,b,c) and a point at its head
    const fig = card.figure!;
    f.ok(hasArrow(fig, proj(0, 0, 0), proj(a, b, c)) || hasArrow(fig, proj(0, 0, 0), proj(a, b, c), 1e-6), `seed ${index}: setup segment arrow missing`);
    f.ok(hasPoint(fig, proj(a, b, c), 1e-6), `seed ${index}: setup head point missing`);
  }));

  it('segment-work: quadrature of F·dr along the straight segment gives c^2/2', () => everySeed((index, lang, f) => {
    const card = getCard(58, index, lang, 'segment-work');
    const [a, b, c] = lastTuple(card.prompt);
    f.ok([a, b, c].every(v => v >= 2 && v <= 7), `seed ${index}: endpoint outside plan`);
    const route = integrate(t => (-(b * t)) * a + (a * t) * b + (c * t) * c, 0, 1);
    f.ok(near(route, c * c / 2, 1e-9), `seed ${index}: oracle routes disagree ${route} vs ${c * c / 2}`);
    auditIs(card, 'MIT-MV-58:segment-work', { a, b, c }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [route], 1e-6, `seed ${index} ${lang} segment-work`, f);
    const fig = card.figure!;
    f.ok(hasArrow(fig, proj(0, 0, 0), proj(a, b, c), 1e-6), `seed ${index}: segment arrow missing`);
  }));

  it('twisted-cubic: quadrature of F·dr along (t, t², t³)', () => everySeed((index, lang, f) => {
    const card = getCard(58, index, lang, 'twisted-cubic');
    const m = rx(card.prompt, /F = (?:(\d+))?\(-y, x, z\)/, 'p');
    const p = m[1] === undefined ? 1 : Number(m[1]);
    const h = Number(rx(card.prompt, /0 ≤ t ≤ (\d+)/, 'h')[1]);
    f.ok([1, 2, 3].includes(p) && [1, 2].includes(h), `seed ${index}: p,h ${p},${h} outside plan`);
    const route = integrate(t => { const F: [number, number, number] = [-p * t * t, p * t, p * t * t * t]; const rp = [1, 2 * t, 3 * t * t]; return F[0] * rp[0] + F[1] * rp[1] + F[2] * rp[2]; }, 0, h);
    const closed = p * (h ** 3 / 3 + h ** 6 / 2);
    f.ok(near(route, closed, 1e-6), `seed ${index}: oracle routes disagree ${route} vs ${closed}`);
    auditIs(card, 'MIT-MV-58:twisted-cubic', { p, h }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [route], 1e-6, `seed ${index} ${lang} twisted-cubic`, f);
    const curve = lineShapes(card.figure!).find(l => l.points.length >= 20)!;
    f.ok(curve.points.every((pt, i) => ptNear(pt, proj(h * i / 24, (h * i / 24) ** 2, (h * i / 24) ** 3), 1e-9)), `seed ${index}: twisted-cubic curve points wrong`);
  }));

  it('not-conservative: the criterion ∂M/∂y ≠ ∂N/∂x fails and names p and q', () => everySeed((index, lang, f) => {
    const card = getCard(58, index, lang, 'not-conservative');
    const m = rx(card.prompt, /(\d+) ≠ (\d+)/, 'p,q');
    const p = Number(m[1]), q = Number(m[2]);
    f.ok(p !== q, `seed ${index}: p = q = ${p}`);
    const pred = (o: string) => clean(o).includes(`∂M/∂y = ${p}`) && clean(o).includes(`∂N/∂x = ${q}`);
    const good = card.choice!.options.map(pred);
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: predicate ${good}, answer ${card.choice!.answer}`);
    f.ok(new Set(card.choice!.options).size === 4, `seed ${index}: options not distinct`);
  }));

  it('conservative-work: quadrature of ∇(xy²z) along the segment equals a b² c', () => everySeed((index, lang, f) => {
    const card = getCard(58, index, lang, 'conservative-work');
    const [a, b, c] = lastTuple(card.prompt);
    f.ok([a, b, c].every(v => v >= 1 && v <= 6), `seed ${index}: endpoint outside plan`);
    const route = integrate(t => { const x = a * t, y = b * t, z = c * t; const F = [y * y * z, 2 * x * y * z, x * y * y]; return F[0] * a + F[1] * b + F[2] * c; }, 0, 1);
    f.ok(near(route, a * b * b * c, 1e-6), `seed ${index}: oracle routes disagree ${route} vs ${a * b * b * c}`);
    auditIs(card, 'MIT-MV-58:conservative-work', { a, b, c }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [route], 1e-6, `seed ${index} ${lang} conservative-work`, f);
  }));

  it('find-c: the criterion forces c = 2d', () => everySeed((index, lang, f) => {
    const card = getCard(58, index, lang, 'find-c');
    const m = rx(card.prompt, /\+ \((\d*)y² \+ (\d*)z²\) k/, 'd,e');
    const d = m[1] === '' ? 1 : Number(m[1]), e = m[2] === '' ? 1 : Number(m[2]);
    f.ok([1, 2, 3, 4].includes(d) && [1, 2, 3, 4].includes(e), `seed ${index}: d,e ${d},${e} outside plan`);
    // ∂N/∂z = c y must equal ∂P/∂y = 2d y
    const want = `c = ${2 * d}`;
    const chosen = card.choice!.options[card.choice!.answer];
    f.ok(chosen === want, `seed ${index} ${lang}: chosen "${chosen}" vs "${want}"`);
    f.ok(card.choice!.options.filter(o => o === want).length === 1, `seed ${index}: duplicate correct option`);
    f.ok(new Set(card.choice!.options).size === 4, `seed ${index}: options not distinct`);
  }));

  it('exact-diff: exactly the plan\'s exact form is offered and chosen', () => everySeed((index, lang, f) => {
    const card = getCard(58, index, lang, 'exact-diff');
    const chosen = clean(card.choice!.options[card.choice!.answer]);
    const p = coefOf(chosen.split(' dx ')[0], 'y²z');
    f.ok([1, 2, 3, 4, 5, 6].includes(p), `seed ${index}: p ${p} outside plan`);
    const c = (k: number, v: string) => k === 1 ? v : k === -1 ? `-${v}` : `${k}${v}`;
    const forms = [
      `${c(p, 'y²z')} dx + ${c(2 * p, 'xyz')} dy + ${c(p, 'xy²')} dz`,
      `${c(p, 'y²z')} dx + ${c(2 * p, 'yz')} dy + ${c(p, 'xy²')} dz`,
      `${c(p, 'y²z')} dx + ${c(2 * p, 'xyz')} dy + ${c(p, 'xy')} dz`,
      `${c(p, 'y²z')} dx + ${c(2 * p, 'xyz')} dy + ${c(p, 'xyz')} dz`,
    ];
    const opts = card.choice!.options.map(clean);
    f.ok(JSON.stringify([...opts].sort()) === JSON.stringify([...forms].sort()), `seed ${index} ${lang}: options ${JSON.stringify(opts)} vs plan ${JSON.stringify(forms)}`);
    f.ok(opts[card.choice!.answer] === forms[0], `seed ${index}: chosen option is not the exact differential`);
    // algebra: M = p y²z, N = 2p xyz, P = p xy² satisfies all three equalities identically
    const M = (x: number, y: number, z: number) => p * y * y * z;
    const N = (x: number, y: number, z: number) => 2 * p * x * y * z;
    const P = (x: number, y: number, z: number) => p * x * y * y;
    const q = [0.7, -1.3, 2.1] as [number, number, number];
    f.ok(near(fd(P, q, 1), fd(N, q, 2), 1e-3) && near(fd(M, q, 2), fd(P, q, 0), 1e-3) && near(fd(N, q, 0), fd(M, q, 1), 1e-3), `seed ${index}: exact form fails the criterion`);
  }));

  it('helix: k = −a from ∇f along the helix', () => everySeed((index, lang, f) => {
    const card = getCard(58, index, lang, 'helix');
    const a = Number(rx(card.prompt, /f = \((\d*)x \+ y²\) z/, 'a')[1] || '1');
    f.ok(a >= 1 && a <= 6, `seed ${index}: a ${a} outside plan`);
    const route = integrate(t => { const x = Math.cos(t), y = Math.sin(t), z = t; const F = [a * z, 2 * y * z, a * x + y * y]; const rp = [-Math.sin(t), Math.cos(t), 1]; return F[0] * rp[0] + F[1] * rp[1] + F[2] * rp[2]; }, 0, PI) / PI;
    f.ok(near(route, -a, 1e-6), `seed ${index}: oracle k ${route} vs ${-a}`);
    auditIs(card, 'MIT-MV-58:helix', { a }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [route], 1e-6, `seed ${index} ${lang} helix`, f);
    const fig = card.figure!;
    f.ok(hasPoint(fig, proj(1, 0, 0), 1e-6) && hasPoint(fig, proj(-1, 0, PI), 1e-6), `seed ${index}: helix endpoints missing`);
  }));

  it('challenge: ∮ (−y dx + x dy) around the counterclockwise rectangle is 2ab', () => everySeed((index, lang, f) => {
    const card = getCard(58, index, lang, 'challenge');
    const m = rx(card.prompt, /\(0, 0, (\d+)\) → \((\d+), 0, \d+\) → \(\d+, (\d+), \d+\)/, 'a,b,h');
    const h = Number(m[1]), a = Number(m[2]), b = Number(m[3]);
    f.ok(a >= 1 && a <= 6 && b >= 1 && b <= 6 && h >= 1 && h <= 3, `seed ${index}: a,b,h ${a},${b},${h} outside plan`);
    // four straight sides, F = (−y, x, z), z = h constant
    const legs: [[number, number], [number, number]][] = [[[0, 0], [a, 0]], [[a, 0], [a, b]], [[a, b], [0, b]], [[0, b], [0, 0]]];
    let route = 0;
    for (const [[x0, y0], [x1, y1]] of legs) route += integrate(t => { const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t; return (-y) * (x1 - x0) + x * (y1 - y0); }, 0, 1);
    f.ok(near(route, 2 * a * b, 1e-9), `seed ${index}: oracle ∮ ${route} vs ${2 * a * b}`);
    auditIs(card, 'MIT-MV-58:challenge', { a, b, h }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [route], 1e-6, `seed ${index} ${lang} challenge`, f);
  }));

  it('variety: ≥ 6 distinct prompts per card', () => {
    for (const [slug, key, min] of [['setup', plainKey, 6], ['segment-work', plainKey, 6], ['twisted-cubic', plainKey, 6], ['not-conservative', plainKey, 6], ['conservative-work', plainKey, 6], ['find-c', plainKey, 6], ['exact-diff', fullKey, 6], ['helix', plainKey, 6], ['challenge', plainKey, 6]] as const)
      expect(distinctCount(58, slug, key), slug).toBeGreaterThanOrEqual(min);
  });
});

// ======================================================================================================
// MIT-MV-59 — curl in 3D
// ======================================================================================================
const IDS_59 = ['curl-setup', 'curl-vector', 'paddle-speed', 'curl-y', 'conservative-potential', 'orientation-spin', 'assumption-domain', 'curl-k', 'challenge'];
const KINDS_59 = ['MIT-MV-59:challenge', 'MIT-MV-59:curl-k', 'MIT-MV-59:curl-vector', 'MIT-MV-59:curl-y', 'MIT-MV-59:paddle-speed'];
const F_CV = (p: number, q: number, r: number): V3 => (x, y, z) => [p * y, q * z, r * x];

describe('MIT-MV-59 oracle', () => {
  it('deck shape, audit kinds, language, figures and end sentence', () => everySeed((index, lang, f) => {
    const cards = deck(59, index, lang);
    const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
    f.ok(JSON.stringify(kinds) === JSON.stringify(KINDS_59), `seed ${index} ${lang}: kinds ${JSON.stringify(kinds)}`);
    f.ok(cards.every(c => !c.fields || c.audit), `seed ${index}: unaudited numeric card`);
    f.ok(JSON.stringify(cards.map(c => c.id)) === JSON.stringify(IDS_59.map(s => `MIT-MV-59-${s}`)), `seed ${index}: order ${cards.map(c => c.id)}`);
    cards.forEach(c => { for (const p of languageProblems(c, lang)) f.list.push(`seed ${index} ${lang} ${c.id}: ${p}`); checkFigureGeneric(c, `seed ${index} ${lang} ${c.id}`, f); });
    for (const c of cards) bothLanguagesAgree(59, index, c.id.slice('MIT-MV-59-'.length), f);
    const last = cards[cards.length - 1];
    f.ok(last.explanation.trimEnd().endsWith(END[59][lang]), `seed ${index} ${lang}: challenge explanation must end with the does-not-assess sentence`);
  }));

  it('curl-setup: the six numerators follow C, B, A, C, B, A', () => everySeed((index, lang, f) => {
    const card = getCard(59, index, lang, 'curl-setup');
    const m = rx(card.prompt, /F = \(([A-Za-z]), ([A-Za-z]), ([A-Za-z])\)/, 'letters');
    const [A, B, C] = [m[1], m[2], m[3]];
    f.ok(new Set([A, B, C]).size === 3, `seed ${index}: letters not distinct`);
    checkSymbols(card, [C, B, A, C, B, A], `seed ${index} ${lang} curl-setup`, f);
    f.ok(card.slots!.answers.length === 6, `seed ${index}: expected 6 blanks`);
  }));

  it('curl-vector: finite differences of (p y, q z, r x) give (−q, −r, −p)', () => everySeed((index, lang, f) => {
    const card = getCard(59, index, lang, 'curl-vector');
    const t = rx(card.prompt, /F = \(([^,()]+), ([^,()]+), ([^,()]+)\)/, 'F').slice(1);
    const [p, q, r] = t.map((term, i) => coefOf(term, ['y', 'z', 'x'][i]));
    f.ok([p, q, r].every(v => Math.abs(v) >= 1 && Math.abs(v) <= 3), `seed ${index}: p,q,r ${p},${q},${r} outside plan`);
    const got = curl(F_CV(p, q, r), [0.7, -1.3, 2.1]);
    const want = [-q, -r, -p];
    f.ok(got.every((v, i) => near(v, want[i], 1e-4)), `seed ${index}: FD curl ${got} vs ${want}`);
    auditIs(card, 'MIT-MV-59:curl-vector', { p, q, r }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, want, 1e-9, `seed ${index} ${lang} curl-vector`, f);
  }));

  it('paddle-speed: curl w(−y, x, 0) = 2w k, so the angular velocity about +k is w', () => everySeed((index, lang, f) => {
    const card = getCard(59, index, lang, 'paddle-speed');
    const m = rx(card.prompt, /F = ([^.]*?)\(-y, x, 0\)/, 'coefficient');
    const tail = clean(m[1]).trim();
    f.ok(/^$|^-?\d+$/.test(tail), `seed ${index}: printed coefficient "${m[1].trim()}" is not a bare number (the field must be w·(−y, x, 0))`);
    const w = tail === '' ? 1 : Number(tail);
    f.ok(w >= 1 && w <= 6, `seed ${index}: w ${w} outside plan`);
    const F = (x: number, y: number, z: number): [number, number, number] => [-w * y, w * x, 0];
    const c = curl(F, [0.7, -1.3, 0]);
    f.ok(near(c[2], 2 * w, 1e-4) && near(c[0], 0, 1e-4) && near(c[1], 0, 1e-4), `seed ${index}: FD curl ${c} vs (0,0,${2 * w})`);
    auditIs(card, 'MIT-MV-59:paddle-speed', { w }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [w], 1e-9, `seed ${index} ${lang} paddle-speed`, f);
    const fig = card.figure!;
    f.ok(hasPoint(fig, [0.9, 0.9], 1e-9), `seed ${index}: paddle centre missing`);
  }));

  it('curl-y: finite differences give a − c', () => everySeed((index, lang, f) => {
    const card = getCard(59, index, lang, 'curl-y');
    const m = rx(card.prompt, /3x²y \+ (\d+)z, x³, (\d+)x \+ 3z²/, 'a,c');
    const a = Number(m[1]), c = Number(m[2]);
    f.ok([2, 3, 4, 5].includes(a) && [2, 3, 4, 5].includes(c) && a !== c, `seed ${index}: a,c ${a},${c} outside plan`);
    const M = (x: number, y: number, z: number) => 3 * x * x * y + a * z;
    const P = (x: number, y: number, z: number) => c * x + 3 * z * z;
    const got = fd(M, [1.1, 0.6, 0.9], 2) - fd(P, [1.1, 0.6, 0.9], 0);
    f.ok(near(got, a - c, 1e-4), `seed ${index}: FD j-component ${got} vs ${a - c}`);
    auditIs(card, 'MIT-MV-59:curl-y', { a, c }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [a - c], 1e-9, `seed ${index} ${lang} curl-y`, f);
  }));

  it('conservative-potential: the missing term is d x z and ∇f = F', () => everySeed((index, lang, f) => {
    const card = getCard(59, index, lang, 'conservative-potential');
    const m = rx(card.prompt, /3x²y \+ (\d+)z, x³, (\d+)x \+ 3z²/, 'd');
    const d = Number(m[1]);
    f.ok(d >= 2 && d <= 7, `seed ${index}: d ${d} outside plan`);
    f.ok(Number(m[2]) === d, `seed ${index}: the two d coefficients differ (${m[1]} vs ${m[2]})`);
    checkSymbols(card, [`${d}x z`], `seed ${index} ${lang} conservative-potential`, f);
    // ∇(x³y + d x z + z³) = (3x²y + d z, x³, d x + 3z²)
    const F = (x: number, y: number, z: number) => 3 * x * x * y + d * z;
    const G = (x: number, y: number, z: number) => x * x * x;
    const H = (x: number, y: number, z: number) => d * x + 3 * z * z;
    const q = [0.6, -1.1, 1.4] as [number, number, number];
    f.ok(near(fd((x, y, z) => x ** 3 * y + d * x * z + z ** 3, q, 0), F(q[0], q[1], q[2]), 1e-4)
      && near(fd((x, y, z) => x ** 3 * y + d * x * z + z ** 3, q, 1), G(q[0], q[1], q[2]), 1e-4)
      && near(fd((x, y, z) => x ** 3 * y + d * x * z + z ** 3, q, 2), H(q[0], q[1], q[2]), 1e-4), `seed ${index}: ∇f ≠ F`);
  }));

  it('orientation-spin: s > 0 spins clockwise as seen from +z (curl = −s k)', () => everySeed((index, lang, f) => {
    const card = getCard(59, index, lang, 'orientation-spin');
    const term = rx(card.prompt, /F = \(([^,()]+), 0, 0\)/, 's')[1];
    const s = coefOf(term, 'y');
    f.ok(Math.abs(s) >= 1 && Math.abs(s) <= 3, `seed ${index}: s ${s} outside plan`);
    const want = s > 0 ? 'clockwise' as const : 'counterclockwise' as const;
    const other = s > 0 ? 'counterclockwise' as const : 'clockwise' as const;
    const pred = (o: string) => clean(o).startsWith(dirWord(lang, want));
    const good = card.choice!.options.map(pred);
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: want ${want}, predicate ${good}, answer ${card.choice!.answer}`);
    f.ok(card.choice!.options.filter(o => clean(o).startsWith(dirWord(lang, other))).length === 1, `seed ${index}: opposite direction option missing`);
    f.ok(new Set(card.choice!.options).size === 4, `seed ${index}: options not distinct`);
    // figure (coordinator, after the browser read): the field F = (s y, 0) only, never the spin (that is the answer).
    // Every arrow is horizontal and points along sign(s·y) at its foot; there are arrows above and below the axis.
    const arrows = arrowShapes(card.figure!);
    f.ok(arrows.length >= 4, `seed ${index}: field arrows missing`);
    f.ok(arrows.every(a => Math.abs(a.to[1] - a.from[1]) < 1e-9 && Math.sign(a.to[0] - a.from[0]) === Math.sign(s * a.from[1])), `seed ${index}: figure arrows are not the field (s y, 0)`);
    f.ok(arrows.some(a => a.from[1] > 0) && arrows.some(a => a.from[1] < 0), `seed ${index}: field shown on one side only`);
  }));

  it('assumption-domain: exactly one option says the criterion does not apply', () => everySeed((index, lang, f) => {
    const card = getCard(59, index, lang, 'assumption-domain');
    const pred = (o: string) => lang === 'en'
      ? /criterion requires G to be continuously differentiable for all x, y and z/.test(o) && /does not apply/.test(o)
      : /判据要求 G 对所有 x, y, z 连续可微/.test(o) && /判据不适用/.test(o);
    const good = card.choice!.options.map(pred);
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: predicate ${good}, answer ${card.choice!.answer}`);
    f.ok(new Set(card.choice!.options).size === 4, `seed ${index}: options not distinct`);
  }));

  it('curl-k: finite differences give q − p', () => everySeed((index, lang, f) => {
    const card = getCard(59, index, lang, 'curl-k');
    const t = rx(card.prompt, /F = \(([^,()]+), ([^,()]+), ([^,()]+)\)/, 'F').slice(1);
    const p = coefOf(t[0], 'y'), q = coefOf(t[1], 'x'), r = coefOf(t[2], 'z');
    f.ok([p, q, r].every(v => v >= 1 && v <= 6), `seed ${index}: p,q,r ${p},${q},${r} outside plan`);
    const M = (x: number, y: number, z: number) => p * y;
    const N = (x: number, y: number, z: number) => q * x;
    const got = fd(N, [0.8, 1.4, 0.6], 0) - fd(M, [0.8, 1.4, 0.6], 1);
    f.ok(near(got, q - p, 1e-4), `seed ${index}: FD k-component ${got} vs ${q - p}`);
    auditIs(card, 'MIT-MV-59:curl-k', { p, q, r }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [q - p], 1e-9, `seed ${index} ${lang} curl-k`, f);
  }));

  it('challenge: FD curl dotted with n gives −(a q + b r + c p)', () => everySeed((index, lang, f) => {
    const card = getCard(59, index, lang, 'challenge');
    const t = rx(card.prompt, /F = \(([^,()]+), ([^,()]+), ([^,()]+)\)/, 'F').slice(1);
    const [p, q, r] = [coefOf(t[0], 'y'), coefOf(t[1], 'z'), coefOf(t[2], 'x')];
    const n = rx(card.prompt, /n = \((-?\d+), (-?\d+), (-?\d+)\)/, 'n').slice(1).map(Number);
    const [a, b, c] = n;
    f.ok([p, q, r, a, b, c].every(v => v !== 0 && Math.abs(v) <= 3), `seed ${index}: params outside plan`);
    const c3 = curl(F_CV(p, q, r), [0.7, -1.3, 2.1]);
    const got = c3[0] * a + c3[1] * b + c3[2] * c;
    const want = -(a * q + b * r + c * p);
    f.ok(near(got, want, 1e-3), `seed ${index}: FD dot ${got} vs ${want}`);
    f.ok(want !== 0 && Math.abs(want) <= 12, `seed ${index}: answer ${want} outside plan constraint`);
    auditIs(card, 'MIT-MV-59:challenge', { p, q, r, a, b, c }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [want], 1e-9, `seed ${index} ${lang} challenge`, f);
  }));

  it('variety: ≥ 6 distinct prompts per card', () => {
    for (const [slug, key, min] of [['curl-setup', fullKey, 6], ['curl-vector', plainKey, 6], ['paddle-speed', plainKey, 6], ['curl-y', plainKey, 6], ['conservative-potential', plainKey, 6], ['orientation-spin', plainKey, 6], ['assumption-domain', plainKey, 3], ['curl-k', plainKey, 6], ['challenge', plainKey, 6]] as const)
      expect(distinctCount(59, slug, key), slug).toBeGreaterThanOrEqual(min);
  });
});

// ======================================================================================================
// MIT-MV-60 — Stokes' theorem
// ======================================================================================================
const IDS_60 = ['stokes-setup', 'graph-value', 'orientation', 'hemisphere-value', 'cylinder-flux', 'flat-circle', 'conservative-stokes', 'challenge'];
const KINDS_60 = ['MIT-MV-60:challenge', 'MIT-MV-60:flat-circle', 'MIT-MV-60:graph-value', 'MIT-MV-60:hemisphere-value'];

describe('MIT-MV-60 oracle', () => {
  it('deck shape, audit kinds, language, figures and end sentence', () => everySeed((index, lang, f) => {
    const cards = deck(60, index, lang);
    const kinds = cards.filter(c => c.audit).map(c => c.audit!.kind).sort();
    f.ok(JSON.stringify(kinds) === JSON.stringify(KINDS_60), `seed ${index} ${lang}: kinds ${JSON.stringify(kinds)}`);
    f.ok(cards.every(c => !c.fields || c.audit), `seed ${index}: unaudited numeric card`);
    f.ok(JSON.stringify(cards.map(c => c.id)) === JSON.stringify(IDS_60.map(s => `MIT-MV-60-${s}`)), `seed ${index}: order ${cards.map(c => c.id)}`);
    cards.forEach(c => { for (const p of languageProblems(c, lang)) f.list.push(`seed ${index} ${lang} ${c.id}: ${p}`); checkFigureGeneric(c, `seed ${index} ${lang} ${c.id}`, f); });
    for (const c of cards) bothLanguagesAgree(60, index, c.id.slice('MIT-MV-60-'.length), f);
    const last = cards[cards.length - 1];
    f.ok(last.explanation.trimEnd().endsWith(END[60][lang]), `seed ${index} ${lang}: challenge explanation must end with the does-not-assess sentence`);
  }));

  it('stokes-setup: the k-component of curl(a x², b x, c z²) is b', () => everySeed((index, lang, f) => {
    const card = getCard(60, index, lang, 'stokes-setup');
    const m = rx(card.prompt, /F = \(([^,()]+), ([^,()]+), ([^,()]+)\)/, 'F').slice(1);
    const a = coefOf(m[0], 'x²'), b = coefOf(m[1], 'x'), c = coefOf(m[2], 'z²');
    f.ok([a, b, c].every(v => v >= 1 && v <= 6), `seed ${index}: a,b,c ${a},${b},${c} outside plan`);
    const F = (x: number, y: number, z: number): [number, number, number] => [a * x * x, b * x, c * z * z];
    const c3 = curl(F, [0.7, -1.3, 2.1]);
    f.ok(near(c3[0], 0, 1e-4) && near(c3[1], 0, 1e-4) && near(c3[2], b, 1e-4), `seed ${index}: FD curl ${c3} vs (0,0,${b})`);
    checkSymbols(card, [String(b)], `seed ${index} ${lang} stokes-setup`, f);
  }));

  it('graph-value: ∮ F·dr around the graph boundary is b R² π', () => everySeed((index, lang, f) => {
    const card = getCard(60, index, lang, 'graph-value');
    const m = rx(card.prompt, /F = \(([^,()]+), ([^,()]+), ([^,()]+)\)/, 'F').slice(1);
    const a = coefOf(m[0], 'x²'), b = coefOf(m[1], 'x'), c = coefOf(m[2], 'z²');
    const R = Number(rx(card.prompt, /x² \+ y² ≤ (\d+)²/, 'R')[1]);
    f.ok([a, c].every(v => v >= 1 && v <= 3) && b >= 1 && b <= 6 && R >= 1 && R <= 6, `seed ${index}: params outside plan`);
    const fgraph = (x: number, y: number) => x ** 3 + x * x * y + y ** 4;
    // Independent route: numerical surface integral ∬ (curl F)·n dS with n dS = (−f_x, −f_y, 1) dx dy over the disk
    // (stable — no catastrophic cancellation, and it exercises the same curl/normal machinery as the answer).
    const Fv = (x: number, y: number, z: number): [number, number, number] => [a * x * x, b * x, c * z * z];
    const h = 1e-5;
    const route = integrate(r => r * integrate(th => {
      const x = R * r * Math.cos(th), y = R * r * Math.sin(th), z = fgraph(x, y);
      const fx = (8 * (fgraph(x + h, y) - fgraph(x - h, y)) - (fgraph(x + 2 * h, y) - fgraph(x - 2 * h, y))) / (12 * h);
      const fy = (8 * (fgraph(x, y + h) - fgraph(x, y - h)) - (fgraph(x, y + 2 * h) - fgraph(x, y - 2 * h))) / (12 * h);
      const cf = curl(Fv, [x, y, z]);
      return cf[0] * (-fx) + cf[1] * (-fy) + cf[2];
    }, 0, 2 * PI), 0, R) / PI;
    f.ok(near(route, b * R * R, 1e-6), `seed ${index}: oracle k ${route} vs ${b * R * R}`);
    auditIs(card, 'MIT-MV-60:graph-value', { a, c, b, R }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [route], 1e-9, `seed ${index} ${lang} graph-value`, f);
    // figure (coordinator, after the browser read): the projection of S, the circle of radius R in the xy-plane.
    // Invert the oblique projection for z = 0: (p, q) = (y − 0.45x, −0.3x).
    const onDisk = (pt: Pt) => { const x = -pt[1] / 0.3, y = pt[0] + 0.45 * x; return Math.abs(Math.hypot(x, y) - R) < 1e-6; };
    const circle = lineShapes(card.figure!).find(l => l.points.length >= 40);
    f.ok(circle !== undefined && circle.points.every(onDisk), `seed ${index}: projected boundary circle of radius R wrong`);
    void fgraph;
  }));

  it('orientation: upward → counterclockwise, downward → clockwise', () => everySeed((index, lang, f) => {
    const card = getCard(60, index, lang, 'orientation');
    const upward = lang === 'en' ? /the upward graph/.test(card.prompt) : /上侧图面/.test(card.prompt);
    const downward = lang === 'en' ? /the downward graph/.test(card.prompt) : /下侧图面/.test(card.prompt);
    f.ok(upward !== downward, `seed ${index} ${lang}: cannot read orientation`);
    const want = upward ? 'counterclockwise' as const : 'clockwise' as const;
    const other = upward ? 'clockwise' as const : 'counterclockwise' as const;
    const pred = (o: string) => clean(o).startsWith(dirWord(lang, want));
    const good = card.choice!.options.map(pred);
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: want ${want}, predicate ${good}`);
    f.ok(card.choice!.options.filter(o => clean(o).startsWith(dirWord(lang, other))).length === 1, `seed ${index}: opposite option missing`);
    // figure (coordinator, after the browser read): no traversal arrows (the direction is the answer), and the
    // side of S it names agrees with the prompt.
    f.ok(arrowShapes(card.figure!).length === 0, `seed ${index}: orientation figure shows direction arrows`);
    const side = card.figure!.shapes.filter(s => s.kind === 'text').map(s => (s as { text: string }).text).join(' ');
    f.ok(upward ? /up|向上/.test(side) && !/down|向下/.test(side) : /down|向下/.test(side) && !/up|向上/.test(side), `seed ${index} ${lang}: figure side text "${side}" does not match`);
  }));

  it('hemisphere-value: ∮ F·dr around the xz-circle is −ρ² π', () => everySeed((index, lang, f) => {
    const card = getCard(60, index, lang, 'hemisphere-value');
    const rho = Number(rx(card.prompt, /x² \+ y² \+ z² = (\d+)²/, 'rho')[1]);
    f.ok(rho >= 1 && rho <= 6, `seed ${index}: ρ ${rho} outside plan`);
    const route = integrate(t => {
      const x = rho * Math.cos(t), y = 0, z = -rho * Math.sin(t);
      const F = [y, 2 * x, x]; const rp = [-rho * Math.sin(t), 0, -rho * Math.cos(t)];
      return F[0] * rp[0] + F[1] * rp[1] + F[2] * rp[2];
    }, 0, 2 * PI) / PI;
    f.ok(near(route, -rho * rho, 1e-9), `seed ${index}: oracle k ${route} vs ${-rho * rho}`);
    auditIs(card, 'MIT-MV-60:hemisphere-value', { rho }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [route], 1e-9, `seed ${index} ${lang} hemisphere-value`, f);
  }));

  it('cylinder-flux: the flux is 0 and the distractors are the plan values', () => everySeed((index, lang, f) => {
    const card = getCard(60, index, lang, 'cylinder-flux');
    const m = rx(card.prompt, /x² \+ y² = (\d+)²[、,]\s*0 ≤ z ≤ (\d+)/, 'R,h');
    const R = Number(m[1]), h = Number(m[2]);
    f.ok(R >= 1 && R <= 5 && h >= 1 && h <= 5, `seed ${index}: R,h ${R},${h} outside plan`);
    const vals = card.choice!.options.map(o => o === '0' ? 0 : Number(rx(o, /^(\d+)π$/, 'distractor')[1]));
    f.ok(vals.filter(v => v === 0).length === 1 && vals[card.choice!.answer] === 0, `seed ${index} ${lang}: predicates ${vals}, answer ${card.choice!.answer}`);
    f.ok([4 * R * h, 2 * R * h, 2 * R * R].every(v => v > 0), 'bad distractor');
    f.ok(new Set(vals.map(v => String(v))).size === 4, `seed ${index}: distractor values not distinct ${vals}`);
  }));

  it('flat-circle: ∮ F·dr around the z = 0 circle is 2 R² π', () => everySeed((index, lang, f) => {
    const card = getCard(60, index, lang, 'flat-circle');
    const R = Number(rx(card.prompt, /x² \+ y² = (\d+)²/, 'R')[1]);
    f.ok(R >= 1 && R <= 6, `seed ${index}: R ${R} outside plan`);
    const route = integrate(t => {
      const x = R * Math.cos(t), y = R * Math.sin(t);
      const F = [y, 3 * x, x * x + y * y + 5]; const rp = [-R * Math.sin(t), R * Math.cos(t), 0];
      return F[0] * rp[0] + F[1] * rp[1] + F[2] * rp[2];
    }, 0, 2 * PI) / PI;
    f.ok(near(route, 2 * R * R, 1e-9), `seed ${index}: oracle k ${route} vs ${2 * R * R}`);
    auditIs(card, 'MIT-MV-60:flat-circle', { R }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [route], 1e-9, `seed ${index} ${lang} flat-circle`, f);
  }));

  it('conservative-stokes: exactly one option is 0', () => everySeed((index, lang, f) => {
    const card = getCard(60, index, lang, 'conservative-stokes');
    const good = card.choice!.options.map(o => o === '0');
    f.ok(good.filter(Boolean).length === 1 && good[card.choice!.answer], `seed ${index} ${lang}: predicate ${good}, answer ${card.choice!.answer}`);
    f.ok(new Set(card.choice!.options).size === 4, `seed ${index}: options not distinct`);
  }));

  it('challenge: ∮ F·dr around the lifted circle is s R² π', () => everySeed((index, lang, f) => {
    const card = getCard(60, index, lang, 'challenge');
    const s = Number(rx(card.prompt, /F = \(0, (\d*)x, 0\)/, 's')[1] || '1');
    const R = Number(rx(card.prompt, /x² \+ y² ≤ (\d+)²/, 'R')[1]);
    f.ok([1, 2, 3].includes(s) && [1, 2, 3].includes(R), `seed ${index}: s,R ${s},${R} outside plan`);
    const route = integrate(t => { const x = R * Math.cos(t); return (s * x) * (R * Math.cos(t)); }, 0, 2 * PI) / PI;
    f.ok(near(route, s * R * R, 1e-9), `seed ${index}: oracle k ${route} vs ${s * R * R}`);
    const h = Number(rx(card.prompt, /z = (\d+)/, 'h')[1]);
    auditIs(card, 'MIT-MV-60:challenge', { s, R, h }, `seed ${index} ${lang}`, f);
    gradeNumeric(card, [route], 1e-9, `seed ${index} ${lang} challenge`, f);
  }));

  it('variety: ≥ 6 distinct prompts per card', () => {
    for (const [slug, key, min] of [['stokes-setup', plainKey, 6], ['graph-value', plainKey, 6], ['orientation', plainKey, 6], ['hemisphere-value', plainKey, 6], ['cylinder-flux', plainKey, 6], ['flat-circle', plainKey, 6], ['conservative-stokes', plainKey, 6], ['challenge', plainKey, 6]] as const)
      expect(distinctCount(60, slug, key), slug).toBeGreaterThanOrEqual(min);
  });
});
