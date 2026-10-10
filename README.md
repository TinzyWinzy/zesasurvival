# ZESA Survivor: Physics Horde

Offline-first PWA merge-and-survive game. Drop orbs, merge same-level orbs into
higher tiers, and hold the grid against a 5-wave horde until dawn.

**100% offline. No account. No backend.** Gameplay runs entirely client-side in
Rust compiled to WebAssembly; persistence is `localStorage`. A playing user
costs nothing in server compute.

## Stack

| Layer      | Tech                                              |
| ---------- | ------------------------------------------------- |
| Game logic | Rust → WebAssembly (`wasm-bindgen` 0.2.92)        |
| UI         | React 18 + TypeScript + Vite                      |
| Styling    | Tailwind CSS                                      |
| Audio      | WebAudio synth (no asset files); 432 Hz base, tension-blended |
| Sprites    | Procedural Canvas 2D (no image assets)            |
| PWA        | vite-plugin-pwa (workbox, offline precache)       |
| Deploy     | Vercel via GitHub Actions                         |

## Commands

```bash
npm install          # install deps
npm run wasm         # build Rust → pkg/ (requires rustc + wasm-bindgen-cli 0.2.92)
npm run build        # tsc + wasm + vite build → dist/
npm run dev          # vite dev server
cargo test --manifest-path backend/Cargo.toml
```

`pkg/` and `dist/` are generated — never edit by hand, never commit.

## Run modes

| Mode      | Length   | Notes                              |
| --------- | -------- | ---------------------------------- |
| Blitz     | 3:00     | fast sprint                        |
| Standard  | 5:00     | hold until dawn (victory at W5)    |
| Endless   | ∞        | overtime scaling past 5:00         |

## Architecture notes

- **WASM ABI**: render buffer header is 33 floats (append-only, indices 0–16
  stable). Defined in `backend/src/lib.rs` and mirrored in `HEADER_LEN` in
  `src/App.tsx`. Change both together.
- **`wasm-bindgen` is pinned to `0.2.92`** in both `backend/Cargo.toml` and the
  CI workflow. Bumping it requires rebuilding `pkg/` locally.
- **Continuous level-ups.** Each earned upgrade installs automatically, with a
  brief non-blocking notification. Gameplay and input continue without a pause.
- **Adaptive music.** `music.setStakes()` is called every frame with wave, HP,
  enemy pressure and time remaining. Those blend into one tension value that
  drives layer gains, lowpass cutoff and tempo (96–126 BPM) — no hard cuts on
  wave boundaries. Pause ducks the bed; dawn resolves minor → major.

## Deploy

Pushes to `main` trigger `.github/workflows/deploy.yml`, which builds the WASM
and Vite bundle, runs Rust tests, then deploys to Vercel. Requires three
repository secrets: `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`.

---

MIT.

## Install on your phone

Tap **Install app** in the menu. Supported browsers show their native install prompt; other browsers show home-screen instructions. On iPhone/iPad, open Safari, choose Share → Add to Home Screen → Add. Launch from the home-screen icon for the standalone game. Wait for **Ready for offline play** before going offline. Scores and badges remain on the device. Updates are offered in the menu and never reload a run automatically.

`npm run test:pwa` checks the generated manifest, PNG icon dimensions, Apple icon and offline precache after a production build.
