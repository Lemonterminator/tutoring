/** y(x, t) = A sin(kx − ωt) */
export type WaveParams = { A: number; k: number; omega: number };

const phase = (p: WaveParams, x: number, t: number) => p.k * x - p.omega * t;

export const y = (p: WaveParams, x: number, t: number) => p.A * Math.sin(phase(p, x, t));
export const dydt = (p: WaveParams, x: number, t: number) => -p.A * p.omega * Math.cos(phase(p, x, t));
export const dydx = (p: WaveParams, x: number, t: number) => p.A * p.k * Math.cos(phase(p, x, t));
export const d2ydx2 = (p: WaveParams, x: number, t: number) => -p.A * p.k * p.k * Math.sin(phase(p, x, t));
export const d2ydt2 = (p: WaveParams, x: number, t: number) => -p.A * p.omega * p.omega * Math.sin(phase(p, x, t));
