const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
test('repository checks require audio and Help regressions, including built preview artifacts', () => {
  const script = fs.readFileSync(path.join(root, 'scripts/check-repository.ps1'), 'utf8');
  for (const name of ['audio-timeline', 'help-dialog', 'regression-gates']) assert.ok(script.includes(`tests/${name}.test.cjs`));
  assert.match(script, /test-artifacts\.cjs['"]\) --without-self-extract/);
});
test('full artifact tests precede publication in both full-build workflows', () => {
  for (const name of ['build-standalone.yml', 'deploy-pages.yml']) {
    const yaml = fs.readFileSync(path.join(root, '.github/workflows', name), 'utf8');
    assert.match(yaml, /run: node \.\/scripts\/test-artifacts\.cjs/);
    assert.ok(yaml.indexOf('test-artifacts.cjs') < yaml.indexOf('actions/upload-'));
  }
});

test('standalone builder reassembles all seven pinned WASM chunks and fills build metadata', () => {
  const build = fs.readFileSync(path.join(root, 'build-standalone.ps1'), 'utf8');
  const source = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
  assert.match(source, /const ORT_WASM_GZIP="__ORT_WASM_GZIP_B64__"/);
  for (const marker of ['__BUILD_VERSION__', '__BUILD_TIMESTAMP_UTC__', '__BUILD_DEPENDENCIES__']) {
    assert.ok(source.includes(marker), marker);
    assert.ok(build.includes(marker), marker);
  }
  const parts = Array.from({length: 7}, (_, i) => fs.readFileSync(path.join(root, 'src', 'embedded', 'ort-wasm-gzip.part' + String(i+1).padStart(2,'0') + '.b64'), 'ascii'));
  const combined = parts.join('');
  assert.equal(combined.length, 4376504, 'pinned base64 size');
  const wasm = require('node:zlib').gunzipSync(Buffer.from(combined, 'base64'));
  assert.equal(wasm.subarray(0, 4).toString('hex'), '0061736d', 'valid WebAssembly header');
});

test('release workflow runs after main merge and tests HTML before publishing a unique version tag', () => {
  const yaml = fs.readFileSync(path.join(root, '.github/workflows/release.yml'), 'utf8');
  assert.match(yaml, /push:\s*\n\s*branches: \[main\]/);
  assert.match(yaml, /permissions:\s*\n\s*contents: write/);
  assert.match(yaml, /github\.ref == 'refs\/heads\/main'/);
  assert.match(yaml, /app\.config\.json/);
  assert.match(yaml, /gh release view/);
  assert.match(yaml, /gh release create/);
  assert.ok(yaml.indexOf('check-repository.ps1') < yaml.indexOf('gh release create'));
  assert.ok(yaml.indexOf('test-artifacts.cjs') < yaml.indexOf('gh release create'));
  assert.match(yaml, /release\/video-face-redactor\.self-extract\.html/);
});

test('failed exports close encoder and decoder before re-enabling export actions', () => {
  const source = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
  const start = source.indexOf('async function exportVideo()');
  const end = source.indexOf("$('export').onclick=exportVideo", start);
  assert.ok(start >= 0 && end > start);
  const method = source.slice(start, end);
  assert.match(method, /let encoder=null,decoder=null;try\{/);
  assert.match(method, /finally\{try\{decoder\?\.close\(\)\}catch\{\}try\{encoder\?\.close\(\)\}catch\{\}busy=false/);
});
