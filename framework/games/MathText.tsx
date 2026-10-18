import { renderToString } from 'katex';

export type MathTextPart =
  | { kind: 'text'; value: string }
  | { kind: 'math'; display: boolean; html: string };

const DELIMITED_MATH = /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\[[\s\S]+?\\\]|\\\([\s\S]+?\\\)|\[\[[\s\S]*?\]\])/g;
const MATH_OPERATOR = /^(?:[=<>≤≥+−\-×·*/∈∉∑∏∇∞→←⊥∩∪‖|^_{}]+)$/u;
const MATH_GLYPH = /[₀-₉₊₋₌ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦ⁰¹²³⁴⁵⁶⁷⁸⁹⁽⁾ᵃ-ᶻᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂα-ωΑ-Ω≤≥=∈∉∑∏∇∞√×·±−÷∩∪⊥→←‖|^_{}̂̄ĉĝĥĵŝŵŷ½⅓⅔¼¾]/u;
const ENGLISH_SHORT_WORDS = new Set(['am', 'an', 'as', 'at', 'be', 'by', 'do', 'go', 'he', 'if', 'in', 'is', 'it', 'me', 'my', 'no', 'of', 'on', 'or', 'so', 'to', 'up', 'us', 'we']);
// CJK ideographs, CJK punctuation and full-width forms: always prose, and they end a formula.
const CJK_RUN = '\\u2E80-\\u9FFF\\u3000-\\u303F\\uFF00-\\uFFEF';
const TOKEN = new RegExp(`\\s+|[${CJK_RUN}]+|[^\\s${CJK_RUN}]+`, 'gu');
const CJK = new RegExp(`[${CJK_RUN}]`, 'u');
// Function names written in prose formulas such as rank(A)=2, det(A+B), dim N(A).
const KATEX_OPERATORS = new Set(['det', 'dim', 'min', 'max', 'sin', 'cos', 'tan', 'exp', 'log', 'ln', 'ker', 'arctan', 'arcsin', 'arccos', 'sinh', 'cosh', 'tanh', 'sec', 'csc', 'cot', 'lim', 'sup', 'inf', 'arg', 'deg', 'gcd']);
const NAMED_OPERATORS = new Set(['rank', 'trace', 'tr', 'diag', 'nullity', 'rref', 'proj', 'curl', 'div', 'grad', 'sgn', 'sum', 'adj']);
// Words that are also English verbs or nouns count as operators only when a bracket follows: span{v}, span(a).
const BRACKET_OPERATORS = new Set(['span']);
// Two-letter capitals that are abbreviations in prose (LU factorization), not products.
const ACRONYMS = new Set(['LU', 'QR', 'OK', 'EN', 'ZH', 'US', 'UK', 'PS', 'ID', 'GP', 'KL', 'BO']);
const CONVERTED_LATER = new Set(['sqrt', 'pi']);
const ARTICLE_A_VERBS = new Set(['is', 'has', 'are', 'must', 'can', 'cannot', 'does', 'did', 'was', 'will', 'should', 'would', 'may', 'might', 'maps', 'sends', 'times', 'and', 'or', 'equals', 'gives', 'becomes', 'stays', 'remains', 'acts', 'multiplies', 'satisfies', 'contains', 'needs', 'keeps']);

const greek: Record<string, string> = {
  'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta', 'ε': '\\epsilon', 'θ': '\\theta',
  'λ': '\\lambda', 'μ': '\\mu', 'ν': '\\nu', 'π': '\\pi', 'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'φ': '\\phi', 'ω': '\\omega',
  'Γ': '\\Gamma', 'Δ': '\\Delta', 'Λ': '\\Lambda', 'Σ': '\\Sigma', 'Ω': '\\Omega',
};
const subscript: Record<string, string> = { '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4', '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9', '₊': '+', '₋': '-', '₌': '=', 'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k', 'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₒ': 'o', 'ₚ': 'p', 'ᵣ': 'r', 'ₛ': 's', 'ₜ': 't', 'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x', 'ᵦ': 'β' };
const superscript: Record<string, string> = {
  '⁰': '0', '¹': '1', '²': '2', '³': '3', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9', '⁺': '+', '⁻': '-',
  'ᵃ': 'a', 'ᵇ': 'b', 'ᶜ': 'c', 'ᵈ': 'd', 'ᵉ': 'e', 'ᶠ': 'f', 'ᵍ': 'g', 'ʰ': 'h', 'ⁱ': 'i', 'ʲ': 'j', 'ᵏ': 'k', 'ˡ': 'l',
  'ᵐ': 'm', 'ⁿ': 'n', 'ᵒ': 'o', 'ᵖ': 'p', 'ʳ': 'r', 'ˢ': 's', 'ᵗ': 't', 'ᵘ': 'u', 'ᵛ': 'v', 'ʷ': 'w', 'ˣ': 'x', 'ʸ': 'y', 'ᶻ': 'z', 'ᵀ': 'T',
  'ᴬ': 'A', 'ᴮ': 'B', 'ᴰ': 'D', 'ᴱ': 'E', 'ᴳ': 'G', 'ᴴ': 'H', 'ᴵ': 'I', 'ᴶ': 'J', 'ᴷ': 'K', 'ᴸ': 'L', 'ᴹ': 'M', 'ᴺ': 'N', 'ᴼ': 'O', 'ᴾ': 'P', 'ᴿ': 'R', 'ᵁ': 'U', 'ⱽ': 'V', 'ᵂ': 'W',
};

const VULGAR_FRACTIONS: Record<string, string> = { '½': '\\tfrac{1}{2}', '⅓': '\\tfrac{1}{3}', '⅔': '\\tfrac{2}{3}', '¼': '\\tfrac{1}{4}', '¾': '\\tfrac{3}{4}' };

function convertUnicodeMath(source: string): string {
  return source
    // KL divergence notation uses a double-bar separator; handle its three-bar
    // spelling before the ordinary paired-norm shorthand below.
    .replace(/KL\[([\s\S]*?)‖([\s\S]*?)\]/gu, '\\operatorname{KL}\\left[$1 \\middle\\Vert $2\\right]')
    .replace(/KL‖([^‖]+)‖([^‖]+)‖/gu, '\\operatorname{KL}\\left($1 \\middle\\Vert $2\\right)')
    // Combining marks must bind to the preceding Greek symbol before it is
    // converted into a TeX command.
    .replace(/([α-ωΑ-Ω])̄/gu, (_match, char: string) => `\\bar{${greek[char] ?? char}}`)
    .replace(/([α-ωΑ-Ω])̂/gu, (_match, char: string) => `\\hat{${greek[char] ?? char}}`)
    // Capital sigma followed by a subscript is used as a summation operator.
    .replace(/Σ(?=[₀-₉₊₋₌ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓ]*₌)/gu, '\\sum ')
    .replace(/_{2,}/gu, '\\square')
    .replace(/([₀-₉₊₋₌ₐₑₕᵢⱼₖₗₘₙₒₚᵣₛₜᵤᵥₓᵦ]+)/gu, run => `_{${[...run].map(char => subscript[char] ?? char).join('')}}`)
    .replace(/⁽([^⁽⁾]+)⁾/gu, (_match, run: string) => `^{(${[...run].map(char => superscript[char] ?? char).join('')})}`)
    .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹⁺⁻ᵃ-ᶻʰⁱʲˡⁿᴬᴮᴰᴱᴳᴴᴵᴶᴷᴸᴹᴺᴼᴾᴿᵀᵁⱽᵂ]+)/gu, run => `^{${[...run].map(char => superscript[char] ?? char).join('')}}`)
    .replace(/‖([^‖]+)‖/gu, '\\lVert $1 \\rVert ')
    .replace(/\|\|([^|]+)\|\|/gu, '\\lVert $1 \\rVert ')
    .replace(/√\s*(\([^()]+\)|[A-Za-z0-9]+)/gu, '\\sqrt{$1}')
    .replace(/(?<!\\)\bsqrt\s*\(([^()]+)\)/giu, '\\sqrt{$1}')
    // Lowercase only and not inside a longer name: pI in J−pI is p times I, not π.
    .replace(/(?<![\\A-Za-z])pi(?![A-Za-z])/gu, '\\pi ')
    .replace(/\b([A-Za-z])([0-9]+)\b/gu, '$1_{$2}')
    // A trailing space keeps a following letter out of the command name (Λx, not \Lambdax).
    .replace(/[α-ωΑ-Ω]/gu, char => greek[char] ? `${greek[char]} ` : char)
    .replace(/[½⅓⅔¼¾]/gu, char => VULGAR_FRACTIONS[char])
    .replace(/([A-Za-z])̂/gu, '\\hat{$1}')
    .replace(/[ĉĝĥĵŝŵŷ]/gu, char => `\\hat{${char.normalize('NFD')[0]}}`)
    .replaceAll('−', '-')
    .replaceAll('×', '\\times ')
    .replaceAll('·', '\\cdot ')
    .replaceAll('≤', '\\le ')
    .replaceAll('≥', '\\ge ')
    .replaceAll('∈', '\\in ')
    .replaceAll('∉', '\\notin ')
    .replaceAll('→', '\\to ')
    .replaceAll('←', '\\leftarrow ')
    .replaceAll('⊥', '\\perp ')
    .replaceAll('∩', '\\cap ')
    .replaceAll('∪', '\\cup ')
    .replaceAll('∇', '\\nabla ')
    .replaceAll('∑', '\\sum ')
    .replaceAll('∏', '\\prod ')
    .replaceAll('∞', '\\infty ')
    .replaceAll('±', '\\pm ')
    .replaceAll('÷', '\\div ');
}

function splitCells(row: string): string[] {
  const cells: string[] = [];
  let depth = 0, cell = '';
  for (const char of row) {
    if ((char === ',' || char === '，') && depth === 0) { cells.push(cell.trim()); cell = ''; continue; }
    if (char === '(' || char === '{') depth++;
    if (char === ')' || char === '}') depth = Math.max(0, depth - 1);
    cell += char;
  }
  cells.push(cell.trim());
  return cells;
}

function legacyMatrix(source: string): string | null {
  const body = source.slice(2, -2);
  const rows = body.split(/\]\s*[,，]\s*\[/u).map(splitCells);
  if ((rows.length === 1 && rows[0].length === 1) || rows.some(row => row.length !== rows[0].length)) return null;
  const contents = rows.map(row => row.map(cell => cell === '__' ? '\\square' : convertUnicodeMath(cell)).join(' & ')).join(' \\\\ ');
  return `\\begin{bmatrix}${contents}\\end{bmatrix}`;
}

function compile(tex: string, display: boolean): MathTextPart {
  const safeTex = convertUnicodeMath(tex.replace(/\[\[([\s\S]*?)\]\]/gu, raw => legacyMatrix(raw) ?? raw))
    // ∮_C₂ or ∮_C_in: a subscripted subscript must be grouped, or TeX reports a double subscript.
    .replace(/_([A-Za-z])_(\{(?:[^{}]|\{[^{}]*\})*\}|[A-Za-z0-9])/gu, '_{$1_$2}');
  return { kind: 'math', display, html: renderToString(safeTex, { displayMode: display, throwOnError: false, trust: false, strict: 'ignore' }) };
}

// ---- Formula detection in plain prose -------------------------------------------------
// Card text is prose with Unicode math (Ax = λx, rank(A)=2, 矩阵A的秩). Tokens are classified
// one by one, adjacent formula tokens are joined, and sentence punctuation and unmatched
// brackets stay outside the rendered formula.

type TokenKind = 'text' | 'math' | 'number' | 'function' | 'pair';
interface Token { raw: string; lead: string; core: string; trail: string; space: boolean; kind: TokenKind }

const NUMBER = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/u;
// Typed answer syntax shown as an example ("e.g. 6pi", "3pi/4", "sqrt(2)") is not a formula.
const INPUT_SYNTAX = /^[+-]?\d*(?:pi|sqrt\(\d+\))(?:\/\d+)?$/u;

function splitToken(raw: string) {
  const lead = raw.match(/^["“‘]+/u)?.[0] ?? '';
  const rest = raw.slice(lead.length);
  const trail = rest.match(/[.,;:!?”’"]+$/u)?.[0] ?? '';
  return { lead, core: rest.slice(0, rest.length - trail.length), trail };
}

function alphaKind(word: string, attachedBracket: boolean): 'operator' | 'word' | 'symbol' {
  const lower = word.toLowerCase();
  if (KATEX_OPERATORS.has(lower) || NAMED_OPERATORS.has(lower) || CONVERTED_LATER.has(lower)) return 'operator';
  if (BRACKET_OPERATORS.has(lower) && attachedBracket) return 'operator';
  // An English word: three or more lowercase letters, optionally capitalized; or a short
  // English word such as "no" in "0=no".
  // Products of variables such as xyz or dxdy have no vowel; English words of 3-4 letters do.
  if (word.length >= 3 && /^[A-Z]?[a-z]+$/u.test(word) && (word.length >= 5 || /[aeiou]/iu.test(word))) return 'word';
  if (word.length === 2 && word === lower && ENGLISH_SHORT_WORDS.has(word)) return 'word';
  return 'symbol';
}

function wordsOf(core: string) {
  return [...core.matchAll(/[A-Za-z]+/gu)].map(match => ({ word: match[0], bracket: /^[({]/u.test(core.slice((match.index ?? 0) + match[0].length)) }));
}

function isOperator(core?: string): boolean {
  return !!core && MATH_OPERATOR.test(core);
}

function strongKind(core: string, previous: string | undefined, next: string | undefined, sentenceStart: boolean): TokenKind {
  if (!core || CJK.test(core) || /^MIT-/iu.test(core) || core.includes('://')) return 'text';
  if (/^\d+(?:st|nd|rd|th|D)$/u.test(core) || INPUT_SYNTAX.test(core)) return 'text';
  // Compound adjectives such as rank-1 or 3-by-3 are prose.
  if (/^[A-Za-z]{3,}-\d+$|^\d+-[A-Za-z]{2,}(?:-\d+)?$/u.test(core)) return 'text';
  const words = wordsOf(core);
  if (words.some(({ word, bracket }) => alphaKind(word, bracket) === 'word')) return 'text';
  if (NUMBER.test(core)) return 'number';
  if (isOperator(core)) return 'math';
  if (/\d/u.test(core) || MATH_GLYPH.test(core) || /[+=<>^_|/*()[\]−-]/u.test(core)) return 'math';
  if (words.length === 1 && words[0].word === core && alphaKind(core, false) === 'operator') return 'function';
  if (/^[A-Za-z]$/u.test(core)) {
    // "a" and sentence-initial "A" are usually articles: "is a subspace", "A rank-1 truncation".
    const nextIsWord = !!next && /^[a-z][a-z'-]+/u.test(next);
    if (core === 'a') return nextIsWord && !isOperator(previous) ? 'text' : 'math';
    if (core === 'A') return sentenceStart && nextIsWord && !ARTICLE_A_VERBS.has(next!) ? 'text' : 'math';
    return 'math';
  }
  if (/^[A-Za-z]{2}$/u.test(core)) {
    // "As", "if" are words; "AS" (A times S) is a product.
    if (/^[A-Za-z][a-z]$/u.test(core) && ENGLISH_SHORT_WORDS.has(core.toLowerCase())) return 'text';
    if (ACRONYMS.has(core)) return 'pair';
    // Differentials: "find dw when", "the coefficients of du and dv".
    if (/^d[a-z]$/u.test(core)) return 'math';
    // Ax, Bf, AB, PQ: a product or a named segment.
    return /^[A-Z]/u.test(core) ? 'math' : 'pair';
  }
  return 'text';
}

function classify(raws: string[]): Token[] {
  const tokens: Token[] = raws.map(raw => ({ raw, ...splitToken(raw), space: /^\s+$/u.test(raw), kind: 'text' }));
  const words = tokens.filter(token => !token.space);
  words.forEach((token, i) => {
    const previous = words[i - 1], next = words[i + 1];
    const sentenceStart = !previous || /[.!?:]$/u.test(previous.raw) || CJK.test(previous.raw);
    token.kind = strongKind(token.core, previous?.core, next?.core, sentenceStart);
  });
  const isMath = (token?: Token) => token?.kind === 'math';
  for (let pass = 0; pass < 3; pass++) {
    words.forEach((token, i) => {
      const previous = words[i - 1], next = words[i + 1];
      if (token.kind === 'number') {
        if (isOperator(previous?.core) || isOperator(next?.core)) token.kind = 'math';
      } else if (token.kind === 'function') {
        if (isMath(next)) token.kind = 'math';
      } else if (token.kind === 'pair') {
        if (isOperator(previous?.core) || isOperator(next?.core) || isMath(previous) || isMath(next)) token.kind = 'math';
      }
    });
  }
  return tokens;
}

/** Symbol-card fragments such as "∫_{y=0}^{" or "} dx dy" open or close a group around a
 * blank. The grouping braces cannot render on their own, so they are dropped. */
function dropUnmatchedBraces(source: string): string {
  const chars = [...source], open: number[] = [], drop = new Set<number>();
  chars.forEach((char, i) => {
    if (char === '{') open.push(i);
    else if (char === '}') { if (open.length) open.pop(); else drop.add(i); }
  });
  open.forEach(i => drop.add(i));
  return chars.filter((_, i) => !drop.has(i)).join('');
}

/** Prose formula -> TeX: escape TeX specials and set function names upright. */
function proseToTex(source: string): string {
  return dropUnmatchedBraces(source)
    .replace(/[%&#]/gu, char => `\\${char}`)
    .replace(/(^|[^_^])\{([^{}]*)\}/gu, '$1\\{$2\\}')
    // A symbol-card fragment such as "∫_" or "^" ends at a blank: show the mark itself.
    // ("__" is a fill-in blank and becomes a box later.)
    .replace(/(?:^[_^](?![_^])|(?<![_^])[_^]$)/gu, mark => mark === '_' ? '\\_' : '\\text{\\textasciicircum}')
    // e^(At), (−1)^(i+j): the parenthesized exponent is the whole superscript.
    .replace(/\^\(([^()]*)\)/gu, '^{$1}')
    .replace(/[A-Za-z]+/gu, (word: string, offset: number, whole: string) => {
      // Word subscripts such as f_min or x_max are labels, not products of variables.
      if (word.length > 1 && /[_^]/u.test(whole[offset - 1] ?? '')) return `{\\mathrm{${word}}}`;
      const lower = word.toLowerCase();
      if (CONVERTED_LATER.has(lower)) return word;
      if (KATEX_OPERATORS.has(word)) return `\\${word} `;
      const bracket = /^\\?[({]/u.test(whole.slice(offset + word.length));
      if (alphaKind(word, bracket) === 'operator') return `\\operatorname{${word}}`;
      return word;
    });
}

const OPENERS = '([', CLOSERS = ')]';

/** Unclosed depth of ( and [ in a formula run. */
function depth(run: string): number {
  let level = 0;
  for (const char of run) { if (OPENERS.includes(char)) level++; else if (CLOSERS.includes(char)) level = Math.max(0, level - 1); }
  return level;
}

/** Split a run at brackets that do not match inside it; those brackets stay prose. */
function segmentRun(run: string): MathTextPart[] {
  const unmatched = new Set<number>();
  const stack: number[] = [];
  [...run].forEach((char, i) => {
    if (OPENERS.includes(char)) stack.push(i);
    else if (CLOSERS.includes(char)) { if (stack.length) stack.pop(); else unmatched.add(i); }
  });
  stack.forEach(i => unmatched.add(i));
  const parts: MathTextPart[] = [];
  const chars = [...run];
  let piece = '';
  const emit = () => {
    const lead = piece.match(/^\s*/u)![0], trail = piece.slice(lead.length).match(/\s*$/u)![0];
    const core = piece.slice(lead.length, piece.length - trail.length);
    if (lead) parts.push({ kind: 'text', value: lead });
    if (core) parts.push(compile(proseToTex(core), false));
    if (trail) parts.push({ kind: 'text', value: trail });
    piece = '';
  };
  chars.forEach((char, i) => {
    if (unmatched.has(i)) { emit(); parts.push({ kind: 'text', value: char }); } else piece += char;
  });
  emit();
  return parts;
}

function autoMath(source: string): MathTextPart[] {
  const tokens = classify(source.match(TOKEN) ?? []);
  const parts: MathTextPart[] = [];
  const add = (part: MathTextPart) => {
    const last = parts[parts.length - 1];
    if (part.kind === 'text' && last?.kind === 'text') last.value += part.value; else parts.push(part);
  };
  const text = (value: string) => { if (value) add({ kind: 'text', value }); };
  let run = '';
  const flush = () => { if (run) segmentRun(run).forEach(add); run = ''; };
  // Inside an open bracket a list continues: (3, 6, 0), [0 2 −3; −1 0 3], b=(2，−2).
  const joins = (token: Token) => token.kind === 'math'
    || (!!run && depth(run) > 0 && (token.kind !== 'text' || /^(?:…|\.\.\.|，|[A-Za-z])$/u.test(token.core) || /^[;，]$/u.test(token.raw)));
  const nextWordIndex = (from: number) => { for (let i = from + 1; i < tokens.length; i++) if (!tokens[i].space) return i; return -1; };
  tokens.forEach((token, i) => {
    if (token.space) {
      const next = nextWordIndex(i);
      if (run && next >= 0 && joins(tokens[next])) run += token.raw;
      else { flush(); text(token.raw); }
      return;
    }
    if (!joins(token)) { flush(); text(token.raw); return; }
    if (token.raw === '，') { run += ','; return; }
    if (token.lead) { flush(); text(token.lead); }
    run += token.core;
    if (!token.trail) return;
    // Keep list commas inside a formula such as "x = 1, y = 2"; end it at other punctuation.
    const next = nextWordIndex(i);
    if (token.trail === ',' && next >= 0 && joins(tokens[next])) run += ',';
    else if (token.trail === ';' && depth(run) > 0) run += ';';
    else { flush(); text(token.trail); }
  });
  flush();
  return parts;
}

export function parseMathText(text: string): MathTextPart[] {
  const parts: MathTextPart[] = [];
  const pattern = new RegExp(DELIMITED_MATH.source, 'g');
  let lastIndex = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > lastIndex) parts.push(...autoMath(text.slice(lastIndex, index)));
    const token = match[0];
    if (token.startsWith('[[')) {
      const matrix = legacyMatrix(token);
      if (matrix) parts.push(compile(`\\,${matrix}\\,`, false));
      else parts.push({ kind: 'text', value: token });
    } else {
      const display = token.startsWith('$$') || token.startsWith('\\[');
      const expression = token.startsWith('$$') ? token.slice(2, -2)
        : token.startsWith('$') ? token.slice(1, -1)
          : token.startsWith('\\[') ? token.slice(2, -2) : token.slice(2, -2);
      parts.push(compile(expression, display));
    }
    lastIndex = index + token.length;
  }
  if (lastIndex < text.length) parts.push(...autoMath(text.slice(lastIndex)));
  return parts;
}

export function MathText({ text }: { text: string }) {
  return <>{parseMathText(text).map((part, index) => part.kind === 'text'
    ? part.value
    : <span key={index} class={`practice-game__math${part.display ? ' practice-game__math--display' : ''}`} dangerouslySetInnerHTML={{ __html: part.html }} />)}</>;
}
