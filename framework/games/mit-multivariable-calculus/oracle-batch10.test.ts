import { describe, expect, it } from 'vitest';
import { batch10Generators } from './batch10';
import { spreadSeed } from './deck-invariants';
import { simpson, runOracle, type Oracle } from './oracle-harness';
import { gradeCard, parseGameNumber, type PracticeCard } from '../types';
import type { Figure, Pt } from '../figure';

type Params = Record<string, number>;
type Field = (x: number, y: number) => readonly [number, number];
const SEEDS = 60;
const PI = Math.PI;
describe('batch 10 Task C theorem and figure semantics', () => {
  it('MV46 retains the normal-form hypotheses in both variants and languages', () => {
    const variants = new Set<string>();
    for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
      const cards = batch10Generators['MIT-MV-46'](spreadSeed(index), lang);
      const normal = cards.find(card => card.id.endsWith('-normal-form'))!;
      variants.add(normal.slots!.answers[0]);
      for (const part of lang === 'en'
        ? ['counterclockwise', 'simple closed boundary', 'outward unit normal', 'continuously differentiable', 'open set containing R and its boundary']
        : ['逆时针', '简单闭边界', '单位外法向量', '连续可微', '包含 R 及其边界的开集']) expect(normal.prompt).toContain(part);
      const flux = cards.find(card => card.id.endsWith('-circle-flux'))!;
      expect(flux.figure!.alt).toContain(lang === 'en' ? 'counterclockwise travel' : '逆时针绕行方向');
      expect(flux.figure!.alt).not.toMatch(/radial|径向/);
    }
    expect([...variants].sort()).toEqual(['div F', '∂M/∂x + ∂N/∂y'].sort());
  });
});
const clean = (text: string) => text.replaceAll('\u2212', '-').replaceAll('\u00b7', '*').replaceAll('\u00a0', ' ');
const derivative = (fn: (value: number) => number, at: number) => {
  const difference = (step: number) => (fn(at + step) - fn(at - step)) / (2 * step);
  return (4 * difference(0.125) - difference(0.25)) / 3;
};
function integrate(fn: (value: number) => number, lo = 0, hi = 1): number {
  let previous = simpson(fn, lo, hi, 32);
  for (let panels = 64; panels <= 8192; panels *= 2) {
    const current = simpson(fn, lo, hi, panels);
    const extrapolated = current + (current - previous) / 15;
    if (Math.abs(current - previous) / 15 < 2e-11) return extrapolated;
    previous = current;
  }
  throw new Error(`Quadrature did not stabilize on [${lo}, ${hi}]`);
}
function segment(field: Field, start: Pt, end: Pt, flux = false): number {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  return integrate(time => {
    const [first, second] = field(start[0] + time * dx, start[1] + time * dy);
    return flux ? first * dy - second * dx : first * dx + second * dy;
  });
}
function circle(field: Field, radius: number, cx = 0, cy = 0, direction = 1, flux = false): number {
  return integrate(angle => {
    const x = cx + radius * Math.cos(angle), y = cy + radius * Math.sin(angle);
    const [first, second] = field(x, y), dx = -radius * Math.sin(angle), dy = radius * Math.cos(angle);
    return direction * (flux ? first * dy - second * dx : first * dx + second * dy);
  }, 0, 2 * PI);
}
function rectangle(field: Field, width: number, height: number, flux = false): number {
  const vertices: Pt[] = [[0, 0], [width, 0], [width, height], [0, height]];
  return vertices.reduce((sum, start, index) => sum + segment(field, start, vertices[(index + 1) % 4], flux), 0);
}
const vortex = (scale: number): Field => (x, y) => [-scale * y / (x * x + y * y), scale * x / (x * x + y * y)];
const reviewField = (params: Params): Field => (x, y) => [3 * params.q * x * x * y + params.c * y ** 3 + params.p, params.q * x ** 3 + 3 * params.c * x * y * y + params.r];
const examField = (params: Params): Field => (x, y) => [params.p * x * x - params.m * y * y, -2 * params.m * x * y + params.r * y];
const numeric = (fn: (params: Params) => number[]): Oracle => params => fn(params as Params);
function curvedFlux(params: Params, sideOnly: boolean): number {
  const curved = integrate(x => -(1 + params.k * x ** (2 * params.e)), params.c, 0);
  return sideOnly ? curved : curved + segment((_x, y) => [0, 1 + params.k * y * y], [0, 0], [params.c, 0], true);
}
function radiusAtIntersection(height: number): number {
  let lo = 0, hi = height + 1;
  for (let iteration = 0; iteration < 80; iteration++) {
    const mid = (lo + hi) / 2;
    if (2 * mid * mid < height) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}
const oracles: Record<string, Oracle> = {
  'MIT-MV-46:segment-flux': numeric(params => [segment((x, y) => [params.m * x, params.n * y], [0, 0], [params.a, params.b], true)]),
  'MIT-MV-46:circle-flux': numeric(params => [circle((x, y) => [params.k * x, params.k * y], params.a, 0, 0, 1, true)]),
  'MIT-MV-46:square-flux': numeric(params => [rectangle((x, y) => [params.m * x, params.n * y], params.a, params.b, true)]),
  'MIT-MV-46:challenge': numeric(params => [segment((x, y) => [params.p * y, params.q * x], [params.c, 0], [0, params.d], true)]),
  'MIT-MV-47:circle-integral': numeric(params => [circle(vortex(params.k), params.a)]),
  'MIT-MV-47:crossings': numeric(params => [Array.from({ length: params.u }, () => circle(vortex(1), 2)).reduce((sum, value) => sum + value, 0) + Array.from({ length: params.d }, () => circle(vortex(1), 3, 0, 0, -1)).reduce((sum, value) => sum + value, 0)]),
  'MIT-MV-47:negative-orientation': numeric(params => [circle(vortex(params.k), params.a, 0, 0, -1)]),
  'MIT-MV-47:enclose-check': numeric(params => [circle(vortex(params.k), params.a, params.cx, params.cy)]),
  'MIT-MV-47:half-plane-work': numeric(params => [segment((x, y) => [params.c / y, -params.c * x / (y * y)], [params.x1, params.y1], [params.x2, params.y2])]),
  'MIT-MV-47:challenge': numeric(params => [circle((x, y) => [-y / (x * x + y * y), x / (x * x + y * y) + params.c * x], params.s)]),
  'MIT-MV-48:polar-inertia': numeric(params => [4 * integrate(angle => integrate(radius => radius * radius * params.k * Math.abs(radius * Math.cos(angle)) * radius, 0, params.R), 0, PI / 2)]),
  'MIT-MV-48:conservative': numeric(params => {
    const atX = 1.25, atY = 0.75;
    const target = derivative(x => params.q * x ** 3, atX);
    const targetY = derivative(y => params.c * y ** 3, atY);
    return [target / atX ** 2, targetY / atY ** 2];
  }),
  'MIT-MV-48:path-value': numeric(params => [segment(reviewField(params), [0, 0], [params.s, params.t])]),
  'MIT-MV-48:line-int': numeric(params => [integrate(time => time ** params.j * time ** params.m + time ** (2 * params.j) * params.j * time ** (params.j - 1))]),
  'MIT-MV-48:green-m': numeric(params => [rectangle((_x, y) => [params.p * y * y, 0], params.a, params.b)]),
  'MIT-MV-48:flux-green': numeric(params => [curvedFlux(params, false)]),
  'MIT-MV-48:flux-side': numeric(params => [curvedFlux(params, true)]),
  'MIT-MV-48:challenge': numeric(params => [integrate(x => params.p * x * params.e * x ** (params.e - 1) - params.q * x ** params.e) + integrate(x => params.p * x - params.q * x, 1, 0)]),
  'MIT-MV-49:annulus-mass': numeric(params => [integrate(angle => integrate(radius => (radius * Math.sin(angle) / radius ** 2) * radius, params.b, params.R), 0, PI)]),
  'MIT-MV-49:conservative-q': numeric(params => [derivative(y => params.p * 1.3 ** 2 - params.m * y * y, 0.7) / 0.7]),
  'MIT-MV-49:potential-coefs': numeric(params => [integrate(x => params.p * x * x), integrate(y => -2 * params.m * y), integrate(y => params.r * y)]),
  'MIT-MV-49:path-work': numeric(params => [segment(examField(params), [params.x1, params.y1], [params.x2, params.y2])]),
  'MIT-MV-49:green-circle': numeric(params => [circle((x, y) => [params.a * x + params.b * y, params.c + params.d * Math.cos(y)], params.s)]),
  'MIT-MV-49:flux-rectangle': numeric(params => [rectangle((x, y) => [params.k * x * y + Math.sin(x) * Math.cos(y), -Math.cos(x) * Math.sin(y)], params.a, params.b, true)]),
  'MIT-MV-49:jacobian': numeric(params => {
    const origin: Pt = [0.4, 0.7];
    const map = (x: number, y: number): Pt => [params.a * x - params.b * y, params.c * x + params.d * y - 1];
    const base = map(...origin), alongX = map(origin[0] + 1, origin[1]), alongY = map(origin[0], origin[1] + 1);
    return [(alongX[0] - base[0]) * (alongY[1] - base[1]) - (alongY[0] - base[0]) * (alongX[1] - base[1])];
  }),
  'MIT-MV-49:challenge': numeric(params => {
    const inverse = (first: number, second: number): Pt => [(first + params.q * (second + 1)) / (params.p + params.q), (params.p * (second + 1) - first) / (params.p + params.q)];
    const base = inverse(0, 0), alongX = inverse(1, 0), alongY = inverse(0, 1);
    const areaScale = Math.abs((alongX[0] - base[0]) * (alongY[1] - base[1]) - (alongY[0] - base[0]) * (alongX[1] - base[1]));
    return [integrate(angle => integrate(radius => {
      const [x, y] = inverse(radius * Math.cos(angle), radius * Math.sin(angle));
      return (params.h - (params.p * x - params.q * y) ** 2 - (x + y - 1) ** 2) * radius * areaScale;
    }, 0, Math.sqrt(params.h)), 0, 2 * PI)];
  }),
  'MIT-MV-50:projection-radius': numeric(params => [radiusAtIntersection(params.c)]),
  'MIT-MV-50:paraboloid-volume': numeric(params => [integrate(angle => integrate(radius => (params.c - 2 * radius * radius) * radius, 0, radiusAtIntersection(params.c)), 0, 2 * PI)]),
  'MIT-MV-50:cylinder-mass': numeric(params => [integrate(height => integrate(angle => integrate(radius => radius ** 3, 0, params.a), 0, 2 * PI), 0, params.h)]),
  'MIT-MV-50:hemisphere-zcm': numeric(params => {
    const slice = (height: number) => integrate(angle => integrate(radius => radius, 0, Math.sqrt(Math.max(0, params.a ** 2 - height ** 2))), 0, 2 * PI);
    return [integrate(height => height * slice(height), 0, params.a) / integrate(slice, 0, params.a)];
  }),
  'MIT-MV-50:challenge': numeric(params => [integrate(angle => integrate(radius => (params.h - params.k * radius) * radius, 0, params.h / params.k), 0, 2 * PI)]),
};

describe('batch 10 independent definition-based numeric oracles', () => {
  for (const [kind, oracle] of Object.entries(oracles)) {
    it(`${kind}: 60 spread seeds`, () => {
      const gameId = kind.split(':')[0];
      const generate = batch10Generators[gameId];
      const counts = runOracle(gameId, (index, lang) => generate(spreadSeed(index), lang).filter(card => card.audit?.kind === kind), { [kind]: oracle }, SEEDS);
      expect(counts[kind]).toBe(SEEDS);
    });
  }
  it('has exactly the approved 31 audit kinds, with no unaudited numeric cards', () => {
    expect(Object.keys(oracles)).toHaveLength(31);
    for (const generate of Object.values(batch10Generators)) for (let index = 0; index < SEEDS; index++) {
      for (const card of generate(spreadSeed(index), 'en')) if (card.fields) expect(oracles[card.audit?.kind ?? ''], card.id).toBeTypeOf('function');
    }
  });
});

function evaluate(source: string, env: Record<string, number> = {}): number {
  const powers = '0123456789';
  const superscripts = '\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079';
  const text = clean(source).replace(/[\u2070\u00b9\u00b2\u00b3\u2074-\u2079]/g, symbol => `^${powers[superscripts.indexOf(symbol)]}`);
  const tokens = text.match(/sqrt|sin|cos|\d+(?:\.\d+)?|[a-z]|[\u03c0\u221a]|[-+*/^()]/g) ?? [];
  expect(tokens.join(''), source).toBe(text.replace(/\s/g, ''));
  let position = 0;
  const atom = (): number => {
    const token = tokens[position++];
    if (token === '-') return -atom();
    if (token === '+') return atom();
    if (token === '(') { const value = sum(); expect(tokens[position++], source).toBe(')'); return value; }
    if (token === 'sqrt' || token === '\u221a') return Math.sqrt(atom());
    if (token === 'sin') return Math.sin(atom());
    if (token === 'cos') return Math.cos(atom());
    if (token === '\u03c0') return PI;
    if (/^\d/.test(token ?? '')) return Number(token);
    expect(env[token], `unbound ${token} in ${source}`).toBeDefined();
    return env[token];
  };
  const power = (): number => { const value = atom(); if (tokens[position] === '^') { position++; return value ** atom(); } return value; };
  const product = (): number => {
    let value = power();
    while (position < tokens.length && !['+', '-', ')'].includes(tokens[position])) {
      const operator = tokens[position];
      if (operator === '*' || operator === '/') position++;
      const next = power();
      value = operator === '/' ? value / next : value * next;
    }
    return value;
  };
  const sum = (): number => {
    let value = product();
    while (tokens[position] === '+' || tokens[position] === '-') {
      const operator = tokens[position++], next = product();
      value += operator === '+' ? next : -next;
    }
    return value;
  };
  const result = sum();
  expect(position, source).toBe(tokens.length);
  return result;
}
const compact = (source: string) => clean(source).replace(/[\s*]/g, '');
const coeff = (value: number, variable: string) => value === 1 ? variable : value === -1 ? `-${variable}` : `${value}${variable}`;
const pow = (variable: string, exponent: number) => exponent === 1 ? variable : `${variable}${'\u2070\u00b9\u00b2\u00b3\u2074\u2075\u2076\u2077\u2078\u2079'[exponent]}`;
const matched = (source: string, pattern: RegExp): RegExpMatchArray => {
  const result = clean(source).match(pattern);
  expect(result, `Expected ${pattern} in ${source}`).not.toBeNull();
  return result!;
};
const printedRadius = (card: PracticeCard) => Number(matched(card.prompt, /radius (\d+)/)[1]);
function printedParameters(card: PracticeCard): void {
  const params = card.audit!.params as Params, kind = card.audit!.kind;
  const text = compact([card.prompt, ...(card.lines ?? [])].join(' '));
  const contains = (part: string) => expect(text, `${kind} ${JSON.stringify(params)} missing ${part}`).toContain(compact(part));
  const vector = (first: string, second: string) => contains(`(${first},${second})`);
  if (kind === 'MIT-MV-47:negative-orientation') {
    expect(/counterclockwise/i.test(card.prompt), kind).toBe(false);
    expect(/clockwise/i.test(card.prompt), kind).toBe(true);
  } else if (['MIT-MV-46:circle-flux', 'MIT-MV-46:square-flux', 'MIT-MV-47:circle-integral', 'MIT-MV-47:enclose-check', 'MIT-MV-47:challenge', 'MIT-MV-48:green-m', 'MIT-MV-48:flux-green', 'MIT-MV-48:challenge', 'MIT-MV-49:green-circle', 'MIT-MV-49:flux-rectangle'].includes(kind)) {
    expect(/counterclockwise/i.test(card.prompt), `${kind}: printed positive orientation`).toBe(true);
  }
  if (kind.startsWith('MIT-MV-46:') && !kind.endsWith('circle-flux') && !kind.endsWith('square-flux')) expect(/turned clockwise by 90/.test(card.prompt), `${kind}: normal convention`).toBe(true);
  const rectangleBounds = () => {
    if (kind === 'MIT-MV-46:square-flux') { vector(`${params.a}`, '0'); vector(`${params.a}`, `${params.b}`); vector('0', `${params.b}`); }
    else { contains(`0\u2264x\u2264${params.a}`); contains(`0\u2264y\u2264${params.b}`); }
  };
  const reviewComponents = (unknown = false) => {
    contains(`(${unknown ? 'ax\u00b2y' : coeff(3 * params.q, 'x\u00b2y')}+${coeff(params.c, 'y\u00b3')}+${params.p})i`);
    contains(`(${coeff(params.q, 'x\u00b3')}+${unknown ? 'bxy\u00b2' : coeff(3 * params.c, 'xy\u00b2')}+${params.r})j`);
  };
  const examComponents = (unknown = false) => {
    contains(`(${coeff(params.p, 'x\u00b2')}-${coeff(params.m, 'y\u00b2')})i`);
    contains(`(${unknown ? 'qxy' : coeff(-2 * params.m, 'xy')}+${coeff(params.r, 'y')})j`);
  };
  switch (kind) {
    case 'MIT-MV-46:segment-flux': vector(coeff(params.m, 'x'), coeff(params.n, 'y')); vector(`${params.a}`, `${params.b}`); contains('from(0,0)to'); break;
    case 'MIT-MV-46:circle-flux': contains(`F=${params.k === 1 ? '' : params.k}(x,y)`); contains(`radius${params.a}`); break;
    case 'MIT-MV-46:square-flux': vector(coeff(params.m, 'x'), coeff(params.n, 'y')); rectangleBounds(); break;
    case 'MIT-MV-46:challenge': contains(`(${coeff(params.p, 'y')})i`); contains(`(${coeff(params.q, 'x')})j`); contains(`from(${params.c},0)to(0,${params.d})`); break;
    case 'MIT-MV-47:circle-integral': case 'MIT-MV-47:negative-orientation': case 'MIT-MV-47:enclose-check':
      contains(`F=${params.k === 1 ? '' : params.k}(-y,x)/(x\u00b2+y\u00b2)`); contains(`radius${params.a}`);
      if (kind.endsWith('enclose-check')) vector(`${params.cx}`, `${params.cy}`);
      break;
    case 'MIT-MV-47:crossings': contains(`exactly${params.u}time${params.u === 1 ? '' : 's'}frombelowtoabove`); contains(params.d === 0 ? 'neverfromabovetobelow' : `exactly${params.d}time${params.d === 1 ? '' : 's'}fromabovetobelow`); break;
    case 'MIT-MV-47:half-plane-work': contains(`(${params.c}/y)i`); contains(`(${coeff(params.c, 'x')}/y\u00b2)j`); contains(`A=(${params.x1},${params.y1})`); contains(`B=(${params.x2},${params.y2})`); break;
    case 'MIT-MV-47:challenge': contains(`x/(x\u00b2+y\u00b2)${params.c > 0 ? '+' : ''}${coeff(params.c, 'x')}`); contains(`radius${params.s}`); break;
    case 'MIT-MV-48:polar-inertia': contains(`radius${params.R}`); expect(text.includes(`\u03b4=${params.k === 1 ? '' : params.k}|x|`) || text.includes(`\u03b4=${params.k === 1 ? '' : params.k}|y|`)).toBe(true); break;
    case 'MIT-MV-48:conservative': reviewComponents(true); break;
    case 'MIT-MV-48:path-value': reviewComponents(); vector(`${params.s}`, `${params.t}`); break;
    case 'MIT-MV-48:line-int': contains(`${pow('x', params.m)}yi`); contains(`y=${pow('x', params.j)}`); break;
    case 'MIT-MV-48:green-m': rectangleBounds(); contains(`M(x,y)=${coeff(params.p, 'y\u00b2')}`); break;
    case 'MIT-MV-48:flux-green': case 'MIT-MV-48:flux-side': contains(`x=${params.c}`); contains(`y=${pow('x', params.e)}`); contains(`F=(1+${coeff(params.k, 'y\u00b2')})j`); break;
    case 'MIT-MV-48:challenge': contains(`y=${pow('x', params.e)}`); contains(`(${coeff(params.p, 'x')})i`); contains(`(${coeff(params.q, 'y')})j`); break;
    case 'MIT-MV-49:annulus-mass': contains(`${params.b}\u00b2<x\u00b2+y\u00b2<${params.R}\u00b2`); break;
    case 'MIT-MV-49:conservative-q': examComponents(true); break;
    case 'MIT-MV-49:potential-coefs': examComponents(); break;
    case 'MIT-MV-49:path-work': examComponents(); contains(`A=(${params.x1},${params.y1})`); contains(`B=(${params.x2},${params.y2})`); break;
    case 'MIT-MV-49:green-circle': contains(`radius${params.s}`); contains(`(${coeff(params.a, 'x')}${params.b > 0 ? '+' : ''}${coeff(params.b, 'y')})i`); contains(`(${params.c}+${params.d === 1 ? '' : params.d}cosy)j`); break;
    case 'MIT-MV-49:flux-rectangle': rectangleBounds(); contains(`(${coeff(params.k, 'xy')}+sinxcosy)i`); break;
    case 'MIT-MV-49:jacobian': contains(`u=${coeff(params.a, 'x')}-${coeff(params.b, 'y')}`); contains(`v=${coeff(params.c, 'x')}+${coeff(params.d, 'y')}-1`); break;
    case 'MIT-MV-49:challenge': {
      contains(`z=${params.h}`); contains(`(${coeff(params.p, 'x')}-${coeff(params.q, 'y')})\u00b2`);
      const surface = matched(card.prompt, /surface z = (.*?)\./)[1];
      for (const [x, y] of [[0.4, 0.7], [1.3, -0.2]]) {
        expect(evaluate(surface, { x, y }), `${card.id}: printed surface agrees with audited coordinate map at (${x},${y})`).toBeCloseTo((params.p * x - params.q * y) ** 2 + (x + y - 1) ** 2, 10);
      }
      break;
    }
    case 'MIT-MV-50:projection-radius': case 'MIT-MV-50:paraboloid-volume': contains(`z=${params.c}-x\u00b2-y\u00b2`); break;
    case 'MIT-MV-50:cylinder-mass': contains(`x\u00b2+y\u00b2\u2264${params.a}\u00b2`); contains(`0\u2264z\u2264${params.h}`); break;
    case 'MIT-MV-50:hemisphere-zcm': contains(`x\u00b2+y\u00b2+z\u00b2\u2264${params.a}\u00b2`); break;
    case 'MIT-MV-50:challenge': contains(`z=${coeff(params.k, 'r')}`); contains(`z=${params.h}`); break;
    default: throw new Error(`Unbound printed parameters: ${kind}`);
  }
}
function rational(value: number): string {
  for (let denominator = 1; denominator <= 10000; denominator++) {
    const numerator = Math.round(value * denominator);
    if (Math.abs(value - numerator / denominator) < 2e-10) return `${numerator}/${denominator}`;
  }
  throw new Error(`Not a small exact rational: ${value}`);
}
function exactInputs(card: PracticeCard, values: number[]): string[] {
  const kind = card.audit!.kind;
  if (kind === 'MIT-MV-50:projection-radius') return [`sqrt(${(card.audit!.params as Params).c / 2})`];
  const usesPi = /circle|crossings|negative-orientation|enclose-check|green-circle|paraboloid-volume|cylinder-mass/.test(kind) || ['MIT-MV-47:challenge', 'MIT-MV-49:challenge', 'MIT-MV-50:challenge'].includes(kind);
  return values.map(value => {
    if (!usesPi) return rational(value);
    const [numerator, denominator] = rational(value / PI).split('/');
    return `${numerator}pi/${denominator}`;
  });
}
function fieldFromText(source: string): Field {
  const vector = clean(source).match(/F = (\d+)?\(([^,)]+),\s*([^,)]+)\)(?:\/(\([^;)]+\)))?(?:[.;]|$)/);
  if (vector) return (x, y) => {
    const env = { x, y }, scale = Number(vector[1] ?? 1), denominator = vector[4] ? evaluate(vector[4], env) : 1;
    return [scale * evaluate(vector[2], env) / denominator, scale * evaluate(vector[3], env) / denominator];
  };
  const parts = matched(source, /F = (.+?) i\s*([+-])\s*(.+?) j(?:[.;]| is|,)/);
  return (x, y) => [evaluate(parts[1], { x, y }), (parts[2] === '-' ? -1 : 1) * evaluate(parts[3], { x, y })];
}
const triangleSpec = (card: PracticeCard): [number, number, number] => {
  const result = matched(card.prompt, /\u222b\u2080\^(\d+)\s*\u222b_\{(.*?)\}\^\{(.*?)\}/);
  return [Number(result[1]), evaluate(result[2], { x: 1 }), evaluate(result[3], { x: 1 })];
};
function choiceVerdicts(card: PracticeCard): boolean[] {
  const options = card.choice!.options, slug = card.id.slice(10);
  const prompt = clean(card.prompt);
  switch (slug) {
    case 'flux-identity': return options.map(option => {
      const expression = compact(option).replace(/^.*C/, '');
      const env = { M: 2, N: 5, dx: 3, dy: 7 };
      const terms = expression.match(/([+-]?)([MN])d([xy])/g) ?? [];
      const value = terms.reduce((sum, term) => { const parts = term.match(/([+-]?)([MN])d([xy])/)!; return sum + (parts[1] === '-' ? -1 : 1) * env[parts[2] as 'M' | 'N'] * env[`d${parts[3]}` as 'dx' | 'dy']; }, 0);
      return value === 2 * 7 - 5 * 3;
    });
    case 'normal-direction': {
      const point = matched(prompt, /P = \((-?\d+), (-?\d+)\)/), radius = printedRadius(card), sign = /counterclockwise/i.test(prompt) ? 1 : -1;
      return options.map(option => { const normal = matched(option, /\((-?\d+), (-?\d+)\)/); return Number(normal[1]) === sign * Number(point[1]) / radius && Number(normal[2]) === sign * Number(point[2]) / radius; });
    }
    case 'tangential-zero': return options.map(option => Math.abs(circle(fieldFromText(option), printedRadius(card), 0, 0, 1, true)) < 1e-8);
    case 'clockwise-sign': { const expected = circle(fieldFromText(`${card.prompt.split('. C')[0]}.`), printedRadius(card), 0, 0, -1, true); return options.map(option => Math.abs(evaluate(option) - expected) < 1e-8); }
    case 'assumption-fails': return options.map(option => /not defined at the origin/.test(option) && /inside C/.test(option) && /does not apply/.test(option));
    case 'exactness-region': return options.map(option => prompt.includes('/y)') ? /Everywhere it is defined:.*y > 0.*y < 0/.test(option) : /half-plane x > 0:.*simply connected/.test(option));
    case 'check-conservative': {
      const field = fieldFromText(prompt), straight = segment(field, [0, 0], [1, 1]);
      const curved = integrate(time => { const [first, second] = field(time, time * time); return first + second * 2 * time; });
      const equal = Math.abs(straight - curved) < 1e-8;
      return options.map(option => equal ? /^Yes: M_y = N_x/.test(option) : /^No: M_y \u2260 N_x/.test(option));
    }
    case 'jacobian': {
      const map = matched(prompt, /u = (.*?) and v = (.*?)\./), x = 1.4, y = 0.8;
      const first = (xx: number, yy: number) => evaluate(map[1], { x: xx, y: yy }), second = (xx: number, yy: number) => evaluate(map[2], { x: xx, y: yy });
      const diff = (fn: (xx: number, yy: number) => number, axis: 'x' | 'y') => { const step = 1e-4; const small = (size: number) => axis === 'x' ? (fn(x + size, y) - fn(x - size, y)) / (2 * size) : (fn(x, y + size) - fn(x, y - size)) / (2 * size); return (4 * small(step) - small(2 * step)) / 3; };
      const determinant = Math.abs(diff(first, 'x') * diff(second, 'y') - diff(first, 'y') * diff(second, 'x'));
      return options.map(option => Math.abs(evaluate(option === 'dx dy = du dv' ? '1' : matched(option, /dx dy = (.*?) du dv/)[1], { u: first(x, y), v: second(x, y) }) - 1 / determinant) < 1e-8);
    }
    case 'region-picture': {
      const [limit, lower, upper] = triangleSpec(card);
      return options.map(option => { const vertices = [...clean(option).matchAll(/\(([\d.]+), ([\d.]+)\)/g)].map(match => [Number(match[1]), Number(match[2])]); return vertices.length === 3 && vertices.every(([x, y]) => x >= 0 && x <= limit && y >= lower * x && y <= upper * x) && Math.abs(Math.abs(vertices[1][0] * vertices[2][1] - vertices[2][0] * vertices[1][1]) / 2 - integrate(x => (upper - lower) * x, 0, limit)) < 1e-8; });
    }
    case 'com-symmetry': return options.map(option => [0.4, 1.2, 2.1].every(x => Math.abs(evaluate(option.replace(/^.*= /, ''), { x, y: 1.3 }) - evaluate(option.replace(/^.*= /, ''), { x: -x, y: 1.3 })) < 1e-8));
    case 'flux-missing-edge': {
      const field = fieldFromText(prompt), height = Number(matched(prompt, /0 \u2264 y \u2264 (\d+)/)[1]);
      const edge = segment(field, [0, height], [0, 0], true);
      return options.map(option => edge < -1e-8 ? /^More.*negative/.test(option) : edge > 1e-8 ? /^Less.*positive/.test(option) : /^Equal.*C\u2084 is 0/.test(option));
    }
    case 'limits-recipe': {
      const height = Number(matched(prompt, /x \+ y \+ z = (\d+)/)[1]), firstVariable = matched(prompt, /so ([xyz]) comes first/)[1];
      return options.map(option => {
        const bounds = clean(option).match(/^([xyz]) from 0 to (.*?);.*triangle ([xyz]) \u2265 0, ([xyz]) \u2265 0, ([xyz]) \+ ([xyz]) \u2264 (\d+)/);
        if (!bounds || bounds[1] !== firstVariable || bounds[3] === bounds[4] || bounds[3] === firstVariable || bounds[4] === firstVariable || bounds[5] !== bounds[3] || bounds[6] !== bounds[4] || Number(bounds[7]) !== height) return false;
        return [[0.17, 0.23], [0.51, 0.13], [0.09, 0.71]].every(([first, second]) => Math.abs(evaluate(bounds[2], { [bounds[3]]: first * height, [bounds[4]]: second * height }) - height * (1 - first - second)) < 1e-8);
      });
    }
    case 'choose-coords': { const planar = /tetrahedron|box/.test(prompt); return options.map(option => planar ? /^Rectangular coordinates:/.test(option) : /^Cylindrical coordinates: the solid is symmetric/.test(option)); }
    default: throw new Error(`No choice predicate for ${card.id}`);
  }
}
function differentialToken(source: string): number {
  const values: Record<string, number> = { M_x: 2, M_y: 3, N_x: 5, N_y: 7, P_x: 2, P_y: 3, Q_x: 5, Q_y: 7 };
  const token = clean(source).replace(/\u2202([MNPQ])\/\u2202([xy])/g, '$1_$2');
  if (token === 'div F') return 2 + 7;
  if (token === 'curl F') return 5 - 3;
  let total = 0;
  for (const match of token.matchAll(/([+-]?)\s*([MNPQ]_[xy])/g)) total += (match[1] === '-' ? -1 : 1) * values[match[2]];
  expect(token.replace(/[MNPQ]_[xy]|[+\s-]/g, ''), source).toBe('');
  return total;
}
function verifySlots(card: PracticeCard, deck: PracticeCard[]): void {
  const answers = card.slots!.answers, slug = card.id.slice(10), prompt = clean(card.prompt);
  const value = (index: number, env: Record<string, number> = {}) => evaluate(answers[index], env);
  switch (slug) {
    case 'normal-form': expect(differentialToken(answers[0])).toBe(9); break;
    case 'extended-setup': {
      const sign = clean(answers[0]) === '-' ? -1 : clean(answers[0]) === '+' ? 1 : NaN;
      const density = differentialToken(answers[1]);
      const field: Field = (x, y) => [2 * x + 3 * y, 5 * x + 7 * y];
      expect(Math.abs(circle(field, 2) + sign * circle(field, 1) - density * integrate(radius => 2 * PI * radius, 1, 2))).toBeLessThan(1e-8);
      break;
    }
    case 'com-setup': {
      const vertices = [...prompt.matchAll(/\((-?\d+), (-?\d+)\)/g)], halfWidth = Math.abs(Number(vertices[0][1])), height = Number(vertices[1][2]);
      expect(value(0)).toBe(0); expect(value(1)).toBe(height);
      for (const fraction of [0.13, 0.41, 0.79]) { const y = fraction * height; expect(value(2, { y })).toBeCloseTo(-halfWidth * (1 - fraction), 10); expect(value(3, { y })).toBeCloseTo(halfWidth * (1 - fraction), 10); }
      break;
    }
    case 'potential': {
      const params = deck.find(other => other.audit?.kind === 'MIT-MV-48:conservative')!.audit!.params as Params;
      const potential = (x: number, y: number) => answers.reduce((sum, token) => sum + evaluate(token, { x, y }), 0);
      for (const [x, y] of [[0.4, 1.2], [1.7, -0.8]]) {
        const terms = [integrate(xx => 3 * params.q * xx * xx * y, 0, x), integrate(yy => 3 * params.c * x * yy * yy, 0, y), integrate(() => params.p, 0, x), integrate(() => params.r, 0, y)];
        answers.forEach((token, termIndex) => expect(evaluate(token, { x, y }), `${card.id}: ordered term ${termIndex}`).toBeCloseTo(terms[termIndex], 9));
        const diff = (axis: 'x' | 'y', step: number) => axis === 'x' ? (potential(x + step, y) - potential(x - step, y)) / (2 * step) : (potential(x, y + step) - potential(x, y - step)) / (2 * step);
        const expected = reviewField(params)(x, y);
        for (const [index, axis] of (['x', 'y'] as const).entries()) expect((4 * diff(axis, 0.0625) - diff(axis, 0.125)) / 3).toBeCloseTo(expected[index], 9);
      }
      break;
    }
    case 'swap-limits': {
      const [limit, lower, upper] = triangleSpec(card), firstTop = value(0), secondTop = value(3);
      expect(firstTop).toBeCloseTo(lower * limit, 10); expect(secondTop).toBeCloseTo(upper * limit, 10);
      for (const fraction of [0.17, 0.43, 0.81]) {
        const firstY = fraction * firstTop, secondY = firstTop + fraction * (secondTop - firstTop);
        expect(value(1, { y: firstY })).toBeCloseTo(firstY / upper, 10); expect(value(2, { y: firstY })).toBeCloseTo(firstY / lower, 10);
        expect(value(4, { y: secondY })).toBeCloseTo(secondY / upper, 10); expect(value(5, { y: secondY })).toBeCloseTo(limit, 10);
      }
      break;
    }
    case 'cyl-setup': {
      const height = Number(matched(prompt, /z = (\d+) - x/)[1]), radius = value(0);
      expect(2 * radius * radius).toBeCloseTo(height, 10);
      for (const fraction of [0.19, 0.53, 0.87]) { const r = fraction * radius; expect(value(1, { r })).toBeCloseTo(r * r, 10); expect(value(2, { r })).toBeCloseTo(height - r * r, 10); expect(value(3, { r })).toBeCloseTo(r, 10); }
      break;
    }
    case 'plane-paraboloid-setup': {
      const plane = matched(prompt, /(?:plane|平面) z = (.*?)(?: and above| 之下)/)[1], height = evaluate(plane, { y: 1 });
      expect(value(0)).toBe(height);
      for (const fraction of [0.17, 0.43, 0.81]) {
        const y = fraction * height, lo = value(1, { y }), hi = value(2, { y });
        expect(lo).toBeLessThan(0); expect(hi).toBeGreaterThan(0); expect(lo * lo + y * y).toBeCloseTo(height * y, 10); expect(hi * hi + y * y).toBeCloseTo(height * y, 10);
        const x = hi / 3; expect(value(3, { x, y })).toBeCloseTo(x * x + y * y, 10); expect(value(4, { x, y })).toBeCloseTo(height * y, 10);
      }
      break;
    }
    default: throw new Error(`No evaluated slot check for ${card.id}`);
  }
}

function filledSlots(card: PracticeCard): string {
  const slots = card.slots!;
  expect(slots.between ?? [], `${card.id}: separator count`).toHaveLength(Math.max(0, slots.answers.length - 1));
  return slots.before + slots.answers.map((answer, index) => answer + (index < slots.answers.length - 1 ? slots.between?.[index] ?? '' : slots.after ?? '')).join('');
}

describe('batch 10 Task C exactness and determinant explanation regressions', () => {
  it('MV47 uses a sufficient criterion and the sampled potential coefficient', () => {
    const coefficients = new Set<number>();
    for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
      const card = batch10Generators['MIT-MV-47'](spreadSeed(index), lang).find(other => other.id.endsWith('-exactness-region'))!;
      expect(card.hint).toContain(lang === 'en' ? 'sufficient' : '充分条件');
      expect(card.hint).toContain(lang === 'en' ? 'not necessary' : '不是必要条件');
      expect(card.explanation).not.toContain('c·arctan');
      if (card.explanation.includes('arctan')) {
        const coefficient = Number(matched(card.prompt, /F = (\d*)\(?-y, x\)?/)[1] || 1);
        coefficients.add(coefficient);
        expect(card.explanation).toContain(`${coefficient}·arctan(y/x)`);
      }
    }
    expect([...coefficients].sort()).toEqual([1, 2, 3]);
  });
  it('MV48 assembles complete COM bounds without changing answer tokens', () => {
    for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
      const deck = batch10Generators['MIT-MV-48'](spreadSeed(index), lang);
      const card = deck.find(other => other.id.endsWith('-com-setup'))!, answers = card.slots!.answers;
      expect(filledSlots(card)).toBe(`∫_{y = ${answers[0]}}^{${answers[1]}} ∫_{x = ${answers[2]}}^{${answers[3]}} y dx dy`);
      verifySlots(card, deck);
    }
  });
  it('MV48 derivative labels and signed determinant match both printed maps', () => {
    const signs = new Set<number>();
    const slope = (fn: (value: number) => number, at: number) => {
      const difference = (step: number) => (fn(at + step) - fn(at - step)) / (2 * step);
      return (4 * difference(0.0001) - difference(0.0002)) / 3;
    };
    for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
      const card = batch10Generators['MIT-MV-48'](spreadSeed(index), lang).find(other => other.id.endsWith('-jacobian'))!;
      const map = matched(card.prompt, /u = (.*?)(?: and v = |，v = )(.*?)[.。]/);
      const u = (x: number, y: number) => evaluate(map[1], { x, y });
      const v = (x: number, y: number) => evaluate(map[2], { x, y });
      const labels = ['u_x', 'u_y', 'v_x', 'v_y'];
      const expressions = labels.map(label => matched(card.explanation, new RegExp(`${label} = (.*?)(?:,|，)`))[1]);
      for (const [x, y] of [[1.3, 0.7], [0.8, 1.6]]) {
        const expected = [slope(xx => u(xx, y), x), slope(yy => u(x, yy), y), slope(xx => v(xx, y), x), slope(yy => v(x, yy), y)];
        expressions.forEach((expression, position) => {
          const negative = clean(expression).startsWith('-');
          const value = (negative ? -1 : 1) * evaluate(negative ? clean(expression).slice(1) : expression, { x, y });
          expect(value).toBeCloseTo(expected[position], 9);
        });
        const determinant = expected[0] * expected[3] - expected[1] * expected[2];
        signs.add(Math.sign(determinant));
        const signed = matched(card.explanation, / = (-?\d+[uv])[.。]/)[1];
        expect(evaluate(signed, { u: u(x, y), v: v(x, y) })).toBeCloseTo(determinant, 9);
        const option = matched(card.choice!.options[card.choice!.answer], /dx dy = (.*?) du dv/)[1];
        expect(evaluate(option, { u: u(x, y), v: v(x, y) })).toBeCloseTo(1 / Math.abs(determinant), 9);
      }
    }
    expect([...signs].sort()).toEqual([-1, 1]);
  });
});

describe('batch 10 Task C complete widgets, projections and rounded results', () => {
  for (const [game, slug] of [['49', 'swap-limits'], ['50', 'cyl-setup'], ['50', 'plane-paraboloid-setup']]) {
    it(`MV${game} ${slug}: filled syntax and mathematical bounds in EN/ZH`, () => {
      for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
        const deck = batch10Generators[`MIT-MV-${game}`](spreadSeed(index), lang);
        const card = deck.find(other => other.id.endsWith(`-${slug}`))!, answers = card.slots!.answers;
        const expected = slug === 'swap-limits'
          ? `∫_{y=0}^{${answers[0]}} ∫_{x=${answers[1]}}^{${answers[2]}} dx dy + ∫_{y=${answers[0]}}^{${answers[3]}} ∫_{x=${answers[4]}}^{${answers[5]}} dx dy`
          : slug === 'cyl-setup'
            ? `∫_{θ=0}^{2π} ∫_{r=0}^{${answers[0]}} ∫_{z=${answers[1]}}^{${answers[2]}} ${answers[3]} dz dr dθ`
            : `∫_{y=0}^{${answers[0]}} ∫_{x=${answers[1]}}^{${answers[2]}} ∫_{z=${answers[3]}}^{${answers[4]}} dz dx dy`;
        expect(filledSlots(card)).toBe(expected);
        verifySlots(card, deck);
      }
    });
  }
  it('MV50 fits each tetrahedron and labels its actual projected coordinate edges', () => {
    let scenarios = 0;
    for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
      const deck = batch10Generators['MIT-MV-50'](spreadSeed(index), lang);
      for (const card of deck.filter(other => other.id.endsWith('-limits-recipe') || other.id.endsWith('-choose-coords') && other.figure)) {
        const figure = card.figure!, view = figure.view;
        if (card.id.endsWith('-choose-coords')) scenarios++;
        expect(figure.axes).toBeUndefined();
        const size = Number(matched(card.prompt, /x \+ y \+ z = (\d+)/)[1]);
        const endpoints: Record<string, Pt> = { x: [-0.45 * size, -0.3 * size], y: [size, 0], z: [0, size] };
        const edges = figure.shapes.filter(shape => shape.kind === 'line');
        expect(edges).toHaveLength(6);
        expect(figure.shapes.filter(shape => shape.kind === 'point')).toHaveLength(4);
        for (const [axis, end] of Object.entries(endpoints)) {
          const edge = edges.find(shape => shape.label === axis)!;
          expect(edge).toBeDefined();
          expect(edge.points).toEqual([[0, 0], end]);
        }
        for (const shape of figure.shapes) {
          const points = shape.kind === 'line' || shape.kind === 'area' ? shape.points : shape.kind === 'arrow' ? [shape.from, shape.to] : [shape.at];
          for (const [x, y] of points) {
            expect(x).toBeGreaterThan(view.xmin); expect(x).toBeLessThan(view.xmax);
            expect(y).toBeGreaterThan(view.ymin); expect(y).toBeLessThan(view.ymax);
          }
        }
      }
    }
    expect(scenarios).toBeGreaterThan(0);
  });
  it('marks rounded final values and flux-side intermediates as approximations in EN/ZH', () => {
    const kinds = ['MIT-MV-46:circle-flux', 'MIT-MV-48:line-int', 'MIT-MV-48:flux-green', 'MIT-MV-48:flux-side', 'MIT-MV-48:challenge', 'MIT-MV-49:challenge', 'MIT-MV-50:cylinder-mass', 'MIT-MV-50:challenge'];
    for (const kind of kinds) for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
      const card = batch10Generators[kind.split(':')[0]](spreadSeed(index), lang).find(other => other.audit?.kind === kind)!;
      const value = String(Number(card.fields![0].answer.toFixed(6)));
      expect(card.explanation).toContain(`≈ ${value}`);
      expect(card.explanation).not.toContain(`= ${value}${lang === 'en' ? '.' : '。'}`);
      if (kind === 'MIT-MV-48:flux-side') expect(card.explanation.match(/≈/g)).toHaveLength(3);
    }
  });
});

describe('batch 10 printed parameters and exact grading', () => {
  for (const kind of Object.keys(oracles)) it(`${kind}: parameters in their roles and exact/wrong grading`, () => {
    const generate = batch10Generators[kind.split(':')[0]];
    for (let index = 0; index < SEEDS; index++) {
      const card = generate(spreadSeed(index), 'en').find(other => other.audit?.kind === kind)!;
      printedParameters(card);
      const values = oracles[kind](card.audit!.params) as number[];
      const inputs = exactInputs(card, values);
      inputs.forEach((input, fieldIndex) => expect(Math.abs(parseGameNumber(input)! - values[fieldIndex])).toBeLessThan(1e-8));
      expect(gradeCard(card, inputs, null, []), `${card.id} seed ${spreadSeed(index)} exact ${inputs}`).toBe('correct');
      for (let fieldIndex = 0; fieldIndex < values.length; fieldIndex++) for (const offset of [-10, 10]) {
        const wrong = [...inputs]; wrong[fieldIndex] = String(values[fieldIndex] + offset);
        expect(gradeCard(card, wrong, null, []), card.id).toBe('incorrect');
      }
      const other = generate(spreadSeed(index), 'zh').find(other => other.id === card.id)!;
      expect(other.audit).toEqual(card.audit);
      if (kind === 'MIT-MV-46:circle-flux') {
        const radius = Number(matched(other.prompt, /半径为 (\d+)/)[1]);
        expect(radius, `${card.id}: Chinese printed radius agrees with audited circle`).toBe((card.audit!.params as Params).a);
      }
      expect(gradeCard(other, inputs, null, []), `${card.id} Chinese exact grading`).toBe('correct');
    }
  });
});
describe('batch 10 non-audit content', () => {
  for (const [gameId, generate] of Object.entries(batch10Generators)) {
    it(`${gameId}: exactly one mathematically correct choice over 60 seeds`, () => {
      for (let index = 0; index < SEEDS; index++) for (const card of generate(spreadSeed(index), 'en')) if (card.choice) {
        const verdicts = choiceVerdicts(card);
        expect(verdicts.filter(Boolean), `${card.id} ${card.prompt}`).toHaveLength(1);
        expect(verdicts[card.choice.answer], `${card.id} marked wrong content`).toBe(true);
        verdicts.forEach((correct, option) => expect(gradeCard(card, [], option, [])).toBe(correct ? 'correct' : 'incorrect'));
      }
    });
    it(`${gameId}: symbol answers evaluated as mathematics over 60 seeds`, () => {
      for (let index = 0; index < SEEDS; index++) {
        const deck = generate(spreadSeed(index), 'en');
        for (const card of deck) if (card.slots) verifySlots(card, deck);
      }
    });
  }
});

function pointInPolygon(point: Pt, vertices: Pt[]): boolean {
  let inside = false;
  for (let index = 0, previous = vertices.length - 1; index < vertices.length; previous = index++) {
    const [x, y] = vertices[index], [px, py] = vertices[previous];
    if ((y > point[1]) !== (py > point[1]) && point[0] < (px - x) * (point[1] - y) / (py - y) + x) inside = !inside;
  }
  return inside;
}
function verifyRegion(figure: Figure, inside: (x: number, y: number) => boolean, box: [number, number, number, number], where: string): void {
  const polygons = figure.shapes.filter(shape => shape.kind === 'area');
  expect(polygons.length, `${where}: missing filled region`).toBeGreaterThan(0);
  for (let horizontal = 0; horizontal < 13; horizontal++) for (let vertical = 0; vertical < 11; vertical++) {
    const x = box[0] + (horizontal + 0.371) / 13 * (box[1] - box[0]);
    const y = box[2] + (vertical + 0.613) / 11 * (box[3] - box[2]);
    const probes = [[x, y], [x + 0.004 * (box[1] - box[0]), y], [x - 0.004 * (box[1] - box[0]), y], [x, y + 0.004 * (box[3] - box[2])], [x, y - 0.004 * (box[3] - box[2])]];
    const expected = inside(x, y);
    if (!probes.every(([px, py]) => inside(px, py) === expected)) continue;
    expect(polygons.some(shape => pointInPolygon([x, y], shape.points)), `${where}: region at (${x},${y})`).toBe(expected);
  }
}
function verifyFigure(card: PracticeCard): void {
  const figure = card.figure!, slug = card.id.slice(10), gameId = card.id.slice(0, 9), params = (card.audit?.params ?? {}) as Params;
  const lines = figure.shapes.filter(shape => shape.kind === 'line'), arrows = figure.shapes.filter(shape => shape.kind === 'arrow');
  const near = (actual: number, expected: number, message = '') => expect(Math.abs(actual - expected), `${card.id} ${message}: ${actual} vs ${expected}`).toBeLessThan(1e-8);
  const curve = (predicate: (point: Pt) => boolean) => {
    expect(lines.length, card.id).toBeGreaterThan(0);
    for (const line of lines) for (const point of line.points) expect(predicate(point), `${card.id} curve point ${point}`).toBe(true);
  };
  const circleGeometry = (radius: number, cx = 0, cy = 0, direction = 1) => {
    curve(([x, y]) => Math.abs((x - cx) ** 2 + (y - cy) ** 2 - radius ** 2) < 1e-8);
    expect(arrows.length, `${card.id}: missing travel arrow`).toBeGreaterThan(0);
    for (const arrow of arrows) {
      const midpoint: Pt = [(arrow.from[0] + arrow.to[0]) / 2 - cx, (arrow.from[1] + arrow.to[1]) / 2 - cy];
      const dx = arrow.to[0] - arrow.from[0], dy = arrow.to[1] - arrow.from[1];
      expect(direction * (midpoint[0] * dy - midpoint[1] * dx), `${card.id}: reversed travel`).toBeGreaterThan(0);
      const radialAtStart = (arrow.from[0] - cx) * dx + (arrow.from[1] - cy) * dy;
      expect(Math.min(Math.abs(midpoint[0] * dx + midpoint[1] * dy), Math.abs(radialAtStart)), `${card.id}: travel must be tangent at glyph anchor`).toBeLessThan(1e-8);
      expect(Math.abs(Math.hypot(...midpoint) - radius), `${card.id}: travel arrow detached`).toBeLessThan(radius * 0.06 + 0.02);
    }
  };
  const rectangleGeometry = (width: number, height: number, normals: boolean) => {
    curve(([x, y]) => x >= -1e-8 && x <= width + 1e-8 && y >= -1e-8 && y <= height + 1e-8 && (Math.abs(x) < 1e-8 || Math.abs(x - width) < 1e-8 || Math.abs(y) < 1e-8 || Math.abs(y - height) < 1e-8));
    const vertices = lines.flatMap(line => line.points);
    for (const corner of [[0, 0], [width, 0], [width, height], [0, height]]) expect(vertices.some(point => Math.hypot(point[0] - corner[0], point[1] - corner[1]) < 1e-8), `${card.id}: missing corner ${corner}`).toBe(true);
    if (figure.shapes.some(shape => shape.kind === 'area')) verifyRegion(figure, (x, y) => x >= 0 && x <= width && y >= 0 && y <= height, [-0.2 * width, 1.2 * width, -0.2 * height, 1.2 * height], card.id);
    for (const arrow of arrows) {
      const [x, y] = arrow.from, dx = arrow.to[0] - x, dy = arrow.to[1] - y;
      const outward: Pt = Math.abs(y) < 1e-8 ? [0, -1] : Math.abs(x - width) < 1e-8 ? [1, 0] : Math.abs(y - height) < 1e-8 ? [0, 1] : [-1, 0];
      const expected: Pt = normals ? outward : [-outward[1], outward[0]];
      near(dx * expected[1] - dy * expected[0], 0, `arrow at ${arrow.from} must be ${normals ? 'normal' : 'ccw tangent'}`);
      expect(dx * expected[0] + dy * expected[1], `${card.id}: inward/reversed arrow`).toBeGreaterThan(0);
    }
  };
  if (['normal-direction', 'circle-flux', 'clockwise-sign', 'circle-integral', 'negative-orientation', 'enclose-check', 'green-circle'].includes(slug) || (slug === 'challenge' && gameId === 'MIT-MV-47')) {
    const radius = params.s ?? params.a ?? printedRadius(card), cx = params.cx ?? 0, cy = params.cy ?? 0;
    const direction = /clockwise/i.test(card.prompt) && !/counterclockwise/i.test(card.prompt) ? -1 : 1;
    circleGeometry(radius, cx, cy, direction);
    for (const point of figure.shapes.filter(shape => shape.kind === 'point')) {
      if (point.label === 'O') { near(point.at[0], 0); near(point.at[1], 0); }
      if (point.label === 'P') { const expected = matched(card.prompt, /P = \((-?\d+), (-?\d+)\)/); near(point.at[0], Number(expected[1])); near(point.at[1], Number(expected[2])); }
    }
    return;
  }
  if (slug === 'tangential-zero') { circleGeometry(printedRadius(card)); return; }
  if (slug === 'segment-flux' || (slug === 'challenge' && gameId === 'MIT-MV-46')) {
    const start: Pt = slug === 'segment-flux' ? [0, 0] : [params.c, 0], end: Pt = slug === 'segment-flux' ? [params.a, params.b] : [0, params.d];
    curve(([x, y]) => Math.abs((x - start[0]) * (end[1] - start[1]) - (y - start[1]) * (end[0] - start[0])) < 1e-8 && (x - start[0]) * (end[0] - start[0]) + (y - start[1]) * (end[1] - start[1]) >= -1e-8);
    expect(lines[0].points[0]).toEqual(start); expect(lines[0].points.at(-1)).toEqual(end);
    for (const arrow of arrows) { const dx = arrow.to[0] - arrow.from[0], dy = arrow.to[1] - arrow.from[1]; near(dx * (end[1] - start[1]) - dy * (end[0] - start[0]), 0); expect(dx * (end[0] - start[0]) + dy * (end[1] - start[1])).toBeGreaterThan(0); }
    return;
  }
  if (slug === 'crossings') {
    curve(([x, y]) => x >= 0 && y === 0);
    expect(arrows.filter(arrow => arrow.from[0] > 0 && arrow.from[1] < 0 && arrow.to[1] > 0)).toHaveLength(params.u);
    expect(arrows.filter(arrow => arrow.from[0] > 0 && arrow.from[1] > 0 && arrow.to[1] < 0)).toHaveLength(params.d);
    expect(arrows).toHaveLength(params.u + params.d);
    for (const arrow of arrows) near(arrow.from[0], arrow.to[0]);
    return;
  }
  if (slug === 'extended-setup') {
    expect(lines).toHaveLength(2);
    const radii = lines.map(line => Math.hypot(...line.points[0])).sort(); expect(radii).toEqual([1, 2]);
    for (const line of lines) for (const [x, y] of line.points) near(x * x + y * y, line.points[0][0] ** 2);
    expect(arrows).toHaveLength(2);
    for (const arrow of arrows) expect(arrow.from[0] * arrow.to[1] - arrow.from[1] * arrow.to[0], `${card.id}: both curves must be ccw`).toBeGreaterThan(0);
    return;
  }
  if (slug === 'square-flux' || slug === 'green-m' || slug === 'flux-rectangle' || slug === 'flux-missing-edge') {
    const width = params.a ?? Number(matched(card.prompt, /0 \u2264 x \u2264 (\d+)/)[1]), height = params.b ?? Number(matched(card.prompt, /0 \u2264 y \u2264 (\d+)/)[1]);
    rectangleGeometry(width, height, slug !== 'green-m');
    if (slug === 'flux-missing-edge') { const highlighted = lines.filter(line => line.tone === 'warn'); expect(highlighted).toHaveLength(1); for (const [x, y] of highlighted[0].points) { near(x, 0); expect(y >= 0 && y <= height).toBe(true); } }
    return;
  }
  if (slug === 'com-setup') {
    const vertices = [...clean(card.prompt).matchAll(/\((-?\d+), (-?\d+)\)/g)], width = Math.abs(Number(vertices[0][1])), height = Number(vertices[1][2]);
    verifyRegion(figure, (x, y) => y >= 0 && y <= height && Math.abs(x) <= width * (1 - y / height), [-1.2 * width, 1.2 * width, -0.2 * height, 1.2 * height], card.id);
    curve(([x, y]) => y === 0 || Math.abs(Math.abs(x) - width * (1 - y / height)) < 1e-8);
    return;
  }
  if (slug === 'polar-inertia') {
    const polygons = figure.shapes.filter(shape => shape.kind === 'area');
    for (const polygon of polygons) for (const [x, y] of polygon.points) near(x * x + y * y, params.R ** 2);
    verifyRegion(figure, (x, y) => x * x + y * y <= params.R ** 2, [-1.2 * params.R, 1.2 * params.R, -1.2 * params.R, 1.2 * params.R], card.id);
    return;
  }
  if (slug === 'line-int') { curve(([x, y]) => x >= 0 && x <= 1 && Math.abs(y - x ** params.j) < 1e-8); expect(lines[0].points[0]).toEqual([0, 0]); expect(lines[0].points.at(-1)).toEqual([1, 1]); return; }
  if (slug === 'flux-green' || slug === 'flux-side' || (slug === 'challenge' && gameId === 'MIT-MV-48')) {
    const width = params.c ?? 1, upper = (x: number) => slug === 'challenge' ? x : x ** params.e, lower = (x: number) => slug === 'challenge' ? x ** params.e : 0;
    verifyRegion(figure, (x, y) => x >= 0 && x <= width && y >= lower(x) && y <= upper(x), [-0.2 * width, 1.2 * width, -0.2 * upper(width), 1.2 * upper(width)], card.id);
    curve(([x, y]) => x >= -1e-8 && x <= width + 1e-8 && (Math.abs(y - lower(x)) < 1e-8 || Math.abs(y - upper(x)) < 1e-8 || Math.abs(x - width) < 1e-8));
    for (const arrow of arrows) {
      const [x, y] = arrow.from, dx = arrow.to[0] - x, dy = arrow.to[1] - y;
      const normal: Pt = y === 0 ? [0, -1] : x === width ? [1, 0] : [-params.e * x ** (params.e - 1), 1];
      expect(dx * normal[0] + dy * normal[1], `${card.id}: outward arrow`).toBeGreaterThan(0);
      near(dx * normal[1] - dy * normal[0], 0, 'normal perpendicular to boundary');
    }
    return;
  }
  if (slug === 'annulus-mass' || slug === 'com-symmetry') {
    const bounds = matched(card.prompt, /(\d+)\u00b2 < x\u00b2 \+ y\u00b2 < (\d+)\u00b2/), inner = Number(bounds[1]), outer = Number(bounds[2]);
    verifyRegion(figure, (x, y) => y >= 0 && x * x + y * y >= inner ** 2 && x * x + y * y <= outer ** 2, [-1.1 * outer, 1.1 * outer, -0.1 * outer, 1.1 * outer], card.id);
    curve(([x, y]) => Math.abs(y) < 1e-8 || (y >= 0 && (Math.abs(x * x + y * y - inner ** 2) < 1e-8 || Math.abs(x * x + y * y - outer ** 2) < 1e-8)));
    return;
  }
  if (slug === 'limits-recipe' || slug === 'choose-coords') {
    const length = Number(matched(card.prompt, /x \+ y \+ z = (\d+)/)[1]);
    const vertices: Pt[] = [[0, 0], [-0.45 * length, -0.3 * length], [length, 0], [0, length]];
    expect(lines).toHaveLength(6);
    const edges = new Set<string>();
    for (const line of lines) {
      expect(line.points).toHaveLength(2);
      const indices = line.points.map(point => vertices.findIndex(vertex => Math.hypot(point[0] - vertex[0], point[1] - vertex[1]) < 1e-8));
      expect(indices.every(index => index >= 0), card.id).toBe(true); expect(indices[0]).not.toBe(indices[1]); edges.add(indices.sort().join('-'));
    }
    expect(edges.size).toBe(6);
    return;
  }
  if (slug === 'projection-radius' || slug === 'paraboloid-volume') {
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const lower = Math.abs(line.points[Math.floor(line.points.length / 2)][1]) < 1e-8;
      for (const [x, z] of line.points) near(z, lower ? x * x : params.c - x * x);
      near(line.points[0][0], -Math.sqrt(params.c)); near(line.points.at(-1)![0], Math.sqrt(params.c));
    }
    return;
  }
  if (slug === 'hemisphere-zcm') { curve(([x, z]) => z >= 0 && (Math.abs(x * x + z * z - params.a ** 2) < 1e-8 || z === 0)); near(Math.max(...lines.flatMap(line => line.points.map(point => point[1]))), params.a); return; }
  if (slug === 'challenge' && gameId === 'MIT-MV-50') {
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      const horizontal = line.points.every(point => Math.abs(point[1] - params.h) < 1e-8);
      for (const [x, z] of line.points) near(z, horizontal ? params.h : params.k * Math.abs(x), `cone z=k|x|, params ${JSON.stringify(params)}`);
      near(line.points[0][0], -params.h / params.k); near(line.points.at(-1)![0], params.h / params.k);
    }
    expect(lines.some(line => line.points.some(([x, z]) => x === 0 && z === 0)), `${card.id}: missing cone apex at origin`).toBe(true);
    return;
  }
  throw new Error(`Unhandled figure ${card.id}`);
}
describe('batch 10 figures agree with printed geometry', () => {
  for (const [gameId, generate] of Object.entries(batch10Generators)) {
    const figureIds = [...new Set(Array.from({ length: SEEDS }, (_, index) => generate(spreadSeed(index), 'en').filter(card => card.figure).map(card => card.id)).flat())];
    for (const cardId of figureIds) it(`${cardId}: curves, regions and orientations over 60 seeds`, () => {
      const failures: string[] = [];
      const examples = new Map<string, string>();
      let checked = 0;
      for (let index = 0; index < SEEDS; index++) {
        const card = generate(spreadSeed(index), 'en').find(other => other.id === cardId)!;
        if (!card.figure) continue;
        checked++;
        try {
          const chinese = generate(spreadSeed(index), 'zh').find(other => other.id === cardId)!;
          expect(chinese.figure!.shapes, `${gameId}: EN/ZH mathematical geometry`).toEqual(card.figure.shapes);
          verifyFigure(card);
        } catch (error) {
          const parameters = JSON.stringify(card.audit?.params ?? card.prompt);
          const message = `seed ${spreadSeed(index)} ${parameters}: ${error instanceof Error ? error.message : String(error)}`;
          failures.push(message);
          if (!examples.has(parameters)) examples.set(parameters, message);
        }
      }
      expect(checked, `${cardId}: no figures checked`).toBeGreaterThan(0);
      expect(failures.length, `${cardId}: ${failures.length}/${checked} figure checks failed; unequal examples:\n${[...examples.values()].slice(0, 2).join('\n')}`).toBe(0);
    });
    it(`${gameId}: no unhandled or option figures across 60 seeds`, () => {
      for (let index = 0; index < SEEDS; index++) for (const card of generate(spreadSeed(index), 'en')) {
        if (card.figure) expect(figureIds, card.id).toContain(card.id);
        expect(card.choice?.figures?.filter(Boolean) ?? [], `${card.id}: option figures need independent predicates`).toHaveLength(0);
      }
    });
  }
});