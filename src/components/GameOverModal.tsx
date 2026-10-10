import React, { useState } from 'react';
import type { BadgeId } from '../game/storage';
import { BADGES, MODES, STAR_BARS } from '../game/storage';
import { useDialogFocus } from './useDialogFocus';

interface GameOverModalProps {
  score: number;
  level: number;
  wave: number;
  seconds: number;
  victory: boolean;
  modeName: string;
  stars: number;
  bestScore: number;
  isNewBest: boolean;
  isNewStars: boolean;
  newBadges: BadgeId[];
  onRestart: () => void;
  onMenu: () => void;
}

function fmtTime(s: number) {
  return `${Math.floor(s / 60)}m ${Math.floor(s % 60).toString().padStart(2, '0')}s`;
}

function starRow(n: number) {
  return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ score, level, wave, seconds, victory, modeName, stars, bestScore, isNewBest, isNewStars, newBadges, onRestart, onMenu }) => {
  const [copied, setCopied] = useState(false);
  const [shareFailed, setShareFailed] = useState(false);
  const dialogRef = useDialogFocus();
  const currentMode = MODES.find((mode) => mode.name === modeName)?.id ?? 1;
  const nextStar = STAR_BARS[currentMode].find((target) => target > score);

  const handleShare = async () => {
    const starTxt = stars > 0 ? ` ${starRow(stars)}` : '';
    const text = victory
      ? `🌅 I HELD UNTIL DAWN in ZESA Survivor (${modeName})!${starTxt} ${fmtTime(seconds)} · Wave 5/5 · Score ${score.toLocaleString()}. Beat my grid: ${window.location.href}`
      : `⚡ ZESA Survivor (${modeName})${starTxt}: ${fmtTime(seconds)}, Wave ${wave}/5, Level ${level}, ${score.toLocaleString()} pts! Play 100% offline: ${window.location.href}`;
    setShareFailed(false);
    try {
      if (navigator.share) {
        await navigator.share({ title: 'ZESA Survivor', text, url: window.location.href });
        return;
      }
      if (!navigator.clipboard) throw new Error('no clipboard');
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      // Fallback for insecure contexts / denied permissions
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        setShareFailed(true);
      }
    }
  };

  return (
    <div ref={dialogRef} className="absolute inset-0 overflow-y-auto bg-slate-950/90 backdrop-blur-md flex items-start justify-center p-4 z-50" role="dialog" aria-modal="true" aria-label={victory ? 'Victory' : 'Game over'}>
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl">
        <div className="text-4xl mb-2" aria-hidden>{victory ? '🌅' : '💥'}</div>
        <h2 className={`text-2xl font-black mb-1 ${victory ? 'text-amber-400' : 'text-red-500'}`}>
          {victory ? 'HELD UNTIL DAWN' : 'GRID OVERLOAD'}
        </h2>
        <p className="text-slate-400 text-sm mb-6">
          {victory ? 'The township wakes with power. Legendary shift.' : 'Your battery ran out of juice!'}
        </p>

        <div className="bg-slate-800/50 p-4 rounded-xl mb-4 border border-slate-700/50">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">{modeName} · Final Score</div>
          <div className="text-3xl font-black text-amber-400 mb-1 tabular-nums">{score.toLocaleString()}</div>
          <div className="text-lg text-amber-300 tabular-nums" aria-label={`${stars} of 3 stars`}>{starRow(stars)}</div>
          <div className="text-xs text-indigo-400 font-semibold">
            {victory ? `Wave 5/5 · ${fmtTime(seconds)} · Level ${level}` : `Wave ${wave}/5 · ${fmtTime(seconds)} · Level ${level}`}
          </div>
          {(isNewBest || isNewStars) && (
            <div className="mt-2 flex justify-center gap-2 text-xs font-black">
              {isNewBest && <span className="text-emerald-400">🏆 NEW {modeName.toUpperCase()} BEST!</span>}
              {isNewStars && <span className="text-amber-300">⭐ NEW STARS!</span>}
            </div>
          )}
          {!isNewBest && bestScore > 0 && (
            <div className="mt-1 text-[11px] text-slate-400 tabular-nums">BEST {bestScore.toLocaleString()}</div>
          )}
        </div>

        {nextStar && <p className="text-sm text-slate-300 mb-4">{(nextStar - score).toLocaleString()} more points to your next star.</p>}

        {newBadges.length > 0 && (
          <div className="bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl mb-4">
            <div className="text-amber-400 text-xs font-black uppercase mb-1">Badges unlocked</div>
            {newBadges.map((id) => {
              const b = BADGES.find((x) => x.id === id);
              return b ? <div key={id} className="text-xs text-amber-200">🏅 {b.name} — {b.desc}</div> : null;
            })}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <button autoFocus onClick={onRestart} className="w-full bg-amber-400 hover:bg-amber-300 text-slate-950 font-black py-3 px-4 rounded-xl transition shadow-lg">Play Again</button>
          <button
            onClick={handleShare}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
          >
            <span aria-hidden>💬</span>
            <span>{copied ? 'Copied to Clipboard!' : 'Flex on WhatsApp'}</span>
          </button>
          {shareFailed && <p className="text-xs text-red-400">Share failed — copy the URL manually.</p>}

          <button
            onClick={onMenu}
            className="w-full bg-transparent border border-slate-600 text-slate-300 font-bold py-2.5 px-4 rounded-xl text-sm"
          >
            Modes & loadout
          </button>
        </div>
      </div>
    </div>
  );
};
