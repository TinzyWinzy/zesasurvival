import React, { useState } from 'react';
import {
  MODES,
  BADGES,
  STAR_BARS,
  type RunMode,
  type RunRecord,
  type BadgeId
} from '../game/storage';

export type Loadout = 1 | 2 | 3;

const LOADOUTS: { id: Loadout; name: string; desc: string }[] = [
  { id: 1, name: 'Charged Cells', desc: '+50 drop gauge at start' },
  { id: 2, name: 'Reinforced Hull', desc: '+25 max battery, heal 25' },
  { id: 3, name: 'Overclocked Coils', desc: 'Surge blast first 10s' }
];

interface Props {
  bestStars: Record<RunMode, number>;
  bestScores: Record<RunMode, number>;
  runs: RunRecord[];
  badges: BadgeId[];
  offlineReady: boolean;
  needRefresh: boolean;
  onRefresh: () => void;
  onStart: (mode: RunMode, loadout: Loadout) => void;
}

function stars(n: number) {
  return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

const LoadoutIcon: React.FC<{ id: Loadout; className?: string }> = ({ id, className }) => {
  const common = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.8, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, className, 'aria-hidden': true };
  if (id === 1) return (<svg {...common}><rect x="3" y="7" width="15" height="10" rx="2" /><path d="M18 10h2v4h-2" /><path d="M11 9l-2.5 3.5H11l-1.5 2.5" /></svg>);
  if (id === 2) return (<svg {...common}><path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" /></svg>);
  return (<svg {...common}><path d="M13 2L5 13h5l-1 9 9-12h-5z" /></svg>);
};

/** Signature: pylon mast + sagging transmission wire. */
const WireRule: React.FC = () => (
  <svg viewBox="0 0 320 16" className="w-full h-4 my-2.5 text-slate-400" preserveAspectRatio="none" aria-hidden>
    <path d="M6 2 V14 M2 6 H10 M3 10 H9" stroke="currentColor" strokeWidth="1" fill="none" />
    <path d="M6 4 Q160 15 314 4" stroke="currentColor" strokeWidth="1" fill="none" opacity="0.7" />
    <path d="M314 2 V14 M310 6 H318 M311 10 H317" stroke="currentColor" strokeWidth="1" fill="none" />
  </svg>
);

const SectionLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-center gap-2 mb-2">
    <span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-400 whitespace-nowrap">{children}</span>
    <span className="h-px flex-1 bg-slate-800" />
  </div>
);

const MODE_DURATION: Record<RunMode, string> = { 0: '3:00', 1: '5:00', 2: '∞' };

export const ModeMenu: React.FC<Props> = ({ bestStars, bestScores, runs, badges, offlineReady, needRefresh, onRefresh, onStart }) => {
  const [mode, setMode] = useState<RunMode>(1);
  const [loadout, setLoadout] = useState<Loadout>(1);

  const bars = STAR_BARS[mode];
  const myBest = bestScores[mode] ?? 0;
  const nextStarIdx = bars.findIndex((b) => myBest < b);
  const nextStarTarget = nextStarIdx === -1 ? null : bars[nextStarIdx];
  const unlocked = new Set(badges);
  const loadoutName = LOADOUTS.find((l) => l.id === loadout)?.name ?? '';

  return (
    <div className="absolute inset-0 z-40" role="dialog" aria-modal="true" aria-label="Choose run">
      <div className="menu-board absolute inset-0" aria-hidden />
      <div className="menu-grid absolute inset-0" aria-hidden />

      <div className="relative h-full overflow-y-auto">
        <div className="w-full max-w-sm mx-auto px-4 pt-7 pb-28">

          {/* Header: utility-board identity */}
          <div className="flex items-center gap-3 mb-1">
            <svg viewBox="0 0 28 32" className="w-7 h-8 text-amber-400 shrink-0" fill="none" aria-hidden>
              <path d="M14 2 L4 30 M14 2 L24 30 M7 22 H21 M9 16 H19 M11 10 H17" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              <path d="M14 6 L10 15 H15 L12 24" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />
            </svg>
            <div>
              <h1 className="text-xl font-black text-white tracking-[0.12em] title-glow leading-none">ZESA SURVIVOR</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-amber-500/80 mt-1">Load-shedding survival</p>
            </div>
          </div>
          <p className="text-slate-400 text-[11px] tabular-nums mt-2 mb-1">
            {myBest > 0 ? `LAST BEST · ${MODES[mode].name.toUpperCase()} · ${myBest.toLocaleString()}` : 'HOLD THE GRID UNTIL DAWN'}
          </p>

          <WireRule />

          <div className="rounded-lg border border-slate-700 bg-slate-900/80 p-3 mb-4 text-sm text-slate-300">
            <p className="font-bold text-amber-300 mb-1">Hold the grid until dawn</p>
            <p>Drop matching cells together to merge. Merges blast enemies and fire a beam toward your battery.</p>
            <p className="mt-2">Move the battery to dodge threats and collect energy. A full charge powers your next drop.</p>
            <p className="mt-2 text-xs text-slate-400">Touch: hold to aim, slide to move, release to drop. Mouse: move to dodge, click to drop. Keyboard: focus the arena, use ←/→ and Space.</p>
          </div>

          <SectionLabel>Shift schedule</SectionLabel>
          <div className="flex flex-col gap-1.5 mb-1">
            {MODES.map((m) => {
              const sel = mode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setMode(m.id)}
                  aria-pressed={sel}
                  className={`text-left rounded-lg border transition-colors flex items-stretch overflow-hidden ${
                    sel ? 'border-amber-400/60 bg-amber-500/[0.07]' : 'border-slate-800 bg-slate-900/60 hover:bg-slate-900'
                  }`}
                >
                  <span className={`w-1 shrink-0 ${sel ? 'bg-amber-400' : 'bg-slate-800'}`} aria-hidden />
                  <span className={`w-14 shrink-0 flex items-center justify-center border-r tabular-nums text-lg font-black ${
                    sel ? 'text-amber-300 border-amber-400/25' : 'text-slate-400 border-slate-800'
                  }`}>
                    {MODE_DURATION[m.id]}
                  </span>
                  <span className="flex-1 px-3 py-2.5 min-w-0">
                    <span className="flex justify-between items-center gap-2">
                      <span className={`font-black text-sm tracking-wide ${sel ? 'text-white' : 'text-slate-300'}`}>{m.name}</span>
                      <span className={`text-xs tabular-nums ${sel ? 'text-amber-400' : 'text-slate-400'}`} aria-label={`${bestStars[m.id]} of 3 stars`}>
                        {stars(bestStars[m.id])}
                      </span>
                    </span>
                    <span className="flex justify-between items-center gap-2 mt-0.5">
                      <span className="text-slate-400 text-[11px] truncate">{m.desc}</span>
                      <span className="text-slate-400 text-[10px] tabular-nums shrink-0">
                        {(bestScores[m.id] ?? 0) > 0 ? `BEST ${(bestScores[m.id] ?? 0).toLocaleString()}` : ''}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          {nextStarTarget !== null && (
            <p className="text-[10px] text-slate-400 tabular-nums mb-3 px-0.5">
              {nextStarIdx === 0 ? 'FIRST STAR' : `${nextStarIdx + 1}★`} AT {nextStarTarget.toLocaleString()} ON {MODES[mode].name.toUpperCase()}
            </p>
          )}

          <SectionLabel>Line check · 1 free</SectionLabel>
          <div className="grid grid-cols-3 gap-1.5 mb-1">
            {LOADOUTS.map((l) => {
              const sel = loadout === l.id;
              return (
                <button
                  key={l.id}
                  onClick={() => setLoadout(l.id)}
                  aria-pressed={sel}
                  className={`rounded-lg border p-2.5 text-center transition-colors ${
                    sel ? 'border-emerald-400/60 bg-emerald-500/[0.07] text-emerald-300' : 'border-slate-800 bg-slate-900/60 text-slate-400 hover:bg-slate-900'
                  }`}
                >
                  <LoadoutIcon id={l.id} className="w-5 h-5 mx-auto" />
                  <div className={`text-[11px] font-bold mt-1.5 leading-tight ${sel ? 'text-white' : 'text-slate-400'}`}>{l.name}</div>
                  <div className={`text-[11px] mt-0.5 leading-tight ${sel ? 'text-emerald-300' : 'text-slate-400'}`}>{l.desc}</div>
                </button>
              );
            })}
          </div>

          <WireRule />

          <SectionLabel>Shift log</SectionLabel>
          {runs.length > 0 ? (
            <div className="mb-1">
              {runs.slice(0, 5).map((r, i) => (
                <div key={`${r.date}-${i}`} className={`flex items-center justify-between px-1 py-1.5 text-[11px] tabular-nums ${i % 2 ? 'bg-slate-900/40 rounded' : ''}`}>
                  <span className="text-slate-400 w-12">{fmtDate(r.date)}</span>
                  <span className="text-slate-400 font-bold w-14 uppercase text-[10px] tracking-wider">{MODES[r.mode]?.name ?? '?'}</span>
                  <span className="text-amber-400 w-14">{stars(r.stars)}</span>
                  <span className={`font-black w-12 text-right ${r.victory ? 'text-emerald-400' : 'text-slate-200'}`}>
                    {r.score.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400 px-1 mb-1">No shifts logged yet.</p>
          )}

          <SectionLabel>Badges · {badges.length}/{BADGES.length}</SectionLabel>
          <div className="grid grid-cols-3 gap-1.5">
            {BADGES.map((b) => {
              const got = unlocked.has(b.id);
              return (
                <div
                  key={b.id}
                  title={b.desc}
                  className={`rounded-lg px-2 py-1.5 text-center border flex items-center justify-center gap-1 ${
                    got ? 'border-amber-500/40 bg-amber-500/[0.06]' : 'border-slate-900 bg-slate-950/40'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${got ? 'bg-amber-400' : 'bg-slate-800'}`} aria-hidden />
                  <span className={`text-[10px] font-bold leading-tight ${got ? 'text-amber-200' : 'text-slate-700'}`}>
                    {b.name}
                  </span>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-slate-400 text-center mt-5" role="status">{offlineReady ? 'Ready for offline play · no account' : 'Offline play after first download · no account'}</p>
          {needRefresh && <button onClick={onRefresh} className="w-full mt-3 rounded-lg bg-indigo-600 text-white font-bold py-3">Install game update</button>}
        </div>
      </div>

      {/* Breaker-switch CTA: pinned in thumb reach */}
      <div className="absolute bottom-0 inset-x-0 z-10 border-t border-slate-800/80 bg-slate-950/92 backdrop-blur px-4 pt-2.5 pb-[max(0.65rem,env(safe-area-inset-bottom))]">
        <div className="max-w-sm mx-auto">
          <button
            onClick={() => onStart(mode, loadout)}
            className="w-full bg-gradient-to-b from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 active:scale-[0.98] text-slate-950 font-black py-3.5 rounded-xl text-base tracking-wide cta-glow transition flex items-center justify-center gap-2"
          >
            <span aria-hidden className="text-slate-950/50">◀</span>
            <span className="flex flex-col items-center leading-none">
              <span>START SHIFT</span>
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-slate-950/60 mt-1">
                {MODES[mode].name} · {loadoutName}
              </span>
            </span>
            <span aria-hidden className="text-slate-950/50">▶</span>
          </button>
        </div>
      </div>
    </div>
  );
};
