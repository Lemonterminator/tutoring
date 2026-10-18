export type AlignmentInputs = { length: number; mode: "copy" | "reverse"; temperature: number };

function softmax(values: number[]): number[] {
  const maximum = Math.max(...values);
  const exponentials = values.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return exponentials.map((value) => value / total);
}

export function compute(inputs: AlignmentInputs) {
  const length = Math.max(2, Math.min(16, Math.floor(Number(inputs.length) || 2)));
  const temperature = Math.max(0.05, Number(inputs.temperature) || 0.05);
  const alignment = Array.from({ length }, (_, decoderStep) => {
    const target = inputs.mode === "reverse" ? length - 1 - decoderStep : decoderStep;
    return softmax(Array.from({ length }, (_, sourcePosition) => -Math.abs(sourcePosition - target) / temperature));
  });
  return {
    alignment,
    argmaxSource: alignment.map((row) => row.indexOf(Math.max(...row))),
    rowSums: alignment.map((row) => row.reduce((sum, value) => sum + value, 0)),
  };
}
