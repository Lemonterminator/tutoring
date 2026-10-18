export type GateTimelineInputs = { text: string; hidden_size: number; seed: number };

function sigmoid(value: number): number {
  return 1 / (1 + Math.exp(-value));
}

function hash(seed: number, unit: number, channel: number): number {
  const value = Math.sin((seed + 1) * 12.9898 + (unit + 1) * 78.233 + (channel + 1) * 37.719) * 43758.5453;
  return (value - Math.floor(value)) * 2 - 1;
}

export function compute(inputs: GateTimelineInputs) {
  const chars = Array.from(inputs.text ?? "").slice(0, 160);
  const hiddenSize = Math.max(1, Math.min(16, Math.floor(Number(inputs.hidden_size) || 1)));
  const h = Array.from({ length: hiddenSize }, () => 0);
  const c = Array.from({ length: hiddenSize }, () => 0);
  const forget: number[][] = [];
  const input: number[][] = [];
  const output: number[][] = [];
  for (const character of chars) {
    const code = character.codePointAt(0) ?? 0;
    const fRow: number[] = [];
    const iRow: number[] = [];
    const oRow: number[] = [];
    for (let unit = 0; unit < hiddenSize; unit += 1) {
      const base = (code / 127 - 0.5) * 0.8;
      const f = sigmoid(0.9 + base + 0.35 * hash(inputs.seed, unit, 0) + 0.25 * h[unit]);
      const i = sigmoid(base + 0.35 * hash(inputs.seed, unit, 1) + 0.2 * h[unit]);
      const o = sigmoid(base + 0.35 * hash(inputs.seed, unit, 2) + 0.2 * h[unit]);
      const g = Math.tanh(base + 0.4 * hash(inputs.seed, unit, 3) + 0.2 * h[unit]);
      c[unit] = f * c[unit] + i * g;
      h[unit] = o * Math.tanh(c[unit]);
      fRow.push(f);
      iRow.push(i);
      oRow.push(o);
    }
    forget.push(fRow);
    input.push(iRow);
    output.push(oRow);
  }
  return { characters: chars, forget, input, output, hiddenSize };
}
