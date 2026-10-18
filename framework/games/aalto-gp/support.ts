/**
 * The GP games use the MIT 18.02SC deck builder and formatting helpers unchanged (same card contract, same structural tests).
 * Import from here, not from the MIT folder, so a later move of the shared helpers touches one line.
 */
export { makeMvDeck as makeGpDeck, num, piTerm, power, exact, par, term, coef, gcd, frac, vec, linear } from '../mit-multivariable-calculus/support';
export type { Text, GeneratorMap, NumberSpec, ChoiceSpec, SymbolSpec, FigureSpec } from '../mit-multivariable-calculus/support';

/** A matrix in the MathText matrix syntax, rows of already formatted entries: mat([['5/4', '3/4'], ['3/4', '5/4']]) = "[[5/4, 3/4], [3/4, 5/4]]". */
export function mat(rows: readonly (readonly string[])[]): string {
  return `[[${rows.map(row => row.join(', ')).join('], [')}]]`;
}
