import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const manifest = JSON.parse(readFileSync('dist/manifest.webmanifest', 'utf8'));
assert.equal(manifest.id, '/');
assert.equal(manifest.start_url, '/');
assert.equal(manifest.scope, '/');
assert.equal(manifest.display, 'standalone');
for (const [size, purpose] of [[192, 'any'], [512, 'any'], [512, 'maskable']]) {
  const icon = manifest.icons.find(i => i.sizes === `${size}x${size}` && i.purpose === purpose);
  assert.ok(icon, `${size}px ${purpose} icon is available`);
  assert.equal(icon.type, 'image/png');
  const bytes = readFileSync(`dist/${icon.src.replace(/^\//, '')}`);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), size);
  assert.equal(bytes.readUInt32BE(20), size);
  assert.ok(readFileSync('dist/sw.js', 'utf8').includes(icon.src.replace(/^\//, '')), 'icon is cached offline');
}
const apple = readFileSync('dist/apple-touch-icon.png');
assert.equal(apple.readUInt32BE(16), 180);
assert.equal(apple.readUInt32BE(20), 180);
assert.ok(readFileSync('dist/index.html', 'utf8').includes('/apple-touch-icon.png'));
assert.ok(readFileSync('dist/sw.js', 'utf8').includes('manifest.webmanifest'));
console.log('PWA checks passed: manifest identity, home-screen launch, PNG icons, Apple icon, and offline precache.');
