# Developer Agent Master Prompt v3: Remediation & Production Game Build
## Target Project: ZESA Survivor — The Complete Game (Post-Verdict Refactor)

> **Instructions for AI Developer Agent (Cursor / Claude Code / Roo Code):**
> Copy and execute this master prompt to refactor "ZESA Survivor: Physics Horde" from a tech demo into a complete, highly retentive, offline-first PWA game.

---

```text
You are an expert Principal Full-Stack, Game Design & WebAssembly Engineer. Your task is to execute the Master Remediation Plan for "ZESA Survivor" — turning the initial prototype from a disconnected tech demo into a polished, highly engaging 5-minute arcade survival PWA built with Vite, React, TypeScript, Rust (WebAssembly), Web Audio API, and Tailwind CSS.

Follow this complete specification and implementation roadmap precisely:

---

### REFACTOR GOALS & CORE DESIGN OVERHAUL

1. UNIFIED SYSTEM (Directional Merge Blasts):
   - Merging orbs at the top pit fires directional beam blasts/elemental shockwaves downward toward the player's target vector.
   - Defeated enemies drop Energy Orbs that charge the player's Drop Gauge, creating a tight feedback loop between surviving at the bottom and merging at the top.

2. WAVE DIRECTOR & 5-MINUTE WIN ARC:
   - Replace flat spawns with a 5-Minute "Hold Until Dawn" Wave Director:
     * 0:00 - 1:00 (Wave 1): Grunt Swarm (Introduction)
     * 1:00 - 2:00 (Wave 2): Fast Strikers + Telegraphed Edge Spawns (Warning Markers)
     * 2:00 - 3:00 (Wave 3): Heavy Tanks + Mid-run Surge Event
     * 3:00 - 4:00 (Wave 4): Mixed Horde + Elite Mini-Boss
     * 4:00 - 5:00 (Wave 5): Overlord Boss + Dawn Extraction Gate
   - Edge spawns are telegraphed 1 second in advance with glowing red warning indicators.

3. RESTORED PLAYER AGENCY (1-of-3 Active Level-Up Choices):
   - Remove passive scheduled toast upgrades.
   - When XP levels up, pause time and present a 1-of-3 Upgrade Modal featuring meaningful build choices:
     * Beam Width & Multi-Shot
     * Cryo Nova (Freeze Swarm)
     * Chain Lightning Merges
     * Plasma Shield Overcharge
     * Overclock Speed & Magnet Radius

4. JUICE, AUDIO & VISUAL CLARITY:
   - Web Audio API Sound System: Synthesize 8-bit sound effects for orb drops, merge pops, beam blasts, level-ups, and player damage without external audio asset downloads.
   - Camera Shake on L5+ merges; Hit-Stop (40ms frame freeze) on big explosions; Scale-bounce animations on merged orbs.
   - Visual Hierarchy: Distinct shapes/symbols per orb tier, distinct enemy visual designs (Red Grunts, Yellow Strikers, Heavy Tanks), and high-contrast player indicator.

5. MOBILE ERGONOMICS & DEEP WHATSAPP FLEX:
   - Touch Controls: Left thumb Virtual Joystick for movement; Right thumb Drop Lane Selector for orbs. Prevents fat-finger mis-drops.
   - WhatsApp Challenge Generator: Formats score, wave reached, run duration, and challenge URL:
     "⚡ I survived 4m 12s (Wave 5) in ZESA Survivor! Score: 24,500. Beat my build: [link]"

6. RUST WASM LINEAR MEMORY OPTIMIZATION:
   - Zero-allocation memory layout: Read state directly from `wasm.memory.buffer` using a single `Float32Array` view.
   - Send accurate telemetry in header: real merge count, wave phase, active buff durations, and pending level-ups.

---

### CODEBASE ARCHITECTURE & FILE TREE

Create or update the following un-truncated files in your project workspace:

1. `backend/Cargo.toml`
   - Crate name: `zesa_backend`
   - `crate-type = ["cdylib"]`
   - Profile release: `opt-level = "z"`, `lto = true`, `codegen-units = 1`, `panic = "abort"`

2. `backend/src/lib.rs` (Rust Game Engine)
   - Structs: `Orb`, `Enemy`, `Player`, `WaveDirector`, `Universe`
   - Mechanics: 2D physics merge, directional blast calculations, 5-minute wave state, 1-of-3 card generation.
   - Expose WASM exports: `tick()`, `drop_orb(lane)`, `move_player(dx, dy)`, `select_upgrade(choice)`, `get_memory_ptr()`.

3. `src/audio/soundManager.ts` (Web Audio API Synthesizer)
   - Pure JS/TS Web Audio API sound synthesizer (`playMergeSound()`, `playBlastSound()`, `playLevelUpSound()`, `playHurtSound()`).

4. `src/components/UpgradeModal.tsx`
   - 1-of-3 upgrade card selection modal displayed on level-up.

5. `src/components/HUD.tsx`
   - Display Wave Timer (5:00 countdown), Health Bar, Energy Gauge, Level XP Bar, and Active Buff Indicators.

6. `src/components/GameOverModal.tsx`
   - Victory/Defeat screen with 1-tap WhatsApp challenge button.

7. `src/components/Joystick.tsx`
   - Touch-friendly virtual joystick for mobile controls.

8. `src/App.tsx`
   - Canvas rendering loop, zero-copy WASM memory view, keyboard/touch input handlers, Web Audio triggers, and juice effects (screen shake).

9. `vite.config.ts`, `sw-register.ts`, `package.json`, `vercel.json`
   - Full PWA Workbox precaching, automatic WASM bundling, and Vercel Edge configuration.

---

Execute all code updates, ensure clean TypeScript build without errors, and verify the 5-minute win arc and upgrade choices function end-to-end.
```
