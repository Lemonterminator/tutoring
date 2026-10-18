export type BPEInputs = {
  num_merges: number;
  corpus: "hug_pug_pun_bun_hugs";
};

export type BPEState = { seed: number; step: number; max_steps: number };

type WeightedSequence = { tokens: string[]; weight: number };

const BASE_CORPUS: WeightedSequence[] = [
  { tokens: ["h", "u", "g"], weight: 10 },
  { tokens: ["p", "u", "g"], weight: 5 },
  { tokens: ["p", "u", "n"], weight: 12 },
  { tokens: ["b", "u", "n"], weight: 4 },
  { tokens: ["h", "u", "g", "s"], weight: 5 },
];

function pairKey(left: string, right: string): string {
  return left + "\u0000" + right;
}

function pairCounts(corpus: WeightedSequence[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const sequence of corpus) {
    for (let index = 0; index + 1 < sequence.tokens.length; index += 1) {
      const key = pairKey(sequence.tokens[index], sequence.tokens[index + 1]);
      counts.set(key, (counts.get(key) ?? 0) + sequence.weight);
    }
  }
  return counts;
}

function tokenCount(corpus: WeightedSequence[]): number {
  return corpus.reduce((total, sequence) => total + sequence.tokens.length * sequence.weight, 0);
}

function merge(corpus: WeightedSequence[], left: string, right: string): { corpus: WeightedSequence[]; reductions: number } {
  const mergedToken = left + right;
  let reductions = 0;
  const next: WeightedSequence[] = [];
  for (const sequence of corpus) {
    const tokens: string[] = [];
    let index = 0;
    while (index < sequence.tokens.length) {
      if (index + 1 < sequence.tokens.length && sequence.tokens[index] === left && sequence.tokens[index + 1] === right) {
        tokens.push(mergedToken);
        reductions += sequence.weight;
        index += 2;
      } else {
        tokens.push(sequence.tokens[index]);
        index += 1;
      }
    }
    next.push({ tokens, weight: sequence.weight });
  }
  return { corpus: next, reductions };
}

function serializePairCounts(counts: Map<string, number>): Array<{ pair: [string, string]; count: number }> {
  return [...counts.entries()]
    .map(([key, count]) => {
      const [left, right] = key.split("\u0000");
      return { pair: [left, right] as [string, string], count };
    })
    .sort((a, b) => b.count - a.count || a.pair.join("").localeCompare(b.pair.join("")));
}

export function compute(inputs: BPEInputs, state: BPEState) {
  let corpus = BASE_CORPUS.map((sequence) => ({ tokens: [...sequence.tokens], weight: sequence.weight }));
  const history: Array<Record<string, unknown>> = [];
  const snapshots: Array<{ step: number; corpus: WeightedSequence[] }> = [
    { step: 0, corpus: corpus.map((sequence) => ({ tokens: [...sequence.tokens], weight: sequence.weight })) },
  ];
  const requested = Math.max(0, Math.floor(Number(inputs.num_merges)));
  for (let step = 0; step < requested; step += 1) {
    const counts = pairCounts(corpus);
    if (counts.size === 0) break;
    const ranked = serializePairCounts(counts);
    const selected = ranked[0];
    const beforeTokens = tokenCount(corpus);
    const result = merge(corpus, selected.pair[0], selected.pair[1]);
    corpus = result.corpus;
    history.push({
      step: step + 1,
      pair: selected.pair,
      pairCount: selected.count,
      reductions: result.reductions,
      beforeTokens,
      afterTokens: tokenCount(corpus),
    });
    snapshots.push({
      step: step + 1,
      corpus: corpus.map((sequence) => ({ tokens: [...sequence.tokens], weight: sequence.weight })),
    });
  }
  return {
    pairCounts: serializePairCounts(pairCounts(corpus)),
    mergeHistory: history,
    tokenSequences: snapshots[Math.min(state.step, snapshots.length - 1)].corpus,
    snapshots,
    step: state.step,
    reset: state.step === 0,
  };
}
