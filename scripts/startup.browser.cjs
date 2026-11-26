'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

module.exports = async function verifyStartup(browser) {
  const file = path.resolve('dist/index.html');
  const page = await browser.newPage({viewport: {width: 320, height: 568}, reducedMotion: 'reduce'});
  try {
    // A slow download can stop before the module and its embedded assets arrive.
    const html = fs.readFileSync(file, 'utf8');
    await page.setContent(html.slice(0, html.indexOf('<script type="module">')));
    const loader = page.locator('#appStartup'), picker = page.locator('#viewerOpen');
    assert.equal(await loader.isVisible(), true);
    assert.equal(await picker.isVisible(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight), true);
    assert.equal(await page.locator('#startupSpinner').evaluate(el => getComputedStyle(el).animationName), 'none');
    const dropCanceled = await loader.evaluate(el => !el.dispatchEvent(new DragEvent('drop', {cancelable: true})));
    assert.equal(dropCanceled, true, 'dropping a file during startup must not navigate away');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement === document.body), true);

    // Hold the first decompression in each library independently, then use the real libraries.
    await page.addInitScript(() => {
      const read = Response.prototype.arrayBuffer;
      const pending = window.pendingStartupReads = [];
      Response.prototype.arrayBuffer = async function() {
        if (pending.length < 2) {
          await new Promise((resolve, reject) => pending.push({resolve, reject}));
        }
        return read.call(this);
      };
    });
    for (const first of [0, 1]) {
      await page.goto(pathToFileURL(file).href);
      await page.waitForFunction(() => window.pendingStartupReads.length === 2);
      await page.evaluate(i => window.pendingStartupReads[i].resolve(), first);
      await page.waitForFunction(key => document.documentElement.dataset[key] === '1', first === 0 ? 'mp4boxReady' : 'ortReady');
      assert.equal(await loader.isVisible(), true, 'one ready library must not unlock the editor');
      assert.equal(await picker.isVisible(), false);
      await page.evaluate(i => window.pendingStartupReads[i].resolve(), 1 - first);
      await picker.waitFor();
      assert.equal(await loader.isVisible(), false);
      assert.deepEqual(await page.locator('button').evaluateAll(buttons =>
        buttons.filter(b => getComputedStyle(b).boxShadow !== 'none').map(b => b.id || b.textContent)), []);
    }

    for (const failed of [0, 1]) {
      await page.reload();
      await page.waitForFunction(() => window.pendingStartupReads.length === 2);
      await page.evaluate(i => {
        window.pendingStartupReads[i].reject(Error('Simulated startup failure'));
        window.pendingStartupReads[1 - i].resolve();
      }, failed);
      await page.locator('#startupRetry').waitFor();
      assert.equal(await picker.isVisible(), false);
      assert.equal(await page.locator('#startupSpinner').isVisible(), false);
      assert.match(await loader.innerText(), /アプリを読み込めませんでした/);
      await Promise.all([page.waitForNavigation(), page.locator('#startupRetry').click()]);
      await page.waitForFunction(() => window.pendingStartupReads.length === 2);
      await page.evaluate(() => window.pendingStartupReads.forEach(read => read.resolve()));
      await picker.waitFor();
    }
    console.log('PASS startup visibility, dependency order, failure recovery and flat buttons');
  } finally { await page.close(); }
};
