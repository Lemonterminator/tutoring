import { describe, expect, it } from 'vitest';
import { batch09Generators } from './batch09';
import { spreadSeed } from './deck-invariants';
import { centralDiff, simpson, type Oracle } from './oracle-harness';
import { gradeCard, parseGameNumber, type PracticeCard } from '../types';
import type { FigureShape, Pt } from '../figure';

type Params = Record<string, number>;
type Field = (x: number, y: number) => number;
const SEEDS = 60;
const PI = Math.PI;
const clean = (text: string) => text.replaceAll('\u2212', '-').replaceAll('\u00a0', ' ');
const near = (actual: number, expected: number, where = '') =>
  expect(Math.abs(actual - expected), `${where}: ${actual} vs ${expected}`).toBeLessThanOrEqual(1e-8);
const derivative = (fn: (value: number) => number, at: number) =>
  (4 * centralDiff(fn, at, 0.125) - centralDiff(fn, at, 0.25)) / 3;
const curl = (M: Field, N: Field, x: number, y: number) =>
  derivative(value => N(value, y), x) - derivative(value => M(x, value), y);
const segment = (M: Field, N: Field, start: Pt, end: Pt) => {
  const dx = end[0] - start[0], dy = end[1] - start[1];
  return simpson(t => M(start[0] + t * dx, start[1] + t * dy) * dx
    + N(start[0] + t * dx, start[1] + t * dy) * dy, 0, 1, 32);
};
const boundary = (M: Field, N: Field, points: Pt[]) => points.reduce((sum, start, index) =>
  sum + segment(M, N, start, points[(index + 1) % points.length]), 0);
const rectangle = (a: number, b: number, c: number, d: number): Pt[] => [[a, c], [b, c], [b, d], [a, d]];
const circle = (M: Field, N: Field, radius: number, center = 0, direction = 1) =>
  simpson(t => {
    const angle = direction * t, x = center + radius * Math.cos(angle), y = radius * Math.sin(angle);
    return M(x, y) * (-direction * radius * Math.sin(angle))
      + N(x, y) * (direction * radius * Math.cos(angle));
  }, 0, 2 * PI, 512);
const potential = (M: Field, N: Field, x: number, y: number) => {
  const horizontalFirst = segment(M, N, [0, 0], [x, 0]) + segment(M, N, [x, 0], [x, y]);
  const verticalFirst = segment(M, N, [0, 0], [0, y]) + segment(M, N, [0, y], [x, y]);
  near(horizontalFirst, verticalFirst, 'independent paths');
  return horizontalFirst;
};
const rationalIntegral = (fn: (t: number) => number, from: number, to: number) => {
  const coarse = simpson(fn, from, to, 2048), fine = simpson(fn, from, to, 4096);
  near(coarse, fine, 'quadrature refinement');
  return fine;
};
const vortex = (k: number, h: number, R: number) => rationalIntegral(t => {
  const x = h + R * Math.cos(t), y = R * Math.sin(t);
  return (-k * y * (-R * Math.sin(t)) + k * x * R * Math.cos(t)) / (x * x + y * y);
}, 0, 2 * PI);
const numericChoice = (value: number) => ({ optionIsCorrect: (text: string) => {
  const parsed = parseGameNumber(clean(text));
  return parsed !== null && Math.abs(parsed - value) <= 1e-8;
} });
const gradientChoice = (gradient: boolean, expectedCurl: Field) => ({ optionIsCorrect: (text: string) => {
  if (gradient) return /gradient field/i.test(text) && /curl F = 0 at every point/.test(text)
    && /simply connected/i.test(text) && !/not a gradient/i.test(text);
  if (!/not a gradient field/i.test(text) || !/not 0.*x.*\u2260 0/.test(text)) return false;
  const claim = clean(text).match(/curl F = (.+?) is not 0/);
  return !!claim && sameField(evaluate(claim[1]), expectedCurl);
} });
const sharedEdges = (m: number, n: number) => {
  const edges = new Map<string, number>();
  for (let x = 0; x < m; x++) for (let y = 0; y < n; y++) {
    const corners = rectangle(x, x + 1, y, y + 1);
    corners.forEach((start, index) => {
      const end = corners[(index + 1) % 4];
      const key = [start.join(','), end.join(',')].sort().join(':');
      edges.set(key, (edges.get(key) ?? 0) + 1);
    });
  }
  return [...edges.values()].filter(count => count === 2).length;
};

const numeric: Record<string, (params: Params) => number[]> = {
  'MIT-MV-41:criterion-constant': ({ q, r }) => [curl(() => 0, (x, y) => q * x * x + r * y, 2, 3)
    / derivative(y => 2 * y, 3)],
  'MIT-MV-41:curl-value': ({ p, q, r, s }) => [curl((x, y) => p * x + q * y, (x, y) => r * x + s * y, 1.7, -0.4)],
  'MIT-MV-41:potential-value': ({ P, p, Q, a, b }) => [potential((x, y) => P * x + p * y * y,
    (x, y) => 2 * p * x * y + Q * y * y, a, b)],
  'MIT-MV-41:potential-coefs': ({ A, d, c }) => {
    const M: Field = (x, y) => A * x * x + 2 * d * x * y, N: Field = (x, y) => d * x * x + c * y;
    const first = potential(M, N, 1, 0), last = potential(M, N, 0, 1);
    const middle = potential(M, N, 1, 1) - first - last;
    for (const [x, y] of [[0.7, -1.2], [1.8, 0.4]]) {
      const f: Field = (xx, yy) => first * xx ** 3 + middle * xx * xx * yy + last * yy * yy;
      near(derivative(xx => f(xx, y), x), M(x, y));
      near(derivative(yy => f(x, yy), y), N(x, y));
    }
    return [first, middle, last];
  },
  'MIT-MV-41:challenge': ({ p, q, r, m, n }) => {
    const M: Field = (x, y) => 2 * p * x * y + q * y * y, N: Field = (x, y) => p * x * x + 2 * q * x * y + r;
    const value = segment(M, N, [0, 0], [m, n]);
    near(value, potential(M, N, m, n));
    return [value];
  },
  'MIT-MV-42:notes-example': ({ a, b, x0, y0 }) => [curl((x, y) => a * x * y * y, x => b * x, x0, y0)],
  'MIT-MV-42:rotation-curl': ({ w }) => [curl((x, y) => -w * y, x => w * x, 1.3, -0.7)],
  'MIT-MV-42:challenge': ({ u, v, w, c, x0, y0 }) => [curl((x, y) => u - w * y, x => v + w * x + c * x * x, x0, y0)],
  'MIT-MV-43:curl-value': ({ a, b, x0, y0 }) => [curl((x, y) => -a * x * x * y, (x, y) => b * x * y * y, x0, y0)],
  'MIT-MV-43:disk': ({ a, R }) => [circle((x, y) => -a * x * x * y, (x, y) => a * x * y * y, R)],
  'MIT-MV-43:linear-field': ({ a, b, R }) => [circle((x, y) => a * y, x => b * x, R)],
  'MIT-MV-43:cycloid': ({ a }) => [simpson(theta => a * (1 - Math.cos(theta)) * a * (1 - Math.cos(theta)), 0, 2 * PI, 256)],
  'MIT-MV-43:off-center': ({ h, rho }) => [circle((x, y) => 3 * x * x * y * y, (x, y) => 2 * x * x * (1 + x * y), rho, h)],
  'MIT-MV-43:challenge': ({ p, q, b }) => [boundary((x, y) => p * y * y, x => q * x * x, rectangle(0, b, 0, b))],
  'MIT-MV-44:curl-value': ({ a, b, x0, y0 }) => [curl((x, y) => a * x * y, x => b * x * x, x0, y0)],
  'MIT-MV-44:potential-value': ({ a, b, c, c0, x0, y0 }) => [c0 + potential((x, y) => 2 * a * x * y + b, x => a * x * x + c, x0, y0)],
  'MIT-MV-44:half-plane-potential': ({ x1, y1, v1, x2, y2 }) => [v1 + rationalIntegral(t => {
    const x = x1 + t * (x2 - x1), y = y1 + t * (y2 - y1);
    return ((x2 - x1) * y - x * (y2 - y1)) / (y * y);
  }, 0, 1)],
  'MIT-MV-44:unit-circle-work': ({ k, R }) => [vortex(k, 0, R)],
  'MIT-MV-44:challenge': ({ k, h, R }) => [vortex(k, h, R)],
  'MIT-MV-45:rect-proof': ({ a, b, c, d, p }) => [boundary((x, y) => p * x * y, () => 0, rectangle(a, b, c, d))],
  'MIT-MV-45:shared-edges': ({ m, n }) => [sharedEdges(m, n)],
  'MIT-MV-45:ellipse-area': ({ a, b }) => [simpson(theta => a * Math.cos(theta) * b * Math.cos(theta), 0, 2 * PI, 256)],
  'MIT-MV-45:challenge': ({ rho, R }) => [circle(() => 0, (x, y) => rho * x * y * y, R)],
};
const choices: Record<string, (params: Params) => ReturnType<typeof numericChoice>> = {
  'MIT-MV-42:definition': ({ p, q, r, s }) => numericChoice(curl((x, y) => p * x + q * y, (x, y) => r * x + s * y, 0.4, 1.7)),
  'MIT-MV-43:orientation': ({ a, b, R }) => numericChoice(circle((x, y) => a * y, x => b * x, R, 0, -1)),
  'MIT-MV-44:not-gradient': ({ a, b }) => {
    const expectedCurl: Field = (x, y) => curl((xx, yy) => a * xx * yy, xx => b * xx * xx, x, y);
    return gradientChoice(Math.abs(expectedCurl(1.7, 0.3)) < 1e-8, expectedCurl);
  },
  'MIT-MV-45:clockwise': ({ a, b, c, d, p }) => numericChoice(boundary((x, y) => p * x * y, () => 0, rectangle(a, b, c, d).reverse())),
};
const closed: Record<string, (params: Params) => number[]> = {
  'MIT-MV-41:criterion-constant': ({ q }) => [2 * q],
  'MIT-MV-41:curl-value': ({ q, r }) => [r - q],
  'MIT-MV-41:potential-value': ({ P, p, Q, a, b }) => [P * a * a / 2 + p * a * b * b + Q * b ** 3 / 3],
  'MIT-MV-41:potential-coefs': ({ A, d, c }) => [A / 3, d, c / 2],
  'MIT-MV-41:challenge': ({ p, q, r, m, n }) => [p * m * m * n + q * m * n * n + r * n],
  'MIT-MV-42:notes-example': ({ a, b, x0, y0 }) => [b - 2 * a * x0 * y0],
  'MIT-MV-42:rotation-curl': ({ w }) => [2 * w],
  'MIT-MV-42:challenge': ({ w, c, x0 }) => [2 * w + 2 * c * x0],
  'MIT-MV-43:curl-value': ({ a, b, x0, y0 }) => [a * x0 * x0 + b * y0 * y0],
  'MIT-MV-43:disk': ({ a, R }) => [a * R ** 4 * PI / 2],
  'MIT-MV-43:linear-field': ({ a, b, R }) => [(b - a) * PI * R * R],
  'MIT-MV-43:cycloid': ({ a }) => [3 * a * a * PI],
  'MIT-MV-43:off-center': ({ h, rho }) => [4 * h * rho * rho * PI],
  'MIT-MV-43:challenge': ({ p, q, b }) => [(q - p) * b ** 3],
  'MIT-MV-44:curl-value': ({ a, b, x0 }) => [(2 * b - a) * x0],
  'MIT-MV-44:potential-value': ({ a, b, c, c0, x0, y0 }) => [a * x0 * x0 * y0 + b * x0 + c * y0 + c0],
  'MIT-MV-44:half-plane-potential': ({ x1, y1, v1, x2, y2 }) => [x2 / y2 - x1 / y1 + v1],
  'MIT-MV-44:unit-circle-work': ({ k }) => [2 * k * PI],
  'MIT-MV-44:challenge': ({ k, h, R }) => [Math.abs(h) < R ? 2 * k * PI : 0],
  'MIT-MV-45:rect-proof': ({ a, b, c, d, p }) => [-p * (d - c) * (b * b - a * a) / 2],
  'MIT-MV-45:shared-edges': ({ m, n }) => [2 * m * n - m - n],
  'MIT-MV-45:ellipse-area': ({ a, b }) => [a * b * PI],
  'MIT-MV-45:challenge': ({ rho, R }) => [rho * R ** 4 * PI / 4],
};
const oracles = { ...numeric, ...choices } as unknown as Record<string, Oracle>;
const piKinds = new Set(['MIT-MV-43:disk', 'MIT-MV-43:linear-field', 'MIT-MV-43:cycloid', 'MIT-MV-43:off-center',
  'MIT-MV-44:unit-circle-work', 'MIT-MV-44:challenge', 'MIT-MV-45:ellipse-area', 'MIT-MV-45:challenge']);
const exactInput = (value: number, pi: boolean) => {
  const coefficient = pi ? value / PI : value;
  for (let denominator = 1; denominator <= 720; denominator++) {
    const numerator = Math.round(coefficient * denominator);
    if (Math.abs(coefficient - numerator / denominator) <= 1e-10) {
      return `${numerator}${pi ? 'pi' : ''}/${denominator}`;
    }
  }
  throw new Error(`no rational representation for ${value}`);
};
function checkChoice(card: PracticeCard, predicate: (option: string) => boolean) {
  const verdicts = card.choice!.options.map(predicate);
  expect(verdicts.filter(Boolean), card.id).toHaveLength(1);
  card.choice!.options.forEach((option, index) => {
    expect(gradeCard(card, [], index, []), `${card.id}: ${option}`).toBe(verdicts[index] ? 'correct' : 'incorrect');
  });
}

type Environment = Record<string, number>;
type Expression = (env: Environment) => number;
function expression(source: string): Expression {
  const text = clean(source).replaceAll('\u00b7', '*').replaceAll('\u03b8', 't').replaceAll('\u03c0', 'pi')
    .replaceAll('e\u02e3', 'exp(x)').replaceAll('\u00bd', '(1/2)')
    .replace(/[\u00b2\u00b3\u2074]/g, power => `^${{ '\u00b2': 2, '\u00b3': 3, '\u2074': 4 }[power]}`);
  const tokens = text.match(/exp|sin|cos|pi|\d+(?:\.\d+)?|[A-Za-z]|[()+*/^\-]/g) ?? [];
  expect(tokens.join(''), `unparsed expression: ${source}`).toBe(text.replace(/\s/g, ''));
  let position = 0;
  const atom = (): Expression => {
    const token = tokens[position++];
    if (token === '(') {
      const result = sum(); expect(tokens[position++], source).toBe(')'); return result;
    }
    if (/^\d/.test(token ?? '')) { const value = Number(token); return () => value; }
    if (token === 'pi') return () => PI;
    if (token === 'sin' || token === 'cos' || token === 'exp') {
      let exponent = 1;
      if (tokens[position] === '^') { position++; exponent = Number(tokens[position++]); }
      const argument = atom();
      return env => (token === 'sin' ? Math.sin(argument(env)) : token === 'cos' ? Math.cos(argument(env)) : Math.exp(argument(env))) ** exponent;
    }
    if (/^[A-Za-z]$/.test(token ?? '')) return env => {
      expect(env[token], `${source}: unbound ${token}`).toBeDefined(); return env[token];
    };
    throw new Error(`unexpected ${token} in ${source}`);
  };
  const unary = (): Expression => {
    if (tokens[position] === '-' || tokens[position] === '+') {
      const sign = tokens[position++] === '-' ? -1 : 1, argument = unary(); return env => sign * argument(env);
    }
    const base = atom();
    if (tokens[position] === '^') { position++; const exponent = Number(tokens[position++]); return env => base(env) ** exponent; }
    return base;
  };
  const product = (): Expression => {
    let result = unary();
    while (position < tokens.length && ![')', '+', '-'].includes(tokens[position])) {
      const operator = tokens[position] === '*' || tokens[position] === '/' ? tokens[position++] : '*';
      const left = result, right = unary();
      result = operator === '/' ? env => left(env) / right(env) : env => left(env) * right(env);
    }
    return result;
  };
  const sum = (): Expression => {
    let result = product();
    while (tokens[position] === '+' || tokens[position] === '-') {
      const operator = tokens[position++], left = result, right = product();
      result = operator === '+' ? env => left(env) + right(env) : env => left(env) - right(env);
    }
    return result;
  };
  const result = sum(); expect(position, source).toBe(tokens.length); return result;
}
const samples: Pt[] = [[0.7, -1.2], [-1.3, 0.4], [1.8, 2.1], [-0.6, -1.7]];
const evaluate = (source: string): Field => {
  const fn = expression(source); return (x, y) => fn({ x, y, p: 1, t: x });
};
const sameField = (actual: Field, expected: Field) => samples.every(([x, y]) => Math.abs(actual(x, y) - expected(x, y)) <= 1e-8);
const capture = (text: string, pattern: RegExp) => {
  const match = clean(text).match(pattern);
  expect(match, `${text}\nexpected ${pattern}`).not.toBeNull(); return match!;
};
function pairSources(text: string, label = 'F'): [string, string] {
  const prefix = capture(text, new RegExp(`${label}\\s*=\\s*\\(`));
  const start = prefix.index! + prefix[0].length;
  let depth = 0, comma = -1, end = -1;
  const normalized = clean(text);
  for (let position = start; position < normalized.length; position++) {
    const char = normalized[position];
    if (char === '(') depth++;
    if (char === ')') { if (depth === 0) { end = position; break; } depth--; }
    if (char === ',' && depth === 0) comma = position;
  }
  expect(comma, text).toBeGreaterThan(start); expect(end, text).toBeGreaterThan(comma);
  const parts: [string, string] = [normalized.slice(start, comma), normalized.slice(comma + 1, end)];
  const denominator = normalized.slice(end + 1).match(/^\s*\/\s*(\([^)]*\))/);
  return denominator ? parts.map(part => `(${part})/${denominator[1]}`) as [string, string] : parts;
}
const pairFields = (text: string, label = 'F') => pairSources(text, label).map(evaluate) as [Field, Field];
const namedFields = (text: string): [Field, Field] => {
  const match = capture(text, /M = (.+?)(?: and |\uFF0C|,\s*)N = (.+?)(?:\.|\u3002| are )/);
  return [evaluate(match[1]), evaluate(match[2])];
};
function expectFields(actual: [Field, Field], M: Field, N: Field, where: string) {
  expect(sameField(actual[0], M), `${where}: printed M`).toBe(true);
  expect(sameField(actual[1], N), `${where}: printed N`).toBe(true);
}
const compact = (text: string) => clean(text).replace(/\s/g, '');
const contains = (text: string, expected: string) => expect(compact(text), expected).toContain(compact(expected));
const point = (text: string, x: number, y: number) => contains(text, `(${x}, ${y})`);
const radius = (text: string, value: number) => expect(clean(text)).toMatch(new RegExp(`(?:radius |\u534a\u5f84(?:\u4e3a)?\\s*)${value}(?![\\d.])`));
const directed = (text: string, clockwise = false) => {
  if (/[\u3400-\u9fff]/.test(text)) contains(text, clockwise ? '\u987a\u65f6\u9488' : '\u9006\u65f6\u9488');
  else expect(text).toMatch(clockwise ? /(?<!counter)clockwise/ : /counterclockwise/);
};
const rectBounds = (text: string, a: number, b: number, c: number, d: number) => {
  contains(text, `${a} \u2264 x \u2264 ${b}`); contains(text, `${c} \u2264 y \u2264 ${d}`);
};
function differential(text: string): [Field, Field] {
  const body = capture(text, /\u222e_C\s*\(?(.+?) dx\s*\+\s*(.+?) dy/);
  return [evaluate(body[1]), evaluate(body[2])];
}
function ellipseFields(text: string): [Field, Field] {
  const match = capture(text, /x = (.+?)[,\uFF0C]\s*y = (.+?)(?:[,\uFF0C]\s*|\uFF08)0 \u2264/);
  return [evaluate(match[1]), evaluate(match[2])];
}
function checkPrinted(card: PracticeCard, params: Params) {
  const text = [card.prompt, ...(card.lines ?? [])].join(' '), kind = card.audit!.kind;
  const { p, q, r, s, P, Q, a, b, A, d, c, m, n, w, u, v, x0, y0, c0, x1, y1, v1, x2, y2, k, h, R, rho } = params;
  switch (kind) {
    case 'MIT-MV-41:criterion-constant': expectFields(pairFields(text), (x, y) => x * y, (x, y) => q * x * x + r * y, card.id); break;
    case 'MIT-MV-41:curl-value': expectFields(namedFields(text), (x, y) => p * x + q * y, (x, y) => r * x + s * y, card.id); break;
    case 'MIT-MV-41:potential-value':
      expectFields(pairFields(text), (x, y) => P * x + p * y * y, (x, y) => 2 * p * x * y + Q * y * y, card.id);
      point(text, 0, 0); point(text, a, 0); point(text, a, b); break;
    case 'MIT-MV-41:potential-coefs': expectFields(pairFields(text), (x, y) => A * x * x + 2 * d * x * y, (x, y) => d * x * x + c * y, card.id); break;
    case 'MIT-MV-41:challenge':
      expectFields(pairFields(text), (x, y) => 2 * p * x * y + q * y * y, (x, y) => p * x * x + 2 * q * x * y + r, card.id);
      point(text, 0, 0); point(text, m, n); break;
    case 'MIT-MV-42:definition':
      for (const [label, value] of [['M_x', p], ['M_y', q], ['N_x', r], ['N_y', s]] as const) {
        const match = capture(text, new RegExp(`${label} = (-?\\d+)(?!\\d)`)); near(Number(match[1]), value);
      }
      break;
    case 'MIT-MV-42:notes-example': expectFields(pairFields(text), (x, y) => a * x * y * y, x => b * x, card.id); point(text, x0, y0); break;
    case 'MIT-MV-42:rotation-curl': expectFields(pairFields(text), (x, y) => -w * y, x => w * x, card.id); directed(text); break;
    case 'MIT-MV-42:challenge': expectFields(pairFields(text), (x, y) => u - w * y, x => v + w * x + c * x * x, card.id); point(text, x0, y0); break;
    case 'MIT-MV-43:curl-value': expectFields(namedFields(text), (x, y) => -a * x * x * y, (x, y) => b * x * y * y, card.id); point(text, x0, y0); break;
    case 'MIT-MV-43:disk': expectFields(differential(text), (x, y) => -a * x * x * y, (x, y) => a * x * y * y, card.id); radius(text, R); directed(text); break;
    case 'MIT-MV-43:linear-field':
    case 'MIT-MV-43:orientation': expectFields(pairFields(text), (x, y) => a * y, x => b * x, card.id); radius(text, R); directed(text, kind.endsWith(':orientation')); break;
    case 'MIT-MV-43:cycloid':
      expectFields(ellipseFields(text), x => a * (x - Math.sin(x)), x => a * (1 - Math.cos(x)), card.id);
      contains(text, '0 \u2264 \u03b8 \u2264 2\u03c0'); directed(text); break;
    case 'MIT-MV-43:off-center': expectFields(differential(text), (x, y) => 3 * x * x * y * y, (x, y) => 2 * x * x * (1 + x * y), card.id); radius(text, rho); point(text, h, 0); directed(text); break;
    case 'MIT-MV-43:challenge': expectFields(differential(text), (x, y) => p * y * y, x => q * x * x, card.id); rectBounds(text, 0, b, 0, b); directed(text); break;
    case 'MIT-MV-44:curl-value': expectFields(pairFields(text), (x, y) => a * x * y, x => b * x * x, card.id); point(text, x0, y0); break;
    case 'MIT-MV-44:not-gradient': expectFields(pairFields(text), (x, y) => a * x * y, x => b * x * x, card.id); break;
    case 'MIT-MV-44:potential-value': expectFields(pairFields(text), (x, y) => 2 * a * x * y + b, x => a * x * x + c, card.id); contains(text, `f(0, 0) = ${c0}`); contains(text, `f(${x0}, ${y0})`); break;
    case 'MIT-MV-44:half-plane-potential':
      contains(text, `f(${x1}, ${y1}) = ${v1}`); contains(text, `f(${x2}, ${y2})`);
      contains(text, y1 > 0 ? 'y > 0' : 'y < 0'); expect(Math.sign(y2)).toBe(Math.sign(y1));
      contains(text, '(y dx - x dy)/y\u00b2'); break;
    case 'MIT-MV-44:unit-circle-work':
    case 'MIT-MV-44:challenge':
      expectFields(pairFields(text), (x, y) => -k * y / (x * x + y * y), (x, y) => k * x / (x * x + y * y), card.id);
      radius(text, R); directed(text); if (kind.endsWith(':challenge')) point(text, h, 0); break;
    case 'MIT-MV-45:rect-proof':
    case 'MIT-MV-45:clockwise': {
      const printedM = evaluate(capture(text, /M = (.+?)(?:\.|\u3002)/)[1]);
      expect(sameField(printedM, (x, y) => p * x * y)).toBe(true);
      rectBounds(text, a, b, c, d); directed(text, kind.endsWith(':clockwise')); break;
    }
    case 'MIT-MV-45:shared-edges':
      rectBounds(text, 0, m, 0, n);
      if (/[\u3400-\u9fff]/.test(text)) { contains(text, `${m} \u5217\u3001${n} \u884c`); contains(text, `${m * n} \u4e2a\u5355\u4f4d\u6b63\u65b9\u5f62`); }
      else { contains(text, `${m} columns, ${n} rows`); contains(text, `${m * n} unit squares`); }
      directed(text); break;
    case 'MIT-MV-45:ellipse-area': expectFields(ellipseFields(text), x => a * Math.cos(x), x => b * Math.sin(x), card.id); contains(text, '0 \u2264 \u03b8 \u2264 2\u03c0'); directed(text); break;
    case 'MIT-MV-45:challenge': {
      const printedN = evaluate(capture(text, /\u222e_C (.+?) dy/)[1]);
      expect(sameField(printedN, (x, y) => rho * x * y * y)).toBe(true); radius(text, R); directed(text); break;
    }
    default: throw new Error(`missing printed parameter test: ${kind}`);
  }
}

const nonAuditKinds = [
  'MIT-MV-41-exactness', 'MIT-MV-41-potential-setup', 'MIT-MV-41-gradient-of-potential', 'MIT-MV-41-counterexample-hole',
  'MIT-MV-42-scalar-k', 'MIT-MV-42-rotation-field', 'MIT-MV-42-sign-check', 'MIT-MV-42-undefined-point',
  'MIT-MV-43-setup', 'MIT-MV-43-area-form', 'MIT-MV-44-simply-connected', 'MIT-MV-44-exact-region', 'MIT-MV-44-why-not-conservative',
  'MIT-MV-45-area-pair', 'MIT-MV-45-ellipse-setup', 'MIT-MV-45-inertia-pair',
];
function nonAuditPredicate(card: PracticeCard): (option: string) => boolean {
  const slug = card.id.slice(10), text = card.prompt;
  switch (slug) {
    case 'exactness': {
      const [M, N] = namedFields(text), my = derivative(y => M(1.3, y), 0.4), nx = derivative(x => N(x, 0.4), 1.3);
      return option => {
        const cleaned = clean(option);
        const correctPrefix = Math.abs(my - nx) < 1e-8 ? /^Exact: M_y =/ : /^Not exact: M_y =/;
        if (!correctPrefix.test(cleaned)) return false;
        const values = [...cleaned.matchAll(/(?:M_y|N_x) = (-?\d+)/g)].map(match => Number(match[1]));
        if (values.length === 1) return Math.abs(values[0] - my) < 1e-8 && Math.abs(my - nx) < 1e-8;
        return Math.abs(values[0] - my) < 1e-8 && Math.abs(values[1] - nx) < 1e-8;
      };
    }
    case 'gradient-of-potential': {
      const f = evaluate(capture(text, /f\(x, y\) = (.+?)\./)[1]);
      return option => {
        const [M, N] = pairFields(`F = ${option}`);
        return samples.every(([x, y]) => Math.abs(M(x, y) - derivative(xx => f(xx, y), x)) <= 1e-8
          && Math.abs(N(x, y) - derivative(yy => f(x, yy), y)) <= 1e-8);
      };
    }
    case 'counterexample-hole': {
      const labels = ['A', 'B'].filter(label => {
        const [M, N] = pairFields(text, label), circulation = circle(M, N, 1);
        if (Math.abs(circulation) > 1e-8) return false;
        const coefficient = M(1, 0);
        for (const [x, y] of samples) {
          const f: Field = (xx, yy) => coefficient * Math.log(xx * xx + yy * yy) / 2;
          near(centralDiff(xx => f(xx, y), x), M(x, y)); near(centralDiff(yy => f(x, yy), y), N(x, y));
        }
        return true;
      });
      expect(labels).toHaveLength(1); return option => new RegExp(`^Only ${labels[0]} is conservative\\.$`).test(option);
    }
    case 'scalar-k': return option => /curl is a scalar-valued function|curl is the k-component|curl is defined only for vector fields in the plane/.test(option);
    case 'sign-check': {
      const [M, N] = pairFields(text); directed(text, true); return numericChoice(curl(M, N, 0.4, 1.7)).optionIsCorrect;
    }
    case 'undefined-point': {
      const values = capture(text, /P = \(([^,]+), ([^)]+)\)/), x = Number(values[1]), y = Number(values[2]);
      const labels = ['A', 'B'].filter(label => {
        const [M, N] = pairFields(text, label); return [M(x, y), N(x, y), curl(M, N, x, y)].every(Number.isFinite);
      });
      expect(labels).toHaveLength(1); return option => option === `Only ${labels[0]}`;
    }
    case 'area-form': {
      const target = /equals zero/.test(text) ? 0 : /negative of the area/.test(text) ? -1 : /2A|twice/.test(text) ? 2 : 1;
      return option => {
        const integrand = expression(clean(option).replaceAll('\u222e_C', '').replaceAll('dx', 'U').replaceAll('dy', 'V'));
        const M: Field = (x, y) => integrand({ x, y, U: 1, V: 0 }), N: Field = (x, y) => integrand({ x, y, U: 0, V: 1 });
        return Math.abs(boundary(M, N, rectangle(0, 1, 0, 1)) - target) <= 1e-8;
      };
    }
    case 'simply-connected': return option => /^(The whole xy-plane|The unit disk:|The right half-plane)/.test(option);
    case 'exact-region': {
      const denominatorY = /\/y\u00b2/.test(text), coordinate = denominatorY ? 'y' : 'x';
      const match = capture(text, /\u03c9 = (.*?)\(/), factor = match[1].trim() ? Number(match[1]) : 1;
      return option => {
        if (!/Exact on each half-plane/.test(option) || !/independent/.test(option)) return false;
        contains(option, `${coordinate} > 0`); contains(option, `${coordinate} < 0`);
        const formula = capture(option, /with f = (.+?) \+ c on/)[1], f = evaluate(formula);
        return samples.every(([x, y]) => Math.abs(centralDiff(xx => f(xx, y), x, 1e-6)
          - (denominatorY ? factor / y : -factor * y / (x * x))) <= 1e-8
          && Math.abs(centralDiff(yy => f(x, yy), y, 1e-6) - (denominatorY ? -factor * x / (y * y) : factor / x)) <= 1e-8);
      };
    }
    case 'why-not-conservative': {
      const [M, N] = pairFields(text), R = Number(capture(text, /radius (\d+)/)[1]);
      const circulation = circle(M, N, R);
      expect(Math.abs(circulation)).toBeGreaterThan(1);
      const printed = capture(text, /\u222e_C F\u00b7dr = (.+?)\./)[1];
      const claimed = parseGameNumber(clean(printed));
      expect(claimed, `${card.id}: printed circulation`).not.toBeNull();
      near(claimed!, circulation, `${card.id}: printed circulation versus parametrized integral`);
      return option => /not conservative/.test(option) && /not simply connected/.test(option);
    }
    case 'area-pair': {
      const target = capture(text, / = (\d*)A\?/), factor = target[1] ? Number(target[1]) : 1;
      return option => {
        const [M, N] = pairFields(`F = ${option}`);
        return samples.every(([x, y]) => Math.abs(curl(M, N, x, y) - factor) <= 1e-8);
      };
    }
    case 'inertia-pair': {
      const density = Number(capture(text, /uniform density (\d+)/)[1]);
      return option => {
        const [M, N] = pairFields(`F = ${option}`);
        return samples.every(([x, y]) => Math.abs(curl(M, N, x, y) - density * (x * x + y * y)) <= 1e-8);
      };
    }
    default: throw new Error(`missing non-audit choice: ${card.id}`);
  }
}
function checkSlots(card: PracticeCard) {
  const slug = card.id.slice(10), slots = card.slots!;
  let expected: Field[];
  switch (slug) {
    case 'potential-setup': { const [M, N] = pairFields(card.prompt); expected = [x => M(x, 0), N]; break; }
    case 'rotation-field': {
      const w = Number(capture(card.prompt, /angular speed (\d+)/)[1]); expected = [(x, y) => -w * y, x => w * x]; break;
    }
    case 'setup': { const [M, N] = differential(card.prompt); expected = [(x, y) => curl(M, N, x, y)]; break; }
    case 'ellipse-setup': {
      const [x, y] = ellipseFields(card.prompt);
      contains(card.prompt, '0 \u2264 \u03b8 \u2264 2\u03c0');
      expect(compact(slots.before), `${card.id}: widget bounds`).toBe(compact('\u222e_C x dy = \u222b\u2080^{2\u03c0}'));
      expect(slots.between ?? [], `${card.id}: widget separators`).toEqual([]);
      expect(compact(slots.after ?? ''), `${card.id}: widget differential`).toBe('d\u03b8');
      expected = [theta => x(theta, 0) * centralDiff(value => y(value, 0), theta)]; break;
    }
    default: throw new Error(`missing slot mathematics: ${card.id}`);
  }
  expect(slots.answers).toHaveLength(expected.length);
  expected.forEach((fn, index) => {
    const candidates = slots.tokens.filter(token => sameField(evaluate(token), fn));
    expect(candidates, card.id).toHaveLength(1); expect(slots.answers[index], card.id).toBe(candidates[0]);
    const alternative = [...slots.answers]; alternative[index] = candidates[0];
    expect(gradeCard(card, [], null, alternative)).toBe('correct');
    for (const token of slots.tokens.filter(item => item !== candidates[0])) {
      alternative[index] = token; expect(gradeCard(card, [], null, alternative)).toBe('incorrect');
    }
  });
}

const figureKinds = [
  'MIT-MV-41-potential-setup', 'MIT-MV-41-potential-value', 'MIT-MV-41-counterexample-hole',
  'MIT-MV-42-rotation-field', 'MIT-MV-42-rotation-curl', 'MIT-MV-42-sign-check',
  'MIT-MV-43-disk', 'MIT-MV-43-linear-field', 'MIT-MV-43-orientation', 'MIT-MV-43-cycloid', 'MIT-MV-43-off-center', 'MIT-MV-43-challenge',
  'MIT-MV-44-unit-circle-work', 'MIT-MV-44-why-not-conservative', 'MIT-MV-44-challenge',
  'MIT-MV-45-rect-proof', 'MIT-MV-45-shared-edges', 'MIT-MV-45-ellipse-area', 'MIT-MV-45-clockwise',
];
type Curve = Extract<FigureShape, { kind: 'line' | 'area' }>;
type Arrow = Extract<FigureShape, { kind: 'arrow' }>;
const sampled = (points: Pt[]) => [...new Set([0, 1, Math.floor(points.length / 4), Math.floor(points.length / 2),
  Math.floor(3 * points.length / 4), points.length - 2, points.length - 1])].filter(index => index >= 0).map(index => points[index]);
const samePoint = (actual: Pt, expected: Pt, where: string) => { near(actual[0], expected[0], where); near(actual[1], expected[1], where); };
const cross = (position: Pt, delta: Pt) => position[0] * delta[1] - position[1] * delta[0];
function arrowOrientation(arrow: Arrow, center: Pt, direction: number, scale: Pt = [1, 1]) {
  const position: Pt = [(arrow.from[0] - center[0]) / scale[0], (arrow.from[1] - center[1]) / scale[1]];
  const delta: Pt = [(arrow.to[0] - arrow.from[0]) / scale[0], (arrow.to[1] - arrow.from[1]) / scale[1]];
  expect(direction * cross(position, delta)).toBeGreaterThan(1e-8);
}
function insidePolygon(point: Pt, polygon: Pt[]) {
  let inside = false;
  for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
    const [x1, y1] = polygon[index], [x2, y2] = polygon[previous];
    if ((y1 > point[1]) !== (y2 > point[1]) && point[0] < (x2 - x1) * (point[1] - y1) / (y2 - y1) + x1) inside = !inside;
  }
  return inside;
}
function rectangleFigure(card: PracticeCard, curves: Curve[], arrows: Arrow[], a: number, b: number, c: number, d: number, clockwise: boolean) {
  const area = curves.find(shape => shape.kind === 'area')!, outline = curves.find(shape => shape.kind === 'line')!;
  expect(area, card.id).toBeDefined(); expect(outline, card.id).toBeDefined();
  const vertices = rectangle(a, b, c, d);
  for (const vertex of vertices) expect(area.points.some(point => Math.abs(point[0] - vertex[0]) < 1e-8 && Math.abs(point[1] - vertex[1]) < 1e-8), card.id).toBe(true);
  for (const point of sampled(outline.points)) {
    expect(point[0]).toBeGreaterThanOrEqual(a - 1e-8); expect(point[0]).toBeLessThanOrEqual(b + 1e-8);
    expect(point[1]).toBeGreaterThanOrEqual(c - 1e-8); expect(point[1]).toBeLessThanOrEqual(d + 1e-8);
    expect(Math.min(Math.abs(point[0] - a), Math.abs(point[0] - b), Math.abs(point[1] - c), Math.abs(point[1] - d))).toBeLessThanOrEqual(1e-8);
  }
  expect(insidePolygon([(a + b) / 2, (c + d) / 2], area.points)).toBe(true);
  expect(insidePolygon([b + 0.2, (c + d) / 2], area.points)).toBe(false);
  expect(arrows.length, card.id).toBeGreaterThan(0);
  for (const arrow of arrows) {
    arrowOrientation(arrow, [(a + b) / 2, (c + d) / 2], clockwise ? -1 : 1);
    const dx = arrow.to[0] - arrow.from[0], dy = arrow.to[1] - arrow.from[1];
    near(dx * dy, 0, 'axis-aligned rectangle edge');
  }
}
function checkFigure(card: PracticeCard) {
  const figure = card.figure!, slug = card.id.slice(10);
  const curves = figure.shapes.filter((shape): shape is Curve => shape.kind === 'line' || shape.kind === 'area');
  const arrows = figure.shapes.filter((shape): shape is Arrow => shape.kind === 'arrow');
  const params = card.audit?.params as Params | undefined;
  const text = card.prompt;
  expect(figure.shapes.length, card.id).toBeGreaterThan(0);
  if (slug === 'potential-setup' || slug === 'potential-value') {
    const first = curves.find(shape => shape.label === 'C\u2081')!, second = curves.find(shape => shape.label === 'C\u2082')!;
    expect(first, card.id).toBeDefined(); expect(second, card.id).toBeDefined();
    samePoint(first.points[0], [0, 0], card.id);
    const corner = first.points.at(-1)!, end = second.points.at(-1)!;
    samePoint(second.points[0], corner, card.id); near(corner[1], 0); near(end[0], corner[0]);
    expect(corner[0]).toBeGreaterThan(0); expect(end[1]).toBeGreaterThan(0);
    const labels = figure.shapes.filter(shape => shape.kind === 'point').map(shape => shape.label);
    if (slug === 'potential-value') {
      const { a, b } = params!;
      samePoint(corner, [a, 0], card.id); samePoint(end, [a, b], card.id);
      point(figure.alt, a, 0); point(figure.alt, a, b);
      expect(labels).toContain(`(${a}, 0)`); expect(labels).toContain(`(${a}, ${b})`);
      for (const shape of figure.shapes) if (shape.kind === 'point') {
        expect(shape.label).toBe(`(${shape.at[0]}, ${shape.at[1]})`);
      }
    } else {
      contains(figure.alt, '(x,0)'); contains(figure.alt, '(x,y)');
      expect(labels).toContain('(x, 0)'); expect(labels).toContain('(x, y)');
      expect(labels).not.toContain('(a, 0)'); expect(labels).not.toContain('(a, b)');
    }
    expect(arrows).toHaveLength(2);
    for (const arrow of arrows) {
      const dx = arrow.to[0] - arrow.from[0], dy = arrow.to[1] - arrow.from[1];
      expect(dx >= 0 && dy >= 0 && dx + dy > 0).toBe(true); near(dx * dy, 0);
      expect(curves.some(curve => curve.points.some(endpoint => Math.hypot(endpoint[0] - arrow.to[0], endpoint[1] - arrow.to[1]) < 1e-8)
        && (dy === 0 ? arrow.from[1] === 0 && arrow.from[0] >= 0 && arrow.from[0] <= corner[0]
          : arrow.from[0] === corner[0] && arrow.from[1] >= 0 && arrow.from[1] <= end[1]))).toBe(true);
    }
    return;
  }
  if (card.id.startsWith('MIT-MV-42-')) {
    const direction = slug === 'sign-check' ? -1 : 1;
    directed(text, direction < 0); directed(figure.alt, direction < 0);
    expect(arrows.length).toBeGreaterThan(0);
    for (const arrow of sampledArrows(arrows)) {
      const [x, y] = arrow.from, dx = arrow.to[0] - x, dy = arrow.to[1] - y;
      near(x * dx + y * dy, 0, 'velocity perpendicular to radius'); arrowOrientation(arrow, [0, 0], direction);
    }
    return;
  }
  if (slug === 'shared-edges') {
    const { m, n } = params!; expect(curves).toHaveLength(m + n + 2); expect(arrows).toHaveLength(4 * m * n);
    for (let x = 0; x <= m; x++) expect(curves.some(shape => shape.points.length === 2
      && shape.points.every(point => Math.abs(point[0] - x) < 1e-8) && Math.abs(shape.points[0][1] - shape.points[1][1]) === n)).toBe(true);
    for (let y = 0; y <= n; y++) expect(curves.some(shape => shape.points.length === 2
      && shape.points.every(point => Math.abs(point[1] - y) < 1e-8) && Math.abs(shape.points[0][0] - shape.points[1][0]) === m)).toBe(true);
    for (let x = 0; x < m; x++) for (let y = 0; y < n; y++) {
      const loop = arrows.filter(arrow => Math.floor(arrow.from[0]) === x && Math.floor(arrow.from[1]) === y);
      expect(loop).toHaveLength(4);
      const center: Pt = [loop.reduce((sum, arrow) => sum + arrow.from[0], 0) / 4, loop.reduce((sum, arrow) => sum + arrow.from[1], 0) / 4];
      loop.forEach(arrow => {
        expect(arrow.to[0] > x && arrow.to[0] < x + 1 && arrow.to[1] > y && arrow.to[1] < y + 1).toBe(true);
        arrowOrientation(arrow, center, 1);
        expect(loop.some(next => Math.hypot(next.from[0] - arrow.to[0], next.from[1] - arrow.to[1]) < 1e-8)).toBe(true);
      });
    }
    directed(figure.alt); return;
  }
  if (slug === 'rect-proof' || slug === 'clockwise' || card.id === 'MIT-MV-43-challenge') {
    const { a, b, c, d } = params!;
    rectangleFigure(card, curves, arrows, a ?? 0, b, c ?? 0, d ?? b, slug === 'clockwise');
    rectBounds(figure.alt, a ?? 0, b, c ?? 0, d ?? b); directed(figure.alt, slug === 'clockwise'); return;
  }
  if (slug === 'cycloid') {
    const { a } = params!, curve = curves.find(shape => shape.kind === 'line' && shape.points.length > 2)!;
    const area = curves.find(shape => shape.kind === 'area')!;
    expect(curve, card.id).toBeDefined(); expect(area, card.id).toBeDefined();
    for (const [index, point] of curve.points.entries()) if ([0, 1, 8, 16, 32, 48, curve.points.length - 1].includes(index)) {
      const theta = 2 * PI * index / (curve.points.length - 1);
      samePoint(point, [a * (theta - Math.sin(theta)), a * (1 - Math.cos(theta))], card.id);
    }
    expect(insidePolygon([PI * a, a], area.points)).toBe(true);
    expect(insidePolygon([PI * a, -a], area.points)).toBe(false);
    expect(arrows.some(arrow => arrow.from[1] === 0 && arrow.to[1] === 0 && arrow.to[0] > arrow.from[0])).toBe(true);
    expect(arrows.some(arrow => arrow.to[0] < arrow.from[0] && arrow.to[1] > arrow.from[1])).toBe(true);
    directed(figure.alt); return;
  }
  if (slug === 'ellipse-area') {
    const { a, b } = params!;
    expect(curves.some(shape => shape.kind === 'area')).toBe(true);
    for (const curve of curves) for (const [x, y] of sampled(curve.points)) near((x / a) ** 2 + (y / b) ** 2, 1, card.id);
    const area = curves.find(shape => shape.kind === 'area')!;
    expect(insidePolygon([0.2 * a, 0.3 * b], area.points)).toBe(true);
    expect(insidePolygon([1.1 * a, 0], area.points)).toBe(false);
    expect(arrows.length).toBeGreaterThan(0); arrows.forEach(arrow => arrowOrientation(arrow, [0, 0], 1, [a, b]));
    expectFields(ellipseFields(`${figure.alt.replace(/ with .+$/, '')}, 0 \u2264`), x => a * Math.cos(x), x => b * Math.sin(x), card.id);
    directed(figure.alt); return;
  }
  const R = slug === 'counterexample-hole' ? 1 : params?.rho ?? params?.R ?? Number(capture(text, /radius (\d+)/)[1]);
  const center = params?.h ?? 0, direction = slug === 'orientation' ? -1 : 1;
  expect(curves.length).toBeGreaterThan(0);
  for (const curve of curves) for (const [x, y] of sampled(curve.points)) near((x - center) ** 2 + y * y, R * R, card.id);
  expect(arrows.length).toBeGreaterThan(0); arrows.forEach(arrow => arrowOrientation(arrow, [center, 0], direction));
  directed(figure.alt, direction < 0);
  if (slug !== 'counterexample-hole') radius(figure.alt, R);
  if (center) point(figure.alt, center, 0);
  if (card.id.startsWith('MIT-MV-44-') || slug === 'counterexample-hole') {
    const hole = figure.shapes.find(shape => shape.kind === 'point' && shape.hollow);
    expect(hole, card.id).toBeDefined(); if (hole?.kind === 'point') samePoint(hole.at, [0, 0], card.id);
  }
}
const sampledArrows = (arrows: Arrow[]) => [arrows[0], arrows[Math.floor(arrows.length / 2)], arrows.at(-1)!];

describe('batch09 Task C text regressions', () => {
  it('cycloid prints the exact axis endpoint in both languages', () => {
    for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
      const card = batch09Generators['MIT-MV-43'](spreadSeed(index), lang).find(item => item.id.endsWith('-cycloid'))!;
      const { a } = card.audit!.params as Params;
      contains(card.prompt, `(${2 * a}π, 0)`);
      expect(card.prompt).not.toMatch(/\(\d+\.\d+, 0\)/);
    }
  });

  it('exact-region distractor asserts false necessity, not an allowed equal-constant choice', () => {
    const variants = new Set<string>();
    for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
      const card = batch09Generators['MIT-MV-44'](spreadSeed(index), lang).find(item => item.id.endsWith('-exact-region'))!;
      variants.add(card.prompt.includes('/y²') ? 'y' : 'x');
      const required = card.choice!.options.filter(option => lang === 'en' ? option.includes('constants must be equal') : option.includes('常数必须相等'));
      expect(required).toHaveLength(1);
      expect(required[0]).toContain('+ c');
      expect(gradeCard(card, [], card.choice!.options.indexOf(required[0]), [])).toBe('incorrect');
      expect(card.choice!.options[card.choice!.answer]).toContain(lang === 'en' ? 'independent' : '相互独立');
    }
    expect([...variants].sort()).toEqual(['x', 'y']);
  });

  it('rect-proof top contribution uses reversed explicit bounds without an extra minus', () => {
    for (let index = 0; index < SEEDS; index++) for (const lang of ['en', 'zh'] as const) {
      const card = batch09Generators['MIT-MV-45'](spreadSeed(index), lang).find(item => item.id.endsWith('-rect-proof'))!;
      const { a, b, d, p } = card.audit!.params as Params;
      const top = simpson(x => p * d * x, b, a, 32);
      contains(card.explanation, `∫_${b}^${a} ${p}·${d}·x dx = (${top})`);
      expect(clean(card.explanation)).not.toContain(`-∫_${b}^${a}`);
      expect(top).toBeLessThan(0);
    }
  });
});

describe('batch09 independent audit oracles', () => {
  for (const kind of Object.keys(oracles)) it(`${kind}: 60 spread seeds, independent mathematics and grading`, () => {
    const game = kind.split(':')[0];
    let count = 0;
    for (let index = 0; index < SEEDS; index++) {
      const cards = batch09Generators[game](spreadSeed(index), 'en');
      const chinese = batch09Generators[game](spreadSeed(index), 'zh');
      for (const card of cards.filter(item => item.audit?.kind === kind)) {
        count++;
        const params = card.audit!.params as Params;
        checkPrinted(card, params);
        const other = chinese.find(item => item.id === card.id)!;
        expect(other.audit, `${card.id}: bilingual params`).toEqual(card.audit);
        checkPrinted(other, params);
        const result = oracles[kind](params);
        if (Array.isArray(result)) {
          expect(card.fields, card.id).toHaveLength(result.length);
          result.forEach((value, field) => near(card.fields![field].answer, value, `${card.id} ${JSON.stringify(params)}`));
          closed[kind](params).forEach((value, field) => near(result[field], value, `${kind}: second closed-form assertion`));
          expect(gradeCard(card, result.map(String), null, [])).toBe('correct');
          expect(gradeCard(card, result.map(value => exactInput(value, piKinds.has(kind))), null, [])).toBe('correct');
          expect(gradeCard(other, result.map(value => exactInput(value, piKinds.has(kind))), null, [])).toBe('correct');
          result.forEach((value, field) => {
            for (const offset of [-10, 10]) {
              const wrong = result.map(String); wrong[field] = String(value + offset);
              expect(gradeCard(card, wrong, null, [])).toBe('incorrect');
              expect(gradeCard(other, wrong, null, [])).toBe('incorrect');
            }
          });
        } else {
          checkChoice(card, result.optionIsCorrect);
          expect(other.choice!.options).toHaveLength(card.choice!.options.length);
          card.choice!.options.forEach((option, selection) => expect(gradeCard(other, [], selection, []))
            .toBe(result.optionIsCorrect(option) ? 'correct' : 'incorrect'));
        }
      }
      cards.filter(card => card.audit).forEach(card => expect(oracles[card.audit!.kind], card.id).toBeTypeOf('function'));
    }
    expect(count, kind).toBe(SEEDS);
  });
});

describe('batch09 non-audit mathematics', () => {
  for (const id of nonAuditKinds) it(`${id}: 60 spread seeds, option or slot content`, () => {
    const issues: string[] = [];
    for (let index = 0; index < SEEDS; index++) {
      const seed = spreadSeed(index), deck = batch09Generators[id.slice(0, 9)](seed, 'en');
      const card = deck.find(item => item.id === id)!;
      expect(card, id).toBeDefined();
      expect(card.audit).toBeUndefined();
      if (card.slots) checkSlots(card);
      else if (id.endsWith('-simply-connected')) {
        const verdicts = card.choice!.options.map(nonAuditPredicate(card));
        if (verdicts.filter(Boolean).length !== 1) issues.push(`seed ${seed}: ${JSON.stringify(card.choice!.options.filter((_, option) => verdicts[option]))}`);
        card.choice!.options.forEach((option, selection) => {
          const expected = verdicts[selection] ? 'correct' : 'incorrect';
          if (gradeCard(card, [], selection, []) !== expected) issues.push(`seed ${seed}: grader rejects true option ${option}`);
        });
      } else checkChoice(card, nonAuditPredicate(card));
      deck.filter(item => !item.audit).forEach(item => expect(nonAuditKinds, item.id).toContain(item.id));
    }
    expect(issues.length, `${id}: ${issues.slice(0, 6).join('\n')}`).toBe(0);
  });
});

describe('batch09 figures versus printed curves and orientations', () => {
  for (const id of figureKinds) it(`${id}: 60 spread seeds, small point samples`, () => {
    const issues: string[] = [];
    for (let index = 0; index < SEEDS; index++) {
      const generate = batch09Generators[id.slice(0, 9)], seed = spreadSeed(index);
      const english = generate(seed, 'en'), chinese = generate(seed, 'zh');
      const card = english.find(item => item.id === id)!, other = chinese.find(item => item.id === id)!;
      expect(card.figure, id).toBeDefined();
      try { checkFigure(card); } catch (error) { issues.push(`seed ${seed}: ${String(error)}`); }
      expect(other.figure!.shapes, `${id}: bilingual geometry`).toEqual(card.figure!.shapes);
      english.filter(item => item.figure).forEach(item => expect(figureKinds, item.id).toContain(item.id));
    }
    expect(issues.length, `${id}: ${issues.slice(0, 2).join('\n')}`).toBe(0);
  });
});