/**
 * One-dimensional damped wave equation u_tt + 2γ u_t = c² u_xx, by leapfrog.
 *
 * Everything is normalised to c = 1 and L = 1, so Δt = Δx = 1/intervals and the Courant
 * number is exactly 1. At C = 1 the undamped update collapses to
 *     u_i^{n+1} = u_{i+1}^n + u_{i−1}^n − u_i^{n−1}
 * which is dispersion-free: the frequencies of the grid modes equal the exact ones. That
 * is what lets the simulation agree with λ_n = 2L/n and λ_n = 4L/(2n−1) to the digits the
 * lesson prints. Do not change the discretisation.
 */
export type Boundary = 'closed' | 'open';
export type Ends = { left: Boundary; right: Boundary };
export type Drive = { index: number; amplitude: number; angularFrequency: number };

export type Field = {
  intervals: number;
  points: number;
  /** Space step; also the time step, because c = 1 and the Courant number is 1. */
  dx: number;
  time: number;
  prev: Float64Array;
  cur: Float64Array;
  spare: Float64Array;
  envelope: Float64Array;
};

export function createField(intervals: number): Field {
  const points = intervals + 1;
  return {
    intervals,
    points,
    dx: 1 / intervals,
    time: 0,
    prev: new Float64Array(points),
    cur: new Float64Array(points),
    spare: new Float64Array(points),
    envelope: new Float64Array(points),
  };
}

export function reset(f: Field): void {
  f.prev.fill(0);
  f.cur.fill(0);
  f.spare.fill(0);
  f.envelope.fill(0);
  f.time = 0;
}

/** Triangular initial displacement, released from rest. */
export function pluck(f: Field, position: number, height: number): void {
  reset(f);
  const last = f.points - 1;
  const top = Math.min(last - 1, Math.max(1, Math.round(position * last)));
  for (let i = 0; i <= last; i++) {
    f.cur[i] = i <= top ? (height * i) / top : (height * (last - i)) / (last - top);
  }
  f.prev.set(f.cur);
}

export function step(f: Field, ends: Ends, damping: number, drive: Drive | null): void {
  const { cur, prev, spare } = f;
  const last = f.points - 1;
  const gammaDt = damping * f.dx;
  const divide = 1 + gammaDt;
  const keep = 1 - gammaDt;

  for (let i = 1; i < last; i++) {
    spare[i] = (cur[i + 1] + cur[i - 1] - keep * prev[i]) / divide;
  }

  // Closed end: the medium is held still. Open end: ∂u/∂x = 0, imposed with the
  // second-order ghost point u₋₁ = u₁, which turns cur[i+1] + cur[i−1] into 2·cur[1].
  spare[0] = ends.left === 'closed' ? 0 : (2 * cur[1] - keep * prev[0]) / divide;
  spare[last] = ends.right === 'closed' ? 0 : (2 * cur[last - 1] - keep * prev[last]) / divide;

  // The driver pushes one point and pulls its neighbour, so it injects no net momentum.
  // This matters: with both ends open there is nothing holding the column in place, and a
  // one-sided push leaves a permanent rigid displacement that fills in every node. A real
  // sound source works this way too — it squeezes the medium rather than shoving all of it.
  if (drive) {
    const push = drive.amplitude * Math.sin(drive.angularFrequency * f.time);
    spare[drive.index] += push;
    spare[Math.min(last, drive.index + 1)] -= push;
  }

  f.prev = cur;
  f.cur = spare;
  f.spare = prev;
  f.time += f.dx;
}

/** Peak-hold with a leak, so the envelope follows a slowly changing standing pattern. */
export function trackEnvelope(f: Field, decay: number): void {
  const { cur, envelope } = f;
  for (let i = 0; i < f.points; i++) {
    const level = Math.abs(cur[i]);
    envelope[i] = level > envelope[i] ? level : envelope[i] * decay;
  }
}

export function advance(
  f: Field,
  steps: number,
  ends: Ends,
  damping: number,
  drive: Drive | null = null,
  envelopeDecay = 0,
): void {
  for (let s = 0; s < steps; s++) {
    step(f, ends, damping, drive);
    if (envelopeDecay > 0) trackEnvelope(f, envelopeDecay);
  }
}

export function peak(values: Float64Array): number {
  let top = 0;
  for (let i = 0; i < values.length; i++) {
    const size = Math.abs(values[i]);
    if (size > top) top = size;
  }
  return top;
}

/** Value at a fraction of the way along, snapped to the nearest grid point. */
export function sampleAt(f: Field, position: number): number {
  const last = f.points - 1;
  const index = Math.min(last, Math.max(0, Math.round(position * last)));
  return f.cur[index];
}
