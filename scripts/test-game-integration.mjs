import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { initSync, Universe } from '../pkg/zesa_backend.js';

const wasm = initSync(readFileSync(new URL('../pkg/zesa_backend_bg.wasm', import.meta.url)));
const app = readFileSync(new URL('../src/App.tsx', import.meta.url), 'utf8');
const headerLength = Number(app.match(/const HEADER_LEN = (\d+)/)[1]);
const frame = (u) => {
  const pointer = u.get_render_data();
  const data = Float32Array.from(new Float32Array(wasm.memory.buffer, pointer, u.get_render_data_len()));
  assert.equal(data.length, headerLength + data[0] * 4 + data[1] * 4 + data[2] * 4 + data[20] * 3 + data[24] * 5 + data[25] * 2 + data[33] * 4);
  return data;
};
const u = new Universe(480, 800);
u.apply_loadout(1);
u.drop_orb(123, 2);
let data = frame(u);
assert.equal(data[headerLength], 123);
assert.equal(data[headerLength + 2], 2);
assert.equal(data[23], 50);
u.drop_orb(123, 2);
u.tick(1 / 60);
data = frame(u);
assert.equal(data[22], 3);
assert.ok(data[24] > 0, 'A merge must produce a correctly indexed beam');
assert.ok(data[2] > 0, 'Merge particle records must be included in the frame');
  for (const [name, index] of [['pgauge', 23], ['beamCount', 24], ['energyCount', 25], ['prelayCount', 33]]) {
  assert.match(app, new RegExp(`const ${name} = copy\\[${index}\\]`));
}
for (let i = 0; i < 500; i++) { u.tick(1 / 60); frame(u); }
u.resize(320, 600);
assert.ok(u.get_player_x() <= 300);
assert.equal(frame(u)[4], 528);
u.free();

// Relays: gauge sink is exported, refuses when broke, and the ABI carries the count.
const relayWorld = new Universe(480, 800);
assert.equal(typeof relayWorld.deploy_relay, 'function');
assert.equal(relayWorld.deploy_relay(240), false, 'broke: deployment must refuse');
assert.equal(frame(relayWorld)[33], 0);
relayWorld.free();

// Run the actual card generator against the compiled WASM engine.
const temporary = new URL('./.upgrade-test.mjs', import.meta.url);
try {
  const source = readFileSync(new URL('../src/components/UpgradeModal.tsx', import.meta.url), 'utf8');
  writeFileSync(temporary, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.React } }).outputText);
  const { generateUpgradeChoices } = await import(temporary.href);
  const cards = new Map();
  for (let i = 0; i < 100; i++) for (const card of generateUpgradeChoices()) cards.set(card.id, card);
  assert.equal(cards.size, 5);
  const expected = new Map([[4, [26, 1.25]], [5, [28, 1]], [6, [29, 1]], [7, [30, 1]], [8, [32, 2]]]);
  for (const [id, [index, value]] of expected) {
    assert.ok(cards.has(id));
    const engine = new Universe(480, 800);
    engine.apply_powerup(id);
    assert.equal(frame(engine)[index], value, cards.get(id).title);
    engine.free();
  }
  for (let i = 0; i < 20; i++) {
    const choices = generateUpgradeChoices(new Set([5, 6]));
    assert.equal(choices.length, 3);
    assert.ok(choices.every((choice) => choice.id !== 5 && choice.id !== 6));
  }
} finally {
  unlinkSync(fileURLToPath(temporary));
}

// Markov dealer: seeded distribution checks against the actual TS source.
const dealerTemp = new URL('./.dealer-test.mjs', import.meta.url);
try {
  const dealerSource = readFileSync(new URL('../src/game/dealer.ts', import.meta.url), 'utf8');
  writeFileSync(dealerTemp, ts.transpileModule(dealerSource, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText);
  const { dealOrb } = await import(dealerTemp.href);
  const mulberry = (seed) => () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const freq = (last, counts, n = 2000) => {
    const rand = mulberry(42);
    const f = { 1: 0, 2: 0, 3: 0 };
    for (let i = 0; i < n; i++) f[dealOrb(last, counts, rand)]++;
    return { 1: f[1] / n, 2: f[2] / n, 3: f[3] / n };
  };
  // Validity: always a droppable level.
  {
    const rand = mulberry(7);
    for (let i = 0; i < 500; i++) {
      const v = dealOrb(i % 2 ? [1, 2] : null, i % 3 ? { 2: 3 } : {}, rand);
      assert.ok(v === 1 || v === 2 || v === 3);
    }
  }
  // Streak memory: [2,2] deals 2 about half the time, well above uniform.
  assert.ok(freq([2, 2], {})[2] > 0.45, 'streak must persist');
  // Last-favor: [1,3] favors 3 over the 0.3 baseline.
  assert.ok(freq([1, 3], {})[3] > 0.35, 'last level must be favored');
  // Board pull: two level-1s on the field pull deals toward 1 (~0.44 vs 0.33).
  assert.ok(freq(null, { 1: 2 })[1] > 0.4, 'board pair must pull its level');
  // Empty board, no history: near-uniform.
  {
    const f = freq(null, {});
    assert.ok(Math.abs(f[1] - 1 / 3) < 0.06 && Math.abs(f[2] - 1 / 3) < 0.06 && Math.abs(f[3] - 1 / 3) < 0.06);
  }
} finally {
  unlinkSync(fileURLToPath(dealerTemp));
}
console.log('Game integration passed: render ABI, entity frames, resizing, relays, dealer, all upgrade cards, and duplicate filtering.');
