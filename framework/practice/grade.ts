/** Accepts the ways students type numbers: decimal comma, typographic minus, spaces, e-notation. */
export function parseNumber(input: string): number | null {
  const s = input.trim().replace(/\s+/g, '').replace(/[−–]/g, '-').replace(',', '.');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(s)) return null;
  return Number(s);
}

export function gradeNumeric(input: string, answer: number, rel = 0.02, abs = 0): boolean {
  const value = parseNumber(input);
  if (value === null) return false;
  return Math.abs(value - answer) <= Math.max(Math.abs(answer) * rel, abs);
}
