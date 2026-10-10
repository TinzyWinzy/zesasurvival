/**
 * Base pitch for the whole game. 440 Hz is the ISO standard; 432 Hz sits
 * about 32 cents flat and reads as warmer and darker, which suits a
 * night-shift bed. Every oscillator frequency in audio/ is passed through
 * hz() so one constant retunes music and SFX together — they must stay in
 * tune with each other or the mix rubs.
 */
export const REF_A = 432;
const STANDARD_A = 440;
export const TUNE = REF_A / STANDARD_A;
export const hz = (f: number): number => f * TUNE;
