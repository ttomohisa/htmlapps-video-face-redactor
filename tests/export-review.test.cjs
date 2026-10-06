// Actual production functions with synthetic frames and rectangles only.
// No browser, user video, detector model, or codec is executed by this suite.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const source = fs.readFileSync(process.env.APP_SOURCE || path.join(__dirname, '../src/index.template.html'), 'utf8');
const lines = source.split('\n');
function production(name, optional = false) {
  const start = lines.findIndex(line => new RegExp(`^(?:async )?function ${name}\\(`).test(line));
  if (start < 0 && optional) return '';
  assert.notEqual(start, -1, `Production function ${name} must exist`);
  let end = start + 1;
  while (end < lines.length && (!/^\S/.test(lines[end]) || lines[end] === '}')) end++;
  return lines.slice(start, end).join('\n');
}
const names = ['tr', 'fmt', 'clamp', 'iou', 'centerDistance', 'matchScore', 'newTrack', 'addDetectionSet',
  'videoEndTime', 'lastVideoFrameTimeUs', 'frameRefs', 'nearestFrameRef', 'frameTimes', 'frameRangeAt', 'manualRangeAt',
  'keyframeBoxAt', 'compactTracks', 'boxAt', 'manualRangeLabel', 'manualAnchorTime', 'setExportEnabled',
  'analyzeVideo', 'clearReviewFrame', 'currentTime', 'setAnalysisFrameInfo', 'renderTracks', 'applyLang', 'loadFile', 'applyRedetectionAt'];
const rect = (t, x = 10) => ({ t, x, y: 8, w: 20, h: 18, score: 0.99 });
const manual = () => ({ id: 2, manual: true, enabled: true, keyframes: [rect(0, 50), rect(.6, 50)], first: 0, last: .6, uncertain: false, interpolation: 'hold', rangeMode: 'all', anchorTime: .2 });
const automatic = (id = 1) => ({ id, manual: false, enabled: true, keyframes: [rect(0), rect(.2, 12), rect(.4, 14)], first: 0, last: .4, uncertain: false, interpolation: 'linear', realKeyframes: 3 });
function harness({ initialDone = true, failure = null, encoderOk = true, busy = false, supported = true } = {}) {
  const elements = new Map(), callbacks = {}, calls = { detect: 0, decoder: 0, queuedReview: 0, writes: 0 };
  function element(id) {
    if (!elements.has(id)) {
      let text = '';
      elements.set(id, { disabled: false, style: {}, dataset: {}, value: id === 'detectFps' ? '5' : '', innerHTML: '',
        get textContent() { return text; }, set textContent(value) { calls.writes++; text = value; },
        classList: { remove() {}, add() {}, toggle() {} }, setAttribute() {},
        querySelectorAll(selector) {
          const attribute = selector.slice(1, -1);
          return [...this.innerHTML.matchAll(new RegExp(`${attribute}="(\\d+)"`, 'g'))].map(match => {
            const key = attribute.replace('data-', '');
            return callbacks[`${key}:${match[1]}`] = { dataset: { [key]: match[1] } };
          });
        }
      });
    }
    return elements.get(id);
  }
  const behavior = { failure }, decoders = [];
  const frame = timestamp => ({ timestamp, width: 96, height: 64, clone() { return frame(timestamp); }, close() {} });
  class SyntheticDecoder {
    constructor(handlers) { this.handlers = handlers; this.decodeQueueSize = 0; calls.decoder++; decoders.push(this); }
    configure() { if (behavior.failure === 'configure') throw Error('synthetic decoder configuration failure'); }
    decode(sample) { this.handlers.output(frame(sample.cts)); }
    async flush() { if (behavior.failure === 'flush') throw Error('synthetic decoder flush failure'); }
    close() {}
  }
  const sandbox = { lang: 'en', busy, analysisDone: initialDone, pendingAutoAnalyze: false,
    input: { supported, encoderOk, videoSamples: [0, 200000, 400000].map(cts => ({ cts, dts: cts, duration: 200000, timescale: 1000000, is_sync: true })) },
    file: {}, session: {}, tracks: [automatic(), manual()], nextTrackId: 3, selectedTrackId: null,
    video: { duration: .6, paused: true, currentTime: 0, pause() { this.paused = true; } },
    reviewDecodeToken: 0, reviewFrame: null, reviewFrameTime: null, reviewDecoding: false, analysisFrameInfo: new Map(),
    $: element, mobileBottom: { enabled: null, setEnabled(key, value) { assert.equal(key, 'save'); this.enabled = value; } },
    VideoDecoder: SyntheticDecoder, detectFrame: async f => { calls.detect++; if (behavior.failure === 'partial' && calls.detect === 2) throw Error('synthetic detection failure'); return [rect(f.timestamp / 1e6, 10 + f.timestamp / 100000)]; },
    getDecoderDescription() {}, sampleToChunk: sample => sample, waitUntil: async predicate => assert.equal(predicate(), true),
    renderMarks() {}, setAnalysisPreviewProgress() {}, toast() {}, drawPreview() {}, renderReviewState() {},
    updatePlayButton() {}, renderCapabilityStatus() {}, stopPlaybackPreview() {}, setManualEnabled() {}, startAutoAnalysisIfReady() {},
    document: { documentElement: {}, querySelectorAll() { return []; } },
    canvas: { width: 0, height: 0, classList: { remove() {}, add() {} }, addEventListener(name, callback) { callbacks[name] = callback; } },
    displayDims() { return { w: 96, h: 64 }; }, displayBoxToCoded: box => ({ ...box }),
    syncManualControls() {}, seekReviewTo() {}, queueMicrotask() { calls.queuedReview++; }, console: { error() {} },
    browserCaps: {}, mp4boxReady: Promise.reject(Error('synthetic new-file load failure'))
  };
  // loadFile owns the intentionally failed metadata promise in tests that call it.
  sandbox.mp4boxReady.catch(() => {});
  vm.createContext(sandbox);
  vm.runInContext(names.map(name => production(name)).join('\n') + '\n' +
    ['maskSummaryCounts', 'renderMaskSummary'].map(name => production(name, true)).join('\n'), sandbox);
  for (const pattern of ["$('clearTracks').onclick=", "canvas.addEventListener('pointerup'"]) {
    vm.runInContext(lines.find(line => line.startsWith(pattern)), sandbox);
  }
  vm.runInContext('setExportEnabled(analysisDone); renderTracks()', sandbox);
  return { sandbox, element, callbacks, calls, behavior, decoders, frame,
    run: code => vm.runInContext(code, sandbox), analyze: () => vm.runInContext('analyzeVideo()', sandbox) };
}
function assertGate(h, enabled) {
  assert.equal(!h.element('export').disabled, enabled, 'Desktop Export availability');
  assert.equal(h.sandbox.mobileBottom.enabled, enabled, 'Mobile Save availability');
}
for (const failure of ['configure', 'partial']) {
  test(`successful pass followed by ${failure} failure disables both export actions and preserves manual geometry`, async () => {
    const h = harness({ failure }); const before = JSON.stringify(h.sandbox.tracks[1]);
    await h.analyze();
    assert.equal(h.sandbox.analysisDone, false); assertGate(h, false);
    assert.equal(JSON.stringify(h.sandbox.tracks.find(t => t.manual)), before);
    assert.equal(h.run('boxAt(tracks.find(t=>t.manual),.2).x'), 50);
    h.run('tracks.find(t=>t.manual).enabled=false');
    assert.equal(h.run('boxAt(tracks.find(t=>t.manual),.2)'), null);
    assert.match(h.element('analysisStatus').textContent, /Could not find faces/);
    assert.equal(h.calls.queuedReview, 0);
  });
}
test('completion resets synchronously before a pending analysis and becomes true only on full success', async () => {
  const h = harness(); let resolve; const pending = new Promise(r => { resolve = r; });
  h.sandbox.detectFrame = async () => { await pending; return []; };
  const running = h.analyze();
  assert.equal(h.sandbox.analysisDone, false); assertGate(h, false);
  resolve(); await running;
  assert.equal(h.sandbox.analysisDone, true); assertGate(h, true);
});
test('failed rerun can retry successfully', async () => {
  const h = harness({ failure: 'configure' }); await h.analyze(); assertGate(h, false);
  h.behavior.failure = null; await h.analyze(); assertGate(h, true);
  assert.equal(h.sandbox.analysisDone, true); assert.equal(h.calls.queuedReview, 1);
});
for (const opts of [{ initialDone: false, failure: 'partial' }, { encoderOk: false }, { initialDone: false }, {}]) {
  test(`initial and encoder controls ${JSON.stringify(opts)}`, async () => {
    const h = harness(opts); await h.analyze(); assertGate(h, !opts.failure && opts.encoderOk !== false);
  });
}
for (const opts of [{ busy: true }, { supported: false }]) {
  test(`early guard preserves existing completion and tracks ${JSON.stringify(opts)}`, async () => {
    const h = harness(opts), before = JSON.stringify(h.sandbox.tracks); await h.analyze();
    assert.equal(h.sandbox.analysisDone, true); assert.equal(JSON.stringify(h.sandbox.tracks), before); assert.equal(h.calls.decoder, 0);
  });
}
test('failed old analysis cannot write tracks or status after a successful retry', async () => {
  const h = harness({ failure: 'flush' }); let resolve; const pending = new Promise(r => { resolve = r; });
  h.sandbox.detectFrame = async () => { await pending; return [rect(0, 75)]; };
  await h.analyze(); assertGate(h, false);
  h.behavior.failure = null; h.sandbox.detectFrame = async () => [rect(0)];
  await h.analyze(); const before = JSON.stringify(h.sandbox.tracks), status = h.element('analysisStatus').textContent;
  resolve(); await new Promise(r => setImmediate(r));
  h.decoders[0].handlers.output(h.frame(800000)); await new Promise(r => setImmediate(r));
  assert.equal(JSON.stringify(h.sandbox.tracks), before); assert.equal(h.element('analysisStatus').textContent, status); assertGate(h, true);
});
function summary(h) { return ['maskAuto', 'maskManual', 'maskDisabled', 'maskFlagged'].map(id => h.element(id).textContent); }
test('summary counts paths, includes disabled totals, and flags only enabled automatic paths', () => {
  const h = harness();
  h.sandbox.tracks.push({ ...automatic(3), enabled: false, uncertain: true }, { ...automatic(4), uncertain: true }, { ...manual(), id: 5, enabled: false, uncertain: true });
  h.run('renderTracks()'); assert.deepEqual(summary(h), ['2 / 3', '1 / 2', '2', '1']);
  assert.equal(h.calls.detect, 0);
  const before = JSON.stringify(h.sandbox.tracks), writes = h.calls.writes;
  h.run('renderMaskSummary(); renderMaskSummary()');
  assert.equal(h.calls.writes, writes, 'Unchanged summaries do not write/announce counts');
  assert.equal(JSON.stringify(h.sandbox.tracks), before);
});
test('toggle, delete, clear automatic, manual creation, and re-detection update the summary', () => {
  const h = harness(); assert.deepEqual(summary(h), ['1 / 1', '1 / 1', '0', '0']);
  h.callbacks['toggle:1'].checked = false; h.callbacks['toggle:1'].onchange(); assert.deepEqual(summary(h), ['0 / 1', '1 / 1', '1', '0']);
  h.callbacks['del:1'].onclick(); assert.deepEqual(summary(h), ['0 / 0', '1 / 1', '0', '0']);
  h.run('applyRedetectionAt(.2,[{x:10,y:8,w:20,h:18,score:.99}])'); assert.deepEqual(summary(h), ['1 / 1', '1 / 1', '0', '1']);
  h.element('clearTracks').onclick(); assert.deepEqual(summary(h), ['0 / 0', '1 / 1', '0', '0']);
  h.sandbox.canvas.width = 96; h.sandbox.canvas.height = 64; h.element('manualDuration').value = 'all'; h.element('manualInterp').value = 'hold';
  h.sandbox.drag = { kind: 'new', x: 5, y: 5, cx: 30, cy: 30 }; h.callbacks.pointerup({});
  assert.deepEqual(summary(h), ['0 / 0', '2 / 2', '0', '0']);
});
test('new file and language changes refresh incomplete/zero state without detecting', async () => {
  const h = harness(); await h.run("loadFile({name:'synthetic.mp4',size:0})");
  assert.equal(h.sandbox.analysisDone, false); assertGate(h, false); assert.deepEqual(summary(h), ['0 / 0', '0 / 0', '0', '0']);
  assert.match(h.element('maskAnalysisStatus').textContent, /not complete/i);
  h.run("lang='ja';applyLang()"); assert.match(h.element('maskAnalysisStatus').textContent, /未完了/); assert.equal(h.calls.detect, 0);
});
test('analysis start/failure/success refreshes counts and incomplete status', async () => {
  const h = harness({ failure: 'partial' }); const running = h.analyze();
  assert.deepEqual(summary(h), ['0 / 0', '1 / 1', '0', '0']); await running;
  assert.equal(h.element('maskAuto').textContent, `${h.sandbox.tracks.filter(t => !t.manual).length} / ${h.sandbox.tracks.filter(t => !t.manual).length}`);
  assert.match(h.element('maskAnalysisStatus').textContent, /not complete/i);
  h.behavior.failure = null; await h.analyze(); assert.match(h.element('maskAnalysisStatus').textContent, /review still required/i);
});
test('export summary has accessible localized labels and a persistent full-video review warning', () => {
  assert.ok(/id="maskSummary"[^>]*aria-labelledby="maskSummaryTitle"/.test(source));
  assert.ok(/id="maskSummaryCounts"[^>]*role="status"[^>]*aria-live="polite"[^>]*aria-atomic="true"/.test(source));
  for (const id of ['maskAuto', 'maskManual', 'maskDisabled', 'maskFlagged', 'maskAnalysisStatus']) assert.ok(source.includes(`id="${id}"`), id);
  assert.ok(/data-en="Automatic paths enabled"/.test(source)); assert.ok(/data-en="Manual covers enabled"/.test(source));
  assert.ok(/Face detection is fallible\. Review the entire video and the exported result before sharing\./.test(source));
  assert.ok(/顔検出には見落としがあります。共有前に動画全体と書き出した結果を確認してください。/.test(source));
  assert.ok(/\.mask-summary[^\n]*minmax\(0,1fr\)/.test(source));
});
