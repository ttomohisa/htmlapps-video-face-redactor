const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const removed = [
  "<p data-ja=\"小さい画面では本文をスクロールできます。閉じるボタンは表示されたままになり、ダイアログを閉じるまで背景のスクロールは止まります。\" data-en=\"On small screens, scroll the help content while the close button stays visible. Background scrolling resumes after the dialog closes.\">小さい画面では本文をスクロールできます。閉じるボタンは表示されたままになり、ダイアログを閉じるまで背景のスクロールは止まります。</p>"
];
for (const file of ["src/index.template.html", "video-face-redactor.html"]) {
  test(`${file}: user help omits implementation commentary`, () => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    for (const text of removed) assert.ok(!html.includes(text), `Remove implementation copy from ${file}`);
  });
}
