# ZESA Survivor critique — 10 October 2026

## Fix and verification follow-up

The original findings below document the pre-fix working tree. Rendering now reads the 33-float engine header and correct charge/entity indices; upgrade cards use IDs 4–8; final scores and badge state are refreshed from the engine. Resizing updates simulation geometry. Input blocks during all pauses, keyboard movement/drop controls are available, and performance adaptation only reduces rendered particles. Invalid cross-entity interpolation was removed. Cryo Nova now expires after two seconds instead of permanently reducing enemy speed. Identical overlapping cells now merge instead of being ignored by collision detection.

The interface now includes gameplay instructions, a wrapping phone HUD, compact scrollable upgrade cards, improved menu text contrast, keyboard focus handling, a primary replay action, next-star feedback, and visible offline readiness. Level-ups now install upgrades automatically with a brief notification, preserving continuous gameplay as requested. The in-app browser playtest reached level 4 while drops, merges, and the timer continued, with no upgrade dialog.

The in-app browser timeout was resolved by starting the local server outside the filesystem sandbox. The production PWA loads and reports offline readiness. Stopping the production preview server, reloading the browser, and starting another game also succeeded using cached assets. Browser checks covered starting Blitz, keyboard drops/merges, upgrade pause/selection/resume, manual pause, results, and a 320 × 640 viewport. Screenshots are saved in audit-screenshots/. The short playtest confirms that the loop and controls function; it does not establish full-run balance across modes or real touch-device ergonomics.

Production build and TypeScript compilation pass. All 19 Rust tests pass. scripts/test-game-integration.mjs checks the actual compiled WASM render contract and each actual upgrade card against engine state, plus resize behavior and duplicate filtering.

## Original code review (before fixes)

Scope: original working tree, including existing uncommitted changes. At this stage the in-app browser timed out, no valid gameplay screenshots were captured, and no gameplay code had been changed. The follow-up above supersedes these original limitations where verification succeeded.

## Verdict

The game has a distinctive premise: merging electrical cells to defend a battery through a load-shedding night. Short runs, a dawn objective, local records, and account-free play suit the concept. However, current frontend/engine mismatches undermine the player's ability to see the simulation correctly and trust upgrade choices. Fix those before tuning balance or adding content.

## Confirmed technical findings

1. Critical: render-buffer contract is broken. In backend/src/lib.rs, the header has 33 floats. Index 22 is last_merge_tier, 23 is gauge, 24 is beam count, and 25 is energy count. src/App.tsx sets HEADER_LEN to 32 and reads gauge/beam count/energy count at 22/23/24. Consequently, entities are parsed one float early, the charge display reads merge tier, and the beam loop uses gauge as an entity count. This can misdraw entities and read beyond valid data. The README's 26-float contract is also obsolete. Add an integration check for header length, field positions, and a frame containing every entity type.

2. Critical: upgrade labels do not match applied effects. UpgradeModal IDs 1–5 describe Beam Width, Cryo Nova, Chain Lightning, Plasma Shield, and Overclock. App passes those IDs unchanged to apply_powerup. The engine maps 1–3 to Solar Shield, Surge Burst, and Freeze Schedule, and maps the new upgrades to 4–8. Every card currently applies the wrong effect; Chain Lightning, Plasma Shield, and Overclock are unreachable through their intended cards. Use shared upgrade identifiers and verify actual engine state after each selection.

3. High: frontend validation fails. npm run check reports 11 TypeScript errors: unused passive-upgrade code, unused upgrade fields, and nullable memory/canvas accesses. The production build invokes tsc -b, so frontend compilation is a release blocker. Vite starting successfully is insufficient validation.

4. High: resizing changes the canvas but not simulation geometry. handleResize updates sizeRef and canvas dimensions; the existing Universe retains its original width, height, and battery position. Rotation or mobile viewport-height changes can make the drawn arena disagree with collision/spawn boundaries. Define a stable arena with scaling, or explicitly resize the engine.

5. Medium: final results can use stale HUD state. HUD score/level/time update every 250ms. Victory sets gameOver immediately, and the death fallback can finish without a final HUD sync. The save effect records React score/level rather than reading final engine values. Capture a single authoritative run summary directly from the engine at termination.

6. Medium: newly earned badges can remain locked in the menu. The end-run effect loads badges into React state before checkBadges writes new unlocks. The results screen receives newBadges, but returning to the menu can show the old badge list until another refresh. Update badge state after unlocking.

7. Medium: difficulty changes with device performance. set_perf_mode changes enemy caps, speed scale, and HP scale; App chooses it using FPS and level. This reduces comparability of personal-best scores across devices. Optimize particles/rendering separately from gameplay difficulty, or visibly distinguish assisted runs.

## Player journey critique

1. Choose a shift — promising structure, weak first-use guidance. Three durations and one starting loadout give a clear pre-run choice. But the menu does not explain dropping, merging, moving the battery, discharge direction, or collecting energy. It asks newcomers to evaluate bonuses before understanding those systems. Add a brief playable introduction; keep records and badges secondary for a first-time player.

2. Start and survive — potentially strong loop, currently blocked by renderer defects. Equal-tier merges, radial damage, beams toward the battery, pickups, combo windows, and incoming-spawn telegraphs provide several strategic layers. Make the cause-and-effect chain explicit: merge cells → damage threats → collect energy → charge a stronger drop. Explain the battery's movement and its relationship to beam aiming.

3. Level up — untrustworthy until IDs are corrected. A three-card draft can create meaningful build choices, but current play pauses despite the README and leftover comments promising a passive rotation. Decide which experience the game should offer. If keeping drafts, show owned upgrades and exclude redundant non-stacking effects such as Cryo Nova after acquisition. Avoid pixel-radius jargon in player-facing descriptions.

4. Pause and resume — useful controls with state risks. There are separate React pause state and pausedRef simulation state; upgrades set only the latter. Input guards check the former, so they do not uniformly block actions while an upgrade draft is active. Derive input and simulation permission from one run phase. Mouse movement currently requires a held button, while touch aiming and movement share a gesture; test whether players understand and can manage both responsibilities.

5. Finish and retry — the necessary loop exists, but its hierarchy could improve. The first results action is sharing, followed by Play Again. Prioritize another run, especially after a loss. Explain one actionable lesson: which threat hurt the battery, whether energy was missed, or how close the next star target was. Show next-star progress during play or on results, rather than only in the menu. “Change track” is less precise than “Modes & loadout.”

6. Return later or play offline — good intent, incomplete feedback. The PWA precaches relevant asset types and localStorage stores records, but the offline-ready event only logs to the console. The menu's “100% offline” promise lacks a user-visible cache-ready confirmation. Explain readiness after initial caching. Actual offline reload, installation, and updates require browser testing.

## Accessibility and presentation risks from source

- Menu descriptions and metadata frequently use 9–11px type and muted slate colors on a very dark surface. Increase essential copy size and measure contrast against the rendered background.
- HUD packs score, next orb, wave, timer, level, HP, and XP into a single non-wrapping row. Its minimum content widths are a narrow-phone overflow risk; verify at 320px and 360px and reorganize into two rows if needed.
- Gameplay has pointer input but no keyboard movement/drop controls or canvas instructions. Upgrade keyboard support alone does not make the game keyboard playable.
- Dialog aria-modal declarations do not provide a focus trap. Upgrade selection's keyboard index can diverge from the button focused with Tab, making Enter select another card. Preserve button semantics and use native activation or synchronize the index on focus.
- Upgrade and results overlays have no scroll container, while the document disables overflow. Short screens and enlarged text can push actions outside the viewport.
- Reduced-motion CSS only removes title/CTA glows; it does not address canvas animation or charged-state pulsing. Provide a usable reduced-effects option and test it.
- Sprites vary shape/glyph as well as color, which is a useful foundation. Their practical distinguishability still needs visual testing.

## Design priorities

First make rendering, upgrade effects, and builds correct. Then teach the core loop in the first 20 seconds and make the HUD legible on a narrow phone. Next test whether moving the battery and placing merges create deliberate strategy or merely encourage rapid tapping in one lane. Only then tune enemy pressure, loadout strength, star thresholds, and build variety using recorded playtests.

The local utility-board vocabulary is the strongest identity cue. Carry it consistently through upgrades and results, where generic sci-fi upgrade names and conventional modal styling currently weaken that identity. Keep the electrical theme connected to actual mechanics and readable player choices.

## Verification

- cargo test --manifest-path backend/Cargo.toml: 17 passed, 0 failed.
- npm run check: 11 errors, failed.
- npm run dev -- --host 127.0.0.1: starts successfully; generated WASM package reported up to date.
- In-app browser capture: blocked by connection timeout; no hands-on or screenshot findings claimed.
- Existing tests cover engine behavior but do not establish frontend/engine interoperability, upgrade card mapping, responsive layout, accessibility, or actual offline readiness.


## Implemented follow-up

The original verification above records the initial audit. Subsequent fixes correct the rendering buffer, upgrade mapping, resize handling, input guards, final scores, offline status, and continuous automatic level-ups. Browser testing now succeeds.

Visual polish adds a compact HUD, dark red-outlined threats, a battery silhouette, restrained glow, fading merge beams and rings, and a gradual dawn with pylons and cables. Physics now uses tick-based target movement, adaptive collision substeps, mass-weighted impulses, floor friction, low bounce, inelastic merge momentum, and a small merge push. The battery rail and cell floor match their engine positions.

Verification: 23 Rust tests pass, TypeScript checking and production build pass, and the generated-WASM integration checks pass. In-app browser gameplay confirms continuous level-ups and the new presentation. Long-session balance and real-device performance still benefit from player testing.
