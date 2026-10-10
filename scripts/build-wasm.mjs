// Cross-platform WASM build: cargo build + wasm-bindgen --target web into ./pkg
// Usage: node scripts/build-wasm.mjs [--if-missing]
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const backendDir = join(root, 'backend');
const pkgDir = join(root, 'pkg');
const wasmFile = join(backendDir, 'target', 'wasm32-unknown-unknown', 'release', 'zesa_backend.wasm');
const ifMissing = process.argv.includes('--if-missing');

function pkgFresh() {
  const js = join(pkgDir, 'zesa_backend.js');
  const wasm = join(pkgDir, 'zesa_backend_bg.wasm');
  if (!existsSync(js) || !existsSync(wasm) || !existsSync(wasmFile)) return false;
  try {
    const files = readdirSync(join(backendDir, 'src'));
    let newestSrc = 0;
    for (const f of files) {
      newestSrc = Math.max(newestSrc, statSync(join(backendDir, 'src', f)).mtimeMs);
    }
    const pkgTime = Math.min(statSync(js).mtimeMs, statSync(wasm).mtimeMs);
    return pkgTime > newestSrc;
  } catch {
    return false;
  }
}

function run(cmd, cwd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { cwd, stdio: 'inherit', shell: true });
}

function wasmBindgenBin() {
  try {
    const out = execSync('where wasm-bindgen', { stdio: ['ignore', 'pipe', 'ignore'], shell: true })
      .toString()
      .split(/\r?\n/)[0]
      .trim();
    if (out) return `"${out}"`;
  } catch { /* not on PATH */ }
  try {
    const home = process.env.USERPROFILE || process.env.HOME || '';
    const candidate = join(home, '.cargo', 'bin', process.platform === 'win32' ? 'wasm-bindgen.exe' : 'wasm-bindgen');
    if (existsSync(candidate)) return `"${candidate}"`;
  } catch { /* ignore */ }
  return 'wasm-bindgen';
}

if (ifMissing && pkgFresh()) {
  console.log('WASM pkg up to date, skipping rebuild.');
  process.exit(0);
}

try {
  run('cargo build --target wasm32-unknown-unknown --release', backendDir);
} catch (e) {
  console.error('\nCargo WASM build failed. Install target with: rustup target add wasm32-unknown-unknown');
  process.exit(1);
}

mkdirSync(pkgDir, { recursive: true });
const bin = wasmBindgenBin();
try {
  run(`${bin} "${wasmFile}" --out-dir "${pkgDir}" --target web`, root);
} catch (e) {
  console.error('\nwasm-bindgen failed. Install matching CLI: cargo install wasm-bindgen-cli --version 0.2.92');
  console.error('Ensure CLI version matches wasm-bindgen in backend/Cargo.toml.');
  process.exit(1);
}
console.log('WASM build complete -> ./pkg');
