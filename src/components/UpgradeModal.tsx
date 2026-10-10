import React, { useEffect, useRef } from 'react';

export interface UpgradeChoice {
  id: number;
  title: string;
  desc: string;
  icon: React.ReactNode;
}

interface UpgradeModalProps {
  choices: UpgradeChoice[];
  onSelect: (choiceId: number) => void;
  level: number;
}

const UPGRADE_POOL: UpgradeChoice[] = [
  {
    id: 4,
    title: 'Beam Width & Multi-Shot',
    desc: 'Merge blasts widen +25%, chance to fire 2 parallel beams',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 12h18" />
        <path d="M3 8h18" />
        <path d="M3 16h18" />
      </svg>
    ),
  },
  {
    id: 5,
    title: 'Cryo Nova',
    desc: 'Merges freeze nearby enemies for 2 seconds',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    ),
  },
  {
    id: 6,
    title: 'Chain Lightning Merges',
    desc: 'Merge arcs jump to 2 nearby enemies, dealing 60% damage',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
      </svg>
    ),
  },
  {
    id: 7,
    title: 'Plasma Shield Overcharge',
    desc: '+40 max HP, regain 2 HP/sec while above 50% HP',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
        <path d="M12 6v12M6 12h12" />
      </svg>
    ),
  },
  {
    id: 8,
    title: 'Overclock Speed & Magnet Radius',
    desc: '+30% move speed, energy cells attracted from 2x distance',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v6l4 2" />
        <path d="M8 14s1.5 2 4 0 4 0 4 0" />
      </svg>
    ),
  },
];

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({ choices, onSelect, level }) => {
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const selectedIndexRef = useRef(0);

  useEffect(() => {
    cardRefs.current[0]?.focus();
    selectedIndexRef.current = 0;
    const handleKey = (e: KeyboardEvent) => {
      if (!choices.length) return;
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndexRef.current = (selectedIndexRef.current + 1) % choices.length;
        cardRefs.current[selectedIndexRef.current]?.focus();
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndexRef.current = (selectedIndexRef.current - 1 + choices.length) % choices.length;
        cardRefs.current[selectedIndexRef.current]?.focus();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        selectedIndexRef.current = (selectedIndexRef.current + (e.shiftKey ? -1 : 1) + choices.length) % choices.length;
        cardRefs.current[selectedIndexRef.current]?.focus();
      } else if (e.key >= '1' && e.key <= '3') {
        const idx = parseInt(e.key, 10) - 1;
        if (idx < choices.length) onSelect(choices[idx].id);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [choices, onSelect]);

  return (
    <div className="fixed inset-0 overflow-y-auto bg-slate-950/95 backdrop-blur-md flex items-start justify-center p-4 z-50" role="dialog" aria-modal="true" aria-label={`Level ${level} — Choose Upgrade`}>
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-800 rounded-2xl p-4 md:p-6 shadow-2xl">
        <div className="text-center mb-4">
          <h2 className="text-xl font-black text-amber-400 mb-1">LEVEL {level} — CHOOSE A COIL</h2>
          <p className="text-slate-400">Choose one upgrade. Game paused.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4" aria-label="Upgrade choices">
          {choices.map((choice, idx) => (
            <button
              key={choice.id}
              ref={(el) => (cardRefs.current[idx] = el)}
              onClick={() => onSelect(choice.id)}
              onFocus={() => { selectedIndexRef.current = idx; }}
              tabIndex={0}
              className="relative group flex flex-col items-center p-3 md:p-5 bg-slate-800/50 border border-slate-700 rounded-xl hover:border-amber-400/50 hover:bg-amber-500/[0.05] transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-amber-400"
            >
              <span className="absolute top-3 right-3 text-2xl font-black text-amber-400/80">{idx + 1}</span>
              <div className="w-8 h-8 md:w-14 md:h-14 flex items-center justify-center text-amber-400 mb-2 group-hover:scale-110 transition-transform">{choice.icon}</div>
              <h3 className="text-sm md:text-lg font-black text-white text-center mb-1">{choice.title}</h3>
              <p className="text-xs md:text-sm text-slate-300 text-center leading-relaxed">{choice.desc}</p>
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500 text-center mt-5">←/→ or 1/2/3 to select · Enter to confirm</p>
      </div>
    </div>
  );
};

export function generateUpgradeChoices(owned: Set<number> = new Set()): UpgradeChoice[] {
  const shuffled = shuffle(UPGRADE_POOL.filter((choice) => !([5, 6].includes(choice.id) && owned.has(choice.id))));
  return shuffled.slice(0, 3);
}
