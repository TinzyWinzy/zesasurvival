export type RunMode = 0 | 1 | 2; // blitz | standard | endless

export const MODES: { id: RunMode; name: string; desc: string; total: number }[] = [
  { id: 0, name: 'Blitz', desc: '3:00 sprint', total: 180 },
  { id: 1, name: 'Standard', desc: '5:00 hold until dawn', total: 300 },
  { id: 2, name: 'Endless', desc: 'no dawn. how long?', total: 0 }
];

// Tuned 10 Oct 2026 against a real Standard best of 348,000 (n=1).
// 1★ rewards a decent run, 2★ solid play, 3★ sits above the known best so
// the top star stays a chase. Revisit once a few more players log shifts.
export const STAR_BARS: Record<RunMode, [number, number, number]> = {
  0: [15000, 90000, 240000],
  1: [25000, 150000, 400000],
  2: [20000, 120000, 350000]
};

export function starsFor(mode: RunMode, score: number): 0 | 1 | 2 | 3 {
  const [s1, s2, s3] = STAR_BARS[mode];
  if (score >= s3) return 3;
  if (score >= s2) return 2;
  if (score >= s1) return 1;
  return 0;
}

export interface RunRecord {
  score: number;
  level: number;
  combo: number;
  merges: number;
  seconds: number;
  wave: number;
  victory: boolean;
  mode: RunMode;
  stars: number;
  date: string;
}

export interface Highs {
  bestScore: number;
  bestScores: Record<RunMode, number>;
  bestLevel: number;
  bestCombo: number;
  totalMerges: number;
  bestStars: Record<RunMode, number>;
  runs: RunRecord[];
}

export type BadgeId = 'first-light' | 'bright-spark' | 'township-grid' | 'kariba' | 'survivor' | 'dawn';

export interface Badge {
  id: BadgeId;
  name: string;
  desc: string;
}

export const BADGES: Badge[] = [
  { id: 'first-light', name: 'First Light', desc: 'First merge' },
  { id: 'bright-spark', name: 'Bright Spark', desc: 'Combo x3' },
  { id: 'township-grid', name: 'Township Grid', desc: '150,000 pts in one run' },
  { id: 'kariba', name: 'Kariba', desc: 'Reach Level 5' },
  { id: 'survivor', name: 'Survivor', desc: 'Survive 180s' },
  { id: 'dawn', name: 'Dawn Breaker', desc: 'Survive all 5 waves' }
];

const HIGHS_KEY = 'zesa.v1.highs';
const BADGE_KEY = 'zesa.v1.badges';

const emptyHighs = (): Highs => ({
  bestScore: 0,
  bestScores: { 0: 0, 1: 0, 2: 0 },
  bestLevel: 1,
  bestCombo: 0,
  totalMerges: 0,
  bestStars: { 0: 0, 1: 0, 2: 0 },
  runs: []
});

export function loadHighs(): Highs {
  try {
    const raw = localStorage.getItem(HIGHS_KEY);
    if (!raw) return emptyHighs();
    const p = JSON.parse(raw) as Partial<Highs>;
    const oldRuns = (Array.isArray(p.runs) ? p.runs : []) as Partial<RunRecord>[];
    const runs = oldRuns.slice(0, 5).map((r) => ({
      score: r.score ?? 0,
      level: r.level ?? 1,
      combo: r.combo ?? 0,
      merges: r.merges ?? 0,
      seconds: r.seconds ?? 0,
      wave: r.wave ?? 1,
      victory: r.victory ?? false,
      mode: (r.mode ?? 1) as RunMode,
      stars: r.stars ?? 0,
      date: r.date ?? ''
    }));
    // Legacy saves have no per-mode scores. Credit each mode from its own
    // run history where possible — never leak an Endless score into Blitz.
    const seeded: Record<RunMode, number> = { 0: 0, 1: 0, 2: 0 };
    for (const r of runs) seeded[r.mode] = Math.max(seeded[r.mode], r.score);
    const stored = p.bestScores;
    return {
      bestScore: p.bestScore ?? 0,
      bestScores: {
        0: stored?.[0] ?? seeded[0],
        1: stored?.[1] ?? seeded[1],
        2: stored?.[2] ?? seeded[2]
      },
      bestLevel: p.bestLevel ?? 1,
      bestCombo: p.bestCombo ?? 0,
      totalMerges: p.totalMerges ?? 0,
      bestStars: { 0: p.bestStars?.[0] ?? 0, 1: p.bestStars?.[1] ?? 0, 2: p.bestStars?.[2] ?? 0 },
      runs
    };
  } catch {
    return emptyHighs();
  }
}

export function recordRun(r: RunRecord): Highs {
  const h = loadHighs();
  h.bestScore = Math.max(h.bestScore, r.score);
  h.bestScores[r.mode] = Math.max(h.bestScores[r.mode], r.score);
  h.bestLevel = Math.max(h.bestLevel, r.level);
  h.bestCombo = Math.max(h.bestCombo, r.combo);
  h.totalMerges += r.merges;
  h.bestStars[r.mode] = Math.max(h.bestStars[r.mode], r.stars);
  h.runs = [r, ...h.runs].slice(0, 5);
  try {
    localStorage.setItem(HIGHS_KEY, JSON.stringify(h));
  } catch { /* storage full/blocked */ }
  return h;
}

export function loadBadges(): BadgeId[] {
  try {
    const raw = localStorage.getItem(BADGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as string[];
    return arr.filter((x): x is BadgeId => BADGES.some((b) => b.id === x));
  } catch {
    return [];
  }
}

/** Unlocks badges, returns newly unlocked ones. */
export function unlockBadges(ids: BadgeId[]): BadgeId[] {
  const have = new Set(loadBadges());
  const fresh = ids.filter((i) => !have.has(i));
  if (fresh.length === 0) return [];
  fresh.forEach((i) => have.add(i));
  try {
    localStorage.setItem(BADGE_KEY, JSON.stringify([...have]));
  } catch { /* ignore */ }
  return fresh;
}

export function checkBadges(args: {
  merges: number;
  combo: number;
  score: number;
  level: number;
  seconds: number;
  victory: boolean;
}): BadgeId[] {
  const toUnlock: BadgeId[] = [];
  if (args.merges >= 1) toUnlock.push('first-light');
  if (args.combo >= 3) toUnlock.push('bright-spark');
  if (args.score >= 150000) toUnlock.push('township-grid');
  if (args.level >= 5) toUnlock.push('kariba');
  if (args.seconds >= 180) toUnlock.push('survivor');
  if (args.victory) toUnlock.push('dawn');
  return unlockBadges(toUnlock);
}
