import type { Ends } from './fdwave';

/**
 * The three cases the syllabus asks about. Every number below is derived from the
 * boundary conditions; none of it is a remembered rule.
 *
 *   string       both ends held still     u = 0 at both ends     k_n L = nπ
 *   open         both ends free           ∂u/∂x = 0 at both      k_n L = nπ
 *   closed-open  one end held, one free   u = 0 and ∂u/∂x = 0    cos(k_n L) = 0
 *
 * For a pipe, u is the displacement of the air. A displacement node is a pressure
 * antinode, so the same picture answers both kinds of question — but only if you say
 * which one you mean.
 */
export type PipeKind = 'string' | 'open' | 'closed-open';

export function endsFor(kind: PipeKind): Ends {
  if (kind === 'string') return { left: 'closed', right: 'closed' };
  if (kind === 'open') return { left: 'open', right: 'open' };
  return { left: 'closed', right: 'open' };
}

/** Wave number of harmonic n, in units where L = 1. */
export function modeWaveNumber(kind: PipeKind, n: number): number {
  return kind === 'closed-open' ? ((2 * n - 1) * Math.PI) / 2 : n * Math.PI;
}

/** In the solver c = 1, so ω and k are the same number. */
export const modeAngularFrequency = (kind: PipeKind, n: number) => modeWaveNumber(kind, n);

/** Wavelength in units of L: 2/n for a string or open pipe, 4/(2n−1) for a closed one. */
export const modeWavelength = (kind: PipeKind, n: number) => (2 * Math.PI) / modeWaveNumber(kind, n);

/**
 * Nodes strictly between the ends. A string held at both ends has a node at each end and
 * n − 1 in between; a pipe open at both ends has an antinode at each end and n nodes
 * inside; a pipe closed at one end has its node at the closed end and n − 1 inside.
 */
export const interiorNodeCount = (kind: PipeKind, n: number) => (kind === 'open' ? n : n - 1);

/** Antinodes anywhere, including at an open end. */
export const antinodeCount = (kind: PipeKind, n: number) => (kind === 'open' ? n + 1 : n);

export const harmonicWavelength = (kind: PipeKind, n: number, length: number) =>
  modeWavelength(kind, n) * length;

export const harmonicFrequency = (kind: PipeKind, n: number, length: number, speed: number) =>
  speed / harmonicWavelength(kind, n, length);

/**
 * Counts nodes by looking at the measured envelope, not by using any formula above.
 *
 * A node is a run of grid points where the envelope stays below a fraction of its peak.
 * A run that touches either edge is discarded: the left edge may be a boundary node, which
 * is not an interior one, and a run still open at the right edge has not been shown to end.
 */
export function nodePositions(envelope: Float64Array, relThreshold = 0.25): number[] {
  let top = 0;
  for (let i = 0; i < envelope.length; i++) if (envelope[i] > top) top = envelope[i];
  if (top <= 0) return [];

  const limit = top * relThreshold;
  const last = envelope.length - 1;
  const found: number[] = [];
  let runStart = -1;
  for (let i = 0; i < envelope.length; i++) {
    const below = envelope[i] < limit;
    if (below && runStart < 0) runStart = i;
    if (!below && runStart >= 0) {
      if (runStart > 0) found.push((runStart + i - 1) / 2 / last);
      runStart = -1;
    }
  }
  return found;
}

export const countNodesFromEnvelope = (envelope: Float64Array, relThreshold = 0.25) =>
  nodePositions(envelope, relThreshold).length;

/** Neighbouring nodes sit half a wavelength apart, so the spacing doubles to give λ. */
export function spacingToWavelength(positions: number[]): number {
  if (positions.length < 2) return 0;
  const spacing = (positions[positions.length - 1] - positions[0]) / (positions.length - 1);
  return 2 * spacing;
}

/** Amplitude of one frequency in a sampled signal, by the Goertzel algorithm. */
export function goertzel(samples: ArrayLike<number>, angularFrequency: number, dt: number): number {
  const w = angularFrequency * dt;
  const coefficient = 2 * Math.cos(w);
  let s1 = 0;
  let s2 = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i] + coefficient * s1 - s2;
    s2 = s1;
    s1 = s;
  }
  const real = s1 - s2 * Math.cos(w);
  const imaginary = s2 * Math.sin(w);
  return (2 * Math.hypot(real, imaginary)) / samples.length;
}
