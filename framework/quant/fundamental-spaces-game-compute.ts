export type FundamentalSpaceScenario = { m: number; n: number; r: number };
export type FundamentalSpacesRound = { seed: number; challenge: FundamentalSpaceScenario };

export const lectureExample: FundamentalSpaceScenario = { m: 3, n: 4, r: 2 };

const challenges: FundamentalSpaceScenario[] = [
  { m: 2, n: 3, r: 1 },
  { m: 2, n: 4, r: 1 },
  { m: 3, n: 2, r: 1 },
  { m: 3, n: 5, r: 2 },
  { m: 4, n: 2, r: 1 },
  { m: 5, n: 3, r: 2 },
];

/** Pure seeded selection from reviewed, valid (m, n, rank) examples. */
export function generateFundamentalSpacesRound(seed: number): FundamentalSpacesRound {
  const normalized = seed >>> 0;
  const challenge = challenges[normalized % challenges.length];
  return { seed: normalized, challenge: { ...challenge } };
}

export function fundamentalSpacesRoundSignature(round: FundamentalSpacesRound): string {
  const { m, n, r } = round.challenge;
  return `${m}x${n}:rank-${r}`;
}
