/** Exact two-state reweighting for the no-dividend, zero-rate example in BS1. */
export function reweightTwoStates(pUp: number) {
  if (!Number.isFinite(pUp) || pUp <= 0 || pUp >= 1) {
    throw new RangeError('Both physical states must have positive probability.');
  }
  const rows = [
    { state: 'up' as const, stock: 120, payoff: 20, p: pUp, q: 0.5 },
    { state: 'down' as const, stock: 80, payoff: 0, p: 1 - pUp, q: 0.5 },
  ].map(row => ({ ...row, weight: row.q / row.p }));
  return {
    rows,
    mass: rows.reduce((sum, row) => sum + row.p * row.weight, 0),
    physicalPayoff: rows.reduce((sum, row) => sum + row.p * row.payoff, 0),
    weightedPayoff: rows.reduce((sum, row) => sum + row.p * row.weight * row.payoff, 0),
    weightedStock: rows.reduce((sum, row) => sum + row.p * row.weight * row.stock, 0),
  };
}
