// CI verification only; the PowerShell standalone builder does not require Node.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const zlib = require('node:zlib');
const { spawnSync } = require('node:child_process');
const root = path.join(__dirname, '..');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'redactor-artifacts-'));
function run(args, env = {}) {
  const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit', env: { ...process.env, ...env } });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, `Regression command: node ${args.join(' ')}`);
}
try {
  const built = fs.readFileSync(path.join(root, 'dist/index.html'));
  assert.deepEqual(fs.readFileSync(path.join(root, 'video-face-redactor.html')), built, 'root/dist byte parity');
  const targets = ['src/index.template.html', 'video-face-redactor.html', 'dist/index.html'];
  if (!process.argv.includes('--without-self-extract')) {
    const wrapper = fs.readFileSync(path.join(root, 'dist/index.self-extract.html'), 'utf8');
    const payload = wrapper.match(/<script id="self-extract-payload" type="application\/octet-stream">([A-Za-z0-9+/=\r\n]+)<\/script>/);
    assert.ok(payload, 'self-extract payload exists');
    const restored = zlib.gunzipSync(Buffer.from(payload[1], 'base64'));
    assert.deepEqual(restored, built, 'self-extract/dist byte parity');
    const restoredPath = path.join(temporary, 'restored.html'); fs.writeFileSync(restoredPath, restored); targets.push(restoredPath);
  }
  for (const target of targets) run(['--test', 'tests/export-review.test.cjs', 'tests/audio-timeline.test.cjs', 'tests/help-dialog.test.cjs'], { APP_SOURCE: path.resolve(root, target) });
  run(['tests/header-normalization.test.mjs', ...targets]);
  console.log(`Verified source and ${targets.length - 1} generated artifacts, including exact byte parity.`);
} finally { fs.rmSync(temporary, { recursive: true, force: true }); }
