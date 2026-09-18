/**
 * The course-wide travelling wave: y(x, t) = A cos(ωt − kx + φ).
 *
 * Cosine is even, so this is the same wave as A cos(kx − ωt + φ). The ωt − kx order is
 * the one the whole course uses, because it matches Module 0's counterclockwise e^{iωt}
 * and the ∂/∂t → +iω rule that later modules need.
 */
export type Wave1D = { amplitude: number; waveNumber: number; angularFrequency: number; phase: number };

export type Marker = { id: string; at: number };

const argument = (w: Wave1D, x: number, t: number) => w.angularFrequency * t - w.waveNumber * x + w.phase;

export const displacement = (w: Wave1D, x: number, t: number) => w.amplitude * Math.cos(argument(w, x, t));

/** ∂y/∂t: how fast this one piece of the medium is moving. This is not the wave speed. */
export const particleVelocity = (w: Wave1D, x: number, t: number) =>
  -w.amplitude * w.angularFrequency * Math.sin(argument(w, x, t));

/** ∂²y/∂t². */
export const transverseAcceleration = (w: Wave1D, x: number, t: number) =>
  -w.amplitude * w.angularFrequency ** 2 * Math.cos(argument(w, x, t));

/** ∂y/∂x: the slope of the frozen snapshot. For a transverse wave this is not the strain. */
export const slope = (w: Wave1D, x: number, t: number) =>
  w.amplitude * w.waveNumber * Math.sin(argument(w, x, t));

/** ∂²y/∂x²: the curvature, valid as written only while the slope stays small. */
export const curvature = (w: Wave1D, x: number, t: number) =>
  -w.amplitude * w.waveNumber ** 2 * Math.cos(argument(w, x, t));

/**
 * For a longitudinal wave the same function is the displacement ξ of the medium along x,
 * and the pressure change is p = −B ∂ξ/∂x — a quarter cycle out of step with ξ.
 */
export const pressure = (w: Wave1D, x: number, t: number, bulkModulus: number) =>
  -bulkModulus * slope(w, x, t);

export const waveSpeed = (w: Wave1D) => w.angularFrequency / w.waveNumber;
export const period = (w: Wave1D) => (2 * Math.PI) / w.angularFrequency;
export const wavelengthOf = (w: Wave1D) => (2 * Math.PI) / w.waveNumber;
export const maxParticleSpeed = (w: Wave1D) => Math.abs(w.amplitude * w.angularFrequency);

/** Builds the wave from the two quantities a student reads off the two graphs. */
export function fromLambdaAndPeriod(amplitude: number, lambda: number, periodSeconds: number, phase = 0): Wave1D {
  return {
    amplitude,
    waveNumber: (2 * Math.PI) / lambda,
    angularFrequency: (2 * Math.PI) / periodSeconds,
    phase,
  };
}

/** Which marker a pointer landed nearest. Used to decide what a drag is grabbing. */
export function nearestMarker(value: number, markers: Marker[]): string {
  let best = markers[0];
  for (const marker of markers) {
    if (Math.abs(marker.at - value) < Math.abs(best.at - value)) best = marker;
  }
  return best.id;
}

export const measuredSpeed = (distance: number, time: number) => (time === 0 ? 0 : distance / time);
