export type C = { re: number; im: number };

export const c = (re: number, im: number): C => ({ re, im });
export const I = c(0, 1);
export const mul = (a: C, b: C): C => c(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
export const abs = (z: C) => Math.hypot(z.re, z.im);
export const arg = (z: C) => Math.atan2(z.im, z.re);
export const fromPolar = (r: number, theta: number): C => c(r * Math.cos(theta), r * Math.sin(theta));

const round2 = (v: number) => {
  const r = Number(v.toFixed(2));
  return r === 0 ? 0 : r;
};

export function fmt(z: C): string {
  const re = round2(z.re);
  const im = round2(z.im);
  const real = (v: number) => (v < 0 ? `−${-v}` : `${v}`);
  const imaginary = (v: number) => (Math.abs(v) === 1 ? 'i' : `${Math.abs(v)}i`);
  if (im === 0) return real(re);
  if (re === 0) return `${im < 0 ? '−' : ''}${imaginary(im)}`;
  return `${real(re)} ${im < 0 ? '−' : '+'} ${imaginary(im)}`;
}
