# Changelog

## 1.0.0
- Fixed portrait smartphone videos whose MP4 track stores landscape coded dimensions plus rotation metadata: detected face boxes are now mapped between coded and displayed coordinates correctly.
- Show the display-oriented resolution first (for example 1080×1920, with the stored 1920×1080 size noted when different), keep exact-frame/manual editing aligned, and export rotated inputs in their visible orientation.
- Start continuous review playback automatically from the beginning after face detection completes.
- Clear the previous video frame, detected tracks, review frame, timeline marks, and analysis state immediately when a new video is selected so stale overlays cannot remain on the new first frame.

- Added GitHub Pages deployment workflow, live demo links, and Pages setup guides aligned with html-pdf-organizer/template conventions.

- Fixed Windows PowerShell 5.1 repository checks by keeping the check script ASCII-only and avoiding locale-sensitive UI strings.
- Added conditional H.265/HEVC input support for `hvc1.*` / `hev1.*` MP4/MOV files using WebCodecs and the MP4 `hvcC` decoder configuration.
- Added HEVC codec normalization fallback so inputs reported as `hvc1.1.6.L123` also probe `hvc1.1.6.L123.00`.
- HEVC input is decoded only when the current browser/device confirms support; output remains H.264 MP4.
- Show face-detection progress directly on the video preview, with a mobile-friendly overlay.
- Keep the review status row a fixed size and use a quieter visual treatment.
- During continuous playback, show a stable “Playing” state instead of alternating between checked/estimated labels.
- Reduced standalone HTML payload size without changing UI/UX by gzip-embedding ONNX Runtime Web JavaScript and the YuNet model.
- Recompressed the existing ONNX Runtime WASM gzip payload more efficiently while preserving the exact decompressed WASM bytes.
- Changed the build to gzip MP4Box.js chunks before Base64 embedding and record embedded gzip metadata in the dependency manifest.
- Made the empty preview an additional video-selection entry point.
- Start face detection automatically after a supported video is loaded, while keeping the Find faces button for re-analysis.
- Renamed the mobile Review destination to Review/Edit.
- Simplified the favicon to match the app's video-player brand mark.
- Changed smartphone redaction style choices from a 2×2 layout to a single 4-column row.
- Added an editable MP4 output filename field with safe filename normalization.
- Removed the export button from the header so export remains in the normal workflow and mobile bottom bar.
- Reworked smartphone redaction controls: large 2-column style buttons, quick pixel/blur strength presets, duration chips, and movement choice cards.
- Moved the redaction-style section directly below the preview on smartphones and changed the bottom navigation from Manual to Style.
- Replaced the smartphone preview padding slider with a subtle translucent `- / +` overlay inside the video to avoid confusion with the timeline.
- Fixed the empty preview so the default canvas rectangle is not visible before a video is selected.
- Added the template-standard smartphone fixed bottom navigation with Video / Faces / Review / Manual / Save actions and Safe Area support.


- Added a preview-adjacent mask padding control synchronized with the sidebar setting.
- Reworded the primary UI to avoid developer terms such as PTS, decoder/encoder, keyframes, and interpolation.
- Preserve source aspect ratio with 640×640 letterbox preprocessing for YuNet.
- Decode exact MP4 PTS frames for frame-by-frame review.
- Show sampled/interpolated/re-detected frame status.
- Add per-frame YuNet re-detection to correct automatic track keyframes.

- Initial video edition based on Face Redactor.
- Added MP4Box.js demux/mux pipeline.
- Added WebCodecs H.264 decode/encode pipeline.
- Added sampled YuNet analysis, lightweight face tracking, and interpolation.
- Added 1 fps as a low-load YuNet analysis option (1 / 2 / 5 / 10 fps, default 5 fps).
- Added manual video masks and interpolated manual keyframes.
- Added pixelate, blur, fill, and emoji redaction.
- Added AAC passthrough and MP4 export.
- Added an analysis-complete export gate to reduce accidental unredacted saves.
- Added build-time dependency hashing and a root-level expanded HTML copy.
- Fixed AVC compatibility detection so valid high-profile inputs such as `avc1.640033` are not conflated with Level 3.1 export support.
- Added separate WebCodecs API, input decoder, and selected-resolution encoder capability indicators.
- Added dynamic H.264 encoder profile/level candidates and re-check on resolution/quality changes.
- Aligned the UI with `htmlapps-template` light-theme header, cards, help dialog, and mobile layout.
- Replaced the favicon with a video-specific face-redaction icon.
- Added previous/next frame controls and an explicit continuous-review control.
- Added an explicit final-frame YuNet pass and safe tail extension for face tracks near the video end.
- Added per-manual-mask duration choices (1 frame, ±1/3/5 seconds, whole video).
- Added per-manual-mask interpolation choices (smooth interpolation or hold position), editable after selection.
- Stabilized continuous review playback by synchronizing canvas updates with `requestVideoFrameCallback()` when available, with `requestAnimationFrame()` fallback.
- Manual mask cards now jump to the mask's stored edit frame and enable direct drag repositioning in the preview.
