// Cross-platform WASM build: cargo build + wasm-bindgen --target web into ./pkg
// Usage: node scripts/build-wasm.mjs [--if-missing]
// Self-healing on minimal CI/static-host builders (e.g. Vercel): installs the
// wasm32 target via rustup when missing, and fetches a pinned wasm-bindgen
// CLI release binary on Linux when no local install exists.
import { execSync } from 'node:child_process';
import { existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { homedir, tmpdir, platform } from 'node:os';

const WASM_BINDGEN_VERSION = '0.2.92'; // keep in sync with backend/Cargo.toml

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
  // Minimal Linux builders (Vercel) have no cargo toolchain extras:
  // fetch the pinned release binary into the user cache.
  if (platform() === 'linux') {
    const fetched = fetchWasmBindgen();
    if (fetched) return `"${fetched}"`;
  }
  return 'wasm-bindgen';
}

// Download the pinned wasm-bindgen CLI release for x86_64 Linux. Returns the
// binary path, or null when offline / unsupported.
function fetchWasmBindgen() {
  try {
    const dir = join(homedir() || tmpdir(), '.cache', 'zesa-wasm-bindgen', WASM_BINDGEN_VERSION);
    const bin = join(dir, `wasm-bindgen-${WASM_BINDGEN_VERSION}-x86_64-unknown-linux-musl`, 'wasm-bindgen');
    if (existsSync(bin)) {
      console.log(`Reusing cached wasm-bindgen ${WASM_BINDGEN_VERSION}.`);
      return bin;
    }
    mkdirSync(dir, { recursive: true });
    const url = `https://github.com/wasm-bindgen/wasm-bindgen/releases/download/${WASM_BINDGEN_VERSION}/wasm-bindgen-${WASM_BINDGEN_VERSION}-x86_64-unknown-linux-musl.tar.gz`;
    const tgz = join(dir, 'wasm-bindgen.tar.gz');
    console.log(`Fetching wasm-bindgen ${WASM_BINDGEN_VERSION} release binary…`);
    execSync(`curl -sSL -o "${tgz}" "${url}"`, { stdio: 'inherit', shell: true });
    execSync(`tar -xzf "${tgz}" -C "${dir}"`, { stdio: 'inherit', shell: true });
    if (existsSync(bin)) return bin;
  } catch (e) {
    console.error(`wasm-bindgen fetch failed: ${e.message}`);
  }
  return null;
}

if (ifMissing && pkgFresh()) {
  console.log('WASM pkg up to date, skipping rebuild.');
  process.exit(0);
}

try {
  // Best-effort: minimal builders ship Rust without the wasm target.
  // No-op when already installed; ignored when rustup is absent.
  try {
    run('rustup target add wasm32-unknown-unknown', backendDir);
  } catch {
    console.log('rustup unavailable; proceeding with installed targets.');
  }
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
