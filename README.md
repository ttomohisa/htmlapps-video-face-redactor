# Video Face Redactor

[日本語 README](README.ja.md)

A privacy-first, single-HTML video face redaction tool built with **YuNet + ONNX Runtime Web**, **WebCodecs**, and **MP4Box.js**. It detects faces on sampled frames, builds lightweight tracks, interpolates masks between detections, renders pixelation / blur / fill / emoji locally, and exports H.264 MP4. AAC audio is copied without re-encoding when compatible.

## v1.0.0

- MP4 / MOV input with H.264/AVC or H.265/HEVC video (HEVC when supported by the browser/device)
- Separate runtime indicators for WebCodecs APIs, exact input H.264/H.265 decoder support, and selected-output H.264 encoder support
- Profile/level-aware input checks (for example `avc1.640033`) with `VideoDecoder.isConfigSupported()`
- Automatic YuNet face detection after video load (default 5 fps; 1 / 2 / 5 / 10 fps available for re-analysis)
- Lightweight track association and interpolation
- Pixelate / blur / fill / **emoji**
- Manual masks with interpolated manual keyframes
- H.264 export through WebCodecs
- AAC passthrough when compatible
- Original / 1080p / 720p output
- Editable MP4 output file name
- Japanese / English UI
- Runtime network blocked with `connect-src 'none'`
- Single HTML and self-extracting HTML builds

> Face detection and tracking are fallible. Review the entire exported video before sharing it.

## Smartphone UI

At 600px and below, the fixed safe-area bottom bar uses **Video / Faces / Review/Edit / Style / Save**. Face detection progress is also shown directly over the preview so mobile users do not need to scroll back to the settings panel. The Style section is moved directly below the preview on mobile so users can switch pixelate / blur / fill / emoji while looking at the video. A single four-column row of style buttons, strength presets, duration chips, and movement choices replace small select-heavy controls. Mask padding is kept out of the timeline area and appears as a small translucent `- / +` control inside the preview.

## Build

Run `build-standalone.bat` on Windows. The first build downloads pinned **MP4Box.js 2.4.1** into `vendor/`, then embeds it into `dist/index.html`. No CDN is used at runtime.

To reduce the standalone HTML size without changing the UI or detector behavior, MP4Box.js is gzip-compressed at build time before Base64 embedding. ONNX Runtime Web JavaScript, WASM, and the YuNet model are also stored as gzip payloads and restored with the browser's existing `DecompressionStream` path.

The UI follows the `htmlapps-template` light-theme header/card/help conventions. H.264/H.265 input decoding and H.264 output encoding are checked separately at runtime. HEVC inputs use their MP4 `hvcC` decoder configuration and are accepted only when `VideoDecoder.isConfigSupported()` confirms support on the current browser/device.

See [README.ja.md](README.ja.md) for architecture, supported formats, privacy notes, and limitations.

## License

MIT. See `THIRD_PARTY_NOTICES.md` for third-party notices.


The build also writes an expanded root-level `video-face-redactor.html` copy and `dist/dependency-manifest.json` with the exact MP4Box.js chunk hashes.


## Review and manual masks

- Frame-by-frame review with previous/next frame controls plus continuous playback. When available, continuous review is synchronized to presented video frames with `requestVideoFrameCallback()`. During continuous playback the small review-status label stays on a stable “Playing” state; checked/estimated detail is shown only when paused.
- The final real frame is always included in face analysis; tracks reaching the end are safely held through the video tail.
- Manual-mask duration can be 1 frame, ±1/3/5 seconds, or the whole video. Interpolation can be smooth or hold-position per mask. Selecting a manual-mask card jumps to its stored edit frame; drag the highlighted mask in the preview to reposition it.


### Precise review

- YuNet analysis uses aspect-ratio-preserving 640×640 letterboxing.
- Frame stepping directly decodes the selected MP4 presentation timestamp with WebCodecs.
- The UI labels sampled, interpolated, and re-detected frames.
- Re-detect this frame reruns YuNet and corrects automatic track keyframes at that exact frame.
