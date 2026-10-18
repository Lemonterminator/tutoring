export type NGramInputs = {
  n: number;
  smoothing_lambda: number;
  corpus: "toy_markov" | "toy_words";
};

export type NGramState = { seed: number; step: number; max_steps: number };

type Corpus = { vocab: string[]; train: string[][]; heldout: string[][] };

const CORPORA: Record<NGramInputs["corpus"], Corpus> = {
  toy_markov: {
    vocab: ["a", "b", "c"],
    train: [["a", "b"], ["a", "c"], ["a", "b"], ["b", "c"], ["c", "a"]],
    heldout: [["a", "c"], ["b", "c"], ["c", "a"]],
  },
  toy_words: {
    vocab: ["red", "blue", "green"],
    train: [["red", "blue"], ["blue", "green"], ["green", "red"], ["red", "blue"]],
    heldout: [["blue", "green"], ["red", "green"]],
  },
};

export function compute(inputs: NGramInputs, state: NGramState) {
  const corpus = CORPORA[inputs.corpus] ?? CORPORA.toy_markov;
  const vocabIndex = new Map(corpus.vocab.map((token, index) => [token, index]));
  const size = corpus.vocab.length;
  const counts = Array.from({ length: size }, () => Array<number>(size).fill(0));
  for (const pair of corpus.train) {
    const context = vocabIndex.get(pair[0]);
    const next = vocabIndex.get(pair[1]);
    if (context !== undefined && next !== undefined) counts[context][next] += 1;
  }
  const lambda = Math.max(0, Number(inputs.smoothing_lambda));
  const probabilities = counts.map((row) => {
    const denominator = row.reduce((sum, value) => sum + value, 0) + lambda * size;
    return row.map((value) => (denominator === 0 ? 0 : (value + lambda) / denominator));
  });
  let nll = 0;
  for (const pair of corpus.heldout) {
    const context = vocabIndex.get(pair[0]);
    const next = vocabIndex.get(pair[1]);
    const probability = context === undefined || next === undefined ? 0 : probabilities[context][next];
    nll += -Math.log(Math.max(probability, Number.EPSILON));
  }
  return {
    vocab: corpus.vocab,
    counts,
    probabilities,
    heldoutPerplexity: Math.exp(nll / corpus.heldout.length),
    step: state.step,
    reset: state.step === 0,
  };
}
