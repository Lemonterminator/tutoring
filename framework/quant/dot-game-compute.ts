export type Pair = { u: [number, number]; v: [number, number] };
export type DotRound = { basic: Pair; signed: Pair; geometry: Pair; missing: Pair; transfer: Pair; seed: number };
export const dot = ({ u, v }: Pair) => u[0] * v[0] + u[1] * v[1];

/** Pure bounded generator: the same seed gives the same exercises. */
export function generateDotRound(seed: number): DotRound {
  let state = seed >>> 0;
  const random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
  const small = () => 1 + Math.floor(random() * 3);
  const signed = () => small() * (random() < 0.5 ? -1 : 1);
  const a = small(), b = small(), perpendicular = random() < 0.5;
  const c = signed(), d = signed();
  return {
    seed,
    basic: { u: [small(), small()], v: [small(), small()] },
    signed: { u: [-small(), small()], v: [small(), -small()] },
    geometry: { u: [a, b], v: [b, -a + (perpendicular ? 0 : 1)] },
    missing: { u: [1, c], v: [-c * d, d] },
    transfer: { u: [signed(), signed()], v: [signed(), signed()] },
  };
}
