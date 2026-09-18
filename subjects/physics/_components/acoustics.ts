/** Wave speeds in m/s, as used in Finnish upper secondary problems (not constants of nature). */
export const V_AIR = 340;
export const V_WATER = 1500;
export const V_TISSUE = 1540;

/** Nominal limits of human hearing, Hz. */
export const HEARING_MIN_HZ = 20;
export const HEARING_MAX_HZ = 20000;

export const wavelength = (speed: number, frequency: number) => speed / frequency;
export const frequencyOf = (speed: number, wavelength: number) => speed / wavelength;
export const angularFrequency = (frequency: number) => 2 * Math.PI * frequency;
export const waveNumber = (wavelength: number) => (2 * Math.PI) / wavelength;

/** Echo sounding: the pulse travels out and back, so it covers twice the distance. */
export const echoDistance = (speed: number, roundTripTime: number) => (speed * roundTripTime) / 2;
