/** Threshold of hearing, W/m². */
export const I0 = 1e-12;

export const intensityToDb = (intensity: number, ref = I0) => 10 * Math.log10(intensity / ref);
export const dbToIntensity = (level: number, ref = I0) => ref * 10 ** (level / 10);
export const ampRatioToDb = (ratio: number) => 20 * Math.log10(ratio);
export const dbToAmpRatio = (dB: number) => 10 ** (dB / 20);

/** Incoherent sources add intensities, not decibels. */
export const addLevels = (...levels: number[]) => intensityToDb(levels.reduce((sum, level) => sum + dbToIntensity(level), 0));
