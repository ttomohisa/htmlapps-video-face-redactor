// Real production timeline/mux functions and pinned MP4Box; no installed codecs required.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { pathToFileURL } = require('node:url');
const { test } = require('node:test');
const root = path.join(__dirname, '..');
const source = fs.readFileSync(process.env.APP_SOURCE || path.join(root, 'src/index.template.html'), 'utf8');
const lines = source.split(/\r?\n/);
function production(name, optional = false) {
  const start = lines.findIndex(line => new RegExp(`^(?:async )?function ${name}\\(`).test(line));
  if (start < 0 && optional) return '';
  assert.notEqual(start, -1, `Production function ${name} must exist`);
  let end = start + 1;
  while (end < lines.length && (!/^\S/.test(lines[end]) || lines[end] === '}')) end++;
  return lines.slice(start, end).join('\n');
}
const edit = (segment_duration, media_time = 1024) => ({ segment_duration, media_time, media_rate_integer: 1, media_rate_fraction: 0 });
function inputFixture() {
  return { audioSourceTimelineOk: true, info: { timescale: 1000 }, supported: true, h264: true, decoderOk: true, encoderOk: true,
    audioTrack: { codec: 'mp4a.40.2', timescale: 48000, duration: 145024, movie_timescale: 1000, edits: [edit(3000)], audio: { channel_count: 1, sample_rate: 48000, sample_size: 16 } },
    audioSampleEntry: { type: 'mp4a', esds: {} },
    audioSamples: Array.from({ length: 142 }, (_, i) => ({ dts: i * 1024, cts: i * 1024, timescale: 48000, duration: i === 141 ? 640 : 1024, data: new Uint8Array([i % 256]), is_sync: true })),
    videoTrack: { codec: 'avc1.42001e', timescale: 90000, duration: 270000, movie_timescale: 1000, edits: [edit(3000, 0)] },
    videoSamples: Array.from({ length: 90 }, (_, i) => ({ dts: i * 3000, cts: i * 3000, timescale: 90000, duration: 3000 })) };
}
function harness(input = inputFixture(), MP4Box) {
  const elements = { keepAudio: { checked: true, disabled: false }, compat: { textContent: '', classList: { toggle() {} } } };
  const context = { input, MP4Box, lang: 'en', browserCaps: { api: true }, window: { VideoDecoder: {} }, $: id => elements[id] };
  vm.createContext(context);
  vm.runInContext(['tr', 'audioCanCopy', 'cloneDescriptionBox', 'finalizeMovieDurations', 'updateCompatWarnings'].map(n => production(n)).join('\n') + '\n' +
    ['audioCopyPlan', 'audioTimelineSpan', 'audioEditNear', 'refreshAudioSupport', 'addCopiedAudioTrack', 'certifyVideoClock'].map(n => production(n, true)).join('\n'), context);
  return { context, elements, run: code => vm.runInContext(code, context) };
}
test('full-tail priming, identity, absent edits and optional leading silence remain copyable', () => {
  for (const head of [0, 512, 1024, 2048]) {
    const input = inputFixture(); input.audioTrack.edits = [edit(Math.round((145024 - head) / 48), head)];
    assert.equal(harness(input).run('audioCanCopy()'), true, `head=${head}`);
    input.audioTrack.edits.unshift(edit(250, -1)); assert.equal(harness(input).run('audioCanCopy()'), true);
  }
  const input = inputFixture(); delete input.audioTrack.edits; assert.equal(harness(input).run('audioCanCopy()'), true);
});
const unsafe = {
  'one-second shortened tail': i => i.audioTrack.edits[0].segment_duration = 2000,
  'tail exceeds one-tick quantization tolerance': i => i.audioTrack.edits[0].segment_duration = 2998,
  'overlong edit': i => i.audioTrack.edits[0].segment_duration = 4000,
  'multiple media edits': i => i.audioTrack.edits.push(edit(1, 0)),
  'trailing empty edit': i => i.audioTrack.edits.push(edit(250, -1)),
  'two empty edits': i => i.audioTrack.edits.unshift(edit(1, -1), edit(1, -1)),
  'empty-only edits': i => i.audioTrack.edits = [edit(250, -1)],
  'nonunit rate': i => i.audioTrack.edits[0].media_rate_integer = 2,
  'fractional rate': i => i.audioTrack.edits[0].media_rate_fraction = 1,
  'negative media time': i => i.audioTrack.edits[0].media_time = -2,
  'out-of-range media time': i => i.audioTrack.edits[0].media_time = 145024,
  'noninteger edit': i => i.audioTrack.edits[0].segment_duration = 2999.5,
  'unsafe integer': i => i.audioTrack.edits[0].segment_duration = Number.MAX_SAFE_INTEGER + 1,
  'unknown audio duration': i => delete i.audioTrack.duration,
  'zero duration': i => i.audioTrack.duration = 0,
  'unknown movie timescale': i => { delete i.audioTrack.movie_timescale; delete i.info.timescale; },
  'zero media timescale': i => i.audioTrack.timescale = 0,
  'malformed edits': i => i.audioTrack.edits = {},
  'null edit': i => i.audioTrack.edits = [null],
  'nonzero first DTS': i => { for (const s of i.audioSamples) s.dts += 1024; },
  'audio discontinuity': i => i.audioSamples[4].dts++,
  'audio CTS offset': i => i.audioSamples[4].cts++,
  'missing final packet': i => i.audioSamples.pop(),
  'missing samples': i => i.audioSamples = [],
  'wrong sample scale': i => i.audioSamples[0].timescale = 44100,
  'zero packet duration': i => i.audioSamples[0].duration = 0,
  'video head trim': i => i.videoTrack.edits[0].media_time = 3000,
  'video tail trim': i => i.videoTrack.edits[0].segment_duration = 2000,
  'video delay': i => i.videoTrack.edits.unshift(edit(250, -1)),
  'video CTS discontinuity': i => i.videoSamples[4].cts++,
  'video has unknown duration': i => delete i.videoTrack.duration,
  'video implicit shift': i => { delete i.videoTrack.edits; for (const s of i.videoSamples) s.cts += 3000; }
};
for (const [label, change] of Object.entries(unsafe)) test(`unsafe ${label} disables AAC copying`, () => {
  const input = inputFixture(); change(input); assert.equal(harness(input).run('audioCanCopy()'), false);
});
test('a reordered video whose single edit starts at its first PTS is compatible', () => {
  const input = inputFixture(); for (const s of input.videoSamples) s.cts += 6000;
  [input.videoSamples[1].cts, input.videoSamples[2].cts] = [input.videoSamples[2].cts, input.videoSamples[1].cts];
  input.videoTrack.edits = [edit(3000, 6000)]; assert.equal(harness(input).run('audioCanCopy()'), true);
});
test('audio timeline refusal is visible, unchecked and disabled; later supported file restores control', () => {
  const input = inputFixture(); input.audioTrack.edits[0].segment_duration = 2000; const h = harness(input);
  h.run('refreshAudioSupport(); updateCompatWarnings()');
  assert.equal(h.context.input.audioOk, false); assert.equal(h.elements.keepAudio.checked, false); assert.equal(h.elements.keepAudio.disabled, true);
  assert.match(h.elements.compat.textContent, /timeline.*silent/i);
  h.context.input = inputFixture(); h.run('refreshAudioSupport(); updateCompatWarnings()');
  assert.equal(h.elements.keepAudio.disabled, false); assert.equal(h.elements.keepAudio.checked, true); assert.equal(h.elements.compat.textContent, '');
  h.elements.keepAudio.checked = false; h.run('refreshAudioSupport()'); assert.equal(h.elements.keepAudio.checked, false, 'preserve chosen silent export');
});
let pinnedModule;
async function mp4box() {
  if (!pinnedModule) {
    // Tests also run before the first build. Restore the committed, pinned chunks
    // into a temporary directory instead of requiring an untracked vendor cache.
    const os = require('node:os'), zlib = require('node:zlib'), crypto = require('node:crypto');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'redactor-mp4box-'));
    process.on('exit', () => fs.rmSync(dir, { recursive: true, force: true }));
    const bundled = fs.readFileSync(path.join(root, 'video-face-redactor.html'), 'utf8');
    const pins = [
      ['MAIN', 'mp4box.all.mjs', '34fa8fd681e8b63998ca9e4c3b477830dd11310c8aaedc37ecb8f49c5452d259'],
      ['CORE', 'styp-9TIZZDLN.mjs', 'ae15acb79233251b72af7f7cc9f47e7f47cadb209206753b7000b502a2391049'],
      ['RUNTIME', 'rolldown-runtime-w6R9maHv.mjs', '183552fe973134bce551888434b581d5a2cb695a82d8907e2cd9d2b61e12ce24']
    ];
    for (const [id, name, hash] of pins) {
      const payload = bundled.match(new RegExp(`const MP4BOX_${id}_GZIP_B64="([^"]+)"`));
      assert.ok(payload, `Pinned ${id} chunk is embedded`);
      const bytes = zlib.gunzipSync(Buffer.from(payload[1], 'base64'));
      assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), hash, `${name} pinned bytes`);
      fs.writeFileSync(path.join(dir, name), bytes);
    }
    pinnedModule = import(pathToFileURL(path.join(dir, 'mp4box.all.mjs')).href);
  }
  return pinnedModule;
}
function parse(MP4Box, bytes) {
  const file = MP4Box.createFile(true), samples = []; let info;
  file.onReady = value => { info = value; for (const t of value.tracks) file.setExtractionOptions(t.id, t.id); file.start(); };
  file.onSamples = (id, user, values) => samples.push(...values);
  const buffer = Uint8Array.from(bytes).buffer; buffer.fileStart = 0; file.appendBuffer(buffer); file.flush();
  assert.ok(info); return { file, info, samples };
}
test('pinned MP4Box mux preserves priming edit, source packet bytes/times and media versus presentation duration', async () => {
  const MP4Box = await mp4box(), original = parse(MP4Box, fs.readFileSync(path.join(__dirname, 'fixtures/synthetic-aac-priming.m4a')));
  const input = inputFixture(); input.audioTrack = original.info.audioTracks[0]; input.audioSampleEntry = original.file.getTrackById(input.audioTrack.id).mdia.minf.stbl.stsd.entries[0]; input.audioSamples = original.samples;
  const editsBefore = JSON.stringify(input.audioTrack.edits), h = harness(input, MP4Box), out = MP4Box.createFile(); out.init({ timescale: 1000000 }); out.discardMdatData = false;
  h.context.out = out; const aId = h.run('addCopiedAudioTrack(out)'); assert.ok(aId);
  for (const a of input.audioSamples) out.addSample(aId, new Uint8Array(a.data), { dts: a.dts, cts: a.cts, duration: a.duration, is_sync: a.is_sync });
  h.run('finalizeMovieDurations(out)'); const restored = parse(MP4Box, new Uint8Array(out.getBuffer().buffer)), track = restored.file.moov.traks[0];
  assert.equal(track.mdia.mdhd.duration, 7168); assert.equal(track.tkhd.duration, 128000); assert.equal(restored.file.moov.mvhd.duration, 128000);
  assert.deepEqual(track.edts.elst.entries, [edit(128000)]); assert.equal(JSON.stringify(input.audioTrack.edits), editsBefore);
  assert.notEqual(out.moov.traks[0].edts.elst.entries[0], input.audioTrack.edits[0]);
  const packets = samples => samples.map(s => ({ dts: s.dts, cts: s.cts, duration: s.duration, bytes: Buffer.from(s.data).toString('hex') }));
  assert.deepEqual(packets(restored.samples), packets(input.audioSamples));
});
test('finalization keeps raw mdhd and uses edit presentation duration for tkhd and movie maximum', async () => {
  const MP4Box = await mp4box(), h = harness(undefined, MP4Box), out = MP4Box.createFile(); out.init({ timescale: 1000000 });
  const a = out.addTrack({ type: 'mp4a', hdlr: 'soun', timescale: 48000 }); const v = out.addTrack({ type: 'avc1', hdlr: 'vide', timescale: 1000000 });
  out.getTrackById(a).samples_duration = 145024; out.getTrackById(v).samples_duration = 3500000;
  const elst = out.getTrackById(a).addBox(new MP4Box.BoxParser.box.edts()).addBox(new MP4Box.BoxParser.box.elst()); elst.entries = [edit(250000, -1), edit(3000000)];
  h.context.out = out; h.run('finalizeMovieDurations(out)');
  assert.equal(out.getTrackById(a).mdia.mdhd.duration, 145024); assert.equal(out.getTrackById(a).tkhd.duration, 3250000); assert.equal(out.moov.mvhd.duration, 3500000);
});
test('edit conversion rounds cumulative movie boundaries and preserves signed 64-bit media times', async () => {
  const MP4Box = await mp4box(), input = inputFixture(); input.audioTrack.movie_timescale = 3; input.audioTrack.timescale = 3; input.audioTrack.duration = 2147483653;
  input.audioSamples = [{ dts: 0, cts: 0, duration: 2147483653, timescale: 3, data: new Uint8Array([1]) }];
  input.audioTrack.edits = [edit(1, -1), edit(5, 2147483648)]; const h = harness(input, MP4Box), out = MP4Box.createFile(); out.init({ timescale: 1000000 }); h.context.out = out;
  const id = h.run('addCopiedAudioTrack(out)'); const elst = out.getTrackById(id).edts.elst;
  assert.equal(elst.version, 1); assert.deepEqual(Array.from(elst.entries, e => e.segment_duration), [333333, 1666667]);
  const stream = new MP4Box.DataStream(); elst.write(stream); const read = new MP4Box.DataStream(stream.buffer); read.seek(8); const parsed = new MP4Box.BoxParser.box.elst(); parsed.parse(read);
  assert.equal(parsed.version, 1); assert.equal(parsed.entries[1].media_time, 2147483648);
});
test('production load and export wire the guarded audio path', () => {
  assert.match(production('loadFile'), /refreshAudioSupport\(\)/);
  assert.match(production('exportVideo'), /addCopiedAudioTrack\(out\)/);
  assert.doesNotMatch(production('exportVideo'), /if\(!aId\)copyAudio=false/);
});
test('ordinary silent/no-AAC paths remain explicit and localized', () => {
  for (const kind of ['absent', 'codec', 'description']) {
    const input = inputFixture();
    if (kind === 'absent') input.audioTrack = null;
    if (kind === 'codec') input.audioTrack.codec = 'ac-3';
    if (kind === 'description') input.audioSampleEntry = {};
    const h = harness(input); h.run('refreshAudioSupport(); updateCompatWarnings()');
    assert.equal(h.elements.keepAudio.disabled, true); assert.equal(h.elements.keepAudio.checked, false);
    if (kind === 'absent') assert.equal(h.elements.compat.textContent, '');
    else { assert.match(h.elements.compat.textContent, /saved video will be silent/); h.run("lang='ja';updateCompatWarnings()"); assert.match(h.elements.compat.textContent, /音声なし/); }
  }
});
test('copy creation rejects unsafe timelines and track creation failure instead of silently dropping requested audio', () => {
  const input = inputFixture(); input.audioTrack.edits[0].segment_duration = 2000;
  const h = harness(input, { createFile() {}, addTrack() { throw Error('must not add'); } });
  h.context.out = { addTrack() { throw Error('must not add'); } };
  assert.throws(() => h.run('addCopiedAudioTrack(out)'), /cannot be copied safely/);
  h.context.input = inputFixture(); h.context.out = { addTrack() { return undefined; } };
  assert.throws(() => h.run('addCopiedAudioTrack(out)'), /audio track creation failed/);
});
test('absent/identity edits retain samples without synthesizing a priming shift', async () => {
  const MP4Box = await mp4box();
  for (const identity of [false, true]) {
    const input = inputFixture(); input.audioTrack.edits = identity ? [edit(Math.round(145024 / 48), 0)] : [];
    const h = harness(input, MP4Box), out = MP4Box.createFile(); out.init({ timescale: 1000000 }); h.context.out = out;
    const id = h.run('addCopiedAudioTrack(out)'), track = out.getTrackById(id);
    if (identity) assert.equal(track.edts.elst.entries[0].media_time, 0);
    else assert.equal(track.edts, undefined);
  }
});
test('a presentation edit exceeding unsigned 32-bit movie duration uses version one', async () => {
  const MP4Box = await mp4box(), input = inputFixture(); input.audioTrack.edits.unshift(edit(4294968, -1));
  const h = harness(input, MP4Box), out = MP4Box.createFile(); out.init({ timescale: 1000000 }); h.context.out = out;
  const id = h.run('addCopiedAudioTrack(out)'), elst = out.getTrackById(id).edts.elst;
  assert.equal(elst.version, 1); assert.equal(elst.entries[0].segment_duration, 4294968000); assert.equal(elst.entries[0].media_time, -1);
});

// This boundary regression serializes actual fragments, then runs the production
// parseMp4 callback chain with pinned MP4Box. No decoder runs; the video payload is
// an opaque synthetic sample used only to satisfy the container's video track.
async function fragmentedFixture(MP4Box, { secondDts = 1024, durationSource = 'trun', omitTfdt = false, offset = 0, grouped = false, videoSecondDts = 64000, videoClock = null, videoScale = 1000000, videoEdits, videoOrigin = 0 } = {}) {
  const original = parse(MP4Box, fs.readFileSync(path.join(__dirname, 'fixtures/synthetic-aac-priming.m4a')));
  const entry = original.file.moov.traks[0].mdia.minf.stbl.stsd.entries[0];
  const file = MP4Box.createFile(); file.discardMdatData = false;
  const vId = file.addTrack({ type: 'avc1', hdlr: 'vide', timescale: videoScale, width: 320, height: 180 });
  const aId = file.addTrack({ type: 'mp4a', hdlr: 'soun', timescale: 48000, description: entry.esds, channel_count: 1, samplerate: 48000 * 65536 });
  videoClock ||= [{ dts: 0, cts: 0, duration: 64000 }, { dts: videoSecondDts, cts: videoSecondDts, duration: 64000 }];
  for (const s of videoClock) file.addSample(vId, new Uint8Array([0, 0, 0, 1, 9]), { ...s, is_sync: true });
  if (videoEdits) file.getTrackById(vId).addBox(new MP4Box.BoxParser.box.edts()).addBox(new MP4Box.BoxParser.box.elst()).entries = videoEdits;
  for (const [index, sample] of original.samples.entries()) {
    const dts = index === 1 ? secondDts : sample.dts;
    file.addSample(aId, new Uint8Array(sample.data), { dts, cts: dts + offset, duration: sample.duration, is_sync: true });
  }
  if (grouped) {
    // Build two real trun records in one audio traf, with several samples each.
    file.boxes = file.boxes.slice(0, 2 + 2 * videoClock.length); // ftyp, moov, synthetic video fragments
    const samples = file.getTrackById(aId).samples;
    const merged = file.createMoof(samples.slice(0, 3));
    const tail = file.createMoof(samples.slice(3)).trafs[0].truns[0]; tail.flags &= ~1;
    merged.trafs[0].addBox(tail); merged.computeSize(); merged.trafs[0].truns[0].data_offset = merged.size + 8;
    file.addBox(merged); const mdat = file.addBox(new MP4Box.BoxParser.box.mdat()); mdat.data = new Uint8Array(Buffer.concat(samples.map(s => Buffer.from(s.data))));
  }
  if (videoOrigin) for (const moof of file.boxes.filter(b => b.type === 'moof' && b.trafs[0].tfhd.track_id === vId)) moof.trafs[0].tfdt.baseMediaDecodeTime += videoOrigin;
  const elst = file.getTrackById(aId).addBox(new MP4Box.BoxParser.box.edts()).addBox(new MP4Box.BoxParser.box.elst()); elst.entries = [edit(128000)];
  for (const moof of file.boxes.filter(b => b.type === 'moof' && b.trafs[0].tfhd.track_id === aId)) {
    const traf = moof.trafs[0], run = traf.truns[0];
    if (durationSource !== 'trun') {
      run.flags &= ~0x100;
      if (durationSource === 'tfhd') { traf.tfhd.flags |= 8; traf.tfhd.default_sample_duration = 1024; }
      else file.getTrexById(aId).default_sample_duration = 1024;
    }
    if (omitTfdt) { traf.boxes = traf.boxes.filter(b => b.type !== 'tfdt'); delete traf.tfdt; }
    moof.computeSize(); run.data_offset = moof.size + 8;
  }
  // Independent fixture metadata, not the production finalizer under test.
  const videoTrack = file.getTrackById(vId), audioTrack = file.getTrackById(aId);
  videoTrack.mdia.mdhd.duration = videoTrack.samples_duration;
  videoTrack.tkhd.duration = Math.round((videoClock.at(-1).cts + videoClock.at(-1).duration - videoClock[0].dts) / videoScale * file.moov.mvhd.timescale);
  audioTrack.mdia.mdhd.duration = audioTrack.samples_duration; audioTrack.tkhd.duration = 128000;
  file.moov.mvhd.duration = Math.max(videoTrack.tkhd.duration, audioTrack.tkhd.duration);
  return new Uint8Array(file.getBuffer().buffer);
}
async function parseThroughProduction(MP4Box, bytes) {
  const h = harness(undefined, MP4Box);
  Object.assign(h.context, { Uint8Array, setTimeout, video: { videoWidth: 320, videoHeight: 180 },
    probeDecoderCodec: async codec => codec, rotationFromTrackMatrix: () => 0 });
  vm.runInContext(production('parseMp4') + '\n' + production('serializeBoxPayload') + '\n' + ['sourceTimelineMatches', 'sourceTimelineRecords', 'restoreVideoTimeline'].map(n => production(n, true)).join('\n'), h.context);
  h.context.fileToParse = new Blob([bytes]);
  await h.run('parseMp4(fileToParse)');
  return h;
}
const rawAudioDts = parsed => parsed.file.moofs.flatMap(moof => moof.trafs.filter(traf => traf.tfhd.track_id === parsed.info.audioTracks[0].id).map(traf => traf.tfdt?.baseMediaDecodeTime));
for (const secondDts of [1536, 512]) test(`serialized source AAC tfdt ${secondDts} cannot be normalized into copyable audio`, async () => {
  const MP4Box = await mp4box(), bytes = await fragmentedFixture(MP4Box, { secondDts }), parsed = parse(MP4Box, bytes);
  assert.equal(rawAudioDts(parsed)[1], secondDts, 'raw serialized fragment retains the counterexample');
  assert.equal(parsed.samples.filter(s => s.track_id === parsed.info.audioTracks[0].id)[1].dts, 1024, 'pinned extraction hides the discontinuity');
  const h = await parseThroughProduction(MP4Box, bytes);
  assert.equal(h.run('audioCanCopy()'), false, 'production boundary must reject normalized fragment timing');
  h.run('refreshAudioSupport(); updateCompatWarnings()');
  assert.equal(h.elements.keepAudio.disabled, true); assert.equal(h.elements.keepAudio.checked, false); assert.match(h.elements.compat.textContent, /timeline.*silent/i);
  h.context.out = MP4Box.createFile(); assert.throws(() => h.run('addCopiedAudioTrack(out)'), /cannot be copied safely/);
});
for (const durationSource of ['trun', 'tfhd', 'trex']) test(`serialized contiguous fragmented AAC with ${durationSource} durations retains raw timing and packets on copy`, async () => {
  const MP4Box = await mp4box(), bytes = await fragmentedFixture(MP4Box, { durationSource }), parsed = parse(MP4Box, bytes), h = await parseThroughProduction(MP4Box, bytes);
  assert.equal(h.run('audioCanCopy()'), true);
  const out = MP4Box.createFile(); out.init({ timescale: 1000000 }); out.discardMdatData = false; h.context.out = out;
  const id = h.run('addCopiedAudioTrack(out)');
  for (const s of h.context.input.audioSamples) out.addSample(id, new Uint8Array(s.data), { dts: s.dts, cts: s.cts, duration: s.duration, is_sync: s.is_sync });
  h.run('finalizeMovieDurations(out)'); const copied = parse(MP4Box, new Uint8Array(out.getBuffer().buffer));
  assert.deepEqual(rawAudioDts(copied), rawAudioDts(parsed));
  assert.deepEqual(copied.samples.map(s => Buffer.from(s.data)), parsed.samples.filter(s => s.track_id === parsed.info.audioTracks[0].id).map(s => Buffer.from(s.data)));
  assert.equal(copied.file.moov.traks[0].mdia.mdhd.duration, 7168); assert.equal(copied.file.moov.traks[0].tkhd.duration, 128000);
  assert.deepEqual(copied.file.moov.traks[0].edts.elst.entries, [edit(128000)]);
});
test('serialized AAC fragments lacking explicit tfdt are conservatively disabled', async () => {
  const MP4Box = await mp4box(), bytes = await fragmentedFixture(MP4Box, { omitTfdt: true }), h = await parseThroughProduction(MP4Box, bytes);
  assert.equal(h.run('audioCanCopy()'), false);
});
test('missing source-boundary validation cannot authorize passthrough', () => {
  const input = inputFixture(); delete input.audioSourceTimelineOk;
  assert.equal(harness(input).run('audioCanCopy()'), false);
});

test('serialized contiguous AAC in multiple multi-sample runs remains copyable', async () => {
  const MP4Box = await mp4box(), bytes = await fragmentedFixture(MP4Box, { grouped: true });
  const parsed = parse(MP4Box, bytes), audioId = parsed.info.audioTracks[0].id;
  const traf = parsed.file.moofs.flatMap(m => m.trafs).find(t => t.tfhd.track_id === audioId);
  assert.deepEqual(traf.truns.map(r => r.sample_count), [3, 4]);
  const h = await parseThroughProduction(MP4Box, bytes); assert.equal(h.run('audioCanCopy()'), true);
  assert.equal(h.context.input.audioSamples.length, 7);
});
test('raw validation refuses hybrid classic/fragment AAC rather than trusting only its fragment suffix', async () => {
  const MP4Box = await mp4box(), bytes = await fragmentedFixture(MP4Box), parsed = parse(MP4Box, bytes);
  const h = await parseThroughProduction(MP4Box, bytes), audioTrack = parsed.info.audioTracks[0];
  parsed.file.getTrackById(audioTrack.id).mdia.minf.stbl.stsz.sample_sizes.push(1);
  h.context.parsedFile = parsed.file;
  assert.equal(h.run('sourceTimelineMatches(parsedFile,input.audioTrack,input.audioSamples)'), false);
});

for (const videoSecondDts of [64512, 63488, 64001]) test(`serialized video tfdt ${videoSecondDts} cannot silently authorize copied AAC`, async () => {
  const MP4Box = await mp4box(), bytes = await fragmentedFixture(MP4Box, { videoSecondDts }), parsed = parse(MP4Box, bytes);
  const videoId = parsed.info.videoTracks[0].id;
  const starts = parsed.file.moofs.flatMap(m => m.trafs.filter(t => t.tfhd.track_id === videoId).map(t => t.tfdt.baseMediaDecodeTime));
  assert.deepEqual(starts, [0, videoSecondDts]);
  assert.equal(parsed.samples.filter(s => s.track_id === videoId)[1].dts, 64000, 'extraction hides the video boundary difference');
  const h = await parseThroughProduction(MP4Box, bytes);
  assert.equal(h.run('audioCanCopy()'), false, 'audio eligibility must also verify the source video timeline');
  h.run('refreshAudioSupport(); updateCompatWarnings()'); assert.equal(h.elements.keepAudio.disabled, true); assert.match(h.elements.compat.textContent, /timeline.*silent/i);
  assert.equal(h.context.input.videoSamples[1].dts, 64000, 'eligibility checking does not rewrite any video/mask timestamps');
});

const canonicalRates = [[24, 1], [25, 1], [30, 1], [50, 1], [60, 1], [24000, 1001], [30000, 1001], [60000, 1001]];
function canonicalClock([numerator, denominator], count) {
  const rounded = index => Number((2n * BigInt(index) * 1000000n * BigInt(denominator) + BigInt(numerator)) / (2n * BigInt(numerator)));
  const duration = rounded(1);
  return Array.from({ length: count }, (_, i) => ({ dts: rounded(i), cts: rounded(i), duration }));
}
function rawVideoClock(parsed) {
  const id = parsed.info.videoTracks[0].id;
  return parsed.file.moofs.flatMap(m => m.trafs.filter(t => t.tfhd.track_id === id).flatMap(t => {
    let dts = t.tfdt.baseMediaDecodeTime;
    return t.truns.flatMap(r => Array.from({ length: r.sample_count }, (_, k) => {
      const duration = r.sample_duration[k], cts = dts + (r.sample_composition_time_offset[k] || 0), value = { dts, cts, duration }; dts += duration; return value;
    }));
  }));
}
for (const rate of canonicalRates) for (const count of [2, 3, 5, 90]) test(`canonical ${rate.join('/')}fps ${count}-frame source restores exact raw clock and retained endpoint through two mux generations`, async () => {
  const MP4Box = await mp4box(), clock = canonicalClock(rate, count), bytes = await fragmentedFixture(MP4Box, { videoClock: clock });
  const original = parse(MP4Box, bytes), h = await parseThroughProduction(MP4Box, bytes), end = clock.at(-1).cts + clock.at(-1).duration, sum = count * clock[0].duration;
  assert.equal(h.run('audioCanCopy()'), true);
  assert.deepEqual(Array.from(h.context.input.videoSamples, s => ({ dts: s.dts, cts: s.cts, duration: s.duration })), clock);
  assert.equal(h.context.input.videoClockSpan.end, end, 'retained last timestamp plus duration');
  assert.equal(h.context.input.videoClockSpan.duration, sum, 'raw duration sum stays separate');
  let current = h;
  for (let generation = 0; generation < 2; generation++) {
    current.context.EncodedVideoChunk = class { constructor(config) { Object.assign(this, config); } };
    vm.runInContext(production('sampleToChunk'), current.context);
    const chunks = current.run('input.videoSamples.map(sampleToChunk)');
    assert.deepEqual(Array.from(chunks, c => c.timestamp), clock.map(s => s.cts));
    assert.deepEqual(Array.from(chunks, c => c.duration), clock.map(s => s.duration));
    const out = MP4Box.createFile(); out.discardMdatData = false;
    const id = out.addTrack({ type: 'avc1', hdlr: 'vide', timescale: 1000000, width: 320, height: 180 });
    current.context.out = out; const audioId = current.run('addCopiedAudioTrack(out)');
    for (const c of chunks) out.addSample(id, new Uint8Array(c.data), { dts: c.timestamp, cts: c.timestamp, duration: c.duration, is_sync: true });
    for (const a of current.context.input.audioSamples) out.addSample(audioId, new Uint8Array(a.data), { dts: a.dts, cts: a.cts, duration: a.duration, is_sync: a.is_sync });
    current.run('finalizeMovieDurations(out)'); const muxed = new Uint8Array(out.getBuffer().buffer), parsed = parse(MP4Box, muxed);
    assert.deepEqual(rawVideoClock(parsed), clock);
    assert.equal(parsed.file.getTrackById(id).mdia.mdhd.duration, sum);
    assert.equal(parsed.file.getTrackById(id).tkhd.duration, end, 'presentation header uses actual retained end, not duration sum');
    assert.equal(parsed.file.moov.mvhd.duration, Math.max(end, 128000));
    assert.deepEqual(parsed.samples.filter(s => s.track_id === audioId).map(s => Buffer.from(s.data)), original.samples.filter(s => s.track_id === original.info.audioTracks[0].id).map(s => Buffer.from(s.data)));
    current = await parseThroughProduction(MP4Box, muxed); assert.equal(current.run('audioCanCopy()'), true);
  }
});
test('restoration creates fresh sample records and leaves pinned parser source objects and boxes unchanged', async () => {
  const MP4Box = await mp4box(), clock = canonicalClock([30, 1], 90), bytes = await fragmentedFixture(MP4Box, { videoClock: clock }), parsed = parse(MP4Box, bytes), h = await parseThroughProduction(MP4Box, bytes);
  const track = parsed.info.videoTracks[0], samples = parsed.samples.filter(s => s.track_id === track.id), before = samples.map(s => [s.dts, s.cts, s.duration]), boxesBefore = JSON.stringify(rawVideoClock(parsed));
  Object.assign(h.context, { parsedFile: parsed.file, sourceTrack: track, sourceSamples: samples });
  const restored = h.run('restoreVideoTimeline(parsedFile,sourceTrack,sourceSamples)');
  assert.equal(restored.ok, true); assert.notEqual(restored.samples, samples);
  for (let i = 0; i < samples.length; i++) { assert.notEqual(restored.samples[i], samples[i]); assert.equal(restored.samples[i].data, samples[i].data); }
  assert.deepEqual(samples.map(s => [s.dts, s.cts, s.duration]), before); assert.equal(JSON.stringify(rawVideoClock(parsed)), boxesBefore);
});
test('canonical restoration aligns exact frame references and single-frame manual intervals to the raw clock', async () => {
  const MP4Box = await mp4box(), clock = canonicalClock([30, 1], 90), h = await parseThroughProduction(MP4Box, await fragmentedFixture(MP4Box, { videoClock: clock }));
  h.context.video.duration = 3;
  vm.runInContext(['videoEndTime', 'frameRefs', 'frameTimes', 'nearestFrameRef', 'frameRangeAt', 'manualRangeAt', 'lastVideoFrameTimeUs'].map(n => production(n)).join('\n'), h.context);
  assert.equal(h.run('lastVideoFrameTimeUs()'), 2966667); assert.equal(h.run('videoEndTime()'), 3);
  const range = h.run("manualRangeAt(2,'frame')"); assert.equal(range.first, 2); assert.equal(range.last, 2.033333);
  assert.equal(h.run('nearestFrameRef(2).index'), 60);
});

test('every serialized point and tail perturbation of the native90-frame grid rejects restoration and AAC copying', async () => {
  const MP4Box = await mp4box(), original = canonicalClock([30, 1], 90); let checked = 0;
  for (let index = 1; index < original.length; index++) for (const delta of [-512, -1, 1, 512]) for (const mode of ['point', 'tail']) {
    const clock = original.map(s => ({ ...s }));
    for (let j = index; j < (mode === 'point' ? index + 1 : clock.length); j++) { clock[j].dts += delta; clock[j].cts += delta; }
    const bytes = await fragmentedFixture(MP4Box, { videoClock: clock }), parsed = parse(MP4Box, bytes);
    assert.equal(rawVideoClock(parsed)[index].dts, clock[index].dts, 'mutation survives serialization');
    const h = await parseThroughProduction(MP4Box, bytes);
    assert.equal(h.run('audioCanCopy()'), false, `${mode} at ${index} by ${delta}`);
    assert.equal(h.context.input.videoClockSpan, null); checked++;
  }
  assert.equal(checked, 712);
});
for (const [name, change] of Object.entries({
  'nonzero source origin': o => o.videoOrigin = 512,
  'CTS offset': o => o.videoClock[20].cts++,
  'reordered presentation': o => { [o.videoClock[20].cts, o.videoClock[21].cts] = [o.videoClock[21].cts, o.videoClock[20].cts]; },
  'one shortened packet': o => o.videoClock[89].duration--,
  'one extended packet': o => o.videoClock[89].duration++,
  'wrong constant rounded duration': o => o.videoClock.forEach(s => s.duration++),
  'wrong media timescale': o => o.videoScale = 90000,
  'identity video edit': o => o.videoEdits = [edit(3000000, 0)],
  'video head edit': o => o.videoEdits = [edit(3000000, 1024)],
  'unapproved near30 rate': o => { o.videoClock[88].dts++; o.videoClock[88].cts++; },
  'unapproved75fps': o => o.videoClock = canonicalClock([75, 1], 90)
})) test(`serialized ${name} cannot broaden canonical restoration`, async () => {
  const MP4Box = await mp4box(), options = { videoClock: canonicalClock([30, 1], 90) }; change(options);
  const bytes = await fragmentedFixture(MP4Box, options), parsed = parse(MP4Box, bytes);
  if (options.videoOrigin) assert.equal(rawVideoClock(parsed)[0].dts, options.videoOrigin);
  const h = await parseThroughProduction(MP4Box, bytes);
  assert.equal(h.context.input.videoClockSpan, null); assert.equal(h.run('audioCanCopy()'), false);
});
test('certification cannot fabricate an ideal final boundary for two-frame60fps', async () => {
  const MP4Box = await mp4box(), clock = canonicalClock([60, 1], 2), h = await parseThroughProduction(MP4Box, await fragmentedFixture(MP4Box, { videoClock: clock }));
  assert.equal(h.context.input.videoClockSpan.end, 33334);
  assert.notEqual(h.context.input.videoClockSpan.end, Math.round(2 * 1000000 / 60));
});
test('every allowed canonical rate rejects a serialized one-tick point change and512-tick tail shift', async () => {
  const MP4Box = await mp4box();
  for (const rate of canonicalRates) for (const delta of [-1, 1, -512, 512]) {
    const clock = canonicalClock(rate, 90);
    for (let i = 20; i < (Math.abs(delta) === 1 ? 21 : clock.length); i++) { clock[i].dts += delta; clock[i].cts += delta; }
    const h = await parseThroughProduction(MP4Box, await fragmentedFixture(MP4Box, { videoClock: clock }));
    assert.equal(h.run('audioCanCopy()'), false, `${rate.join('/')} ${delta}`);
    assert.equal(h.context.input.videoClockSpan, null);
  }
});
