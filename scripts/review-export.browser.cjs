'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? {channel: process.env.PLAYWRIGHT_CHANNEL} : {});
  try {
    const context = await browser.newContext({viewport: {width: 390, height: 844}, reducedMotion: 'reduce', locale: 'ja'});
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(pathToFileURL(path.resolve('dist/index.html')).href);
    await page.locator('#viewerOpen').waitFor();
    assert.equal(await page.locator('#open').isVisible(), false, 'one primary file picker before loading');
    await page.setViewportSize({width:1280, height:800});
    await page.locator('#settingsNav [aria-controls="detectSection"]').click();
    assert.equal(await page.locator('#detectFps').isVisible(), true);
    assert.equal(await page.locator('#effectSection').isVisible(), false);
    await page.locator('#settingsNav [aria-controls="effectSection"]').click();
    assert.equal(await page.locator('[data-effect-choice="blur"]').isVisible(), true);
    await page.setViewportSize({width:390, height:844});
    await page.locator('#viewer').evaluate(viewer => {
      const dataTransfer = new DataTransfer();
      dataTransfer.items.add(new File(['not a video'], 'invalid.mp4', {type:'video/mp4'}));
      viewer.dispatchEvent(new DragEvent('drop', {bubbles:true, cancelable:true, dataTransfer}));
    });
    await page.waitForFunction(() => document.querySelector('#meta').textContent.includes('読み込めませんでした'));
    assert.equal(await page.locator('#viewerOpen').isVisible(), true, 'retry after a failed drop');
    await page.locator('#file').setInputFiles(path.resolve('assets/video-face-redactor-ja.mp4'));
    await page.waitForFunction(() => !document.getElementById('export').disabled, null, {timeout: 120000});
    const auto = page.locator('#trackList [data-select]');
    assert.ok(await auto.count() > 0, 'bundled sample produced automatic paths');
    await auto.last().click();
    await page.waitForFunction(() => document.querySelector('#video').paused && document.querySelector('#video').currentTime > 0);
    assert.equal(await auto.last().getAttribute('aria-pressed'), 'true');
    await page.locator('#clearTracks').click();
    await page.locator('[data-mobile-key="save"]').click();
    assert.equal(await page.locator('#exportSection').evaluate(el => document.activeElement === el), true);
    assert.equal(await page.locator('#export').textContent(), '顔を隠さずに書き出す');
    const canceled = page.waitForEvent('dialog').then(async dialog => {
      assert.match(dialog.message(), /有効なマスクは0件/);
      await dialog.dismiss();
    });
    await Promise.all([canceled, page.locator('#export').click()]);
    assert.equal(await page.locator('#exportStatus').textContent(), '');
    await page.locator('[data-mobile-key="style"]').click();
    assert.equal(await page.locator('#trackList').isVisible(), false);
    await page.locator('[data-effect-choice="fill"]').click();
    await page.locator('#fillColor').fill('#ff00ff');
    await page.locator('#manualOptions summary').click();
    await page.locator('[data-manual-duration="all"]').click();
    await page.locator('#manual').click();
    assert.equal(await page.locator('#manualPrompt').isVisible(), true);
    await page.locator('#cancelManual').click();
    assert.equal(await page.locator('#manualPrompt').isVisible(), false);
    await page.locator('#quickManual').click();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#manualPrompt').isVisible(), false);
    await page.locator('#quickManual').click();
    const canvas = page.locator('#canvas');
    await canvas.scrollIntoViewIfNeeded();
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width * .35, box.y + box.height * .35);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * .65, box.y + box.height * .65, {steps: 6});
    await page.mouse.up();
    assert.equal(await page.locator('#maskManual').textContent(), '1 / 1');
    await page.locator('[data-mobile-key="save"]').click();
    await page.locator('#outputName').fill('snapshot.mp4');
    // Change the live editor after its first real encoded frame. The download must
    // retain the original name and full-duration magenta cover.
    await page.evaluate(() => {
      const original = VideoEncoder.prototype.encode;
      VideoEncoder.prototype.encode = function(frame, options) {
        const result = original.call(this, frame, options);
        VideoEncoder.prototype.encode = original;
        document.querySelector('#trackList [data-toggle]').click();
        document.querySelector('[data-effect-choice="emoji"]').click();
        document.querySelector('#outputName').value = 'changed.mp4';
        return result;
      };
    });
    const downloadPromise = page.waitForEvent('download', {timeout: 120000});
    await page.locator('#export').click();
    const download = await downloadPromise;
    assert.equal(download.suggestedFilename(), 'snapshot.mp4');
    assert.equal(await page.locator('#maskManual').textContent(), '0 / 1');
    assert.equal(await page.locator('#effect').inputValue(), 'emoji');
    const bytes = await fs.readFile(await download.path());
    const pixels = await page.evaluate(async base64 => {
      const video = document.createElement('video');
      const media = new Blob([Uint8Array.from(atob(base64), c => c.charCodeAt(0))], {type:'video/mp4'});
      const url = URL.createObjectURL(media);
      const once = event => new Promise((resolve,reject) => {
        video.addEventListener(event, resolve, {once:true});
        video.onerror = () => reject(Error('Could not decode the exported MP4'));
      });
      try {
        const loaded = once('loadeddata');
        video.preload = 'auto'; video.src = url; await loaded;
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d', {willReadFrequently:true}), samples = [];
        for (const t of [.1, video.duration/2, video.duration-.1]) {
          const seek = once('seeked'); video.currentTime = t; await seek;
          ctx.drawImage(video, Math.floor(video.videoWidth/2), Math.floor(video.videoHeight/2), 1, 1, 0, 0, 1, 1);
          samples.push(Array.from(ctx.getImageData(0,0,1,1).data).slice(0,3));
        }
        return samples;
      } finally { video.removeAttribute('src'); video.load(); URL.revokeObjectURL(url); }
    }, bytes.toString('base64'));
    for (const [r,g,b] of pixels) assert.ok(r > 200 && g < 50 && b > 200, 'snapshot pixel '+[r,g,b]);
    assert.deepEqual(errors, []);
    console.log('Mobile save, zero-mask cancellation, track jump and exported MP4 verified. RGB samples:', pixels);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
