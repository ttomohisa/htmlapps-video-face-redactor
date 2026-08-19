# App specification

- **Name:** Video Face Redactor / 動画顔ぼかし
- **Version:** 1.0.0
- **Primary artifact:** `dist/index.html`
- **Runtime:** fully client-side; no application-server upload
- **Runtime network policy:** `connect-src 'none'`
- **Input v1:** MP4/MOV with H.264/AVC or H.265/HEVC video; HEVC is runtime-gated by browser/device WebCodecs support
- **Audio v1:** AAC (`mp4a`) is copied without re-encoding when its decoder configuration is available; otherwise export is silent
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
- Export remains disabled until face analysis completes and the selected H.264 output configuration is supported.
- Users can edit the exported MP4 file name; invalid filename characters are sanitized and `.mp4` is enforced.
- UI follows the `htmlapps-template` light-theme header, spacing, card, help-dialog, and mobile-first conventions.

## Review controls

- Continuous review uses `HTMLVideoElement.requestVideoFrameCallback()` when available so the canvas preview and masks update on presented video frames; `requestAnimationFrame()` is the fallback.
- Selecting a manual mask jumps to its stored edit/anchor time and enables drag repositioning on the preview canvas.


## Precise frame review

- Face detector preprocessing: 640×640 letterbox preserving source aspect ratio; detections are mapped back after removing padding.
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
