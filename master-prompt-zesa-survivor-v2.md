# Developer Agent Master Prompt (v2 — End-to-End Complete)
## Target Project: ZESA Survivor — Physics Horde PWA

> **Instructions for AI Developer Agent (Cursor / Claude Code / Roo Code / GPT-4):**
> Execute the master prompt below to build and scaffold the complete, production-ready codebase for "ZESA Survivor: Physics Horde" end-to-end. Every file below contains complete, un-truncated, production-ready source code.

---

```text
You are an expert Principal Full-Stack & WebAssembly Engineer. Your task is to build and scaffold the complete, fully functional, production-ready codebase for "ZESA Survivor: Physics Horde" — an offline-first Progressive Web App (PWA) built with Vite, React, TypeScript, Rust (WebAssembly), Vercel, and GitHub Actions.

Generate EVERY file listed below with complete, exact, un-truncated code. Do not use placeholders or "// TODO" comments.

---

### PROJECT FILE STRUCTURE
```
zesa-survivor/
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── vercel.json
├── index.html
├── .github/
│   └── workflows/
│       └── deploy.yml
├── backend/
│   ├── Cargo.toml
│   └── src/
│       └── lib.rs
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── index.css
    ├── vite-env.d.ts
    ├── sw-register.ts
    └── components/
        ├── HUD.tsx
        └── GameOverModal.tsx
```

---

### FILE 1: `package.json`

```json
{
  "name": "zesa-survivor",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "wasm": "cd backend && cargo build --target wasm32-unknown-unknown --release && wasm-bindgen target/wasm32-unknown-unknown/release/zesa_backend.wasm --out-dir ../pkg --target web",
    "predev": "npm run wasm",
    "prebuild": "npm run wasm",
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.1",
    "typescript": "^5.4.5",
    "vite": "^5.2.11",
    "vite-plugin-pwa": "^0.20.0",
    "vite-plugin-top-level-await": "^1.4.1",
    "vite-plugin-wasm": "^3.3.0",
    "wasm-bindgen-cli": "^0.2.92"
  }
}
```

---

### FILE 2: `tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "types": ["vite/client", "vite-plugin-pwa/client"]
  },
  "include": ["src"]
}
```

---

### FILE 3: `tsconfig.node.json`

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

---

### FILE 4: `vite.config.ts`

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import wasm from 'vite-plugin-wasm';
import topLevelAwait from 'vite-plugin-top-level-await';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    wasm(),
    topLevelAwait(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'ZESA Survivor: Physics Horde',
        short_name: 'ZESA Survivor',
        description: 'Offline-first Suika Physics Merge + Horde Survival Action PWA',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        orientation: 'portrait',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,wasm,ico,png,svg,json}']
      }
    })
  ],
  server: {
    port: 3000
  }
});
```

---

### FILE 5: `vercel.json`

```json
{
  "git": {
    "deploymentEnabled": false
  },
  "cleanUrls": true,
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ]
}
```

---

### FILE 6: `index.html`

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <meta name="theme-color" content="#0f172a" />
    <title>ZESA Survivor: Physics Horde</title>
  </head>
  <body class="bg-slate-900 text-slate-100 overflow-hidden touch-none select-none">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

---

### FILE 7: `backend/Cargo.toml`

```toml
[package]
name = "zesa_backend"
version = "0.1.0"
edition = "2021"

[lib]
crate-type = ["cdylib", "rlib"]

[dependencies]
wasm-bindgen = "0.2.92"

[profile.release]
opt-level = "z"
lto = true
codegen-units = 1
panic = "abort"
strip = true
```

---

### FILE 8: `backend/src/lib.rs`

```rust
use wasm_bindgen::prelude::*;

#[derive(Clone, Debug)]
pub struct Orb {
    pub id: u64,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub level: u8,
    pub radius: f32,
    pub mass: f32,
    pub is_merged: bool,
}

#[derive(Clone, Debug)]
pub struct Enemy {
    pub id: u64,
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub hp: f32,
    pub max_hp: f32,
    pub radius: f32,
    pub speed: f32,
}

#[derive(Clone, Debug)]
pub struct Particle {
    pub x: f32,
    pub y: f32,
    pub vx: f32,
    pub vy: f32,
    pub life: f32,
    pub max_life: f32,
    pub color_tier: u8,
}

#[wasm_bindgen]
pub struct Universe {
    width: f32,
    height: f32,
    player_x: f32,
    player_y: f32,
    player_hp: f32,
    player_max_hp: f32,
    score: u32,
    level: u32,
    xp: u32,
    next_xp: u32,
    orbs: Vec<Orb>,
    enemies: Vec<Enemy>,
    particles: Vec<Particle>,
    next_id: u64,
    frame_count: u64,
    game_over: bool,
    // Buffer cache for JS interop
    render_buffer: Vec<f32>,
}

#[wasm_bindgen]
impl Universe {
    #[wasm_bindgen(constructor)]
    pub fn new(width: f32, height: f32) -> Universe {
        Universe {
            width,
            height,
            player_x: width * 0.5,
            player_y: height * 0.85,
            player_hp: 100.0,
            player_max_hp: 100.0,
            score: 0,
            level: 1,
            xp: 0,
            next_xp: 100,
            orbs: Vec::new(),
            enemies: Vec::new(),
            particles: Vec::new(),
            next_id: 1,
            frame_count: 0,
            game_over: false,
            render_buffer: Vec::new(),
        }
    }

    pub fn drop_orb(&mut self, x: f32, level: u8) {
        if self.game_over { return; }
        let clamped_x = x.clamp(30.0, self.width - 30.0);
        let radius = 12.0 + (level as f32) * 6.0;
        let orb = Orb {
            id: self.next_id,
            x: clamped_x,
            y: 40.0,
            vx: 0.0,
            vy: 2.0,
            level,
            radius,
            mass: radius * radius,
            is_merged: false,
        };
        self.next_id += 1;
        self.orbs.push(orb);
    }

    pub fn move_player(&mut self, target_x: f32) {
        if self.game_over { return; }
        self.player_x = target_x.clamp(20.0, self.width - 20.0);
    }

    pub fn tick(&mut self, dt: f32) {
        if self.game_over { return; }
        self.frame_count += 1;

        // 1. Spawn enemy waves
        if self.frame_count % 45 == 0 && self.enemies.len() < 1000 {
            let spawn_top = (self.frame_count % 2) == 0;
            let ex = if spawn_top { 
                (self.frame_count * 37 % (self.width as u64)) as f32 
            } else { 
                if (self.frame_count % 4) == 0 { 10.0 } else { self.width - 10.0 } 
            };
            let ey = if spawn_top { 10.0 } else { (self.frame_count * 53 % (self.height as u64)) as f32 };
            
            self.enemies.push(Enemy {
                id: self.next_id,
                x: ex,
                y: ey,
                vx: 0.0,
                vy: 0.0,
                hp: 10.0 + (self.level as f32) * 2.0,
                max_hp: 10.0 + (self.level as f32) * 2.0,
                radius: 10.0,
                speed: 40.0 + (self.level as f32) * 2.0,
            });
            self.next_id += 1;
        }

        // 2. Physics update for Orbs (Gravity & Wall Collision)
        let gravity = 350.0;
        for orb in self.orbs.iter_mut() {
            orb.vy += gravity * dt;
            orb.x += orb.vx * dt;
            orb.y += orb.vy * dt;
            orb.vx *= 0.98;
            orb.vy *= 0.98;

            // Boundaries
            if orb.x - orb.radius < 0.0 {
                orb.x = orb.radius;
                orb.vx *= -0.4;
            } else if orb.x + orb.radius > self.width {
                orb.x = self.width - orb.radius;
                orb.vx *= -0.4;
            }
            if orb.y + orb.radius > self.height - 100.0 {
                orb.y = self.height - 100.0 - orb.radius;
                orb.vy *= -0.3;
                orb.vx *= 0.8;
            }
        }

        // 3. Resolve Orb-Orb Collisions & Merging
        let mut new_orbs = Vec::new();
        let orb_len = self.orbs.len();
        for i in 0..orb_len {
            if self.orbs[i].is_merged { continue; }
            for j in (i + 1)..orb_len {
                if self.orbs[j].is_merged { continue; }

                let dx = self.orbs[j].x - self.orbs[i].x;
                let dy = self.orbs[j].y - self.orbs[i].y;
                let dist_sq = dx * dx + dy * dy;
                let min_dist = self.orbs[i].radius + self.orbs[j].radius;

                if dist_sq < min_dist * min_dist && dist_sq > 0.001 {
                    let dist = dist_sq.sqrt();
                    let nx = dx / dist;
                    let ny = dy / dist;

                    // Same level -> Merge!
                    if self.orbs[i].level == self.orbs[j].level {
                        self.orbs[i].is_merged = true;
                        self.orbs[j].is_merged = true;

                        let next_level = (self.orbs[i].level + 1).min(10);
                        let mid_x = (self.orbs[i].x + self.orbs[j].x) * 0.5;
                        let mid_y = (self.orbs[i].y + self.orbs[j].y) * 0.5;

                        new_orbs.push(Orb {
                            id: self.next_id,
                            x: mid_x,
                            y: mid_y,
                            vx: (self.orbs[i].vx + self.orbs[j].vx) * 0.5,
                            vy: (self.orbs[i].vy + self.orbs[j].vy) * 0.5 - 50.0,
                            level: next_level,
                            radius: 12.0 + (next_level as f32) * 6.0,
                            mass: (12.0 + (next_level as f32) * 6.0) * (12.0 + (next_level as f32) * 6.0),
                            is_merged: false,
                        });
                        self.next_id += 1;

                        // Add score & XP
                        self.score += (next_level as u32) * 50;
                        self.xp += (next_level as u32) * 20;
                        if self.xp >= self.next_xp {
                            self.level += 1;
                            self.xp = 0;
                            self.next_xp = (self.next_xp as f32 * 1.5) as u32;
                            self.player_hp = (self.player_hp + 20.0).min(self.player_max_hp);
                        }

                        // Spawn explosion particles
                        for _ in 0..12 {
                            let angle = (self.next_id as f32 * 0.5) * 3.14159;
                            self.particles.push(Particle {
                                x: mid_x,
                                y: mid_y,
                                vx: angle.cos() * 120.0,
                                vy: angle.sin() * 120.0,
                                life: 0.4,
                                max_life: 0.4,
                                color_tier: next_level,
                            });
                        }

                        // Area damage to nearby enemies
                        let burst_radius = 80.0 + (next_level as f32) * 20.0;
                        let damage = 30.0 + (next_level as f32) * 25.0;
                        for enemy in self.enemies.iter_mut() {
                            let edx = enemy.x - mid_x;
                            let edy = enemy.y - mid_y;
                            if edx * edx + edy * edy <= burst_radius * burst_radius {
                                enemy.hp -= damage;
                            }
                        }

                        break;
                    } else {
                        // Positional separation
                        let overlap = min_dist - dist;
                        let total_mass = self.orbs[i].mass + self.orbs[j].mass;
                        self.orbs[i].x -= nx * overlap * (self.orbs[j].mass / total_mass);
                        self.orbs[i].y -= ny * overlap * (self.orbs[j].mass / total_mass);
                        self.orbs[j].x += nx * overlap * (self.orbs[i].mass / total_mass);
                        self.orbs[j].y += ny * overlap * (self.orbs[i].mass / total_mass);
                    }
                }
            }
        }

        self.orbs.retain(|o| !o.is_merged);
        self.orbs.extend(new_orbs);

        // 4. Update Enemies (Seek Player)
        let px = self.player_x;
        let py = self.player_y;
        for enemy in self.enemies.iter_mut() {
            let dx = px - enemy.x;
            let dy = py - enemy.y;
            let dist = (dx * dx + dy * dy).sqrt().max(0.001);
            enemy.vx = (dx / dist) * enemy.speed;
            enemy.vy = (dy / dist) * enemy.speed;
            enemy.x += enemy.vx * dt;
            enemy.y += enemy.vy * dt;

            // Damage player on contact
            if dist < enemy.radius + 15.0 {
                self.player_hp -= 15.0 * dt;
                if self.player_hp <= 0.0 {
                    self.player_hp = 0.0;
                    self.game_over = true;
                }
            }
        }

        // Retain surviving enemies
        self.enemies.retain(|e| e.hp > 0.0);

        // 5. Update Particles
        for p in self.particles.iter_mut() {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.life -= dt;
        }
        self.particles.retain(|p| p.life > 0.0);
    }

    // Export packed render data to JS
    // Layout: [orb_count, enemy_count, particle_count, player_x, player_y, player_hp, score, level, xp, ...]
    pub fn get_render_data(&mut self) -> *const f32 {
        self.render_buffer.clear();
        self.render_buffer.push(self.orbs.len() as f32);
        self.render_buffer.push(self.enemies.len() as f32);
        self.render_buffer.push(self.particles.len() as f32);
        self.render_buffer.push(self.player_x);
        self.render_buffer.push(self.player_y);
        self.render_buffer.push(self.player_hp);
        self.render_buffer.push(self.score as f32);
        self.render_buffer.push(self.level as f32);
        self.render_buffer.push(self.xp as f32);

        // Orbs: x, y, level, radius
        for orb in &self.orbs {
            self.render_buffer.push(orb.x);
            self.render_buffer.push(orb.y);
            self.render_buffer.push(orb.level as f32);
            self.render_buffer.push(orb.radius);
        }

        // Enemies: x, y, hp_percent
        for enemy in &self.enemies {
            self.render_buffer.push(enemy.x);
            self.render_buffer.push(enemy.y);
            self.render_buffer.push(enemy.hp / enemy.max_hp);
        }

        // Particles: x, y, life_percent, color_tier
        for p in &self.particles {
            self.render_buffer.push(p.x);
            self.render_buffer.push(p.y);
            self.render_buffer.push(p.life / p.max_life);
            self.render_buffer.push(p.color_tier as f32);
        }

        self.render_buffer.as_ptr()
    }

    pub fn get_render_data_len(&self) -> usize {
        self.render_buffer.len()
    }

    pub fn is_game_over(&self) -> bool {
        self.game_over
    }
}
```

---

### FILE 9: `src/vite-env.d.ts`

```ts
/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
```

---

### FILE 10: `src/sw-register.ts`

```ts
import { registerSW } from 'virtual:pwa-register';

export function setupServiceWorker(onNeedRefresh: () => void) {
  const updateSW = registerSW({
    onNeedRefresh() {
      onNeedRefresh();
    },
    onOfflineReady() {
      console.log('ZESA Survivor ready for offline play.');
    },
  });

  return updateSW;
}
```

---

### FILE 11: `src/components/HUD.tsx`

```tsx
import React from 'react';

interface HUDProps {
  score: number;
  level: number;
  hp: number;
  xp: number;
  isOffline: boolean;
  onRefreshPWA?: () => void;
  needRefresh: boolean;
}

export const HUD: React.FC<HUDProps> = ({
  score,
  level,
  hp,
  isOffline,
  onRefreshPWA,
  needRefresh,
}) => {
  return (
    <div className="absolute top-0 left-0 w-full p-4 pointer-events-none flex flex-col gap-2 z-10">
      <div className="flex justify-between items-center bg-slate-800/80 backdrop-blur-md p-3 rounded-xl border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-3">
          <span className="text-2xl">⚡</span>
          <div>
            <div className="text-xs text-amber-400 font-bold uppercase tracking-wider">Score</div>
            <div className="text-xl font-black text-white">{score.toLocaleString()}</div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-xs text-indigo-400 font-bold uppercase tracking-wider">Level {level}</div>
            <div className="w-28 bg-slate-700 h-2.5 rounded-full overflow-hidden mt-1">
              <div 
                className="bg-emerald-500 h-full transition-all duration-300" 
                style={{ width: `${Math.min(100, Math.max(0, hp))}%` }}
              />
            </div>
          </div>

          {isOffline && (
            <span className="bg-emerald-500/20 text-emerald-400 text-xs px-2.5 py-1 rounded-full font-semibold border border-emerald-500/30">
              OFFLINE
            </span>
          )}
        </div>
      </div>

      {needRefresh && (
        <div className="pointer-events-auto bg-indigo-600 text-white p-3 rounded-xl flex justify-between items-center shadow-xl animate-bounce">
          <span className="text-sm font-semibold">New update available!</span>
          <button
            onClick={onRefreshPWA}
            className="bg-white text-indigo-600 text-xs font-bold px-3 py-1.5 rounded-lg shadow hover:bg-indigo-50"
          >
            Update SW
          </button>
        </div>
      )}
    </div>
  );
};
```

---

### FILE 12: `src/components/GameOverModal.tsx`

```tsx
import React, { useState } from 'react';

interface GameOverModalProps {
  score: number;
  level: number;
  onRestart: () => void;
}

export const GameOverModal: React.FC<GameOverModalProps> = ({ score, level, onRestart }) => {
  const [copied, setCopied] = useState(false);

  const handleShare = () => {
    const text = `⚡ I survived Level ${level} and scored ${score.toLocaleString()} pts in ZESA Survivor! Play 100% offline without data: ${window.location.href}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl max-w-sm w-full text-center shadow-2xl">
        <div className="text-4xl mb-2">💥</div>
        <h2 className="text-2xl font-black text-red-500 mb-1">GRID OVERLOAD</h2>
        <p className="text-slate-400 text-sm mb-6">Your battery ran out of juice!</p>

        <div className="bg-slate-800/50 p-4 rounded-xl mb-6 border border-slate-700/50">
          <div className="text-slate-400 text-xs font-bold uppercase mb-1">Final Score</div>
          <div className="text-3xl font-black text-amber-400 mb-2">{score.toLocaleString()}</div>
          <div className="text-xs text-indigo-400 font-semibold">Reached Level {level}</div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={handleShare}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg flex items-center justify-center gap-2"
          >
            <span>💬</span>
            <span>{copied ? 'Copied to Clipboard!' : 'Flex on WhatsApp'}</span>
          </button>

          <button
            onClick={onRestart}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl transition shadow-lg"
          >
            Play Again
          </button>
        </div>
      </div>
    </div>
  );
};
```

---

### FILE 13: `src/App.tsx`

```tsx
import { useEffect, useRef, useState } from 'react';
import init, { Universe } from '../pkg/zesa_backend.js';
import { HUD } from './components/HUD';
import { GameOverModal } from './components/GameOverModal';
import { setupServiceWorker } from './sw-register';

const ORB_COLORS: Record<number, string> = {
  1: '#f59e0b', // Amber
  2: '#3b82f6', // Blue
  3: '#10b981', // Emerald
  4: '#8b5cf6', // Purple
  5: '#ec4899', // Pink
  6: '#ef4444', // Red
  7: '#06b6d4', // Cyan
  8: '#f97316', // Orange
  9: '#eab308', // Yellow
  10: '#ffffff', // Radiant White
};

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const universeRef = useRef<Universe | null>(null);
  const wasmMemoryRef = useRef<WebAssembly.Memory | null>(null);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [hp, setHp] = useState(100);
  const [xp, setXp] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [isOffline, setIsOffline] = useState(!navigator.onLine);
  const [needRefresh, setNeedRefresh] = useState(false);
  const updateSWRef = useRef<((reload?: boolean) => Promise<void>) | null>(null);

  // Initialize Service Worker
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

  // Initialize WASM and Canvas Game Loop
  useEffect(() => {
    async function start() {
      const wasmExports = await init();
      wasmMemoryRef.current = wasmExports.memory;

      const width = Math.min(window.innerWidth, 480);
      const height = window.innerHeight;

      const universe = new Universe(width, height);
      universeRef.current = universe;

      let lastTime = performance.now();
      let animId: number;

      const render = (time: number) => {
        const dt = Math.min((time - lastTime) / 1000, 0.05);
        lastTime = time;

        if (universeRef.current && canvasRef.current && wasmMemoryRef.current) {
          universeRef.current.tick(dt);

          const ptr = universeRef.current.get_render_data();
          const len = universeRef.current.get_render_data_len();
          const data = new Float32Array(wasmMemoryRef.current.buffer, ptr, len);

          const orbCount = data[0];
          const enemyCount = data[1];
          const particleCount = data[2];
          const px = data[3];
          const py = data[4];
          const php = data[5];
          const pscore = data[6];
          const plevel = data[7];
          const pxp = data[8];

          setScore(pscore);
          setLevel(plevel);
          setHp(php);
          setXp(pxp);

          if (universeRef.current.is_game_over()) {
            setGameOver(true);
          }

          // Canvas Render
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, width, height);

            // Container boundary line
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, height - 100);
            ctx.lineTo(width, height - 100);
            ctx.stroke();

            let idx = 9;

            // Render Orbs
            for (let i = 0; i < orbCount; i++) {
              const ox = data[idx];
              const oy = data[idx + 1];
              const olevel = data[idx + 2];
              const oradius = data[idx + 3];
              idx += 4;

              ctx.beginPath();
              ctx.arc(ox, oy, oradius, 0, Math.PI * 2);
              ctx.fillStyle = ORB_COLORS[olevel] || '#ffffff';
              ctx.shadowColor = ORB_COLORS[olevel] || '#ffffff';
              ctx.shadowBlur = 10;
              ctx.fill();
              ctx.shadowBlur = 0;
            }

            // Render Enemies
            for (let i = 0; i < enemyCount; i++) {
              const ex = data[idx];
              const ey = data[idx + 1];
              idx += 3;

              ctx.beginPath();
              ctx.arc(ex, ey, 10, 0, Math.PI * 2);
              ctx.fillStyle = '#ef4444';
              ctx.fill();
            }

            // Render Particles
            for (let i = 0; i < particleCount; i++) {
              const ptX = data[idx];
              const ptY = data[idx + 1];
              const ptLife = data[idx + 2];
              const ptTier = data[idx + 3];
              idx += 4;

              ctx.beginPath();
              ctx.arc(ptX, ptY, 4 * ptLife, 0, Math.PI * 2);
              ctx.fillStyle = ORB_COLORS[ptTier] || '#ffffff';
              ctx.fill();
            }

            // Render Player
            ctx.beginPath();
            ctx.arc(px, py, 16, 0, Math.PI * 2);
            ctx.fillStyle = '#38bdf8';
            ctx.shadowColor = '#38bdf8';
            ctx.shadowBlur = 15;
            ctx.fill();
            ctx.shadowBlur = 0;
          }
        }

        animId = requestAnimationFrame(render);
      };

      animId = requestAnimationFrame(render);
      return () => cancelAnimationFrame(animId);
    }

    start();
  }, []);

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!universeRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    universeRef.current.drop_orb(x, Math.floor(Math.random() * 3) + 1);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!universeRef.current || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    universeRef.current.move_player(x);
  };

  const handleRestart = () => {
    const width = Math.min(window.innerWidth, 480);
    const height = window.innerHeight;
    universeRef.current = new Universe(width, height);
    setGameOver(false);
    setScore(0);
    setLevel(1);
    setHp(100);
  };

  return (
    <div className="flex justify-center items-center h-screen w-screen bg-slate-950 select-none">
      <div className="relative w-full max-w-[480px] h-full overflow-hidden bg-slate-900 shadow-2xl">
        <HUD
          score={score}
          level={level}
          hp={hp}
          xp={xp}
          isOffline={isOffline}
          needRefresh={needRefresh}
          onRefreshPWA={() => updateSWRef.current?.(true)}
        />

        <canvas
          ref={canvasRef}
          width={Math.min(window.innerWidth, 480)}
          height={window.innerHeight}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          className="w-full h-full touch-none cursor-pointer"
        />

        {gameOver && (
          <GameOverModal
            score={score}
            level={level}
            onRestart={handleRestart}
          />
        )}
      </div>
    </div>
  );
}
```

---

### FILE 14: `src/main.tsx`

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

---

### FILE 15: `src/index.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

html, body, #root {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: #020617;
}
```

---

### FILE 16: `.github/workflows/deploy.yml`

```yaml
name: Build and Deploy PWA to Vercel

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install Rust Toolchain
        uses: dtolnay/rust-toolchain@stable
        with:
          targets: wasm32-unknown-unknown

      - name: Cache Rust Dependencies
        uses: swatinem/rust-cache@v2
        with:
          workspaces: 'backend -> target'

      - name: Install wasm-bindgen CLI
        run: cargo install wasm-bindgen-cli --version 0.2.92

      - name: Install Node Dependencies
        run: npm ci

      - name: Build WebAssembly & Vite App
        run: npm run build

      - name: Install Vercel CLI
        run: npm install --global vercel@latest

      - name: Pull Vercel Environment Information
        run: vercel pull --yes --environment=production --token=${{ secrets.VERCEL_TOKEN }}

      - name: Build Project Artifacts for Vercel
        run: vercel build --prod --token=${{ secrets.VERCEL_TOKEN }}

      - name: Deploy Prebuilt Output to Vercel
        run: vercel deploy --prebuilt --prod --token=${{ secrets.VERCEL_TOKEN }}
```

---

Verify that all files are created under their respective directory paths. Ensure WASM builds cleanly via `npm run wasm` and TypeScript compiles without errors.
```
