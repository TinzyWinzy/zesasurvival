import React from 'react';

interface HUDProps {
  score: number;
  level: number;
  hp: number;
  maxHp: number;
  xp: number;
  nextXp: number;
  combo: number;
  comboFrac: number;
  nextOrb: number;
  surgeLeft: number;
  freezeLeft: number;
  bestScore: number;
  wave: number;
  timeLeft: number;
  gauge: number;
  endless: boolean;
  isOffline: boolean;
  onRefreshPWA?: () => void;
  needRefresh: boolean;
}

const ORB_DOT: Record<number, string> = {
  1: '#C87533',
  2: '#F59E0B',
  3: '#FDE047'
};

export const HUD: React.FC<HUDProps> = ({
  score,
  level,
  hp,
  maxHp,
  xp,
  nextXp,
  combo,
  comboFrac,
  nextOrb,
  surgeLeft,
  freezeLeft,
  bestScore,
  wave,
  timeLeft,
  gauge,
  endless,
  isOffline,
  onRefreshPWA,
  needRefresh
}) => {
  const hpPct = Math.min(100, Math.max(0, (hp / Math.max(1, maxHp)) * 100));
  const xpPct = Math.min(100, Math.max(0, (xp / Math.max(1, nextXp)) * 100));
  const mm = Math.floor(Math.max(0, timeLeft) / 60);
  const ss = Math.floor(Math.max(0, timeLeft) % 60).toString().padStart(2, '0');
  const charged = gauge >= 100;

  return (
    <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex flex-col gap-2 z-10">
      <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur-md p-3 rounded-xl border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl" aria-hidden>⚡</span>
          <div>
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Score</div>
            <div className="text-xl font-black text-white tabular-nums">{score.toLocaleString()}</div>
            {bestScore > 0 && (
              <div className="text-[10px] text-slate-400 tabular-nums">BEST {bestScore.toLocaleString()}</div>
            )}
          </div>
          <div className="flex items-center gap-1.5 ml-1" title={`Next orb: L${nextOrb}`}>
            <span
              className="inline-block w-4 h-4 rounded-full border border-white/40"
              style={{ backgroundColor: ORB_DOT[nextOrb] || '#fff' }}
            />
            <span className="text-[10px] text-slate-300 font-bold">L{nextOrb}</span>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-center px-2">
            <div className="text-[10px] text-red-400 font-black uppercase tracking-wider">Wave {wave}/5</div>
            <div className="text-sm font-black text-white tabular-nums">{mm}:{ss}</div>
            <div className="text-[9px] text-slate-400 uppercase">{endless ? 'survived' : 'to dawn'}</div>
          </div>
          <div className="text-right">
            <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider">
              Level {level} · HP {Math.ceil(hp)}/{maxHp}
            </div>
            <div
              className="w-28 bg-slate-700 h-2.5 rounded-full overflow-hidden mt-1"
              role="progressbar"
              aria-valuenow={Math.round(hpPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Player HP"
            >
              <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${hpPct}%` }} />
            </div>
            <div
              className="w-28 bg-slate-700 h-1.5 rounded-full overflow-hidden mt-1"
              role="progressbar"
              aria-valuenow={Math.round(xpPct)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Level XP"
            >
              <div className="bg-indigo-400 h-full transition-all duration-300" style={{ width: `${xpPct}%` }} />
            </div>
          </div>

          {isOffline && (
            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-semibold border border-emerald-500/30">
              OFFLINE
            </span>
          )}
        </div>
      </div>

      {(combo >= 2 || surgeLeft > 0 || freezeLeft > 0) && (
        <div className="flex gap-2 items-center flex-wrap">
          {combo >= 2 && (
            <div className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black px-2.5 py-1 rounded-full tabular-nums">
              COMBO x{Math.min(combo, 8)}
              <span
                className="inline-block ml-2 h-1 rounded bg-amber-400 align-middle"
                style={{ width: `${Math.round(comboFrac * 40)}px` }}
              />
            </div>
          )}
          {surgeLeft > 0 && (
            <span className="bg-yellow-500/20 border border-yellow-500/40 text-yellow-300 text-xs font-bold px-2.5 py-1 rounded-full tabular-nums">
              ⚡ {Math.ceil(surgeLeft)}s
            </span>
          )}
          {freezeLeft > 0 && (
            <span className="bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 text-xs font-bold px-2.5 py-1 rounded-full tabular-nums">
              ❄️ {Math.ceil(freezeLeft)}s
            </span>
          )}
        </div>
      )}

      <div className="flex gap-2 items-center">
        <span
          className={`text-xs font-black px-2.5 py-1 rounded-full tabular-nums border ${
            charged
              ? 'bg-green-400 text-slate-950 border-green-300 animate-pulse'
              : 'bg-slate-700/60 text-green-300 border-slate-600'
          }`}
          role="progressbar"
          aria-valuenow={Math.round(Math.min(100, gauge))}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Drop charge"
        >
          {charged ? '⚡ CHARGED — tap to slam L4' : `🔋 ${Math.floor(Math.min(100, gauge))}%`}
        </span>
      </div>

      {needRefresh && (
        <div className="pointer-events-auto bg-indigo-600 text-white p-3 rounded-xl flex justify-between items-center shadow-xl">
          <span className="text-sm font-semibold">New update available!</span>
          <button
            onClick={onRefreshPWA}
            className="bg-white text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg shadow hover:bg-indigo-50"
          >
            Update
          </button>
        </div>
      )}
    </div>
  );
};
