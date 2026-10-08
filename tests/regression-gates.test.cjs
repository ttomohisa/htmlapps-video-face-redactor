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
