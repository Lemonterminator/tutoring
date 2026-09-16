const SUPERSCRIPT: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
};

const power = (e: number) => `10${[...String(e)].map((ch) => SUPERSCRIPT[ch]).join('')}`;

/** Scientific notation as printed in Finnish textbooks: 1.0 × 10⁻⁶. */
export function sci(x: number, digits = 1): string {
  if (x === 0) return '0';
  let exponent = Math.floor(Math.log10(Math.abs(x)) + 1e-9);
  let mantissa = x / 10 ** exponent;
  if (Math.abs(Number(mantissa.toFixed(digits))) >= 10) {
    mantissa /= 10;
    exponent += 1;
  }
  return `${mantissa.toFixed(digits)} × ${power(exponent)}`;
}

export function fixed(x: number, digits = 2): string {
  const s = x.toFixed(digits);
  return Number(s) === 0 ? s.replace('-', '') : s.replace('-', '−');
}
