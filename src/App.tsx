import { useCallback, useEffect, useRef, useState } from 'react';
import init, { Universe } from '../pkg/zesa_backend.js';
import { HUD } from './components/HUD';
import { GameOverModal } from './components/GameOverModal';
import { ModeMenu, type Loadout } from './components/ModeMenu';
import { setupServiceWorker } from './sw-register';
import { sfx } from './audio/sound';
import { music } from './audio/music';
import {
  ORB_COLORS,
  drawOrb,
  drawEnemy,
  drawPlayer,
  drawBeam,
  drawTelegraph,
  drawEnergy,
  drawArcTick
} from './game/sprites';
import {
  loadHighs,
  recordRun,
  checkBadges,
  loadBadges,
  starsFor,
  MODES,
  type BadgeId,
  type RunMode
} from './game/storage';

const MAX_WIDTH = 480;
const HUD_SYNC_MS = 250;
const DROP_COOLDOWN_MS = 250;
const HEADER_LEN = 26;

const WAVE_BANNERS: Record<number, { title: string; desc: string }> = {
  2: { title: 'WAVE 2 — Escalation', desc: 'Fast strikers from the edges' },
  3: { title: 'WAVE 3 — Critical Mass', desc: 'Heavy tanks + surge event' },
  4: { title: 'WAVE 4 — Apex Horde', desc: 'Mixed swarm + elite hunters' },
  5: { title: 'FINAL WAVE — Hold Until Dawn', desc: 'Overlord incoming. Survive!' }
};

// Night-to-dawn sky: one layer per wave, crossfaded. Canvas is
// transparent (clearRect), so the sky shows through gameplay.
const BG_LAYERS: string[] = [
  'linear-gradient(to bottom, #020617 0%, #0b1120 60%, #0f172a 100%)',
  'linear-gradient(to bottom, #070b1d 0%, #1e1b4b 65%, #312e81 100%)',
  'linear-gradient(to bottom, #120826 0%, #3b0764 60%, #6d28d9 100%)',
  'linear-gradient(to bottom, #1c0a1e 0%, #7c2d12 62%, #9a3412 100%)',
  'linear-gradient(to bottom, #0f172a 0%, #7c2d12 52%, #f59e0b 82%, #fcd34d 100%)'
];

function gameSize() {
  const width = Math.min(window.innerWidth, MAX_WIDTH);
  const height = window.innerHeight;
  return { width: Math.max(200, width), height: Math.max(320, height) };
}

function randomOrb(): number {
  return Math.floor(Math.random() * 3) + 1;
}

// Universe law — transformer tiers auto-install the next coil in rotation.
// No draft, no pause: Shield (L2,5,8…) → Surge (L3,6,9…) → Freeze (L4,7,10…).
function bonusForLevel(level: number): 1 | 2 | 3 {
  return ((((level - 2) % 3) + 3) % 3 + 1) as 1 | 2 | 3;
}

const BONUS_META: Record<number, { title: string; desc: string }> = {
  1: { title: 'Solar Shield installed', desc: '+30 max battery, healed 30' },
  2: { title: 'Surge Burst online', desc: '+50% blast for 20s' },
  3: { title: 'Freeze Schedule active', desc: 'Faults slowed for 12s' }
};

interface Toast {
  id: number;
  title: string;
  desc: string;
}

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const universeRef = useRef<Universe | null>(null);
  const wasmMemoryRef = useRef<WebAssembly.Memory | null>(null);
  const lastDropRef = useRef(0);
  const sizeRef = useRef(gameSize());
  const pausedRef = useRef(false); // reserved: only tab-hidden pauses physics now
  const toastIdRef = useRef(0);
  const runStartRef = useRef(performance.now());
  const mergesRef = useRef(0);
  const maxComboRef = useRef(0);
  const lastLevelRef = useRef(1);
  const waveRef = useRef(1);
  const startedRef = useRef(false);
  const modeRef = useRef<RunMode>(1);
  const loadoutRef = useRef<Loadout>(1);
  const prevMergesRef = useRef(0);
  const prevGaugeRef = useRef(0);
  const prevHpRef = useRef(100);
  const pausedMsRef = useRef(0);
  const aimRef = useRef({ active: false, x: 0, level: 1, charged: false });
  const fpsEmaRef = useRef(60);
  const lastPerfSyncRef = useRef(0);
  const gameOverSavedRef = useRef(false);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState(100);
  const [maxHp, setMaxHp] = useState(100);
  const [xp, setXp] = useState(0);
  const [nextXp, setNextXp] = useState(100);
  const [combo, setCombo] = useState(0);
  const [comboFrac, setComboFrac] = useState(0);
  const [nextOrb, setNextOrb] = useState<number>(() => randomOrb());
  const [surgeLeft, setSurgeLeft] = useState(0);
  const [freezeLeft, setFreezeLeft] = useState(0);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [started, setStarted] = useState(false);
  const [mode, setMode] = useState<RunMode>(1);  const [gameOver, setGameOver] = useState(false);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(() => sfx.isMuted());
  const [victory, setVictory] = useState(false);
  const [wave, setWave] = useState(1);
  const [timeLeft, setTimeLeft] = useState(300);
  const [runSeconds, setRunSeconds] = useState(0);
  const [gauge, setGauge] = useState(0);
  const [isOffline, setIsOffline] = useState(
    typeof navigator !== 'undefined' ? !navigator.onLine : false
  );
  const [needRefresh, setNeedRefresh] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [highs, setHighs] = useState(loadHighs);
  const [badges, setBadges] = useState<BadgeId[]>(loadBadges);
  const [runStars, setRunStars] = useState(0);
  const [isNewBest, setIsNewBest] = useState(false);
  const [isNewStars, setIsNewStars] = useState(false);
  const [newBadges, setNewBadges] = useState<BadgeId[]>([]);
  const updateSWRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  useEffect(() => {
    const updateSW = setupServiceWorker(() => setNeedRefresh(true));
    updateSWRef.current = updateSW;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    let animId = 0;
    let lastHudSync = 0;
    let lastTime = performance.now();
    let hidden = document.hidden;
    let hiddenSince = 0;

    const handleVis = () => {
      hidden = document.hidden;
      const now = performance.now();
      // Wall-clock while hidden doesn't count toward run time.
      if (hidden) {
        hiddenSince = now;
      } else {
        if (hiddenSince > 0) pausedMsRef.current += now - hiddenSince;
        hiddenSince = 0;
      }
      lastTime = now;
    };
    document.addEventListener('visibilitychange', handleVis);

    const handleResize = () => {
      sizeRef.current = gameSize();
      const canvas = canvasRef.current;
      if (canvas) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = Math.floor(sizeRef.current.width * dpr);
        canvas.height = Math.floor(sizeRef.current.height * dpr);
      }
    };
    window.addEventListener('resize', handleResize);

    async function start() {
      try {
        const wasmExports = await init();
        if (cancelled) return;
        wasmMemoryRef.current = wasmExports.memory as WebAssembly.Memory;

        const { width, height } = sizeRef.current;
        const universe = new Universe(width, height);
        universeRef.current = universe;

        const canvas = canvasRef.current;
        if (canvas) {
          const dpr = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.floor(width * dpr);
          canvas.height = Math.floor(height * dpr);
        }
        setLoading(false);

        const render = (time: number) => {
          if (cancelled) return;
          const rawDt = Math.min((time - lastTime) / 1000, 0.05);
          lastTime = time;

          // FPS EMA for adaptive difficulty
          if (rawDt > 0) {
            const fps = 1 / Math.max(rawDt, 1e-4);
            fpsEmaRef.current = fpsEmaRef.current * 0.95 + fps * 0.05;
          }

          const universe = universeRef.current;
          const canvas = canvasRef.current;
          const mem = wasmMemoryRef.current;
          const paused = pausedRef.current || hidden || !startedRef.current;

          // Manual pause: accumulate unpaused run time.
          if (pausedRef.current && startedRef.current && !gameOverSavedRef.current) {
            pausedMsRef.current += rawDt * 1000;
          }

          if (universe && canvas && mem && !paused && !universe.is_game_over() && !universe.is_victory()) {
            universe.tick(rawDt);

            // Adaptive perf sync every 2s
            if (time - lastPerfSyncRef.current > 2000) {
              lastPerfSyncRef.current = time;
              const fps = fpsEmaRef.current;
              const lvl = universe.get_level();
              if (fps < 28) universe.set_perf_mode(0);
              else if (fps > 50 && lvl >= 4) universe.set_perf_mode(2);
              else universe.set_perf_mode(1);
            }

            const ptr = universe.get_render_data() >>> 0;
            const len = universe.get_render_data_len() >>> 0;
            const data = new Float32Array(mem.buffer, ptr, len);
            const copy = Float32Array.from(data);

            const orbCount = copy[0] | 0;
            const enemyCount = copy[1] | 0;
            const particleCount = copy[2] | 0;
            const px = copy[3];
            const py = copy[4];
            const php = copy[5];
            const pmaxhp = copy[6];
            const pscore = copy[7];
            const plevel = copy[8];
            const pxp = copy[9];
            const pnextxp = copy[10];
            const pcombo = copy[11] | 0;
            const pcomboFrac = copy[12];
            const pbest = copy[13] | 0;
            // copy[14] = pending_choices (auto-consumed, kept at 0 by passive track)
            const psurge = copy[15];
            const pfreeze = copy[16];
            const pwave = copy[17] | 0;
            const ptimeLeft = copy[18];
            const pvictory = copy[19] > 0.5;
            const telegraphCount = copy[20] | 0;
            const pmerges = copy[21] | 0;
            const pgauge = copy[22];
            const beamCount = copy[23] | 0;
            const energyCount = copy[24] | 0;
            // copy[25] = last_merge_tier (retired with hit-stop/shake)

            maxComboRef.current = Math.max(maxComboRef.current, pbest);
            // Clean merge feedback: sound only. Pop + glyph carry the visual.
            if (pmerges > prevMergesRef.current) {
              prevMergesRef.current = pmerges;
              sfx.merge(pcombo);
            }
            mergesRef.current = pmerges;
            // Wave banners (non-blocking) + stinger + music intensity.
            if (pwave > waveRef.current) {
              waveRef.current = pwave;
              sfx.wave();
              music.setWave(pwave);
              const b = WAVE_BANNERS[pwave];
              if (b) {
                const id = ++toastIdRef.current;
                setToasts((t) => [...t.slice(-2), { id, title: b.title, desc: b.desc }]);
                setTimeout(() => {
                  setToasts((t) => t.filter((x) => x.id !== id));
                }, 3000);
              }
            }
            if (pvictory) {
              setVictory(true);
              setGameOver(true);
            }
            // Passive transformer track: auto-install bonus per new tier, toast only.
            if (plevel > lastLevelRef.current) {
              sfx.level();
              for (let lv = lastLevelRef.current + 1; lv <= plevel; lv++) {
                const bonus = bonusForLevel(lv);
                try {
                  universe.apply_powerup(bonus);
                } catch { /* engine not ready */ }
                const meta = BONUS_META[bonus];
                const id = ++toastIdRef.current;
                setToasts((t) => [...t.slice(-2), { id, title: `Lv ${lv} — ${meta.title}`, desc: meta.desc }]);
                setTimeout(() => {
                  setToasts((t) => t.filter((x) => x.id !== id));
                }, 2600);
              }
              lastLevelRef.current = plevel;
            }

            if (time - lastHudSync > HUD_SYNC_MS) {
              lastHudSync = time;
              if (pgauge > prevGaugeRef.current + 1) sfx.pickup();
              if (php < prevHpRef.current - 3) sfx.hurt();
              prevGaugeRef.current = pgauge;
              prevHpRef.current = php;
              setScore(pscore);
              setLevel(plevel);
              setHp(php);
              setMaxHp(pmaxhp);
              setXp(pxp);
              setNextXp(pnextxp);
              setCombo(pcombo);
              setComboFrac(pcomboFrac);
              setSurgeLeft(psurge);
              setFreezeLeft(pfreeze);
              setWave(pwave);
              if (modeRef.current === 2) {
                // Endless: engine time_left is unbounded — count up instead.
                const elapsed = (time - runStartRef.current - pausedMsRef.current) / 1000;
                setTimeLeft(elapsed);
                setRunSeconds(Math.round(elapsed));
              } else {
                setTimeLeft(ptimeLeft);
                const total = MODES[modeRef.current].total;
                setRunSeconds(Math.round(total - ptimeLeft));
              }
              setGauge(pgauge);
              if (universe.is_game_over()) setGameOver(true);
            }

            const { width: w, height: h } = sizeRef.current;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              const dpr = Math.min(window.devicePixelRatio || 1, 2);
              ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
              ctx.clearRect(0, 0, w, h);

              ctx.strokeStyle = 'rgba(0,240,255,0.14)';
              ctx.lineWidth = 2;
              ctx.beginPath();
              ctx.moveTo(0, h - 100);
              ctx.lineTo(w, h - 100);
              ctx.stroke();

              let idx = HEADER_LEN;

              // Collect high-voltage orbs for inter-orb arcing (capped).
              const hi: { x: number; y: number }[] = [];
              for (let i = 0; i < orbCount; i++) {
                const ox = copy[idx];
                const oy = copy[idx + 1];
                const olevel = copy[idx + 2];
                const oradius = copy[idx + 3];
                idx += 4;
                drawOrb(ctx, ox, oy, oradius, olevel, time);
                if (olevel >= 7 && hi.length < 12) hi.push({ x: ox, y: oy });
              }
              // Arcs jump between close T7+ neighbors (cap 8 strokes).
              let arcs = 0;
              for (let a = 0; a < hi.length && arcs < 8; a++) {
                for (let b = a + 1; b < hi.length && arcs < 8; b++) {
                  const dx = hi[a].x - hi[b].x;
                  const dy = hi[a].y - hi[b].y;
                  if (dx * dx + dy * dy < 90 * 90) {
                    drawArcTick(ctx, hi[a].x, hi[a].y, hi[b].x, hi[b].y);
                    arcs++;
                  }
                }
              }

              for (let i = 0; i < enemyCount; i++) {
                const ex = copy[idx];
                const ey = copy[idx + 1];
                const ehp = copy[idx + 2];
                const ekind = copy[idx + 3] | 0;
                idx += 4;
                drawEnemy(ctx, ekind, ex, ey, time);
                const er = ekind === 2 ? 16 : ekind === 4 ? 26 : ekind === 3 ? 14 : ekind === 1 ? 8 : 10;
                ctx.fillStyle = 'rgba(255,255,255,0.75)';
                ctx.fillRect(ex - er, ey - er - 7, er * 2 * Math.max(0, Math.min(1, ehp)), 3);
              }

              for (let i = 0; i < particleCount; i++) {
                const ptx = copy[idx];
                const pty = copy[idx + 1];
                const ptLife = copy[idx + 2];
                idx += 4; // tier tint skipped: sparks render hot white-amber
                ctx.beginPath();
                ctx.arc(ptx, pty, Math.max(0.5, 4 * ptLife), 0, Math.PI * 2);
                ctx.fillStyle = '#FFE9A8';
                ctx.fill();
              }

              // Telegraph warnings: pulsing hazard marks at incoming spawns.
              for (let i = 0; i < telegraphCount; i++) {
                const tx = copy[idx];
                const ty = copy[idx + 1];
                const tfrac = copy[idx + 2];
                idx += 3;
                drawTelegraph(ctx, tx, ty, tfrac, time);
              }

              // P2: discharge beams (merge → battery), then harvestable energy.
              for (let i = 0; i < beamCount; i++) {
                const bx1 = copy[idx];
                const by1 = copy[idx + 1];
                const bx2 = copy[idx + 2];
                const by2 = copy[idx + 3];
                idx += 5;
                drawBeam(ctx, bx1, by1, bx2, by2);
              }

              for (let i = 0; i < energyCount; i++) {
                const gex = copy[idx];
                const gey = copy[idx + 1];
                idx += 2;
                drawEnergy(ctx, gex, gey, i * 1.7, time);
              }

              // Aim preview: ghost lane for touch players (hold, aim, release).
              const aim = aimRef.current;
              if (aim.active) {
                const gr = 12 + aim.level * 6;
                const gc = aim.charged ? '#4ADE80' : ORB_COLORS[aim.level] || '#fff';
                ctx.save();
                ctx.setLineDash([6, 6]);
                ctx.strokeStyle = aim.charged ? 'rgba(74,222,128,0.6)' : 'rgba(255,255,255,0.35)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(aim.x, 30);
                ctx.lineTo(aim.x, h - 100);
                ctx.stroke();
                ctx.restore();
                ctx.beginPath();
                ctx.arc(aim.x, 44, gr, 0, Math.PI * 2);
                ctx.fillStyle = gc;
                ctx.globalAlpha = 0.45;
                ctx.fill();
                ctx.globalAlpha = 1;
                ctx.strokeStyle = gc;
                ctx.lineWidth = 2;
                ctx.stroke();
              }

              drawPlayer(ctx, px, py, php / Math.max(1, pmaxhp), time);
            }
          } else if (universe?.is_game_over()) {
            setGameOver((g) => (g ? g : true));
          }

          animId = requestAnimationFrame(render);
        };

        animId = requestAnimationFrame(render);
      } catch (err) {
        console.error('WASM init failed:', err);
        if (!cancelled) {
          setLoadError(
            'Failed to load game engine. Check connection and reload — PWA needs one online load before offline works.'
          );
          setLoading(false);
        }
      }
    }

    start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVis);
      window.removeEventListener('resize', handleResize);
      try {
        universeRef.current?.free();
      } catch { /* ignore */ }
      universeRef.current = null;
    };
  }, []);

  // Persist run on game over OR victory (real merge count from engine).
  useEffect(() => {
    if (!gameOver || gameOverSavedRef.current) return;
    gameOverSavedRef.current = true;
    music.stop();
    const u = universeRef.current;
    const merges = u ? u.get_merge_count() : mergesRef.current;
    const finalWave = waveRef.current;
    const m = modeRef.current;
    const total = MODES[m].total;
    const elapsed = Math.round((performance.now() - runStartRef.current - pausedMsRef.current) / 1000);
    const seconds = m === 2 ? elapsed : Math.min(total, elapsed);
    const won = victory;
    const stars = starsFor(m, score);
    mergesRef.current = merges;
    const rec = {
      score,
      level,
      combo: maxComboRef.current,
      merges,
      seconds,
      wave: won ? 5 : finalWave,
      victory: won,
      mode: m,
      stars,
      date: new Date().toISOString()
    };
    const before = loadHighs();
    const h = recordRun(rec);
    setHighs(h);
    setBadges(loadBadges());
    setRunStars(stars);
    // Records are per-mode: an Endless PB must not mask a Standard PB.
    setIsNewBest(score > 0 && score > before.bestScores[m]);
    setIsNewStars(stars > before.bestStars[m]);
    setNewBadges(
      checkBadges({ merges, combo: maxComboRef.current, score, level, seconds, victory: won })
    );
    if (won) sfx.victory(); else sfx.over();
  }, [gameOver, victory, score, level]);

  // Refresh/close mid-run: save the partial shift so nothing is lost.
  useEffect(() => {
    const savePartial = () => {
      if (!startedRef.current || gameOverSavedRef.current) return;
      const u = universeRef.current;
      if (!u || u.is_game_over() || u.is_victory()) return;
      gameOverSavedRef.current = true;
      const m = modeRef.current;
      const total = MODES[m].total;
      const elapsed = Math.round((performance.now() - runStartRef.current - pausedMsRef.current) / 1000);
      const scoreNow = u.get_score();
      recordRun({
        score: scoreNow,
        level: u.get_level(),
        combo: maxComboRef.current,
        merges: u.get_merge_count(),
        seconds: m === 2 ? elapsed : Math.min(total, elapsed),
        wave: waveRef.current,
        victory: false,
        mode: m,
        stars: starsFor(m, scoreNow),
        date: new Date().toISOString()
      });
    };
    const onPageShow = () => {
      // bfcache restore: the run may still be live — allow a proper end-save.
      const u = universeRef.current;
      if (startedRef.current && u && !u.is_game_over() && !u.is_victory()) {
        gameOverSavedRef.current = false;
      }
    };
    window.addEventListener('pagehide', savePartial);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      window.removeEventListener('pagehide', savePartial);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, []);

  const canvasX = (clientX: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return 0;
    const rect = canvas.getBoundingClientRect();
    return clientX - rect.left;
  };

  const commitDrop = (x: number) => {
    const u = universeRef.current;
    if (!u) return;
    const now = performance.now();
    if (now - lastDropRef.current < DROP_COOLDOWN_MS) return;
    lastDropRef.current = now;
    // P2: full gauge → charged L4 drop.
    if (gauge >= 100) {
      if (u.drop_charged(x)) {
        sfx.charged();
        setGauge(0);
        return;
      }
    }
    u.drop_orb(x, nextOrb);
    sfx.drop();
    setNextOrb(randomOrb());
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const u = universeRef.current;
    if (!u || gameOver || paused || loading || loadError) return;
    sfx.unlock();
    const x = canvasX(e.clientX);
    if (!Number.isFinite(x)) return;
    if (e.pointerType === 'mouse') {
      commitDrop(x); // desktop: instant
    } else {
      // Touch/pen: hold-aim ghost, release to commit.
      aimRef.current = { active: true, x, level: nextOrb, charged: gauge >= 100 };
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const u = universeRef.current;
    if (!u || gameOver || paused) return;
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    const x = canvasX(e.clientX);
    if (!Number.isFinite(x)) return;
    u.move_player(x);
    if (aimRef.current.active) aimRef.current.x = x;
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!aimRef.current.active) return;
    const x = canvasX(e.clientX);
    aimRef.current.active = false;
    if (gameOver || paused || loading || loadError) return;
    if (!Number.isFinite(x)) return;
    commitDrop(x);
  };

  const handlePointerCancel = () => {
    aimRef.current.active = false;
  };

  const togglePause = useCallback(() => {
    sfx.unlock();
    setPaused((p) => {
      pausedRef.current = !p;
      return !p;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      sfx.setMuted(!m);
      return !m;
    });
  }, []);

  const resetRunState = (m: RunMode, total: number) => {
    lastDropRef.current = 0;
    runStartRef.current = performance.now();
    mergesRef.current = 0;
    maxComboRef.current = 0;
    lastLevelRef.current = 1;
    waveRef.current = 1;
    prevMergesRef.current = 0;
    prevGaugeRef.current = 0;
    prevHpRef.current = 100;
    pausedMsRef.current = 0;
    aimRef.current = { active: false, x: 0, level: 1, charged: false };
    pausedRef.current = false;
    gameOverSavedRef.current = false;
    setPaused(false);
    setGameOver(false);
    setVictory(false);
    setWave(1);
    setTimeLeft(m === 2 ? 0 : total);
    setRunSeconds(0);
    setGauge(0);
    setScore(0);
    setLevel(1);
    setHp(100);
    setMaxHp(100);
    setXp(0);
    setNextXp(100);
    setCombo(0);
    setComboFrac(0);
    setSurgeLeft(0);
    setFreezeLeft(0);
    setToasts([]);
    setIsNewBest(false);
    setIsNewStars(false);
    setRunStars(0);
    setNewBadges([]);
    setNextOrb(randomOrb());
    music.setWave(1);
  };

  const handleStart = useCallback((m: RunMode, loadout: Loadout) => {
    sfx.unlock();
    try {
      universeRef.current?.free();
    } catch { /* ignore */ }
    const { width, height } = sizeRef.current;
    const u = new Universe(width, height);
    u.set_run_mode(m);
    u.apply_loadout(loadout);
    universeRef.current = u;
    modeRef.current = m;
    loadoutRef.current = loadout;
    setMode(m);
    resetRunState(m, MODES[m].total);
    setStarted(true);
    startedRef.current = true;
    music.start();
  }, []);

  const handleRestart = useCallback(() => {
    try {
      universeRef.current?.free();
    } catch { /* ignore */ }
    const { width, height } = sizeRef.current;
    const m = modeRef.current;
    const u = new Universe(width, height);
    u.set_run_mode(m);
    u.apply_loadout(loadoutRef.current);
    universeRef.current = u;
    resetRunState(m, MODES[m].total);
    setStarted(true);
    startedRef.current = true;
    music.start();
  }, []);

  const handleMenu = useCallback(() => {
    music.stop();
    startedRef.current = false;
    setStarted(false);
    setGameOver(false);
    setVictory(false);
    setPaused(false);
    pausedRef.current = false;
  }, []);

  const modeTotal = MODES[mode].total;
  const dawnProgress = victory ? 1 : mode === 2 ? wave / 5 : Math.min(1, Math.max(0, 1 - timeLeft / Math.max(1, modeTotal)));

  return (
    <div className="flex justify-center items-center h-screen w-screen bg-slate-950 select-none">
      <div ref={containerRef} className="relative w-full max-w-[480px] h-full overflow-hidden bg-slate-950 shadow-2xl">
        {/* Night-to-dawn sky: single layer swapped on wave change (the
            banner + flash + stinger mask the cut; 5 crossfading fullscreen
            layers janked low-end GPUs). */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: BG_LAYERS[(victory ? 5 : wave) - 1] }}
        />
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse 90% 42% at 50% 108%, rgba(251,191,36,0.85), transparent 70%)',
            opacity: dawnProgress * 0.8
          }}
        />
        <HUD
          score={score}
          level={level}
          hp={hp}
          maxHp={maxHp}
          xp={xp}
          nextXp={nextXp}
          combo={combo}
          comboFrac={comboFrac}
          nextOrb={nextOrb}
          surgeLeft={surgeLeft}
          freezeLeft={freezeLeft}
          bestScore={highs.bestScores[mode] ?? 0}
          wave={wave}
          timeLeft={timeLeft}
          gauge={gauge}
          endless={mode === 2}
          isOffline={isOffline}
          needRefresh={needRefresh}
          onRefreshPWA={() => updateSWRef.current?.(true)}
        />

        {loading && !loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900">
            <div className="text-center">
              <div className="text-4xl mb-2" aria-hidden>⚡</div>
              <p className="text-slate-300 font-semibold">Charging battery…</p>
            </div>
          </div>
        )}

        {loadError && (
          <div className="absolute inset-0 flex items-center justify-center z-20 bg-slate-900 p-6">
            <div className="text-center max-w-xs">
              <div className="text-4xl mb-2" aria-hidden>🪫</div>
              <p className="text-red-400 font-semibold mb-4">{loadError}</p>
              <button
                onClick={() => window.location.reload()}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2 px-4 rounded-xl"
              >
                Reload
              </button>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          style={{ width: sizeRef.current.width, height: sizeRef.current.height }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerCancel}
          onPointerLeave={handlePointerUp}
          className="relative w-full h-full touch-none cursor-pointer"
        />

        {/* CRT scanlines over gameplay, under UI */}
        <div aria-hidden className="scanlines absolute inset-0 z-[5] pointer-events-none opacity-60" />

        {/* Pause + mute controls */}
        {started && !gameOver && !loading && !loadError && (
          <div className="absolute bottom-4 right-4 z-30 flex gap-2">
            <button
              onClick={toggleMute}
              aria-label={muted ? 'Unmute sounds' : 'Mute sounds'}
              className="w-11 h-11 rounded-full bg-slate-800/85 border border-slate-600 text-lg shadow-xl"
            >
              {muted ? '🔇' : '🔊'}
            </button>
            <button
              onClick={togglePause}
              aria-label={paused ? 'Resume game' : 'Pause game'}
              className="w-11 h-11 rounded-full bg-slate-800/85 border border-slate-600 text-lg shadow-xl"
            >
              {paused ? '▶️' : '⏸️'}
            </button>
          </div>
        )}

        {paused && started && !gameOver && (
          <div className="absolute inset-0 z-40 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-6" role="dialog" aria-modal="true" aria-label="Paused">
            <div className="text-center">
              <div className="text-4xl mb-2" aria-hidden>⏸️</div>
              <h2 className="text-xl font-black text-white mb-1">LOAD SHEDDING PAUSE</h2>
              <p className="text-slate-400 text-sm mb-5 tabular-nums">Wave {wave}/5 · {score.toLocaleString()} pts</p>
              <div className="flex flex-col gap-2 w-48">
                <button onClick={togglePause} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl">
                  Resume
                </button>
                <button onClick={handleRestart} className="bg-slate-700 hover:bg-slate-600 text-white font-bold py-3 rounded-xl">
                  Restart
                </button>
                <button onClick={handleMenu} className="bg-transparent border border-slate-600 text-slate-300 font-bold py-2.5 rounded-xl text-sm">
                  Change track
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Passive upgrade toasts — non-blocking, game never pauses */}
        {toasts.length > 0 && (
          <div className="absolute top-24 left-0 w-full flex flex-col items-center gap-1.5 z-30 pointer-events-none px-4">
            {toasts.map((t) => (
              <div key={t.id} className="bg-amber-500/95 text-slate-950 px-3 py-1.5 rounded-full shadow-xl text-center">
                <div className="text-xs font-black">{t.title}</div>
                <div className="text-[11px] font-semibold">{t.desc}</div>
              </div>
            ))}
          </div>
        )}

        {gameOver && (
          <GameOverModal
            score={score}
            level={level}
            wave={victory ? 5 : wave}
            seconds={runSeconds}
            victory={victory}
            modeName={MODES[mode].name}
            stars={runStars}
            bestScore={highs.bestScores[mode] ?? 0}
            isNewBest={isNewBest}
            isNewStars={isNewStars}
            newBadges={newBadges}
            onRestart={handleRestart}
            onMenu={handleMenu}
          />
        )}

        {!started && !loading && !loadError && (
          <ModeMenu
            bestStars={highs.bestStars}
            bestScores={highs.bestScores}
            runs={highs.runs}
            badges={badges}
            onStart={handleStart}
          />
        )}
      </div>
    </div>
  );
}
