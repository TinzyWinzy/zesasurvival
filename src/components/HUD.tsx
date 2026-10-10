import React from 'react';

interface HUDProps {
  score: number; level: number; hp: number; maxHp: number;
  xp: number; nextXp: number; combo: number; comboFrac: number;
  nextOrb: number; surgeLeft: number; freezeLeft: number;
  bestScore: number; wave: number; timeLeft: number; gauge: number;
  endless: boolean; isOffline: boolean;
  onRefreshPWA?: () => void; needRefresh: boolean;
}
const COLORS: Record<number, string> = {1: '#C87533', 2: '#F59E0B', 3: '#FDE047'};
export const HUD: React.FC<HUDProps> = ({score, level, hp, maxHp, xp, nextXp,
  combo, comboFrac, nextOrb, surgeLeft, freezeLeft, bestScore, wave,
  timeLeft, gauge, endless, isOffline}) => {
  const health = Math.min(100, Math.max(0, hp / Math.max(1, maxHp) * 100));
  const experience = Math.min(100, Math.max(0, xp / Math.max(1, nextXp) * 100));
  const minutes = Math.floor(Math.max(0, timeLeft) / 60);
  const seconds = Math.floor(Math.max(0, timeLeft) % 60).toString().padStart(2, '0');
  const charged = gauge >= 100;
  return (
    <div className="game-hud absolute top-0 inset-x-0 z-10 pointer-events-none px-3 pt-3">
      <div className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1.5 rounded-lg border border-slate-600/40 bg-slate-950/90 px-3 py-2.5">
        <div className="flex justify-between items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.16em] font-bold text-cyan-200">Battery</span>
          <span className={`text-xs font-bold tabular-nums ${health < 30 ? 'text-red-300' : 'text-white'}`}>{Math.ceil(hp)}/{maxHp}</span>
        </div>
        <div className="row-span-2 text-right leading-none">
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">{endless ? 'Overtime' : 'Dawn in'}</div>
          <div className="text-xl font-black text-amber-200 tabular-nums mt-1">{minutes}:{seconds}</div>
        </div>
        <div className="h-2 bg-slate-800 overflow-hidden rounded-sm" role="progressbar" aria-label="Player HP" aria-valuenow={Math.round(health)} aria-valuemin={0} aria-valuemax={100}>
          <div className={`h-full ${health < 30 ? 'bg-red-400' : 'bg-cyan-300'}`} style={{width: `${health}%`}} />
        </div>
        <div className="col-span-2 flex items-center justify-between gap-2 text-[11px] text-slate-300 tabular-nums">
          <span className="font-bold text-white">{score.toLocaleString()} <span className="text-slate-400 font-normal">pts</span></span>
          <span>W{wave}/5 · L{level}</span>
          <span className="flex items-center gap-1.5" aria-label={`Next cell level ${nextOrb}`}><span className="w-2.5 h-2.5 rounded-full" style={{background: COLORS[nextOrb]}} />Next L{nextOrb}</span>
        </div>
        <div className="col-span-2 h-0.5 bg-slate-800" role="progressbar" aria-label="Level XP" aria-valuenow={Math.round(experience)} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-amber-300/70" style={{width: `${experience}%`}} /></div>
      </div>
      <div className="flex flex-wrap gap-2 items-center mt-2 text-[10px] font-bold tabular-nums">
        <span className={`px-2 py-1 rounded border ${charged ? 'bg-lime-300 border-lime-200 text-slate-950' : 'bg-slate-950/80 border-slate-700 text-lime-200'}`} role="progressbar" aria-label="Drop charge" aria-valuenow={Math.round(Math.min(100, gauge))} aria-valuemin={0} aria-valuemax={100}>{charged ? 'CHARGED · NEXT DROP L4' : `CHARGE ${Math.floor(gauge)}%`}</span>
        {combo >= 2 && <span className="text-amber-200">CHAIN ×{Math.min(combo,8)}<span className="inline-block ml-1.5 h-0.5 bg-amber-300 align-middle" style={{width: `${comboFrac * 20}px`}} /></span>}
        {surgeLeft > 0 && <span className="text-amber-200">SURGE {Math.ceil(surgeLeft)}s</span>}
        {freezeLeft > 0 && <span className="text-cyan-200">FREEZE {Math.ceil(freezeLeft)}s</span>}
        {isOffline && <span className="text-emerald-300">OFFLINE</span>}
        {bestScore > 0 && <span className="ml-auto text-slate-400">BEST {bestScore.toLocaleString()}</span>}
      </div>
    </div>
  );
};
