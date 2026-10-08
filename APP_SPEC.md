# App specification

- **Name:** Video Face Redactor / 動画顔ぼかし
- **Version:** 1.0.1
- **Primary artifact:** `dist/index.html`
- **Runtime:** fully client-side; no application-server upload
- **Runtime network policy:** `connect-src 'none'`
- **Input v1:** MP4/MOV with H.264/AVC or H.265/HEVC video; HEVC is runtime-gated by browser/device WebCodecs support
- **Audio v1:** AAC (`mp4a`) is copied without re-encoding when its decoder configuration and bounded presentation timeline are supported (see below); otherwise export is silent with a visible warning and disabled audio checkbox.
- **Export:** H.264 MP4 via WebCodecs + MP4Box.js

## Face processing

- YuNet + ONNX Runtime Web is reused from Face Redactor.
- After a supported video loads, YuNet face analysis starts automatically with the default 5 fps setting; users can re-run it at 1 / 2 / 5 / 10 fps. The final real source frame is explicitly analyzed.
- Detections are associated into face tracks with IoU, center-distance, and size similarity.
- Boxes between keyframes are linearly interpolated.
- Masks default to 18% padding to reduce visible-face leakage when tracking shifts slightly.
- Manual masks can be drawn at the current playhead with a per-mask duration of 1 frame, ±1 / ±3 / ±5 seconds, or the whole video.
- Manual keyframes support per-mask smooth linear interpolation or hold-position mode, and both settings can be changed after selecting the mask.

## Redaction styles

- Pixelate
- Blur
- Fill
- Emoji (including quick picks and arbitrary emoji input)

## Safety / UX

- Detection is explicitly presented as fallible.
- Users are instructed to review the entire video before sharing the export. Previous/next frame controls support frame-by-frame inspection, while continuous playback supports a full pass.
- The final real frame is forced into the analysis schedule, and auto tracks detected near the tail are extended to the actual video end as a safety measure against last-frame leakage.
- H.264/AVC or H.265/HEVC recognition, exact input decoder support, and selected-output H.264 encoder support are reported separately.
- `avc1.640033` and other valid AVC profile/level strings are not rejected merely because they are higher than Level 3.1.
- `hvc1.*` / `hev1.*` input uses the MP4 `hvcC` record as `VideoDecoderConfig.description`; abbreviated strings such as `hvc1.1.6.L123` also probe a `.00`-qualified candidate for WebCodecs compatibility.
- Input compatibility is checked with `VideoDecoder.isConfigSupported()` using the actual codec/profile/level and dimensions.
- Export compatibility is checked with `VideoEncoder.isConfigSupported()` for the selected output resolution; source/1080p/720p can differ.
- Unsupported codecs are rejected instead of silently producing a broken file.
- Export remains disabled until face analysis completes and the selected H.264 output configuration is supported. Starting a full re-analysis resets completion; a failed attempt keeps desktop Export and mobile Save disabled until a successful retry. Late callbacks from a failed attempt cannot change the next attempt's masks or status.
- The Export card summarizes enabled/total automatic paths and manual covers, disabled masks, and enabled automatic paths flagged for review. Counts describe paths, not unique people; zero masks or zero flags never certifies privacy. The whole-video/exported-result review warning stays visible.
- Users can edit the exported MP4 file name; invalid filename characters are sanitized and `.mp4` is enforced.
- UI follows the `htmlapps-template` light-theme header, spacing, card, help-dialog, and mobile-first conventions.

## Review controls

- Continuous review uses `HTMLVideoElement.requestVideoFrameCallback()` when available so the canvas preview and masks update on presented video frames; `requestAnimationFrame()` is the fallback.
- After a successful full-video face analysis, review playback automatically restarts from the beginning. If browser autoplay policy blocks it, the UI asks the user to press Continuous play.
- Selecting a new video clears the previous preview pixels and all automatic detection/review state before the new first frame is shown.
- Selecting a manual mask jumps to its stored edit/anchor time and enables drag repositioning on the preview canvas.


## Precise frame review

- Face detector preprocessing: 640×640 letterbox preserving source aspect ratio; detections are mapped back after removing padding.
- MP4 track-header rotation is parsed separately from coded frame dimensions. Automatic detections remain in coded-frame coordinates internally and are transformed to the display orientation for preview/manual editing.
- Portrait sources stored as landscape coded frames plus 90°/270° rotation metadata are shown using display-oriented dimensions, and export physically renders that display orientation so the saved MP4 does not depend on the original rotation matrix.
- Frame stepping: use MP4 sample PTS and direct WebCodecs decode from the preceding keyframe to the target sample.
- Review state: sampled / interpolated / re-detected.
- Per-frame re-detection: rerun YuNet on the exact decoded frame and update automatic track keyframes.
## User-facing terminology

- Keep technical implementation terms out of the primary UI where possible.
- Show browser support as whether the app can **open** and **save** the selected video.
- Describe sampled/interpolated review state as **checked here** / **position estimated from nearby checks**.
- Provide mask padding in the settings sidebar and, on smartphones, as a deliberately small translucent `- / +` control inside the video preview. Avoid a second horizontal slider near the timeline so it cannot be mistaken for video position.


## Mobile navigation

- At `600px` and below, show a fixed safe-area-aware 5-item bottom bar: Video, Faces, Review/Edit, Style, Save.
- Move the Style section next to the preview on smartphones; restore it to the settings sidebar on larger screens.
- Smartphone style selection uses one 4-column row of compact, thumb-friendly tap targets instead of the compact select. Pixelate/blur expose quick strength presets plus fine adjustment.
- Smartphone manual-cover duration uses horizontal chips and movement behavior uses two large choice cards.
- Save uses a real `disabled` state until export is available.
- Desktop keeps the normal in-flow controls.

## Video selection

- The source video can be selected from either the source card or the empty preview area.
- The header contains only app identity, language, and help actions; export stays in the workflow/card and mobile bottom navigation rather than the header.

## Standalone size optimization

- Keep the single-HTML, runtime-offline behavior unchanged.
- Store ONNX Runtime Web JavaScript, ONNX Runtime WASM, and the YuNet model as gzip + Base64 payloads.
- Gzip MP4Box.js chunks during the Windows build before Base64 embedding instead of embedding the raw ESM text as Base64.
- Restore compressed assets with `DecompressionStream`; this does not add a new browser requirement because the app already uses the same API to restore the ONNX Runtime WASM payload.
- Compression must be lossless: the decompressed library/model bytes must match the original bytes exactly.

## Header normalization (1.0.1)

- The language control shows EN in Japanese and JA in English, with a destination title and accessible name localized to the current UI language. Existing header Help attributes are localized.
- Existing Japanese local-processing badges use 完全ローカル処理, with accurate English wording retained. Layout, processing boundaries, persistence, model/camera behavior, and their existing limitations are unchanged.

## Audio timeline safety (1.0.1)

- Preserve original AAC sample bytes, raw DTS/CTS, media timescale and complete media duration. Do not subtract a presumed 1,024 samples or rewrite fragment packet durations.
- Support absent/identity edits and one unit-rate media edit that trims only the head and reaches the full media tail, optionally preceded by one empty delay edit. All original AAC packets remain present.
- Reject shortened tails, multiple/disjoint media edits, nonunit rates, malformed/unknown durations or timescales, nonzero first audio DTS, discontinuities and incompatible video presentation timelines. Unsupported audio is unchecked/disabled, with a localized warning that export will be silent.
- Before enabling audio, validate retained source fragment boxes. Both selected tracks require explicit `tfdt` and resolved `trun` durations/CTS (including `tfhd` / `trex` duration defaults). AAC must match extraction exactly. For video, only the exact canonical-grid restoration described below may repair MP4Box 2.4.1 timestamp normalization; arbitrary gaps/overlaps, missing timing, mixed classic/fragmented tracks and absent source-boundary proof disable audio.
- Conservatively require continuous raw audio and otherwise-continuous video samples, with the bounded canonical-grid video exception below. Reordered video remains compatible when its one unit-rate edit starts at the first presented frame and spans the full presentation range; delayed, trimmed or otherwise shifted video timelines disable audio. This does not add general video edit-list support.
- Compare edit duration against the full remaining media using a maximum tolerance of one source movie tick plus one media tick (container quantization only, never an AAC packet allowance).
- Rescale only edit segment durations into the output movie clock using cumulative boundaries; preserve each media time in its media clock. Use `elst` version 1 when movie duration exceeds unsigned 32-bit or media time exceeds signed 32-bit range. Keep `mdhd` as raw media duration. Edited `tkhd` is the sum of edit presentation durations; unedited video `tkhd` uses its actual muxed last CTS + stored duration relative to the first DTS. `mvhd` is the maximum track presentation duration.
- Fragmented MP4 remains the export container. Classic STTS/STSZ sample tables can be empty and `nb_frames` can be unavailable; file verification must read actual fragment sample records. FFprobe can still report raw fragmented audio duration (for example 3.021333s) and a nominal last AAC packet duration of 1,024 although the stored final `trun` duration is 640. These reporting differences are not corrected by falsifying media metadata. Verify edit lists, original packet dictionaries including skip metadata, and decoded PCM separately.

## Help dismissal (1.0.1)

- A click on the native Help backdrop closes only when its target is the open dialog and its coordinates are outside the dialog's actual rectangle. Content, padding and boundary clicks stay open.
- Close and the native close event (including Escape) restore focus to the Help opener.

## Exact canonical video-clock restoration (1.0.1)

- MP4Box 2.4.1 can replace later fragment timestamps with a sum of rounded sample durations. Before analysis/review/export, restore retained raw video DTS/CTS only when an exact canonical proof succeeds: media timebase 1,000,000, zero origin, DTS=CTS, no video edits/reordering, constant correctly rounded duration, known raw duration sum, and every stored timestamp exactly on one approved nearest-integer frame grid.
- Approved frame rates are 24, 25, 30, 50, 60, 24000/1001, 30000/1001 and 60000/1001. Integer arithmetic checks the complete grid; neither local gap tolerance nor fitted rational cadence can authorize restoration. Canonical rounded grids may contain one-tick gaps or overlaps, depending on which direction their constant duration rounds.
- Create fresh sample records containing the observed raw DTS/CTS. Preserve compressed bytes, frame order/count, per-sample durations, parser source objects and raw media duration. Save the actual presentation span separately: the last retained CTS plus its stored duration. Never substitute idealized frame-count/rate duration; a two-frame 60 fps source can correctly end at 33,334 microseconds.
- Revalidate the canonical span for audio-copy eligibility. Arbitrary timestamp/CTS/origin/duration changes, edits, unsupported scales/rates and noncanonical discontinuities keep the visible silent-export fallback. This is not general retiming, fragment repair or video edit-list support.
- The 90-frame 30 fps own-export case retains final PTS 2,966,667 and end 3,000,000 microseconds, while media duration remains 2,999,970. Reimport must not accumulate timestamp loss. Exact frame review and manual frame intervals use the restored clock; the detector, mask geometry and existing encoder keyframe expression are unchanged.
- Regression coverage serializes real fragment boxes, executes production parsing/restoration/chunk/mux functions, checks all approved rates including short endpoints and two generations, and rejects timestamp perturbations. Fresh two-generation native WebCodecs export/reimport, masks/frames and exact AAC packet/PCM checks remain separate release gates.
