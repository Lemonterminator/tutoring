export type AttentionExplorerInputs = {
  sentence?: string[];
  layer?: number;
  head?: number;
  attention?: number[][];
  qk_scores?: number[][];
  ov_summary?: number[][];
};

function clampInteger(value: unknown, minimum: number, maximum: number, fallback: number): number {
  const parsed = Math.floor(Number(value));
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function softmax(values: number[]): number[] {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

function fixture(length: number, layer: number, head: number) {
  const scores = Array.from({ length }, (_, query) =>
    Array.from({ length }, (_, key) => {
      const distance = Math.abs(query - key);
      const directional = ((layer + 1) * (key + 1) - (head + 2) * (query + 1)) * 0.013;
      return -0.45 * distance + directional + (query === key ? 0.35 : 0);
    }),
  );
  const attention = scores.map(softmax);
  const ovSummary = attention.map((row) => [
    row.reduce((sum, value, index) => sum + value * Math.cos(index), 0),
    row.reduce((sum, value, index) => sum + value * Math.sin(index), 0),
  ]);
  return { scores, attention, ovSummary };
}

function finiteMatrix(matrix: number[][], fallback: number[][]): number[][] {
  if (!Array.isArray(matrix) || matrix.length === 0) return fallback;
  const width = matrix.length;
  if (!matrix.every((row) => Array.isArray(row) && row.length === width)) return fallback;
  if (!matrix.every((row) => row.every((value) => Number.isFinite(Number(value))))) return fallback;
  return matrix.map((row) => row.map(Number));
}

function normalizeRows(matrix: number[][]): number[][] {
  return matrix.map((row) => {
    const clipped = row.map((value) => Math.max(0, value));
    const total = clipped.reduce((sum, value) => sum + value, 0);
    return total > 0 ? clipped.map((value) => value / total) : clipped.map(() => 1 / clipped.length);
  });
}

export function compute(inputs: AttentionExplorerInputs = {}) {
  const sentence = Array.isArray(inputs.sentence) && inputs.sentence.length > 0
    ? inputs.sentence.map(String)
    : ["the", "cat", "sat", "down"];
  const layer = clampInteger(inputs.layer, 0, 31, 0);
  const head = clampInteger(inputs.head, 0, 31, 0);
  const generated = fixture(sentence.length, layer, head);
  const qkScores = finiteMatrix(inputs.qk_scores ?? [], generated.scores);
  const attention = normalizeRows(finiteMatrix(inputs.attention ?? [], generated.attention));
  const ovSummary = finiteMatrix(inputs.ov_summary ?? [], generated.ovSummary);
  const rowSums = attention.map((row) => row.reduce((sum, value) => sum + value, 0));
  const argmaxSource = attention.map((row) => row.indexOf(Math.max(...row)));
  const rowEntropy = attention.map((row) => row.reduce((sum, value) => sum - (value > 0 ? value * Math.log(value) : 0), 0));
  return { sentence, layer, head, attention, qkScores, ovSummary, rowSums, argmaxSource, rowEntropy };
}
