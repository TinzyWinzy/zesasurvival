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
  assert.equal(data.length, headerLength + data[0] * 4 + data[1] * 4 + data[2] * 4 + data[20] * 3 + data[24] * 5 + data[25] * 2);
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
for (const [name, index] of [['pgauge', 23], ['beamCount', 24], ['energyCount', 25]]) {
  assert.match(app, new RegExp(`const ${name} = copy\\[${index}\\]`));
}
for (let i = 0; i < 500; i++) { u.tick(1 / 60); frame(u); }
u.resize(320, 600);
assert.ok(u.get_player_x() <= 300);
assert.equal(frame(u)[4], 528);
u.free();

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
console.log('Game integration passed: render ABI, entity frames, resizing, all upgrade cards, and duplicate filtering.');
