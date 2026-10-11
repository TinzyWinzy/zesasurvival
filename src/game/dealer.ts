// Markov next-orb dealer: makes chaining feasible without removing surprise.
//
// Two forces shape every deal:
//   1. Second-order chain memory — streaks persist (L,L -> L at 0.5), else the
//      last level is favored (0.4). Matches get dealt; placement still decides.
//   2. Board bias — any droppable level with 2+ orbs on the field (a merge
//      waiting to happen) pulls +0.2 probability.
// The hottest level caps at 0.65 so the deal never goes deterministic, and an
// empty board deals near-uniform. Pure function of (history, counts, rand) —
// trivially testable with a seeded RNG.

export type DroppableLevel = 1 | 2 | 3;

const STREAK_KEEP = 0.5;
const LAST_FAVOR = 0.4;
const BOARD_PULL = 0.2;
const HOT_CAP = 0.65;

export function dealOrb(
  last: [number, number] | null,
  counts: Record<number, number>,
  rand: () => number = Math.random
): DroppableLevel {
  let p = [1 / 3, 1 / 3, 1 / 3];
  if (last) {
    if (last[0] === last[1]) {
      p = [0.25, 0.25, 0.25];
      p[last[0] - 1] = STREAK_KEEP;
    } else {
      p = [0.3, 0.3, 0.3];
      p[last[1] - 1] = LAST_FAVOR;
    }
  }
  for (let l = 1; l <= 3; l++) {
    if ((counts[l] ?? 0) >= 2) p[l - 1] += BOARD_PULL;
  }
  let total = p[0] + p[1] + p[2];
  p = p.map((v) => v / total);
  // Cap the hottest level, deal the excess to the others proportionally.
  for (let i = 0; i < 3; i++) {
    if (p[i] > HOT_CAP) {
      const excess = p[i] - HOT_CAP;
      p[i] = HOT_CAP;
      const rest = p[(i + 1) % 3] + p[(i + 2) % 3];
      if (rest > 0) {
        p[(i + 1) % 3] += (excess * p[(i + 1) % 3]) / rest;
        p[(i + 2) % 3] += (excess * p[(i + 2) % 3]) / rest;
      }
    }
  }
  const r = rand();
  if (r < p[0]) return 1;
  if (r < p[0] + p[1]) return 2;
  return 3;
}

export interface HoldResult {
  held: number | null;
  next: number;
  locked: boolean;
}

/**
 * Tetris-style hold slot: park the next orb and swap it back later.
 * One hold per drop — swapping locks until the next successful commit.
 * Pure; `deal` supplies the fresh orb when parking into an empty slot.
 */
export function holdSwap(
  held: number | null,
  next: number,
  locked: boolean,
  deal: () => number
): HoldResult {
  if (locked) return { held, next, locked };
  if (held == null) return { held: next, next: deal(), locked: true };
  return { held: next, next: held, locked: true };
}
